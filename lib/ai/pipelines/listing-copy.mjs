/**
 * Listing Copy Optimization Pipeline
 * Issue #137 — Generate rewritten title, description, and highlights via Claude
 *
 * This pipeline:
 * 1. Fetches scraped listing data + audit scores from Supabase
 * 2. Sends a structured prompt to Claude
 * 3. Validates the response (title ≤50 chars, description 200-500 words, 5 highlights)
 * 4. Inserts a deliverable row into Supabase with type: listing_copy, status: pending
 * 5. Retries once on failure, then marks status: failed with error logged
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Clients (lazy-initialised so the module can be imported without env vars)
// ---------------------------------------------------------------------------

function getAnthropicClient() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey: key })
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are not set')
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function fetchListingData(supabase, listingId) {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error) throw new Error(`Failed to fetch listing ${listingId}: ${error.message}`)
  if (!data) throw new Error(`Listing ${listingId} not found`)
  return data
}

async function fetchAuditData(supabase, auditId) {
  const { data, error } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (error) throw new Error(`Failed to fetch audit ${auditId}: ${error.message}`)
  if (!data) throw new Error(`Audit ${auditId} not found`)
  return data
}

async function insertDeliverable(supabase, { listingId, auditId, content, status, errorMessage }) {
  const row = {
    listing_id: listingId,
    audit_id: auditId,
    type: 'listing_copy',
    status,
    content: content || null,
    error_message: errorMessage || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('deliverables').insert(row).select().single()

  if (error) throw new Error(`Failed to insert deliverable: ${error.message}`)
  return data
}

async function updateDeliverable(supabase, deliverableId, { status, content, errorMessage }) {
  const { error } = await supabase
    .from('deliverables')
    .update({
      status,
      content: content || null,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deliverableId)

  if (error) throw new Error(`Failed to update deliverable ${deliverableId}: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Reads relevant Airbnb optimisation context from the knowledge base
 * (inline so this module stays self-contained and importable from scripts)
 */
const AIRBNB_ALGORITHM_CONTEXT = `
AIRBNB SEARCH ALGORITHM OPTIMISATION KNOWLEDGE:

1. TITLE OPTIMISATION (≤50 characters)
   - Front-load the strongest differentiator in the first 3 words
   - Include the property type AND a key unique feature (e.g. "pool", "mountain view", "downtown")
   - Use title case; avoid ALL CAPS and filler words ("cozy", "beautiful", "amazing")
   - Guests scan titles in under 2 seconds — every word must earn its place
   - Examples of high-performing patterns:
     "Lakefront Cabin · Hot Tub + Kayaks"
     "Designer Loft | Steps to French Quarter"
     "3BR Beach House — Private Pool & Dock"

2. DESCRIPTION OPTIMISATION (200-500 words)
   - First 2 sentences are critical — they appear in search preview before "Read more"
   - Open with the guest experience, not features ("Wake up to panoramic mountain views…")
   - Structure: Hook → Space overview → Standout amenities → Location & access → Guest experience promise
   - Use short paragraphs (2-4 sentences) for mobile readability
   - Embed searchable keywords naturally: neighbourhood name, nearby landmarks, property type
   - Avoid corporate tone — write like a knowledgeable local friend
   - End with a soft CTA that creates urgency without pressure

3. HIGHLIGHTS / HOUSE RULES BULLETS (exactly 5)
   - Each bullet = one specific, concrete benefit or feature
   - Lead with the noun, not an adjective ("Private heated pool" not "Luxurious swimming")
   - Include at least one location benefit, one unique amenity, one practical convenience
   - Keep each bullet under 10 words
   - Think: what would make a guest stop scrolling and click?

4. AIRBNB RANKING SIGNALS (inform your copy)
   - Listings with high-quality copy see 20-35% higher click-through rates
   - Airbnb's search rewards: recency of listing updates, guest save rate, click-through rate
   - Copy that clearly communicates unique value reduces pre-booking questions → improves host response score
   - Seasonal language updates signal an active, engaged host to Airbnb's algorithm
`.trim()

