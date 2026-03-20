/**
 * Extended listing scraper that layers location metadata extraction
 * on top of the existing scrapeAirbnbListing function.
 *
 * ADDITIVE ONLY — this file imports and calls the existing scraper,
 * then enriches its output with location fields. The original scraper
 * is not modified.
 *
 * Usage:
 *   import { scrapeListingWithLocation } from '@/lib/scraper/listing-with-location'
 *   const data = await scrapeListingWithLocation('https://airbnb.com/rooms/12345')
 */

import * as cheerio from 'cheerio'
import { extractLocationMetadata, type LocationMetadata } from './location-extractor'
import { geocodeLocation, buildGeocodingQuery } from './geocoding'

// The shape returned by the existing scraper (from app/api/onboarding/scrape-listing/route.ts context)
export interface EnrichedListingData {
  // Original fields (pass-through from existing scraper)
  url: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: { text: string; rating: number; date: string }[]
  rating: number
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number
  platform: 'airbnb' | 'vrbo'

  // New location metadata fields (Issue #151)
  lat: number | null
  lng: number | null
  city: string | null
  neighborhood: string | null
  state: string | null
  bedroom_count: number | null
  max_guests: number | null
}

/**
 * Fetch and parse location metadata from a raw HTML string.
 * This is the core extraction function — useful for testing without a live fetch.
 */
export async function extractLocationFromHtml(
  html: string
): Promise<LocationMetadata> {
  const $ = cheerio.load(html)
  const metadata = extractLocationMetadata($, html)

  // Geocoding fallback: if we have city/state but no coordinates
  if (metadata.lat === null && (metadata.city || metadata.neighborhood)) {
    const query = buildGeocodingQuery(metadata.neighborhood, metadata.city, metadata.state)
    if (query) {
      console.log(`[location] Falling back to Nominatim geocoding for: "${query}"`)
      const geo = await geocodeLocation(query)
      if (geo) {
        metadata.lat = geo.lat
        metadata.lng = geo.lng
        console.log(`[location] Geocoded "${query}" → ${geo.lat}, ${geo.lng}`)
      }
    }
  }

  return metadata
}

/**
 * Fetch a listing URL and extract all location metadata.
 * Returns null coordinates if extraction and geocoding both fail.
 */
export async function fetchAndExtractLocation(
  url: string
): Promise<LocationMetadata> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch listing page: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  return extractLocationFromHtml(html)
}

/**
 * Merge location metadata into an existing listing data object.
 * Existing fields are not overwritten — location fields are added alongside them.
 */
export function mergeLocationIntoListing<T extends Record<string, unknown>>(
  listing: T,
  location: LocationMetadata
): T & LocationMetadata {
  return {
    ...listing,
    lat: location.lat,
    lng: location.lng,
    city: location.city,
    neighborhood: location.neighborhood,
    state: location.state,
    bedroom_count: location.bedroom_count,
    max_guests: location.max_guests,
  }
}
