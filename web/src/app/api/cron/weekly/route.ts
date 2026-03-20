import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FirecrawlClient } from "@mendable/firecrawl-js";
import { makeEntry, type ActivityEntry } from "@/lib/agentActivity";

export const maxDuration = 180; // weekly is heavier — allow 3 min

/* ------------------------------------------------------------------ */
/*  POST /api/cron/weekly                                              */
/*  Called once a week (Vercel cron or external scheduler).            */
/*  Expects: { properties, lastSeason? } in body                      */
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

const CURRENT_MONTH = new Date().toLocaleString("default", { month: "long" });
const CURRENT_SEASON = (() => {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
})();

export async function POST(req: NextRequest) {
  // ---- Auth guard ----
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const properties: Property[] = body.properties || [];
  const lastSeason: string | null = body.lastSeason || null;

  if (properties.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No properties to process",
      activity: [],
    });
  }

  const activity: ActivityEntry[] = [];
  const anthropic = new Anthropic();
  const firecrawl = new FirecrawlClient({
    apiKey: process.env.FIRECRAWL_API_KEY!,
  });

  const weeklyResults: Record<
    string,
    {
      audit?: Record<string, unknown>;
      contentPlan?: Record<string, unknown>;
      competitorScan?: Record<string, unknown>;
      seasonalContent?: Record<string, unknown>;
    }
  > = {};

  for (const prop of properties) {
    weeklyResults[prop.id] = {};

    try {
      // ================================================================
      // 1. Full re-audit of the listing
      // ================================================================
      let markdown = "";

      if (prop.url) {
        try {
          const scrapeResult = await firecrawl.scrape(prop.url, {
            formats: ["markdown"],
            waitFor: 5000,
          });
          markdown = (scrapeResult.markdown || "").slice(0, 12000);
        } catch (scrapeErr) {
          activity.push(
            makeEntry(
              "Weekly scrape failed",
              `Could not scrape ${prop.url}: ${scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr)}`,
              "audit",
              prop.id,
              prop.name,
            ),
          );
        }
      }

      if (markdown.length > 100) {
        const auditResp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `You are an expert STR marketing analyst. Perform a full audit of this listing.

URL: ${prop.url}
Property: ${prop.name}

Listing content (markdown):
${markdown}

Return JSON:
{
  "overall_score": 0-100,
  "summary": "2-3 sentence executive summary",
  "categories": [
    {
      "name": "Title & Description",
      "grade": "A-F",
      "score": 0-100,
      "findings": ["finding 1", "finding 2"],
      "recommendations": ["rec 1", "rec 2"]
    },
    { "name": "Photography", "grade": "A-F", "score": 0-100, "findings": [], "recommendations": [] },
    { "name": "SEO & Discoverability", "grade": "A-F", "score": 0-100, "findings": [], "recommendations": [] },
    { "name": "Reviews & Social Proof", "grade": "A-F", "score": 0-100, "findings": [], "recommendations": [] },
    { "name": "Competitive Positioning", "grade": "A-F", "score": 0-100, "findings": [], "recommendations": [] },
    { "name": "Conversion & Booking Flow", "grade": "A-F", "score": 0-100, "findings": [], "recommendations": [] }
  ],
  "top_3_fixes": [
    { "priority": 1, "title": "short title", "description": "what & why", "impact": "estimated impact" }
  ]
}

Be specific. Reference actual content. Keep findings/recs to 2-3 items each.
Return ONLY valid JSON.`,
            },
          ],
        });

        const auditText =
          auditResp.content[0].type === "text" ? auditResp.content[0].text : "";
        try {
          const cleaned = auditText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          const audit = JSON.parse(cleaned);
          weeklyResults[prop.id].audit = audit;

          const scoreDelta =
            prop.score !== null ? audit.overall_score - prop.score : null;
          activity.push(
            makeEntry(
              `Weekly audit complete — score: ${audit.overall_score}${scoreDelta !== null ? ` (${scoreDelta > 0 ? "+" : ""}${scoreDelta})` : ""}`,
              audit.summary || "Audit completed",
              "audit",
              prop.id,
              prop.name,
            ),
          );
        } catch {
          activity.push(
            makeEntry(
              "Audit ran but result unparseable",
              auditText.slice(0, 200),
              "audit",
              prop.id,
              prop.name,
            ),
          );
        }
      }

      // ================================================================
      // 2. Generate weekly content plan (5 deliverables)
      // ================================================================
      const contentResp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        messages: [
          {
            role: "user",
            content: `You are an AI CMO for a short-term rental. Generate this week's full content plan.

PROPERTY: ${prop.name}
SEASON: ${CURRENT_SEASON}
MONTH: ${CURRENT_MONTH}

Return JSON:
{
  "weekOf": "${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}",
  "summary": "One sentence about this week's strategy",
  "deliverables": [
    {
      "type": "social|review-response|listing-update|seasonal",
      "title": "short title",
      "content": "full ready-to-use text",
      "hashtags": "#hashtags if social",
      "platform": "instagram|facebook|tiktok",
      "imagePrompt": "what photo should show — property-specific",
      "scene": "morning-coffee|couple-dinner|friends-gathering|solo-reading|family-fun|outdoor-lounge",
      "priority": "high|medium|low",
      "suggestedDay": "Monday|Tuesday|etc"
    }
  ]
}

Rules:
- Exactly 5 deliverables: 3 social posts, 1 listing update, 1 seasonal piece
- Each social post targets a different audience (couples, families, solo travelers)
- Casual, warm, aspirational — not salesy
- All content MUST be family-friendly and brand-safe
- Focus on activities: cooking, reading, exploring, dining, relaxing
- NEVER reference bathrooms/showers/baths/bedrooms in romantic context
- Include specific image prompts for photo generation

Return ONLY valid JSON.`,
          },
        ],
      });

      const contentText =
        contentResp.content[0].type === "text"
          ? contentResp.content[0].text
          : "";
      try {
        const cleaned = contentText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const plan = JSON.parse(cleaned);
        weeklyResults[prop.id].contentPlan = plan;
        activity.push(
          makeEntry(
            `Weekly content plan generated — ${plan.deliverables?.length || 0} deliverables`,
            plan.summary || "Content plan created",
            "content",
            prop.id,
            prop.name,
          ),
        );
      } catch {
        activity.push(
          makeEntry(
            "Content plan generation failed to parse",
            contentText.slice(0, 200),
            "content",
            prop.id,
            prop.name,
          ),
        );
      }

      // ================================================================
      // 3. Competitor scan
      // ================================================================
      const compResp = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a competitive intelligence analyst for short-term rentals.

