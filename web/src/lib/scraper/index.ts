/**
 * Scraper module entry point.
 *
 * Exports the extended scraper that includes location metadata extraction.
 * This is a NEW file — it does not modify the existing scraper at app/api/onboarding/scrape-listing/route.ts
 */

export { extractLocationFromHtml, fetchAndExtractLocation, mergeLocationIntoListing } from './listing-with-location'
export { extractLocationMetadata } from './location-extractor'
export { geocodeLocation, buildGeocodingQuery } from './geocoding'
export type { LocationMetadata } from './location-extractor'
export type { EnrichedListingData } from './listing-with-location'
