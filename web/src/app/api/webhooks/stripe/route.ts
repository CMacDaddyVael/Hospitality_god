import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ─── Clients ────────────────────────────────────────────────────────────────

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Disable Next.js body parsing — Stripe needs the raw body ────────────────
export const config = {
  api: { bodyParser: false },
}

// ─── Helper: create subscriber row ──────────────────────────────────────────

async function createSubscriber(params: {
  stripeCustomerId: string
  stripeSubscriptionId: string
  email: string
  plan: string
  listingUrl?: string
  sessionId?: string
}) {
  const { stripeCustomerId, stripeSubscriptionId, email, plan, listingUrl, sessionId } = params

  const { data, error } = await supabase
    .from('subscribers')
    .upsert(
      {
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        email,
        plan,
        status: 'active',
        listing_url: listingUrl ?? null,
        session_id: sessionId ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'stripe_customer_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) {
    console.error('[webhook] Failed to upsert subscriber:', error)
    throw new Error(`Supabase upsert failed: ${error.message}`)
  }

  console.log('[webhook] Subscriber created/updated:', data.id, email)
  return data
}

// ─── Helper: enqueue initial swarm job ──────────────────────────────────────

async function enqueueSwarmJob(params: {
  subscriberId: string
  stripeCustomerId: string
  email: string
  listingUrl?: string
  plan: string
}) {
  const { subscriberId, stripeCustomerId, email, listingUrl, plan } = params

  // Write to swarm_jobs queue table — picked up by the swarm dispatcher
  const { data, error } = await supabase
    .from('swarm_jobs')
    .insert({
      subscriber_id: subscriberId,
      stripe_customer_id: stripeCustomerId,
      email,
      listing_url: listingUrl ?? null,
      plan,
      job_type: 'initial_swarm_run',
      status: 'queued',
      priority: 10, // High priority — first run for a new paying subscriber
      payload: {
        trigger: 'subscription_activated',
        tasks: [
          'listing_analysis',
          'listing_rewrite',
          'review_response_drafts',
          'social_content',
          'health_score',
        ],
        send_welcome_brief: true,
      },
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    // Non-fatal — log the error but don't fail the webhook.
    // Stripe will not retry for a 200, so we must not throw here;
    // a separate reconciliation job can catch missed enqueues.
    console.error('[webhook] Failed to enqueue swarm job:', error)
    return null
  }

  console.log('[webhook] Swarm job enqueued:', data.id, 'for', email)
  return data
}

// ─── Helper: cancel subscriber ──────────────────────────────────────────────

async function cancelSubscriber(stripeCustomerId: string, stripeSubscriptionId: string) {
  const { data, error } = await supabase
    .from('subscribers')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', stripeCustomerId)
    .select()
    .single()

  if (error) {
    // Could be a customer we don't have a row for (e.g. pre-webhook era)
    console.error('[webhook] Failed to cancel subscriber:', error)
    throw new Error(`Supabase cancel failed: ${error.message}`)
  }

  console.log('[webhook] Subscriber cancelled:', stripeCustomerId, stripeSubscriptionId)
  return data
}

// ─── Helper: resolve listing URL from Stripe session / customer metadata ─────

function resolveListingUrl(
  session: Stripe.Checkout.Session | null,
  customer: Stripe.Customer | null
): string | undefined {
  // Prefer metadata set during checkout session creation
  const fromSession = session?.metadata?.listing_url
  if (fromSession) return fromSession

  // Fallback: metadata stored on the customer object itself
  const fromCustomer = customer?.metadata?.listing_url
  if (fromCustomer) return fromCustomer

  return undefined
}

function resolveSessionId(
  session: Stripe.Checkout.Session | null,
  customer: Stripe.Customer | null
): string | undefined {
  return session?.metadata?.session_id ?? customer?.metadata?.session_id ?? undefined
}

function resolvePlan(
  session: Stripe.Checkout.Session | null,
  subscription: Stripe.Subscription | null
): string {
  // Try session metadata first (set by our checkout route)
  if (session?.metadata?.plan) return session.metadata.plan

  // Try subscription metadata
  if (subscription?.metadata?.plan) return subscription.metadata.plan

  // Fall back to the price nickname / amount
  const item = subscription?.items?.data?.[0]
  if (item?.price?.nickname) return item.price.nickname

  // Last resort: amount-based detection
  const amount = item?.price?.unit_amount ?? 0
  if (amount <= 4900) return 'pro'
  if (amount <= 14900) return 'autopilot'
  return 'pro'
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Read raw body — required for Stripe signature verification
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.warn('[webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET env var not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // 2. Verify signature
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  console.log('[webhook] Received event:', event.type, event.id)

  // 3. Dispatch to handlers
  try {
    switch (event.type) {
      // ── checkout.session.completed ──────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription checkouts
        if (session.mode !== 'subscription') {
          console.log('[webhook] Ignoring non-subscription checkout session:', session.id)
          return NextResponse.json({ received: true, handled: false }, { status: 200 })
        }

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const email = session.customer_email ?? session.customer_details?.email ?? ''

        if (!customerId || !email) {
          console.error('[webhook] checkout.session.completed missing customer or email:', session.id)
          return NextResponse.json(
            { error: 'Missing customer data in session' },
            { status: 422 }
          )
        }

        // Fetch full objects for metadata
        const [customer, subscription] = await Promise.all([
          stripe.customers.retrieve(customerId) as Promise<Stripe.Customer>,
          subscriptionId
            ? (stripe.subscriptions.retrieve(subscriptionId) as Promise<Stripe.Subscription>)
            : Promise.resolve(null),
        ])

        const listingUrl = resolveListingUrl(session, customer)
        const sessionId = resolveSessionId(session, customer)
        const plan = resolvePlan(session, subscription)

        const subscriber = await createSubscriber({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId ?? '',
          email,
          plan,
          listingUrl,
          sessionId,
        })

        // Enqueue initial swarm job — non-fatal if this fails
        await enqueueSwarmJob({
          subscriberId: subscriber.id,
          stripeCustomerId: customerId,
          email,
          listingUrl,
          plan,
        })

        return NextResponse.json(
          { received: true, handled: true, event: event.type, subscriberId: subscriber.id },
          { status: 200 }
        )
      }

      // ── customer.subscription.created ──────────────────────────────────
      // Fired alongside checkout.session.completed for new subscriptions.
      // We use this as a fallback/idempotent path to ensure the subscriber
      // row exists even if the checkout event was missed or processed out of order.
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer

        if (customer.deleted) {
          console.warn('[webhook] customer.subscription.created for deleted customer:', customerId)
          return NextResponse.json({ received: true, handled: false }, { status: 200 })
        }

        const email = customer.email ?? ''
        if (!email) {
          console.error('[webhook] customer.subscription.created — no email for customer:', customerId)
          return NextResponse.json({ error: 'Customer has no email' }, { status: 422 })
        }

        const listingUrl = customer.metadata?.listing_url ?? undefined
        const sessionId = customer.metadata?.session_id ?? undefined
        const plan = resolvePlan(null, subscription)

        // upsert — safe to call even if checkout.session.completed already ran
        const subscriber = await createSubscriber({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          email,
          plan,
          listingUrl,
          sessionId,
        })

        // Enqueue only if not already queued (idempotency via status check)
        const { data: existingJob } = await supabase
          .from('swarm_jobs')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .eq('job_type', 'initial_swarm_run')
          .maybeSingle()

        if (!existingJob) {
          await enqueueSwarmJob({
            subscriberId: subscriber.id,
            stripeCustomerId: customerId,
            email,
            listingUrl,
            plan,
          })
        } else {
          console.log('[webhook] Initial swarm job already queued for:', customerId)
        }

        return NextResponse.json(
          { received: true, handled: true, event: event.type, subscriberId: subscriber.id },
          { status: 200 }
        )
      }

      // ── customer.subscription.deleted ──────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await cancelSubscriber(customerId, subscription.id)

        return NextResponse.json(
          { received: true, handled: true, event: event.type },
          { status: 200 }
        )
      }

      // ── customer.subscription.updated ──────────────────────────────────
      // Handle reactivations (e.g. cancel → undo cancel before period ends)
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const newStatus = subscription.status // 'active' | 'past_due' | 'canceled' | etc.

        const dbStatus =
          newStatus === 'active' || newStatus === 'trialing'
            ? 'active'
            : newStatus === 'canceled'
            ? 'cancelled'
            : newStatus === 'past_due'
            ? 'past_due'
            : 'inactive'

        const { error } = await supabase
          .from('subscribers')
          .update({
            status: dbStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        if (error) {
          // Not fatal for this event type — subscriber row may not exist yet
          console.warn('[webhook] Could not update subscriber status:', error.message)
        }

        return NextResponse.json(
          { received: true, handled: true, event: event.type, status: dbStatus },
          { status: 200 }
        )
      }

      // ── Unhandled event types ───────────────────────────────────────────
      default: {
        console.log('[webhook] Unhandled event type:', event.type)
        return NextResponse.json(
          { received: true, handled: false, event: event.type },
          { status: 422 }
        )
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] Handler error for event', event.type, ':', message)
    // Return 500 so Stripe retries — this is a genuine processing failure
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
