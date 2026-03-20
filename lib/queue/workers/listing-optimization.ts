import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PropertyObject {
  id?: string
  url: string
  title: string
  description: string
  amenities: string[]
  location: string
  propertyType: string
  pricePerNight: number
  rating?: number
  reviewCount?: number
  photos?: string[]
  platform?: 'airbnb' | 'vrbo'
  bedroomCount?: number
  bathroomCount?: number
  maxGuests?: number
  nearbyAttractions?: string[]
}

export interface AuditScoreBreakdown {
  overall: number
  title?: number
  description?: number
  amenities?: number
  photos?: number
  pricing?: number
  reviews?: number
  categories?: {
    name: string
    score: number
    maxScore: number
    issues: string[]
  }[]
}

export interface ListingOptimizationPayload {
  title: string
  titleCharCount: number
  description: {
    openingHook: string
    amenityHighlights: string
    neighborhoodSell: string
    guestCta: string
    full: string
  }
  amenityTags: string[]
  auditScoreContext: {
    overallScore: number
    lowestCategories: { name: string; score: number; issues: string[] }[]
    improvements: string[]
  }
  generatedAt: string
  model: string
}

export interface ListingOptimizationDeliverable {
  id?: string
  propertyId?: string
  sessionId?: string
  type: 'listing_optimization'
  status: 'pending_review' | 'approved' | 'rejected'
  payload: ListingOptimizationPayload
  createdAt?: string
  updatedAt?: string
}

// ─── High-value Airbnb search terms from knowledge base ──────────────────────

const HIGH_SEARCH_AMENITY_TERMS = [
  // Connectivity & work
  'fast WiFi',
  'dedicated workspace',
  'high-speed internet',
  'laptop-friendly',
  // Kitchen & dining
  'fully equipped kitchen',
  'coffee maker',
  'dishwasher',
  'outdoor dining',
  // Comfort & sleep
  'king bed',
  'queen bed',
  'premium linens',
  'blackout curtains',
  'air conditioning',
  'central heating',
  // Outdoor & views
  'private pool',
  'hot tub',
  'private patio',
  'rooftop deck',
  'balcony',
  'mountain views',
  'ocean views',
  'garden',
  'fire pit',
  // Family & accessibility
  'pack n play',
  'high chair',
  'stroller-friendly',
  'single-story',
  'step-free access',
  // Entertainment
  'smart TV',
'streaming services',
  'board games',
  'game room',
  'Netflix',
  // Parking & transport
  'free parking',
  'EV charging',
  'garage',
  // Laundry
  'washer dryer',
  'in-unit laundry',
  // Safety & security
  'keyless entry',
  'smoke detector',
  'carbon monoxide detector',
  'first aid kit',
  // Pet-friendly
  'pet friendly',
  'dog welcome',
  'fenced yard',
  // Unique features
  'private entrance',
  'self check-in',
  'contactless check-in',
]

// ─── Score Analysis ───────────────────────────────────────────────────────────

function analyzeAuditScores(audit: AuditScoreBreakdown): {
  lowestCategories: { name: string; score: number; issues: string[] }[]
  improvements: string[]
  focusAreas: string[]
} {
  const categories = audit.categories || []

  // Sort categories by score ascending (worst first)
  const sorted = [...categories].sort((a, b) => {
    const scoreA = a.maxScore > 0 ? a.score / a.maxScore : a.score / 100
    const scoreB = b.maxScore > 0 ? b.score / b.maxScore : b.score / 100
    return scoreA - scoreB
  })

  const lowestCategories = sorted.slice(0, 3).map((c) => ({
    name: c.name,
    score: c.score,
    issues: c.issues || [],
  }))

  const improvements: string[] = []
  const focusAreas: string[] = []

  for (const cat of lowestCategories) {
    focusAreas.push(cat.name)
    improvements.push(...cat.issues)
  }

  // Fallback: infer from numeric scores on flat breakdown
  if (lowestCategories.length === 0) {
    const flat: { name: string; score: number; issues: string[] }[] = []
    if (audit.title !== undefined) flat.push({ name: 'title', score: audit.title, issues: [] })
    if (audit.description !== undefined)
      flat.push({ name: 'description', score: audit.description, issues: [] })
    if (audit.amenities !== undefined)
      flat.push({ name: 'amenities', score: audit.amenities, issues: [] })
    if (audit.photos !== undefined) flat.push({ name: 'photos', score: audit.photos, issues: [] })
    if (audit.pricing !== undefined)
      flat.push({ name: 'pricing', score: audit.pricing, issues: [] })
    if (audit.reviews !== undefined)
      flat.push({ name: 'reviews', score: audit.reviews, issues: [] })

    flat.sort((a, b) => a.score - b.score)
    flat.slice(0, 3).forEach((c) => {
      lowestCategories.push(c)
      focusAreas.push(c.name)
    })
  }

  return { lowestCategories, improvements, focusAreas }
}

