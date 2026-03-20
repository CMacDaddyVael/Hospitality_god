import * as cheerio from 'cheerio'
import type { ScrapedListing } from './types'

const SCRAPE_TIMEOUT_MS = 15_000

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
}

export async function scrapeListingForAudit(url: string): Promise<ScrapedListing> {
  const platform: 'airbnb' | 'vrbo' =
    url.includes('vrbo.com') || url.includes('homeaway.com') ? 'vrbo' : 'airbnb'

  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS)

    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (response.status === 403 || response.status === 429 || response.status === 503) {
      const err: any = new Error(
        `Airbnb blocked the request (HTTP ${response.status}). Try again or use a Vrbo URL.`
      )
      err.code = 'SCRAPER_BLOCKED'
      throw err
    }

    if (!response.ok) {
      const err: any = new Error(`Failed to fetch listing (HTTP ${response.status})`)
      err.code = 'SCRAPE_FAILED'
      throw err
    }

    html = await response.text()
  } catch (err: any) {
    if (err.code === 'SCRAPER_BLOCKED' || err.code === 'SCRAPE_FAILED') throw err
    if (err.name === 'AbortError') {
      const e: any = new Error('Scrape timed out — Airbnb took too long to respond.')
      e.code = 'SCRAPE_FAILED'
      throw e
    }
    const e: any = new Error(`Network error while fetching listing: ${err.message}`)
    e.code = 'SCRAPE_FAILED'
    throw e
  }

  return platform === 'airbnb'
    ? parseAirbnbHtml(html, url)
    : parseVrboHtml(html, url)
}

// ── Airbnb parser ─────────────────────────────────────────────────────────────

function parseAirbnbHtml(html: string, url: string): ScrapedListing {
  const $ = cheerio.load(html)

  // Airbnb embeds structured data in __NEXT_DATA__ / window.__data
  const jsonLdText = $('script[type="application/json"][data-state]').first().text()
  const nextDataText = $('script#__NEXT_DATA__').text()

  let structured: any = null
  for (const raw of [jsonLdText, nextDataText]) {
    if (!raw) continue
    try {
      structured = JSON.parse(raw)
      break
    } catch {
      // continue
    }
  }

  // Also try JSON-LD
  let jsonLd: any = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text())
      if (parsed['@type'] === 'LodgingBusiness' || parsed.name) {
        jsonLd = parsed
      }
    } catch {
      // continue
    }
  })

  // Extract title
  const title =
    jsonLd?.name ||
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'Untitled Listing'

  // Description
  const description =
    jsonLd?.description ||
    $('meta[property="og:description"]').attr('content') ||
    extractTextFromSelectors($, [
      '[data-section-id="DESCRIPTION_DEFAULT"] span',
      '[data-testid="listing-description"] span',
      '.description',
    ])

  // Photos
  const photos: string[] = []
  jsonLd?.photo?.forEach((p: any) => {
    if (p.url) photos.push(p.url)
  })
  if (photos.length === 0) {
    $('img[src*="a0.muscache.com"]').each((_, el) => {
      const src = $(el).attr('src')
      if (src && !photos.includes(src)) photos.push(src)
    })
    $('meta[property="og:image"]').each((_, el) => {
      const content = $(el).attr('content')
      if (content && !photos.includes(content)) photos.push(content)
    })
  }

  // Rating / reviews
  const ratingText =
    $('[data-testid="listing-star-rating"]').text() ||
    $('[aria-label*="stars"]').attr('aria-label') ||
    jsonLd?.aggregateRating?.ratingValue?.toString() ||
    ''
  const rating = parseFloat(ratingText) || null

  const reviewCountText =
    $('[data-testid="reviews-count"]').text() ||
    jsonLd?.aggregateRating?.reviewCount?.toString() ||
    ''
  const reviewCount = parseInt(reviewCountText.replace(/\D/g, '')) || 0

  // Amenities
  const amenities: string[] = []
  $('[data-testid="amenity-row"] span, [data-section-id="AMENITIES_DEFAULT"] li').each((_, el) => {
    const text = $(el).text().trim()
    if (text && !amenities.includes(text)) amenities.push(text)
  })
  if (amenities.length === 0) {
    $('div[data-section-id="AMENITIES_DEFAULT"]')
      .find('span')
      .each((_, el) => {
        const t = $(el).text().trim()
        if (t.length > 2 && t.length < 60 && !amenities.includes(t)) amenities.push(t)
      })
  }

  // Bedrooms / bathrooms / guests
  const summaryText =
    $('[data-testid="listing-summary"]').text() ||
    $('[data-section-id="OVERVIEW_DEFAULT"]').text() ||
    $('ol.lgx66tx').text() ||
    ''
  const bedroomsMatch = summaryText.match(/(\d+)\s+bedroom/i)
  const bathroomsMatch = summaryText.match(/(\d+(?:\.\d+)?)\s+bath/i)
  const guestsMatch = summaryText.match(/(\d+)\s+guest/i)

  // Price
  const priceText =
    $('[data-testid="price-per-night"]').text() ||
    $('[class*="price"]').first().text() ||
    ''
  const priceMatch = priceText.match(/\$?([\d,]+)/)
  const pricePerNight = priceMatch ? parseInt(priceMatch[1].replace(',', '')) : null

  // Host
  const hostName =
    $('[data-testid="host-profile-name"]').text().trim() ||
    $('[data-section-id="HOST_PROFILE_DEFAULT"] h2').text().trim() ||
    jsonLd?.author?.name ||
    'Host'

  const isSuperhostEl = $('[data-testid="host-badge"]').text().toLowerCase().includes('superhost')
  const superhostMeta = $('[aria-label*="Superhost"]').length > 0

  const responseRate =
    extractDetailValue($, 'Response rate') || extractDetailValue($, 'response rate')
  const responseTime =
    extractDetailValue($, 'Response time') || extractDetailValue($, 'response time')

  // Property type / location
  const propertyType =
    $('[data-section-id="OVERVIEW_DEFAULT"] h2').text().split('in')[0]?.trim() ||
    jsonLd?.['@type'] ||
    'Property'

  const locationMeta =
    $('meta[name="description"]').attr('content') ||
    $('[data-testid="listing-location"]').text() ||
    jsonLd?.address?.addressLocality ||
    ''

  // Highlights
  const highlights: string[] = []
  $('[data-section-id="HIGHLIGHTS_DEFAULT"] div').each((_, el) => {
    const t = $(el).text().trim()
    if (t.length > 5 && t.length < 120 && !highlights.includes(t)) highlights.push(t)
  })

  // House rules
  const houseRules: string[] = []
  $('[data-section-id="POLICIES_DEFAULT"] li, [data-section-id="HOUSE_RULES_DEFAULT"] li').each(
    (_, el) => {
      const t = $(el).text().trim()
      if (t && !houseRules.includes(t)) houseRules.push(t)
    }
  )

  return {
    url,
    platform: 'airbnb',
    title,
    description: description || '',
    photos: photos.slice(0, 30),
    amenities: amenities.slice(0, 50),
    bedrooms: bedroomsMatch ? parseInt(bedroomsMatch[1]) : null,
    bathrooms: bathroomsMatch ? parseFloat(bathroomsMatch[1]) : null,
    maxGuests: guestsMatch ? parseInt(guestsMatch[1]) : null,
    propertyType,
    location: extractLocation(locationMeta),
    rating,
    reviewCount,
    pricePerNight,
    host: {
      name: hostName,
      isSuperhost: isSuperhostEl || superhostMeta,
      responseRate,
      responseTime,
    },
    highlights: highlights.slice(0, 10),
    houseRules: houseRules.slice(0, 20),
    scrapedAt: new Date().toISOString(),
  }
}

