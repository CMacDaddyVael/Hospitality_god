/**
 * VAEL Host — Daily Job Dispatcher
 * Issue #173: Core dispatcher logic for the deliverable job queue
 *
 * This is the heart of the "swarm works daily" promise.
 * It queries active Pro subscribers, checks what's due, and dispatches generation jobs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  JobType,
  JobStatus,
  JobRun,
  ActiveProProperty,
  JobRunResult,
  DispatcherResult,
  DispatcherOptions,
  JOB_COOLDOWNS_HOURS,
  JOB_FREQUENCY_LABEL,
  PropertyScheduleConfig,
} from './types'
import { generateReviewResponses } from './workers/review-response'
import { generateSocialPosts } from './workers/social-post'
import { generateListingCopy } from './workers/listing-copy'
import { generateCompetitiveIntel } from './workers/competitive-intel'

const MAX_PROPERTIES = 50 // Vercel 300s window constraint — see load estimate in cron route

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Fetches all active Pro subscribers with their properties.
 * Joins subscriptions → users → properties.
 */
async function getActiveProProperties(
  supabase: SupabaseClient,
  propertyIdFilter?: string
): Promise<ActiveProProperty[]> {
  // Query active subscriptions with property data
  let query = supabase
    .from('subscriptions')
    .select(`
      id,
      user_id,
      stripe_subscription_id,
      status,
      plan,
      current_period_end,
      properties:properties(
        id,
        user_id,
        airbnb_url,
        vrbo_url,
        listing_title,
        listing_description,
        location,
        property_type,
        schedule_config,
        voice_profile,
        created_at
      )
    `)
    .in('status', ['active', 'trialing'])
    .in('plan', ['pro', 'autopilot'])
    .limit(MAX_PROPERTIES)

  if (propertyIdFilter) {
    query = query.eq('properties.id', propertyIdFilter)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch active subscriptions: ${error.message}`)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Flatten: one entry per (subscription, property) pair
  const result: ActiveProProperty[] = []
  for (const sub of data) {
    const properties = Array.isArray(sub.properties) ? sub.properties : sub.properties ? [sub.properties] : []
    for (const property of properties) {
      if (!property) continue
      if (propertyIdFilter && property.id !== propertyIdFilter) continue
      result.push({
        property: property as any,
        subscription: {
          id: sub.id,
          user_id: sub.user_id,
          stripe_subscription_id: sub.stripe_subscription_id,
          status: sub.status as any,
          plan: sub.plan as any,
          current_period_end: sub.current_period_end,
        },
      })
    }
  }

  return result.slice(0, MAX_PROPERTIES)
}

/**
 * Returns which job types are enabled for this property.
 * Defaults to all 4 if no schedule_config is set.
 */
function getEnabledJobTypes(config: PropertyScheduleConfig | null, jobTypeFilter?: JobType): JobType[] {
  const all: JobType[] = ['review_response', 'social_post', 'listing_copy', 'competitive_intel']
  const enabled = config?.enabled_jobs ?? all

  if (jobTypeFilter) {
    return enabled.includes(jobTypeFilter) ? [jobTypeFilter] : []
  }

  return enabled
}

/**
 * Checks if a job is within its cooldown window (i.e., it ran successfully recently).
 * Returns true if we should SKIP this job.
 */
async function isInCooldown(
  supabase: SupabaseClient,
  propertyId: string,
  jobType: JobType,
  customCooldownHours?: number
): Promise<{ inCooldown: boolean; lastRun?: Date }> {
  const cooldownHours = customCooldownHours ?? JOB_COOLDOWNS_HOURS[jobType]
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('job_runs')
    .select('id, started_at, completed_at, status')
    .eq('property_id', propertyId)
    .eq('job_type', jobType)
    .eq('status', 'success')
    .gte('started_at', cutoff)
    .order('started_at', { ascending: false })
    .limit(1)

  if (error) {
    // If we can't check, assume not in cooldown (better to re-run than skip)
    console.warn(`[Dispatcher] Cooldown check failed for ${propertyId}/${jobType}:`, error.message)
    return { inCooldown: false }
  }

  if (data && data.length > 0) {
    return { inCooldown: true, lastRun: new Date(data[0].started_at) }
  }

  return { inCooldown: false }
}

/**
 * Creates a job_runs record with status=running and returns its ID.
 */
async function createJobRun(
  supabase: SupabaseClient,
  propertyId: string,
  jobType: JobType
): Promise<string> {
  const { data, error } = await supabase
    .from('job_runs')
    .insert({
      property_id: propertyId,
      job_type: jobType,
      started_at: new Date().toISOString(),
      status: 'running',
      deliverables_created: 0,
      error_message: null,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create job_run record: ${error?.message}`)
  }

  return data.id
}

