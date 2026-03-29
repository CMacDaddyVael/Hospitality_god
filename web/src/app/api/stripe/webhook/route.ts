import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Trigger listing optimization for a new subscriber ─────────────────────────

async function triggerListingOptimization(
  customerId: string,
  subscriptionId: string,
  customerEmail?: string | null
): Promise<void> {
  // Look up owner profile by Stripe customer ID or email
  const { data: ownerData } = await supabase
    .from('owners')
    .select('id, listing_data, audit_flags, owner_voice, listing_id')
    .or(`stripe_customer_id.eq.${customerId}${customerEmail ? `,email.eq.${customerEmail}` : ''}`)
    .limit(1)
    .single()

  if (!ownerData) {
    console.warn(
      `[stripe/webhook] No owner found for customer ${customerId} — cannot trigger optimization`
    )
    return
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Fire-and-forget — don't block the webhook response
  fetch(`${baseUrl}/api/optimize/listing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listingData: ownerData.listing_data || {},
      auditFlags: ownerData.audit_flags || [],
      ownerVoice: ownerData.owner_voice || {},
      ownerId: ownerData.id,
      listingId: ownerData.listing_id,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text()
        console.error(
          `[stripe/webhook] Optimization trigger failed (${res.status}):`,
          body
        )
      } else {
        console.log(
          `[stripe/webhook] Listing optimization triggered for owner ${ownerData.id}`
        )
      }
    })
    .catch((err) => {
      console.error('[stripe/webhook] Failed to trigger optimization:', err)
    })
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const error = err as Error
    console.error('[stripe/webhook] Signature verification failed:', error.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${error.message}` },
      { status: 400 }
    )
  }

  // Handle relevant events
  switch (event.type) {
    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id

      // Fetch customer email for lookup fallback
      let customerEmail: string | null = null
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if (!customer.deleted) {
          customerEmail = (customer as Stripe.Customer).email
        }
      } catch {
        // Non-fatal — continue without email
      }

      console.log(
        `[stripe/webhook] New subscription created: ${subscription.id} for customer ${customerId}`
      )

      await triggerListingOptimization(customerId, subscription.id, customerEmail)
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer)?.id

        if (customerId) {
          console.log(
            `[stripe/webhook] Checkout completed → subscription ${subscriptionId}`
          )
          await triggerListingOptimization(
            customerId,
            subscriptionId,
            session.customer_details?.email
          )
        }
      }
      break
    }

    default:
      // Ignore other events
      break
  }

  return NextResponse.json({ received: true })
}