PROPERTY: ${prop.name}
URL: ${prop.url || "N/A"}
LOCATION: ${prop.location || "Unknown"}
SEASON: ${CURRENT_SEASON}

Analyze this property's competitive position for ${CURRENT_MONTH}. Return JSON:
{
  "alerts": [
    {
      "type": "opportunity|threat|trend",
      "severity": "high|medium|low",
      "title": "short title",
      "description": "2-3 sentences",
      "action": "what to do about it"
    }
  ],
  "marketInsights": [
    { "insight": "actionable observation", "source": "basis for this insight" }
  ],
  "pricingInsight": "pricing recommendation for this season"
}

Generate 3-5 alerts. Be specific to this property type and season.
Return ONLY valid JSON.`,
          },
        ],
      });

      const compText =
        compResp.content[0].type === "text" ? compResp.content[0].text : "";
      try {
        const cleaned = compText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const scan = JSON.parse(cleaned);
        weeklyResults[prop.id].competitorScan = scan;

        const highAlerts = (scan.alerts || []).filter(
          (a: { severity: string }) => a.severity === "high",
        );
        activity.push(
          makeEntry(
            `Competitor scan: ${scan.alerts?.length || 0} alerts (${highAlerts.length} high priority)`,
            (scan.alerts || [])
              .map((a: { title: string }) => a.title)
              .join(", "),
            "competitor",
            prop.id,
            prop.name,
          ),
        );
      } catch {
        activity.push(
          makeEntry(
            "Competitor scan failed to parse",
            compText.slice(0, 200),
            "competitor",
            prop.id,
            prop.name,
          ),
        );
      }

      // ================================================================
      // 4. Seasonal content (if season changed)
      // ================================================================
      const seasonChanged = lastSeason !== null && lastSeason !== CURRENT_SEASON;

      if (seasonChanged) {
        const seasonResp = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: `The season just changed from ${lastSeason} to ${CURRENT_SEASON}. Generate seasonal transition content for a short-term rental.

PROPERTY: ${prop.name}
NEW SEASON: ${CURRENT_SEASON}
MONTH: ${CURRENT_MONTH}

Return JSON:
{
  "seasonalUpdate": {
    "listingTitleSuggestion": "optimized title for the new season",
    "descriptionUpdate": "first paragraph updated for the season (2-3 sentences)",
    "socialPost": {
      "caption": "seasonal announcement caption with emojis",
      "hashtags": "#seasonal #hashtags",
      "imagePrompt": "what the seasonal photo should depict"
    },
    "pricingNote": "seasonal pricing suggestion"
  }
}

Keep it warm and authentic. Family-friendly only.
Return ONLY valid JSON.`,
            },
          ],
        });

        const seasonText =
          seasonResp.content[0].type === "text"
            ? seasonResp.content[0].text
            : "";
        try {
          const cleaned = seasonText
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          const seasonal = JSON.parse(cleaned);
          weeklyResults[prop.id].seasonalContent = seasonal;
          activity.push(
            makeEntry(
              `Season changed: ${lastSeason} → ${CURRENT_SEASON} — content generated`,
              `Generated seasonal listing update, social post, and pricing note for ${CURRENT_SEASON}`,
              "content",
              prop.id,
              prop.name,
            ),
          );
        } catch {
          activity.push(
            makeEntry(
              "Seasonal content generation failed",
              seasonText.slice(0, 200),
              "content",
              prop.id,
              prop.name,
            ),
          );
        }
      }
    } catch (propErr) {
      activity.push(
        makeEntry(
          `Weekly tasks failed for ${prop.name}`,
          propErr instanceof Error ? propErr.message : String(propErr),
          "audit",
          prop.id,
          prop.name,
        ),
      );
    }
  }

  // ================================================================
  // 5. Summary entry
  // ================================================================
  const summaryLines = properties.map((p) => {
    const r = weeklyResults[p.id] || {};
    const auditScore = (r.audit as Record<string, number>)?.overall_score;
    return `${p.name}: audit=${auditScore ?? "N/A"}, content=${(r.contentPlan as Record<string, unknown[]>)?.deliverables?.length ?? 0} deliverables, alerts=${((r.competitorScan as Record<string, unknown[]>)?.alerts)?.length ?? 0}`;
  });

  activity.push(
    makeEntry(
      "Weekly agent run complete",
      `Processed ${properties.length} propert${properties.length === 1 ? "y" : "ies"}.\n${summaryLines.join("\n")}`,
      "optimization",
    ),
  );

  console.log(
    `[CRON/WEEKLY] Complete. ${activity.length} activity entries for ${properties.length} properties.`,
  );

  return NextResponse.json({
    ok: true,
    processedProperties: properties.length,
    activity,
    results: weeklyResults,
  });
}
