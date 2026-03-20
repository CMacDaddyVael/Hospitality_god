/**
 * Helper called from the onboarding pipeline after scraping completes.
 * Extracts voice profile and persists to Supabase — non-blocking, fire-and-forget
 * safe when called with .catch().
 *
 * Issue #179 — Additive integration hook for onboarding pipeline.
 */
import { extractVoiceProfile } from './extractVoiceProfile.mjs'
import { createClient } from '@supabase/supabase-js'

/**
 * Runs voice extraction and saves to Supabase.
 * Designed to be safe as a non-blocking fire-and-forget call.
 *
 * @param {Object} params
 * @param {string} params.propertyId             - Supabase property row ID
 * @param {string} [params.listingDescription]   - Scraped listing description
 * @param {string[]} [params.hostReviewResponses] - Scraped host review responses
 * @param {string} [params.propertyTitle]         - Scraped listing title
 * @returns {Promise<import('./extractVoiceProfile.mjs').VoiceProfile>}
 */
export async function triggerVoiceExtraction({
  propertyId,
  listingDescription = '',
  hostReviewResponses = [],
  propertyTitle = '',
}) {
  if (!propertyId) {
    console.warn('[voice-extraction] triggerVoiceExtraction called without propertyId — skipping')
    return null
  }

  console.log(`[voice-extraction] Starting extraction for property ${propertyId}`)

  const voiceProfile = await extractVoiceProfile({
    listingDescription,
    hostReviewResponses: Array.isArray(hostReviewResponses) ? hostReviewResponses : [],
    propertyTitle,
  })

  console.log(
    `[voice-extraction] Extracted profile for ${propertyId}: tone=${voiceProfile.tone}, confidence=${voiceProfile.voice_profile_confidence}`
  )

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error } = await supabase
      .from('properties')
      .update({ voice_profile: voiceProfile })
      .eq('id', propertyId)

    if (error) {
      console.error('[voice-extraction] Failed to persist voice profile:', error.message)
    } else {
      console.log(`[voice-extraction] Voice profile saved for property ${propertyId}`)
    }
  } catch (dbErr) {
    console.error('[voice-extraction] DB error during voice profile save:', dbErr?.message)
  }

  return voiceProfile
}
