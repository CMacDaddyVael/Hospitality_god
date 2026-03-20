/**
 * GET /api/listings/:id
 *
 * Returns a single listing record including all location metadata fields
 * added in Issue #151: lat, lng, city, neighborhood, state, bedroom_count, max_guests
 *
 * NEW file — does not modify any existing route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Listing ID is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('listings')
    .select(
      `
      id,
      created_at,
      updated_at,
      url,
      title,
      description,
      photos,
      amenities,
      rating,
      review_count,
      property_type,
      location,
      price_per_night,
      platform,
      lat,
      lng,
      city,
      neighborhood,
      state,
      bedroom_count,
      max_guests
    `
    )
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    console.error('[listings/:id] Supabase error:', error)
    return NextResponse.json({ error: 'Failed to fetch listing' }, { status: 500 })
  }

  return NextResponse.json({ success: true, listing: data })
}
