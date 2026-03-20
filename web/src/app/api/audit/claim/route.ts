import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

/**
 * POST /api/audit/claim
 * Associates an anonymous audit with the newly authenticated user.
 * Called immediately after sign-in / account creation on the audit results page.
 *
 * Body: { auditId, sessionToken }
 * Returns: { success: true }
 */
export async function POST(req: NextRequest) {
  try {
    const { auditId, sessionToken } = await req.json()

    if (!auditId || !sessionToken) {
      return NextResponse.json(
        { error: 'auditId and sessionToken are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify there is an authenticated user in this request
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Only claim audits that match the session token and are still unclaimed
    const { error } = await supabase
      .from('audits')
      .update({ user_id: user.id })
      .eq('id', auditId)
      .eq('session_token', sessionToken)
      .is('user_id', null)

    if (error) {
      console.error('[audit/claim] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to claim audit' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[audit/claim] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
