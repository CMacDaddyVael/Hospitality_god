import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// We need the raw body for Stripe signature verification — Next.js App Router
// requires we read the raw request body before any parsing.
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Set subscription_status and subscription_tier on the profiles row.
 * We look up the user by stripe_customer_id first; if not found we fall back
 * to the client_reference_id (our Supabase user UUID) that we embed at
 * checkout creation time.
 */
async function updateSubscriptionStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  params: {
    stripeCustomerId?: string | null
    clientReferenceId?: string | null
    subscriptionId?: string | null
    status: 'active' | 'inactive'
    tier: 'pro' | 'free'
  }
) {
  const { stripeCustomerId, clientReferenceId, subscriptionId, status, tier } = params

  // Build the update payload
  const updatePayload: Record<string, string | null> = {
    subscription_status: status,
    subscription_tier: tier,
    updated_at: new Date().toISOString(),
  }

  if (stripeCustomerId) {
    updatePayload.stripe_customer_id = stripeCustomerId
  }
  if (subscriptionId) {
    updatePayload.stripe_subscription_id = subscriptionId
  }

  // Prefer looking up by stripe_customer_id for renewals/failures/cancellations
  if (stripeCustomerId) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('stripe_customer_id', stripeCustomerId)
      .select('id')

    if (!error && data && data.length > 0) {
      console.log(`[webhook] Updated profile by stripe_customer_id=${stripeCustomerId}`, { status, tier })
      return
    }

    // If no row matched, fall through to clientReferenceId lookup
  }

  // On first checkout we embed the Supabase user id as client_reference_id
  if (clientReferenceId) {
    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', clientReferenceId)

    if (error) {
      throw new Error(`Failed to update profile by clientReferenceId=${clientReferenceId}: ${error.message}`)
    }

    console.log(`[webhook] Updated profile by clientReferenceId=${clientReferenceId}`, { status, tier })
    return
  }

  throw new Error(
    `Cannot locate profile: no stripeCustomerId or clientReferenceId provided`
  )
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Read raw body — required for signature verification
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.warn('[webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  // Verify webhook signature
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[webhook] Signature verification failed: ${message}`)
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  console.log(`[webhook] Received event: ${event.type} (id=${event.id})`)

  const supabase = getSupabaseAdmin()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription checkouts (not one-time payments)
        if (session.mode !== 'subscription') {
          console.log('[webhook] Skipping non-subscription checkout session')
          break
        }

        const stripeCustomerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id ?? null

        const clientReferenceId = session.client_reference_id ?? null

        await updateSubscriptionStatus(supabase, {
          stripeCustomerId,
          clientReferenceId,
          subscriptionId,
          status: 'active',
          tier: 'pro',
        })

        console.log(`[webhook] checkout.session.completed → subscription activated`, {
          stripeCustomerId,
          subscriptionId,
          clientReferenceId,
        })
        break
      }

      case 'customer.subscription.created': {
        // Belt-and-suspenders: also activate on subscription.created in case
        // checkout.session.completed fires slightly later or is missed.
        const subscription = event.data.object as Stripe.Subscription

        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await updateSubscriptionStatus(supabase, {
            stripeCustomerId,
            subscriptionId: subscription.id,
            status: 'active',
            tier: 'pro',
          })

          console.log(`[webhook] customer.subscription.created → subscription activated`, {
            stripeCustomerId,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
          })
        } else {
          console.log(`[webhook] customer.subscription.created with status=${subscription.status} — no action`)
        }
        break
      }

      case 'customer.subscription.updated': {
        // Handle subscription renewals, plan changes, and reactivations
        const subscription = event.data.object as Stripe.Subscription

        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null

        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        await updateSubscriptionStatus(supabase, {
          stripeCustomerId,
          subscriptionId: subscription.id,
          status: isActive ? 'active' : 'inactive',
          tier: isActive ? 'pro' : 'free',
        })

        console.log(`[webhook] customer.subscription.updated → status=${subscription.status}`, {
          stripeCustomerId,
          subscriptionId: subscription.id,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const stripeCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null

        await updateSubscriptionStatus(supabase, {
          stripeCustomerId,
          subscriptionId: subscription.id,
          status: 'inactive',
          tier: 'free',
        })

        console.log(`[webhook] customer.subscription.deleted → subscription deactivated`, {
          stripeCustomerId,
          subscriptionId: subscription.id,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice

        const stripeCustomerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id ?? null

        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : (invoice.subscription as Stripe.Subscription)?.id ?? null

        // On payment failure we mark inactive so the dashboard shows the
        // re-subscribe prompt. Stripe will retry automatically — if the retry
        // succeeds, invoice.payment_succeeded / subscription.updated fires.
        await updateSubscriptionStatus(supabase, {
          stripeCustomerId,
          subscriptionId,
          status: 'inactive',
          tier: 'free',
        })

        console.log(`[webhook] invoice.payment_failed → subscription marked inactive`, {
          stripeCustomerId,
          subscriptionId,
          invoiceId: invoice.id,
        })
        break
      }

      default:
        // Acknowledge but ignore other event types
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[webhook] Error processing event ${event.type}: ${message}`)
    // Return 500 so Stripe will retry the webhook
    return NextResponse.json({ error: `Webhook handler error: ${message}` }, { status: 500 })
  }
}
