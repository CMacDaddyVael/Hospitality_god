export type AuditCategory = {
  name: string
  icon: string
  score: number
  callout?: string
}

export type AuditCallout = {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  fix?: string
}

export type AuditReport = {
  overallScore: number
  summary: string
  listingTitle?: string
  listingUrl: string
  categories: AuditCategory[]
  callouts: AuditCallout[]
  scrapedAt: string
}

export type ScrapedListing = {
  url: string
  title: string
  description: string
  photos: string[]
  amenities: string[]
  reviews: { text: string; rating: number; date: string }[]
  rating: number
  reviewCount: number
  propertyType: string
  location: string
  pricePerNight: number
  bedroomCount: number
  bathroomCount: number
  guestCapacity: number
  host: {
    name: string
    isSuperhost: boolean
    responseRate?: string
    responseTime?: string
  }
}
