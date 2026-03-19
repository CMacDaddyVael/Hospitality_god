/**
 * Prompt template for: listing_rewrite
 *
 * Input context:
 *   - currentTitle: string
 *   - currentDescription: string
 *   - propertyType: string (e.g. "cabin", "condo", "beach house")
 *   - location: string
 *   - amenities: string[] (key features)
 *   - targetPlatform: "airbnb" | "vrbo" | "both"
 *   - bedroomCount: number
 *   - bathroomCount: number
 *   - maxGuests: number
 *   - uniqueFeatures: string[] (optional)
 *
 * Output JSON schema:
 *   - title: string (max 50 chars, SEO-optimized)
 *   - description: string (full optimized description)
 *   - tags: string[] (up to 10 relevant search tags)
 *   - highlights: string[] (3-5 bullet points for quick scan)
 *   - seoKeywords: string[] (keywords woven naturally into description)
 *   - changeLog: string[] (what was changed and why)
 */

export function listingRewritePrompt(context) {
  const {
    currentTitle = "",
    currentDescription = "",
    propertyType = "vacation rental",
    location = "",
    amenities = [],
    targetPlatform = "airbnb",
    bedroomCount = "",
    bathroomCount = "",
    maxGuests = "",
    uniqueFeatures = [],
  } = context;

  const systemPrompt = `You are an expert short-term rental listing copywriter with deep knowledge of Airbnb and Vrbo search algorithms, guest psychology, and conversion optimization.

Your job is to rewrite property listings to maximize search visibility, click-through rate, and bookings.

Key principles:
- Lead with emotional benefits, not just features ("wake up to mountain views" not "has mountain views")
- Front-load the most compelling differentiator in the title
- Use natural language that guests search for, not marketing fluff
- Airbnb titles: max 50 characters, most impactful words first
- Descriptions should be scannable with natural paragraph breaks
- Every amenity should be presented as a benefit, not a feature

CRITICAL: You must respond ONLY with a valid JSON object. No prose, no explanation, no markdown outside the JSON. Return exactly this structure:
{
  "title": "string — optimized title, max 50 characters",
  "description": "string — full rewritten description",
  "tags": ["array", "of", "up to 10", "search tags"],
  "highlights": ["3-5 bullet points for quick scan"],
  "seoKeywords": ["keywords", "naturally woven into description"],
  "changeLog": ["what was changed", "and why"]
}`;

  const userPrompt = `Rewrite this ${propertyType} listing for maximum performance on ${targetPlatform}.

## Current Listing
**Title:** ${currentTitle || "(no title provided)"}

**Description:**
${currentDescription || "(no description provided)"}

## Property Details
- Type: ${propertyType}
- Location: ${location || "not specified"}
- Bedrooms: ${bedroomCount || "not specified"}
- Bathrooms: ${bathroomCount || "not specified"}
- Max Guests: ${maxGuests || "not specified"}

## Key Amenities
${amenities.length > 0 ? amenities.map((a) => `- ${a}`).join("\n") : "- (none provided)"}

## Unique Features / Selling Points
${uniqueFeatures.length > 0 ? uniqueFeatures.map((f) => `- ${f}`).join("\n") : "- (none provided)"}

Optimize for:
1. Search visibility (relevant keywords guests actually type)
2. Click-through rate (compelling title that stands out)
3. Conversion (description that answers objections and builds desire)

Return ONLY the JSON object as specified.`;

  return { systemPrompt, userPrompt };
}
