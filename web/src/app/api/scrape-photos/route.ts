import { NextRequest, NextResponse } from "next/server";
import { FirecrawlClient } from "@mendable/firecrawl-js";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL required" }, { status: 400 });
    }

    const firecrawl = new FirecrawlClient({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    const result = await firecrawl.scrape(url, {
      formats: ["markdown"],
      waitFor: 5000,
    });

    const markdown = result.markdown || "";
    const metadata = (result.metadata || {}) as Record<string, string>;

    // Extract image URLs from markdown
    // Markdown images look like ![alt](url) or just bare URLs
    const imageRegex = /https:\/\/a0\.muscache\.com\/im\/pictures\/[^\s)"\]]+/g;
    const genericImageRegex = /https:\/\/[^\s)"\]]+\.(?:jpg|jpeg|png|webp)[^\s)"\]]*/gi;

    const airbnbPhotos = markdown.match(imageRegex) || [];
    const genericPhotos = markdown.match(genericImageRegex) || [];

    // Combine and deduplicate, prefer Airbnb CDN images
    const allPhotos = [...new Set([...airbnbPhotos, ...genericPhotos])];

    // Filter to actual property photos (skip icons, logos, avatars)
    const propertyPhotos = allPhotos.filter(
      (url) =>
        !url.includes("icon") &&
        !url.includes("logo") &&
        !url.includes("avatar") &&
        !url.includes("profile") &&
        !url.includes("badge") &&
        !url.includes("platform-asset") &&
        (url.includes("muscache.com") || url.includes("airbnb") || url.length > 80)
    );

    // Get description from metadata
    const description = metadata.description || metadata.ogDescription || "";

    return NextResponse.json({
      photos: propertyPhotos.slice(0, 20),
      description,
      total: propertyPhotos.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Photo scrape error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
