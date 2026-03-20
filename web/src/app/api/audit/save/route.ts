import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

/**
 * POST /api/audit/save
 * Persists an audit result to the DB (anonymous — no user_id yet).
 * Called after score calculation on the audit page.
 *
 * Body: { sessionToken, listingUrl, score, scoreBreakdown, listingData }
 * Returns: { auditId }
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionToken, listingUrl, score, scoreBreakdown, listingData } =
      await req.json()

    if (!sessionToken || !listingUrl) {
      return NextResponse.json(
        { error: 'sessionToken and listingUrl are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('audits')
      .insert({
        session_token: sessionToken,
        listing_url: listingUrl,
        score: score ?? null,
        score_breakdown: scoreBreakdown ?? null,
        listing_data: listingData ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[audit/save] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to save audit' }, { status: 500 })
    }

    return NextResponse.json({ success: true, auditId: data.id })
  } catch (err) {
    console.error('[audit/save] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
