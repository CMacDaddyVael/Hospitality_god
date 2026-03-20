/**
 * Review Response Queue Worker
 * Issue #179 — Voice profile injection added (additive)
 *
 * MODIFICATION: Fetches voice profile from Supabase and injects it into
 * the review response prompt. All existing logic is preserved.
 */
import type { Job } from '../types'

export async function processReviewResponse(job: Job): Promise<void> {
  const { propertyId, reviewText, rating, propertyName } = job.data

  // Dynamically import to keep ESM/CJS compat
  const { buildReviewResponsePrompt } = await import('../../ai/prompts/review_response.mjs')
  const { getPropertyVoiceProfile } = await import('../../voice/getPropertyVoiceProfile.mjs')

  // Fetch voice profile — falls back to default if not available
  const voiceProfile = propertyId
    ? await getPropertyVoiceProfile(propertyId)
    : null

  const { system, user } = buildReviewResponsePrompt({
    reviewText: reviewText ?? '',
    rating: rating ?? '5 stars',
    propertyName: propertyName ?? 'our property',
    voiceProfile,
  })

  // Import Claude client
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 512,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const responseText = message.content[0]?.type === 'text' ? message.content[0].text : ''

  console.log(
    `[review-response] Generated response for property ${propertyId ?? 'unknown'} ` +
    `(voice confidence: ${voiceProfile?.voice_profile_confidence ?? 'n/a'})`
  )

  // Store result back on job data for downstream handlers
  job.data.result = responseText
}