// ─── Claude Prompt Builder ────────────────────────────────────────────────────

function buildOptimizationPrompt(
  property: PropertyObject,
  audit: AuditScoreBreakdown,
  scoreAnalysis: ReturnType<typeof analyzeAuditScores>
): string {
  const auditSummary = `
AUDIT SCORE CONTEXT:
- Overall score: ${audit.overall}/100
- Lowest-scoring areas (prioritize these in rewrites):
${scoreAnalysis.lowestCategories
  .map(
    (c) =>
      `  • ${c.name}: ${c.score} points${c.issues.length > 0 ? ` — Issues: ${c.issues.join(', ')}` : ''}`
  )
  .join('\n')}
- Key improvements needed: ${scoreAnalysis.improvements.slice(0, 5).join('; ') || 'General quality improvement'}
`.trim()

  const propertyContext = `
PROPERTY DETAILS:
- Current title: "${property.title}"
- Location: ${property.location}
- Property type: ${property.propertyType}
- Price per night: $${property.pricePerNight}
- Rating: ${property.rating ?? 'N/A'} (${property.reviewCount ?? 0} reviews)
- Bedrooms: ${property.bedroomCount ?? 'N/A'}
- Bathrooms: ${property.bathroomCount ?? 'N/A'}
- Max guests: ${property.maxGuests ?? 'N/A'}
- Platform: ${property.platform ?? 'airbnb'}
- Amenities: ${property.amenities.join(', ')}
- Nearby attractions: ${(property.nearbyAttractions ?? []).join(', ') || 'Not specified'}
- Current description:
${property.description}
`.trim()

  return `You are an expert Airbnb listing copywriter with deep knowledge of Airbnb's search algorithm, guest psychology, and conversion optimization. You specialize in writing listings that rank higher in Airbnb search and convert browsers into bookers.

${auditSummary}

${propertyContext}

HIGH-VALUE AIRBNB SEARCH TERMS TO INCORPORATE (where authentic):
${HIGH_SEARCH_AMENITY_TERMS.slice(0, 20).join(', ')}

YOUR TASK: Produce a complete listing optimization package. Address the lowest-scoring areas specifically.

OUTPUT FORMAT — Return ONLY valid JSON matching this exact structure:

{
  "title": "string (MAXIMUM 50 CHARACTERS — non-negotiable hard limit, include location keyword + standout amenity + sensory/lifestyle hook)",
  "description": {
    "openingHook": "string (2-3 sentences — sensory, vivid, emotionally compelling opener that sells the experience, not the property features)",
    "amenityHighlights": "string (3-4 sentences — the 5-7 most booking-relevant amenities written as guest benefits, not a bulleted list — weave them into prose)",
    "neighborhoodSell": "string (2-3 sentences — local area highlights, walkability, nearby attractions, what makes this location special)",
    "guestCta": "string (1-2 sentences — warm, direct call to action that creates urgency and feels personal)"
  },
  "amenityTags": ["array of 15-25 strings — each tag is a specific, searchable amenity phrase, no duplicates, prioritize high-search terms"],
  "copywritingRationale": "string (brief explanation of the key choices made and how they address the audit score gaps)"
}

TITLE RULES (CRITICAL):
- Hard maximum: 50 characters (count carefully — this is enforced)
- Must include: location keyword (neighborhood or city)
- Must include: one standout amenity (pool, hot tub, views, etc.)
- Must include: a lifestyle/sensory word (dreamy, cozy, stunning, etc.)
- No ALL CAPS, no emojis, no special characters
- Use title case

DESCRIPTION RULES:
- Each section is standalone prose, not bullet points
- Opening hook: paint a picture of how the guest will FEEL, not what they'll see
- Amenity highlights: "You'll have..." or "Guests love..." framing
- Neighborhood: specific landmarks, walk times, local tips — concrete details
- CTA: warm, personal, not corporate — "We'd love to host you" energy
- Total combined description should be 200-350 words

AMENITY TAG RULES:
- 15-25 tags minimum
- Each is a specific searchable phrase (2-4 words max per tag)
- No duplicates or near-duplicates
- Prioritize tags that appear in Airbnb's search filters
- Include tags that match the property's actual amenities

Return ONLY the JSON object. No preamble, no explanation outside the JSON, no markdown code fences.`
}

