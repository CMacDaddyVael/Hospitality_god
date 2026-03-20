/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session and returns the hosted URL.
 *
 * Request body:
 *   { plan: 'pro' | 'autopilot', sessionId: string, email?: string }
 *
 * Response:
 *   { success: true, url: string }   — redirect the user to `url`
 *   { error: string }                — something went wrong
 *
 * Test card: 4242 4242 4242 4242, any future expiry, any CVC
 * See docs/stripe-setup.md for full setup instructions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import {
  getPriceId,
  assertStripeEnv,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
} from '@/lib/stripe/config'
import type { StripePlan } from '@/lib/stripe/config'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate environment configuration up-front so errors are clear.
  try {
    assertStripeEnv()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe not configured'
    console.error('[stripe-checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Parse request body.
  let plan: StripePlan
  let sessionId: string
  let email: string | undefined

  try {
    const body = await req.json()
    plan = body.plan
    sessionId = body.sessionId
    email = body.email
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!plan || !sessionId) {
    return NextResponse.json(
      { error: 'plan and sessionId are required' },
      { status: 400 }
    )
  }

  // Resolve the Stripe Price ID for the requested plan.
  let priceId: string

  try {
    priceId = getPriceId(plan)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown plan'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Create the Stripe Checkout Session.
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // Pre-fill the email if we have it.
      ...(email ? { customer_email: email } : {}),
      // Pass the internal session ID so the webhook can link the Stripe
      // customer back to the VAEL onboarding session.
      metadata: {
        sessionId,
        plan,
      },
      // Redirect URLs after checkout.
      success_url: `${STRIPE_SUCCESS_URL}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: STRIPE_CANCEL_URL,
      // Allow promo codes (useful for beta users).
      allow_promotion_codes: true,
    })

    if (!checkoutSession.url) {
      throw new Error('Stripe returned a checkout session without a URL')
    }

    console.log('[stripe-checkout] Created session', {
      checkoutSessionId: checkoutSession.id,
      plan,
      sessionId,
    })

    return NextResponse.json({ success: true, url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    console.error('[stripe-checkout] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
