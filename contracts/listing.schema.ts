/**
 * Canonical listing schema — Issue #78 / #105
 * All scrapers must return data conforming to this shape.
 */

export type PhotoData = {
  url: string
  caption?: string
  sortOrder: number
}

export type HostInfo = {
  name: string
  avatarUrl?: string
  isSuperhost: boolean
  responseRate?: string // e.g. "98%"
  responseTime?: string // e.g. "within an hour"
  memberSince?: string // e.g. "2019"
  totalReviews?: number
}

export type ReviewSummary = {
  count: number
  averageRating: number // 0–5
  accuracy?: number
  cleanliness?: number
  checkIn?: number
  communication?: number
  location?: number
  value?: number
}

export type PricingData = {
  nightlyRate?: number // USD
  currency: string // ISO 4217, e.g. "USD"
  cleaningFee?: number
  serviceFee?: number
  displayPrice?: string // raw string, e.g. "$142 / night"
}

export type PropertyDetails = {
  maxGuests: number
  bedrooms: number
  beds: number
  bathrooms: number
  propertyType: string // e.g. "Entire cabin", "Private room"
}

export type ListingData = {
  // Identity
  platform: 'airbnb' | 'vrbo' | 'unknown'
  url: string
  listingId?: string

  // Core content
  title: string
  description: string
  photos: PhotoData[]
  photoCount: number

  // Property details
  propertyDetails: PropertyDetails

  // Amenities
  amenities: string[]

  // Pricing
  pricing: PricingData

  // Host
  host: HostInfo

  // Reviews
  reviews: ReviewSummary

  // Location
  locationLabel?: string // e.g. "Asheville, North Carolina"
  latitude?: number
  longitude?: number

  // Meta
  scrapedAt: string // ISO 8601
  scrapeDurationMs: number
}

export type ScrapeError = {
  success: false
  error: string
  errorCode:
    | 'INVALID_URL'
    | 'BLOCKED'
    | 'TIMEOUT'
    | 'NO_DATA'
    | 'PARSE_ERROR'
    | 'NETWORK_ERROR'
    | 'UNKNOWN'
  url: string
  scrapedAt: string
}

export type ScrapeResult =
  | ({ success: true } & ListingData)
  | ScrapeError
