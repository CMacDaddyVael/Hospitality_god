/**
 * Airbnb Listing Scraper
 * Issue #153 — Build Airbnb listing scraper and structured data extractor
 *
 * Fetches a public Airbnb listing page and extracts structured data into
 * a canonical ListingData object consumed by all downstream agents.
 *
 * Uses Cheerio for HTML parsing + fetch for page retrieval.
 * Puppeteer path is available for JS-rendered content fallback.
 */

import * as cheerio from 'cheerio'
import type { ListingData, ScraperResult } from '../../types/listing'
import { persistListing } from '../db/listings'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRAPER_TIMEOUT_MS = 25_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2_000

/** Rotate user agents to reduce rate-limit risk */
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Normalise Airbnb URLs — strip query params, enforce /rooms/ pattern */
function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw)
    // Strip tracking params, keep only the path
    return `https://www.airbnb.com${u.pathname}`
  } catch {
    return raw
  }
}

/** Extract listing ID from URL for Supabase keying */
function extractListingId(url: string): string | null {
  // Matches /rooms/12345678 and /h/slug-name
  const roomsMatch = url.match(/\/rooms\/(\d+)/)
  if (roomsMatch) return roomsMatch[1]
  const hMatch = url.match(/\/h\/([^/?#]+)/)
  if (hMatch) return `h_${hMatch[1]}`
  return null
}

/** Parse a price string like "$149" or "£95" → number */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

/** Parse a rating string like "4.87" or "4.87 out of 5" → number */
function parseRating(raw: string): number | null {
  const match = raw.match(/(\d+\.\d+|\d+)/)
  if (!match) return null
  const n = parseFloat(match[1])
  return isNaN(n) ? null : Math.min(n, 5)
}

/** Parse review count like "127 reviews" or "(127)" → number */
function parseReviewCount(raw: string): number | null {
  const match = raw.match(/(\d[\d,]*)/)
  if (!match) return null
  const n = parseInt(match[1].replace(/,/g, ''), 10)
  return isNaN(n) ? null : n
}

/** Parse bedroom/guest counts like "3 bedrooms" → number */
function parseCount(raw: string): number | null {
  const match = raw.match(/(\d+)/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// JSON-LD / inline JSON extraction
// ---------------------------------------------------------------------------

/**
 * Airbnb embeds a large JSON blob in a <script id="data-deferred-state"> or
 * similar tag. This function tries several known patterns to extract it.
 */
function extractInlineJson($: cheerio.CheerioAPI): Record<string, unknown> | null {
  // Pattern 1: data-deferred-state script tag
  const deferredScript = $('script#data-deferred-state').html()
  if (deferredScript) {
    try {
      return JSON.parse(deferredScript)
    } catch {
      // malformed — continue
    }
  }

  // Pattern 2: __AIRBNB_DATA__ window variable
  let airbnbData: Record<string, unknown> | null = null
  $('script').each((_, el) => {
    if (airbnbData) return
    const text = $(el).html() || ''
    const match = text.match(/window\.__AIRBNB_DATA__\s*=\s*({[\s\S]+?});?\s*<\/script>/)
    if (match) {
      try {
        airbnbData = JSON.parse(match[1])
      } catch {
        // continue
      }
    }
  })
  if (airbnbData) return airbnbData

  // Pattern 3: JSON-LD schema.org
  const jsonLdScript = $('script[type="application/ld+json"]').first().html()
  if (jsonLdScript) {
    try {
      return JSON.parse(jsonLdScript)
    } catch {
      // continue
    }
  }

  // Pattern 4: Any large inline JSON that looks like listing data
  $('script').each((_, el) => {
    if (airbnbData) return
    const text = ($(el).html() || '').trim()
    if (text.startsWith('{') && text.includes('"listing"')) {
      try {
        airbnbData = JSON.parse(text)
      } catch {
        // continue
      }
    }
  })

  return airbnbData
}

/**
 * Deep-search a nested object for a key, returning first found value.
 * Used to mine Airbnb's deeply nested JSON.
 */
function deepFind(obj: unknown, key: string, maxDepth = 8): unknown {
  if (maxDepth === 0 || obj === null || typeof obj !== 'object') return undefined
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFind(item, key, maxDepth - 1)
      if (found !== undefined) return found
    }
    return undefined
  }
  const record = obj as Record<string, unknown>
  if (key in record) return record[key]
  for (const val of Object.values(record)) {
    const found = deepFind(val, key, maxDepth - 1)
    if (found !== undefined) return found
  }
  return undefined
}

// ---------------------------------------------------------------------------
// HTML (Cheerio) extraction — fallback when JSON is unavailable
// ---------------------------------------------------------------------------

function extractFromHtml($: cheerio.CheerioAPI): Partial<ListingData> {
  const partial: Partial<ListingData> = {}

  // --- Title ---
  // Airbnb uses several patterns for the title
  const titleCandidates = [
    $('h1').first().text().trim(),
    $('[data-testid="listing-title"]').first().text().trim(),
    $('meta[property="og:title"]').attr('content')?.trim() ?? '',
    $('title').text().trim(),
  ]
  partial.title = titleCandidates.find((t) => t.length > 3) ?? null

  // --- Description ---
  const descCandidates = [
    $('[data-testid="listing-description"]').text().trim(),
    $('[aria-label*="description" i]').text().trim(),
    $('meta[property="og:description"]').attr('content')?.trim() ?? '',
    $('[class*="description"]').first().text().trim(),
  ]
  partial.description = descCandidates.find((d) => d.length > 10) ?? null

  // --- Photos ---
  const photos: string[] = []
  // OG image
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) photos.push(ogImage)
  // All img tags with airbnb CDN URLs
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || ''
    if (
      (src.includes('airbnb.com') || src.includes('a0.muscache.com')) &&
      !photos.includes(src) &&
      !src.includes('profile_pic') &&
      !src.includes('avatar')
    ) {
      photos.push(src)
    }
  })
  partial.photos = photos.slice(0, 30)

  // --- Amenities ---
  const amenities: string[] = []
  $('[data-testid="amenity-row"], [data-section-id="AMENITIES"], [class*="amenity"]').each(
    (_, el) => {
      const text = $(el).text().trim()
      if (text && text.length < 80 && !amenities.includes(text)) {
        amenities.push(text)
      }
    }
  )
  partial.amenities = amenities

  // --- Nightly Rate ---
  const priceSelectors = [
    '[data-testid="price-and-discounted-price"]',
    '[class*="price"]',
    'span[aria-label*="per night" i]',
    'span[aria-label*="a night" i]',
  ]
  for (const sel of priceSelectors) {
    const text = $(sel).first().text().trim()
    const price = parsePrice(text)
    if (price && price > 5 && price < 50000) {
      partial.nightly_rate = price
      break
    }
  }

  // --- Rating ---
  const ratingSelectors = [
    '[data-testid="pdp-reviews-highlight-banner-host-rating"]',
    '[aria-label*="rating" i]',
    '[class*="rating"]',
    'span[aria-label*="star" i]',
  ]
  for (const sel of ratingSelectors) {
    const text = $(sel).first().text().trim()
    const rating = parseRating(text)
    if (rating && rating > 0 && rating <= 5) {
      partial.avg_rating = rating
      break
    }
  }

  // --- Review Count ---
  const reviewSelectors = [
    '[data-testid="pdp-reviews-highlight-banner-host-rating"]',
    '[aria-label*="review" i]',
    '[class*="review-count"]',
    'a[href*="reviews"]',
  ]
  for (const sel of reviewSelectors) {
    const text = $(sel).text().trim()
    const count = parseReviewCount(text)
    if (count && count > 0) {
      partial.review_count = count
      break
    }
  }

  // --- Host Name ---
  const hostSelectors = [
    '[data-testid="host-profile-name"]',
    '[class*="host-name"]',
    'div[aria-label*="host" i] span',
  ]
  for (const sel of hostSelectors) {
    const text = $(sel).first().text().trim()
    if (text && text.length < 60) {
      partial.host_name = text
      break
    }
  }

  // --- Location ---
  const locationCandidates = [
    $('[data-testid="listing-map-trigger"]').text().trim(),
    $('[class*="location"]').first().text().trim(),
    $('meta[property="og:locality"]').attr('content')?.trim() ?? '',
    $('[aria-label*="location" i]').first().text().trim(),
  ]
  partial.location_raw = locationCandidates.find((l) => l.length > 2) ?? null

  // --- Bedroom & Guest Counts ---
  $('[data-testid="listing-highlights"], [class*="room-basic-info"]').each((_, el) => {
    const text = $(el).text()
    if (/bedroom/i.test(text) && !partial.bedroom_count) {
      partial.bedroom_count = parseCount(text)
    }
    if (/guest/i.test(text) && !partial.max_guests) {
      partial.max_guests = parseCount(text)
    }
  })

  // Fallback: scan all text nodes near property details
  $('li, span, div').each((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim()
    if (/^\d+\s+bedroom/i.test(text) && !partial.bedroom_count) {
      partial.bedroom_count = parseCount(text)
    }
    if (/^\d+\s+guest/i.test(text) && !partial.max_guests) {
      partial.max_guests = parseCount(text)
    }
  })

  // --- Highlights ---
  const highlights: string[] = []
  $('[data-testid="listing-highlights"] li, [class*="highlights"] li').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length < 120 && !highlights.includes(text)) {
      highlights.push(text)
    }
  })
  partial.highlights = highlights

  // --- House Rules ---
  const house_rules: string[] = []
  $('[data-section-id="POLICIES_DEFAULT"] li, [class*="house-rules"] li').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length < 200 && !house_rules.includes(text)) {
      house_rules.push(text)
    }
  })
  partial.house_rules = house_rules

  return partial
}

