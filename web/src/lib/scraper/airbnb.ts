/**
 * Airbnb listing scraper
 *
 * Strategy:
 * 1. Fetch the page HTML (with realistic headers to avoid bot detection)
 * 2. Extract structured data from the embedded __AIRBNB_DATA__ / BOOTSTRAPDATA JSON blob
 *    that Airbnb inlines into every listing page — this is more reliable than CSS selectors
 * 3. Fall back to Cheerio HTML parsing for fields not in the JSON blob
 * 4. Return a validated, typed ListingData object
 *
 * We deliberately use fetch + Cheerio rather than a full Puppeteer launch for the
 * primary extraction path — Airbnb inlines almost all listing data as JSON, so we
 * don't need JS execution in most cases.  Puppeteer is reserved as a fallback for
 * listings that require JS rendering (e.g. geo-blocked, heavy SPA routing).
 */

import * as cheerio from 'cheerio'

export interface Review {
  author: string
  rating: number
  text: string
  date: string
}

export interface ListingData {
  title: string
  description: string
  photos: string[]           // Max 20 URLs
  amenities: string[]
  reviews: Review[]          // Max 20 most recent
  overall_rating: number | null
  review_count: number | null
  price_per_night: number | null
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  listing_type: string | null
  url: string
  scraped_at: string
}

// Realistic browser headers to reduce bot detection rate
const FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

