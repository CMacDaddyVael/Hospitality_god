export type { Database, Json } from '@/lib/supabase/types'

export type Profile = {
  id: string
  created_at: string
  updated_at: string
  email: string
  full_name: string | null
  avatar_url: string | null
  onboarding_completed: boolean
  subscription_tier: 'free' | 'starter' | 'pro' | 'agency' | null
  subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | null
  stripe_customer_id: string | null
}

export type Listing = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  platform: 'airbnb' | 'vrbo' | 'other'
  platform_listing_id: string | null
  url: string
  title: string
  description: string | null
  property_type: string | null
  location: string | null
  price_per_night: number | null
  rating: number | null
  review_count: number | null
  photos: string[]
  amenities: string[]
  health_score: number | null
  last_synced_at: string | null
}

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'agency'

export type AgentTaskStatus = 'pending' | 'running' | 'complete' | 'failed'

export type AgentTask = {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  listing_id: string | null
  task_type: string
  status: AgentTaskStatus
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  started_at: string | null
  completed_at: string | null
}

export type NavItem = {
  label: string
  href: string
  icon: string
  badge?: string | number
}
