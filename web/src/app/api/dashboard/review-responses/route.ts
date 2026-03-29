import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/dashboard/review-responses
 * Returns pending review response deliverables for the authenticated user.
 * Query params:
 *   - propertyId (optional) — filter to a specific property
 *   - status (optional) — filter by status, defaults to 'pending'
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const propertyId = searchParams.get('propertyId')
    const status = searchParams.get('status') || 'pending'
    const userId = searchParams.get('userId') // In production, get from auth session

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let query = supabase
      .from('content')
      .select(`
        id,
        type,
        status,
        title,
        body,
        sentiment,
        is_negative,
        source_review_id,
        metadata,
        created_at,
        property_id,
        properties (
          id,
          name,
          property_type,
          location
        )
      `)
      .eq('user_id', userId)
      .eq('type', 'review_response')
      .eq('status', status)
      .order('is_negative', { ascending: false }) // Negative reviews first
      .order('created_at', { ascending: false })

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[review-responses] DB error:', error)
      return NextResponse.json({ error: 'Failed to fetch review responses' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reviewResponses: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error('[review-responses] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/dashboard/review-responses/:id
 * Update the status of a review response (approve or dismiss)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, userId } = body

    if (!id || !status || !userId) {
      return NextResponse.json({ error: 'id, status, and userId are required' }, { status: 400 })
    }

    if (!['approved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'status must be approved or dismissed' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('type', 'review_response')
      .select('id, status')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error('[review-responses] PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
