import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FirecrawlClient } from "@mendable/firecrawl-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Scrape with Firecrawl
    const firecrawl = new FirecrawlClient({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    console.log("Scraping:", url);
    const scrapeResult = await firecrawl.scrape(url, {
      formats: ["markdown"],
      waitFor: 5000,
    });

    const markdown = (scrapeResult.markdown || "").slice(0, 12000);
    const metadata = (scrapeResult.metadata || {}) as Record<string, string>;

    if (!markdown || markdown.length < 100) {
      console.error("Firecrawl returned too little content:", markdown.length);
      return NextResponse.json(
        { error: "Could not read that listing. Please check the URL and try again." },
        { status: 400 }
      );
    }

    console.log("Scraped", markdown.length, "chars of markdown");

    const scrapedContent = `
URL: ${url}
Page Title: ${metadata.title || ""}
Meta Description: ${metadata.description || ""}
OG Image: ${metadata.ogImage || ""}
Status Code: ${metadata.statusCode || ""}

Page Content (markdown):
${markdown}
    `.trim();

    console.log("Scraped content length:", scrapedContent.length);

    // Analyze with Claude
    const client = new Anthropic();

    console.log("Calling Claude...");
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are an expert STR (short-term rental) marketing analyst. Analyze this Airbnb/Vrbo listing page and produce a detailed audit.

## Scraped Listing Data:
${scrapedContent}

## Produce a JSON audit report with this exact structure:
{
  "property_name": "name of the property",
  "overall_score": 0-100,
  "summary": "2-3 sentence executive summary of the listing's marketing health",
  "categories": [
    {
      "name": "Title & Description",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["specific finding 1", "specific finding 2"],
      "recommendations": ["specific actionable fix 1", "specific actionable fix 2"]
    },
    {
      "name": "Photography",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    },
    {
      "name": "SEO & Discoverability",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    },
    {
      "name": "Reviews & Social Proof",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    },
    {
      "name": "Competitive Positioning",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    },
    {
      "name": "Conversion & Booking Flow",
      "grade": "A/B/C/D/F",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    }
  ],
  "top_5_fixes": [
    {
      "priority": 1,
      "title": "short title",
      "description": "what to do and why",
      "impact": "estimated impact (e.g., '15-25% more visibility')"
    }
  ],
  "optimized_title": "a rewritten, optimized listing title",
  "optimized_description_preview": "first 2-3 sentences of an optimized description"
}

Be specific and actionable. Reference actual content from the listing. Don't be generic.
Keep each findings and recommendations array to 2-3 items max. Keep descriptions concise (1-2 sentences each).

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    console.log("Claude response length:", text.length);

    // Parse the JSON response
    let audit;
    try {
      const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      audit = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      console.error("Raw response:", text.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to parse audit results. Please try again." },
        { status: 500 }
      );
    }

    console.log("Audit complete. Score:", audit.overall_score);
    return NextResponse.json({ audit, url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Audit error:", message);
    return NextResponse.json(
      { error: `Audit failed: ${message}` },
      { status: 500 }
    );
  }
}