function buildPrompt({ listing, audit }) {
  // Safely extract fields from listing — handle various schema shapes
  const title = listing.title || listing.listing_title || '(no title)'
  const description = listing.description || listing.listing_description || '(no description)'
  const photoCount =
    listing.photo_count ??
    (Array.isArray(listing.photos) ? listing.photos.length : null) ??
    'unknown'
  const propertyType = listing.property_type || listing.propertyType || 'property'
  const location =
    listing.location || listing.city || listing.neighbourhood || 'unknown location'
  const amenities = Array.isArray(listing.amenities)
    ? listing.amenities.slice(0, 20).join(', ')
    : listing.amenities || 'not specified'

  // Safely extract audit scores
  const scores = audit?.scores || audit?.category_scores || {}
  const overallScore = audit?.overall_score ?? audit?.score ?? 'unknown'

  const scoresBlock =
    Object.keys(scores).length > 0
      ? Object.entries(scores)
          .map(([k, v]) => `  - ${k}: ${v}/100`)
          .join('\n')
      : '  (no category scores available)'

  return `You are an expert Airbnb listing copywriter and STR marketing specialist. Your job is to rewrite this listing's copy to maximise Airbnb search ranking and guest conversion.

${AIRBNB_ALGORITHM_CONTEXT}

---

CURRENT LISTING DATA:
- Title: ${title}
- Property type: ${propertyType}
- Location: ${location}
- Photo count: ${photoCount}
- Amenities: ${amenities}

CURRENT DESCRIPTION:
"""
${description}
"""

AUDIT SCORES (out of 100):
- Overall score: ${overallScore}
${scoresBlock}

---

TASK: Produce an optimised listing copy rewrite. Return ONLY a valid JSON object with exactly this structure (no markdown, no extra text, just the raw JSON):

{
  "title": "<rewritten title, max 50 characters>",
  "description": "<rewritten description, 200-500 words, Airbnb-optimised>",
  "highlights": [
    "<highlight 1>",
    "<highlight 2>",
    "<highlight 3>",
    "<highlight 4>",
    "<highlight 5>"
  ]
}

CONSTRAINTS:
- "title" MUST be ≤50 characters (count them carefully)
- "description" MUST be between 200 and 500 words
- "highlights" MUST be an array of EXACTLY 5 strings
- Do not add any commentary, markdown formatting, or explanation outside the JSON object`
}

// ---------------------------------------------------------------------------
// Response parser + validator
// ---------------------------------------------------------------------------

/**
 * @param {string} rawText — raw text from Claude
 * @returns {{ title: string, description: string, highlights: string[] }}
 * @throws Error with a descriptive message if validation fails
 */
