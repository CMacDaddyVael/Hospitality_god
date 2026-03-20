import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ valid: false, error: 'URL is required' })
    }

    const trimmed = url.trim()

    let parsed: URL
    try {
      parsed = new URL(trimmed)
    } catch {
      return NextResponse.json({ valid: false, error: 'Not a valid URL' })
    }

    const isAirbnb =
      parsed.hostname.includes('airbnb.com') &&
      (parsed.pathname.includes('/rooms/') || parsed.pathname.includes('/h/'))

    const isVrbo =
      parsed.hostname.includes('vrbo.com') || parsed.hostname.includes('homeaway.com')

    if (!isAirbnb && !isVrbo) {
      return NextResponse.json({
        valid: false,
        error: 'Please enter an Airbnb or Vrbo listing URL',
      })
    }

    const platform = isAirbnb ? 'airbnb' : 'vrbo'

    return NextResponse.json({ valid: true, platform, url: trimmed })
  } catch (err) {
    console.error('Validate URL error:', err)
    return NextResponse.json({ valid: false, error: 'Validation failed' })
  }
}
