/**
 * Nominatim (OpenStreetMap) geocoding fallback.
 *
 * Used when coordinates are not found in the listing page HTML.
 * Nominatim usage policy: max 1 request/second, must include a meaningful User-Agent.
 * https://operations.osmfoundation.org/policies/nominatim/
 *
 * This is a NEW file — it does not modify any existing scraper logic.
 */

export interface GeocodingResult {
  lat: number
  lng: number
  displayName: string
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'VAEL-Host/1.0 (https://vael.host; contact@vael.host)'

/**
 * Geocode a location string using Nominatim.
 * Returns null if no result is found or on error.
 *
 * @param location - Free-form location string, e.g. "Miami Beach, FL" or "Brooklyn, New York"
 */
export async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  if (!location || location.trim().length < 3) return null

  const url = new URL(NOMINATIM_BASE)
  url.searchParams.set('q', location.trim())
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn(`[geocoding] Nominatim returned ${res.status} for "${location}"`)
      return null
    }

    const data = (await res.json()) as NominatimResult[]

    if (!data || data.length === 0) {
      console.warn(`[geocoding] No results for "${location}"`)
      return null
    }

    const first = data[0]
    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)

    if (isNaN(lat) || isNaN(lng)) return null

    return {
      lat,
      lng,
      displayName: first.display_name,
    }
  } catch (err) {
    console.warn(`[geocoding] Nominatim request failed for "${location}":`, err)
    return null
  }
}

/**
 * Build a best-effort location query string from available parts.
 * More specific = better geocoding accuracy.
 */
export function buildGeocodingQuery(
  neighborhood: string | null,
  city: string | null,
  state: string | null
): string | null {
  const parts: string[] = []
  if (neighborhood) parts.push(neighborhood)
  if (city) parts.push(city)
  if (state) parts.push(state)
  if (parts.length === 0) return null
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    county?: string
    state?: string
    country?: string
  }
}
