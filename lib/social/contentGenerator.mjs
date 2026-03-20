/**
 * contentGenerator.mjs — updated to consume voice profile (issue #121)
 *
 * Changes from original:
 * - generateSocialPostPackage now accepts optional userId param
 * - Fetches voice profile when userId is provided and injects it into Claude prompts
 * - Falls back to neutral tone when no profile exists (zero behavior change for existing callers)
 */

import Anthropic from '@anthropic-ai/sdk'
import { getVoiceProfileForPrompt } from '../voice-profile/fetchVoiceProfile.mjs'
import { buildSocialCaptionPrompt } from '../ai/prompts/social_caption.mjs'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Generate a full social post package (captions + hashtags + posting schedule)
 * for a short-term rental property.
 *
 * @param {object} params
 * @param {string} [params.userId]            - Owner's user ID — used to fetch voice profile
 * @param {string} [params.propertyName]      - Property display name
 * @param {string} [params.propertyLocation]  - Location string, e.g. "Sedona, AZ"
 * @param {string} [params.theme]             - Content theme, e.g. "summer getaway"
 * @param {string[]} [params.amenities]       - List of notable amenities
 * @param {string} [params.platform]          - Target platform (default: instagram)
 * @param {string} [params.callToAction]      - CTA text
 * @param {number} [params.captionCount]      - Number of caption variants (default: 3)
 * @returns {Promise<{ captions: string[], rawResponse: string, voiceProfileUsed: boolean }>}
 */
export async function generateSocialPostPackage({
  userId,
  propertyName,
  propertyLocation,
  theme,
  amenities = [],
  platform = 'instagram',
  callToAction,
  captionCount = 3,
} = {}) {
  // Fetch voice profile — returns neutral fallback string if none found
  const voiceProfile = await getVoiceProfileForPrompt(userId)
  const voiceProfileUsed = userId != null && !voiceProfile.includes('No custom voice profile')

  const prompt = buildSocialCaptionPrompt({
    platform,
    theme,
    propertyName,
    propertyLocation,
    callToAction,
    amenities,
    voiceProfile,
    captionCount,
  })

  const message = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawResponse = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  // Parse out individual captions from the structured response
  const captions = parseCaptionsFromResponse(rawResponse, captionCount)

  return {
    captions,
    rawResponse,
    voiceProfileUsed,
  }
}

/**
 * Parse the numbered caption blocks out of Claude's structured response.
 *
 * @param {string} raw
 * @param {number} expectedCount
 * @returns {string[]}
 */
function parseCaptionsFromResponse(raw, expectedCount) {
  const captions = []
  const pattern = /CAPTION\s+\d+:\s*([\s\S]*?)(?=CAPTION\s+\d+:|$)/gi
  let match

  while ((match = pattern.exec(raw)) !== null) {
    const text = match[1].trim()
    if (text) captions.push(text)
  }

  // Fallback: if parsing failed for any reason, return the full raw text as one caption
  if (captions.length === 0 && raw) {
    return [raw]
  }

  return captions.slice(0, expectedCount)
}
