import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { listingUrl, propertyName, propertyDescription } = await req.json();

    if (!listingUrl) {
      return NextResponse.json({ error: "listingUrl required" }, { status: 400 });
    }

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a competitive intelligence analyst for short-term rentals.

## User's Listing
URL: ${listingUrl}
Name: ${propertyName || "Unknown"}
Description: ${propertyDescription || "A short-term rental property"}

## Task
Based on the listing URL and description, analyze this property's competitive position. Identify what comparable properties in this area likely offer based on your knowledge of the STR market, and generate actionable competitive intelligence.

Return JSON:
{
  "location": "city/area identified from the listing",
  "propertyType": "cabin/beach house/apartment/etc",
  "priceRange": "estimated nightly rate range for comparable properties",
  "alerts": [
    {
      "type": "opportunity|threat|trend",
      "severity": "high|medium|low",
      "title": "short alert title",
      "description": "what's happening and why it matters (2-3 sentences)",
      "action": "specific thing the host should do about it",
      "impact": "estimated impact on bookings/revenue"
    }
  ],
  "strengths": ["what this listing does well vs typical competitors"],
  "weaknesses": ["where this listing falls behind typical competitors"],
  "marketInsights": [
    {
      "insight": "a specific, actionable market observation",
      "source": "what this is based on (seasonal trend, market data, listing analysis)"
    }
  ],
  "suggestedAmenities": ["amenities that top-performing listings in this area typically offer that this one might be missing"],
  "pricingInsight": "specific pricing recommendation based on the market"
}

Be specific to THIS property and THIS market. Don't be generic.
Generate 5-7 alerts covering: pricing, amenities, seasonal opportunities, content gaps, and competitive threats.
Keep descriptions concise (1-2 sentences each).

Return ONLY valid JSON.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Competitor scan error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