// ---------------------------------------------------------------------------
// JSON extraction — primary path
// ---------------------------------------------------------------------------

function extractFromJson(json: Record<string, unknown>): Partial<ListingData> {
  const partial: Partial<ListingData> = {}

  // --- Title ---
  const title = deepFind(json, 'name') ?? deepFind(json, 'title')
  if (typeof title === 'string' && title.length > 0) {
    partial.title = title
  }

  // --- Description ---
  const description =
    deepFind(json, 'description') ??
    deepFind(json, 'htmlDescription') ??
    deepFind(json, 'listingDescription')
  if (typeof description === 'string') {
    // Strip HTML tags if present
    partial.description = description.replace(/<[^>]+>/g, '').trim()
  }

  // --- Photos ---
  // Airbnb JSON often has photos array under listing.photos or listing.listingImages
  const photosRaw =
    deepFind(json, 'listingImages') ??
    deepFind(json, 'photos') ??
    deepFind(json, 'images')
  if (Array.isArray(photosRaw)) {
    partial.photos = (photosRaw as unknown[])
      .map((p) => {
        if (typeof p === 'string') return p
        if (typeof p === 'object' && p !== null) {
          const o = p as Record<string, unknown>
          return (
            (typeof o.url === 'string' ? o.url : null) ??
            (typeof o.baseUrl === 'string' ? o.baseUrl : null) ??
            (typeof o.large === 'string' ? o.large : null) ??
            null
          )
        }
        return null
      })
      .filter((u): u is string => u !== null)
      .slice(0, 30)
  }

  // --- Amenities ---
  const amenitiesRaw =
    deepFind(json, 'seeAllAmenitiesGroups') ??
    deepFind(json, 'amenities') ??
    deepFind(json, 'listing_amenities')
  if (Array.isArray(amenitiesRaw)) {
    const amenities: string[] = []
    const flatten = (items: unknown[]) => {
      for (const item of items) {
        if (typeof item === 'string') {
          amenities.push(item)
        } else if (typeof item === 'object' && item !== null) {
          const o = item as Record<string, unknown>
          // Groups have an "amenities" sub-array
          if (Array.isArray(o.amenities)) {
            flatten(o.amenities as unknown[])
          } else {
            const name = o.name ?? o.title ?? o.localizedName
            if (typeof name === 'string') amenities.push(name)
          }
        }
      }
    }
    flatten(amenitiesRaw as unknown[])
    partial.amenities = [...new Set(amenities)]
  }

  // --- Price ---
  const price =
    deepFind(json, 'price') ??
    deepFind(json, 'priceAmount') ??
    deepFind(json, 'nightly_rate') ??
    deepFind(json, 'basePrice')
  if (typeof price === 'number' && price > 0) {
    partial.nightly_rate = price
  } else if (typeof price === 'string') {
    const parsed = parsePrice(price)
    if (parsed) partial.nightly_rate = parsed
  }

  // --- Rating ---
  const rating =
    deepFind(json, 'starRating') ??
    deepFind(json, 'avg_rating') ??
    deepFind(json, 'guestSatisfactionOverall') ??
    deepFind(json, 'reviewsScore')
  if (typeof rating === 'number' && rating > 0 && rating <= 5) {
    partial.avg_rating = rating
  } else if (typeof rating === 'string') {
    const parsed = parseRating(rating)
    if (parsed) partial.avg_rating = parsed
  }

  // --- Review Count ---
  const reviewCount =
    deepFind(json, 'reviewsCount') ??
    deepFind(json, 'numberOfReviews') ??
    deepFind(json, 'review_count') ??
    deepFind(json, 'reviewsTotal')
  if (typeof reviewCount === 'number') {
    partial.review_count = reviewCount
  } else if (typeof reviewCount === 'string') {
    const parsed = parseReviewCount(reviewCount)
    if (parsed) partial.review_count = parsed
  }

  // --- Host Name ---
  const hostName =
    deepFind(json, 'hostName') ??
    deepFind(json, 'host_name') ??
    deepFind(json, 'primaryHostName')
  if (typeof hostName === 'string') {
    partial.host_name = hostName
  }

  // --- Location ---
  const location =
    deepFind(json, 'publicAddress') ??
    deepFind(json, 'location') ??
    deepFind(json, 'city') ??
    deepFind(json, 'localizedCity')
  if (typeof location === 'string') {
    partial.location_raw = location
  }

  // --- Bedroom Count ---
  const bedrooms =
    deepFind(json, 'bedroomCount') ??
    deepFind(json, 'bedrooms') ??
    deepFind(json, 'bedroom_count')
  if (typeof bedrooms === 'number') {
    partial.bedroom_count = bedrooms
  } else if (typeof bedrooms === 'string') {
    const parsed = parseCount(bedrooms)
    if (parsed) partial.bedroom_count = parsed
  }

  // --- Max Guests ---
  const guests =
    deepFind(json, 'personCapacity') ??
    deepFind(json, 'guestCapacity') ??
    deepFind(json, 'maxGuests') ??
    deepFind(json, 'max_guests')
  if (typeof guests === 'number') {
    partial.max_guests = guests
  } else if (typeof guests === 'string') {
    const parsed = parseCount(guests)
    if (parsed) partial.max_guests = parsed
  }

  // --- Highlights ---
  const highlights = deepFind(json, 'highlights') ?? deepFind(json, 'listingHighlights')
  if (Array.isArray(highlights)) {
    partial.highlights = (highlights as unknown[])
      .map((h) => {
        if (typeof h === 'string') return h
        if (typeof h === 'object' && h !== null) {
          const o = h as Record<string, unknown>
          return typeof o.title === 'string'
            ? o.title
            : typeof o.message === 'string'
            ? o.message
            : null
        }
        return null
      })
      .filter((h): h is string => h !== null)
  }

  // --- House Rules ---
  const houseRules =
    deepFind(json, 'houseRules') ??
    deepFind(json, 'house_rules') ??
    deepFind(json, 'additionalHouseRules')
  if (typeof houseRules === 'string') {
    // Sometimes it's a single string — split on newlines/periods
    partial.house_rules = houseRules
      .split(/\n|\.(?=\s)/)
      .map((r) => r.trim())
      .filter((r) => r.length > 2)
  } else if (Array.isArray(houseRules)) {
    partial.house_rules = (houseRules as unknown[])
      .map((r) => {
        if (typeof r === 'string') return r
        if (typeof r === 'object' && r !== null) {
          const o = r as Record<string, unknown>
          return typeof o.title === 'string' ? o.title : typeof o.body === 'string' ? o.body : null
        }
        return null
      })
      .filter((r): r is string => r !== null)
  }

  return partial
}

