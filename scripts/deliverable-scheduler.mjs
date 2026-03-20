#!/usr/bin/env node
/**
 * VAEL Host — Deliverable Generation Scheduler
 * Issue #127
 *
 * Runs daily (6:00 AM UTC via GitHub Actions / Vercel Cron).
 * Queries all active Pro subscribers, evaluates which deliverable
 * modules are due based on cadence config, and enqueues generation
 * jobs into the `generation_jobs` table.
 *
 * This is the "swarm works daily" engine at the core of VAEL Host.
 *
 * ADDITIVE — does NOT modify worker.mjs, dispatcher.mjs, or any
 * existing workflow files.
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[scheduler] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * All deliverable module types we support.
 * Default cadences applied when no explicit config exists for a user.
 */
const MODULE_DEFAULTS = {
  social_post:      { cadence: 'daily',   priority: 2 },
  listing_copy:     { cadence: 'weekly',  priority: 4 },
  review_response:  { cadence: 'daily',   priority: 1 },
  seasonal_update:  { cadence: 'monthly', priority: 6 },
  guest_message:    { cadence: 'weekly',  priority: 5 },
}

/** Cadence → minimum hours between runs */
const CADENCE_HOURS = {
  daily:   23,   // allow 1-hour drift window
  weekly:  167,  // allow 1-hour drift window
  monthly: 719,  // allow 1-hour drift window
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a module is due based on its last_generated_at and cadence.
 * Returns true if the job has never run, or if enough time has elapsed.
 */
function isDue(lastGeneratedAt, cadence) {
  if (!lastGeneratedAt) return true // never run → always due
  const minHours = CADENCE_HOURS[cadence] ?? CADENCE_HOURS.weekly
  const hoursSinceLast = (Date.now() - new Date(lastGeneratedAt).getTime()) / 3_600_000
  return hoursSinceLast >= minHours
}

/**
 * Ensure every active user has rows in `deliverable_cadence` for all modules.
 * Inserts defaults where missing (idempotent via ON CONFLICT DO NOTHING).
 */
async function ensureDefaultCadence(userIds) {
  const rows = []
  for (const userId of userIds) {
    for (const [module, defaults] of Object.entries(MODULE_DEFAULTS)) {
      rows.push({
        user_id: userId,
        module,
        cadence: defaults.cadence,
        enabled: true,
        listing_id: null,
      })
    }
  }

  if (rows.length === 0) return

  // Upsert in batches of 500 to avoid payload limits
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('deliverable_cadence')
      .upsert(rows.slice(i, i + BATCH), {
        onConflict: 'user_id,module,listing_id',
        ignoreDuplicates: true,
      })
    if (error) {
      console.warn('[scheduler] ensureDefaultCadence upsert warning:', error.message)
    }
  }
}

/**
 * Fetch cadence config for all active users in one query.
 * Returns a map: userId → [cadenceRow, ...]
 */
async function fetchCadenceMap(userIds) {
  const map = new Map()
  if (userIds.length === 0) return map

  const { data, error } = await supabase
    .from('deliverable_cadence')
    .select('user_id, module, cadence, enabled, last_generated_at, listing_id, config')
    .in('user_id', userIds)
    .eq('enabled', true)

  if (error) throw new Error(`fetchCadenceMap error: ${error.message}`)

  for (const row of data ?? []) {
    if (!map.has(row.user_id)) map.set(row.user_id, [])
    map.get(row.user_id).push(row)
  }
  return map
}

/**
 * Check which jobs are already pending/running today to avoid duplicates.
 * Returns a Set of `${userId}:${module}:${listingId ?? 'null'}` strings.
 */
async function fetchAlreadyQueuedToday(userIds) {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('generation_jobs')
    .select('user_id, job_type, listing_id')
    .in('user_id', userIds)
    .in('status', ['pending', 'running'])
    .gte('created_at', todayStart.toISOString())

  if (error) throw new Error(`fetchAlreadyQueuedToday error: ${error.message}`)

  const queued = new Set()
  for (const row of data ?? []) {
    queued.add(`${row.user_id}:${row.job_type}:${row.listing_id ?? 'null'}`)
  }
  return queued
}

/**
 * Enqueue a batch of generation_jobs rows.
 * Returns the count of successfully inserted rows.
 */
async function enqueueJobs(jobRows) {
  if (jobRows.length === 0) return 0

  const BATCH = 200
  let inserted = 0

  for (let i = 0; i < jobRows.length; i += BATCH) {
    const { data, error } = await supabase
      .from('generation_jobs')
      .insert(jobRows.slice(i, i + BATCH))
      .select('id')

    if (error) {
      console.error('[scheduler] enqueueJobs insert error:', error.message)
      // Don't throw — partial success is acceptable; log and continue
    } else {
      inserted += data?.length ?? 0
    }
  }
  return inserted
}

