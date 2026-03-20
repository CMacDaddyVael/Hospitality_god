#!/usr/bin/env node
/**
 * VAEL Host — Generation Job Worker
 * Issue #127
 *
 * Polls the `generation_jobs` table for pending jobs, claims them,
 * executes the appropriate generation function, and marks them
 * complete or failed (with retry / exponential backoff).
 *
 * Run by the GitHub Actions workflow `.github/workflows/job-worker.yml`
 * or by the Vercel cron endpoint `web/src/app/api/workers/process-jobs/route.ts`.
 *
 * ADDITIVE — does NOT modify worker.mjs, dispatcher.mjs, or any
 * existing workflow files.
 */

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Generators — these adapt the existing lib/ modules to the job interface
// ---------------------------------------------------------------------------
// Dynamic imports keep the worker loadable even if one module is unavailable.

async function loadGenerator(jobType) {
  try {
    switch (jobType) {
      case 'social_post':
        return (await import('../lib/claude-engine/generate-content.mjs')).default
      case 'listing_copy': {
        const mod = await import('../lib/ai/prompts/listing_rewrite.mjs')
        return mod.generateListingRewrite ?? mod.default
      }
      case 'review_response': {
        const mod = await import('../lib/ai/prompts/review_response.mjs')
        return mod.generateReviewResponse ?? mod.default
      }
      case 'guest_message': {
        const mod = await import('../lib/ai/prompts/guest_message.mjs')
        return mod.generateGuestMessage ?? mod.default
      }
      case 'seasonal_update': {
        // Seasonal update reuses listing rewrite with a seasonal context flag
        const mod = await import('../lib/ai/prompts/listing_rewrite.mjs')
        const fn = mod.generateListingRewrite ?? mod.default
        if (!fn) return null
        // Wrap to inject seasonal flag into payload
        return async (payload) => fn({ ...payload, seasonal: true })
      }
      default:
        return null
    }
  } catch (err) {
    console.warn(`[job-worker] Could not load generator for ${jobType}:`, err.message)
    return null
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[job-worker] FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Max jobs to process in a single worker invocation (Vercel timeout safety) */
const MAX_JOBS_PER_RUN = parseInt(process.env.MAX_JOBS_PER_RUN ?? '20', 10)

/** Base delay (ms) for exponential backoff: delay = BASE_BACKOFF_MS * 2^retryCount */
const BASE_BACKOFF_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Core worker logic
// ---------------------------------------------------------------------------

/**
 * Atomically claim the next pending job.
 * Uses a status transition pending→running to prevent double-processing.
 */
async function claimNextJob() {
  // Find the oldest, highest-priority pending job that is scheduled to run now
  const { data: candidates, error: selectErr } = await supabase
    .from('generation_jobs')
    .select('id, user_id, listing_id, job_type, payload, retry_count, max_retries')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('scheduled_for', { ascending: true })
    .limit(1)

  if (selectErr) throw new Error(`claimNextJob select error: ${selectErr.message}`)
  if (!candidates || candidates.length === 0) return null

  const job = candidates[0]

  // Atomic claim: only update if still 'pending' (optimistic concurrency)
  const { data: claimed, error: claimErr } = await supabase
    .from('generation_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')   // guard clause
    .select('id')
    .single()

  if (claimErr || !claimed) {
    // Another worker claimed it first — skip silently
    return null
  }

  return job
}

/**
 * Mark a job as complete and update cadence last_generated_at.
 */
async function completeJob(job, result) {
  await supabase
    .from('generation_jobs')
    .update({
      status:       'complete',
      result:       result ?? {},
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  // Update the cadence tracker so we don't re-generate too soon
  await supabase
    .from('deliverable_cadence')
    .update({ last_generated_at: new Date().toISOString() })
    .eq('user_id', job.user_id)
    .eq('module', job.job_type)
    .eq(
      'listing_id',
      job.listing_id === null ? null : job.listing_id
    )
}

/**
 * Mark a job as failed. If retries remain, re-queue with exponential backoff.
 * If retry_count >= max_retries, mark permanently failed.
 */
async function failJob(job, errorMessage) {
  const newRetryCount = (job.retry_count ?? 0) + 1
  const exhausted = newRetryCount >= (job.max_retries ?? 3)

  if (exhausted) {
    await supabase
      .from('generation_jobs')
      .update({
        status:        'failed',
        error_message: errorMessage,
        retry_count:   newRetryCount,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', job.id)

    console.warn(
      `[job-worker] Job ${job.id} (${job.job_type}) permanently failed after ` +
      `${newRetryCount} attempt(s): ${errorMessage}`
    )
  } else {
    // Exponential backoff: 5m, 10m, 20m, …
    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, job.retry_count ?? 0)
    const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()

    await supabase
      .from('generation_jobs')
      .update({
        status:        'pending',   // back to pending so it gets picked up again
        error_message: errorMessage,
        retry_count:   newRetryCount,
        next_retry_at: nextRetryAt,
        scheduled_for: nextRetryAt, // worker won't pick it up until then
        started_at:    null,
      })
      .eq('id', job.id)

    console.warn(
      `[job-worker] Job ${job.id} (${job.job_type}) failed (attempt ${newRetryCount}/` +
      `${job.max_retries ?? 3}). Retrying at ${nextRetryAt}: ${errorMessage}`
    )
  }
}

/**
 * Process a single job end-to-end.
 */
async function processJob(job) {
  console.log(
    `[job-worker] Processing job ${job.id} | type=${job.job_type} | ` +
    `user=${job.user_id} | listing=${job.listing_id ?? 'none'}`
  )

  const generator = await loadGenerator(job.job_type)
  if (!generator) {
    await failJob(job, `No generator available for job_type="${job.job_type}"`)
    return { success: false }
  }

  try {
    const result = await generator(job.payload ?? {})
    await completeJob(job, result)
    console.log(`[job-worker] Job ${job.id} completed successfully`)
    return { success: true, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await failJob(job, message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function runWorker() {
  const startMs = Date.now()
  let processed = 0
  let succeeded = 0
  let failed = 0

  console.log(`[job-worker] Starting — max_jobs=${MAX_JOBS_PER_RUN}`)

  for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
    let job
    try {
      job = await claimNextJob()
    } catch (err) {
      console.error('[job-worker] Error claiming job:', err.message)
      break
    }

    if (!job) {
      console.log('[job-worker] No more pending jobs. Done.')
      break
    }

    processed++
    const { success } = await processJob(job)
    if (success) succeeded++
    else failed++
  }

  // Update today's scheduler run log with completed/failed counts
  if (processed > 0) {
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { data: logEntry } = await supabase
      .from('scheduler_run_log')
      .select('id, jobs_completed, jobs_failed')
      .eq('run_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (logEntry) {
      await supabase
        .from('scheduler_run_log')
        .update({
          jobs_completed: (logEntry.jobs_completed ?? 0) + succeeded,
          jobs_failed:    (logEntry.jobs_failed ?? 0) + failed,
        })
        .eq('id', logEntry.id)
    }
  }

  const durationMs = Date.now() - startMs
  console.log(
    `[job-worker] Run complete in ${durationMs}ms — ` +
    `processed=${processed}, succeeded=${succeeded}, failed=${failed}`
  )
}

runWorker().catch((err) => {
  console.error('[job-worker] Unhandled error:', err)
  process.exit(1)
})
