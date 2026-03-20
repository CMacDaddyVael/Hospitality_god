/**
 * Type definitions (as JSDoc) for the competitive intelligence pipeline.
 * Shared across scraper, analyzer, and pipeline modules.
 */

/**
 * @typedef {Object} CompetitorListing
 * @property {string} listingId         - Airbnb listing ID
 * @property {string} listingUrl        - Full public URL
 * @property {string} title             - Listing title
 * @property {number|null} nightlyPrice - Price per night in USD
 * @property {number|null} reviewCount  - Total number of reviews
 * @property {number|null} reviewScore  - Average rating (e.g. 4.85)
 * @property {number} photoCount        - Number of listing photos
 * @property {string[]} topAmenities    - Up to 5 key amenities
 * @property {number|null} bedroomCount - Number of bedrooms
 * @property {string} location          - City/area string
 * @property {string} scrapedAt         - ISO timestamp
 */

/**
 * @typedef {Object} OwnerListingSnapshot
 * @property {string} listingId
 * @property {string} title
 * @property {string} location
 * @property {number} bedroomCount
 * @property {number|null} nightlyPrice
 * @property {number|null} reviewCount
 * @property {number|null} reviewScore
 * @property {number} photoCount
 * @property {string[]} amenities
 */

/**
 * @typedef {Object} ClaudeCompetitiveOutput
 * @property {string[]} owner_strengths        - Areas where owner is winning
 * @property {string[]} owner_gaps             - Areas where owner is losing
 * @property {string[]} competitor_advantages  - Key advantages competitors hold
 * @property {ActionItem[]} recommended_actions - Max 3 specific, actionable steps
 * @property {string} summary                  - 2-3 sentence executive summary
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} action      - Short title (e.g. "Reduce nightly price by 8%")
 * @property {string} rationale   - Why this matters based on competitor data
 * @property {string} copy        - Copy-pasteable implementation text or instructions
 * @property {string} priority    - 'high' | 'medium' | 'low'
 */

export {};
