export type AuditStatus = 'pending' | 'processing' | 'complete' | 'failed'

export type CategoryScore = {
  category: string
  label: string
  score: number
  max_score: number
  summary: string
  problems: AuditProblem[]
}

export type AuditProblem = {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  category: string
}

export type AuditRecord = {
  id: string
  property_id: string
  status: AuditStatus
  listing_title: string | null
  listing_url: string | null
  listing_platform: 'airbnb' | 'vrbo' | 'other' | null
  overall_score: number | null
  max_score: number
  score_label: string | null
  categories: CategoryScore[] | null
  top_problems: AuditProblem[] | null
  raw_scrape_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
