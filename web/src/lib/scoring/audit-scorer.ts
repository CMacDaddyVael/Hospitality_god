/**
 * VAEL Host — Listing Audit Scoring Engine
 * Issue #106
 *
 * Deterministic rule-based scorer. Same input → same output, always.
 * No LLM calls. Runs in <1ms.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListingPhoto {
  url: string
  altText?: string
  caption?: string
}

export interface ListingReview {
  text: string
  rating: number
  date: string
  hostResponse?: string
}

export interface PricingData {
  pricePerNight: number
  cleaningFee?: number
  currency?: string
  /** Comparable listings in the same market, same bedroom count */
  marketAvgPricePerNight?: number
  /** 0–100, supplied by scraper if available */
  occupancyRate?: number
}

export interface ListingData {
  url: string
  title: string
  description: string
  photos: Array<string | ListingPhoto>
  amenities: string[]
  reviews: ListingReview[]
  rating?: number
  reviewCount?: number
  responseRate?: number   // 0–100
  propertyType?: string
  location?: string
  pricePerNight?: number
  pricing?: PricingData
  platform?: 'airbnb' | 'vrbo' | string
  bedrooms?: number
  bathrooms?: number
  maxGuests?: number
}

export type FlagKey =
  // Photos
  | 'fewer_than_10_photos'
  | 'fewer_than_15_photos'
  | 'fewer_than_20_photos'
  | 'no_outdoor_photos'
  | 'no_kitchen_photos'
  | 'no_bedroom_photos'
  | 'no_bathroom_photos'
  | 'no_living_room_photos'
  // Copy
  | 'title_under_30_chars'
  | 'title_under_50_chars'
  | 'title_over_100_chars'
  | 'description_under_100_words'
  | 'description_under_200_words'
  | 'description_under_400_words'
  | 'no_local_area_keywords'
  | 'no_amenity_callouts_in_description'
  | 'no_unique_selling_point'
  // Amenities
  | 'fewer_than_5_amenities'
  | 'fewer_than_10_amenities'
  | 'no_wifi'
  | 'no_parking'
  | 'no_kitchen_amenity'
  | 'no_washer_dryer'
  | 'no_ac_heating'
  | 'no_tv'
  // Reviews
  | 'rating_below_4_5'
  | 'rating_below_4_8'
  | 'fewer_than_5_reviews'
  | 'fewer_than_10_reviews'
  | 'fewer_than_20_reviews'
  | 'no_response_rate'
  | 'response_rate_below_90'
  | 'response_rate_below_75'
  // Pricing
  | 'no_pricing_data'
  | 'price_above_market_20pct'
  | 'price_above_market_10pct'
  | 'no_market_comparison'

export interface AuditFlag {
  key: FlagKey
  label: string
  /** Negative — how many raw category points this costs */
  penalty: number
  category: 'photos' | 'copy' | 'amenities' | 'reviews' | 'pricing'
}

export interface CategoryScore {
  score: number       // 0–100
  weight: number      // as a fraction of total score, e.g. 0.25
  flags: AuditFlag[]
  /** Max raw points before weighting */
  maxPoints: number
  /** Raw points earned before weighting */
  earnedPoints: number
}

export interface AuditScore {
  overall: number     // 0–100, weighted sum of category scores
  categories: {
    photos: CategoryScore
    copy: CategoryScore
    amenities: CategoryScore
    reviews: CategoryScore
    pricing: CategoryScore
  }
  /** Flat list of all fired flags across all categories — easy for UI to render */
  flags: AuditFlag[]
  /** ISO timestamp — for caching / cache-busting */
  scoredAt: string
}

// ---------------------------------------------------------------------------
// Category weights (must sum to 1.0)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  photos:    0.25,
  copy:      0.25,
  amenities: 0.20,
  reviews:   0.20,
  pricing:   0.10,
} as const

// ---------------------------------------------------------------------------
// Keyword lists
// ---------------------------------------------------------------------------

const OUTDOOR_KEYWORDS = [
  'outdoor', 'outside', 'exterior', 'backyard', 'back yard', 'patio', 'deck',
  'garden', 'yard', 'pool', 'hot tub', 'jacuzzi', 'balcony', 'terrace',
  'front porch', 'porch', 'fire pit', 'bbq', 'grill', 'lawn', 'view',
  'rooftop', 'courtyard',
]

const KITCHEN_KEYWORDS = [
  'kitchen', 'dining', 'cook', 'stove', 'oven', 'refrigerator', 'fridge',
  'microwave', 'counter', 'cabinet', 'pantry', 'breakfast', 'bar',
]

