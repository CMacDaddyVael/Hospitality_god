export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          subscription_tier?: 'free' | 'starter' | 'pro' | 'agency' | null
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          subscription_tier?: 'free' | 'starter' | 'pro' | 'agency' | null
          subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing' | null
          stripe_customer_id?: string | null
        }
      }
      listings: {
        Row: {
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
          photos: Json
          amenities: Json
          health_score: number | null
          last_synced_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id: string
          platform: 'airbnb' | 'vrbo' | 'other'
          platform_listing_id?: string | null
          url: string
          title: string
          description?: string | null
          property_type?: string | null
          location?: string | null
          price_per_night?: number | null
          rating?: number | null
          review_count?: number | null
          photos?: Json
          amenities?: Json
          health_score?: number | null
          last_synced_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          platform?: 'airbnb' | 'vrbo' | 'other'
          platform_listing_id?: string | null
          url?: string
          title?: string
          description?: string | null
          property_type?: string | null
          location?: string | null
          price_per_night?: number | null
          rating?: number | null
          review_count?: number | null
          photos?: Json
          amenities?: Json
          health_score?: number | null
          last_synced_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
