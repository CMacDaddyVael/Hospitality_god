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
  try {
    const body = await req.json()
    const { price_id, user_id, email } = body

    if (!price_id) {
      return NextResponse.json({ error: 'price_id is required' }, { status: 400 })
    }

    // Use the configured Pro plan price ID if not provided explicitly
    const priceId = price_id || process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      return NextResponse.json({ error: 'No price ID configured' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/audit?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        user_id: user_id || '',
      },
    }

    // Pre-fill customer email if provided
    if (email) {
      sessionParams.customer_email = email
    }

    // If we have a user_id, check if they already have a Stripe customer ID
    if (user_id) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user_id)
        .maybeSingle()

      if (subscription?.stripe_customer_id) {
        sessionParams.customer = subscription.stripe_customer_id
        delete sessionParams.customer_email
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ success: true, url: session.url, session_id: session.id })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
