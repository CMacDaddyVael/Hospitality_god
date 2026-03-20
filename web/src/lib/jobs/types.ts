/**
 * VAEL Host — Job Queue Types
 * Issue #173: Type definitions for the deliverable job queue
 */

export type JobType = 'review_response' | 'social_post' | 'listing_copy' | 'competitive_intel'

export type JobStatus = 'running' | 'success' | 'failed'

/**
 * Cooldown windows (in hours) — how long to wait before re-running each job type.
 * review_response: 20h (run daily, skip if no new reviews)
 * social_post: 44h (target 3x/week = every ~56h, but allow some flex)
 * listing_copy: 6 days (weekly)
 * competitive_intel: 6 days (weekly)
 */
export const JOB_COOLDOWNS_HOURS: Record<JobType, number> = {
  review_response: 20,
  social_post: 44,
  listing_copy: 144, // 6 days
  competitive_intel: 144, // 6 days
}

/**
 * How many times per week each job type runs (informational, used in logging).
 */
export const JOB_FREQUENCY_LABEL: Record<JobType, string> = {
  review_response: 'daily (if new reviews)',
  social_post: '3x/week',
  listing_copy: 'weekly',
  competitive_intel: 'weekly',
}

export interface JobRun {
  id: string
  property_id: string
  job_type: JobType
  started_at: string
  completed_at: string | null
  status: JobStatus
  deliverables_created: number
  error_message: string | null
  created_at: string
}

export interface Property {
  id: string
  user_id: string
  airbnb_url: string | null
  vrbo_url: string | null
  listing_title: string | null
  listing_description: string | null
  location: string | null
  property_type: string | null
  schedule_config: PropertyScheduleConfig | null
  voice_profile: VoiceProfile | null
  created_at: string
}

export interface PropertyScheduleConfig {
  /** Which job types are enabled for this property */
  enabled_jobs: JobType[]
  /** Optional: override cooldown hours per job type */
  custom_cooldowns?: Partial<Record<JobType, number>>
}

export interface VoiceProfile {
  tone: string
  sign_off_name: string
  always_use: string[]
  never_use: string[]
  personality_notes: string
}

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled'
  plan: 'pro' | 'autopilot'
  current_period_end: string
}

export interface ActiveProProperty {
  property: Property
  subscription: Subscription
}

export interface JobRunResult {
  property_id: string
  job_type: JobType
  status: JobStatus
  deliverables_created: number
  skipped: boolean
  skip_reason?: string
  error?: string
  duration_ms: number
}

export interface DispatcherResult {
  summary: {
    properties_processed: number
    jobs_attempted: number
    jobs_succeeded: number
    jobs_failed: number
    jobs_skipped: number
    deliverables_created: number
    duration_ms: number
  }
  runs: JobRunResult[]
}

export interface DispatcherOptions {
  /** Run only for a specific property (admin/testing) */
  propertyId?: string
  /** Run only a specific job type (admin/testing) */
  jobType?: JobType
  /** If true, check what would run but don't execute or write to DB */
  dryRun?: boolean
}
