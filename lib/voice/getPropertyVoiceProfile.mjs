/**
 * Utility to fetch a property's voice profile from Supabase,
 * falling back to the default profile if none is stored.
 *
 * Issue #179 — Used by review response, guest comms, and other pipelines.
 */
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_VOICE_PROFILE } from './extractVoiceProfile.mjs'

/**
 * Fetches the voice profile for a property from Supabase.
 * Returns the default profile if none exists or on error.
 *
 * @param {string} propertyId
 * @returns {Promise<import('./extractVoiceProfile.mjs').VoiceProfile>}
 */
export async function getPropertyVoiceProfile(propertyId) {
  if (!propertyId) {
    return { ...DEFAULT_VOICE_PROFILE, fallback_reason: 'no_property_id' }
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data, error } = await supabase
      .from('properties')
      .select('voice_profile')
      .eq('id', propertyId)
      .single()

    if (error || !data?.voice_profile) {
      return { ...DEFAULT_VOICE_PROFILE, fallback_reason: 'not_found_in_db' }
    }

    return data.voice_profile
  } catch (err) {
    console.error('[voice] Failed to fetch voice profile from Supabase:', err?.message)
    return { ...DEFAULT_VOICE_PROFILE, fallback_reason: 'db_fetch_error' }
  }
}
