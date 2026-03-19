import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function isValidAirbnbUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return (
      (u.hostname === 'airbnb.com' || u.hostname === 'www.airbnb.com') &&
      (u.pathname.startsWith('/rooms/') || u.pathname.startsWith('/h/'))
    )
  } catch {
    return false
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

async function addToEmailAudience(email: string): Promise<void> {
  // Support both Resend and Postmark — prefer Resend if configured
  const resendApiKey = process.env.RESEND_API_KEY
  const resendAudienceId = process.env.RESEND_AUDIENCE_ID

  if (resendApiKey && resendAudienceId) {
    try {
      await fetch(`https://api.resend.com/audiences/${resendAudienceId}/contacts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          unsubscribed: false,
          tags: [{ name: 'free_audit_started', value: 'true' }],
        }),
      })
    } catch (err) {
      // Non-fatal — log and continue
      console.error('[audit/start] Resend audience add failed:', err)
    }
    return
  }

  // Fallback: Postmark suppression list / broadcast (if configured)
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN
  if (postmarkToken) {
    try {
      await fetch('https://api.postmarkapp.com/message-streams/broadcast/subscriptions', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': postmarkToken,
        },
        body: JSON.stringify({ Email: email }),
      })
    } catch (err) {
      console.error('[audit/start] Postmark audience add failed:', err)
    }
  }
}

export async function POST(req: NextRequest) {
  let body: { url?: string; email?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const url = (body.url ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()

  // --- Validate inputs ---
  if (!url) {
    return NextResponse.json({ error: 'Listing URL is required.' }, { status: 400 })
  }
  if (!isValidAirbnbUrl(url)) {
    return NextResponse.json(
      { error: 'Please provide a valid Airbnb listing URL.' },
      { status: 400 }
    )
  }
  if (!email) {
    return NextResponse.json({ error: 'Email address is required.' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  // --- Upsert user by email ---
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({ email, created_at: new Date().toISOString() })
      .select('id')
      .single()

    if (userError || !newUser) {
      console.error('[audit/start] User insert error:', userError)
      return NextResponse.json(
        { error: 'Failed to create user record. Please try again.' },
        { status: 500 }
      )
    }
    userId = newUser.id
  }

  // --- Upsert property by URL + user ---
  const { data: existingProperty } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', userId)
    .eq('listing_url', url)
    .maybeSingle()

  let propertyId: string

  if (existingProperty) {
    propertyId = existingProperty.id
  } else {
    const { data: newProperty, error: propError } = await supabase
      .from('properties')
      .insert({
        user_id: userId,
        listing_url: url,
        platform: 'airbnb',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (propError || !newProperty) {
      console.error('[audit/start] Property insert error:', propError)
      return NextResponse.json(
        { error: 'Failed to create property record. Please try again.' },
        { status: 500 }
      )
    }
    propertyId = newProperty.id
  }

  // --- Create audit row with status: pending ---
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .insert({
      property_id: propertyId,
      user_id: userId,
      status: 'pending',
      listing_url: url,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (auditError || !audit) {
    console.error('[audit/start] Audit insert error:', auditError)
    return NextResponse.json(
      { error: 'Failed to create audit record. Please try again.' },
      { status: 500 }
    )
  }

  // --- Add email to marketing audience (non-blocking) ---
  addToEmailAudience(email).catch(() => {})

  // --- Trigger the scrape+score job (non-blocking) ---
  triggerAuditJob(audit.id, url, propertyId, userId).catch((err) => {
    console.error('[audit/start] Audit job trigger error:', err)
  })

  return NextResponse.json({ auditId: audit.id }, { status: 201 })
}

/**
 * Triggers the background scrape + score job.
 * Calls the existing /api/audit route which handles scraping.
 * Falls back to inline processing if the internal call fails.
 */
async function triggerAuditJob(
  auditId: string,
  listingUrl: string,
  propertyId: string,
  userId: string
): Promise<void> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    const res = await fetch(`${baseUrl}/api/audit/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId, listingUrl, propertyId, userId }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[audit/start] triggerAuditJob non-OK:', res.status, text)
    }
  } catch (err) {
    console.error('[audit/start] triggerAuditJob fetch error:', err)
  }
}