/**
 * Updates a job_runs record with the final status.
 */
async function finalizeJobRun(
  supabase: SupabaseClient,
  jobRunId: string,
  status: JobStatus,
  deliverablesCreated: number,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('job_runs')
    .update({
      completed_at: new Date().toISOString(),
      status,
      deliverables_created: deliverablesCreated,
      error_message: errorMessage ?? null,
    })
    .eq('id', jobRunId)

  if (error) {
    console.error(`[Dispatcher] Failed to finalize job_run ${jobRunId}:`, error.message)
  }
}

/**
 * Dispatches a single job for a property.
 * Handles cooldown check, DB record creation, execution, and finalization.
 */
async function dispatchJob(
  supabase: SupabaseClient,
  activeProperty: ActiveProProperty,
  jobType: JobType,
  dryRun: boolean
): Promise<JobRunResult> {
  const { property } = activeProperty
  const jobStart = Date.now()

  console.log(`[Dispatcher] → ${jobType} for property ${property.id} (${property.listing_title ?? 'untitled'})`)

  // Check cooldown
  const cooldownHours = property.schedule_config?.custom_cooldowns?.[jobType]
  const { inCooldown, lastRun } = await isInCooldown(supabase, property.id, jobType, cooldownHours)

  if (inCooldown) {
    const hoursAgo = lastRun ? Math.round((Date.now() - lastRun.getTime()) / (1000 * 60 * 60)) : 0
    console.log(`[Dispatcher]   ↳ Skipping — last success ${hoursAgo}h ago (cooldown: ${cooldownHours ?? JOB_COOLDOWNS_HOURS[jobType]}h)`)
    return {
      property_id: property.id,
      job_type: jobType,
      status: 'success',
      deliverables_created: 0,
      skipped: true,
      skip_reason: `Last successful run ${hoursAgo}h ago — within cooldown window`,
      duration_ms: Date.now() - jobStart,
    }
  }

  if (dryRun) {
    console.log(`[Dispatcher]   ↳ DRY RUN — would execute ${jobType}`)
    return {
      property_id: property.id,
      job_type: jobType,
      status: 'success',
      deliverables_created: 0,
      skipped: true,
      skip_reason: 'Dry run — no execution',
      duration_ms: Date.now() - jobStart,
    }
  }

  // Create job_runs record
  let jobRunId: string
  try {
    jobRunId = await createJobRun(supabase, property.id, jobType)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Dispatcher]   ↳ Failed to create job_run record: ${msg}`)
    return {
      property_id: property.id,
      job_type: jobType,
      status: 'failed',
      deliverables_created: 0,
      skipped: false,
      error: msg,
      duration_ms: Date.now() - jobStart,
    }
  }

  // Execute the job
  try {
    let deliverablesCreated = 0

    switch (jobType) {
      case 'review_response':
        deliverablesCreated = await generateReviewResponses(supabase, activeProperty)
        break
      case 'social_post':
        deliverablesCreated = await generateSocialPosts(supabase, activeProperty)
        break
      case 'listing_copy':
        deliverablesCreated = await generateListingCopy(supabase, activeProperty)
        break
      case 'competitive_intel':
        deliverablesCreated = await generateCompetitiveIntel(supabase, activeProperty)
        break
      default:
        throw new Error(`Unknown job type: ${jobType}`)
    }

    await finalizeJobRun(supabase, jobRunId, 'success', deliverablesCreated)

    console.log(`[Dispatcher]   ↳ Success — ${deliverablesCreated} deliverables created (${Date.now() - jobStart}ms)`)

    return {
      property_id: property.id,
      job_type: jobType,
      status: 'success',
      deliverables_created: deliverablesCreated,
      skipped: false,
      duration_ms: Date.now() - jobStart,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Dispatcher]   ↳ Failed: ${msg}`)

    await finalizeJobRun(supabase, jobRunId, 'failed', 0, msg)

    return {
      property_id: property.id,
      job_type: jobType,
      status: 'failed',
      deliverables_created: 0,
      skipped: false,
      error: msg,
      duration_ms: Date.now() - jobStart,
    }
  }
}

