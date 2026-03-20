import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ListingData = {
  listing_id?: string
  url: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: { text: string; rating: number; date: string }[]
  rating: number
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number
  platform: 'airbnb' | 'vrbo'
  responseRate?: number        // 0-100 percentage if available
  highlights?: string[]        // Airbnb "highlights" / summary bullets
  hasAccessibilityInfo?: boolean
  seasonalMentions?: string[]  // any seasonal keywords detected
  competitorAvgPrice?: number  // optional: avg price of nearby comparables
}

export type AuditCategory = {
  name: string
  score: number
  max: number
  issues: string[]
}

export type AuditScore = {
  total_score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  categories: AuditCategory[]
  top_issues: string[]
  scored_at: string
}

// ─── Weights (must sum to 100) ────────────────────────────────────────────────

const WEIGHTS = {
  title_quality:            12,
  description_quality:      18,
  photo_count:              15,
  amenities_completeness:   12,
  review_velocity:           8,
  response_rate:             8,
  price_competitiveness:     8,
  highlights_usage:          7,
  seasonal_relevance:        6,
  accessibility_info:        6,
} as const

// Total: 100

// ─── Claude client (lazy init) ────────────────────────────────────────────────

function getClaudeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey })
}

// ─── Supabase client (lazy init) ─────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

// ─── AI Evaluation helpers ────────────────────────────────────────────────────

type AIEvalResult = {
  score: number      // 0-10
  issues: string[]
}

/**
 * Ask Claude to evaluate qualitative listing copy.
 * Returns a score 0-10 and a list of specific issues.
 */
async function evaluateWithClaude(
  claude: Anthropic,
  criterion: string,
  content: string,
  rubric: string
): Promise<AIEvalResult> {
  const prompt = `You are an expert short-term rental listing analyst. Evaluate the following listing ${criterion} and return a JSON object only.

RUBRIC:
${rubric}

CONTENT TO EVALUATE:
"""
${content}
"""

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "score": <integer 0-10>,
  "issues": [<string>, ...]
}

Rules:
- score must be an integer from 0 to 10
- issues is an array of specific, actionable improvement suggestions (empty array if none)
- Be calibrated: a bare or generic listing scores 0-4, an average listing scores 5-7, an excellent listing scores 8-10
- Each issue must be a single sentence starting with a verb (e.g. "Add local landmark references...")
- Maximum 3 issues`

  try {
    const response = await claude.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed: AIEvalResult = JSON.parse(cleaned)

    // Clamp score to valid range
    parsed.score = Math.max(0, Math.min(10, Math.round(parsed.score)))
    parsed.issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3) : []

    return parsed
  } catch {
    // Fallback: neutral score, no issues (fail-safe — don't crash the whole audit)
    return { score: 5, issues: ['Unable to evaluate this section — please review manually.'] }
  }
}

// ─── Individual criterion scorers ─────────────────────────────────────────────

/**
 * C1: Title Quality (12 pts) — AI evaluated
 * Great titles: 50-80 chars, include property type + location + 1 wow feature
 */
async function scoreTitleQuality(
  claude: Anthropic,
  listing: ListingData
): Promise<AuditCategory> {
  const max = WEIGHTS.title_quality
  const title = listing.title || ''

  const rubric = `A great STR listing title (score 8-10) is 50-80 characters, includes the property type, a key location reference, and one compelling differentiator (view, amenity, vibe). It avoids all-caps, generic phrases ("Cozy place", "Nice home"), and excessive punctuation. A bare or missing title scores 0-2. A title that's there but generic scores 3-5.`

  const result = await evaluateWithClaude(claude, 'title', title || '(no title provided)', rubric)
  const score = Math.round((result.score / 10) * max)

  // Add character-count hint as a deterministic augment
  const issues = [...result.issues]
  if (title.length < 30 && !issues.some(i => i.toLowerCase().includes('short'))) {
    issues.push('Title is too short — aim for 50-80 characters to maximize visibility.')
  }
  if (title.length > 100 && !issues.some(i => i.toLowerCase().includes('long'))) {
    issues.push('Title is too long — Airbnb truncates titles over 80 characters in search results.')
  }

  return { name: 'Title Quality', score, max, issues: issues.slice(0, 3) }
}

/**
 * C2: Description Quality (18 pts) — AI evaluated
 * Great descriptions: 800-1500 words, SEO-rich, evocative, structured
 */
