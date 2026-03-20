/**
 * Location and market metadata extractor for Airbnb listing pages.
 *
 * Extraction priority (highest confidence first):
 *   1. JSON-LD structured data embedded in <script type="application/ld+json">
 *   2. __NEXT_DATA__ / Redux bootstrap JSON (Airbnb's Next.js state)
 *   3. HTML heuristics (meta tags, breadcrumbs, visible text patterns)
 *
 * This module is purely additive — it receives a parsed Cheerio root and
 * raw HTML string, and returns structured location fields. It does not
 * touch any existing scraper logic.
 */

import type { CheerioAPI } from 'cheerio'

export interface LocationMetadata {
  lat: number | null
  lng: number | null
  city: string | null
  neighborhood: string | null
  state: string | null
  bedroom_count: number | null
  max_guests: number | null
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function extractLocationMetadata(
  $: CheerioAPI,
  rawHtml: string
): LocationMetadata {
  const result: LocationMetadata = {
    lat: null,
    lng: null,
    city: null,
    neighborhood: null,
    state: null,
    bedroom_count: null,
    max_guests: null,
  }

  // Strategy 1: JSON-LD
  applyJsonLd($, result)

  // Strategy 2: __NEXT_DATA__ bootstrap JSON
  if (needsMoreData(result)) {
    applyNextData(rawHtml, result)
  }

  // Strategy 3: HTML heuristics (fills any remaining gaps)
  if (needsMoreData(result)) {
    applyHtmlHeuristics($, result)
  }

  return result
}

// ---------------------------------------------------------------------------
// Strategy 1: JSON-LD
// ---------------------------------------------------------------------------

function applyJsonLd($: CheerioAPI, result: LocationMetadata): void {
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || ''
      const json = JSON.parse(raw)
      const schemas = Array.isArray(json) ? json : [json]

      for (const schema of schemas) {
        applySchemaObject(schema, result)
      }
    } catch {
      // Malformed JSON-LD — skip silently
    }
  })
}

function applySchemaObject(schema: Record<string, unknown>, result: LocationMetadata): void {
  // LodgingBusiness / VacationRental / Accommodation
  if (schema['@type'] && typeof schema['@type'] === 'string') {
    const type = schema['@type']
    if (
      type === 'LodgingBusiness' ||
      type === 'VacationRental' ||
      type === 'Accommodation' ||
      type === 'House' ||
      type === 'Apartment'
    ) {
      const address = schema['address'] as Record<string, unknown> | undefined
      if (address) {
        if (!result.city && typeof address['addressLocality'] === 'string') {
          result.city = clean(address['addressLocality'])
        }
        if (!result.state && typeof address['addressRegion'] === 'string') {
          result.state = clean(address['addressRegion'])
        }
        if (!result.neighborhood && typeof address['streetAddress'] === 'string') {
          // Sometimes the neighborhood is encoded in streetAddress when full address isn't shown
          const street = address['streetAddress'] as string
          if (!street.match(/^\d/)) {
            // Doesn't look like a street number — likely a neighborhood name
            result.neighborhood = clean(street)
          }
        }
      }

      const geo = schema['geo'] as Record<string, unknown> | undefined
      if (geo) {
        if (result.lat === null && typeof geo['latitude'] === 'number') {
          result.lat = geo['latitude']
        }
        if (result.lat === null && typeof geo['latitude'] === 'string') {
          const v = parseFloat(geo['latitude'])
          if (!isNaN(v)) result.lat = v
        }
        if (result.lng === null && typeof geo['longitude'] === 'number') {
          result.lng = geo['longitude']
        }
        if (result.lng === null && typeof geo['longitude'] === 'string') {
          const v = parseFloat(geo['longitude'])
          if (!isNaN(v)) result.lng = v
        }
      }

      // numberOfRooms → bedroom_count
      if (result.bedroom_count === null && schema['numberOfRooms'] !== undefined) {
        const n = parseInt(String(schema['numberOfRooms']), 10)
        if (!isNaN(n)) result.bedroom_count = n
      }

      // occupancy → max_guests
      const occupancy = schema['occupancy'] as Record<string, unknown> | undefined
      if (result.max_guests === null && occupancy?.['maxOccupancy'] !== undefined) {
        const n = parseInt(String(occupancy['maxOccupancy']), 10)
        if (!isNaN(n)) result.max_guests = n
      }
    }
  }

  // Recurse into @graph arrays
  if (Array.isArray(schema['@graph'])) {
    for (const node of schema['@graph'] as Record<string, unknown>[]) {
      applySchemaObject(node, result)
    }
  }
}

