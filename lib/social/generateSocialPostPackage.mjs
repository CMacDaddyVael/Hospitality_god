/**
 * generateSocialPostPackage
 *
 * Generates a complete weekly social media post package for a Pro user listing:
 *   - Instagram/TikTok caption (≤150 words, warm lifestyle tone)
 *   - 5 platform-relevant hashtags
 *   - One-line TikTok/Reels hook (first-frame text)
 *   - Image brief (150–200 word structured prompt for VAEL image gen)
 *
 * Writes a single `deliverables` row with type='social_post', status='pending'.
 * Upserts on (listing_id, week_of) to prevent duplicates.
 *
 * Usage:
 *   import { generateSocialPostPackage } from './lib/social/generateSocialPostPackage.mjs'
 *   await generateSocialPostPackage({ listingId, userId, weekOf: '2026-04-07' })
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Clients
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

  if (!url || !key) {
    throw new Error('Supabase env vars are not set (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Builds the Claude prompt from scraped listing data.
 * We inject as much property-specific detail as possible so output is never generic.
 */
function buildPrompt(listing, weekOf) {
  const {
    title = 'Vacation Rental',
    description = '',
    location = '',
    property_type: propertyType = 'property',
    amenities = [],
    airbnb_url: airbnbUrl = '',
    rating = null,
    review_count: reviewCount = null,
  } = listing

  // Pick the most distinctive amenities (up to 8) for the prompt
  const amenityList =
    Array.isArray(amenities) && amenities.length > 0
      ? amenities.slice(0, 8).join(', ')
      : 'various amenities'

  const ratingLine =
    rating && reviewCount ? `Guest rating: ${rating}/5 (${reviewCount} reviews).` : ''

  // Derive a simple season from the weekOf date for the image brief
  const month = weekOf ? new Date(weekOf).getMonth() + 1 : new Date().getMonth() + 1
  const season =
    month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
      ? 'summer'
      : month >= 9 && month <= 11
      ? 'autumn'
      : 'winter'

  const weekLabel = weekOf || new Date().toISOString().split('T')[0]

  return `You are a professional social media strategist and copywriter specializing in short-term rental (STR) lifestyle content. Your writing is warm, aspirational, and grounded in real property details — never generic filler.

## Property Details
- **Title:** ${title}
- **Location:** ${location}
- **Property type:** ${propertyType}
- **Amenities:** ${amenityList}
- **Description excerpt:** ${description.slice(0, 400)}${description.length > 400 ? '…' : ''}
${ratingLine}
- **Week of:** ${weekLabel}
- **Season:** ${season}

## Your Task
Generate a complete social media post package for the week of ${weekLabel}. Return ONLY valid JSON — no markdown fences, no extra commentary — matching this exact schema:

{
  "caption": "<string — Instagram + TikTok caption, max 150 words, warm lifestyle-forward tone, references specific property details, ends with a subtle CTA like 'Link in bio to book'>",
  "hashtags": ["<hashtag1>", "<hashtag2>", "<hashtag3>", "<hashtag4>", "<hashtag5>"],
  "hook": "<string — single line of punchy first-frame text optimized for TikTok/Reels, under 10 words, creates curiosity or FOMO>",
  "image_brief": "<string — 150 to 200 words describing the lifestyle scene to generate: property type, specific setting (e.g. wraparound porch at golden hour), time of day, season (${season}), mood (e.g. slow morning, celebratory arrival), what guests are doing (implied or explicit), color palette, camera angle (e.g. wide lifestyle shot), and any key prop or detail that ties back to the real amenities listed above. Written as a detailed generation prompt for an AI image model.>"
}

## Rules
- The caption MUST reference at least two specific, real details from the property (location, a named amenity, property type, or a distinctive feature from the description). No generic "beautiful retreat" filler without grounding it in specifics.
- Hashtags must be platform-relevant: mix property-specific (#[city]Airbnb), niche STR (#VacationRental, #STRlife), and lifestyle (#WeekendGetaway). All lowercase with no spaces.
- The hook must be punchy enough to stop a scroll — question, bold statement, or surprising stat.
- The image_brief must be detailed enough that an AI image generator produces a consistent, on-brand lifestyle shot without further prompting. Reference the actual season (${season}) and tie at least one visual element to a real amenity from the list above.
- Return ONLY the JSON object. No markdown code blocks. No explanation before or after.`
}

// ---------------------------------------------------------------------------
// Claude call
// ---------------------------------------------------------------------------

/**
 * Calls Claude and parses the structured JSON response.
 * @returns {{ caption, hashtags, hook, image_brief }}
 */
