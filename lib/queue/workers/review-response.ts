/**
 * Review Response Worker
 * Generates AI-drafted review responses for unresponded reviews.
 * Runs for all Pro subscribers with scraped reviews.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import {
  buildReviewResponseSystemPrompt,
  classifyReviewSentiment,
} from '../../../lib/ai/prompts/review_response.mjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

interface Review {
  id: string
  property_id: string
  reviewer_name: string | null
  rating: number
  review_text: string
  review_date: string
  has_host_response: boolean
  platform: string
}

interface Property {
  id: string
  user_id: string
  name: string
  property_type: string | null
  location: string | null
  listing_url: string | null
}

interface VoiceProfile {
  tone?: string
  signOffName?: string
  alwaysUse?: string
  neverUse?: string
  personalityNotes?: string
}

interface ReviewResponseJob {
  propertyId?: string
  userId?: string
  // If omitted, runs for all Pro subscribers
}

/**
 * Check if a deliverable already exists for a given review
 */
async function getExistingDeliverable(reviewId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('content')
    .select('id, status')
    .eq('source_review_id', reviewId)
    .eq('type', 'review_response')
    .in('status', ['pending', 'approved', 'dismissed'])
    .maybeSingle()

  if (error) {
    console.error(`[review-response] Error checking existing deliverable for review ${reviewId}:`, error)
    return false
  }

  return !!data
}

/**
 * Generate a response for a single review using Claude
 */
async function generateResponse({
  review,
  property,
  voiceProfile,
}: {
  review: Review
  property: Property
  voiceProfile: VoiceProfile | null
}): Promise<string> {
  const sentiment = classifyReviewSentiment(review.rating)

  const systemPrompt = buildReviewResponseSystemPrompt({
    reviewText: review.review_text,
    rating: review.rating,
    sentiment,
    propertyName: property.name,
    propertyType: property.property_type || 'vacation rental',
    location: property.location || '',
    voiceProfile: voiceProfile
      ? formatVoiceProfile(voiceProfile)
      : null,
    guestName: review.reviewer_name || null,
  })

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Please write the review response now.`,
      },
    ],
    system: systemPrompt,
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  return content.text.trim()
}

/**
 * Format voice profile object into a readable string for the prompt
 */
function formatVoiceProfile(profile: VoiceProfile): string {
  const parts: string[] = []

  if (profile.tone) {
    parts.push(`Tone: ${profile.tone}`)
  }
  if (profile.signOffName) {
    parts.push(`Sign-off name: ${profile.signOffName}`)
  }
  if (profile.alwaysUse) {
    parts.push(`Always use: ${profile.alwaysUse}`)
  }
  if (profile.neverUse) {
    parts.push(`Never use / avoid: ${profile.neverUse}`)
  }
  if (profile.personalityNotes) {
    parts.push(`Personality / additional notes: ${profile.personalityNotes}`)
  }

  return parts.join('\n')
}

/**
 * Store a generated review response in the content table
 */
async function storeDeliverable({
  review,
  property,
  responseText,
  sentiment,
}: {
  review: Review
  property: Property
  responseText: string
  sentiment: 'positive' | 'neutral' | 'negative'
}): Promise<string> {
  const { data, error } = await supabase
    .from('content')
    .insert({
      property_id: property.id,
      user_id: property.user_id,
      type: 'review_response',
      status: 'pending',
      source_review_id: review.id,
      sentiment,
      is_negative: sentiment === 'negative',
      title: `Review Response — ${review.reviewer_name || 'Guest'} (${review.rating}★)`,
      body: responseText,
      metadata: {
        review_rating: review.rating,
        review_date: review.review_date,
        reviewer_name: review.reviewer_name,
        platform: review.platform,
        original_review: review.review_text,
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Failed to store deliverable: ${error.message}`)
  }

  return data.id
}

/**
 * Fetch Pro subscriber properties (optionally filtered)
 */
async function getProProperties(opts: ReviewResponseJob): Promise<Property[]> {
  let query = supabase
    .from('properties')
    .select('id, user_id, name, property_type, location, listing_url')
    .eq('active', true)

  // Filter to Pro subscribers only via join on users/subscriptions
  query = query.eq('subscription_tier', 'pro')

  if (opts.propertyId) {
    query = query.eq('id', opts.propertyId)
  } else if (opts.userId) {
    query = query.eq('user_id', opts.userId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`)
  }

  return data || []
}

/**
 * Fetch unresponded reviews for a property
 */
async function getUnrespondedReviews(propertyId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, property_id, reviewer_name, rating, review_text, review_date, has_host_response, platform')
    .eq('property_id', propertyId)
    .eq('has_host_response', false)
    .not('review_text', 'is', null)
    .neq('review_text', '')
    .order('review_date', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch reviews for property ${propertyId}: ${error.message}`)
  }

  return data || []
}

/**
 * Fetch voice profile for a user
 */
async function getVoiceProfile(userId: string): Promise<VoiceProfile | null> {
  const { data, error } = await supabase
    .from('voice_profiles')
    .select('profile_data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  return data.profile_data as VoiceProfile
}

/**
 * Main entry point — runs the review response generation task
 */
export async function runReviewResponseWorker(job: ReviewResponseJob = {}): Promise<{
  processed: number
  generated: number
  skipped: number
  errors: number
}> {
  console.log('[review-response] Starting review response generation task')

  const stats = { processed: 0, generated: 0, skipped: 0, errors: 0 }

  // Get properties to process
  const properties = await getProProperties(job)
  console.log(`[review-response] Found ${properties.length} properties to process`)

  for (const property of properties) {
    try {
      // Get voice profile for the owner
      const voiceProfile = await getVoiceProfile(property.user_id)

      // Get unresponded reviews
      const reviews = await getUnrespondedReviews(property.id)
      console.log(`[review-response] Property ${property.id} (${property.name}): ${reviews.length} unresponded reviews`)

      for (const review of reviews) {
        stats.processed++

        try {
          // Check if we already drafted a response for this review
          const alreadyExists = await getExistingDeliverable(review.id)
          if (alreadyExists) {
            console.log(`[review-response] Review ${review.id} already has a deliverable, skipping`)
            stats.skipped++
            continue
          }

          const sentiment = classifyReviewSentiment(review.rating)
          console.log(`[review-response] Generating ${sentiment} response for review ${review.id} (${review.rating}★)`)

          // Generate response via Claude
          const responseText = await generateResponse({
            review,
            property,
            voiceProfile,
          })

          // Store in content table
          const deliverableId = await storeDeliverable({
            review,
            property,
            responseText,
            sentiment,
          })

          console.log(`[review-response] ✓ Stored deliverable ${deliverableId} for review ${review.id}`)
          stats.generated++

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (reviewError) {
          console.error(`[review-response] Error processing review ${review.id}:`, reviewError)
          stats.errors++
        }
      }
    } catch (propertyError) {
      console.error(`[review-response] Error processing property ${property.id}:`, propertyError)
      stats.errors++
    }
  }

  console.log('[review-response] Task complete:', stats)
  return stats
}