async function scoreDescriptionQuality(
  claude: Anthropic,
  listing: ListingData
): Promise<AuditCategory> {
  const max = WEIGHTS.description_quality
  const desc = listing.description || ''
  const wordCount = desc.split(/\s+/).filter(Boolean).length

  const rubric = `A great STR listing description (score 8-10) is 300-1500 words, opens with a vivid scene-setter, uses natural language that includes location keywords, highlights the 3-5 best features, addresses the guest's biggest concerns (parking, check-in, noise), and closes with a clear call to action. It avoids bullet-point overload, clichés ("hidden gem", "cozy haven"), and copy that reads like a property spec sheet. A missing or very thin description (<100 words) scores 0-2. Generic/template copy scores 3-5.`

  // Truncate very long descriptions to avoid huge token bills
  const sample = desc.length > 2000 ? desc.slice(0, 2000) + '\n... [truncated]' : desc

  const result = await evaluateWithClaude(
    claude,
    'description',
    sample || '(no description provided)',
    rubric
  )
  let score = Math.round((result.score / 10) * max)

  const issues = [...result.issues]

  // Deterministic augments for word count
  if (wordCount < 100) {
    score = Math.min(score, Math.round(max * 0.3)) // cap at 30%
    if (!issues.some(i => i.toLowerCase().includes('word') || i.toLowerCase().includes('short'))) {
      issues.unshift('Description is too short — expand to at least 300 words to rank higher.')
    }
  } else if (wordCount < 250) {
    score = Math.min(score, Math.round(max * 0.55))
    if (!issues.some(i => i.toLowerCase().includes('word') || i.toLowerCase().includes('short'))) {
      issues.unshift('Description needs more detail — aim for 300-800 words for best results.')
    }
  }

  return { name: 'Description Quality & SEO', score, max, issues: issues.slice(0, 3) }
}

/**
 * C3: Photo Count (15 pts) — fully deterministic
 * ≥20 photos = 15, 15-19 = 11, 10-14 = 7, 5-9 = 3, <5 = 0
 */
function scorePhotoCount(listing: ListingData): AuditCategory {
  const max = WEIGHTS.photo_count
  const count = listing.photos?.length ?? 0
  const issues: string[] = []

  let score: number
  if (count >= 20) {
    score = max
  } else if (count >= 15) {
    score = Math.round(max * 0.73)
    issues.push(`Add ${20 - count} more photos to reach the 20-photo threshold for maximum search visibility.`)
  } else if (count >= 10) {
    score = Math.round(max * 0.47)
    issues.push(`Only ${count} photos detected — listings with 20+ photos get significantly more clicks.`)
    issues.push('Prioritize photos of: bedroom, bathroom, kitchen, outdoor space, and neighborhood.')
  } else if (count >= 5) {
    score = Math.round(max * 0.2)
    issues.push(`Critical: only ${count} photos — this is a major conversion killer.`)
    issues.push('Add at least 15 more photos covering every room and key outdoor areas.')
  } else {
    score = 0
    issues.push(`No photos detected (count: ${count}) — listings without photos receive almost zero bookings.`)
    issues.push('Add a minimum of 20 high-quality photos immediately.')
  }

  return { name: 'Photo Count', score, max, issues }
}

/**
 * C4: Amenities Completeness (12 pts) — deterministic with tiers
 * Key amenities checklist + bonus for premium amenities
 */
function scoreAmenitiesCompleteness(listing: ListingData): AuditCategory {
  const max = WEIGHTS.amenities_completeness
  const amenities = (listing.amenities ?? []).map(a => a.toLowerCase())
  const issues: string[] = []

  const ESSENTIAL = ['wifi', 'kitchen', 'parking', 'washer', 'dryer', 'air conditioning', 'heating', 'tv']
  const PREMIUM = ['pool', 'hot tub', 'gym', 'workspace', 'ev charger', 'bbq', 'fireplace', 'coffee maker', 'dishwasher']

  const missingEssential = ESSENTIAL.filter(
    e => !amenities.some(a => a.includes(e))
  )
  const presentPremium = PREMIUM.filter(
    p => amenities.some(a => a.includes(p))
  )

  // Essential: 8 pts, Premium: 4 pts
  const essentialScore = Math.round(8 * ((ESSENTIAL.length - missingEssential.length) / ESSENTIAL.length))
  const premiumScore = Math.min(4, Math.round(4 * (presentPremium.length / 3)))
  const score = Math.min(max, essentialScore + premiumScore)

  if (missingEssential.length > 0) {
    issues.push(
      `Missing essential amenities: ${missingEssential.slice(0, 4).join(', ')} — add these to your listing immediately.`
    )
  }
  if (amenities.length < 10) {
    issues.push('List fewer than 10 amenities — thoroughly document every available amenity to improve search ranking.')
  }
  if (presentPremium.length === 0) {
    issues.push('No premium amenities highlighted — if you have a pool, hot tub, or workspace, make sure they appear.')
  }

  return { name: 'Amenities Completeness', score, max, issues: issues.slice(0, 3) }
}