const BEDROOM_KEYWORDS = [
  'bedroom', 'bed', 'master', 'sleeping', 'guest room', 'suite', 'loft',
  'mattress', 'pillow', 'closet', 'wardrobe',
]

const BATHROOM_KEYWORDS = [
  'bathroom', 'bath', 'shower', 'toilet', 'tub', 'vanity', 'sink', 'ensuite',
  'half bath', 'powder room',
]

const LIVING_ROOM_KEYWORDS = [
  'living room', 'living area', 'lounge', 'sofa', 'couch', 'tv room',
  'common area', 'family room', 'great room', 'sitting room',
]

const LOCAL_AREA_KEYWORDS = [
  // Generic location descriptors that signal local specificity
  'walk', 'minutes', 'nearby', 'close to', 'steps from', 'blocks from',
  'downtown', 'neighborhood', 'district', 'beach', 'lake', 'mountain',
  'ski', 'hiking', 'trail', 'park', 'restaurant', 'shop', 'market',
  'airport', 'transit', 'bus', 'subway', 'train', 'station',
  'historic', 'arts', 'culture', 'local', 'area', 'town', 'city',
]

const AMENITY_MENTION_KEYWORDS = [
  'wifi', 'wi-fi', 'internet', 'parking', 'kitchen', 'washer', 'dryer',
  'laundry', 'pool', 'hot tub', 'jacuzzi', 'gym', 'fitness', 'workspace',
  'air conditioning', 'ac', 'heating', 'fireplace', 'grill', 'bbq',
  'netflix', 'streaming', 'smart tv', 'coffee', 'espresso',
]

const UNIQUE_SELLING_KEYWORDS = [
  'unique', 'one of a kind', 'stunning', 'breathtaking', 'spectacular',
  'panoramic', 'luxury', 'boutique', 'charming', 'cozy', 'romantic',
  'family-friendly', 'pet-friendly', 'secluded', 'private', 'exclusive',
  'architect', 'design', 'renovated', 'restored', 'historic', 'modern',
  'minimalist', 'rustic', 'boho', 'industrial', 'tropical', 'mountain',
  'beachfront', 'lakefront', 'ski-in', 'waterfront',
]

