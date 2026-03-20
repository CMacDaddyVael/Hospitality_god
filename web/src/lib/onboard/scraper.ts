/**
 * Scraper module for the onboard pipeline.
 * Accepts an Airbnb URL and returns structured property data.
 * Issue #171
 */

import type { ScrapedProperty, ScrapeResult, ScrapeError } from './types'

// ---------------------------------------------------------------------------
// URL validation & canonicalization
// ---------------------------------------------------------------------------

const AIRBNB_ROOM_RE = /airbnb\.[a-z.]+\/rooms\/(\d+)/i
const AIRBNB_H_RE = /airbnb\.[a-z.]+\/h\/([a-z0-9-]+)/i

export function isValidAirbnbUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (!url.hostname.includes('airbnb.')) return false
    return AIRBNB_ROOM_RE.test(raw) || AIRBNB_H_RE.test(raw)
  } catch {
    return false
  }
}

export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw)
    // Strip query params and fragments — keep only the path
    return `https://www.airbnb.com${url.pathname}`
  } catch {
    return raw
  }
}

// ---------------------------------------------------------------------------
// HTML fetch helpers
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 7_000

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; VAELBot/1.0; +https://vael.host)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Metadata extraction helpers (best-effort from public HTML)
// ---------------------------------------------------------------------------

function extractText(html: string, pattern: RegExp, group = 1): string | null {
  const m = html.match(pattern)
  return m ? (m[group] ?? null) : null
}

function extractNumber(html: string, pattern: RegExp, group = 1): number | null {
  const raw = extractText(html, pattern, group)
  if (raw === null) return null
  const n = parseFloat(raw.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

/**
 * Pull structured data out of Airbnb's __NEXT_DATA__ JSON blob, which is
 * embedded in every public listing page. Falls back to regex scraping if the
 * blob is absent or doesn't contain what we need.
 */
function parseListingHtml(html: string, canonicalUrl: string): ScrapedProperty {
  // ---- Try JSON-LD / __NEXT_DATA__ first --------------------------------
  let nextData: Record<string, unknown> = {}
  try {
    const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (ndMatch) {
      nextData = JSON.parse(ndMatch[1]) as Record<string, unknown>
    }
  } catch {
    // silently ignore — fall through to regex extraction
  }

  // Attempt to navigate the Next.js data tree
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listing: any =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nextData as any)?.props?.pageProps?.listing ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nextData as any)?.props?.pageProps?.listingData?.listing ??
    null

  // ---- Regex fallbacks ---------------------------------------------------
  const title =
    listing?.name ??
    listing?.listing?.name ??
    extractText(html, /<meta property="og:title" content="([^"]+)"/) ??
    extractText(html, /<title>([^<]+)<\/title>/) ??
    'Unknown Listing'

  const description =
    listing?.description ??
    listing?.listing?.description ??
    extractText(html, /<meta property="og:description" content="([^"]+)"/) ??
    ''

  const rating =
    listing?.avgRating ??
    listing?.primaryHost?.avgRating ??
    extractNumber(html, /(\d\.\d+)\s*out of\s*5\s*stars/)

  const reviewCount =
    listing?.reviewsCount ??
    listing?.listing?.reviewsCount ??
    extractNumber(html, /(\d[\d,]*)\s+reviews?/i)

  const pricePerNight =
    listing?.structuredContent?.primaryLine?.[0]?.price ??
    extractNumber(html, /\$(\d[\d,]*)\s*\/\s*night/i)

  const propertyType =
    listing?.roomTypeCategory ??
    listing?.listing?.roomTypeCategory ??
    listing?.propertyType ??
    extractText(html, /property[Tt]ype['":\s]+['"]?([A-Za-z _]+)['"]?/) ??
    'Unknown'

  const bedrooms: number | null =
    listing?.bedrooms ??
    listing?.listing?.bedrooms ??
    extractNumber(html, /(\d+)\s+bedroom/i)

  const bathrooms: number | null =
    listing?.bathrooms ??
    listing?.listing?.bathrooms ??
    extractNumber(html, /(\d+(?:\.\d+)?)\s+bath/i)

  const maxGuests: number | null =
    listing?.personCapacity ??
    listing?.listing?.personCapacity ??
    extractNumber(html, /(\d+)\s+guests?/i)

  // Photos
  const photos: string[] = []
  if (Array.isArray(listing?.photos)) {
    for (const p of listing.photos) {
      const src = p?.url ?? p?.large ?? p?.medium ?? null
      if (typeof src === 'string') photos.push(src)
    }
  }
  if (photos.length === 0) {
    const ogImage = extractText(html, /<meta property="og:image" content="([^"]+)"/)
    if (ogImage) photos.push(ogImage)
  }

  // Amenities
  const amenities: string[] = []
  if (Array.isArray(listing?.amenityIds)) {
    // IDs only — we don't have the full map, just record count
  }
  if (Array.isArray(listing?.sectionedDescription?.amenitiesGroups)) {
    for (const group of listing.sectionedDescription.amenitiesGroups) {
      if (Array.isArray(group.amenities)) {
        for (const a of group.amenities) {
          if (a?.title) amenities.push(a.title)
        }
      }
    }
  }

  // Location
  const locationStr =
    listing?.city ??
    listing?.listing?.publicAddress ??
    extractText(html, /<meta property="og:locality" content="([^"]+)"/) ??
    extractText(html, /"city"\s*:\s*"([^"]+)"/) ??
    ''

  const city: string | null = listing?.city ?? locationStr ?? null
  const state: string | null = listing?.state ?? null
  const country: string | null = listing?.country ?? null
  const latitude: number | null = listing?.lat ?? listing?.location?.lat ?? null
  const longitude: number | null = listing?.lng ?? listing?.location?.lng ?? null

  const hostName: string | null =
    listing?.primaryHost?.firstName ??
    listing?.host?.firstName ??
    extractText(html, /Hosted by ([A-Za-z ]+)/i)

  const superhost: boolean =
    listing?.primaryHost?.isSuperhost ?? listing?.host?.isSuperhost ?? false

  const instantBook: boolean = listing?.instantBookable ?? false

  return {
    airbnb_url: canonicalUrl,
    canonical_url: canonicalUrl,
    title: String(title).slice(0, 500),
    description: String(description).slice(0, 10_000),
    property_type: String(propertyType).slice(0, 100),
    location: String(locationStr).slice(0, 200),
    city,
    state,
    country,
    latitude,
    longitude,
    bedrooms,
    bathrooms,
    max_guests: maxGuests,
    amenities,
    photos,
    rating,
    review_count: reviewCount,
    price_per_night: pricePerNight,
    host_name: hostName,
    host_since: null,
    superhost,
    instant_book: instantBook,
    raw_html_length: html.length,
  }
}

