import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, utm_source, utm_medium, utm_campaign } = body

    // Validate
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Check env vars
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Use service role key server-side to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    // Get UTM source from query params as fallback
    const url = new URL(request.url)
    const utmSource =
      utm_source ||
      url.searchParams.get('utm_source') ||
      request.headers.get('referer') ||
      'direct'
    const utmMedium = utm_medium || url.searchParams.get('utm_medium') || null
    const utmCampaign =
      utm_campaign || url.searchParams.get('utm_campaign') || null

    const { error } = await supabase.from('waitlist').insert({
      email: cleanEmail,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      signed_up_at: new Date().toISOString(),
    })

    if (error) {
      // Duplicate email — still return success (don't leak existence)
      if (error.code === '23505') {
        return NextResponse.json(
          { success: true, message: 'already_on_list' },
          { status: 200 }
        )
      }
      console.error('Supabase insert error:', error)
      return NextResponse.json(
        { error: 'Failed to join waitlist. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'added' },
      { status: 200 }
    )
  } catch (err) {
    console.error('Waitlist API error:', err)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ count: 0 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    })

    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Count error:', error)
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count ?? 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
