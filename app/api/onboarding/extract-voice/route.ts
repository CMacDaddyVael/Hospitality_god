/**
 * POST /api/onboarding/extract-voice
 *
 * Extracts an owner voice profile from scraped listing data and persists it
 * to the properties table. Called as an additive step after scraping completes.
 *
 * Issue #179 — Owner voice profile extraction
 */
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { propertyId, listingDescription, hostReviewResponses, propertyTitle } = body

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 })
    }

    // Dynamic import so Claude client only loads server-side
    const { extractVoiceProfile } = await import('@/lib/voice/extractVoiceProfile.mjs')

    const voiceProfile = await extractVoiceProfile({
      listingDescription: listingDescription ?? '',
      hostReviewResponses: Array.isArray(hostReviewResponses) ? hostReviewResponses : [],
      propertyTitle: propertyTitle ?? '',
    })

    // Persist to Supabase
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: dbError } = await supabase
      .from('properties')
      .update({ voice_profile: voiceProfile })
      .eq('id', propertyId)

    if (dbError) {
      console.error('[extract-voice] Supabase update error:', dbError)
      // Still return the profile so the caller can use it even if persistence fails
      return NextResponse.json(
        {
          success: false,
          voice_profile: voiceProfile,
          error: 'Failed to persist voice profile to database',
          db_error: dbError.message,
        },
        { status: 207 }
      )
    }

    return NextResponse.json({
      success: true,
      voice_profile: voiceProfile,
      confidence: voiceProfile.voice_profile_confidence,
    })
  } catch (error) {
    console.error('[extract-voice] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Voice profile extraction failed' },
      { status: 500 }
    )
  }
}
