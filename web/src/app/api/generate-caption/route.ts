import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { scene, season, propertyDescription } = await req.json();

    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Write an Instagram caption and hashtags for a short-term rental property lifestyle photo.

Scene: ${scene}
Season: ${season}
Property: ${propertyDescription || "A beautiful vacation rental property"}

Rules:
- Casual, warm, aspirational tone
- 2-3 sentences max for the caption
- Include 1-2 relevant emojis
- Generate 8-12 relevant hashtags
- Make it feel authentic, not salesy
- Focus on the EXPERIENCE, not the property features

Return JSON only:
{"caption": "the caption text", "hashtags": "#hashtag1 #hashtag2 ..."}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const data = JSON.parse(cleaned);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Caption error:", err);
    return NextResponse.json({ caption: "", hashtags: "" });
  }
}
