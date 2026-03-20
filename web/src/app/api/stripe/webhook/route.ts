import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.userId || session.client_reference_id
    const email = session.customer_details?.email || session.metadata?.email
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

    if (userId || email) {
      try {
        // Record the successful payment and mark user as subscriber
        const { error } = await supabase
          .from('subscribers')
          .upsert(
            {
              user_id: userId,
              email: email,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan: session.metadata?.plan || 'pro',
              status: 'active',
              onboarding_completed: false,
              subscribed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )

        if (error) {
          console.error('Supabase upsert error:', error)
        }

        console.log(`Subscriber record created/updated for userId=${userId}, email=${email}`)
      } catch (err) {
        console.error('Failed to record subscriber:', err)
      }
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    console.log(`PaymentIntent succeeded: ${paymentIntent.id}`)
    // Additional payment tracking can be added here without touching existing handlers
  }

  return NextResponse.json({ received: true })
}