async function callClaude(prompt) {
  const client = getAnthropicClient()

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const raw = message.content?.[0]?.text?.trim()
  if (!raw) throw new Error('Claude returned empty response')

  // Strip markdown fences if Claude wrapped it anyway
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    throw new Error(`Failed to parse Claude JSON response: ${err.message}\nRaw: ${raw.slice(0, 300)}`)
  }

  // Validate required fields
  const required = ['caption', 'hashtags', 'hook', 'image_brief']
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`Claude response missing required field: "${field}"`)
    }
  }

  if (!Array.isArray(parsed.hashtags) || parsed.hashtags.length !== 5) {
    throw new Error(`Claude response must have exactly 5 hashtags, got: ${JSON.stringify(parsed.hashtags)}`)
  }

  return {
    caption: String(parsed.caption),
    hashtags: parsed.hashtags.map(String),
    hook: String(parsed.hook),
    image_brief: String(parsed.image_brief),
  }
}

// ---------------------------------------------------------------------------
// Database write
// ---------------------------------------------------------------------------

/**
 * Upserts the deliverable row.
 * Unique constraint: (listing_id, user_id, type, week_of)
 * If a row already exists for this listing + week, we update the content
 * so re-runs are idempotent rather than creating duplicates.
 */
async function writeDeliverable(supabase, { listingId, userId, weekOf, content }) {
  // Normalize weekOf to a Monday ISO date string (YYYY-MM-DD)
  const weekOfDate = weekOf || getWeekStart(new Date())

  // Check for existing row first (avoids needing a DB-level unique constraint)
  const { data: existing, error: selectError } = await supabase
    .from('deliverables')
    .select('id')
    .eq('listing_id', listingId)
    .eq('user_id', userId)
    .eq('type', 'social_post')
    .eq('week_of', weekOfDate)
    .maybeSingle()

  if (selectError) {
    throw new Error(`Supabase select error: ${selectError.message}`)
  }

  if (existing) {
    // Update existing row — keep status as-is (don't overwrite if owner already approved)
    const { data, error } = await supabase
      .from('deliverables')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw new Error(`Supabase update error: ${error.message}`)
    return { deliverable: data, created: false }
  }

  // Insert new row
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      listing_id: listingId,
      user_id: userId,
      type: 'social_post',
      status: 'pending',
      week_of: weekOfDate,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase insert error: ${error.message}`)
  return { deliverable: data, created: true }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ISO date string of the Monday of the current week.
 * Used when weekOf is not provided.
 */
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust to Monday
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate and persist a social post package for a single listing.
 *
 * @param {{ listingId: string, userId: string, weekOf?: string }} params
 *   listingId — UUID of the listing row in the `listings` table
 *   userId    — UUID of the owning user
 *   weekOf    — ISO date string for the week start (defaults to current Monday)
 *
 * @returns {{ deliverable, created, content }}
 */
export async function generateSocialPostPackage({ listingId, userId, weekOf }) {
  if (!listingId) throw new Error('listingId is required')
  if (!userId) throw new Error('userId is required')

  const weekOfDate = weekOf || getWeekStart(new Date())

  console.log(`[SocialPostPipeline] Starting for listing=${listingId} user=${userId} week=${weekOfDate}`)

  const supabase = getSupabaseClient()

  // 1. Fetch listing from database
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (listingError) {
    throw new Error(`Failed to fetch listing ${listingId}: ${listingError.message}`)
  }
  if (!listing) {
    throw new Error(`Listing ${listingId} not found`)
  }

  console.log(`[SocialPostPipeline] Fetched listing: "${listing.title}" in ${listing.location}`)

  // 2. Build Claude prompt with real listing data
  const prompt = buildPrompt(listing, weekOfDate)

  // 3. Call Claude
  console.log(`[SocialPostPipeline] Calling Claude for content generation…`)
  const aiContent = await callClaude(prompt)

  console.log(`[SocialPostPipeline] Claude response received:`)
  console.log(`  Hook: ${aiContent.hook}`)
  console.log(`  Caption (first 80 chars): ${aiContent.caption.slice(0, 80)}…`)
  console.log(`  Hashtags: ${aiContent.hashtags.join(' ')}`)

  // 4. Write to deliverables table
  const content = {
    caption: aiContent.caption,
    hashtags: aiContent.hashtags,
    hook: aiContent.hook,
    image_brief: aiContent.image_brief,
    listing_title: listing.title,
    listing_location: listing.location,
    generated_at: new Date().toISOString(),
  }

  const { deliverable, created } = await writeDeliverable(supabase, {
    listingId,
    userId,
    weekOf: weekOfDate,
    content,
  })

  console.log(
    `[SocialPostPipeline] Deliverable ${created ? 'created' : 'updated'}: id=${deliverable.id}`
  )

  return {
    deliverable,
    created,
    content,
  }
}

export default generateSocialPostPackage
