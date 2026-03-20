/**
 * Listing scorer for the onboard pipeline.
 * Produces a 0-100 score and per-dimension breakdown.
 * Issue #171
 */

import type { ScrapedProperty, AuditScore, ScoreBreakdown } from './types'

// ---------------------------------------------------------------------------
// Scoring dimension weights — must sum to 100
// ---------------------------------------------------------------------------

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  title: 15,
  description: 20,
  photos: 25,
  amenities: 15,
  reviews: 10,
  pricing: 5,
  response_rate: 5,
  instant_book: 5,
}

// Sanity check at module load time (dev only)
const weightSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
if (weightSum !== 100) {
  console.warn(`[scorer] WEIGHTS sum to ${weightSum}, not 100`)
}

// ---------------------------------------------------------------------------
// Individual dimension scorers — each returns 0–1
// ---------------------------------------------------------------------------

function scoreTitle(property: ScrapedProperty): number {
  const t = (property.title ?? '').trim()
  if (!t || t === 'Unknown Listing') return 0

  let score = 0.3 // has a title at all

  // Length: 40-80 chars is optimal for Airbnb
  const len = t.length
  if (len >= 40 && len <= 80) score += 0.5
  else if (len >= 25 && len < 40) score += 0.3
  else if (len > 80 && len <= 100) score += 0.3
  else if (len > 10) score += 0.1

  // Contains a key differentiator (cabin, ocean, pool, view, etc.)
  const differentiators = [
    'ocean', 'lake', 'mountain', 'view', 'pool', 'hot tub', 'cabin',
    'cottage', 'villa', 'loft', 'studio', 'beach', 'downtown', 'historic',
    'modern', 'luxury', 'cozy', 'private',
  ]
  if (differentiators.some((d) => t.toLowerCase().includes(d))) score += 0.2

  return Math.min(1, score)
}

function scoreDescription(property: ScrapedProperty): number {
  const d = (property.description ?? '').trim()
  if (!d) return 0

  let score = 0.2 // has any description

  // Length bands
  const len = d.length
  if (len >= 800) score += 0.5
  else if (len >= 400) score += 0.3
  else if (len >= 150) score += 0.15

  // Mentions key guest concerns
  const keywords = [
    'wifi', 'parking', 'kitchen', 'bedroom', 'bathroom', 'checkout',
    'checkin', 'check-in', 'check-out', 'self', 'contact', 'host',
  ]
  const hits = keywords.filter((k) => d.toLowerCase().includes(k)).length
  score += Math.min(0.3, hits * 0.05)

  return Math.min(1, score)
}

function scorePhotos(property: ScrapedProperty): number {
  const count = property.photos?.length ?? 0
  if (count === 0) return 0
  if (count >= 30) return 1.0
  if (count >= 20) return 0.85
  if (count >= 15) return 0.7
  if (count >= 10) return 0.55
  if (count >= 5) return 0.35
  return 0.15
}

function scoreAmenities(property: ScrapedProperty): number {
  const count = property.amenities?.length ?? 0
  if (count === 0) return 0
  // Scale: 20+ amenities is great, 10 is okay, fewer is weak
  if (count >= 20) return 1.0
  if (count >= 15) return 0.8
  if (count >= 10) return 0.6
  if (count >= 5) return 0.35
  return 0.15
}

function scoreReviews(property: ScrapedProperty): number {
  const rating = property.rating ?? 0
  const count = property.review_count ?? 0

  if (count === 0) return 0 // no reviews is a major gap

  let score = 0
  // Rating component (60% of dimension)
  if (rating >= 4.9) score += 0.6
  else if (rating >= 4.7) score += 0.5
  else if (rating >= 4.5) score += 0.35
  else if (rating >= 4.0) score += 0.2
  else score += 0.05

  // Volume component (40% of dimension)
  if (count >= 100) score += 0.4
  else if (count >= 50) score += 0.3
  else if (count >= 20) score += 0.2
  else if (count >= 5) score += 0.1

  return Math.min(1, score)
}

function scorePricing(property: ScrapedProperty): number {
  // We can't know market rates, but we can flag if price is absent
  if (!property.price_per_night || property.price_per_night <= 0) return 0.3
  return 0.8 // Has a price — assume reasonably set (no competitor data yet)
}

function scoreResponseRate(property: ScrapedProperty): number {
  // We don't always have response rate from the public page.
  // Superhost is a reasonable proxy (requires 90%+ response rate).
  if (property.superhost) return 1.0
  return 0.4 // Unknown → penalize mildly
}

function scoreInstantBook(property: ScrapedProperty): number {
  return property.instant_book ? 1.0 : 0.0
}

// ---------------------------------------------------------------------------
// Flag generation
// ---------------------------------------------------------------------------

function generateFlags(property: ScrapedProperty, raw: ScoreBreakdown): string[] {
  const flags: string[] = []

  if (raw.title < 0.5) flags.push('Title is too short or generic — add a standout feature')
  if (raw.description < 0.4) flags.push('Description needs more detail — aim for 400+ characters')
  if (raw.photos < 0.55) flags.push('More photos needed — aim for 20+ high-quality images')
  if (raw.amenities < 0.4) flags.push('List more amenities — guests filter heavily on these')
  if (raw.reviews < 0.3) {
    if (!property.review_count) flags.push('No reviews yet — actively ask early guests to review')
    else flags.push('Review rating below 4.5 — respond to all reviews and improve guest experience')
  }
  if (!property.instant_book) flags.push('Enable Instant Book — it significantly boosts search ranking')
  if (!property.superhost) flags.push('Work toward Superhost status — improves visibility and trust')

  return flags
}

// ---------------------------------------------------------------------------
// Grade helper
// ---------------------------------------------------------------------------

function gradeFromPct(pct: number): AuditScore['grade'] {
  if (pct >= 90) return 'A'
  if (pct >= 75) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 45) return 'D'
  return 'F'
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function scoreProperty(property: ScrapedProperty): AuditScore {
  const rawDimensions: ScoreBreakdown = {
    title: scoreTitle(property),
    description: scoreDescription(property),
    photos: scorePhotos(property),
    amenities: scoreAmenities(property),
    reviews: scoreReviews(property),
    pricing: scorePricing(property),
    response_rate: scoreResponseRate(property),
    instant_book: scoreInstantBook(property),
  }

  // Weighted total out of 100
  const total = Math.round(
    (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).reduce((sum, dim) => {
      return sum + rawDimensions[dim] * WEIGHTS[dim]
    }, 0)
  )

  const percentage = total // already 0-100 because weights sum to 100
  const grade = gradeFromPct(percentage)
  const flags = generateFlags(property, rawDimensions)

  // Convert raw 0-1 dimension scores to 0-100 for the breakdown
  const breakdown: ScoreBreakdown = {
    title: Math.round(rawDimensions.title * 100),
    description: Math.round(rawDimensions.description * 100),
    photos: Math.round(rawDimensions.photos * 100),
    amenities: Math.round(rawDimensions.amenities * 100),
    reviews: Math.round(rawDimensions.reviews * 100),
    pricing: Math.round(rawDimensions.pricing * 100),
    response_rate: Math.round(rawDimensions.response_rate * 100),
    instant_book: Math.round(rawDimensions.instant_book * 100),
  }

  return {
    total,
    max: 100,
    percentage,
    grade,
    breakdown,
    flags,
  }
}