/**
 * C5: Review Velocity (8 pts) — deterministic
 * reviewCount + recency of reviews signals booking momentum
 */
function scoreReviewVelocity(listing: ListingData): AuditCategory {
  const max = WEIGHTS.review_velocity
  const count = listing.reviewCount ?? 0
  const reviews = listing.reviews ?? []
  const issues: string[] = []

  // Volume scoring (5 pts)
  let volumeScore: number
  if (count >= 50) volumeScore = 5
  else if (count >= 25) volumeScore = 4
  else if (count >= 10) volumeScore = 3
  else if (count >= 5)  volumeScore = 2
  else if (count >= 1)  volumeScore = 1
  else volumeScore = 0

  // Recency scoring (3 pts) — check if any review in last 90 days
  let recencyScore = 0
  if (reviews.length > 0) {
    const now = Date.now()
    const ninetyDays = 90 * 24 * 60 * 60 * 1000
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const hasRecent90 = reviews.some(r => {
      try { return now - new Date(r.date).getTime() < ninetyDays } catch { return false }
    })
    const hasRecent30 = reviews.some(r => {
      try { return now - new Date(r.date).getTime() < thirtyDays } catch { return false }
    })
    recencyScore = hasRecent30 ? 3 : hasRecent90 ? 2 : 1
  }

  const score = Math.min(max, volumeScore + recencyScore)

  if (count === 0) {
    issues.push('No reviews yet — focus on getting your first 5 reviews to build social proof.')
    issues.push('Consider offering a small welcome discount to early guests in exchange for honest reviews.')
  } else if (count < 10) {
    issues.push(`Only ${count} review${count === 1 ? '' : 's'} — listings with 10+ reviews convert significantly better.`)
  }
  if (recencyScore < 2 && count > 0) {
    issues.push('No recent reviews detected — stale review history signals low booking activity to Airbnb\'s algorithm.')
  }

  return { name: 'Review Velocity', score, max, issues: issues.slice(0, 3) }
}

/**
 * C6: Response Rate (8 pts) — deterministic
 * 100% = 8, 90-99% = 6, 80-89% = 4, <80% = 2, unknown = 4 (neutral)
 */
function scoreResponseRate(listing: ListingData): AuditCategory {
  const max = WEIGHTS.response_rate
  const rate = listing.responseRate
  const issues: string[] = []

  let score: number
  if (rate === undefined || rate === null) {
    // Not available from scrape — give neutral score
    score = Math.round(max * 0.5)
    issues.push('Response rate data not available — aim for 100% to qualify for Superhost status.')
  } else if (rate >= 100) {
    score = max
  } else if (rate >= 90) {
    score = Math.round(max * 0.75)
    issues.push(`Response rate is ${rate}% — bring it to 100% to unlock Superhost eligibility.`)
  } else if (rate >= 80) {
    score = Math.round(max * 0.5)
    issues.push(`Response rate of ${rate}% is below the Superhost threshold of 90%.`)
    issues.push('Enable instant booking or set up automated responses to improve your response rate.')
  } else {
    score = Math.round(max * 0.25)
    issues.push(`Response rate of ${rate}% is critically low — Airbnb penalizes listings with poor responsiveness.`)
    issues.push('Turn on message notifications and set up quick-reply templates immediately.')
  }

  return { name: 'Response Rate', score, max, issues: issues.slice(0, 3) }
}

/**
 * C7: Price Competitiveness (8 pts) — deterministic (with fallback)
 * If competitor data available: use it. Otherwise use rough benchmarks.
 */
