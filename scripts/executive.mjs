import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readFile(path) {
  try {
    return readFileSync(join(ROOT, path), "utf-8");
  } catch {
    return "";
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

const EXECUTIVES = {
  cmo: {
    title: "Chief Marketing Officer",
    emoji: "📣",
    focus: `You are the CMO of Hospitality God. You think about:
- Go-to-market strategy for STR owners
- Customer acquisition channels (where do STR owners hang out? Facebook groups, BiggerPockets, STR podcasts, Airbnb host forums)
- Positioning and messaging — how do we explain this to a host with 2 listings who's never had marketing help?
- Content marketing to attract STR owners
- Partnership opportunities (PriceLabs, Hospitable, AirDNA, STR conferences)
- Competitive positioning against the status quo (doing nothing)
- Brand voice and identity
- Viral/referral mechanics — how does one host tell another?
- Pricing psychology — $99 vs $149 vs $199, annual vs monthly
- Launch strategy for April 2026`,
  },
  cto: {
    title: "Chief Technology Officer",
    emoji: "⚙️",
    focus: `You are the CTO of Hospitality God. You think about:
- Architecture decisions — what's the fastest path to a working MVP?
- Airbnb integration challenge — no public API, need scraping or unofficial approaches. What are the legal/technical risks?
- Vrbo/Booking.com API access — what's available?
- Scalability — can the current architecture handle 3,000 clients running daily automated tasks?
- AI cost optimization — how much does it cost per client per month in API calls? Is the unit economics viable at $149/mo?
- Security — we're handling OAuth tokens for client social accounts
- Reliability — if the agent posts wrong content to a client's Instagram, that's a disaster
- Tech debt — what shortcuts are OK for MVP vs. what will bite us?
- Monitoring and alerting — how do we know when things break?
- CI/CD and deployment strategy`,
  },
  ceo: {
    title: "Chief Executive Officer",
    emoji: "👔",
    focus: `You are the CEO of Hospitality God. You think about:
- Are we building the right thing? Is the MVP scope correct for April launch?
- What's the single most important thing to focus on THIS WEEK?
- Resource allocation — where should the agent swarm spend its cycles?
- Risks that could kill the company (legal issues with Airbnb scraping, AI generating bad content, etc.)
- Fundraising — do we need capital? When? How much? What's the pitch?
- Hiring — when do we need humans? What roles?
- Timeline reality check — is April realistic? What can we cut?
- Strategic partnerships that could accelerate growth 10x
- What are we NOT thinking about that we should be?
- Decision-making — when you see open debates between other executives, make the call`,
  },
  cpo: {
    title: "Chief Product Officer",
    emoji: "🎯",
    focus: `You are the CPO of Hospitality God. You think about:
- User experience — an STR owner with 2 Airbnb listings should be able to sign up and see value in under 5 minutes
- Onboarding flow — what's the minimum info we need? What can we auto-detect?
- Feature prioritization — which MVP feature delivers the most "wow" moment fastest?
- User research — what do STR owners actually complain about? (hint: guest communication, bad reviews, low occupancy, listing visibility)
- The "magic moment" — what makes an STR owner go "holy shit this is worth $149/mo"? Probably seeing their listing rewritten and watching bookings increase.
- Mobile experience — STR owners manage everything from their phone
- Notification strategy — what does the agent tell the owner vs. just do silently?
- Approval workflows — should the agent auto-post or require approval? (start with approval, earn trust, then auto)
- Analytics that matter to STR owners — occupancy rate, average nightly rate, review score, listing rank
- Competitive features — what would make someone switch from doing it manually?`,
  },
  cro: {
    title: "Chief Revenue Officer",
    emoji: "💰",
    focus: `You are the CRO of Hospitality God. You think about:
- Pricing strategy — $99/mo for 1-2 listings, $149/mo for 3-10, $199/mo for 10+? Or per-listing pricing?
- Unit economics — what's the cost to serve one client (AI API calls, compute, support)? Is there margin at $149/mo?
- Conversion funnel — landing page → signup → onboarding → first value → paid conversion. Where will people drop off?
- Free trial vs freemium vs paid-only — what's the right model for STR owners?
- Churn prediction — what would make someone cancel? (not seeing results, too expensive, trust issues with auto-posting)
- Expansion revenue — how do we grow revenue per client? More listings, more features, more channels?
- Sales strategy — self-serve? Sales team? Partnerships with property managers?
- Retention tactics — monthly reports showing ROI, "your agent saved you X hours and generated Y bookings"
- Referral program — "give your host friend 1 month free, get 1 month free"
- Revenue milestones — what gets us to $50K MRR? $100K? $500K?`,
  },
};

async function executive() {
  const role = process.env.EXEC_ROLE;
  if (!role || !EXECUTIVES[role]) {
    console.error(`Invalid role. Use: ${Object.keys(EXECUTIVES).join(", ")}`);
    process.exit(1);
  }

  const exec = EXECUTIVES[role];
  const client = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  // Gather context
  const goals = readFile("GOALS.md");
  const recentCommits = run("git log --oneline -15");
  const openIssues = run("gh issue list --state open --limit 30 --json number,title,labels");
  const openPRs = run("gh pr list --state open --limit 10 --json number,title");

  // Read recent executive memos from other roles
  const recentDiscussions = run(
    'gh issue list --label "executive" --state all --limit 10 --json number,title,body,labels,createdAt'
  );

  // Read knowledge base summaries
  const kbFiles = [];
  try {
    const files = readdirSync(join(ROOT, "knowledge-base"));
    for (const f of files) {
      const content = readFile(`knowledge-base/${f}`);
      // Just first 50 lines of each for context
      kbFiles.push(`### ${f}\n${content.split("\n").slice(0, 50).join("\n")}`);
    }
  } catch {}

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${exec.focus}

## Date: ${today}

## Company Goals & Current State:
${goals}

## Recent commits (what's been built):
${recentCommits}

## Open issues (what's in progress):
${openIssues}

## Open PRs:
${openPRs}

## Recent executive memos (what other leaders are thinking):
${recentDiscussions}

## Knowledge base (market research):
${kbFiles.join("\n\n")}

## Your task:
Write a brief executive memo (think: a sharp Slack message to the founding team, not a corporate document). Cover:

1. **State of play** — where are we, honestly? (2-3 sentences)
2. **Top concern** — the #1 thing keeping you up at night in your role (be specific)
3. **Recommendation** — your single highest-leverage move for THIS WEEK (be actionable, not vague)
4. **Debate point** — one thing you disagree with or want to challenge from the current plan or other executives' memos

Then, if your recommendation requires building something, output 1-3 GitHub Issues in this format:

---ISSUE---
TITLE: [${exec.emoji} ${exec.title.split(" ").pop()}] [concise title]
LABELS: executive, ${role}
BODY:
## What
[what needs to happen]

## Why (${exec.title} perspective)
[why this matters from your role's POV]

## Acceptance Criteria
- [ ] [criterion]
---END---

Keep the memo under 400 words. Be opinionated. Disagree with the plan if you think it's wrong. This is a founding team — no politics, just truth.`,
      },
    ],
  });

  const result = response.content[0].text;

  // Post memo as a GitHub Issue
  const memoTitle = `${exec.emoji} ${exec.title} Memo — ${today}`;
  const memoBody = `${result}\n\n---\n*Automated ${exec.title} memo*`;

  try {
    // Ensure labels exist
    run(`gh label create "executive" --color "7057ff" --description "Executive memo" --force`);
    run(`gh label create "${role}" --color "0075ca" --description "${exec.title}" --force`);

    const tmpFile = join(ROOT, ".memo-tmp");
    writeFileSync(tmpFile, memoBody);
    const url = run(
      `gh issue create --title "${memoTitle}" --body-file .memo-tmp --label "executive" --label "${role}"`
    );
    run("rm .memo-tmp");
    console.log(`${exec.emoji} ${exec.title} memo posted: ${url}`);
  } catch (err) {
    console.error("Failed to post memo:", err.message);
    console.log("\nMemo content:\n", result);
  }

  // Parse and create any additional issues
  const issueBlocks = result.split("---ISSUE---").slice(1);
  for (const block of issueBlocks) {
    const endIdx = block.indexOf("---END---");
    if (endIdx === -1) continue;

    const issueContent = block.substring(0, endIdx).trim();
    const titleMatch = issueContent.match(/TITLE:\s*(.+)/);
    const bodyMatch = issueContent.match(/BODY:\s*([\s\S]+)/);

    if (!titleMatch || !bodyMatch) continue;

    const title = titleMatch[1].trim();
    const body = bodyMatch[1].trim();

    try {
      const tmpFile = join(ROOT, ".issue-tmp");
      writeFileSync(tmpFile, `${body}\n\n---\n*Created by ${exec.title} agent*`);
      const url = run(
        `gh issue create --title "${title.replace(/"/g, '\\"')}" --body-file .issue-tmp --label "executive" --label "${role}"`
      );
      run("rm .issue-tmp");
      console.log(`  Created issue: ${title} → ${url}`);
    } catch (err) {
      console.error(`  Failed to create issue: ${err.message}`);
    }
  }
}

executive().catch((err) => {
  console.error("Executive agent failed:", err.message);
  process.exit(1);
});
