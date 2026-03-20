/**
 * fetchVoiceProfile.mjs
 *
 * Shared utility for all content generation pipelines to retrieve a stored
 * owner voice profile from Supabase and format it for injection into Claude prompts.
 *
 * Usage:
 *   import { getVoiceProfileForPrompt } from '../voice-profile/fetchVoiceProfile.mjs'
 *   const voiceContext = await getVoiceProfileForPrompt(userId)
 *   // voiceContext is a string — inject it into your Claude prompt
 */

import { createClient } from '@supabase/supabase-js'

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    // Warn but don't crash — callers fall back to neutral tone
    console.warn('[fetchVoiceProfile] Missing Supabase env vars — will use neutral tone fallback')
    return null
  }

  return createClient(url, key)
}

/**
 * Raw profile shape from Supabase
 * @typedef {{ id: string, user_id: string, profile_summary: string, tone_tags: string[], raw_answers: object, created_at: string, updated_at: string }} VoiceProfileRow
 */

/**
 * Fetch the stored voice profile for a user.
 *
 * @param {string} userId
 * @returns {Promise<VoiceProfileRow|null>} null if not found or on error
 */
export async function fetchVoiceProfile(userId) {
  if (!userId) return null

  const supabase = getSupabase()
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[fetchVoiceProfile] DB error:', error.message)
      return null
    }

    return data || null
  } catch (err) {
    console.error('[fetchVoiceProfile] Unexpected error:', err)
    return null
  }
}

/**
 * Returns a formatted string block ready to inject into any Claude prompt.
 * Falls back to a neutral tone instruction if no profile exists.
 *
 * @param {string|null|undefined} userId
 * @returns {Promise<string>}
 */
export async function getVoiceProfileForPrompt(userId) {
  if (!userId) {
    return NEUTRAL_TONE_FALLBACK
  }

  const profile = await fetchVoiceProfile(userId)

  if (!profile) {
    return NEUTRAL_TONE_FALLBACK
  }

  const tagsLine =
    profile.tone_tags && profile.tone_tags.length > 0
      ? `Tone tags: ${profile.tone_tags.join(', ')}`
      : ''

  return `## Owner Voice Profile
${profile.profile_summary}
${tagsLine}

Write in this owner's voice. Match their personality, energy level, and phrasing style. Do not sound generic or corporate.`.trim()
}

/**
 * Neutral fallback used when no voice profile exists.
 * Keeps content functional without personalization.
 */
export const NEUTRAL_TONE_FALLBACK = `## Owner Voice Profile
No custom voice profile available. Write in a warm, welcoming, and professional tone appropriate for a short-term rental host. Be friendly but not overly casual, and genuine rather than salesy.`
