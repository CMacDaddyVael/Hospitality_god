import { NextRequest, NextResponse } from 'next/server'
import { runAuditPipeline } from '@/lib/audit/pipeline'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, userId, sessionId } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    const isAirbnb = url.includes('airbnb.com/rooms/') || url.includes('airbnb.com/h/')
    const isVrbo = url.includes('vrbo.com/') || url.includes('homeaway.com/')

    if (!isAirbnb && !isVrbo) {
      return NextResponse.json(
        {
          error: 'invalid_url',
          message: 'Please enter a valid Airbnb or Vrbo listing URL',
          userMessage: "We couldn't recognise that URL — try pasting your Airbnb or Vrbo listing link directly.",
        },
        { status: 400 }
      )
    }

    const result = await runAuditPipeline({ url, userId, sessionId })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[audit/run] Pipeline error:', error)

    // Scraper-specific failure
    if (error.code === 'SCRAPER_BLOCKED' || error.code === 'SCRAPE_FAILED') {
      return NextResponse.json(
        {
          error: 'scraper_blocked',
          message: error.message,
          userMessage:
            "We couldn't read this listing — try your Vrbo URL or paste your listing text directly.",
        },
        { status: 422 }
      )
    }

    return NextResponse.json(
      {
        error: 'pipeline_failed',
        message: 'Audit failed. Please try again.',
        userMessage: 'Something went wrong running your audit. Please try again in a moment.',
      },
      { status: 500 }
    )
  }
}