/**
 * Main dispatcher entry point.
 * Queries all active Pro properties and dispatches due jobs.
 */
export async function runDailyJobs(options: DispatcherOptions = {}): Promise<DispatcherResult> {
  const runStart = Date.now()
  const { propertyId, jobType, dryRun = false } = options

  console.log('[Dispatcher] Starting daily job run', {
    propertyId: propertyId ?? 'all',
    jobType: jobType ?? 'all',
    dryRun,
  })

  const supabase = getSupabaseAdmin()
  const allRuns: JobRunResult[] = []

  // Fetch active Pro properties
  let activeProperties: ActiveProProperty[]
  try {
    activeProperties = await getActiveProProperties(supabase, propertyId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Dispatcher] Failed to fetch active properties:', msg)
    throw err
  }

  console.log(`[Dispatcher] Found ${activeProperties.length} active Pro properties`)

  if (activeProperties.length === 0) {
    return {
      summary: {
        properties_processed: 0,
        jobs_attempted: 0,
        jobs_succeeded: 0,
        jobs_failed: 0,
        jobs_skipped: 0,
        deliverables_created: 0,
        duration_ms: Date.now() - runStart,
      },
      runs: [],
    }
  }

  // Process each property sequentially (safe for 300s window)
  for (const activeProperty of activeProperties) {
    const { property } = activeProperty
    const enabledJobs = getEnabledJobTypes(property.schedule_config, jobType)

    console.log(`[Dispatcher] Processing property ${property.id} — jobs: ${enabledJobs.join(', ')}`)

    for (const type of enabledJobs) {
      try {
        const result = await dispatchJob(supabase, activeProperty, type, dryRun)
        allRuns.push(result)
      } catch (err) {
        // Should not reach here — dispatchJob handles its own errors
        // But if it does, log and continue to next job (don't block other properties)
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Dispatcher] Unhandled error for ${property.id}/${type}:`, msg)
        allRuns.push({
          property_id: property.id,
          job_type: type,
          status: 'failed',
          deliverables_created: 0,
          skipped: false,
          error: `Unhandled: ${msg}`,
          duration_ms: 0,
        })
      }
    }
  }

  // Compute summary
  const succeeded = allRuns.filter(r => r.status === 'success' && !r.skipped)
  const failed = allRuns.filter(r => r.status === 'failed')
  const skipped = allRuns.filter(r => r.skipped)
  const attempted = allRuns.filter(r => !r.skipped)

  const summary = {
    properties_processed: activeProperties.length,
    jobs_attempted: attempted.length,
    jobs_succeeded: succeeded.length,
    jobs_failed: failed.length,
    jobs_skipped: skipped.length,
    deliverables_created: allRuns.reduce((sum, r) => sum + r.deliverables_created, 0),
    duration_ms: Date.now() - runStart,
  }

  console.log('[Dispatcher] Run complete:', summary)

  return { summary, runs: allRuns }
}
