import { NextRequest, NextResponse } from 'next/server'
import { scrapeAirbnbListing } from '@/lib/audit/scraper'
import { scoreListingAudit } from '@/lib/audit/scorer'
import { generateAuditSummary } from '@/lib/audit/claude-summary'
import { persistAuditRecord } from '@/lib/audit/db'
import { checkRateLimit } from '@/lib/audit/rate-limit'

export const maxDuration = 30 // Vercel max duration in seconds

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

function isValidListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const isAirbnb =
      parsed.hostname.includes('airbnb.com') &&
      (parsed.pathname.includes('/rooms/') || parsed.pathname.includes('/h/'))
    const isVrbo =
      parsed.hostname.includes('vrbo.com') || parsed.hostname.includes('homeaway.com')
    return isAirbnb || isVrbo
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // ── 1. Parse & validate input ──────────────────────────────────────────────
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Request body must be valid JSON' },
      { status: 400 }
    )
  }

  const { url } = body

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return NextResponse.json(
      { error: 'invalid_request', message: 'url is required' },
      { status: 400 }
    )
  }

  const trimmedUrl = url.trim()

  if (!isValidListingUrl(trimmedUrl)) {
    return NextResponse.json(
      {
        error: 'invalid_url',
        message: 'URL must be a valid Airbnb (/rooms/ or /h/) or Vrbo listing URL',
      },
      { status: 400 }
    )
  }

  // ── 2. Rate limiting ───────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const rateLimitResult = await checkRateLimit(ip)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `Too many audits. You can run 3 audits per hour. Try again in ${rateLimitResult.retryAfterSeconds}s.`,
        retryAfter: rateLimitResult.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfterSeconds),
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    )
  }

  // ── 3. Scrape ──────────────────────────────────────────────────────────────
  let listingData
  try {
    listingData = await scrapeAirbnbListing(trimmedUrl)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[audit] scrape failed:', msg)

    if (msg.includes('not_found') || msg.includes('404')) {
      return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
    }
    if (msg.includes('blocked') || msg.includes('captcha') || msg.includes('403')) {
      return NextResponse.json({ error: 'scrape_blocked' }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'scrape_failed', message: 'Could not retrieve listing data' },
      { status: 502 }
    )
  }

  if (!listingData) {
    return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
  }

  // ── 4. Score ───────────────────────────────────────────────────────────────
  let auditScore
  try {
    auditScore = scoreListingAudit(listingData)
  } catch (err: unknown) {
    console.error('[audit] scoring failed:', err)
    return NextResponse.json({ error: 'score_failed' }, { status: 500 })
  }

  // ── 5. Claude summary ──────────────────────────────────────────────────────
  let summaryResult
  try {
    summaryResult = await generateAuditSummary(listingData, auditScore)
  } catch (err: unknown) {
    console.error('[audit] Claude summary failed:', err)
    // Non-fatal — we can still return score without summary
    summaryResult = {
      summary: `Your listing scored ${auditScore.total}/100. There are key improvements that could significantly increase your revenue.`,
      priorityFixes: auditScore.topIssues.slice(0, 3).map((i) => i.description),
    }
  }

  // ── 6. Persist to Supabase ─────────────────────────────────────────────────
  const scrapedAt = new Date().toISOString()
  let auditId: string
  try {
    auditId = await persistAuditRecord({
      url: trimmedUrl,
      score: auditScore,
      summary: summaryResult.summary,
      priorityFixes: summaryResult.priorityFixes,
      rawData: listingData,
      scrapedAt,
      ip,
    })
  } catch (err: unknown) {
    console.error('[audit] DB persist failed:', err)
    // Still return the result even if persistence fails — don't punish the user
    auditId = `ephemeral_${Date.now()}`
  }

  // ── 7. Return result ───────────────────────────────────────────────────────
  return NextResponse.json({
    auditId,
    url: trimmedUrl,
    score: auditScore,
    summary: summaryResult.summary,
    priorityFixes: summaryResult.priorityFixes,
    scrapedAt,
  })
}
