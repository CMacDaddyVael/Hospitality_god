/**
 * Listing Optimization Worker
 *
 * Triggered when a pro user saves a listing URL.
 * Calls Claude to generate:
 *   1. Rewritten title (< 50 chars)
 *   2. Rewritten description (seasonal hook + top 3 amenities foregrounded)
 *   3. 10 keyword/tag suggestions
 *
 * Each output is saved as a separate record in the content table.
 * Does NOT re-run if an approved version already exists for that property.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface ListingOptimizationJobPayload {
  propertyId: string
  userId: string
  listingUrl: string
  listingData: {
    title: string
    description: string
    amenities: string[]
    propertyType: string
    location: string
    rating?: number
    reviewCount?: number
  }
}

interface OptimizationResult {
  title: string
  description: string
  tags: string[]
}

/**
 * Check whether an approved optimization already exists for this property.
 * If it does, we skip the job to avoid overwriting accepted copy.
 */
async function hasApprovedOptimization(propertyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('content')
    .select('id')
    .eq('property_id', propertyId)
    .eq('type', 'listing_optimization')
    .eq('status', 'approved')
    .limit(1)

  if (error) {
    console.error('[listing-optimization] Error checking approved status:', error)
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Delete any existing pending/regenerating items for this property
 * so we start fresh (only relevant on first run, not after approval).
 */
async function clearPendingOptimizations(propertyId: string): Promise<void> {
  const { error } = await supabase
    .from('content')
    .delete()
    .eq('property_id', propertyId)
    .eq('type', 'listing_optimization')
    .in('status', ['pending', 'regenerating'])

  if (error) {
    console.error('[listing-optimization] Error clearing pending items:', error)
  }
}

/**
 * Call Claude to generate optimized listing content.
 */
async function generateOptimization(
  payload: ListingOptimizationJobPayload
): Promise<OptimizationResult> {
  const { listingData } = payload

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' })
  const currentSeason = getSeason(new Date().getMonth())

  const topAmenities = listingData.amenities?.slice(0, 10).join(', ') || 'not specified'

  const prompt = `You are an expert Airbnb listing copywriter. Your goal is to maximize search ranking and booking conversion.

## Property Details
- Current Title: ${listingData.title || 'No title provided'}
- Current Description: ${listingData.description || 'No description provided'}
- Property Type: ${listingData.propertyType || 'vacation rental'}
- Location: ${listingData.location || 'not specified'}
- Amenities: ${topAmenities}
- Rating: ${listingData.rating ? `${listingData.rating}/5 (${listingData.reviewCount} reviews)` : 'New listing'}
- Current Month: ${currentMonth} (${currentSeason})

## Your Task
Produce three optimized outputs. Return ONLY valid JSON in this exact structure:

{
  "title": "string — rewritten title, MUST be under 50 characters, compelling and searchable",
  "description": "string — rewritten description that: (1) opens with a seasonal hook relevant to ${currentSeason}, (2) foregrounds the top 3 most compelling amenities in the first paragraph, (3) uses short paragraphs for readability, (4) ends with a clear call to action. Aim for 150-250 words.",
  "tags": ["array", "of", "exactly", "10", "keyword", "strings", "optimized", "for", "airbnb", "search"]
}

## Constraints
- Title MUST be under 50 characters (count carefully)
- Description must open with a seasonal hook for ${currentSeason}/${currentMonth}
- Top 3 amenities must appear in the first paragraph of the description
- Tags must be specific, searchable phrases (not generic words like "cozy" alone)
- Write in a warm, inviting tone that converts browsers to bookers
- Do not hallucinate amenities that aren't listed above`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
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

  // Extract JSON from the response (Claude sometimes wraps in markdown)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Claude did not return valid JSON. Raw response: ${rawText.slice(0, 200)}`)
  }

  const parsed = JSON.parse(jsonMatch[0]) as OptimizationResult

  // Enforce title length constraint
  if (parsed.title && parsed.title.length > 50) {
    parsed.title = parsed.title.slice(0, 50).trimEnd()
  }

  // Enforce exactly 10 tags
  if (!Array.isArray(parsed.tags)) {
    parsed.tags = []
  }
  parsed.tags = parsed.tags.slice(0, 10)

  return parsed
}

/**
 * Save each optimization output as a separate content record.
 */
async function saveContentItems(
  payload: ListingOptimizationJobPayload,
  result: OptimizationResult
): Promise<void> {
  const { propertyId, userId, listingData } = payload

  const items = [
    {
      property_id: propertyId,
      user_id: userId,
      type: 'listing_optimization',
      subtype: 'title',
      status: 'pending',
      original_text: listingData.title || '',
      ai_text: result.title,
      metadata: {
        character_count: result.title.length,
        max_characters: 50,
      },
    },
    {
      property_id: propertyId,
      user_id: userId,
      type: 'listing_optimization',
      subtype: 'description',
      status: 'pending',
      original_text: listingData.description || '',
      ai_text: result.description,
      metadata: {
        word_count: result.description.split(/\s+/).length,
      },
    },
    {
      property_id: propertyId,
      user_id: userId,
      type: 'listing_optimization',
      subtype: 'tags',
      status: 'pending',
      original_text: '', // Tags usually don't have an "original" to compare
      ai_text: result.tags.join('\n'),
      metadata: {
        tags: result.tags,
        tag_count: result.tags.length,
      },
    },
  ]

  const { error } = await supabase.from('content').insert(items)

  if (error) {
    throw new Error(`Failed to save content items: ${error.message}`)
  }

  console.log(
    `[listing-optimization] Saved 3 content items for property ${propertyId}`
  )
}

/**
 * Update the property record to mark optimization as completed.
 */
async function markOptimizationComplete(propertyId: string): Promise<void> {
  const { error } = await supabase
    .from('properties')
    .update({ optimization_completed_at: new Date().toISOString() })
    .eq('id', propertyId)

  if (error) {
    console.error('[listing-optimization] Failed to mark complete:', error)
  }
}

/**
 * Main job runner — called by the queue executor.
 */
export async function runListingOptimizationJob(
  payload: ListingOptimizationJobPayload
): Promise<void> {
  const { propertyId, userId } = payload

  console.log(`[listing-optimization] Starting job for property ${propertyId}, user ${userId}`)

  // Guard: skip if approved version already exists
  const alreadyApproved = await hasApprovedOptimization(propertyId)
  if (alreadyApproved) {
    console.log(
      `[listing-optimization] Skipping — approved optimization already exists for property ${propertyId}`
    )
    return
  }

  // Clear any stale pending items before generating fresh ones
  await clearPendingOptimizations(propertyId)

  // Generate optimized content via Claude
  console.log(`[listing-optimization] Calling Claude for property ${propertyId}`)
  const result = await generateOptimization(payload)

  // Persist to content table
  await saveContentItems(payload, result)

  // Update property record
  await markOptimizationComplete(propertyId)

  console.log(`[listing-optimization] Job complete for property ${propertyId}`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSeason(month: number): string {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}
