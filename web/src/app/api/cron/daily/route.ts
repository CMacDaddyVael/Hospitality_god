import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FirecrawlClient } from "@mendable/firecrawl-js";
import { makeEntry, type ActivityEntry } from "@/lib/agentActivity";

export const maxDuration = 120; // needs headroom for multi-property loops

/* ------------------------------------------------------------------ */
/*  POST /api/cron/daily                                               */
/*  Called once a day (Vercel cron or external scheduler).             */
/*  Expects: { properties, contentPlan? } in body                     */
/*  Auth: CRON_SECRET header must match env var                        */
/* ------------------------------------------------------------------ */

interface Property {
  id: string;
  name: string;
  platform: string;
  url: string;
  score: number | null;
  lastAudited: string | null;
  photoUrl: string | null;
  location: string | null;
  status: string;
}

const CURRENT_SEASON = (() => {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
})();

export async function POST(req: NextRequest) {
  // ---- Auth guard ----
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const properties: Property[] = body.properties || [];
  const existingContentPlan = body.contentPlan || null;

  if (properties.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No properties to process",
      activity: [],
    });
  }

  const activity: ActivityEntry[] = [];
  const anthropic = new Anthropic();
  const firecrawl = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY! });

  for (const prop of properties) {
    try {
      // ================================================================
      // 1. Re-scrape listing to check for new reviews & score changes
      // ================================================================
      let markdown = "";
      let reviews: string[] = [];
      let currentScore: number | null = null;

      if (prop.url) {
        try {
          const scrapeResult = await firecrawl.scrape(prop.url, {
            formats: ["markdown"],
            waitFor: 5000,
          });
          markdown = (scrapeResult.markdown || "").slice(0, 12000);

          // Quick review extraction via Claude
          if (markdown.length > 100) {
            activity.push(
              makeEntry(
                "Listing re-scraped",
                `Scraped ${markdown.length} chars from ${prop.url}`,
                "audit",
                prop.id,
                prop.name,
              ),
            );

            const reviewExtract = await anthropic.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              messages: [
                {
                  role: "user",
                  content: `Extract any guest reviews from this listing page content. Also estimate an overall listing quality score (0-100).

Listing content (truncated):
${markdown.slice(0, 6000)}

Return JSON only:
{
  "reviews": [
    { "guest": "name or Anonymous", "text": "review text", "rating": 5, "date": "approx date or unknown" }
  ],
  "estimatedScore": 75
}

If no reviews are visible, return empty reviews array. Return ONLY valid JSON.`,
                },
              ],
            });

            const reviewText = reviewExtract.content[0].type === "text" ? reviewExtract.content[0].text : "";
            try {
              const cleaned = reviewText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
              const parsed = JSON.parse(cleaned);
              reviews = (parsed.reviews || []).map((r: { guest: string; text: string }) => `${r.guest}: ${r.text}`);
              currentScore = parsed.estimatedScore ?? null;
            } catch {
              // parse failed — continue without reviews
            }
          }
        } catch (scrapeErr) {
          activity.push(
            makeEntry(
              "Scrape failed",
              `Could not scrape ${prop.url}: ${scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)}`,
              "audit",
              prop.id,
              prop.name,
            ),
          );
        }
      }

      // ================================================================
      // 2. Check if listing score changed
      // ================================================================
      if (currentScore !== null && prop.score !== null && currentScore !== prop.score) {
        const delta = currentScore - prop.score;
        activity.push(
          makeEntry(
            `Score ${delta > 0 ? "improved" : "dropped"}: ${prop.score} → ${currentScore}`,
            `Listing quality score changed by ${delta > 0 ? "+" : ""}${delta} points. Previous: ${prop.score}, Current: ${currentScore}.`,
            "audit",
            prop.id,
            prop.name,
          ),
        );
      }

      // ================================================================
      // 3. Generate review response drafts for new reviews
      // ================================================================
      if (reviews.length > 0) {
        activity.push(
          makeEntry(
            `Found ${reviews.length} review(s)`,
            reviews.join(" | "),
            "review",
            prop.id,
            prop.name,
          ),
        );

        const reviewDraftResp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: `You manage a short-term rental called "${prop.name}". Write warm, professional host responses to these guest reviews.

Reviews:
${reviews.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Return JSON only:
{
  "responses": [
    { "guestReview": "original review snippet", "response": "your drafted host response" }
  ]
}

Rules:
- Thank the guest by name if possible
- Reference something specific they mentioned
- Keep each response 2-4 sentences
- Warm and genuine, not corporate
- Invite them back

Return ONLY valid JSON.`,
            },
          ],
        });

        const draftText = reviewDraftResp.content[0].type === "text" ? reviewDraftResp.content[0].text : "";
        try {
          const cleaned = draftText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          for (const resp of parsed.responses || []) {
            activity.push(
              makeEntry(
                "Review response drafted",
                `Guest said: "${(resp.guestReview || "").slice(0, 80)}..." → Draft: "${(resp.response || "").slice(0, 120)}..."`,
                "review",
                prop.id,
                prop.name,
              ),
            );
          }
        } catch {
          // parse failed
        }
      }

      // ================================================================
      // 4. Generate content deliverables if inbox is empty
      // ================================================================
      const hasContent = existingContentPlan && existingContentPlan.deliverables && existingContentPlan.deliverables.length > 0;

      if (!hasContent) {
        const contentResp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: `You are an AI CMO for a short-term rental. Generate 3 quick social content pieces for today.

PROPERTY: ${prop.name}
SEASON: ${CURRENT_SEASON}
MONTH: ${new Date().toLocaleString("default", { month: "long" })}

Return JSON only:
{
  "deliverables": [
    {
      "type": "social",
      "title": "short title",
      "content": "ready-to-post caption with emojis",
      "hashtags": "#relevant #hashtags",
      "platform": "instagram",
      "scene": "morning-coffee|couple-dinner|friends-gathering|solo-reading|family-fun|outdoor-lounge",
      "imagePrompt": "what lifestyle photo should show"
    }
  ]
}

Rules:
- 3 posts targeting different audiences (couples, families, solo travelers)
- Casual, warm, aspirational — not salesy
- Season-appropriate content
- MUST be family-friendly and brand-safe
- Focus on activities: cooking, reading, exploring, dining, relaxing

Return ONLY valid JSON.`,
            },
          ],
        });

        const contentText = contentResp.content[0].type === "text" ? contentResp.content[0].text : "";
        try {
          const cleaned = contentText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          const count = parsed.deliverables?.length || 0;
          activity.push(
            makeEntry(
              `Generated ${count} content deliverable(s)`,
              `Auto-generated daily social content: ${(parsed.deliverables || []).map((d: { title: string }) => d.title).join(", ")}`,
              "content",
              prop.id,
              prop.name,
            ),
          );
        } catch {
          activity.push(
            makeEntry(
              "Content generation attempted",
              "Generated content but could not parse result",
              "content",
              prop.id,
              prop.name,
            ),
          );
        }
      } else {
        activity.push(
          makeEntry(
            "Content inbox not empty — skipped generation",
            `${existingContentPlan.deliverables.length} deliverable(s) already queued`,
            "content",
            prop.id,
            prop.name,
          ),
        );
      }
    } catch (propErr) {
      activity.push(
        makeEntry(
          `Daily tasks failed for ${prop.name}`,
          propErr instanceof Error ? propErr.message : String(propErr),
          "audit",
          prop.id,
          prop.name,
        ),
      );
    }
  }

  // Final summary entry
  activity.push(
    makeEntry(
      "Daily agent run complete",
      `Processed ${properties.length} propert${properties.length === 1 ? "y" : "ies"}. Generated ${activity.length} activity entries.`,
      "optimization",
    ),
  );

  console.log(`[CRON/DAILY] Complete. ${activity.length} activity entries for ${properties.length} properties.`);

  return NextResponse.json({
    ok: true,
    processedProperties: properties.length,
    activity,
  });
}
