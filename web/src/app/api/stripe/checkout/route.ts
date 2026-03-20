import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: NextRequest) {
  try {
    const { auditSessionId, email, listingUrl, score } = await req.json()

    if (!auditSessionId) {
      return NextResponse.json({ error: 'Audit session ID required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      metadata: {
        audit_session_id: auditSessionId,
        listing_url: listingUrl || '',
        audit_score: score ? String(score) : '',
        source: 'audit_cta',
      },
      subscription_data: {
        metadata: {
          audit_session_id: auditSessionId,
          listing_url: listingUrl || '',
          audit_score: score ? String(score) : '',
        },
        trial_period_days: 7,
      },
      success_url: `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}&audit=${auditSessionId}`,
      cancel_url: `${baseUrl}/audit/${auditSessionId}?checkout=cancelled`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
