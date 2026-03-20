import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/audit/start
 *
 * Accepts a listing URL, validates it server-side, kicks off the audit
 * pipeline, and returns an auditId that the client uses to navigate to
 * /audit/[auditId].
 *
 * This route is intentionally thin — the heavy lifting (scraping + scoring)
 * happens asynchronously after the ID is created.  The /audit/[auditId] page
 * polls for completion status.
 */

// ---------------------------------------------------------------------------
// URL validation (mirrors client-side, but authoritative here)
// ---------------------------------------------------------------------------

const AIRBNB_REGEX =
  /^https?:\/\/(www\.)?airbnb\.(com|co\.[a-z]{2}|[a-z]{2})\/(rooms\/\d+|h\/[a-zA-Z0-9_-]+)/i

const VRBO_REGEX =
  /^https?:\/\/(www\.)?(vrbo\.com|homeaway\.com)\/.+/i

function isValidListingUrl(url: string): boolean {
  return AIRBNB_REGEX.test(url) || VRBO_REGEX.test(url)
}

function detectPlatform(url: string): 'airbnb' | 'vrbo' {
  return AIRBNB_REGEX.test(url) ? 'airbnb' : 'vrbo'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateAuditId(): string {
  // Crypto-safe random ID, URL-safe, no external deps
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
// Kick off the audit pipeline (non-blocking)
// ---------------------------------------------------------------------------

/**
 * Enqueues or directly invokes the scrape + score pipeline.
 * This is intentionally async and does NOT block the HTTP response.
 * Any failures here are logged; the results page handles the
 * "still processing / error" state via its own status polling.
 */
async function kickOffAuditPipeline(
  auditId: string,
  url: string,
  platform: 'airbnb' | 'vrbo'
): Promise<void> {
  try {
    // Attempt to call the existing /api/audit endpoint if it's the scrape+score
    // orchestrator.  We fire-and-forget; the results page polls status.
    const internalBase =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    await fetch(`${internalBase}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId, url, platform }),
    })
  } catch (err) {
    // Non-fatal — the results page will show its own error state
    console.error('[audit/start] Failed to kick off audit pipeline:', err)
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body.' },
      { status: 400 }
    )
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !('url' in body) ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Missing required field: url (string).' },
      { status: 400 }
    )
  }

  const url = ((body as Record<string, unknown>).url as string).trim()

  if (!url) {
    return NextResponse.json(
      { error: 'URL must not be empty.' },
      { status: 400 }
    )
  }

  if (!isValidListingUrl(url)) {
    return NextResponse.json(
      {
        error:
          'Please provide a valid Airbnb or Vrbo listing URL. ' +
          'Expected format: airbnb.com/rooms/<id> or vrbo.com/<id>',
      },
      { status: 422 }
    )
  }

  const platform = detectPlatform(url)
  const auditId = generateAuditId()

  // Fire off the pipeline without awaiting — the client will poll for status
  kickOffAuditPipeline(auditId, url, platform).catch((err) => {
    console.error('[audit/start] Uncaught pipeline error:', err)
  })

  return NextResponse.json(
    {
      auditId,
      url,
      platform,
      status: 'processing',
      message: 'Audit started. Poll /audit/' + auditId + ' for results.',
    },
    { status: 202 }
  )
}

// Only POST is supported on this route
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  )
}
