/**
 * Graduated Autonomy System — Constants
 *
 * Defines content types, risk tiers, and thresholds for the
 * crawl/walk/run trust framework.
 */

export type RiskTier = 'low' | 'medium' | 'high'
export type AutonomyLevel = 'suggest' | 'smart_auto' | 'full_auto'
export type ActionStatus =
  | 'pending'
  | 'approved'
  | 'edited'
  | 'rejected'
  | 'auto_executed'
  | 'expired'
  | 'reverted'

export type ContentType =
  | 'checkin_message'
  | 'social_post'
  | 'seasonal_pricing_nudge'
  | 'positive_review_response'
  | 'listing_tweak'
  | 'negative_review_response'
  | 'listing_rewrite'
  | 'photo_swap'
  | 'pricing_change'

export interface ContentTypeConfig {
  type: ContentType
  label: string
  description: string
  riskTier: RiskTier
  // Minimum weeks before smart_auto is eligible
  smartAutoEligibleAfterWeeks: number
  // Minimum weeks before full_auto is eligible
  fullAutoEligibleAfterWeeks: number
  emoji: string
}

export const CONTENT_TYPE_CONFIGS: Record<ContentType, ContentTypeConfig> = {
  // ── Low Risk ─────────────────────────────────────────────
  checkin_message: {
    type: 'checkin_message',
    label: 'Check-in Messages',
    description: 'Pre-arrival and check-in instructions sent to guests',
    riskTier: 'low',
    smartAutoEligibleAfterWeeks: 2,
    fullAutoEligibleAfterWeeks: 4,
    emoji: '🏠',
  },
  social_post: {
    type: 'social_post',
    label: 'Social Posts',
    description: 'Instagram and TikTok content showcasing your property',
    riskTier: 'low',
    smartAutoEligibleAfterWeeks: 2,
    fullAutoEligibleAfterWeeks: 4,
    emoji: '📸',
  },
  seasonal_pricing_nudge: {
    type: 'seasonal_pricing_nudge',
    label: 'Seasonal Pricing Nudges',
    description: 'Minor seasonal pricing suggestions (±5% or less)',
    riskTier: 'low',
    smartAutoEligibleAfterWeeks: 2,
    fullAutoEligibleAfterWeeks: 4,
    emoji: '📅',
  },
  // ── Medium Risk ───────────────────────────────────────────
  positive_review_response: {
    type: 'positive_review_response',
    label: 'Positive Review Responses',
    description: 'Responses to 4-5 star guest reviews',
    riskTier: 'medium',
    smartAutoEligibleAfterWeeks: 4,
    fullAutoEligibleAfterWeeks: 8,
    emoji: '⭐',
  },
  listing_tweak: {
    type: 'listing_tweak',
    label: 'Listing Tweaks',
    description: 'Minor listing copy improvements (title, amenities)',
    riskTier: 'medium',
    smartAutoEligibleAfterWeeks: 4,
    fullAutoEligibleAfterWeeks: 8,
    emoji: '✏️',
  },
  // ── High Risk ─────────────────────────────────────────────
  negative_review_response: {
    type: 'negative_review_response',
    label: 'Negative Review Responses',
    description: 'Responses to 1-3 star reviews — always needs your eyes',
    riskTier: 'high',
    smartAutoEligibleAfterWeeks: 999, // never auto
    fullAutoEligibleAfterWeeks: 999,
    emoji: '🚨',
  },
  listing_rewrite: {
    type: 'listing_rewrite',
    label: 'Listing Rewrites',
    description: 'Major rewrites of your listing description',
    riskTier: 'high',
    smartAutoEligibleAfterWeeks: 999,
    fullAutoEligibleAfterWeeks: 999,
    emoji: '📝',
  },
  photo_swap: {
    type: 'photo_swap',
    label: 'Photo Changes',
    description: 'Adding, removing, or reordering listing photos',
    riskTier: 'high',
    smartAutoEligibleAfterWeeks: 999,
    fullAutoEligibleAfterWeeks: 999,
    emoji: '📷',
  },
  pricing_change: {
    type: 'pricing_change',
    label: 'Pricing Changes',
    description: 'Significant pricing updates to your listing',
    riskTier: 'high',
    smartAutoEligibleAfterWeeks: 999,
    fullAutoEligibleAfterWeeks: 999,
    emoji: '💰',
  },
}

export const ALL_CONTENT_TYPES = Object.keys(CONTENT_TYPE_CONFIGS) as ContentType[]

// Thresholds for upgrade prompts
export const UPGRADE_THRESHOLDS = {
  // Minimum actions before suggesting upgrade
  MIN_ACTIONS_FOR_SUGGEST_TO_SMART: 10,
  MIN_ACTIONS_FOR_SMART_TO_FULL: 20,
  // Required approval rate (unchanged approvals)
  APPROVAL_RATE_FOR_UPGRADE: 0.9, // 90%
  // Revert window in hours
  REVERT_WINDOW_HOURS: 24,
  // Expiry window in hours for pending actions
  PENDING_EXPIRY_HOURS: 48,
}

// Autonomy level display info
export const AUTONOMY_LEVEL_INFO: Record<
  AutonomyLevel,
  { label: string; description: string; color: string; badge: string }
> = {
  suggest: {
    label: 'Suggest Mode',
    description: 'Every action needs your approval',
    color: 'text-blue-400',
    badge: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  },
  smart_auto: {
    label: 'Smart Auto',
    description: 'Low-risk actions run automatically',
    color: 'text-amber-400',
    badge: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  },
  full_auto: {
    label: 'Full Auto',
    description: 'Runs automatically, you review weekly',
    color: 'text-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  },
}
