/**
 * POST /api/email/welcome
 *
 * Called by Supabase auth webhook (or internally after user creation) to fire
 * the welcome email for a new user.
 *
 * Body: { user_id: string, email: string, first_name?: string }
 *
 * Protected by WEBHOOK_SECRET header to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/email'
import { hasEmailBeenSent } from '@/lib/email/log'
import { DASHBOARD_URL } from '@/lib/email/resend'

export async function POST(req: NextRequest) {
  // Verify shared secret so only Supabase webhooks / internal calls can trigger
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { user_id?: string; email?: string; first_name?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { user_id, email, first_name } = body

  if (!user_id || !email) {
    return NextResponse.json({ error: 'user_id and email are required' }, { status: 400 })
  }

  // Deduplicate: only send once per user
  const alreadySent = await hasEmailBeenSent('welcome', user_id)
  if (alreadySent) {
    return NextResponse.json({ success: true, skipped: true, reason: 'already_sent' })
  }

  const firstName = first_name ?? email.split('@')[0]

  const result = await sendWelcomeEmail(email, user_id, {
    firstName,
    dashboardUrl: `${DASHBOARD_URL}/dashboard`,
    auditUrl: `${DASHBOARD_URL}/audit`,
  })

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId })
}
