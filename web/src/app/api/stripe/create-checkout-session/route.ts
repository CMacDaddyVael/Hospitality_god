import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialise Stripe lazily so the module doesn't crash at import time
// if the env var is temporarily absent (e.g. during a cold build).
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
  }
  return new Stripe(key, {
    apiVersion: '2024-06-20',
    typescript: true,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, auditId, priceId } = body as {
      userId?: string
      auditId?: string
      priceId?: string
    }

    // --- Input validation ---
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      )
    }

    if (!auditId || typeof auditId !== 'string' || auditId.trim() === '') {
      return NextResponse.json(
        { error: 'Missing required field: auditId' },
        { status: 400 }
      )
    }

    // Allow the caller to pass an explicit priceId, but fall back to the
    // environment-configured Pro tier price so the UI doesn't need to
    // hard-code a Stripe price ID.
    const resolvedPriceId =
      (priceId && priceId.trim()) || process.env.STRIPE_PRO_PRICE_ID

    if (!resolvedPriceId) {
      console.error(
        '[create-checkout-session] No priceId provided and STRIPE_PRO_PRICE_ID is not set'
      )
      return NextResponse.json(
        { error: 'Stripe price ID is not configured. Contact support.' },
        { status: 500 }
      )
    }

    // --- Derive base URL for redirect URLs ---
    // In production Vercel sets NEXT_PUBLIC_BASE_URL or VERCEL_URL.
    // Locally we fall back to localhost:3000.
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const stripe = getStripe()

    // --- Create the Stripe Checkout Session ---
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ],
      // Links this session back to the user so the webhook (issue #89) can
      // activate the correct account on payment.success.
      client_reference_id: userId,
      // Pass auditId through metadata so the webhook can reference the
      // originating audit if needed.
      metadata: {
        userId,
        auditId,
      },
      // After a successful payment, land on the dashboard with the session ID
      // so the bridge UI (issue #83) can confirm the subscription and show a
      // success state.
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      // On cancellation, return the user to the audit results page so they can
      // reconsider without losing context.
      cancel_url: `${baseUrl}/audit/${auditId}`,
    })

    if (!session.url) {
      // This shouldn't happen with mode:'subscription' but guard defensively.
      console.error('[create-checkout-session] Stripe returned a session without a URL', {
        sessionId: session.id,
        userId,
        auditId,
      })
      return NextResponse.json(
        { error: 'Stripe did not return a checkout URL. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (error: unknown) {
    // Log full error server-side for observability, return a safe message
    // to the client so we never expose internal details.
    if (error instanceof Stripe.errors.StripeError) {
      console.error('[create-checkout-session] Stripe API error', {
        type: error.type,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      })
      return NextResponse.json(
        {
          error: 'Payment provider returned an error. Please try again.',
          // Expose the Stripe error type (e.g. "card_error") so the client
          // can show a more specific message if it wants to.
          stripeErrorType: error.type,
        },
        { status: error.statusCode ?? 502 }
      )
    }

    // Generic / unexpected errors
    console.error('[create-checkout-session] Unexpected error', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