// ---------------------------------------------------------------------------
// Strategy 2: __NEXT_DATA__ (Airbnb's Next.js serialised store)
// ---------------------------------------------------------------------------

function applyNextData(rawHtml: string, result: LocationMetadata): void {
  try {
    const match = rawHtml.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (!match) return

    const nextData = JSON.parse(match[1])

    // Walk the deeply nested Airbnb state tree looking for location/section keys
    walkObject(nextData, result)
  } catch {
    // Malformed or absent — skip
  }
}

/**
 * Recursively walk any JSON object, pulling out known Airbnb field names.
 * Airbnb's schema changes frequently; this is intentionally broad to be resilient.
 */
function walkObject(obj: unknown, result: LocationMetadata, depth = 0): void {
  if (depth > 12 || obj === null || typeof obj !== 'object') return

  const o = obj as Record<string, unknown>

  // Coordinates
  if (result.lat === null) {
    if (typeof o['lat'] === 'number') result.lat = o['lat']
    else if (typeof o['latitude'] === 'number') result.lat = o['latitude']
    else if (typeof o['lat'] === 'string') {
      const v = parseFloat(o['lat'])
      if (!isNaN(v)) result.lat = v
    }
  }

  if (result.lng === null) {
    for (const key of ['lng', 'lon', 'longitude']) {
      if (typeof o[key] === 'number') { result.lng = o[key] as number; break }
      if (typeof o[key] === 'string') {
        const v = parseFloat(o[key] as string)
        if (!isNaN(v)) { result.lng = v; break }
      }
    }
  }

  // City
  if (!result.city) {
    for (const key of ['city', 'cityName', 'localizedCityName']) {
      if (typeof o[key] === 'string' && (o[key] as string).length > 1) {
        result.city = clean(o[key] as string)
        break
      }
    }
  }

  // State / region
  if (!result.state) {
    for (const key of ['state', 'stateCode', 'province', 'region', 'stateName']) {
      if (typeof o[key] === 'string' && (o[key] as string).length > 1) {
        result.state = clean(o[key] as string)
        break
      }
    }
  }

  // Neighborhood
  if (!result.neighborhood) {
    for (const key of ['neighborhood', 'neighbourhoodName', 'localizedNeighborhood', 'pdpContext']) {
      if (typeof o[key] === 'string' && (o[key] as string).length > 1) {
        result.neighborhood = clean(o[key] as string)
        break
      }
    }
  }

  // Bedroom count
  if (result.bedroom_count === null) {
    for (const key of ['bedrooms', 'bedroomCount', 'bedroom_count', 'numBedrooms']) {
      if (typeof o[key] === 'number') { result.bedroom_count = o[key] as number; break }
      if (typeof o[key] === 'string') {
        const n = parseInt(o[key] as string, 10)
        if (!isNaN(n)) { result.bedroom_count = n; break }
      }
    }
  }

  // Max guests
  if (result.max_guests === null) {
    for (const key of ['personCapacity', 'guestCapacity', 'maxGuests', 'maxOccupancy', 'guests']) {
      if (typeof o[key] === 'number' && (o[key] as number) > 0) {
        result.max_guests = o[key] as number
        break
      }
      if (typeof o[key] === 'string') {
        const n = parseInt(o[key] as string, 10)
        if (!isNaN(n) && n > 0) { result.max_guests = n; break }
      }
    }
  }

  // Recurse into arrays and child objects
  for (const val of Object.values(o)) {
    if (Array.isArray(val)) {
      for (const item of val) walkObject(item, result, depth + 1)
    } else if (val !== null && typeof val === 'object') {
      walkObject(val, result, depth + 1)
    }
  }
}

