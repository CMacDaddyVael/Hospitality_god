import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, listingUrls, selectedModules } = body

    if (!userId || !listingUrls || !selectedModules) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!Array.isArray(listingUrls) || listingUrls.length === 0) {
      return NextResponse.json({ error: 'At least one listing URL required' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. Write listings to the listings table
    const listingRows = listingUrls.map((url: string) => ({
      user_id: userId,
      url: url.trim(),
      platform: detectPlatform(url),
      status: 'pending_audit',
      created_at: now,
      updated_at: now,
    }))

    const { data: insertedListings, error: listingsError } = await supabase
      .from('listings')
      .upsert(listingRows, { onConflict: 'user_id,url' })
      .select('id, url')

    if (listingsError) {
      console.error('Listings insert error:', listingsError)
      return NextResponse.json({ error: 'Failed to save listings' }, { status: 500 })
    }

    // 2. Write user preferences (selected modules)
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: userId,
          modules: selectedModules,
          onboarding_completed: true,
          onboarding_completed_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )

    if (prefsError) {
      console.error('Preferences insert error:', prefsError)
      return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
    }

    // 3. Mark subscriber onboarding as complete
    await supabase
      .from('subscribers')
      .update({ onboarding_completed: true, onboarding_completed_at: now })
      .eq('user_id', userId)

    // 4. Mark onboarding progress as complete
    await supabase
      .from('onboarding_progress')
      .upsert(
        {
          user_id: userId,
          current_step: 'complete',
          completed_at: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )

    // 5. Enqueue audit jobs for each listing
    const auditJobs = (insertedListings || listingRows).map((listing: any) => ({
      user_id: userId,
      job_type: 'listing_audit',
      payload: {
        url: listing.url,
        listing_id: listing.id || null,
        modules: selectedModules,
      },
      status: 'queued',
      created_at: now,
    }))

    const { error: jobsError } = await supabase.from('agent_jobs').insert(auditJobs)

    if (jobsError) {
      // Non-fatal — log but don't fail the onboarding
      console.error('Failed to enqueue audit jobs:', jobsError)
    }

    return NextResponse.json({
      success: true,
      listingsCreated: listingRows.length,
      jobsEnqueued: auditJobs.length,
    })
  } catch (err) {
    console.error('Complete onboarding error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function detectPlatform(url: string): string {
  if (url.includes('airbnb.com')) return 'airbnb'
  if (url.includes('vrbo.com') || url.includes('homeaway.com')) return 'vrbo'
  return 'other'
}