function scorePriceCompetitiveness(listing: ListingData): AuditCategory {
  const max = WEIGHTS.price_competitiveness
  const price = listing.pricePerNight ?? 0
  const competitorAvg = listing.competitorAvgPrice
  const issues: string[] = []

  let score: number

  if (!price || price === 0) {
    score = Math.round(max * 0.5)
    issues.push('Price per night not detected — ensure your listing has a clearly set nightly rate.')
    return { name: 'Price Competitiveness', score, max, issues }
  }

  if (competitorAvg && competitorAvg > 0) {
    const ratio = price / competitorAvg
    if (ratio <= 0.9) {
      score = max // Priced below market — great value signal
    } else if (ratio <= 1.05) {
      score = Math.round(max * 0.875) // At market
    } else if (ratio <= 1.2) {
      score = Math.round(max * 0.625)
      issues.push(`Priced ${Math.round((ratio - 1) * 100)}% above comparable listings — consider adjusting for more competitive positioning.`)
    } else if (ratio <= 1.4) {
      score = Math.round(max * 0.375)
      issues.push(`Priced ${Math.round((ratio - 1) * 100)}% above market average — this significantly reduces booking probability.`)
      issues.push('Use dynamic pricing tools (PriceLabs, Beyond) to optimize your rates automatically.')
    } else {
      score = Math.round(max * 0.125)
      issues.push(`Price is ${Math.round((ratio - 1) * 100)}% above comparable listings — a major booking barrier.`)
      issues.push('Reduce nightly rate or add more value (amenities, services) to justify premium pricing.')
    }
  } else {
    // No competitor data: give neutral score with advice
    score = Math.round(max * 0.625)
    issues.push('Enable competitor price tracking to benchmark your rates against similar listings.')
    issues.push('Use a dynamic pricing tool to automatically adjust rates based on demand.')
  }

  return { name: 'Price Competitiveness', score, max, issues: issues.slice(0, 3) }
}

/**
 * C8: Highlights Usage (7 pts) — deterministic
 * Airbnb "what makes this place unique" / structured highlights
 */
function scoreHighlightsUsage(listing: ListingData): AuditCategory {
  const max = WEIGHTS.highlights_usage
  const highlights = listing.highlights ?? []
  const issues: string[] = []

  let score: number
  if (highlights.length >= 3) {
    score = max
  } else if (highlights.length === 2) {
    score = Math.round(max * 0.71)
    issues.push('Add a third listing highlight — Airbnb displays up to 3 highlights prominently in search results.')
  } else if (highlights.length === 1) {
    score = Math.round(max * 0.43)
    issues.push('Only 1 highlight set — add 2 more to fully utilize Airbnb\'s highlight feature.')
    issues.push('Highlights appear above the fold in search results — they directly drive click-through rate.')
  } else {
    score = 0
    issues.push('No listing highlights set — this premium placement in search results is going unused.')
    issues.push('Add 3 highlights that capture your listing\'s best features (view, location, unique amenity).')
  }

  return { name: 'Highlights Usage', score, max, issues: issues.slice(0, 3) }
}

/**
 * C9: Seasonal Relevance (6 pts) — AI evaluated
 * Does the description reference seasonal appeal?
 */
async function scoreSeasonalRelevance(
  claude: Anthropic,
  listing: ListingData
): Promise<AuditCategory> {
  const max = WEIGHTS.seasonal_relevance
  const desc = listing.description || ''
  const seasonal = listing.seasonalMentions ?? []

  const issues: string[] = []

  // Deterministic fast-path if we already have seasonal mentions data
  if (seasonal.length >= 4) {
    return { name: 'Seasonal Relevance', score: max, max, issues: [] }
  }

  const rubric = `A listing with strong seasonal relevance (score 8-10) mentions at least 2-3 seasons or seasonal activities (e.g. ski slopes in winter, hiking trails in summer, fall foliage, spring blooms, holiday events nearby). A listing with zero seasonal references scores 0-2. Generic location descriptions without seasonal angle score 3-5. Note: If the listing is in a location with limited seasonality (e.g., year-round beach destination) and acknowledges this, that's fine — score it 7-9.`

  const sample = desc.length > 1500 ? desc.slice(0, 1500) : desc
  const result = await evaluateWithClaude(
    claude,
    'seasonal relevance',
    sample || '(no description provided)',
    rubric
  )

  const score = Math.round((result.score / 10) * max)

  if (result.issues.length === 0 && score < max) {
    issues.push('Add seasonal language to appeal to guests year-round (summer activities, winter getaways, etc.).')
  } else {
    issues.push(...result.issues)
  }

  return { name: 'Seasonal Relevance', score, max, issues: issues.slice(0, 3) }
}

/**
 * C10: Accessibility Info (6 pts) — deterministic
 * Does the listing mention accessibility features or at least address stairs/parking/mobility?
 */