// ---------------------------------------------------------------------------
// Strategy 3: HTML heuristics
// ---------------------------------------------------------------------------

function applyHtmlHeuristics($: CheerioAPI, result: LocationMetadata): void {
  // --- Bedroom count from visible text ---
  if (result.bedroom_count === null) {
    $('*').each((_, el) => {
      const text = $(el).text()
      const m = text.match(/(\d+)\s+bedroom/i)
      if (m) {
        const n = parseInt(m[1], 10)
        if (!isNaN(n) && n > 0 && n < 50) {
          result.bedroom_count = n
          return false // break
        }
      }
    })
  }

  // Studio = 0 bedrooms (Airbnb sometimes labels it this way)
  if (result.bedroom_count === null) {
    const bodyText = $('body').text()
    if (/\bstudio\b/i.test(bodyText) && !/(\d+)\s+bedroom/i.test(bodyText)) {
      result.bedroom_count = 0
    }
  }

  // --- Max guests from visible text ---
  if (result.max_guests === null) {
    $('*').each((_, el) => {
      const text = $(el).text()
      const m = text.match(/(\d+)\s+(?:guest|guests)/i)
      if (m) {
        const n = parseInt(m[1], 10)
        if (!isNaN(n) && n > 0 && n < 100) {
          result.max_guests = n
          return false // break
        }
      }
    })
  }

  // --- Location from <title> or meta description ---
  // Airbnb title format: "{Title} · {Type} in {City}, {State} - Airbnb"
  if (!result.city) {
    const title = $('title').text()
    const m = title.match(/\bin\s+([^,·–\-]+),\s*([A-Z]{2})\b/)
    if (m) {
      result.city = clean(m[1])
      if (!result.state) result.state = clean(m[2])
    }
  }

  // Meta description often contains "City, State"
  if (!result.city) {
    const desc = $('meta[name="description"]').attr('content') || ''
    const m = desc.match(/\bin\s+([^,·–\-]+),\s*([A-Z]{2})\b/)
    if (m) {
      result.city = clean(m[1])
      if (!result.state) result.state = clean(m[2])
    }
  }

  // og:description / og:title
  if (!result.city) {
    const ogDesc = $('meta[property="og:description"]').attr('content') || ''
    const m = ogDesc.match(/\bin\s+([^,·–\-]+),\s*([A-Z]{2})\b/)
    if (m) {
      result.city = clean(m[1])
      if (!result.state) result.state = clean(m[2])
    }
  }

  // --- Coordinates from map embed URL in page ---
  if (result.lat === null) {
    const mapSrc =
      $('iframe[src*="maps"]').attr('src') ||
      $('img[src*="maps.google"]').attr('src') ||
      $('img[src*="staticmap"]').attr('src') ||
      ''

    if (mapSrc) {
      const centerM = mapSrc.match(/center=(-?\d+\.\d+),(-?\d+\.\d+)/)
      const qM = mapSrc.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/)
      const llM = mapSrc.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
      const match = centerM || qM || llM
      if (match) {
        result.lat = parseFloat(match[1])
        result.lng = parseFloat(match[2])
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function needsMoreData(result: LocationMetadata): boolean {
  return (
    result.lat === null ||
    result.city === null ||
    result.bedroom_count === null ||
    result.max_guests === null
  )
}

function clean(s: string): string {
  return s.trim().replace(/\s+/g, ' ')
}