// ---------------------------------------------------------------------------
// Main scheduler logic
// ---------------------------------------------------------------------------

async function runScheduler() {
  const startMs = Date.now()
  console.log('[scheduler] Starting daily deliverable scheduler run —', new Date().toISOString())

  // 1. Open a run log entry
  const { data: runLogData, error: runLogErr } = await supabase
    .from('scheduler_run_log')
    .insert({
      run_date: new Date().toISOString().slice(0, 10),
      run_type: 'daily',
      status: 'running',
    })
    .select('id')
    .single()

  if (runLogErr) {
    // Non-fatal — log but continue
    console.warn('[scheduler] Could not create run log entry:', runLogErr.message)
  }
  const runLogId = runLogData?.id

  let usersEvaluated = 0
  let jobsQueued = 0
  let runStatus = 'complete'
  let runError = null

  try {
    // 2. Query all active Pro subscribers
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')                          // adjust table name if yours differs
      .select('id, email, listing_ids')
      .eq('subscription_status', 'active')

    if (usersError) throw new Error(`Failed to fetch active users: ${usersError.message}`)

    if (!activeUsers || activeUsers.length === 0) {
      console.log('[scheduler] No active subscribers found. Exiting.')
    } else {
      console.log(`[scheduler] Found ${activeUsers.length} active subscriber(s)`)
      usersEvaluated = activeUsers.length

      const userIds = activeUsers.map((u) => u.id)

      // 3. Ensure default cadence rows exist for all users
      await ensureDefaultCadence(userIds)

      // 4. Load cadence config
      const cadenceMap = await fetchCadenceMap(userIds)

      // 5. Load already-queued jobs today (idempotency guard)
      const alreadyQueued = await fetchAlreadyQueuedToday(userIds)

      // 6. Build job rows for modules that are due
      const jobRows = []

      for (const user of activeUsers) {
        const cadenceRows = cadenceMap.get(user.id) ?? []

        // If the user has listing_ids (array or comma-separated), we create
        // per-listing jobs. Otherwise we create one "global" job.
        const listingIds = normaliseListingIds(user.listing_ids)

        for (const cadence of cadenceRows) {
          if (!isDue(cadence.last_generated_at, cadence.cadence)) continue

          const targetListings = cadence.listing_id
            ? [cadence.listing_id]               // cadence is scoped to one listing
            : listingIds.length > 0
            ? listingIds                         // fan out to all user's listings
            : [null]                             // no listing scoping

          for (const listingId of targetListings) {
            const dedupeKey = `${user.id}:${cadence.module}:${listingId ?? 'null'}`
            if (alreadyQueued.has(dedupeKey)) continue

            jobRows.push({
              user_id:      user.id,
              listing_id:   listingId,
              job_type:     cadence.module,
              status:       'pending',
              priority:     MODULE_DEFAULTS[cadence.module]?.priority ?? 5,
              payload:      buildPayload(user, cadence, listingId),
              retry_count:  0,
              max_retries:  3,
              scheduled_for: new Date().toISOString(),
            })

            alreadyQueued.add(dedupeKey) // prevent dupes within this run
          }
        }
      }

      console.log(`[scheduler] Enqueuing ${jobRows.length} job(s)`)
      jobsQueued = await enqueueJobs(jobRows)
      console.log(`[scheduler] Successfully inserted ${jobsQueued} job(s)`)
    }
  } catch (err) {
    runStatus = 'failed'
    runError = err.message
    console.error('[scheduler] Run failed:', err)
  }

  // 7. Update run log with summary
  const durationMs = Date.now() - startMs
  if (runLogId) {
    await supabase
      .from('scheduler_run_log')
      .update({
        users_evaluated: usersEvaluated,
        jobs_queued:     jobsQueued,
        status:          runStatus,
        error_message:   runError,
        duration_ms:     durationMs,
        completed_at:    new Date().toISOString(),
      })
      .eq('id', runLogId)
  }

  console.log(
    `[scheduler] Run complete in ${durationMs}ms — ` +
    `users=${usersEvaluated}, queued=${jobsQueued}, status=${runStatus}`
  )

  if (runStatus === 'failed') {
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Normalise listing IDs from a user profile.
 * Handles: string[] | string (comma-separated) | null | undefined
 */
function normaliseListingIds(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') return raw.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

/**
 * Build the payload JSON stored on the job row.
 * Workers read this to know what to generate.
 */
function buildPayload(user, cadenceRow, listingId) {
  return {
    user_id:    user.id,
    email:      user.email,
    listing_id: listingId,
    module:     cadenceRow.module,
    cadence:    cadenceRow.cadence,
    config:     cadenceRow.config ?? {},
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

runScheduler().catch((err) => {
  console.error('[scheduler] Unhandled error:', err)
  process.exit(1)
})
