import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Idempotently provision a user as Pro after successful payment.
 * Safe to call multiple times — checks existing state before writing.
 */
async function provisionProUser({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  auditId,
}: {
  userId: string
  stripeCustomerId: string
  stripeSubscriptionId: string
  auditId?: string
}) {
  // Upsert the user record with Pro plan details
  const { data: user, error: upsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        plan: 'pro',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan_activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'id',
      }
    )
    .select()
    .single()

  if (upsertError) {
    console.error('[webhook] Failed to provision user:', upsertError)
    throw upsertError
  }

  // Queue the first set of deliverables for the new Pro subscriber
  await queueInitialDeliverables(userId, auditId)

  console.log(`[webhook] Provisioned Pro for user ${userId}`)
  return user
}

/**
 * Queue the initial deliverables batch for a new Pro subscriber.
 * This creates pending work items the swarm will pick up.
 */
async function queueInitialDeliverables(userId: string, auditId?: string) {
  const deliverables = [
    {
      user_id: userId,
      type: 'listing_optimization',
      status: 'queued',
      priority: 1,
      metadata: { auditId, reason: 'initial_pro_onboarding' },
      created_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      type: 'social_content_week1',
      status: 'queued',
      priority: 2,
      metadata: { auditId, reason: 'initial_pro_onboarding' },
      created_at: new Date().toISOString(),
    },
    {
      user_id: userId,
      type: 'review_response_drafts',
      status: 'queued',
      priority: 3,
      metadata: { auditId, reason: 'initial_pro_onboarding' },
      created_at: new Date().toISOString(),
    },
  ]

  const { error } = await supabase.from('deliverables').insert(deliverables)

  if (error) {
    // Non-fatal: log but don't fail the webhook
    console.error('[webhook] Failed to queue initial deliverables:', error)
  }
}

/**
 * Handle subscription cancellation / expiry — downgrade user to free plan.
 */
async function deprovisionProUser(stripeSubscriptionId: string) {
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'free',
      plan_cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)

  if (error) {
    console.error('[webhook] Failed to deprovision user:', error)
    throw error
  }

  console.log(`[webhook] Deprovisioned subscription ${stripeSubscriptionId}`)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription checkouts
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.userId
        const auditId = session.metadata?.auditId

        if (!userId) {
          console.error('[webhook] checkout.session.completed missing userId in metadata')
          break
        }

        if (!session.customer || !session.subscription) {
          console.error('[webhook] checkout.session.completed missing customer/subscription')
          break
        }

        await provisionProUser({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          auditId: auditId || undefined,
        })

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await deprovisionProUser(subscription.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        // Handle subscription status changes (paused, unpaid, etc.)
        if (
          subscription.status === 'canceled' ||
          subscription.status === 'unpaid' ||
          subscription.status === 'past_due'
        ) {
          // For past_due we keep access temporarily; canceled/unpaid we revoke
          if (
            subscription.status === 'canceled' ||
            subscription.status === 'unpaid'
          ) {
            await deprovisionProUser(subscription.id)
          }
        }

        if (subscription.status === 'active') {
          // Re-activate if previously suspended (e.g. payment recovered)
          const userId = subscription.metadata?.userId
          if (userId) {
            await supabase
              .from('users')
              .update({
                plan: 'pro',
                plan_cancelled_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', subscription.id)
          }
        }

        break
      }

      case 'invoice.payment_failed': {
        // Log but don't immediately revoke — Stripe retries automatically
        const invoice = event.data.object as Stripe.Invoice
        console.warn(`[webhook] Payment failed for customer ${invoice.customer}`)
        break
      }

      default:
        // Unhandled event types are fine — we just ignore them
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[webhook] Error processing event ${event.type}:`, err)
    // Return 500 so Stripe retries the webhook
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }

  // Always return 200 so Stripe doesn't retry successfully-processed events
  return NextResponse.json({ received: true })
}
