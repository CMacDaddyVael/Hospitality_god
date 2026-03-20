/**
 * GET /api/email/unsubscribe?token=xxx
 * POST /api/email/unsubscribe  { token }
 *
 * CAN-SPAM one-click unsubscribe handler.
 * Sets email_unsubscribed = true on the subscriber row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

async function handleUnsubscribe(token: string | null) {
  if (!token || token.length < 8) {
    return NextResponse.json({ error: 'Invalid unsubscribe token' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('subscribers')
    .update({ email_unsubscribed: true, email_unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('id, email')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 })
  }

  // Log event
  await supabase.from('email_events').insert({
    user_id: data.id,
    email: data.email,
    event_type: 'unsubscribed',
    email_type: 'weekly_brief',
    message_id: null,
    metadata: { token },
  })

  return NextResponse.json({ ok: true, message: 'You have been unsubscribed from weekly briefs.' })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  return handleUnsubscribe(token)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return handleUnsubscribe(body?.token ?? null)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
