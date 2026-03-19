/**
 * Seeds default autonomy settings for a new user.
 * Called after user signs up / completes onboarding.
 */

import { createClient } from '@/lib/supabase/server'
import { ALL_CONTENT_TYPES, CONTENT_TYPE_CONFIGS } from './constants'

export async function seedDefaultAutonomySettings(userId: string): Promise<void> {
  const supabase = await createClient()

  const rows = ALL_CONTENT_TYPES.map((contentType) => ({
    user_id: userId,
    content_type: contentType,
    autonomy_level: 'suggest' as const,
    risk_tier: CONTENT_TYPE_CONFIGS[contentType].riskTier,
    is_paused: false,
  }))

  const { error } = await supabase
    .from('autonomy_settings')
    .upsert(rows, { onConflict: 'user_id,content_type', ignoreDuplicates: true })

  if (error) {
    console.error('[autonomy] Failed to seed default settings:', error)
    throw error
  }
}

export async function seedDefaultConfidenceScores(userId: string): Promise<void> {
  const supabase = await createClient()

  const rows = ALL_CONTENT_TYPES.map((contentType) => ({
    user_id: userId,
    content_type: contentType,
    total_actions: 0,
    approved_unchanged: 0,
    approved_edited: 0,
    rejected: 0,
    approval_rate: 0,
    last_20_total: 0,
    last_20_approved_unchanged: 0,
  }))

  const { error } = await supabase
    .from('confidence_scores')
    .upsert(rows, { onConflict: 'user_id,content_type', ignoreDuplicates: true })

  if (error) {
    console.error('[autonomy] Failed to seed confidence scores:', error)
    throw error
  }
}
