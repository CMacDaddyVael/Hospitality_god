// Task type definitions for the Hospitality God prompt engine

export enum TaskType {
  LISTING_REWRITE = 'listing_rewrite',
  REVIEW_RESPONSE = 'review_response',
  GUEST_MESSAGE = 'guest_message',
  SOCIAL_CAPTION = 'social_caption',
}

export enum ModelTier {
  QUALITY = 'claude-3-5-sonnet-20241022',
  BULK = 'claude-3-5-haiku-20241022',
}

// ─── Voice Profile ───────────────────────────────────────────────────────────

export interface VoiceProfile {
  tone?: 'casual' | 'professional' | 'warm' | 'luxury'
  signOffName?: string
  alwaysUse?: string[]   // phrases/words to always include
  neverUse?: string[]    // phrases/words to never use
  personalityNotes?: string
  examplePhrases?: string[]
}

// ─── Input Payloads ──────────────────────────────────────────────────────────

export interface ListingRewritePayload {
  currentTitle: string
  currentDescription: string
  propertyType: string
  location: string
  amenities: string[]
  photos?: string[]          // URLs for context
  reviewHighlights?: string[]
  platform: 'airbnb' | 'vrbo' | 'both'
  targetGuests?: string      // "families", "couples", "remote workers", etc.
  pricePerNight?: number
}

export interface ReviewResponsePayload {
  reviewText: string
  reviewerName: string
  rating: number             // 1-5
  reviewDate: string
  propertyName: string
  specificIssues?: string[]  // extracted issues for negative reviews
  ownerResponse?: string     // existing response to improve (optional)
}

export interface GuestMessagePayload {
  messageType: 'pre_arrival' | 'check_in' | 'mid_stay' | 'post_stay' | 'review_request' | 'custom'
  guestName: string
  propertyName: string
  checkInDate: string
  checkOutDate: string
  propertyAddress?: string
  checkInInstructions?: string
  wifiDetails?: string
  houseRules?: string[]
  localRecommendations?: string[]
  customContext?: string      // for 'custom' messageType
}

export interface SocialCaptionPayload {
  platform: 'instagram' | 'tiktok' | 'facebook' | 'twitter'
  contentType: 'property_showcase' | 'local_experience' | 'guest_highlight' | 'seasonal' | 'amenity_spotlight'
  propertyName: string
  location: string
  photoDescription?: string  // what's in the image/video
  highlights?: string[]      // key features to mention
  callToAction?: string
  hashtags?: string[]        // seed hashtags; engine will add more
  targetAudience?: string
}

export type TaskPayload =
  | ListingRewritePayload
  | ReviewResponsePayload
  | GuestMessagePayload
  | SocialCaptionPayload

// ─── Output Schemas ──────────────────────────────────────────────────────────

export interface ListingRewriteOutput {
  title: string              // max 50 chars for Airbnb
  description: string        // full optimized description
  summary: string            // short summary / subtitle
  highlights: string[]       // 5 bullet highlights
  tags: string[]             // relevant search tags
  seoNotes: string           // what was optimized and why
}

export interface ReviewResponseOutput {
  response: string           // the full response text
  tone: string               // detected tone used
  keyPointsAddressed: string[] // what issues/praise were addressed
}

export interface GuestMessageOutput {
  subject: string            // email/message subject line
  body: string               // full message body
  messageType: string        // echoed back for verification
  estimatedReadTime: string  // "2 min read"
}

export interface SocialCaptionOutput {
  caption: string            // full caption with emojis
  hashtags: string[]         // all hashtags (seed + generated)
  altText: string            // accessibility alt text for image
  bestTimeToPost?: string    // suggested posting time
  platform: string           // echoed back
}

export type TaskOutput =
  | ListingRewriteOutput
  | ReviewResponseOutput
  | GuestMessageOutput
  | SocialCaptionOutput

// ─── Task Config ─────────────────────────────────────────────────────────────

export interface TaskConfig {
  model: ModelTier
  maxTokens: number
  temperature: number
}

export const TASK_CONFIGS: Record<TaskType, TaskConfig> = {
  [TaskType.LISTING_REWRITE]: {
    model: ModelTier.QUALITY,   // High quality — directly impacts revenue
    maxTokens: 2048,
    temperature: 0.7,
  },
  [TaskType.REVIEW_RESPONSE]: {
    model: ModelTier.QUALITY,   // Quality matters — public-facing
    maxTokens: 512,
    temperature: 0.6,
  },
  [TaskType.GUEST_MESSAGE]: {
    model: ModelTier.BULK,      // High volume, cost-sensitive
    maxTokens: 1024,
    temperature: 0.5,
  },
  [TaskType.SOCIAL_CAPTION]: {
    model: ModelTier.BULK,      // High volume, bulk generation
    maxTokens: 512,
    temperature: 0.8,
  },
}

// ─── Engine Result ────────────────────────────────────────────────────────────

export interface PromptEngineResult<T extends TaskOutput = TaskOutput> {
  output: T
  taskType: TaskType
  model: string
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    estimatedCostUsd: number
  }
  attempts: number
  durationMs: number
}

export interface PromptEngineError {
  taskType: TaskType
  error: string
  attempts: number
  durationMs: number
}
