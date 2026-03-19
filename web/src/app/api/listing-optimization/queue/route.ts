/**
 * POST /api/listing-optimization/queue
 *
 * Queues a listing optimization job for a pro user.
 * Called automatically after onboarding completion or when a listing URL is saved.
 *
 * Body: { userId, propertyId, listingUrl, listingData }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runListingOptimizationJob } from '../../../../../lib/queue/workers/listing-optimization'
import type { ListingOptimizationJobPayload } from '../../../../../lib/queue/workers/listing-optimization'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, propertyId, listingUrl, listingData, plan } = body

    if (!userId || !listingUrl) {
      return NextResponse.json(
        { error: 'userId and listingUrl are required' },
        { status: 400 }
      )
    }

    // Only run for pro/agency users
    if (plan !== 'pro' && plan !== 'agency') {
      return NextResponse.json(
        { error: 'Listing optimization is available for Pro subscribers only' },
        { status: 403 }
      )
    }

    // Upsert the property record
    const resolvedPropertyId = propertyId || `prop_${userId}`
    const { error: upsertError } = await supabase
      .from('properties')
      .upsert(
        {
          id: resolvedPropertyId,
          user_id: userId,
          listing_url: listingUrl,
          plan,
          listing_data: listingData || {},
          optimization_queued_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (upsertError) {
      console.error('[queue] Failed to upsert property:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save property data' },
        { status: 500 }
      )
    }

    const payload: ListingOptimizationJobPayload = {
      propertyId: resolvedPropertyId,
      userId,
      listingUrl,
      listingData: listingData || {},
    }

    // Run the job. In production this would be handed off to a proper queue
    // (e.g. BullMQ / Supabase Edge Function cron). For now we run it inline
    // and respond immediately so the UI isn't blocked.
    runListingOptimizationJob(payload).catch((err) => {
      console.error('[queue] Listing optimization job failed:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Optimization job queued',
      propertyId: resolvedPropertyId,
    })
  } catch (error) {
    console.error('[queue] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
