import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scrapeAirbnbListing } from '@/lib/scraper/airbnb'
import { rateLimiter } from '@/lib/rate-limiter'

// Initialize Supabase client
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not configured')
  return createClient(url, key)
}

function isAirbnbUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'airbnb.com' ||
      parsed.hostname === 'www.airbnb.com' ||
      parsed.hostname.endsWith('.airbnb.com')
    )
  } catch {
    return false
  }
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Rate limiting: 10 requests/min per IP
  const rl = rateLimiter.check(ip)
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetAt),
        },
      }
    )
  }

  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url } = body

  if (!url || typeof url !== 'string' || !url.trim()) {
    return NextResponse.json(
      { error: 'Request body must include a non-empty "url" string' },
      { status: 400 }
    )
  }

  const trimmedUrl = url.trim()

  // Validate it's an Airbnb URL
  if (!isAirbnbUrl(trimmedUrl)) {
    return NextResponse.json(
      {
        error: 'Only Airbnb listing URLs are supported',
        hint: 'URL must be from airbnb.com (e.g. https://www.airbnb.com/rooms/12345678)',
      },
      { status: 400 }
    )
  }

  let auditId: string | null = null
  const supabase = getSupabase()

  // Create a pending audit record
  try {
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        url: trimmedUrl,
        status: 'pending',
        ip_address: ip,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!insertError && audit) {
      auditId = audit.id
    }
  } catch (err) {
    // Non-fatal: we proceed even if we can't create the audit record
    console.error('[scrape] Failed to create audit record:', err)
  }

  // Run the scraper
  let listingData: Awaited<ReturnType<typeof scrapeAirbnbListing>>
  try {
    listingData = await scrapeAirbnbListing(trimmedUrl)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown scraper error'
    const isNotFound =
      errorMessage.includes('not found') ||
      errorMessage.includes('404') ||
      errorMessage.includes('no listing')

    // Update audit record to failed
    if (auditId) {
      await supabase
        .from('audits')
        .update({
          status: 'failed',
          error_detail: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auditId)
        .catch((e: unknown) => console.error('[scrape] Failed to update audit to failed:', e))
    }

    if (isNotFound) {
      return NextResponse.json(
        {
          error: 'No listing found at this URL',
          detail: 'The URL resolved but contained no recognizable Airbnb listing data',
        },
        { status: 422 }
      )
    }

    console.error('[scrape] Scraper failed:', errorMessage)
    return NextResponse.json(
      {
        error: 'Scraper failed to extract listing data',
        // Sanitized — do not leak stack traces
        code: 'SCRAPER_ERROR',
      },
      { status: 500 }
    )
  }

  // Persist successful result
  if (auditId) {
    await supabase
      .from('audits')
      .update({
        status: 'complete',
        listing_data: listingData,
        title: listingData.title,
        overall_rating: listingData.overall_rating,
        review_count: listingData.review_count,
        price_per_night: listingData.price_per_night,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auditId)
      .catch((e: unknown) => console.error('[scrape] Failed to update audit to complete:', e))
  }

  return NextResponse.json(
    {
      success: true,
      auditId,
      data: listingData,
    },
    { status: 200 }
  )
}

// Only allow POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}
