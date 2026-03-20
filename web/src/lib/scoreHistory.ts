/**
 * scoreHistory.ts
 *
 * Utilities for persisting and retrieving property score records.
 * Additive module — does not touch any existing scoring engine logic.
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase client (server-side usage)
// ---------------------------------------------------------------------------

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryScores {
  [category: string]: number
}

export interface PropertyScoreRecord {
  id: string
  property_id: string
  score: number
  category_scores: CategoryScores
  scored_at: string // ISO timestamp
}

export interface ScoreHistorySummary {
  records: PropertyScoreRecord[]
  /** Change in points from first to latest score this calendar month */
  monthlyDelta: number | null
  /** Score at beginning of this calendar month (or null if no record) */
  monthStartScore: number | null
  /** Most recent score */
  latestScore: number | null
}

// ---------------------------------------------------------------------------
// Persist a new score record
// ---------------------------------------------------------------------------

/**
 * Writes a new row to property_scores.
 * Call this after every scoring run (initial audit + weekly re-scores).
 * Does NOT modify any existing table or scoring logic.
 */
export async function persistPropertyScore(
  propertyId: string,
  score: number,
  categoryScores: CategoryScores = {}
): Promise<PropertyScoreRecord | null> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('property_scores')
      .insert({
        property_id: propertyId,
        score,
        category_scores: categoryScores,
        scored_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[scoreHistory] Failed to persist score:', error.message)
      return null
    }
    return data as PropertyScoreRecord
  } catch (err) {
    console.error('[scoreHistory] Unexpected error persisting score:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Fetch score history for a property
// ---------------------------------------------------------------------------

/**
 * Returns all score records for a property, ordered by scored_at ASC
 * (oldest first, suitable for chart rendering).
 */
export async function getPropertyScoreHistory(
  propertyId: string
): Promise<PropertyScoreRecord[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('property_scores')
    .select('id, property_id, score, category_scores, scored_at')
    .eq('property_id', propertyId)
    .order('scored_at', { ascending: true })

  if (error) {
    console.error('[scoreHistory] Failed to fetch score history:', error.message)
    return []
  }
  return (data ?? []) as PropertyScoreRecord[]
}

// ---------------------------------------------------------------------------
// Compute monthly summary
// ---------------------------------------------------------------------------

/**
 * Derives the monthly score delta from an ordered list of records.
 * "This month" = current calendar month (UTC).
 */
export function computeScoreHistorySummary(
  records: PropertyScoreRecord[]
): ScoreHistorySummary {
  if (records.length === 0) {
    return { records, monthlyDelta: null, monthStartScore: null, latestScore: null }
  }

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const thisMonthRecords = records.filter(
    (r) => new Date(r.scored_at) >= monthStart
  )

  const latestScore = records[records.length - 1].score
  const monthStartScore = thisMonthRecords.length > 0 ? thisMonthRecords[0].score : null
  const monthlyDelta =
    monthStartScore !== null ? latestScore - monthStartScore : null

  return { records, monthlyDelta, monthStartScore, latestScore }
}

// ---------------------------------------------------------------------------
// Weekly re-score eligibility check
// ---------------------------------------------------------------------------

/**
 * Returns true if the property has NOT been scored in the last 7 days.
 * Used by the weekly cron to decide whether to enqueue a re-score.
 */
export async function isRescoringDue(propertyId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('property_scores')
      .select('id')
      .eq('property_id', propertyId)
      .gte('scored_at', sevenDaysAgo)
      .limit(1)

    if (error) {
      console.error('[scoreHistory] isRescoringDue error:', error.message)
      return false // fail safe: don't trigger re-score if uncertain
    }

    return (data ?? []).length === 0 // due if no record in last 7 days
  } catch (err) {
    console.error('[scoreHistory] Unexpected error in isRescoringDue:', err)
    return false
  }
}
