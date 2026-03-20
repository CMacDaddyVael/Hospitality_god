export interface PipelineInput {
  url: string
  userId?: string
  sessionId?: string
}

export interface ScrapedListing {
  url: string
  platform: 'airbnb' | 'vrbo'
  title: string
  description: string
  photos: string[]
  amenities: string[]
  bedrooms: number | null
  bathrooms: number | null
  maxGuests: number | null
  propertyType: string
  location: string
  rating: number | null
  reviewCount: number
  pricePerNight: number | null
  host: {
    name: string
    isSuperhost: boolean
    responseRate: string | null
    responseTime: string | null
  }
  highlights: string[]
  houseRules: string[]
  scrapedAt: string
}

export interface CategoryScore {
  label: string
  score: number      // 0–100
  maxScore: number
  weight: number     // contribution to overall (0–1, sum = 1)
  issues: string[]   // what brought the score down
  strengths: string[] // what scored well
}

export interface ScoreResult {
  overall: number   // 0–100 weighted sum
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  categories: {
    title: CategoryScore
    photos: CategoryScore
    description: CategoryScore
    amenities: CategoryScore
    reviews: CategoryScore
    pricing: CategoryScore
    hostProfile: CategoryScore
  }
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium'
  category: string
  title: string
  detail: string
  estimatedImpact: string
}

export interface AuditSummary {
  headline: string           // e.g. "Your listing is missing 3 things costing you bookings"
  overview: string           // 2–3 sentence plain-English summary
  recommendations: Recommendation[]
  quickWins: string[]        // 2–3 short bullet actions
}

export interface AuditResult {
  auditId?: string
  url: string
  listing: ScrapedListing
  score: ScoreResult
  summary: AuditSummary
  completedAt: string
  durationMs: number
}
