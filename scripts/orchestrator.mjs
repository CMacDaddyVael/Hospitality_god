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
    return "(file not found)";
  }
}

function listFiles(dir) {
  try {
    return readdirSync(join(ROOT, dir));
  } catch {
    return [];
  }
}

function getRecentCommits() {
  try {
    return execSync("git log --oneline -20", { cwd: ROOT, encoding: "utf-8" });
  } catch {
    return "(no git history)";
  }
}

function getOpenIssues() {
  try {
    return execSync("gh issue list --state open --limit 20 --json number,title,labels,assignees", {
      cwd: ROOT,
      encoding: "utf-8",
    });
  } catch {
    return "[]";
  }
}

async function orchestrate() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic();
  const today = new Date().toISOString().split("T")[0];

  // Gather current state
  const goals = readFile("GOALS.md");
  const kbFiles = listFiles("knowledge-base");
  const recentCommits = getRecentCommits();
  const openIssues = getOpenIssues();
  const packageJson = readFile("package.json");

  // Read all knowledge base files to understand current depth
  const kbSummary = kbFiles
    .map((f) => {
      const content = readFile(`knowledge-base/${f}`);
      const lines = content.split("\n").length;
      return `- ${f}: ${lines} lines`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are the orchestrator agent for Hospitality God — an autonomous AI CMO for hotels. You think like the founder. Your job is to review the current state of the project and create 3-5 specific, actionable GitHub Issues for the next sprint of work.

## Date: ${today}

## Goals & Vision:
${goals}

## Current repo structure:
- package.json exists
- Knowledge base files:
${kbSummary}
- Scripts: ${listFiles("scripts").join(", ")}
- Workflows: ${listFiles(".github/workflows").join(", ")}

## Recent commits:
${recentCommits}

## Open issues:
${openIssues}

## Your task:
1. Assess where we are vs. where we need to be
2. Identify the highest-leverage next steps (what unblocks the most progress)
3. Output 3-5 GitHub Issues in this exact format for each:

---ISSUE---
TITLE: [concise title]
LABELS: [comma-separated: priority/high, priority/medium, type/feature, type/infrastructure, type/research]
BODY:
## What
[1-2 sentences on what needs to be built/done]

## Why
[Why this matters for the 3,000 client goal]

## Acceptance Criteria
- [ ] [specific, testable criterion]
- [ ] [specific, testable criterion]
---END---

Rules:
- Be specific and actionable — no vague "research X" issues
- Prioritize based on what unblocks the most downstream work
- Don't duplicate open issues
- Think about what the founder would want done THIS WEEK
- Remember: execution > advice, build the product first, don't contact leads yet`,
      },
    ],
  });

  const result = response.content[0].text;
  console.log("Orchestrator analysis complete.\n");

  // Parse issues from response
  const issueBlocks = result.split("---ISSUE---").slice(1);

  for (const block of issueBlocks) {
    const endIdx = block.indexOf("---END---");
    const issueContent = block.substring(0, endIdx).trim();

    const titleMatch = issueContent.match(/TITLE:\s*(.+)/);
    const labelsMatch = issueContent.match(/LABELS:\s*(.+)/);
    const bodyMatch = issueContent.match(/BODY:\s*([\s\S]+)/);

    if (!titleMatch || !bodyMatch) {
      console.log("Skipping malformed issue block");
      continue;
    }

    const title = titleMatch[1].trim();
    const labels = labelsMatch
      ? labelsMatch[1]
          .trim()
          .split(",")
          .map((l) => l.trim())
      : [];
    const body = bodyMatch[1].trim();

    // Create the issue via gh CLI
    try {
      const labelArgs = labels.map((l) => `--label "${l}"`).join(" ");
      const cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" ${labelArgs} 2>&1 || echo "Label may not exist, creating without labels" && gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" 2>&1`;

      // Simpler approach - just create without labels if they don't exist
      const simpleCmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "$(cat <<'GHEOF'
${body}

---
*Created by Orchestrator Agent on ${today}*
GHEOF
)"`;

      const output = execSync(simpleCmd, { cwd: ROOT, encoding: "utf-8" });
      console.log(`Created issue: ${title}`);
      console.log(`  → ${output.trim()}`);
    } catch (err) {
      console.error(`Failed to create issue "${title}": ${err.message}`);
    }
  }
}

orchestrate().catch((err) => {
  console.error("Orchestrator failed:", err.message);
  process.exit(1);
});
