/**
 * Shared types for the onboard pipeline.
 * Issue #171
 */

export interface OnboardRequest {
  airbnb_url: string
  email: string
}

export interface ScrapedProperty {
  airbnb_url: string
  canonical_url: string
  title: string
  description: string
  property_type: string
  location: string
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  bedrooms: number | null
  bathrooms: number | null
  max_guests: number | null
  amenities: string[]
  photos: string[]
  rating: number | null
  review_count: number | null
  price_per_night: number | null
  host_name: string | null
  host_since: string | null
  superhost: boolean
  instant_book: boolean
  raw_html_length: number
}

export interface ScoreBreakdown {
  title: number
  description: number
  photos: number
  amenities: number
  reviews: number
  pricing: number
  response_rate: number
  instant_book: number
}

export interface AuditScore {
  total: number
  max: number
  percentage: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: ScoreBreakdown
  flags: string[]
}

export interface OnboardResult {
  audit_id: string
  property_id: string
  score: number
  score_breakdown: ScoreBreakdown
}

export interface ScrapeError {
  code: 'blocked' | 'not_found' | 'rate_limited' | 'parse_error' | 'invalid_url' | 'timeout'
  message: string
  status?: number
}

export type ScrapeResult =
  | { ok: true; property: ScrapedProperty }
  | { ok: false; error: ScrapeError }
