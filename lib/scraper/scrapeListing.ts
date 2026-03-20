/**
 * Auto-routing entry point — detects platform from URL and delegates.
 */

import type { ScrapeResult } from '../../contracts/listing.schema'
import { scrapeAirbnbListing } from './scrapeAirbnbListing'
import { scrapeVrboListing } from './scrapeVrboListing'
import { makeError } from './utils'

export async function scrapeListing(url: string): Promise<ScrapeResult> {
  if (!url || typeof url !== 'string') {
    return makeError('INVALID_URL', url ?? '', 'URL must be a non-empty string')
  }

  const trimmed = url.trim()

  if (trimmed.includes('airbnb.com')) {
    return scrapeAirbnbListing(trimmed)
  }

  if (trimmed.includes('vrbo.com') || trimmed.includes('homeaway.com')) {
    return scrapeVrboListing(trimmed)
  }

  return makeError(
    'INVALID_URL',
    trimmed,
    'URL must be a valid Airbnb (airbnb.com) or Vrbo (vrbo.com) listing URL'
  )
}
