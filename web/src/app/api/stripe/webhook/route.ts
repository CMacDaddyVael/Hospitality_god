import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Required for raw body parsing in Next.js App Router
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const userId = session.metadata?.user_id

        // Retrieve full subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        const subscriptionData = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: 'active',
          plan: 'pro',
          price_id: subscription.items.data[0]?.price.id || '',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        }

        if (userId) {
          // Upsert by user_id
          const { error } = await supabase
            .from('subscriptions')
            .upsert(
              { ...subscriptionData, user_id: userId },
              { onConflict: 'user_id' }
            )

          if (error) {
            console.error('Supabase upsert error (user_id):', error)
          }
        } else if (session.customer_email) {
          // Try to find user by email via auth
          const { data: users } = await supabase.auth.admin.listUsers()
          const matchedUser = users?.users?.find(
            (u) => u.email === session.customer_email
          )

          if (matchedUser) {
            const { error } = await supabase
              .from('subscriptions')
              .upsert(
                { ...subscriptionData, user_id: matchedUser.id },
                { onConflict: 'user_id' }
              )
            if (error) {
              console.error('Supabase upsert error (email match):', error)
            }
          } else {
            // Insert without user_id — will be linked later
            const { error } = await supabase
              .from('subscriptions')
              .upsert(subscriptionData, { onConflict: 'stripe_customer_id' })
            if (error) {
              console.error('Supabase upsert error (no user):', error)
            }
          }
        }

        console.log(`✅ Subscription activated: ${subscriptionId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: subscription.status === 'active' ? 'active' : subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Supabase update error (subscription updated):', error)
        }

        console.log(`🔄 Subscription updated: ${subscription.id} → ${subscription.status}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) {
          console.error('Supabase update error (subscription deleted):', error)
        }

        console.log(`❌ Subscription cancelled: ${subscription.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const { error } = await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId)

          if (error) {
            console.error('Supabase update error (payment failed):', error)
          }
        }

        console.log(`⚠️ Payment failed for subscription: ${subscriptionId}`)
        break
      }

      default:
        // Unhandled event type — that's fine
        break
    }
  } catch (err) {
    console.error('Error processing webhook event:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
