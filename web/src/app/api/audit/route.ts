import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

export const maxDuration = 60;

async function scrapeListingPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, and nav elements
  $("script, style, nav, footer, header, svg, noscript").remove();

  // Get the main content text
  const title = $("title").text();
  const metaDescription = $('meta[name="description"]').attr("content") || "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

  // Try to extract structured data
  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push($(el).html() || "");
    } catch {}
  });

  // Count images
  const imageCount = $("img").length;

  return `
URL: ${url}
Page Title: ${title}
Meta Description: ${metaDescription}
Image Count: ${imageCount}
Structured Data: ${jsonLd.join("\n")}
Page Content: ${bodyText}
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Scrape the listing
    let scrapedContent: string;
    try {
      scrapedContent = await scrapeListingPage(url);
    } catch {
      return NextResponse.json(
        { error: "Could not access that URL. Please check the link and try again." },
        { status: 400 }
      );
    }

    // Analyze with Claude
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
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

Be specific and actionable. Reference actual content from the listing. Don't be generic. If you can't determine something from the scraped data, note that and still provide your best assessment.

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no explanation.`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response
    let audit;
    try {
      // Strip any markdown code fences if present
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      audit = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse audit results. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ audit, url });
  } catch (err) {
    console.error("Audit error:", err);
    return NextResponse.json(
      { error: "Audit failed. Please try again." },
      { status: 500 }
    );
  }
}
