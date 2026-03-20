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

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancelled(subscription)
        break
      }

      default:
        // Unhandled event — that's fine
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const auditSessionId = session.metadata?.audit_session_id
  const customerEmail = session.customer_email || session.customer_details?.email
  const stripeCustomerId = session.customer as string
  const stripeSubscriptionId = session.subscription as string

  console.log('Checkout completed:', {
    auditSessionId,
    customerEmail,
    stripeCustomerId,
    stripeSubscriptionId,
  })

  if (!customerEmail) {
    console.error('No customer email in checkout session:', session.id)
    return
  }

  // 1. Look up or create the user in Supabase auth
  let userId: string | null = null

  const { data: existingUser } = await supabase
    .from('subscribers')
    .select('id, user_id')
    .eq('email', customerEmail)
    .single()

  if (existingUser) {
    userId = existingUser.user_id
  }

  // 2. Upsert subscriber record
  const { data: subscriber, error: subError } = await supabase
    .from('subscribers')
    .upsert(
      {
        email: customerEmail,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan: 'pro',
        status: 'active',
        audit_session_id: auditSessionId || null,
        checkout_session_id: session.id,
        trial_end: session.metadata?.trial_end || null,
        subscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'email' }
    )
    .select()
    .single()

  if (subError) {
    console.error('Error upserting subscriber:', subError)
    throw subError
  }

  // 3. Associate the audit session with this subscriber
  if (auditSessionId && subscriber) {
    const { error: auditError } = await supabase
      .from('audit_sessions')
      .update({
        subscriber_id: subscriber.id,
        user_id: userId,
        converted_at: new Date().toISOString(),
        // Keep it accessible indefinitely now that they're a paying subscriber
        expires_at: null,
      })
      .eq('session_id', auditSessionId)

    if (auditError) {
      console.error('Error associating audit with subscriber:', auditError)
      // Non-fatal — subscriber is created, audit link may just not pre-populate
    }

    // 4. Create the initial property record from the audit
    const { data: auditData } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('session_id', auditSessionId)
      .single()

    if (auditData) {
      const { error: propError } = await supabase.from('properties').upsert(
        {
          subscriber_id: subscriber.id,
          user_id: userId,
          listing_url: auditData.listing_url,
          platform: auditData.platform,
          listing_title: auditData.listing_data?.title || 'My Property',
          current_score: auditData.score,
          initial_score: auditData.score,
          audit_session_id: auditSessionId,
          score_history: [
            {
              score: auditData.score,
              date: auditData.created_at,
              label: 'Initial Audit',
            },
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subscriber_id,listing_url' }
      )

      if (propError) {
        console.error('Error creating property record:', propError)
      }
    }
  }

  // 5. Send welcome email (fire and forget)
  sendWelcomeEmail(customerEmail, auditSessionId).catch(console.error)

  console.log('Checkout processing complete for:', customerEmail)
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const auditSessionId = subscription.metadata?.audit_session_id

  if (!auditSessionId) return

  // Update audit session with subscription ID
  await supabase
    .from('audit_sessions')
    .update({
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', auditSessionId)
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  await supabase
    .from('subscribers')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)
}

async function sendWelcomeEmail(email: string, auditSessionId?: string) {
  // In production this calls Resend/Postmark
  // For now just log — the email integration is handled separately
  console.log(`[EMAIL] Welcome email queued for ${email}, audit: ${auditSessionId}`)
}
