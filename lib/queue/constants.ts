/**
 * Agent Task Queue — Constants
 */

export const TASK_TYPES = [
  'listing_analysis',
  'review_response',
  'guest_message',
  'social_post',
  'health_score',
] as const;

/** Maximum attempts before a task is permanently failed */
export const MAX_RETRY_COUNT = 3;

/** Maximum concurrent tasks per property (prevents platform rate limiting) */
export const MAX_CONCURRENT_PER_PROPERTY = 10;

/** Base backoff in minutes — multiplied by retry_count */
export const RETRY_BACKOFF_MINUTES = 5;

/** Cron dispatcher batch size */
export const DISPATCHER_BATCH_SIZE = 50;
