import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FirecrawlClient } from "@mendable/firecrawl-js";

export const maxDuration = 120;

/**
 * Real Competitor Scanner
 *
 * 1. Scrapes the user's listing to understand their property
 * 2. Uses Firecrawl search to find similar listings in the same area
 * 3. Scrapes 3-5 actual competitor listings
 * 4. Uses Claude to do a head-to-head comparison
 */

async function scrapeListingData(firecrawl: FirecrawlClient, url: string) {
  try {
    const result = await firecrawl.scrape(url, {
      formats: ["markdown"],
      waitFor: 8000,
    });
    return {
      url,
      markdown: (result.markdown || "").slice(0, 5000),
      title: (result.metadata as Record<string, string>)?.title || "",
      description: (result.metadata as Record<string, string>)?.description || "",
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { listingUrl, propertyName, propertyDescription } = await req.json();

    if (!listingUrl) {
      return NextResponse.json({ error: "listingUrl required" }, { status: 400 });
    }

    const firecrawl = new FirecrawlClient({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    // Step 1: Scrape the user's listing
    console.log("Scraping user listing...");
    const userListing = await scrapeListingData(firecrawl, listingUrl);
    if (!userListing) {
      return NextResponse.json({ error: "Could not access your listing" }, { status: 400 });
    }

    // Step 2: Extract location from the listing to search for competitors
    const client = new Anthropic();

    const locationRes = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `Extract the location and property type from this Airbnb listing. Return JSON only:
{"city": "city name", "state": "state", "propertyType": "cabin/house/apartment/condo/etc", "guests": number, "bedrooms": number}

Listing title: ${userListing.title}
Description: ${userListing.description}
Content: ${userListing.markdown.slice(0, 2000)}

Return ONLY JSON.`,
      }],
    });

    const locText = locationRes.content[0].type === "text" ? locationRes.content[0].text : "{}";
    const locData = JSON.parse(locText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    console.log("Location:", locData);

    // Step 3: Search for competitor listings using Firecrawl search
    const searchQuery = `airbnb ${locData.city || ""} ${locData.state || ""} ${locData.propertyType || "vacation rental"} ${locData.bedrooms || ""}+ bedrooms`;
    console.log("Searching for competitors:", searchQuery);

    let competitorUrls: string[] = [];
    try {
      const searchResults = await firecrawl.search(searchQuery, { limit: 8 });
      competitorUrls = (searchResults.data || [])
        .map((r: { url?: string }) => r.url || "")
        .filter((url: string) =>
          url.includes("airbnb.com/rooms") &&
          !url.includes(listingUrl.split("/rooms/")[1]?.split("?")[0] || "NOMATCH")
        )
        .slice(0, 5);
    } catch (searchErr) {
      console.log("Search failed, using Claude to find competitors:", searchErr);
    }

    // If search didn't find enough, ask Claude for likely competitor search URLs
    if (competitorUrls.length < 3) {
      console.log("Not enough search results, asking Claude for competitor URLs...");
      // Fall through to Claude-only analysis with the user listing data
    }

    // Step 4: Scrape competitor listings (up to 3 to stay within time limits)
    const competitorData: { url: string; markdown: string; title: string; description: string }[] = [];
    for (const compUrl of competitorUrls.slice(0, 3)) {
      console.log("Scraping competitor:", compUrl);
      const data = await scrapeListingData(firecrawl, compUrl);
      if (data) competitorData.push(data);
    }

    console.log(`Scraped ${competitorData.length} competitor listings`);

    // Step 5: Head-to-head analysis with Claude
    const competitorContext = competitorData.length > 0
      ? competitorData.map((c, i) => `
COMPETITOR ${i + 1}:
URL: ${c.url}
Title: ${c.title}
Description: ${c.description}
Content: ${c.markdown.slice(0, 3000)}
`).join("\n---\n")
      : "No competitor listings were scraped directly. Analyze based on your knowledge of the market.";

    const analysisRes = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are a competitive intelligence analyst for short-term rentals. Do a head-to-head comparison.

## USER'S LISTING:
URL: ${userListing.url}
Name: ${propertyName || userListing.title}
Description: ${propertyDescription || userListing.description}
Content: ${userListing.markdown.slice(0, 4000)}

## COMPETITOR LISTINGS:
${competitorContext}

## TASK:
Compare the user's listing against the competitors (or market if no competitors were scraped). Return JSON:

{
  "location": "city, state",
  "propertyType": "type",
  "priceRange": "estimated range",
  "competitors": [
    {
      "name": "listing name",
      "url": "listing url",
      "strengths": ["what they do better than the user"],
      "weaknesses": ["where user beats them"],
      "price": "estimated nightly rate",
      "rating": "rating if visible",
      "reviews": "review count if visible",
      "keyDifference": "the one thing that stands out"
    }
  ],
  "alerts": [
    {
      "type": "opportunity|threat|trend",
      "severity": "high|medium|low",
      "title": "short title",
      "description": "2-3 sentences based on REAL competitive differences found",
      "action": "specific action to take",
      "impact": "estimated revenue/booking impact"
    }
  ],
  "headToHead": {
    "title": {"user": "user's title", "bestCompetitor": "best competitor title", "verdict": "who wins and why"},
    "photos": {"user": "assessment", "competitors": "assessment", "verdict": "who wins and why"},
    "amenities": {"userMissing": ["amenities competitors have that user doesn't"], "userAdvantage": ["amenities user has that competitors don't"]},
    "reviews": {"user": "rating/count", "competitors": "average rating/count", "verdict": "assessment"},
    "pricing": {"user": "estimated rate", "competitors": "average rate", "verdict": "under/over/at market"}
  },
  "strengths": ["user's competitive advantages"],
  "weaknesses": ["user's competitive disadvantages"],
  "marketInsights": [
    {"insight": "specific observation", "source": "what this is based on"}
  ],
  "suggestedAmenities": ["amenities to add based on what competitors offer"],
  "pricingInsight": "specific pricing recommendation"
}

Be specific. Reference actual competitor listings by name. If you scraped real competitors, compare directly. Keep descriptions concise.

Return ONLY valid JSON.`,
      }],
    });

    const text = analysisRes.content[0].type === "text" ? analysisRes.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Competitor scan error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