const CORE_AMENITIES: Array<{ key: FlagKey; label: string; terms: string[] }> = [
  {
    key: 'no_wifi',
    label: 'WiFi not listed as an amenity',
    terms: ['wifi', 'wi-fi', 'wireless', 'internet'],
  },
  {
    key: 'no_parking',
    label: 'Parking not listed as an amenity',
    terms: ['parking', 'garage', 'driveway', 'carport'],
  },
  {
    key: 'no_kitchen_amenity',
    label: 'Kitchen or kitchen access not listed',
    terms: ['kitchen', 'kitchenette', 'full kitchen', 'cooking'],
  },
  {
    key: 'no_washer_dryer',
    label: 'Washer/dryer not listed',
    terms: ['washer', 'dryer', 'laundry', 'washing machine'],
  },
  {
    key: 'no_ac_heating',
    label: 'Air conditioning / heating not listed',
    terms: ['air conditioning', 'ac', 'a/c', 'heating', 'heat', 'hvac', 'central air'],
  },
  {
    key: 'no_tv',
    label: 'TV/streaming not listed',
    terms: ['tv', 'television', 'netflix', 'streaming', 'smart tv', 'cable'],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text.toLowerCase().trim()
}

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = normalizeText(haystack)
  return needles.some((n) => lower.includes(n.toLowerCase()))
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Resolve a photo entry to searchable text (alt + caption + url path).
 */
function photoToText(photo: string | ListingPhoto): string {
  if (typeof photo === 'string') {
    // Extract filename from URL — sometimes descriptive
    try {
      const url = new URL(photo)
      return url.pathname.toLowerCase()
    } catch {
      return photo.toLowerCase()
    }
  }
  const parts = [
    photo.altText ?? '',
    photo.caption ?? '',
    photo.url ?? '',
  ]
  return parts.join(' ').toLowerCase()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Convert raw earned/max points to a 0–100 category score.
 */
function toScore(earned: number, max: number): number {
  if (max <= 0) return 100
  return clamp(Math.round((earned / max) * 100), 0, 100)
}

// ---------------------------------------------------------------------------
// Category scorers
// ---------------------------------------------------------------------------

function scorePhotos(listing: ListingData): CategoryScore {
  const flags: AuditFlag[] = []
  let earned = 100  // Start full, subtract penalties

  const photos = listing.photos ?? []
  const count = photos.length

  // --- Photo count (up to -40 pts) ---
  if (count < 10) {
    flags.push({
      key: 'fewer_than_10_photos',
      label: 'Fewer than 10 photos — listings with 10+ photos get significantly more views',
      penalty: 40,
      category: 'photos',
    })
    earned -= 40
  } else if (count < 15) {
    flags.push({
      key: 'fewer_than_15_photos',
      label: 'Fewer than 15 photos — aim for 15–25 for maximum Airbnb algorithm boost',
      penalty: 25,
      category: 'photos',
    })
    earned -= 25
  } else if (count < 20) {
    flags.push({
      key: 'fewer_than_20_photos',
      label: 'Fewer than 20 photos — 20+ photos is the sweet spot for top-ranked listings',
      penalty: 10,
      category: 'photos',
    })
    earned -= 10
  }

  // --- Photo coverage checks (15 pts each) ---
  const photoTexts = photos.map(photoToText).join(' ')

  if (!containsAny(photoTexts, OUTDOOR_KEYWORDS)) {
    flags.push({
      key: 'no_outdoor_photos',
      label: 'No outdoor / exterior photos detected — guests want to see the outside',
      penalty: 15,
      category: 'photos',
    })
    earned -= 15
  }

  if (!containsAny(photoTexts, KITCHEN_KEYWORDS)) {
    flags.push({
      key: 'no_kitchen_photos',
      label: 'No kitchen photos detected — kitchen shots are a top booking decision factor',
      penalty: 15,
      category: 'photos',
    })
    earned -= 15
  }

  if (!containsAny(photoTexts, BEDROOM_KEYWORDS)) {
    flags.push({
      key: 'no_bedroom_photos',
      label: 'No bedroom photos detected — bed shots are the #1 thing guests look at',
      penalty: 15,
      category: 'photos',
    })
    earned -= 15
  }

  if (!containsAny(photoTexts, BATHROOM_KEYWORDS)) {
    flags.push({
      key: 'no_bathroom_photos',
      label: 'No bathroom photos detected — guests want to see bathroom quality before booking',
      penalty: 10,
      category: 'photos',
    })
    earned -= 10
  }

  if (!containsAny(photoTexts, LIVING_ROOM_KEYWORDS)) {
    flags.push({
      key: 'no_living_room_photos',
      label: 'No living room / common area photos detected',
      penalty: 5,
      category: 'photos',
    })
    earned -= 5
  }

  // Floor at 0
  earned = clamp(earned, 0, 100)

  return {
    score: toScore(earned, 100),
    weight: WEIGHTS.photos,
    flags,
    maxPoints: 100,
    earnedPoints: earned,
  }
}

function scoreCopy(listing: ListingData): CategoryScore {
  const flags: AuditFlag[] = []
  let earned = 100

  const title = listing.title ?? ''
  const description = listing.description ?? ''
  const titleLen = title.length
  const descWords = wordCount(description)
  const descLower = normalizeText(description)
  const titleLower = normalizeText(title)

  // --- Title length checks ---
  if (titleLen < 30) {
    flags.push({
      key: 'title_under_30_chars',
      label: 'Title is under 30 characters — very short titles miss algorithm keywords',
      penalty: 25,
      category: 'copy',
    })
    earned -= 25
  } else if (titleLen < 50) {
    flags.push({
      key: 'title_under_50_chars',
      label: 'Title is under 50 characters — aim for 50–80 chars to maximize keyword surface area',
      penalty: 15,
      category: 'copy',
    })
    earned -= 15
  } else if (titleLen > 100) {
    flags.push({
      key: 'title_over_100_chars',
      label: 'Title exceeds 100 characters — Airbnb truncates long titles in search results',
      penalty: 5,
      category: 'copy',
    })
    earned -= 5
  }

  // --- Description length checks ---
  if (descWords < 100) {
    flags.push({
      key: 'description_under_100_words',
      label: 'Description is under 100 words — very thin copy hurts search ranking and conversion',
      penalty: 30,
      category: 'copy',
    })
    earned -= 30
  } else if (descWords < 200) {
    flags.push({
      key: 'description_under_200_words',
      label: 'Description is under 200 words — aim for 300–500 words for best results',
      penalty: 20,
      category: 'copy',
    })
    earned -= 20
  } else if (descWords < 400) {
    flags.push({
      key: 'description_under_400_words',
      label: 'Description under 400 words — top listings average 400–600 words',
      penalty: 8,
      category: 'copy',
    })
    earned -= 8
  }

  // --- Local area keywords ---
  const combinedText = `${titleLower} ${descLower}`
  if (!containsAny(combinedText, LOCAL_AREA_KEYWORDS)) {
    flags.push({
      key: 'no_local_area_keywords',
      label: 'No local area references in title or description — guests search by location and nearby attractions',
      penalty: 20,
      category: 'copy',
    })
    earned -= 20
  }

  // --- Amenity callouts in description ---
  if (!containsAny(descLower, AMENITY_MENTION_KEYWORDS)) {
    flags.push({
      key: 'no_amenity_callouts_in_description',
      label: 'No amenity keywords in description — mention WiFi, parking, kitchen etc. explicitly',
      penalty: 15,
      category: 'copy',
    })
    earned -= 15
  }

  // --- Unique selling point / differentiator language ---
  if (!containsAny(combinedText, UNIQUE_SELLING_KEYWORDS)) {
    flags.push({
      key: 'no_unique_selling_point',
      label: 'No differentiating language found — what makes your property special? Add it.',
      penalty: 10,
      category: 'copy',
    })
    earned -= 10
  }

  earned = clamp(earned, 0, 100)

  return {
    score: toScore(earned, 100),
    weight: WEIGHTS.copy,
    flags,
    maxPoints: 100,
    earnedPoints: earned,
  }
}

function scoreAmenities(listing: ListingData): CategoryScore {
  const flags: AuditFlag[] = []
  let earned = 100

  const amenities = listing.amenities ?? []
  const count = amenities.length
  const amenityText = amenities.map(normalizeText).join(' ')

  // --- Count checks ---
  if (count < 5) {
    flags.push({
      key: 'fewer_than_5_amenities',
      label: 'Fewer than 5 amenities listed — Airbnb surfaces listings with more amenities in filtered searches',
      penalty: 40,
      category: 'amenities',
    })
    earned -= 40
  } else if (count < 10) {
    flags.push({
      key: 'fewer_than_10_amenities',
      label: 'Fewer than 10 amenities listed — most competitive listings have 15+',
      penalty: 20,
      category: 'amenities',
    })
    earned -= 20
  }

  // --- Core amenity checks (10 pts each) ---
  for (const amenity of CORE_AMENITIES) {
    if (!containsAny(amenityText, amenity.terms)) {
      flags.push({
        key: amenity.key,
        label: amenity.label,
        penalty: 10,
        category: 'amenities',
      })
      earned -= 10
    }
  }

  earned = clamp(earned, 0, 100)

  return {
    score: toScore(earned, 100),
    weight: WEIGHTS.amenities,
    flags,
    maxPoints: 100,
    earnedPoints: earned,
  }
}

function scoreReviews(listing: ListingData): CategoryScore {
  const flags: AuditFlag[] = []
  let earned = 100

  // Prefer explicit fields; fall back to computing from reviews array
  const reviews = listing.reviews ?? []
  const reviewCount = listing.reviewCount ?? reviews.length

  // Compute average rating if not provided
  let rating = listing.rating
  if ((rating === undefined || rating === null) && reviews.length > 0) {
    const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0)
    rating = sum / reviews.length
  }

  const responseRate = listing.responseRate  // 0–100 or undefined

  // --- Rating checks ---
  if (rating !== undefined && rating !== null) {
    if (rating < 4.5) {
      flags.push({
        key: 'rating_below_4_5',
        label: `Rating is ${rating.toFixed(1)} — below 4.5 significantly hurts visibility and conversion`,
        penalty: 35,
        category: 'reviews',
      })
      earned -= 35
    } else if (rating < 4.8) {
      flags.push({
        key: 'rating_below_4_8',
        label: `Rating is ${rating.toFixed(1)} — top listings are 4.8+. Even 4.7 loses bookings to competitors`,
        penalty: 15,
        category: 'reviews',
      })
      earned -= 15
    }
  }

  // --- Review count checks ---
  if (reviewCount < 5) {
    flags.push({
      key: 'fewer_than_5_reviews',
      label: 'Fewer than 5 reviews — new listings need reviews urgently. Consider running a friends & family stay.',
      penalty: 30,
      category: 'reviews',
    })
    earned -= 30
  } else if (reviewCount < 10) {
    flags.push({
      key: 'fewer_than_10_reviews',
      label: 'Fewer than 10 reviews — 10+ reviews is the trust threshold for most guests',
      penalty: 20,
      category: 'reviews',
    })
    earned -= 20
  } else if (reviewCount < 20) {
    flags.push({
      key: 'fewer_than_20_reviews',
      label: 'Fewer than 20 reviews — 20+ signals an established, trusted listing',
      penalty: 8,
      category: 'reviews',
    })
    earned -= 8
  }

  // --- Response rate checks ---
  if (responseRate === undefined || responseRate === null) {
    flags.push({
      key: 'no_response_rate',
      label: 'Response rate not available — 100% response rate is an Airbnb algorithm booster',
      penalty: 20,
      category: 'reviews',
    })
    earned -= 20
  } else if (responseRate < 75) {
    flags.push({
      key: 'response_rate_below_75',
      label: `Response rate is ${responseRate}% — below 75% is a major trust signal failure`,
      penalty: 20,
      category: 'reviews',
    })
    earned -= 20
  } else if (responseRate < 90) {
    flags.push({
      key: 'response_rate_below_90',
      label: `Response rate is ${responseRate}% — Airbnb Superhost requires 90%+`,
      penalty: 10,
      category: 'reviews',
    })
    earned -= 10
  }

  earned = clamp(earned, 0, 100)

  return {
    score: toScore(earned, 100),
    weight: WEIGHTS.reviews,
    flags,
    maxPoints: 100,
    earnedPoints: earned,
  }
}

function scorePricing(listing: ListingData): CategoryScore {
  const flags: AuditFlag[] = []
  let earned = 100

  const pricing = listing.pricing
  const pricePerNight = pricing?.pricePerNight ?? listing.pricePerNight
  const marketAvg = pricing?.marketAvgPricePerNight

  if (pricePerNight === undefined || pricePerNight === null || pricePerNight <= 0) {
    flags.push({
      key: 'no_pricing_data',
      label: 'No pricing data available — we cannot assess your price competitiveness',
      penalty: 50,
      category: 'pricing',
    })
    earned -= 50
  } else if (marketAvg === undefined || marketAvg === null || marketAvg <= 0) {
    flags.push({
      key: 'no_market_comparison',
      label: 'No market comparison data available — we cannot verify if your price is competitive',
      penalty: 20,
      category: 'pricing',
    })
    earned -= 20
  } else {
    // We have both — run the comparison
    const priceDelta = (pricePerNight - marketAvg) / marketAvg  // positive = above market

    if (priceDelta > 0.20) {
      flags.push({
        key: 'price_above_market_20pct',
        label: `Price is ${Math.round(priceDelta * 100)}% above market average — significantly reduces booking conversion`,
        penalty: 40,
        category: 'pricing',
      })
      earned -= 40
    } else if (priceDelta > 0.10) {
      flags.push({
        key: 'price_above_market_10pct',
        label: `Price is ${Math.round(priceDelta * 100)}% above market average — slightly above competitive range`,
        penalty: 20,
        category: 'pricing',
      })
      earned -= 20
    }
    // At or below market = no penalty
  }

  earned = clamp(earned, 0, 100)

  return {
    score: toScore(earned, 100),
    weight: WEIGHTS.pricing,
    flags,
    maxPoints: 100,
    earnedPoints: earned,
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Score a listing audit.
 *
 * Fully deterministic — no randomness, no LLM calls, no I/O.
 * Same ListingData input → same AuditScore output, always.
 */
export function scoreListingAudit(listing: ListingData): AuditScore {
  const photos    = scorePhotos(listing)
  const copy      = scoreCopy(listing)
  const amenities = scoreAmenities(listing)
  const reviews   = scoreReviews(listing)
  const pricing   = scorePricing(listing)

  // Weighted overall score
  const overall = Math.round(
    photos.score    * WEIGHTS.photos    +
    copy.score      * WEIGHTS.copy      +
    amenities.score * WEIGHTS.amenities +
    reviews.score   * WEIGHTS.reviews   +
    pricing.score   * WEIGHTS.pricing
  )

  const allFlags: AuditFlag[] = [
    ...photos.flags,
    ...copy.flags,
    ...amenities.flags,
    ...reviews.flags,
    ...pricing.flags,
  ]

  return {
    overall: clamp(overall, 0, 100),
    categories: { photos, copy, amenities, reviews, pricing },
    flags: allFlags,
    scoredAt: new Date().toISOString(),
  }
}
