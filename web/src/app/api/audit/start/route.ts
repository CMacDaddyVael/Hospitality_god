import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function isValidAirbnbUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname === 'www.airbnb.com' || parsed.hostname === 'airbnb.com') &&
      (parsed.pathname.includes('/rooms/') || parsed.pathname.includes('/h/'))
    )
  } catch {
    return false
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, email } = body

    // Server-side validation
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Listing URL is required' }, { status: 400 })
    }

    if (!isValidAirbnbUrl(url.trim())) {
      return NextResponse.json(
        { error: 'Please provide a valid Airbnb listing URL' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    if (!isValidEmail(email.trim())) {
      return NextResponse.json({ error: 'Please provide a valid email address' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const auditId = randomUUID()
    const now = new Date().toISOString()
    const cleanEmail = email.trim().toLowerCase()
    const cleanUrl = url.trim()

    // Insert into leads table
    const { error: leadError } = await supabase.from('leads').insert({
      email: cleanEmail,
      source: 'organic_audit',
      listing_url: cleanUrl,
      audit_id: auditId,
      created_at: now,
    })

    if (leadError) {
      // Log but don't fail — lead capture is secondary to audit creation
      console.error('Failed to insert lead:', leadError)
    }

    // Insert pending audit record
    const { error: auditError } = await supabase.from('audits').insert({
      id: auditId,
      email: cleanEmail,
      listing_url: cleanUrl,
      status: 'queued',
      created_at: now,
    })

    if (auditError) {
      console.error('Failed to create audit record:', auditError)
      return NextResponse.json(
        { error: 'Failed to start audit. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, auditId }, { status: 201 })
  } catch (error) {
    console.error('Audit start error:', error)
    return NextResponse.json(
      { error: 'Unexpected error. Please try again.' },
      { status: 500 }
    )
  }
}
