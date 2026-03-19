export const QUEUE_NAMES = {
  LISTING_OPTIMIZATION: 'listing-optimization',
  HEALTH_SCORE: 'health-score',
  REVIEW_RESPONSE: 'review-response',
  SOCIAL_POST: 'social-post',
  GUEST_MESSAGE: 'guest-message',
} as const

export const JOB_TYPES = {
  LISTING_OPTIMIZATION: 'listing_optimization',
  HEALTH_SCORE: 'health_score',
  REVIEW_RESPONSE: 'review_response',
  SOCIAL_POST: 'social_post',
  GUEST_MESSAGE: 'guest_message',
} as const

// Max regenerations per content item per calendar day
export const MAX_REGENERATIONS_PER_DAY = 3
