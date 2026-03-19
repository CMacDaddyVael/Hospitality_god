import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { plan, sessionId, email } = await req.json()

    if (!plan || !sessionId) {
      return NextResponse.json({ error: 'Plan and session ID required' }, { status: 400 })
    }

    const checkoutUrl = await createCheckoutSession({ plan, sessionId, email })
    return NextResponse.json({ success: true, url: checkoutUrl })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