// ─── Claude API Call ──────────────────────────────────────────────────────────

async function callClaudeForOptimization(prompt: string): Promise<{
  title: string
  description: {
    openingHook: string
    amenityHighlights: string
    neighborhoodSell: string
    guestCta: string
  }
  amenityTags: string[]
  copywritingRationale: string
}> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Strip any accidental markdown code fences
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: ReturnType<typeof callClaudeForOptimization> extends Promise<infer T> ? T : never

  try {
    parsed = JSON.parse(cleaned)
  } catch (parseError) {
    // Attempt to extract JSON from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error(`Claude returned non-JSON response: ${cleaned.slice(0, 200)}`)
    }
    parsed = JSON.parse(jsonMatch[0])
  }

  return parsed
}

// ─── Title Validation & Truncation ───────────────────────────────────────────

function enforceTitle50Chars(title: string): string {
  if (title.length <= 50) return title

  // Try smart truncation at word boundary
  const truncated = title.slice(0, 50)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > 35) {
    return truncated.slice(0, lastSpace).trim()
  }
  return truncated.trim()
}

// ─── Amenity Tag Deduplication & Ranking ─────────────────────────────────────

function processAmenityTags(rawTags: string[], propertyAmenities: string[]): string[] {
  // Normalize and deduplicate
  const seen = new Set<string>()
  const deduplicated: string[] = []

  for (const tag of rawTags) {
    const normalized = tag.trim().toLowerCase()
    if (normalized && !seen.has(normalized) && tag.trim().length > 0) {
      seen.add(normalized)
      deduplicated.push(tag.trim())
    }
  }

  // Score tags by whether they appear in HIGH_SEARCH_AMENITY_TERMS
  const highSearchLower = HIGH_SEARCH_AMENITY_TERMS.map((t) => t.toLowerCase())

  const scored = deduplicated.map((tag) => ({
    tag,
    priority: highSearchLower.some(
      (ht) => ht.includes(tag.toLowerCase()) || tag.toLowerCase().includes(ht)
    )
      ? 1
      : 0,
  }))

  scored.sort((a, b) => b.priority - a.priority)

  const result = scored.map((s) => s.tag)

  // Enforce 15-25 range
  if (result.length < 15) {
    // Supplement from property amenities
    const extras = propertyAmenities
      .filter((a) => !seen.has(a.toLowerCase()))
      .slice(0, 15 - result.length)
    result.push(...extras)
  }

  return result.slice(0, 25)
}

// ─── Supabase Storage ─────────────────────────────────────────────────────────

