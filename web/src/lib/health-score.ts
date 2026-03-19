/**
 * Listing Health Score Calculator (0-100)
 *
 * Scoring breakdown:
 * - Title quality (length + keywords): 20 pts
 * - Description completeness: 20 pts
 * - Photo count: 15 pts
 * - Review response rate: 20 pts
 * - Average star rating: 15 pts
 * - Posting frequency: 10 pts
 */

export interface HealthScoreInput {
  title: string | null;
  description: string | null;
  photo_count: number;
  review_response_rate: number; // 0–1
  average_rating: number | null;
  posting_frequency_per_month: number;
  review_count: number;
}

export interface HealthScoreBreakdown {
  total: number;
  title: number;
  description: number;
  photos: number;
  responseRate: number;
  rating: number;
  postingFrequency: number;
  grade: "A" | "B" | "C" | "D" | "F";
  insights: string[];
}

const POWER_KEYWORDS = [
  "cozy",
  "luxury",
  "stunning",
  "breathtaking",
  "private",
  "secluded",
  "modern",
  "renovated",
  "spacious",
  "charming",
  "elegant",
  "boutique",
  "panoramic",
  "waterfront",
  "beachfront",
  "mountain",
  "downtown",
  "walkable",
  "pet-friendly",
  "family-friendly",
  "romantic",
  "retreat",
  "escape",
  "oasis",
  "unique",
  "authentic",
];

function scoreTitleQuality(title: string | null): number {
  if (!title) return 0;

  let score = 0;

  // Length scoring: 40-80 chars is ideal
  const len = title.length;
  if (len >= 40 && len <= 80) score += 10;
  else if (len >= 25 && len < 40) score += 7;
  else if (len > 80 && len <= 100) score += 6;
  else if (len >= 10) score += 3;

  // Keyword scoring
  const titleLower = title.toLowerCase();
  const keywordsFound = POWER_KEYWORDS.filter((kw) =>
    titleLower.includes(kw)
  ).length;
  if (keywordsFound >= 2) score += 10;
  else if (keywordsFound === 1) score += 6;
  else score += 2;

  return Math.min(score, 20);
}

function scoreDescription(description: string | null): number {
  if (!description) return 0;

  let score = 0;
  const words = description.trim().split(/\s+/).length;

  // Word count scoring: 150-500 words is ideal
  if (words >= 150 && words <= 500) score += 10;
  else if (words >= 80 && words < 150) score += 7;
  else if (words > 500) score += 8;
  else if (words >= 30) score += 4;

  // Check for completeness signals
  const descLower = description.toLowerCase();
  const completenessSignals = [
    "bedroom",
    "bathroom",
    "kitchen",
    "parking",
    "wifi",
    "check-in",
    "checkout",
    "amenities",
    "nearby",
    "location",
  ];
  const signalsFound = completenessSignals.filter((s) =>
    descLower.includes(s)
  ).length;

  if (signalsFound >= 5) score += 10;
  else if (signalsFound >= 3) score += 7;
  else if (signalsFound >= 1) score += 4;

  return Math.min(score, 20);
}

function scorePhotoCount(count: number): number {
  if (count >= 25) return 15;
  if (count >= 20) return 13;
  if (count >= 15) return 11;
  if (count >= 10) return 8;
  if (count >= 5) return 5;
  if (count >= 1) return 2;
  return 0;
}

function scoreResponseRate(rate: number, reviewCount: number): number {
  // If no reviews yet, give partial credit (no opportunity to respond)
  if (reviewCount === 0) return 15;

  if (rate >= 0.95) return 20;
  if (rate >= 0.8) return 16;
  if (rate >= 0.6) return 12;
  if (rate >= 0.4) return 8;
  if (rate >= 0.2) return 4;
  return 0;
}

function scoreAverageRating(rating: number | null, reviewCount: number): number {
  if (!rating || reviewCount === 0) return 10; // neutral when no data
  if (rating >= 4.8) return 15;
  if (rating >= 4.5) return 13;
  if (rating >= 4.0) return 10;
  if (rating >= 3.5) return 7;
  if (rating >= 3.0) return 4;
  return 1;
}

function scorePostingFrequency(postsPerMonth: number): number {
  if (postsPerMonth >= 12) return 10;
  if (postsPerMonth >= 8) return 8;
  if (postsPerMonth >= 4) return 6;
  if (postsPerMonth >= 2) return 4;
  if (postsPerMonth >= 1) return 2;
  return 0;
}

function getGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function generateInsights(
  input: HealthScoreInput,
  breakdown: Omit<HealthScoreBreakdown, "insights" | "grade" | "total">
): string[] {
  const insights: string[] = [];

  if (breakdown.title < 12) {
    if (!input.title) {
      insights.push("Add a compelling title with power keywords to boost visibility");
    } else if (input.title.length < 40) {
      insights.push("Lengthen your title to 40–80 characters for optimal search ranking");
    } else {
      insights.push("Add destination or lifestyle keywords to your title (e.g., 'cozy', 'waterfront', 'private')");
    }
  }

  if (breakdown.description < 12) {
    if (!input.description) {
      insights.push("Write a detailed description — listings with 150+ words get 40% more bookings");
    } else {
      insights.push("Expand your description to cover amenities, location highlights, and check-in details");
    }
  }

  if (breakdown.photos < 11) {
    if (input.photo_count < 10) {
      insights.push(`Add ${10 - input.photo_count} more photos — aim for 20+ high-quality images`);
    } else {
      insights.push("Increase to 20+ photos covering every room, outdoor spaces, and neighborhood");
    }
  }

  if (breakdown.responseRate < 16 && input.review_count > 0) {
    insights.push(
      `Respond to all reviews — your ${Math.round((1 - input.review_response_rate) * input.review_count)} unanswered reviews hurt your ranking`
    );
  }

  if (breakdown.postingFrequency < 6) {
    insights.push("Post to social media at least 8x/month to keep your property top-of-mind");
  }

  if (breakdown.rating < 10 && input.average_rating && input.average_rating < 4.5) {
    insights.push("Focus on guest experience improvements to push your rating above 4.5★");
  }

  return insights.slice(0, 3); // top 3 insights
}

export function calculateHealthScore(input: HealthScoreInput): HealthScoreBreakdown {
  const title = scoreTitleQuality(input.title);
  const description = scoreDescription(input.description);
  const photos = scorePhotoCount(input.photo_count);
  const responseRate = scoreResponseRate(input.review_response_rate, input.review_count);
  const rating = scoreAverageRating(input.average_rating, input.review_count);
  const postingFrequency = scorePostingFrequency(input.posting_frequency_per_month);

  const total = title + description + photos + responseRate + rating + postingFrequency;
  const grade = getGrade(total);

  const partialBreakdown = { title, description, photos, responseRate, rating, postingFrequency };
  const insights = generateInsights(input, partialBreakdown);

  return {
    total,
    ...partialBreakdown,
    grade,
    insights,
  };
}
