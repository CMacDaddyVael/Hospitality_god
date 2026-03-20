/**
 * POST /api/email/audit-complete
 *
 * Fired when an audit transitions to `complete` status in the DB.
 * Can be called from a Supabase database webhook or from the audit pipeline.
 *
 * Body:
 * {
 *   audit_id: string,
 *   user_id: string,
 *   email: string,
 *   first_name?: string,
 *   score: number,
 *   top_issues: string[],      // array of issue descriptions (will use first 3)
 *   listing_title?: string,
 *   is_free: boolean
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendAuditCompleteEmail } from '@/lib/email'
import { hasEmailBeenSent } from '@/lib/email/log'
import { DASHBOARD_URL } from '@/lib/email/resend'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    audit_id?: string
    user_id?: string
    email?: string
    first_name?: string
    score?: number
    top_issues?: string[]
    listing_title?: string
    is_free?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { audit_id, user_id, email, first_name, score, top_issues, listing_title, is_free } = body

  if (!audit_id || !user_id || !email || score === undefined || !top_issues) {
    return NextResponse.json(
      { error: 'audit_id, user_id, email, score, and top_issues are required' },
      { status: 400 }
    )
  }

  // Deduplicate: one email per audit completion
  const alreadySent = await hasEmailBeenSent('audit_complete', audit_id)
  if (alreadySent) {
    return NextResponse.json({ success: true, skipped: true, reason: 'already_sent' })
  }

  const firstName = first_name ?? email.split('@')[0]

  const result = await sendAuditCompleteEmail(email, user_id, {
    firstName,
    score,
    topIssues: top_issues,
    listingTitle: listing_title,
    isFree: is_free ?? true,
    dashboardUrl: `${DASHBOARD_URL}/dashboard`,
    upgradeUrl: `${DASHBOARD_URL}/upgrade`,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId })
}
