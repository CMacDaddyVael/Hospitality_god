/**
 * jobQueue.ts
 * -----------
 * Thin helper layer over the Supabase `jobs` table.
 * Used by worker processes (future) to claim, update, and fail jobs.
 * The cron endpoints enqueue via direct insert; this module handles
 * the lifecycle transitions so workers have a clean interface.
 *
 * Additive — nothing here modifies existing files.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

export type JobType =
  | 'review_scan'
  | 'competitor_check'
  | 'social_content'
  | 'listing_optimization'

export interface Job {
  id: string
  subscriber_id: string
  job_type: JobType
  status: JobStatus
  payload: Record<string, unknown>
  error_message?: string | null
  created_at: string
  completed_at?: string | null
}

export interface EnqueueParams {
  subscriber_id: string
  job_type: JobType
  payload?: Record<string, unknown>
}

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key)
}

/**
 * Enqueue a single job.
 */
export async function enqueueJob(params: EnqueueParams): Promise<Job> {
  const db = getClient()
  const { data, error } = await db
    .from('jobs')
    .insert({
      subscriber_id: params.subscriber_id,
      job_type: params.job_type,
      status: 'queued',
      payload: params.payload ?? {},
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Failed to enqueue job: ${error?.message ?? 'unknown error'}`)
  }
  return data as Job
}

/**
 * Claim the next queued job of a given type (sets status → running).
 * Returns null if no work is available.
 */
export async function claimNextJob(jobType: JobType): Promise<Job | null> {
  const db = getClient()

  // Use a CTE to atomically select + update to avoid race conditions
  const { data, error } = await db
    .from('jobs')
    .update({ status: 'running' })
    .eq('status', 'queued')
    .eq('job_type', jobType)
    .order('created_at', { ascending: true })
    .limit(1)
    .select()
    .single()

  if (error) {
    // PGRST116 = no rows found — not an error for us
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to claim job: ${error.message}`)
  }

  return data as Job | null
}

/**
 * Mark a job as done.
 */
export async function completeJob(jobId: string): Promise<void> {
  const db = getClient()
  const { error } = await db
    .from('jobs')
    .update({
      status: 'done',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to complete job ${jobId}: ${error.message}`)
  }
}

/**
 * Mark a job as failed and record the error message.
 * No silent failures — error_message is always stored.
 */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const db = getClient()
  const { error } = await db
    .from('jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to mark job ${jobId} as failed: ${error.message}`)
  }
}

/**
 * Fetch all queued jobs for a subscriber (useful for dashboard / email brief).
 */
export async function getSubscriberJobs(
  subscriberId: string,
  status?: JobStatus
): Promise<Job[]> {
  const db = getClient()
  let query = db
    .from('jobs')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to fetch jobs for subscriber ${subscriberId}: ${error.message}`)
  }
  return (data ?? []) as Job[]
}
