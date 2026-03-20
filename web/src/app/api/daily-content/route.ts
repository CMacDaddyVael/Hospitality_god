import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * Daily Content Agent
 *
 * This endpoint is called by a cron job (or manually).
 * It analyzes the property's current state and generates
 * a prioritized list of content tasks for the day/week.
 *
 * The agent considers:
 * - Current season and upcoming holidays
 * - Recent reviews that need responses
 * - Social posting cadence (have we posted enough this week?)
 * - Listing freshness (when was copy last updated?)
 * - Seasonal photo opportunities
 * - Competitive changes
 */

const CURRENT_MONTH = new Date().toLocaleString("default", { month: "long" });
const CURRENT_SEASON = (() => {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
})();

export async function POST(req: NextRequest) {
  try {
    const { propertyName, propertyDescription, listingUrl, recentReviews, lastPostDate, auditFindings } = await req.json();

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are an AI CMO managing social media and marketing for a short-term rental property. Generate this week's content plan.

PROPERTY: ${propertyName || "Vacation Rental"}
DESCRIPTION: ${propertyDescription || "A short-term rental property"}
LISTING URL: ${listingUrl || "N/A"}
CURRENT MONTH: ${CURRENT_MONTH}
CURRENT SEASON: ${CURRENT_SEASON}
RECENT REVIEWS TO RESPOND TO: ${recentReviews || "None provided"}
LAST SOCIAL POST: ${lastPostDate || "Unknown"}
${auditFindings || ""}

CRITICAL: Every piece of content MUST be specific to THIS property. Reference its actual name, location, amenities, unique features, and audit findings. Do NOT generate generic vacation rental content. If the property has a hot tub, mention THAT hot tub. If it's in the mountains, reference THAT mountain town. Every caption should make it obvious which property this is about.

Generate a JSON content plan with exactly 5 deliverables for this week. Mix of types.

{
  "weekOf": "March 19, 2026",
  "summary": "One sentence about this week's content strategy",
  "deliverables": [
    {
      "type": "social",
      "title": "short descriptive title",
      "content": "the full ready-to-post caption with emojis",
      "hashtags": "#hashtag1 #hashtag2 ...",
      "platform": "instagram",
      "imagePrompt": "brief description of what lifestyle photo should show — specific to this property",
      "scene": "morning-coffee|couple-dinner|friends-gathering|solo-reading|family-fun|outdoor-lounge",
      "priority": "high|medium|low",
      "suggestedDay": "Monday|Tuesday|etc"
    },
    {
      "type": "review-response",
      "title": "Response to [guest name]'s review",
      "content": "the full review response text",
      "priority": "high",
      "suggestedDay": "Today"
    },
    {
      "type": "listing-update",
      "title": "what to update",
      "content": "the optimized copy",
      "priority": "medium",
      "reason": "why this update matters right now"
    },
    {
      "type": "seasonal",
      "title": "seasonal content piece",
      "content": "the content",
      "imagePrompt": "what the seasonal photo should show",
      "scene": "one of the scene types",
      "priority": "medium"
    }
  ]
}

Rules:
- 3 social posts, 1 listing update, 1 seasonal or review response
- Captions should be casual, warm, aspirational — not salesy
- Reference specific features of the property
- Consider ${CURRENT_SEASON} and any upcoming holidays

CONTENT SAFETY (STRICT — NEVER VIOLATE):
- NEVER suggest romantic, sexual, or intimate content between people (no "showering together", no "romantic bath", no bedroom intimacy, no couples in bed)
- ALL content must be family-friendly and brand-safe
- Focus on ACTIVITIES: cooking, reading, exploring, dining, relaxing on the deck, playing games, hiking, swimming
- Couples content is fine but keep it wholesome: cooking together, sunset drinks on the patio, exploring the town — NOT intimate/bedroom/bathroom scenarios
- Never reference bathrooms, showers, baths, or bedrooms in a romantic context
- Think "Airbnb marketing" not "honeymoon brochure"
- Each social post should target a different audience (couples, families, solo travelers)
- Include specific image prompts that reference the actual property spaces

Return ONLY valid JSON.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const plan = JSON.parse(cleaned);

    return NextResponse.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Daily content error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