async function storeDeliverable(
  deliverable: Omit<ListingOptimizationDeliverable, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      property_id: deliverable.propertyId ?? null,
      session_id: deliverable.sessionId ?? null,
      type: deliverable.type,
      status: deliverable.status,
      payload: deliverable.payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to store deliverable in Supabase: ${error.message}`)
  }

  return data.id
}

// ─── Main Pipeline Function ───────────────────────────────────────────────────

export async function runListingOptimizationPipeline(params: {
  property: PropertyObject
  audit: AuditScoreBreakdown
  sessionId?: string
  propertyId?: string
}): Promise<{
  deliverableId: string
  payload: ListingOptimizationPayload
}> {
  const { property, audit, sessionId, propertyId } = params

  console.log(
    `[listing-optimization] Starting pipeline for property: ${property.title} (session: ${sessionId ?? 'none'})`
  )

  // 1. Analyze audit scores to identify lowest-performing areas
  const scoreAnalysis = analyzeAuditScores(audit)
  console.log(
    `[listing-optimization] Lowest scoring areas: ${scoreAnalysis.lowestCategories.map((c) => c.name).join(', ')}`
  )

  // 2. Build Claude prompt with audit context
  const prompt = buildOptimizationPrompt(property, audit, scoreAnalysis)

  // 3. Call Claude
  console.log('[listing-optimization] Calling Claude for copy generation...')
  const claudeOutput = await callClaudeForOptimization(prompt)

  // 4. Validate and enforce title character limit
  const validatedTitle = enforceTitle50Chars(claudeOutput.title)
  console.log(
    `[listing-optimization] Title: "${validatedTitle}" (${validatedTitle.length} chars)`
  )

  // 5. Process amenity tags (deduplicate, rank, enforce count)
  const processedTags = processAmenityTags(claudeOutput.amenityTags, property.amenities)
  console.log(`[listing-optimization] Generated ${processedTags.length} amenity tags`)

  // 6. Assemble full description
  const fullDescription = [
    claudeOutput.description.openingHook,
    claudeOutput.description.amenityHighlights,
    claudeOutput.description.neighborhoodSell,
    claudeOutput.description.guestCta,
  ]
    .filter(Boolean)
    .join('\n\n')

  // 7. Build structured payload
  const payload: ListingOptimizationPayload = {
    title: validatedTitle,
    titleCharCount: validatedTitle.length,
    description: {
      openingHook: claudeOutput.description.openingHook,
      amenityHighlights: claudeOutput.description.amenityHighlights,
      neighborhoodSell: claudeOutput.description.neighborhoodSell,
      guestCta: claudeOutput.description.guestCta,
      full: fullDescription,
    },
    amenityTags: processedTags,
    auditScoreContext: {
      overallScore: audit.overall,
      lowestCategories: scoreAnalysis.lowestCategories,
      improvements: scoreAnalysis.improvements.slice(0, 10),
    },
    generatedAt: new Date().toISOString(),
    model: 'claude-opus-4-5',
  }

  // 8. Store deliverable in Supabase
  console.log('[listing-optimization] Storing deliverable in Supabase...')
  const deliverableId = await storeDeliverable({
    propertyId,
    sessionId,
    type: 'listing_optimization',
    status: 'pending_review',
    payload,
  })

  console.log(`[listing-optimization] ✓ Deliverable stored: ${deliverableId}`)

  return { deliverableId, payload }
}

// ─── Queue Worker Handler ─────────────────────────────────────────────────────
// This follows the pattern of other workers in lib/queue/workers/

export async function handleListingOptimizationJob(jobData: {
  property: PropertyObject
  audit: AuditScoreBreakdown
  sessionId?: string
  propertyId?: string
}): Promise<void> {
  try {
    const result = await runListingOptimizationPipeline(jobData)
    console.log(
      `[listing-optimization] Job complete. Deliverable ID: ${result.deliverableId}`
    )
  } catch (error) {
    console.error('[listing-optimization] Job failed:', error)
    throw error // Re-throw so queue can handle retry logic
  }
}