// ---------------------------------------------------------------------------
// Public scrape function
// ---------------------------------------------------------------------------

export async function scrapeAirbnbUrl(rawUrl: string): Promise<ScrapeResult> {
  if (!isValidAirbnbUrl(rawUrl)) {
    return {
      ok: false,
      error: { code: 'invalid_url', message: 'Not a valid Airbnb listing URL' },
    }
  }

  const canonical = canonicalizeUrl(rawUrl)

  let res: Response
  try {
    res = await fetchWithTimeout(canonical, FETCH_TIMEOUT_MS)
  } catch (err: unknown) {
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
    const code: ScrapeError['code'] = isAbort ? 'timeout' : 'blocked'
    return {
      ok: false,
      error: {
        code,
        message: isAbort ? 'Request timed out' : `Network error: ${String(err)}`,
      },
    }
  }

  if (res.status === 404) {
    return { ok: false, error: { code: 'not_found', message: 'Listing not found (404)', status: 404 } }
  }

  if (res.status === 429) {
    return { ok: false, error: { code: 'rate_limited', message: 'Rate limited by Airbnb (429)', status: 429 } }
  }

  if (res.status === 403 || res.status === 503) {
    return {
      ok: false,
      error: { code: 'blocked', message: `Blocked by Airbnb (HTTP ${res.status})`, status: res.status },
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error: {
        code: 'blocked',
        message: `Unexpected HTTP ${res.status} from Airbnb`,
        status: res.status,
      },
    }
  }

  let html: string
  try {
    html = await res.text()
  } catch {
    return { ok: false, error: { code: 'parse_error', message: 'Failed to read response body' } }
  }

  try {
    const property = parseListingHtml(html, canonical)
    return { ok: true, property }
  } catch (err) {
    return {
      ok: false,
      error: { code: 'parse_error', message: `Parse failed: ${String(err)}` },
    }
  }
}