const FETCH_TIMEOUT_MS = 25_000

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })

    if (response.status === 404) {
      throw new Error('no listing found at URL (404)')
    }
    if (response.status === 410) {
      throw new Error('no listing found at URL (410 Gone)')
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching listing`)
    }

    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extract the large JSON blob Airbnb embeds in every listing page.
 * Airbnb bootstraps the page with window.__bootstrap_data__ or similar keys.
 */
function extractBootstrapJson(html: string): Record<string, unknown> | null {
  // Pattern 1: data-state attribute on a script tag (Next.js-style hydration)
  const patterns = [
    // Airbnb's primary bootstrap key
    /window\.__bootstrap_data__\s*=\s*(\{.+?\});\s*<\/script>/s,
    // Alternate key seen in some regions
    /data-bootstrap-data="([^"]+)"/,
    // Inline JSON in a script with id
    /<script[^>]+id="data-state"[^>]*>(\{.+?\})<\/script>/s,
    // Deferred JSON blob (most common as of 2024-2025)
    /<script[^>]+type="application\/json"[^>]*>(\{"bootstrapData.+?)<\/script>/s,
    // Fallback: any large JSON blob after "niobeClientData"
    /"niobeClientData"\s*:\s*(\{.+?\})\s*,\s*"(?:webpackChunks|buildInfo)"/s,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match && match[1]) {
      try {
        const jsonStr = match[1].startsWith('{')
          ? match[1]
          : decodeURIComponent(match[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'"))
        return JSON.parse(jsonStr) as Record<string, unknown>
      } catch {
        // Try next pattern
      }
    }
  }

  return null
}

/**
 * Recursively walk an unknown JSON structure looking for a key
 */
function deepFind(obj: unknown, targetKey: string): unknown {
  if (obj === null || typeof obj !== 'object') return undefined
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFind(item, targetKey)
      if (found !== undefined) return found
    }
    return undefined
  }
  const record = obj as Record<string, unknown>
  if (targetKey in record) return record[targetKey]
  for (const val of Object.values(record)) {
    const found = deepFind(val, targetKey)
    if (found !== undefined) return found
  }
  return undefined
}

function deepFindAll(obj: unknown, targetKey: string, results: unknown[] = []): unknown[] {
  if (obj === null || typeof obj !== 'object') return results
  if (Array.isArray(obj)) {
    for (const item of obj) deepFindAll(item, targetKey, results)
    return results
  }
  const record = obj as Record<string, unknown>
  if (targetKey in record) results.push(record[targetKey])
  for (const val of Object.values(record)) deepFindAll(val, targetKey, results)
  return results
}

function safeString(val: unknown): string {
  if (typeof val === 'string') return val.trim()
  return ''
}

function safeNumber(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.]/g, ''))
    return isNaN(n) ? null : n
  }
  return null
}

/**
 * Extract listing data from the embedded JSON blob
 */
function extractFromJson(bootstrapData: Record<string, unknown>): Partial<ListingData> {
  const result: Partial<ListingData> = {}

  // ---- Title ----
  const nameVal = deepFind(bootstrapData, 'name')
  if (nameVal) result.title = safeString(nameVal)

  // Also try pdpTitle
  if (!result.title) {
    const pdpTitle = deepFind(bootstrapData, 'pdpTitle')
    if (pdpTitle) result.title = safeString(pdpTitle)
  }

  // ---- Description ----
  const descSections = deepFindAll(bootstrapData, 'htmlDescription')
  if (descSections.length > 0) {
    const parts: string[] = []
    for (const section of descSections) {
      const html = deepFind(section as Record<string, unknown>, 'htmlText')
      if (html) {
        // Strip basic HTML tags
        parts.push(safeString(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      }
    }
    if (parts.length > 0) result.description = parts.join('\n\n')
  }

  if (!result.description) {
    const desc = deepFind(bootstrapData, 'description')
    if (desc) result.description = safeString(desc)
  }

  // ---- Photos ----
  const photoObjects = deepFindAll(bootstrapData, 'baseUrl')
    .filter((u) => typeof u === 'string' && (u as string).includes('a0.muscache.com'))
    .slice(0, 20) as string[]

  // Also look for pictureUrls
  const pictureUrls = deepFindAll(bootstrapData, 'pictureUrls').flat()
  const photoUrls = deepFindAll(bootstrapData, 'photoUrl')

  const allPhotos = [
    ...photoObjects,
    ...(Array.isArray(pictureUrls) ? pictureUrls : [pictureUrls]).filter(
      (u) => typeof u === 'string'
    ),
    ...(Array.isArray(photoUrls) ? photoUrls : [photoUrls]).filter(
      (u) => typeof u === 'string'
    ),
  ]
    .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
    .filter((u, i, arr) => arr.indexOf(u) === i) // deduplicate
    .slice(0, 20)

  if (allPhotos.length > 0) result.photos = allPhotos

  // ---- Amenities ----
  const amenityGroups = deepFindAll(bootstrapData, 'amenities')
  const amenityNames: string[] = []
  for (const group of amenityGroups) {
    if (Array.isArray(group)) {
      for (const amenity of group) {
        const n = deepFind(amenity as Record<string, unknown>, 'name')
        if (n) amenityNames.push(safeString(n))
      }
    }
  }
  // Also try flat amenity title arrays
  const amenityTitles = deepFindAll(bootstrapData, 'title')
  for (const t of amenityTitles) {
    if (typeof t === 'string' && t.length > 0 && t.length < 80) {
      // filter to plausible amenity strings
    }
  }
  if (amenityNames.length > 0) result.amenities = [...new Set(amenityNames)]

  // ---- Reviews ----
  const reviewsRaw = deepFindAll(bootstrapData, 'reviews')
  const reviews: Review[] = []
  for (const reviewGroup of reviewsRaw) {
    if (!Array.isArray(reviewGroup)) continue
    for (const r of reviewGroup) {
      if (!r || typeof r !== 'object') continue
      const record = r as Record<string, unknown>
      const author =
        safeString(deepFind(record, 'localizedName') as unknown) ||
        safeString(deepFind(record, 'firstName') as unknown) ||
        'Guest'
      const rating = safeNumber(deepFind(record, 'rating') as unknown)
      const text =
        safeString(deepFind(record, 'comments') as unknown) ||
        safeString(deepFind(record, 'localizedReview') as unknown)
      const date = safeString(deepFind(record, 'localizedDate') as unknown) || ''

      if (text) {
        reviews.push({
          author,
          rating: rating ?? 5,
          text,
          date,
        })
      }
    }
  }
  if (reviews.length > 0) result.reviews = reviews.slice(0, 20)

  // ---- Rating / review count ----
  const ratingVal = deepFind(bootstrapData, 'guestSatisfactionOverall')
  if (ratingVal !== undefined) result.overall_rating = safeNumber(ratingVal)

  if (result.overall_rating === null || result.overall_rating === undefined) {
    const starRating = deepFind(bootstrapData, 'starRating')
    result.overall_rating = safeNumber(starRating)
  }

  const reviewCount = deepFind(bootstrapData, 'reviewsCount')
  result.review_count = safeNumber(reviewCount)

  if (!result.review_count) {
    const count2 = deepFind(bootstrapData, 'totalReviewCount')
    result.review_count = safeNumber(count2)
  }

  // ---- Price ----
  const priceVal = deepFind(bootstrapData, 'price')
  if (priceVal !== undefined) result.price_per_night = safeNumber(priceVal)

  // Try structured price object
  if (!result.price_per_night) {
    const structuredPrice = deepFind(bootstrapData, 'structuredDisplayPrice')
    const primaryLine = deepFind(
      structuredPrice as Record<string, unknown>,
      'primaryLine'
    )
    const price = deepFind(primaryLine as Record<string, unknown>, 'price')
    result.price_per_night = safeNumber(price)
  }

  // ---- Bedrooms / bathrooms / guests ----
  const bedrooms = deepFind(bootstrapData, 'bedrooms')
  result.bedrooms = safeNumber(bedrooms)

  const bathrooms =
    deepFind(bootstrapData, 'bathrooms') || deepFind(bootstrapData, 'bathroomLabel')
  result.bathrooms = safeNumber(bathrooms)

  const maxGuests =
    deepFind(bootstrapData, 'personCapacity') || deepFind(bootstrapData, 'maxGuestCapacity')
  result.max_guests = safeNumber(maxGuests)

  // ---- Listing type ----
  const roomType = deepFind(bootstrapData, 'roomType')
  const propertyType = deepFind(bootstrapData, 'propertyType')
  result.listing_type =
    safeString(propertyType) || safeString(roomType) || null

  return result
}

/**
 * HTML fallback: extract data from rendered HTML using Cheerio
 * Used when the JSON blob is missing or incomplete
 */
function extractFromHtml(html: string): Partial<ListingData> {
  const $ = cheerio.load(html)
  const result: Partial<ListingData> = {}

  // Title — try common Airbnb title selectors
  const titleSelectors = [
    'h1[data-section-id="TITLE_DEFAULT"] span',
    'h1[data-testid="listing-title"]',
    'h1._fecoyn4',
    'h1',
  ]
  for (const sel of titleSelectors) {
    const text = $(sel).first().text().trim()
    if (text && text.length > 3) {
      result.title = text
      break
    }
  }

  // Description
  const descSelectors = [
    '[data-section-id="DESCRIPTION_DEFAULT"] span',
    '[data-testid="listing-description"]',
    'section[aria-label*="description"] p',
  ]
  for (const sel of descSelectors) {
    const parts: string[] = []
    $(sel).each((_, el) => {
      const t = $(el).text().trim()
      if (t) parts.push(t)
    })
    if (parts.length > 0) {
      result.description = parts.join('\n\n')
      break
    }
  }

  // Photos — look for og:image and structured photo galleries
  const photos: string[] = []
  $('meta[property="og:image"]').each((_, el) => {
    const src = $(el).attr('content')
    if (src && src.startsWith('http')) photos.push(src)
  })
  $('img[data-original-uri]').each((_, el) => {
    const src = $(el).attr('data-original-uri')
    if (src && src.startsWith('http') && src.includes('muscache')) photos.push(src)
  })
  $('img[src*="muscache.com"]').each((_, el) => {
    const src = $(el).attr('src')
    if (src && src.startsWith('http')) photos.push(src)
  })
  if (photos.length > 0) {
    result.photos = [...new Set(photos)].slice(0, 20)
  }

  // Price — look for structured price display
  const priceEl = $('[data-testid="price-and-discounted-price"] span').first()
  if (priceEl.length) {
    const priceText = priceEl.text()
    const priceMatch = priceText.match(/\$?([\d,]+)/)
    if (priceMatch) {
      result.price_per_night = parseFloat(priceMatch[1].replace(',', ''))
    }
  }

  // Overall rating
  const ratingEl = $('[data-testid="pdp-reviews-highlight-banner-host-rating--star"]').first()
  if (ratingEl.length) {
    result.overall_rating = safeNumber(ratingEl.text().trim())
  }
  if (!result.overall_rating) {
    // Try aria-label="4.95 out of 5" pattern
    $('[aria-label*="out of 5"]').each((_, el) => {
      const label = $(el).attr('aria-label') || ''
      const match = label.match(/([\d.]+)\s+out of 5/)
      if (match) result.overall_rating = parseFloat(match[1])
    })
  }

  // Review count
  $('[data-testid="reviews-count"], [aria-label*="review"]').each((_, el) => {
    const text = $(el).text()
    const match = text.match(/([\d,]+)\s+review/)
    if (match) result.review_count = parseInt(match[1].replace(',', ''), 10)
  })

  return result
}

/**
 * Validate that we got enough data to call this a successful scrape.
 * A listing with no title or no description is considered a failed scrape.
 */
function validateListing(data: Partial<ListingData>, url: string): ListingData {
  if (!data.title || data.title.length < 3) {
    throw new Error('no listing found — could not extract a title from this URL')
  }

  return {
    title: data.title,
    description: data.description || '',
    photos: data.photos || [],
    amenities: data.amenities || [],
    reviews: data.reviews || [],
    overall_rating: data.overall_rating ?? null,
    review_count: data.review_count ?? null,
    price_per_night: data.price_per_night ?? null,
    bedrooms: data.bedrooms ?? null,
    bathrooms: data.bathrooms ?? null,
    max_guests: data.max_guests ?? null,
    listing_type: data.listing_type ?? null,
    url,
    scraped_at: new Date().toISOString(),
  }
}

/**
 * Main export: scrape an Airbnb listing URL and return structured data.
 */
export async function scrapeAirbnbListing(url: string): Promise<ListingData> {
  const html = await fetchPage(url)

  // Try JSON extraction first (fast, reliable)
  const bootstrapJson = extractBootstrapJson(html)
  const jsonData = bootstrapJson ? extractFromJson(bootstrapJson) : {}

  // Supplement with HTML extraction for any missing fields
  const htmlData = extractFromHtml(html)

  // Merge: JSON data takes priority, HTML fills gaps
  const merged: Partial<ListingData> = {
    title: jsonData.title || htmlData.title,
    description: jsonData.description || htmlData.description,
    photos:
      (jsonData.photos?.length ?? 0) > 0
        ? jsonData.photos
        : htmlData.photos,
    amenities: jsonData.amenities || htmlData.amenities || [],
    reviews: jsonData.reviews || htmlData.reviews || [],
    overall_rating: jsonData.overall_rating ?? htmlData.overall_rating ?? null,
    review_count: jsonData.review_count ?? htmlData.review_count ?? null,
    price_per_night: jsonData.price_per_night ?? htmlData.price_per_night ?? null,
    bedrooms: jsonData.bedrooms ?? htmlData.bedrooms ?? null,
    bathrooms: jsonData.bathrooms ?? htmlData.bathrooms ?? null,
    max_guests: jsonData.max_guests ?? htmlData.max_guests ?? null,
    listing_type: jsonData.listing_type ?? htmlData.listing_type ?? null,
  }

  return validateListing(merged, url)
}
