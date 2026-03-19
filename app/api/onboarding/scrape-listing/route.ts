import { NextRequest, NextResponse } from 'next/server'
import { scrapeAirbnbListing } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate it's an Airbnb or Vrbo URL
    const isAirbnb = url.includes('airbnb.com/rooms/') || url.includes('airbnb.com/h/')
    const isVrbo = url.includes('vrbo.com/') || url.includes('homeaway.com/')

    if (!isAirbnb && !isVrbo) {
      return NextResponse.json(
        { error: 'Please enter a valid Airbnb or Vrbo listing URL' },
        { status: 400 }
      )
    }

    const listingData = await scrapeAirbnbListing(url)
    return NextResponse.json({ success: true, listing: listingData })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch listing data. Please check the URL and try again.' },
      { status: 500 }
    )
  }
}
