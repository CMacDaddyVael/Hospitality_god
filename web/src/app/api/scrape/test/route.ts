import { NextResponse } from 'next/server'
import { SCRAPE_FIXTURE } from '@/lib/scraper/fixture'

/**
 * GET /api/scrape/test
 *
 * Dev-only endpoint that returns a hardcoded fixture response.
 * Guarded by NODE_ENV — returns 404 in production.
 *
 * Frontend devs can use this to build against the scrape output
 * contract without running Puppeteer locally.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      success: true,
      auditId: 'fixture-audit-id-00000000',
      _fixture: true,
      data: SCRAPE_FIXTURE,
    },
    { status: 200 }
  )
}