// ---------------------------------------------------------------------------
// Merge strategy — JSON wins, HTML fills gaps
// ---------------------------------------------------------------------------

function mergePartials(
  jsonData: Partial<ListingData>,
  htmlData: Partial<ListingData>,
  url: string
): ListingData {
  const listing_id = extractListingId(url)

  return {
    // Required-ish fields — JSON wins, HTML fallback, then null
    title: jsonData.title ?? htmlData.title ?? null,
    description: jsonData.description ?? htmlData.description ?? null,
    photos: mergeArrays(jsonData.photos, htmlData.photos),
    amenities: mergeArrays(jsonData.amenities, htmlData.amenities),
    nightly_rate: jsonData.nightly_rate ?? htmlData.nightly_rate ?? null,
    review_count: jsonData.review_count ?? htmlData.review_count ?? null,
    avg_rating: jsonData.avg_rating ?? htmlData.avg_rating ?? null,
    highlights: mergeArrays(jsonData.highlights, htmlData.highlights),
    host_name: jsonData.host_name ?? htmlData.host_name ?? null,
    location_raw: jsonData.location_raw ?? htmlData.location_raw ?? null,
    bedroom_count: jsonData.bedroom_count ?? htmlData.bedroom_count ?? null,
    max_guests: jsonData.max_guests ?? htmlData.max_guests ?? null,
    house_rules: mergeArrays(jsonData.house_rules, htmlData.house_rules),

    // Metadata
    source_url: url,
    listing_id: listing_id ?? undefined,
    scraped_at: new Date().toISOString(),
    platform: 'airbnb',
  }
}