function parseAndValidate(rawText) {
  // Strip any accidental markdown code fences Claude might add
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Claude response is not valid JSON: ${err.message}\n\nRaw response:\n${rawText.slice(0, 500)}`)
  }

  // Validate title
  if (typeof parsed.title !== 'string' || parsed.title.trim() === '') {
    throw new Error(`Missing or empty "title" field in Claude response`)
  }
  if (parsed.title.length > 50) {
    throw new Error(
      `Title exceeds 50 characters (got ${parsed.title.length}): "${parsed.title}"`
    )
  }

  // Validate description
  if (typeof parsed.description !== 'string' || parsed.description.trim() === '') {
    throw new Error(`Missing or empty "description" field in Claude response`)
  }
  const wordCount = parsed.description.trim().split(/\s+/).length
  if (wordCount < 200 || wordCount > 500) {
    throw new Error(
      `Description word count out of range (got ${wordCount} words, need 200-500)`
    )
  }

  // Validate highlights
  if (!Array.isArray(parsed.highlights)) {
    throw new Error(`"highlights" field must be an array`)
  }
  if (parsed.highlights.length !== 5) {
    throw new Error(
      `"highlights" must contain exactly 5 items (got ${parsed.highlights.length})`
    )
  }
  for (let i = 0; i < parsed.highlights.length; i++) {
    if (typeof parsed.highlights[i] !== 'string' || parsed.highlights[i].trim() === '') {
      throw new Error(`highlights[${i}] is empty or not a string`)
    }
  }

  return {
    title: parsed.title.trim(),
    description: parsed.description.trim(),
    highlights: parsed.highlights.map((h) => h.trim()),
  }
}

// ---------------------------------------------------------------------------
// Claude call (single attempt)
// ---------------------------------------------------------------------------

async function callClaude(anthropic, prompt) {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract text content from the response
  const textBlock = message.content.find((block) => block.type === 'text')
  if (!textBlock) {
    throw new Error('Claude returned no text content in response')
  }
  return textBlock.text
}

// ---------------------------------------------------------------------------
// Core pipeline function (single attempt)
// ---------------------------------------------------------------------------

async function runPipelineAttempt({ anthropic, listing, audit }) {
  const prompt = buildPrompt({ listing, audit })
  const rawResponse = await callClaude(anthropic, prompt)
  const validated = parseAndValidate(rawResponse)
  return validated
}

// ---------------------------------------------------------------------------
// Public API — generateListingCopy
// ---------------------------------------------------------------------------

/**
 * Main entry point for the listing copy optimization pipeline.
 *
 * @param {string} listingId — UUID of the listing row in Supabase
 * @param {string} auditId   — UUID of the audit row in Supabase
 * @param {object} [options]
 * @param {object} [options.supabase] — optional pre-built Supabase client (for testing)
 * @param {object} [options.anthropic] — optional pre-built Anthropic client (for testing)
 * @returns {Promise<{ deliverableId: string, content: object }>}
 */
export async function generateListingCopy(listingId, auditId, options = {}) {
  if (!listingId) throw new Error('listingId is required')
  if (!auditId) throw new Error('auditId is required')

  const supabase = options.supabase || getSupabaseClient()
  const anthropic = options.anthropic || getAnthropicClient()

  console.log(`[listing-copy] Starting pipeline for listing=${listingId} audit=${auditId}`)

  // 1. Fetch data from Supabase
  let listing, audit
  try {
    ;[listing, audit] = await Promise.all([
      fetchListingData(supabase, listingId),
      fetchAuditData(supabase, auditId),
    ])
    console.log(`[listing-copy] Fetched listing "${listing.title || listingId}" and audit`)
  } catch (fetchError) {
    console.error(`[listing-copy] Data fetch failed:`, fetchError.message)
    // Can't even insert a deliverable without a listing_id — rethrow
    throw fetchError
  }

  // 2. Attempt 1
  let content = null
  let lastError = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[listing-copy] Claude attempt ${attempt}/2...`)
      content = await runPipelineAttempt({ anthropic, listing, audit })
      console.log(
        `[listing-copy] Attempt ${attempt} succeeded. Title: "${content.title}" (${content.title.length} chars)`
      )
      break // success — exit retry loop
    } catch (err) {
      lastError = err
      console.error(`[listing-copy] Attempt ${attempt} failed:`, err.message)
      if (attempt < 2) {
        console.log(`[listing-copy] Retrying in 3 seconds...`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }

  // 3. Insert deliverable row
  if (content) {
    // Success — insert pending deliverable for owner approval
    const deliverable = await insertDeliverable(supabase, {
      listingId,
      auditId,
      content,
      status: 'pending',
    })
    console.log(`[listing-copy] Deliverable inserted with id=${deliverable.id} status=pending`)
    return { deliverableId: deliverable.id, content }
  } else {
    // Both attempts failed — insert failed deliverable and log
    console.error(`[listing-copy] Both attempts failed. Inserting failed deliverable.`)
    console.error(`[listing-copy] Final error:`, lastError?.message)

    const deliverable = await insertDeliverable(supabase, {
      listingId,
      auditId,
      content: null,
      status: 'failed',
      errorMessage: lastError?.message || 'Unknown error',
    })
    console.error(`[listing-copy] Failed deliverable inserted with id=${deliverable.id}`)

    // Do NOT throw silently — re-throw so callers (scheduler, onboarding) know it failed
    throw new Error(
      `Listing copy generation failed after 2 attempts: ${lastError?.message}`
    )
  }
}

// ---------------------------------------------------------------------------
// Named export for scheduler / onboarding flow compatibility
// ---------------------------------------------------------------------------

export default generateListingCopy
