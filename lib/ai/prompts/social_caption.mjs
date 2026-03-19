/**
 * Prompt template for: social_caption
 *
 * Input context:
 *   - platform: "instagram" | "tiktok" | "facebook" | "both"
 *   - contentType: "property_showcase" | "local_experience" | "seasonal" | "guest_spotlight" | "behind_scenes"
 *   - propertyName: string
 *   - location: string
 *   - propertyType: string
 *   - keyFeatures: string[] (what to highlight in this post)
 *   - season: string (optional — "summer", "fall", etc.)
 *   - targetEmotion: string (optional — "wanderlust", "cozy", "adventure", "romance")
 *   - callToAction: string (optional — "book now", "DM for availability", "link in bio")
 *   - hashtagStyle: "minimal" | "moderate" | "full" (default: moderate)
 *
 * Output JSON schema:
 *   - caption: string (full caption text)
 *   - hashtags: string[] (relevant hashtags, separate from caption)
 *   - fullPost: string (caption + hashtags combined, ready to copy-paste)
 *   - alternateHook: string (alternate opening line to A/B test)
 *   - bestPostingTime: string (recommended posting time/day)
 *   - contentNotes: string (brief notes on what visual would pair best)
 */

export function socialCaptionPrompt(context) {
  const {
    platform = "instagram",
    contentType = "property_showcase",
    propertyName = "our property",
    location = "",
    propertyType = "vacation rental",
    keyFeatures = [],
    season = "",
    targetEmotion = "wanderlust",
    callToAction = "link in bio to book",
    hashtagStyle = "moderate",
  } = context;

  const platformConfig = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.instagram;
  const contentTypeConfig = CONTENT_TYPE_CONFIGS[contentType] || CONTENT_TYPE_CONFIGS.property_showcase;
  const hashtagCount = HASHTAG_COUNTS[hashtagStyle] || HASHTAG_COUNTS.moderate;

  const systemPrompt = `You are a social media content strategist specializing in travel and short-term rental marketing. You write captions that stop the scroll and convert dreamers into bookers.

Caption principles:
- Hook in the first line — this is what shows before "more" is clicked
- Short sentences. White space. Readable on mobile.
- Emotion first, features second
- Hashtags are research tools and discovery engines — pick carefully
- Every post has one clear purpose: inspire + direct to booking

CRITICAL: You must respond ONLY with a valid JSON object. Return exactly this structure:
{
  "caption": "string — main caption without hashtags",
  "hashtags": ["array", "of", "hashtags", "with", "#"],
  "fullPost": "string — caption + blank line + hashtags, ready to paste",
  "alternateHook": "string — alternate first line for A/B testing",
  "bestPostingTime": "string — recommended timing",
  "contentNotes": "string — what visual would pair best with this caption"
}`;

  const userPrompt = `Write a ${platform} caption for this ${contentType.replace(/_/g, " ")} post.

## Property
- **Name:** ${propertyName}
- **Type:** ${propertyType}
- **Location:** ${location || "not specified"}
${season ? `- **Season/Theme:** ${season}` : ""}

## Post Focus
- **Content Type:** ${contentTypeConfig.description}
- **Key Features to Highlight:**
${keyFeatures.length > 0 ? keyFeatures.map((f) => `  - ${f}`).join("\n") : "  - (none specified — use property type and location)"}
- **Target Emotion:** ${targetEmotion}
- **Call to Action:** ${callToAction}

## Platform Requirements
${platformConfig.requirements}

## Hashtag Strategy
- Style: ${hashtagStyle} (${hashtagCount} hashtags)
- ${contentTypeConfig.hashtagGuidance}
- Mix: broad discovery + niche community + location-specific + property-type

Write a caption that makes someone stop scrolling and imagine themselves there.

Return ONLY the JSON object as specified.`;

  return { systemPrompt, userPrompt };
}

// ─── Platform Configurations ──────────────────────────────────────────────────

const PLATFORM_CONFIGS = {
  instagram: {
    requirements: `- Caption: 125-150 words max for primary text (rest hidden behind "more")
- Hook: first 1-2 lines must be irresistible
- Tone: aspirational but authentic
- Line breaks: use them liberally for readability
- Emojis: 2-4 max, used purposefully not decoratively`,
  },

  tiktok: {
    requirements: `- Caption: very short, 50-100 words
- Hook: immediate, punchy — TikTok users have zero patience
- Tone: casual, conversational, relatable
- Trending sounds/references: welcome if relevant
- Emojis: 1-3, high energy`,
  },

  facebook: {
    requirements: `- Caption: 100-250 words, can tell more of a story
- Tone: warm, community-focused, slightly more formal than IG
- Hook: still important, but more latitude for storytelling
- Questions work well to drive comments
- Emojis: minimal, 0-2`,
  },

  both: {
    requirements: `- Write for Instagram primarily (will adapt for other platforms)
- Caption: 125-150 words
- Hook: works across platforms
- Emojis: 2-4, platform-appropriate`,
  },
};

// ─── Content Type Configurations ──────────────────────────────────────────────

const CONTENT_TYPE_CONFIGS = {
  property_showcase: {
    description: "Showcasing the property itself — spaces, amenities, design",
    hashtagGuidance: "Focus on property type, design aesthetic, amenity-specific tags",
  },

  local_experience: {
    description: "Highlighting local area, nearby attractions, experiences",
    hashtagGuidance: "Focus on destination, local landmarks, experience type",
  },

  seasonal: {
    description: "Season-specific content — holidays, weather, seasonal activities",
    hashtagGuidance: "Include seasonal hashtags, holiday tags, seasonal activity tags",
  },

  guest_spotlight: {
    description: "Celebrating guests (with permission) — UGC style",
    hashtagGuidance: "Community-focused tags, UGC tags, experience-type tags",
  },

  behind_scenes: {
    description: "Behind-the-scenes of hosting — prep, decor, care details",
    hashtagGuidance: "Hosting community tags, hospitality tags, small business tags",
  },
};

// ─── Hashtag Counts ───────────────────────────────────────────────────────────

const HASHTAG_COUNTS = {
  minimal: "5-8 hashtags",
  moderate: "10-15 hashtags",
  full: "20-30 hashtags",
};
