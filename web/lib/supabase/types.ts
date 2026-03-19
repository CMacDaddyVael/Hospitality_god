export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
      };
      properties: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          platform: "airbnb" | "vrbo" | "both" | "other";
          platform_listing_id: string | null;
          platform_listing_url: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string;
          bedrooms: number | null;
          bathrooms: number | null;
          max_guests: number | null;
          status: "active" | "inactive" | "pending";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          platform?: "airbnb" | "vrbo" | "both" | "other";
          platform_listing_id?: string | null;
          platform_listing_url?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          max_guests?: number | null;
          status?: "active" | "inactive" | "pending";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          platform?: "airbnb" | "vrbo" | "both" | "other";
          platform_listing_id?: string | null;
          platform_listing_url?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string;
          bedrooms?: number | null;
          bathrooms?: number | null;
          max_guests?: number | null;
          status?: "active" | "inactive" | "pending";
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      property_platform: "airbnb" | "vrbo" | "both" | "other";
      property_status: "active" | "inactive" | "pending";
    };
  };
}
