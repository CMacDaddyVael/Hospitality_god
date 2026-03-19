export interface UserPreferences {
  id: string;
  user_id: string;
  tone: "formal" | "casual";
  response_length: "brief" | "balanced" | "detailed";
  phrases_to_avoid: string;
  property_name: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  review_date: string;
  platform: "airbnb" | "vrbo" | "google" | "other";
  listing_name: string;
  status: "pending" | "responded";
  created_at: string;
}

export interface ReviewResponse {
  id: string;
  user_id: string;
  review_id: string;
  response_text: string;
  approved_at: string;
  created_at: string;
}

export interface ReviewWithResponse extends Review {
  review_responses?: ReviewResponse[];
}
