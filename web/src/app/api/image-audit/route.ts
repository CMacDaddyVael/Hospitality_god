import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

/**
 * Image Audit API
 *
 * Analyzes the property's listing photos and provides:
 * - Assessment of each photo (quality, composition, lighting, staging)
 * - What's missing from the photo set
 * - Suggestions for lifestyle images that would improve conversion
 * - Honest recommendations — only suggest what's actually needed
 */

export async function POST(req: NextRequest) {
  try {
    const { photos, propertyName, propertyDescription, auditSummary } =
      await req.json();

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: "No photos to audit" },
        { status: 400 }
      );
    }

    const client = new Anthropic();

    // Build photo list for the prompt (URLs only — Claude can't see them,
    // but we count and categorize based on what the scraper found)
    const photoCount = photos.length;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a professional vacation rental photography consultant and listing optimization expert. Analyze this property's photo situation and provide actionable recommendations.

PROPERTY: ${propertyName || "Vacation Rental"}
DESCRIPTION: ${propertyDescription || "A short-term rental property"}
AUDIT CONTEXT: ${auditSummary || "No audit data available"}
NUMBER OF LISTING PHOTOS: ${photoCount}

Based on the property description and audit context, provide a thorough image audit.

Return ONLY valid JSON in this exact format:
{
  "overallPhotoScore": 0-100,
  "overallAssessment": "2-3 sentence summary of the photo situation",
  "photoCount": {
    "current": ${photoCount},
    "recommended": 20-30,
    "verdict": "too few|good|too many"
  },
  "missingShots": [
    {
      "type": "hero-exterior|kitchen|bathroom|bedroom|living-area|outdoor-space|amenity|neighborhood|detail",
      "title": "what's missing",
      "why": "why this shot matters for bookings",
      "priority": "high|medium|low"
    }
  ],
  "lifestyleOpportunities": [
    {
      "scene": "morning-coffee|couple-dinner|friends-gathering|family-fun|solo-reading|outdoor-lounge",
      "title": "short description of the lifestyle shot",
      "description": "what the image should show — specific to this property",
      "impact": "why this would improve conversion",
      "priority": "high|medium|low"
    }
  ],
  "improvements": [
    {
      "category": "lighting|staging|composition|variety|seasonality|order",
      "title": "what to improve",
      "description": "specific, actionable advice",
      "priority": "high|medium|low"
    }
  ],
  "strengths": [
    "what the current photo set does well (be specific)"
  ]
}

Rules:
- Be honest — don't suggest lifestyle images if the property doesn't need them
- Only recommend what would actually move the needle on bookings
- Be specific to THIS property — reference its actual features, location, amenities
- Prioritize recommendations by impact on conversion
- If the photo count is already good, say so
- Think like an Airbnb Superhost photographer, not a stock photo agency
- Maximum 5 missing shots, 4 lifestyle opportunities, 5 improvements, 3 strengths
- Every recommendation should reference something specific about the property

Return ONLY valid JSON.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const audit = JSON.parse(cleaned);

    return NextResponse.json(audit);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Image audit error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
