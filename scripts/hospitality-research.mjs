import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = join(__dirname, "..", "knowledge-base");

const TOPICS = [
  {
    name: "SEO & GEO",
    file: "seo-geo.md",
    queries: [
      "hotel SEO updates this week",
      "generative engine optimization hospitality 2026",
      "Google AI Overviews hotel discovery changes",
      "hotel schema markup updates",
      "Perplexity ChatGPT hotel booking features new",
    ],
  },
  {
    name: "Paid Advertising",
    file: "paid-ads.md",
    queries: [
      "Google Ads hotel advertising updates this month",
      "Meta ads hospitality new features 2026",
      "TikTok travel ads updates",
      "hotel metasearch advertising changes",
      "programmatic advertising travel hospitality news",
    ],
  },
  {
    name: "Content & Social",
    file: "content-social.md",
    queries: [
      "hotel social media marketing trends this month",
      "hospitality content marketing new strategies 2026",
      "Instagram Reels TikTok hotel marketing what works",
      "hotel email marketing automation new tools",
      "influencer marketing hospitality trends",
    ],
  },
  {
    name: "Industry Trends",
    file: "industry-trends.md",
    queries: [
      "hospitality industry news this week",
      "hotel booking behavior trends 2026",
      "Airbnb Booking.com Expedia news this month",
      "vacation rental market trends 2026",
      "hotel technology AI adoption news",
    ],
  },
];

async function research() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic();

  // Pick today's topic based on day-of-year rotation
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const topic = TOPICS[dayOfYear % TOPICS.length];

  console.log(`Researching: ${topic.name}`);

  // Read existing knowledge base file
  const kbPath = join(KB_DIR, topic.file);
  let existingKB;
  try {
    existingKB = readFileSync(kbPath, "utf-8");
  } catch {
    existingKB = "";
  }

  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a hospitality marketing research analyst. Your job is to find NEW developments and update a knowledge base.

## Current date: ${today}

## Topic area: ${topic.name}

## Search queries to mentally consider (you can't actually search, but use your latest training data):
${topic.queries.map((q) => `- ${q}`).join("\n")}

## Existing knowledge base:
${existingKB}

## Your task:
1. Based on your knowledge, identify any developments, tactics, data points, or trends in "${topic.name}" for hospitality (hotels, resorts, boutiques, vacation rentals) that are NOT already in the existing knowledge base above.
2. If you find new information, output the COMPLETE updated knowledge base file with the new findings integrated in the right sections. Add a date stamp like "(Added ${today})" next to new entries.
3. If nothing meaningfully new can be added, respond with exactly: NO_UPDATES
4. Keep the same markdown structure and frontmatter format. Don't remove existing content — only add.
5. Focus on actionable, expert-level insights. Skip generic advice.

Respond with either NO_UPDATES or the complete updated file content.`,
      },
    ],
  });

  const result = response.content[0].text.trim();

  if (result === "NO_UPDATES") {
    console.log(`No new findings for ${topic.name}`);
    return;
  }

  writeFileSync(kbPath, result);
  console.log(`Updated ${topic.file} with new findings`);
}

research().catch((err) => {
  console.error("Research failed:", err.message);
  process.exit(1);
});
