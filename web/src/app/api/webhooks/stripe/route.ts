/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook receiver. Verifies the event signature then routes
 * to the appropriate handler.
 *
 * This handler is intentionally minimal — it validates and acknowledges
 * events so Stripe stops retrying, and logs them for visibility.
 * Business logic (e.g., updating the database when a subscription is
 * created) belongs in dedicated handler modules and will be added as
 * Issues #135 and related tickets are implemented.
 *
 * Webhook setup:
 *   Local:      stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   Production: https://dashboard.stripe.com/webhooks → add endpoint
 *
 * See docs/stripe-setup.md for full configuration instructions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { HANDLED_WEBHOOK_EVENTS } from '@/lib/stripe/config'
import type Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Stripe requires the raw request body for signature verification.
// Next.js App Router exposes it via request.text() before any parsing.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.warn('[stripe-webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(
      '[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set — ' +
        'cannot verify webhook. See docs/stripe-setup.md.'
    )
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // ---------------------------------------------------------------------------
  // Verify the event signature
  // ---------------------------------------------------------------------------

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.warn(`[stripe-webhook] Signature verification failed: ${message}`)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  // ---------------------------------------------------------------------------
  // Route the event
  // ---------------------------------------------------------------------------

  console.log(`[stripe-webhook] Received: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        // Acknowledge unhandled events so Stripe doesn't retry them.
        // We only register the events we care about in the dashboard,
        // but belt-and-suspenders is fine here.
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[stripe-webhook] Handler error for ${event.type}: ${message}`)
    // Return 500 so Stripe retries — the event was real but our handler failed.
    return NextResponse.json(
      { error: 'Internal handler error', event: event.id },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// Business logic stubs — to be filled in by Issue #135
// ---------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // TODO (Issue #135): Look up the user by session.metadata.sessionId,
  // create/update their subscription record in Supabase, send welcome email.
  console.log('[stripe-webhook] checkout.session.completed', {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    metadata: session.metadata,
  })
}

async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  // TODO (Issue #135): Provision access — set user.plan = 'pro' in Supabase.
  console.log('[stripe-webhook] customer.subscription.created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  })
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  // TODO (Issue #135): Handle plan changes (upgrade/downgrade).
  console.log('[stripe-webhook] customer.subscription.updated', {
    subscriptionId: subscription.id,
    status: subscription.status,
  })
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  // TODO (Issue #135): Revoke access — set user.plan = 'free' in Supabase.
  console.log('[stripe-webhook] customer.subscription.deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // TODO (Issue #135): Send payment failure email, flag account for follow-up.
  console.log('[stripe-webhook] invoice.payment_failed', {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    amountDue: invoice.amount_due,
  })
}

// ---------------------------------------------------------------------------
// Export the list of handled events for use in documentation/tests
// ---------------------------------------------------------------------------
export { HANDLED_WEBHOOK_EVENTS }