// ── Vrbo parser ───────────────────────────────────────────────────────────────

function parseVrboHtml(html: string, url: string): ScrapedListing {
  const $ = cheerio.load(html)

  let jsonLd: any = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text())
      if (parsed.name || parsed['@type']) jsonLd = parsed
    } catch {
      // continue
    }
  })

  const title =
    jsonLd?.name || $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || 'Untitled Listing'

  const description =
    jsonLd?.description ||
    $('meta[property="og:description"]').attr('content') ||
    $('[data-testid="property-description"]').text().trim() ||
    ''

  const photos: string[] = []
  $('img[src*="res.cloudinary.com"], img[src*="vrbo.com"], img[src*="vacasa.com"]').each((_, el) => {
    const src = $(el).attr('src')
    if (src && !photos.includes(src)) photos.push(src)
  })
  jsonLd?.photo?.forEach((p: any) => {
    if (p.url && !photos.includes(p.url)) photos.push(p.url)
  })

  const ratingVal =
    jsonLd?.aggregateRating?.ratingValue ||
    parseFloat($('[data-testid="rating-score"]').text()) ||
    null
  const reviewCount =
    parseInt(jsonLd?.aggregateRating?.reviewCount) ||
    parseInt($('[data-testid="review-count"]').text().replace(/\D/g, '')) ||
    0

  const amenities: string[] = []
  $('[data-testid="amenity-item"]').each((_, el) => {
    const t = $(el).text().trim()
    if (t && !amenities.includes(t)) amenities.push(t)
  })

  return {
    url,
    platform: 'vrbo',
    title,
    description,
    photos: photos.slice(0, 30),
    amenities: amenities.slice(0, 50),
    bedrooms: parseInt(jsonLd?.numberOfRooms) || null,
    bathrooms: null,
    maxGuests: parseInt(jsonLd?.occupancy) || null,
    propertyType: jsonLd?.['@type'] || 'Property',
    location: jsonLd?.address?.addressLocality || extractLocation($('meta[name="description"]').attr('content') || ''),
    rating: ratingVal ? parseFloat(ratingVal) : null,
    reviewCount,
    pricePerNight: null,
    host: {
      name: jsonLd?.author?.name || 'Host',
      isSuperhost: false,
      responseRate: null,
      responseTime: null,
    },
    highlights: [],
    houseRules: [],
    scrapedAt: new Date().toISOString(),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTextFromSelectors($: cheerio.CheerioAPI, selectors: string[]): string {
  for (const sel of selectors) {
    const text = $(sel).first().text().trim()
    if (text) return text
  }
  return ''
}

function extractDetailValue($: cheerio.CheerioAPI, label: string): string | null {
  let result: string | null = null
  $('li, div').each((_, el) => {
    const text = $(el).text()
    if (text.toLowerCase().includes(label.toLowerCase())) {
      const match = text.match(new RegExp(`${label}[:\\s]+([\\w%\\s]+)`, 'i'))
      if (match) {
        result = match[1].trim()
        return false // break
      }
    }
  })
  return result
}

function extractLocation(text: string): string {
  if (!text) return ''
  // Try to pull "City, State" pattern
  const match = text.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/)?.[0]
  return match || text.slice(0, 80)
}
