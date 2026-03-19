export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export type CategoryScore = {
  score: number
  grade: Grade
  items: AuditItem[]
  summary: string
}

export type AuditItem = {
  id: string
  title: string
  status: 'pass' | 'warning' | 'fail'
  description: string
  recommendation?: string
  impact?: string
  canAutoFix?: boolean
  priority?: 'critical' | 'high' | 'medium' | 'low'
}

export type SEOResults = CategoryScore & {
  metaTitle: { value: string | null; length: number; status: 'pass' | 'warning' | 'fail' }
  metaDescription: { value: string | null; length: number; status: 'pass' | 'warning' | 'fail' }
  h1Tags: string[]
  h2Tags: string[]
  imageAltMissing: number
  imageAltTotal: number
  hasSSL: boolean
  hasSitemap: boolean
  hasRobotstxt: boolean
  loadTime: number | null
  mobileScore: number | null
  desktopScore: number | null
  canonicalUrl: string | null
  internalLinks: number
  externalLinks: number
}

export type GEOResults = CategoryScore & {
  hasSchemaMarkup: boolean
  schemaTypes: string[]
  hasFAQSection: boolean
  hasStructuredData: boolean
  entitySignals: string[]
  reviewMentions: number
  hasGoogleBusinessSignals: boolean
  isAnswerReady: boolean
}

export type ContentResults = CategoryScore & {
  wordCount: number
  hasValueProp: boolean
  hasSocialProof: boolean
  hasCTA: boolean
  ctaCount: number
  copyQualityScore: number
  hasUniqueContent: boolean
  lastModified: string | null
  photographyScore: number
  bookingFriction: 'low' | 'medium' | 'high' | 'unknown'
}

export type CompetitiveResults = {
  competitors: CompetitorData[]
  gaps: string[]
  advantages: string[]
} | null

export type CompetitorData = {
  name: string
  url?: string
  strengths: string[]
  weaknesses: string[]
}

export type AuditReport = {
  criticalFixes: CriticalFix[]
  actionPlan: ActionPlanItem[]
  summary: string
  headline: string
}

export type CriticalFix = {
  title: string
  description: string
  estimatedImpact: string
  canAutoFix: boolean
  priority: number
}

export type ActionPlanItem = {
  phase: number
  title: string
  steps: string[]
  estimatedImpact: string
  timeToImplement: string
  canAutoFix: boolean
  category: 'seo' | 'geo' | 'content' | 'competitive'
}

export type AuditResults = {
  url: string
  overallScore: number
  grade: Grade
  seo: SEOResults
  geo: GEOResults
  content: ContentResults
  competitive: CompetitiveResults
  report: AuditReport
  analyzedAt: string
}
