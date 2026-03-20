/**
 * review-response worker — updated to consume voice profile (issue #121)
 *
 * Changes from original:
 * - Imports getVoiceProfileForPrompt
 * - Passes voiceProfile to buildReviewResponsePrompt when userId available
 * - Falls back to neutral tone when no profile found (zero behavior change for existing jobs)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Job } from '../types'
import { buildReviewResponsePrompt } from '../../ai/prompts/review_response.mjs'
import { getVoiceProfileForPrompt } from '../../voice-profile/fetchVoiceProfile.mjs'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ReviewResponseJobData {
  userId?: string
  reviewText: string
  rating: number
  guestName?: string
  propertyName?: string
  listingId?: string
}

/**
 * Process a review-response job.
 * Fetches owner voice profile (if userId present) and generates a personalized response.
 */
export async function processReviewResponseJob(job: Job): Promise<void> {
  const data = job.data as ReviewResponseJobData

  if (!data.reviewText || typeof data.rating !== 'number') {
    throw new Error('reviewText and rating are required for review response jobs')
  }

  // Fetch voice profile — neutral fallback string returned if none exists
  const voiceProfile = await getVoiceProfileForPrompt(data.userId)

  const prompt = buildReviewResponsePrompt({
    reviewText: data.reviewText,
    rating: data.rating,
    guestName: data.guestName,
    propertyName: data.propertyName,
    voiceProfile,
  })

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Store the result — the existing job result mechanism handles persistence
  job.result = {
    responseText,
    voiceProfileUsed: !!data.userId,
    generatedAt: new Date().toISOString(),
  }
}
