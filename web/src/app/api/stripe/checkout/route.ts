import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export async function POST(req: NextRequest) {
  try {
    const { plan } = await req.json()

    if (!plan) {
      return NextResponse.json({ error: 'Plan is required' }, { status: 400 })
    }

    const priceId = process.env.STRIPE_PRO_PRICE_ID

    if (!priceId) {
      console.error('[checkout] STRIPE_PRO_PRICE_ID is not set')
      return NextResponse.json({ error: 'Checkout not configured' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Try to get the authenticated user so we can embed their Supabase ID as
    // client_reference_id — the webhook uses this to find the right profile row.
    let userId: string | undefined
    let userEmail: string | undefined

    try {
      const cookieStore = cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            },
          },
        }
      )

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        userId = user.id
        userEmail = user.email
      }
    } catch {
      // Not authenticated — still allow checkout, user will be linked via
      // customer email match after sign-up.
      console.log('[checkout] No authenticated user — proceeding as guest checkout')
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/subscribe?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      ...(userEmail && { customer_email: userEmail }),
      ...(userId && { client_reference_id: userId }),
      subscription_data: {
        metadata: {
          ...(userId && { supabase_user_id: userId }),
        },
      },
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ success: true, url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[checkout] Error creating Stripe session:', message)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
