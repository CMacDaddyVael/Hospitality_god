/**
 * Shared types for the audit pipeline.
 * Purely additive — no existing files are modified.
 */

export interface ListingData {
  url: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: { text: string; rating: number; date: string }[]
  rating: number | null
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number | null
  platform: 'airbnb' | 'vrbo'
  extras?: Record<string, unknown>
}

export interface ScoreIssue {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  fix: string
  pointsAtStake: number
}

export interface ScoreCategory {
  name: string
  score: number
  weight: number
  issues: ScoreIssue[]
}

export interface AuditScore {
  total: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  categories: ScoreCategory[]
  topIssues: ScoreIssue[]
  estimatedMonthlyRevenueLoss: number | null
}

export interface AuditResult {
  auditId: string
  url: string
  score: AuditScore
  summary: string
  priorityFixes: string[]
  scrapedAt: string
}

export interface PersistAuditInput {
  url: string
  score: AuditScore
  summary: string
  priorityFixes: string[]
  rawData: ListingData
  scrapedAt: string
  ip: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}
