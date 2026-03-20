/**
 * Audit scraper — wraps the existing scraping logic and normalises output
 * into the ListingData shape needed by the audit pipeline.
 *
 * This is a NEW file. It does NOT modify the existing scraper used by
 * app/api/onboarding/scrape-listing/route.ts.
 */

import * as cheerio from 'cheerio'
import { ListingData } from './types'

const SCRAPE_TIMEOUT_MS = 20_000

/** Fetch a URL with a realistic browser User-Agent and a timeout. */
async function fetchWithTimeout(url: string, timeoutMs = SCRAPE_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    })

    if (res.status === 404) throw new Error('not_found')
    if (res.status === 403) throw new Error('blocked — 403 Forbidden')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    return res.text()
  } finally {
    clearTimeout(timer)
  }
}

/** Pull structured data from Airbnb's __NEXT_DATA__ JSON blob if present. */
function extractNextData(html: string): Record<string, unknown> | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Safely read a nested value from an object by dot-path. */
function dig(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function platform(url: string): 'airbnb' | 'vrbo' {
  return url.includes('airbnb.com') ? 'airbnb' : 'vrbo'
}

/** Parse a dollar string like "$189" or "189" → number */
function parseDollar(s: string | undefined | null): number | null {
  if (!s) return null
  const n = Number(String(s).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

/**
 * Scrape an Airbnb or Vrbo listing page and return normalised ListingData.
 * Throws with descriptive messages on failure so the route can return
 * the right error code.
 */
export async function scrapeAirbnbListing(url: string): Promise<ListingData> {
  const html = await fetchWithTimeout(url)

  // Detect bot-blocking responses
  if (
    html.includes('Please complete the CAPTCHA') ||
    html.includes('captcha') ||
    html.includes('robot') ||
    html.length < 500
  ) {
    throw new Error('blocked — captcha or bot detection')
  }

  const $ = cheerio.load(html)
  const nextData = extractNextData(html)

  // ── Title ──────────────────────────────────────────────────────────────────
  const title =
    (dig(nextData, 'props', 'pageProps', 'listing', 'name') as string) ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    ''

  // ── Description ───────────────────────────────────────────────────────────
  const description =
    (dig(nextData, 'props', 'pageProps', 'listing', 'description') as string) ||
    $('meta[property="og:description"]').attr('content') ||
    $('[data-section-id="DESCRIPTION_DEFAULT"] span').text().trim() ||
    ''

  // ── Photos ────────────────────────────────────────────────────────────────
  const ogImages: string[] = []
  $('meta[property="og:image"]').each((_, el) => {
    const content = $(el).attr('content')
    if (content) ogImages.push(content)
  })

  const jsonPhotos: string[] = []
  const photosRaw = dig(nextData, 'props', 'pageProps', 'listing', 'photos')
  if (Array.isArray(photosRaw)) {
    for (const p of photosRaw) {
      const src =
        (p as Record<string, unknown>).large_url ||
        (p as Record<string, unknown>).url ||
        (p as Record<string, unknown>).picture
      if (typeof src === 'string') jsonPhotos.push(src)
    }
  }

  const photos = jsonPhotos.length > 0 ? jsonPhotos : ogImages

  // ── Amenities ─────────────────────────────────────────────────────────────
  const amenities: string[] = []
  const amenitiesRaw = dig(nextData, 'props', 'pageProps', 'listing', 'amenities')
  if (Array.isArray(amenitiesRaw)) {
    for (const a of amenitiesRaw) {
      const name =
        (a as Record<string, unknown>).name || (a as Record<string, unknown>).title
      if (typeof name === 'string') amenities.push(name)
    }
  }
  // Fallback: scrape amenity text from DOM
  if (amenities.length === 0) {
    $('[data-section-id="AMENITIES_DEFAULT"] li, [data-testid="amenity-row"]').each((_, el) => {
      const text = $(el).text().trim()
      if (text) amenities.push(text)
    })
  }

  // ── Rating & review count ─────────────────────────────────────────────────
  const ratingRaw =
    dig(nextData, 'props', 'pageProps', 'listing', 'avg_rating') ||
    dig(nextData, 'props', 'pageProps', 'listing', 'star_rating')
  const rating = typeof ratingRaw === 'number' ? ratingRaw : null

  const reviewCountRaw =
    dig(nextData, 'props', 'pageProps', 'listing', 'reviews_count') ||
    dig(nextData, 'props', 'pageProps', 'listing', 'number_of_reviews')
  const reviewCount = typeof reviewCountRaw === 'number' ? reviewCountRaw : 0

  // ── Reviews (first page, max 10) ──────────────────────────────────────────
  const reviews: { text: string; rating: number; date: string }[] = []
  const reviewsRaw = dig(nextData, 'props', 'pageProps', 'listing', 'reviews')
  if (Array.isArray(reviewsRaw)) {
    for (const r of reviewsRaw.slice(0, 10)) {
      const rv = r as Record<string, unknown>
      reviews.push({
        text: String(rv.comments || rv.text || ''),
        rating: typeof rv.rating === 'number' ? rv.rating : 5,
        date: String(rv.created_at || rv.date || ''),
      })
    }
  }

  // ── Property type ─────────────────────────────────────────────────────────
  const propertyType =
    (dig(nextData, 'props', 'pageProps', 'listing', 'room_type_category') as string) ||
    (dig(nextData, 'props', 'pageProps', 'listing', 'property_type') as string) ||
    $('meta[name="description"]').attr('content')?.split(' in ')?.[0] ||
    'Unknown'

  // ── Location ─────────────────────────────────────────────────────────────
  const location =
    (dig(nextData, 'props', 'pageProps', 'listing', 'city') as string) ||
    (dig(nextData, 'props', 'pageProps', 'listing', 'location_title') as string) ||
    $('meta[property="og:title"]').attr('content')?.split(' in ')?.[1]?.split(' – ')?.[0] ||
    'Unknown'

  // ── Price ─────────────────────────────────────────────────────────────────
  const priceRaw =
    dig(nextData, 'props', 'pageProps', 'listing', 'price') ||
    dig(nextData, 'props', 'pageProps', 'listing', 'price_native')

  let pricePerNight: number | null = null
  if (typeof priceRaw === 'number') {
    pricePerNight = priceRaw
  } else if (typeof priceRaw === 'string') {
    pricePerNight = parseDollar(priceRaw)
  } else {
    // DOM fallback
    const priceText = $('[data-testid="price-and-discounted-price"] span').first().text()
    pricePerNight = parseDollar(priceText)
  }

  return {
    url,
    title,
    description,
    photos,
    amenities,
    reviews,
    rating,
    reviewCount,
    propertyType,
    location,
    pricePerNight,
    platform: platform(url),
    extras: {},
  }
}
