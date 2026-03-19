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
      properties: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          platform: string;
          platform_id: string | null;
          title: string | null;
          description: string | null;
          photo_count: number;
          average_rating: number | null;
          review_count: number;
          review_response_rate: number;
          posting_frequency_per_month: number;
          location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["properties"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          property_id: string;
          reviewer_name: string;
          rating: number;
          content: string;
          platform: string;
          review_date: string;
          responded: boolean;
          response_text: string | null;
          sentiment_score: number | null;
          positive_keywords: string[];
          negative_keywords: string[];
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      agent_activities: {
        Row: {
          id: string;
          property_id: string;
          user_id: string;
          action_type: string;
          action_description: string;
          metadata: Json;
          performed_at: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["agent_activities"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["agent_activities"]["Insert"]>;
      };
      scheduled_actions: {
        Row: {
          id: string;
          property_id: string;
          user_id: string;
          action_type: string;
          action_description: string;
          content: string | null;
          platform: string | null;
          scheduled_for: string;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["scheduled_actions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["scheduled_actions"]["Insert"]>;
      };
      occupancy_logs: {
        Row: {
          id: string;
          property_id: string;
          user_id: string;
          year: number;
          month: number;
          occupied_nights: number;
          total_nights: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["occupancy_logs"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["occupancy_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
