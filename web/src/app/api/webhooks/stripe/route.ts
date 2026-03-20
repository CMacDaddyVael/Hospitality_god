import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { generateReviewResponses } from '@/lib/provisioning/generateReviewResponses'
import { queueListingCopyDeliverable } from '@/lib/provisioning/queueListingCopy'

// Stripe client — initialized lazily so missing env doesn't crash cold starts
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' })
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars are not configured')
  return createClient(url, key)
}

// Stripe sends the raw body for signature verification — Next.js App Router
// requires us to read it as text before Stripe can verify the HMAC.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // ── 1. Read raw body and verify signature ───────────────────────────────
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch (err) {
    console.error('[stripe-webhook] Failed to read request body:', err)
    return NextResponse.json({ error: 'Failed to read body' }, { status: 400 })
  }

  const signature = req.headers.get('stripe-signature') ?? ''
  let event: Stripe.Event

  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[stripe-webhook] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── 2. Idempotency guard — skip if we've already processed this event ───
  const supabase = getSupabase()
  const eventId = event.id

  const { data: existing, error: lookupError } = await supabase
    .from('stripe_processed_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .maybeSingle()

  if (lookupError) {
    console.error('[stripe-webhook] Event lookup error:', lookupError)
    // Don't block — fall through and let the upserts be idempotent themselves
  }

  if (existing) {
    console.info('[stripe-webhook] Duplicate event, skipping:', eventId)
    return NextResponse.json({ received: true, duplicate: true })
  }

  // ── 3. Route to the correct handler ─────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase)
        break

      default:
        // Acknowledged but not handled — return 200 so Stripe doesn't retry
        console.info('[stripe-webhook] Unhandled event type:', event.type)
    }

    // Record the event as processed (idempotency log)
    await supabase.from('stripe_processed_events').insert({
      stripe_event_id: eventId,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, message)
    // Return 500 so Stripe will retry — don't record as processed
    return NextResponse.json({ error: 'Handler failed', detail: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Event handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabase>
): Promise<void> {
  console.info('[stripe-webhook] checkout.session.completed:', session.id)

  const customerId = session.customer as string | null
  const subscriptionId = session.subscription as string | null
  const ownerUserId = session.client_reference_id ?? session.metadata?.owner_user_id ?? null

  if (!customerId || !subscriptionId) {
    console.warn('[stripe-webhook] checkout.session.completed missing customer/subscription IDs', {
      sessionId: session.id,
      customerId,
      subscriptionId,
    })
    return
  }

  // Fetch full subscription to get period end
  let periodEnd: string | null = null
  try {
    const stripe = getStripe()
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  } catch (err) {
    console.warn('[stripe-webhook] Could not retrieve subscription period end:', err)
  }

  // Upsert subscription record — keyed on stripe_subscription_id
  const { error: upsertError } = await supabase.from('subscriptions').upsert(
    {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      owner_user_id: ownerUserId,
      tier: 'pro',
      status: 'active',
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  )

  if (upsertError) {
    throw new Error(`subscriptions upsert failed: ${upsertError.message}`)
  }

  console.info('[stripe-webhook] Subscription activated for customer:', customerId)

  // Resolve the property linked to this owner so we can trigger deliverables
  const propertyId = await resolvePropertyId(ownerUserId, session, supabase)

  if (!propertyId) {
    console.warn(
      '[stripe-webhook] Could not resolve property_id for provisioning — skipping deliverable generation',
      { ownerUserId, sessionId: session.id }
    )
    return
  }

  // Trigger initial deliverables — non-blocking, errors are logged not thrown
  // so that a content-gen failure doesn't cause Stripe to retry the webhook.
  Promise.all([
    generateReviewResponses(propertyId).catch((err: unknown) =>
      console.error('[stripe-webhook] generateReviewResponses failed:', err)
    ),
    queueListingCopyDeliverable(propertyId, ownerUserId).catch((err: unknown) =>
      console.error('[stripe-webhook] queueListingCopyDeliverable failed:', err)
    ),
  ])
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabase>
): Promise<void> {
  console.info('[stripe-webhook] customer.subscription.updated:', subscription.id)

  const stripeStatus = subscription.status // 'active' | 'past_due' | 'canceled' | ...
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString()

  // Map Stripe status to our internal status
  // We only change tier to free on deletion, not on past_due
  const internalStatus = stripeStatus === 'past_due' ? 'past_due' : stripeStatus

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: internalStatus,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    throw new Error(`subscriptions update failed: ${error.message}`)
  }

  console.info(
    `[stripe-webhook] Subscription ${subscription.id} updated to status: ${internalStatus}`
  )
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof getSupabase>
): Promise<void> {
  console.info('[stripe-webhook] customer.subscription.deleted:', subscription.id)

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      tier: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    throw new Error(`subscriptions cancellation update failed: ${error.message}`)
  }

  console.info(`[stripe-webhook] Subscription ${subscription.id} cancelled, tier set to free`)
  // Intentionally does NOT delete deliverable records per AC
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Best-effort resolution of a property_id for this checkout session.
 * We first try the metadata that was stamped on the Stripe session at
 * checkout creation, then fall back to looking up by owner_user_id in the DB.
 */
async function resolvePropertyId(
  ownerUserId: string | null,
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof getSupabase>
): Promise<string | null> {
  // 1. Prefer explicit metadata set at checkout creation time
  if (session.metadata?.property_id) {
    return session.metadata.property_id
  }

  if (!ownerUserId) return null

  // 2. Look up the most recent property for this owner
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[stripe-webhook] Property lookup error:', error.message)
    return null
  }

  return data?.id ?? null
}