function scoreAccessibilityInfo(listing: ListingData): AuditCategory {
  const max = WEIGHTS.accessibility_info
  const amenities = (listing.amenities ?? []).map(a => a.toLowerCase())
  const desc = (listing.description ?? '').toLowerCase()
  const issues: string[] = []

  const ACCESS_KEYWORDS = [
    'wheelchair', 'accessible', 'elevator', 'lift', 'step-free', 'grab bar',
    'walk-in shower', 'mobility', 'disability', 'handicap', 'accessible parking',
    'no stairs', 'ground floor', 'ramp',
  ]

  const BASIC_KEYWORDS = ['stair', 'step', 'parking', 'floor level', 'ground floor']

  const hasAccessibilityAmenity = amenities.some(a => ACCESS_KEYWORDS.some(k => a.includes(k)))
  const hasAccessibilityDesc = desc && ACCESS_KEYWORDS.some(k => desc.includes(k))
  const hasBasicNavInfo = desc && BASIC_KEYWORDS.some(k => desc.includes(k))
  const hasInfo = listing.hasAccessibilityInfo === true

  let score: number
  if (hasAccessibilityAmenity || hasInfo) {
    score = max
  } else if (hasAccessibilityDesc) {
    score = Math.round(max * 0.83)
    issues.push('Add accessibility features to your amenities list for better search filtering visibility.')
  } else if (hasBasicNavInfo) {
    score = Math.round(max * 0.5)
    issues.push('Mention accessibility features explicitly — many guests filter by accessibility options.')
    issues.push('If not fully accessible, clearly state stairs/entry requirements so guests can self-select.')
  } else {
    score = Math.round(max * 0.17)
    issues.push('No accessibility information found — add details about stairs, parking, and entry requirements.')
    issues.push('15%+ of travelers have mobility needs — accessibility info expands your potential guest pool.')
  }

  return { name: 'Accessibility Information', score, max, issues: issues.slice(0, 3) }
}

// ─── Grade calculator ─────────────────────────────────────────────────────────

function calculateGrade(total: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (total >= 85) return 'A'
  if (total >= 70) return 'B'
  if (total >= 55) return 'C'
  if (total >= 40) return 'D'
  return 'F'
}

// ─── Top issues selector ──────────────────────────────────────────────────────

/**
 * Pick the top 3 most impactful issues by looking at which categories
 * lost the most points and surfacing their first issue.
 */
function selectTopIssues(categories: AuditCategory[]): string[] {
  const withGap = categories
    .map(c => ({
      gap: c.max - c.score,
      weight: c.max,
      firstIssue: c.issues[0] ?? null,
      name: c.name,
    }))
    .filter(c => c.firstIssue !== null && c.gap > 0)
    .sort((a, b) => b.gap - a.gap || b.weight - a.weight)

  return withGap.slice(0, 3).map(c => `[${c.name}] ${c.firstIssue}`)
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

async function persistAuditScore(
  listing_id: string | undefined,
  listing_url: string,
  score: AuditScore
): Promise<void> {
  try {
    const supabase = getSupabaseClient()
    await supabase.from('audits').insert({
      listing_id: listing_id ?? null,
      listing_url,
      total_score: score.total_score,
      grade: score.grade,
      categories: score.categories,
      top_issues: score.top_issues,
      scored_at: score.scored_at,
    })
  } catch (err) {
    // Non-fatal: log but don't fail the scoring
    console.error('[audit/scorer] Failed to persist audit score to Supabase:', err)
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * scoreListingAudit — evaluates a listing across 10 weighted criteria
 * and returns a 0-100 score with per-category breakdown.
 *
 * AI (Claude) is used for qualitative criteria (title, description, seasonal relevance).
 * Deterministic logic is used for quantitative criteria (photo count, amenities, etc.).
 */
export async function scoreListingAudit(listing: ListingData): Promise<AuditScore> {
  const claude = getClaudeClient()

  // Run AI evaluations in parallel (3 Claude calls), deterministic ones synchronously
  const [titleResult, descResult, seasonalResult] = await Promise.all([
    scoreTitleQuality(claude, listing),
    scoreDescriptionQuality(claude, listing),
    scoreSeasonalRelevance(claude, listing),
  ])

  const categories: AuditCategory[] = [
    titleResult,
    descResult,
    scorePhotoCount(listing),
    scoreAmenitiesCompleteness(listing),
    scoreReviewVelocity(listing),
    scoreResponseRate(listing),
    scorePriceCompetitiveness(listing),
    scoreHighlightsUsage(listing),
    seasonalResult,
    scoreAccessibilityInfo(listing),
  ]

  const total_score = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0)
  )

  const grade = calculateGrade(total_score)
  const top_issues = selectTopIssues(categories)
  const scored_at = new Date().toISOString()

  const auditScore: AuditScore = {
    total_score,
    grade,
    categories,
    top_issues,
    scored_at,
  }

  // Persist to Supabase (non-blocking on failure)
  await persistAuditScore(listing.listing_id, listing.url, auditScore)

  return auditScore
}
