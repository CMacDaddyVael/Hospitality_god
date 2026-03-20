/**
 * Public scraper API — barrel export
 * Import from here, not from platform-specific modules.
 */

export { scrapeAirbnbListing } from './scrapeAirbnbListing'
export { scrapeVrboListing } from './scrapeVrboListing'
export { scrapeListing } from './scrapeListing'
export type { ScrapeResult, ListingData, ScrapeError } from '../../contracts/listing.schema'
