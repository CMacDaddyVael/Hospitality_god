import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
})

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. On customer.subscription.created,
 * calls /api/subscriber/activate to store preferences and enqueue the
 * first swarm job batch immediately.
 *
 * ADDITIVE ONLY: This is a new file. The existing /app/api/stripe/checkout/route.ts
 * is not modified.
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('[stripe-webhook] Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[stripe-webhook] Received event: ${event.type} id=${event.id}`)

  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      }

      case 'customer.subscription.updated': {
        // Future: handle plan changes
        console.log(`[stripe-webhook] subscription.updated — no action configured yet`)
        break
      }

      case 'customer.subscription.deleted': {
        // Future: deactivate subscriber
        console.log(`[stripe-webhook] subscription.deleted — no action configured yet`)
        break
      }

      case 'invoice.payment_succeeded': {
        // Future: handle renewal
        console.log(`[stripe-webhook] invoice.payment_succeeded — no action configured yet`)
        break
      }

      case 'invoice.payment_failed': {
        // Future: handle failed payment
        console.log(`[stripe-webhook] invoice.payment_failed — no action configured yet`)
        break
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error handling event ${event.type}:`, err)
    // Return 200 to prevent Stripe retrying — log the error internally
    // Stripe will retry on 5xx, which we don't want for logic errors
    return NextResponse.json(
      { received: true, warning: 'Event received but handler encountered an error' },
      { status: 200 }
    )
  }

  return NextResponse.json({ received: true })
}

/**
 * Handles customer.subscription.created by:
 * 1. Extracting subscriber_id (Supabase user UUID stored in Stripe metadata)
 * 2. Resolving preferences from Stripe metadata (set during checkout)
 * 3. Calling /api/subscriber/activate to store prefs + enqueue swarm jobs
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata ?? {}

  // subscriber_id is the Supabase user UUID stored in Stripe metadata
  // It's set during checkout session creation (see /app/api/stripe/checkout)
  const subscriberId = metadata.subscriber_id ?? metadata.user_id ?? metadata.session_id

  if (!subscriberId) {
    console.warn(
      '[stripe-webhook] subscription.created has no subscriber_id in metadata — skipping activation',
      { subscription_id: subscription.id }
    )
    return
  }

  // Modules and property URLs can be passed as metadata during checkout
  // or stored in Supabase from the onboarding wizard before payment
  const modules = parseMetadataArray(metadata.modules)
  const propertyUrls = parseMetadataArray(metadata.property_urls)

  // If no modules/properties in Stripe metadata, load from Supabase onboarding data
  let resolvedModules = modules
  let resolvedPropertyUrls = propertyUrls

  if (resolvedModules.length === 0 || resolvedPropertyUrls.length === 0) {
    const onboardingData = await loadOnboardingDataForSubscriber(subscriberId)
    if (resolvedModules.length === 0 && onboardingData.modules.length > 0) {
      resolvedModules = onboardingData.modules
    }
    if (resolvedPropertyUrls.length === 0 && onboardingData.propertyUrls.length > 0) {
      resolvedPropertyUrls = onboardingData.propertyUrls
    }
  }

  // Apply defaults if still empty (subscriber can update later via dashboard)
  if (resolvedModules.length === 0) {
    resolvedModules = ['listing_optimization', 'review_responses', 'social']
    console.log(
      `[stripe-webhook] No modules found for ${subscriberId} — using defaults: ${resolvedModules.join(', ')}`
    )
  }

  if (resolvedPropertyUrls.length === 0) {
    console.warn(
      `[stripe-webhook] No property URLs found for subscriber ${subscriberId} — activation skipped until properties added`
    )
    return
  }

  const voiceSample = metadata.voice_sample ?? null

  await callActivateEndpoint({
    subscriber_id: subscriberId,
    preferences: {
      modules: resolvedModules,
      properties: resolvedPropertyUrls,
      ...(voiceSample ? { voice_sample: voiceSample } : {}),
    },
  })
}

/**
 * Calls the activate endpoint internally.
 * Uses the internal base URL to avoid external network round-trips in production.
 */
async function callActivateEndpoint(payload: {
  subscriber_id: string
  preferences: {
    modules: string[]
    properties: string[]
    voice_sample?: string
  }
}) {
  const baseUrl = getInternalBaseUrl()
  const url = `${baseUrl}/api/subscriber/activate`

  console.log(
    `[stripe-webhook] Calling activate for subscriber=${payload.subscriber_id} modules=${payload.preferences.modules.join(',')}`
  )

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Internal service key to bypass any auth middleware if added later
      'x-internal-service-key': process.env.INTERNAL_SERVICE_KEY ?? '',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Activate endpoint returned ${response.status}: ${errorBody}`
    )
  }

  const result = await response.json()
  console.log(
    `[stripe-webhook] Activation successful — jobs_enqueued=${result.jobs_enqueued} is_first=${result.is_first_activation}`
  )

  return result
}

/**
 * Loads onboarding data for a subscriber from Supabase.
 * Falls back gracefully if no onboarding session is found.
 */
async function loadOnboardingDataForSubscriber(
  subscriberId: string
): Promise<{ modules: string[]; propertyUrls: string[] }> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if preferences already exist (e.g. from onboarding wizard pre-payment)
    const { data: existingPrefs } = await supabase
      .from('subscriber_preferences')
      .select('modules, property_urls')
      .eq('subscriber_id', subscriberId)
      .maybeSingle()

    if (existingPrefs) {
      return {
        modules: existingPrefs.modules ?? [],
        propertyUrls: existingPrefs.property_urls ?? [],
      }
    }

    // Fall back to onboarding_sessions table (created by existing onboarding flow)
    const { data: session } = await supabase
      .from('onboarding_sessions')
      .select('data')
      .eq('session_id', subscriberId)
      .maybeSingle()

    if (session?.data) {
      const data = session.data as Record<string, unknown>
      const listingUrl = (data.listing as Record<string, string> | undefined)?.url
      const selectedModules = (data.selectedModules as string[]) ?? []

      return {
        modules: selectedModules,
        propertyUrls: listingUrl ? [listingUrl] : [],
      }
    }

    return { modules: [], propertyUrls: [] }
  } catch (err) {
    console.error('[stripe-webhook] Error loading onboarding data:', err)
    return { modules: [], propertyUrls: [] }
  }
}

/**
 * Parses a comma-separated metadata string into an array.
 * Handles empty/undefined gracefully.
 */
function parseMetadataArray(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Returns the internal base URL for server-to-server calls.
 * In Vercel, VERCEL_URL is available. Falls back to localhost for dev.
 */
function getInternalBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
