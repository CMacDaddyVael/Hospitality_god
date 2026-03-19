import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function validateAirbnbUrl(url: string): { valid: boolean; roomId?: string; error?: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  const host = parsed.hostname.replace('www.', '')
  if (host !== 'airbnb.com') {
    return { valid: false, error: 'URL must be from airbnb.com' }
  }

  if (!parsed.pathname.startsWith('/rooms/')) {
    return { valid: false, error: 'URL must point to a specific listing (airbnb.com/rooms/…)' }
  }

  const roomId = parsed.pathname.split('/rooms/')[1]?.split('/')[0]?.split('?')[0]
  if (!roomId || !/^\d+$/.test(roomId)) {
    return { valid: false, error: 'Could not find a listing ID in that URL' }
  }

  return { valid: true, roomId }
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendAuditEmail(email: string, auditId: string, listingUrl: string) {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not set — skipping email send')
    return
  }

  const auditUrl = `${process.env.NEXT_PUBLIC_APP_URL}/audit/${auditId}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Hospitality God <audit@hospitalitygod.com>',
      to: email,
      subject: '🔍 Your listing audit is running…',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Audit Is Processing</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #334155;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#fbbf24;">✦ Hospitality God</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#f8fafc;line-height:1.3;">
                Your audit is running! 🚀
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                We're analyzing your listing right now — scoring your title, photos, description, 
                pricing, reviews, and 20+ other factors. This usually takes under 60 seconds.
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Listing:</p>
              <p style="margin:0 0 28px;font-size:13px;color:#94a3b8;word-break:break-all;">
                ${listingUrl}
              </p>
              <!-- CTA -->
              <a href="${auditUrl}" 
                 style="display:inline-block;background:#fbbf24;color:#0f172a;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;">
                View My Audit Results →
              </a>
              <p style="margin:24px 0 0;font-size:13px;color:#475569;line-height:1.6;">
                If the results aren't ready yet when you click, the page will automatically 
                update when your score comes in.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #334155;">
              <p style="margin:0;font-size:12px;color:#475569;">
                You're receiving this because you requested a free listing audit at hospitalitygod.com.
                <br />No spam, ever.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Resend error:', res.status, body)
  }
}

async function triggerScrapeAndScore(auditId: string, url: string, roomId: string) {
  // Try to call our own scrape/score API non-blocking
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  fetch(`${baseUrl}/api/audit/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auditId, url, roomId }),
  }).catch((err) => {
    console.error('Failed to trigger audit process:', err)
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, email } = body

    // Validate URL
    const urlCheck = validateAirbnbUrl(url)
    if (!urlCheck.valid) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 })
    }

    // Validate email
    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const auditId = randomUUID()
    const roomId = urlCheck.roomId!

    // Save lead to Supabase
    const { error: dbError } = await supabase.from('leads').insert({
      id: auditId,
      email: email.trim().toLowerCase(),
      airbnb_url: url.trim(),
      room_id: roomId,
      status: 'processing',
      created_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error('Supabase insert error:', dbError)
      // Don't block the user — continue even if DB write fails
    }

    // Trigger scrape + score asynchronously (fire and forget)
    await triggerScrapeAndScore(auditId, url.trim(), roomId)

    // Send "processing" email (non-blocking)
    sendAuditEmail(email.trim(), auditId, url.trim()).catch((err) => {
      console.error('Email send error:', err)
    })

    return NextResponse.json({ success: true, auditId })
  } catch (err) {
    console.error('Audit route error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const auditId = searchParams.get('id')

  if (!auditId) {
    return NextResponse.json({ error: 'Audit ID required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id, status, score, score_breakdown, airbnb_url, room_id, created_at')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, audit: data })
}
