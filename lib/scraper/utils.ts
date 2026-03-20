import type { ScrapeError, PhotoData } from '../../contracts/listing.schema'

/**
 * Build a structured error result (never throws).
 */
export function makeError(
  errorCode: ScrapeError['errorCode'],
  url: string,
  message: string
): ScrapeError {
  return {
    success: false,
    error: message,
    errorCode,
    url,
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * Safely parse an integer — returns 0 on failure.
 */
export function safeInt(value: unknown): number {
  if (typeof value === 'number') return Math.floor(value)
  const parsed = parseInt(String(value ?? ''), 10)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Safely parse a float — returns 0 on failure.
 */
export function safeFloat(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = parseFloat(String(value ?? ''))
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Extract a numeric listing ID from an Airbnb URL.
 * Handles both /rooms/12345 and /rooms/plus/12345 and query strings.
 */
export function extractAirbnbId(url: string): string | undefined {
  const match = url.match(/\/rooms\/(?:plus\/)?(\d+)/)
  return match?.[1]
}

/**
 * Extract a numeric listing ID from a Vrbo URL.
 * Handles /123456 and /123456.vrbo
 */
export function extractVrboId(url: string): string | undefined {
  const match = url.match(/vrbo\.com\/(\d+)/)
  return match?.[1]
}

/**
 * Deduplicate photo URLs and map to PhotoData shape.
 */
export function normalisePhotos(urls: string[]): PhotoData[] {
  const seen = new Set<string>()
  return urls
    .filter((u) => {
      if (!u || seen.has(u)) return false
      seen.add(u)
      return true
    })
    .map((url, i) => ({ url, sortOrder: i }))
}

/**
 * Strip redundant whitespace and newlines from a block of text.
 */
export function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Determine if a string looks like a valid https URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Airbnb URL validation — must contain /rooms/ or /h/ path segment.
 */
export function isValidAirbnbUrl(url: string): boolean {
  if (!isValidUrl(url)) return false
  return url.includes('airbnb.com/rooms/') || url.includes('airbnb.com/h/')
}

/**
 * Vrbo URL validation.
 */
export function isValidVrboUrl(url: string): boolean {
  if (!isValidUrl(url)) return false
  return url.includes('vrbo.com/') || url.includes('homeaway.com/')
}
