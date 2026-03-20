import { NextRequest, NextResponse } from 'next/server'
import { generateGuestTemplates, saveGuestTemplatesDeliverable } from '../../../../lib/content/guest-templates'
import type { ListingData, OwnerVoiceProfile } from '../../../../lib/content/guest-templates'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/generate-guest-templates
 *
 * Body:
 * {
 *   listing: ListingData,
 *   voiceProfile: OwnerVoiceProfile,
 *   userId: string,
 *   listingId: string   // optional — defaults to a slug from listing.title
 * }
 *
 * Returns the full TemplateDeliverable with deliverable_id set.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { listing, voiceProfile, userId, listingId } = body as {
      listing: ListingData
      voiceProfile: OwnerVoiceProfile
      userId: string
      listingId?: string
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (!listing || !voiceProfile) {
      return NextResponse.json(
        { error: 'listing and voiceProfile are required' },
        { status: 400 },
      )
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!listing.title || !listing.location || !listing.propertyType) {
      return NextResponse.json(
        { error: 'listing must include title, location, and propertyType' },
        { status: 400 },
      )
    }
    if (!voiceProfile.tone || !voiceProfile.signOffName) {
      return NextResponse.json(
        { error: 'voiceProfile must include tone and signOffName' },
        { status: 400 },
      )
    }

    // ── Generate templates ────────────────────────────────────────────────────
    const deliverable = await generateGuestTemplates(listing, voiceProfile)

    // ── Persist to Supabase (optional — skip if env vars not configured) ──────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    let deliverableId: string | undefined

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const resolvedListingId =
        listingId || listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64)

      deliverableId = await saveGuestTemplatesDeliverable({
        supabase,
        userId,
        listingId: resolvedListingId,
        deliverable,
      })

      deliverable.deliverable_id = deliverableId
    }

    return NextResponse.json({
      success: true,
      deliverable,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-guest-templates] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
