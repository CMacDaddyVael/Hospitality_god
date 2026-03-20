export type ScoreSeverity = 'critical' | 'important' | 'nice-to-have'

export type FixRecommendation = {
  id: string
  severity: ScoreSeverity
  category: 'photos' | 'copy' | 'amenities' | 'reviews' | 'pricing'
  title: string
  action: string // copy-pasteable action text
}

export type CategoryScore = {
  category: 'photos' | 'copy' | 'amenities' | 'reviews' | 'pricing'
  label: string
  score: number // 0–100
  status: string // one-line plain-English status
}

export type AuditScoreResult = {
  id: string
  created_at: string
  listing_url: string
  listing_title: string
  overall_score: number // 0–100
  categories: CategoryScore[]
  recommendations: FixRecommendation[]
  property_type?: string
  location?: string
}
