/**
 * Review Response Prompt
 * Issue #179 — Voice profile injection added (additive)
 *
 * IMPORTANT: Original prompt logic is unchanged. Voice profile block is
 * prepended to the system prompt when available. All existing callers
 * continue to work with zero-argument voice profile (uses default).
 */
import { buildVoiceSystemPromptBlock } from '../../voice/extractVoiceProfile.mjs'

/**
 * Builds a review response prompt.
 *
 * @param {Object} params
 * @param {string} params.reviewText         - The guest's review text
 * @param {string} params.rating             - Star rating (e.g. "5 stars")
 * @param {string} [params.propertyName]     - Name of the property
 * @param {Object} [params.voiceProfile]     - Voice profile from issue #179 (optional)
 * @returns {{ system: string, user: string }}
 */
export function buildReviewResponsePrompt({
  reviewText,
  rating,
  propertyName = 'our property',
  voiceProfile = null,
}) {
  const voiceBlock = buildVoiceSystemPromptBlock(voiceProfile)

  const system = `You are a short-term rental host writing a public response to a guest review on Airbnb or Vrbo.

${voiceBlock}

Guidelines:
- Keep responses concise (2-4 sentences for positive reviews, up to 6 for critical ones)
- Always thank the guest for staying and for their review
- For positive reviews: be warm and genuine, avoid sounding robotic
- For critical reviews: acknowledge the concern professionally, explain any relevant context, invite them back
- Never be defensive or argue with the guest publicly
- Do not repeat the same phrases in every response
- Write in first person as the host
- Do not use em dashes (—)`

  const user = `Write a host response to this ${rating} review of ${propertyName}:

"${reviewText}"

Response:`

  return { system, user }
}

/**
 * Legacy single-string export for backwards compatibility with existing callers
 * that pass the prompt directly as a string.
 *
 * @deprecated Use buildReviewResponsePrompt() instead for voice profile support
 */
export const reviewResponsePrompt = `You are a short-term rental host writing a thoughtful, genuine response to a guest review. 
Write in first person, be warm and personal, keep it concise (2-4 sentences for positive reviews, up to 6 for critical ones).
Thank the guest for staying. For critical reviews, acknowledge concerns professionally without being defensive.
Do not use em dashes (—). Avoid generic phrases like "We hope to see you again soon!"`