function mergeArrays<T>(a: T[] | undefined | null, b: T[] | undefined | null): T[] {
  if (a && a.length > 0) return a
  if (b && b.length > 0) return b
  return []
}

// ---------------------------------------------------------------------------
// Page fetcher
// ---------------------------------------------------------------------------

async function fetchPage(url: string, attempt: number): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCRAPER_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': pickUserAgent(),
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        // Avoid triggering bot detection
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        DNT: '1',
      },
      // Follow redirects
      redirect: 'follow',
    })

    if (response.status === 429) {
      throw new RateLimitError(`Rate limited on attempt ${attempt}`)
    }
    if (response.status === 403) {
      throw new RateLimitError(`Access forbidden (likely bot detection) on attempt ${attempt}`)
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}

class ScraperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScraperError'
  }
}

// ---------------------------------------------------------------------------
// Core scraper
// ---------------------------------------------------------------------------

/**
 * Scrape an Airbnb listing URL and return structured ListingData.
 *
 * @param url - Public Airbnb listing URL
 * @returns ScraperResult with success/failure and structured data
 */
export async function scrapeAirbnbListing(url: string): Promise<ScraperResult> {
  // --- Validate URL ---
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'URL is required' }
  }

  const isAirbnb =
    url.includes('airbnb.com/rooms/') ||
    url.includes('airbnb.com/h/') ||
    url.includes('airbnb.co.uk/rooms/') ||
    url.includes('airbnb.ca/rooms/')

  if (!isAirbnb) {
    return {
      success: false,
      error: 'URL must be an Airbnb listing URL (airbnb.com/rooms/... or airbnb.com/h/...)',
    }
  }

  const normalisedUrl = normaliseUrl(url)
  let lastError: Error | null = null

  // --- Retry loop ---
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const delay = RETRY_DELAY_MS * attempt
        console.log(`[scraper] Retrying in ${delay}ms (attempt ${attempt}/${MAX_RETRIES})...`)
        await sleep(delay)
      }

      console.log(`[scraper] Fetching: ${normalisedUrl} (attempt ${attempt})`)
      const html = await fetchPage(normalisedUrl, attempt)

      if (!html || html.length < 1000) {
        throw new ScraperError('Response too short — likely blocked or empty page')
      }

      console.log(`[scraper] Fetched ${html.length} bytes. Parsing...`)

      // --- Parse HTML ---
      const $ = cheerio.load(html)

      // --- Extract from JSON (primary) ---
      const inlineJson = extractInlineJson($)
      const jsonData = inlineJson ? extractFromJson(inlineJson) : {}

      // --- Extract from HTML (fallback) ---
      const htmlData = extractFromHtml($)

      // --- Merge ---
      const listing = mergePartials(jsonData, htmlData, normalisedUrl)

      // Sanity check — we need at least a title to consider this a success
      if (!listing.title && !listing.description) {
        throw new ScraperError(
          'Could not extract listing data — Airbnb may have changed their page structure or blocked the request'
        )
      }

      console.log(`[scraper] Extracted listing: "${listing.title}" (${normalisedUrl})`)
      console.log(`[scraper] Photos: ${listing.photos.length}, Amenities: ${listing.amenities.length}`)

      // --- Persist to Supabase ---
      try {
        await persistListing(listing)
        console.log(`[scraper] Persisted listing to Supabase`)
      } catch (dbErr) {
        // Non-fatal — return data even if DB write fails
        console.error('[scraper] DB persistence failed (non-fatal):', dbErr)
      }

      return { success: true, data: listing }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (err instanceof RateLimitError) {
        console.warn(`[scraper] Rate limit detected: ${err.message}`)
        // Don't retry rate limit on last attempt
        if (attempt === MAX_RETRIES) break
        continue
      }

      console.error(`[scraper] Attempt ${attempt} failed:`, lastError.message)

      if (attempt === MAX_RETRIES) break
    }
  }

  // All retries exhausted
  const errorMsg = lastError?.message ?? 'Unknown scraper error'
  console.error(`[scraper] All ${MAX_RETRIES} attempts failed. Last error:`, errorMsg)

  return {
    success: false,
    error: errorMsg,
  }
}
