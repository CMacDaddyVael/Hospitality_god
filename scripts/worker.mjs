import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function readFile(path) {
  try {
    return readFileSync(join(ROOT, path), "utf-8");
  } catch {
    return null;
  }
}

function listFilesRecursive(dir, prefix = "") {
  const results = [];
  try {
    const entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        results.push(...listFilesRecursive(join(dir, entry.name), path));
      } else {
        results.push(path);
      }
    }
  } catch {}
  return results;
}

async function work() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  // Accept issue number from env (dispatched) or pick one
  const issueNumber = process.env.ISSUE_NUMBER;

  let issue;
  if (issueNumber) {
    // Dispatched mode — we've been assigned a specific issue
    const data = JSON.parse(
      run(`gh issue view ${issueNumber} --json number,title,body,labels`)
    );
    issue = data;
  } else {
    // Solo mode — pick the highest priority open issue
    let issues;
    try {
      issues = JSON.parse(
        run('gh issue list --state open --limit 5 --json number,title,body,labels')
      );
    } catch (err) {
      console.log("No open issues or gh not available:", err.message);
      return;
    }

    if (issues.length === 0) {
      console.log("No open issues. Nothing to do.");
      return;
    }

    const highPriority = issues.find((i) =>
      i.labels?.some((l) => l.name === "priority/high")
    );
    issue = highPriority || issues[0];
  }

  console.log(`Working on issue #${issue.number}: ${issue.title}`);

  // Gather repo context
  const allFiles = listFilesRecursive(".");
  const goals = readFile("GOALS.md") || "";
  const packageJson = readFile("package.json") || "";

  // Read key existing files for context (up to 10 most relevant)
  const relevantFiles = allFiles
    .filter(
      (f) =>
        f.endsWith(".mjs") ||
        f.endsWith(".ts") ||
        f.endsWith(".tsx") ||
        f.endsWith(".json") ||
        f.endsWith(".yml") ||
        f.endsWith(".md")
    )
    .filter((f) => !f.includes("node_modules") && !f.includes("package-lock"))
    .slice(0, 20);

  const fileContents = relevantFiles
    .map((f) => {
      const content = readFile(f);
      if (!content) return null;
      // Truncate large files
      const truncated = content.length > 3000 ? content.slice(0, 3000) + "\n...(truncated)" : content;
      return `### ${f}\n\`\`\`\n${truncated}\n\`\`\``;
    })
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are a senior software engineer working on Hospitality God — an autonomous AI CMO platform for hotels, resorts, boutiques, and vacation rentals.

## Your task
Implement the following GitHub Issue:

**#${issue.number}: ${issue.title}**

${issue.body}

## Project goals
${goals}

## Repo structure
Files in repo:
${allFiles.join("\n")}

## Current file contents
${fileContents}

## CRITICAL GUARDRAILS — READ BEFORE WRITING ANY CODE
The product is live and working. Your job is to EXTEND it, not rewrite it.

1. **NEVER rewrite or replace existing files** unless the issue explicitly requires modifying that specific file. If you need to add functionality, create NEW files and import/integrate them.
2. **NEVER change existing UI components, styles, or layouts** — the current design is approved and shipping.
3. **NEVER modify existing API routes** unless the issue specifically targets that route. Add new routes instead.
4. **Preserve all existing behavior** — your changes must be purely additive. If something works today, it must still work identically after your changes.
5. **If you must modify an existing file** (e.g., adding an import or a new route entry), make the SMALLEST possible change. Do not refactor, restyle, or "improve" surrounding code.

## Instructions
1. Implement the issue completely. Write production-quality code.
2. Output your changes as a series of FILE blocks in this exact format:

---FILE path/to/file.ext---
(complete file content here)
---ENDFILE---

3. **Strongly prefer creating NEW files** over modifying existing ones. For existing files you must modify, output the COMPLETE new content with minimal changes from the original.
4. Include ALL files needed — don't reference files you haven't output.
5. If you need to update package.json (add dependencies), include the full updated package.json.
6. After all FILE blocks, add a section:

---CHANGED_FILES---
For each file, indicate: NEW (created) or MODIFIED (changed existing) and a one-line summary of what changed.
---END_CHANGED_FILES---

---COMMIT_MESSAGE---
(a clear, concise commit message describing what was built)
---END_COMMIT_MESSAGE---

---PR_BODY---
## Summary
(2-3 bullet points)

## Files changed
(list each file as NEW or MODIFIED with reason)

## Test plan
(how to verify this works)

## Impact on existing features
(confirm what existing features were NOT touched and still work)

Closes #${issue.number}
---END_PR_BODY---

Rules:
- Write real, working code — not pseudocode or placeholders
- Keep it simple and focused on the issue
- Use the existing tech stack (Node.js, ES modules)
- Follow patterns already in the codebase
- Prefer ADDING new files over modifying existing ones
- If the issue is too large to fully implement, do the most critical part and note what's left in the PR body
- Do NOT touch any file that is not directly required by this issue`,
      },
    ],
  });

  const result = response.content[0].text;

  // Parse file blocks
  const fileBlocks = result.split("---FILE ").slice(1);
  if (fileBlocks.length === 0) {
    console.log("No file changes produced. Skipping.");
    return;
  }

  // Create branch
  const branchName = `worker/issue-${issue.number}-${issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)}`;

  run(`git checkout -b "${branchName}"`);

  for (const block of fileBlocks) {
    const endIdx = block.indexOf("---ENDFILE---");
    if (endIdx === -1) continue;

    const firstLine = block.substring(0, block.indexOf("\n"));
    const filePath = firstLine.replace("---", "").trim();
    const content = block.substring(block.indexOf("\n") + 1, endIdx).trim();

    // Ensure directory exists
    const dir = dirname(join(ROOT, filePath));
    mkdirSync(dir, { recursive: true });

    writeFileSync(join(ROOT, filePath), content + "\n");
    console.log(`  Wrote: ${filePath}`);
  }

  // Parse commit message
  const commitMatch = result.match(
    /---COMMIT_MESSAGE---([\s\S]*?)---END_COMMIT_MESSAGE---/
  );
  const commitMessage = commitMatch
    ? commitMatch[1].trim()
    : `Implement #${issue.number}: ${issue.title}`;

  // Parse PR body
  const prBodyMatch = result.match(
    /---PR_BODY---([\s\S]*?)---END_PR_BODY---/
  );
  const prBody = prBodyMatch
    ? prBodyMatch[1].trim()
    : `Implements #${issue.number}\n\nAutomated by Worker Agent.`;

  // Commit and push
  run("git add -A");

  try {
    const fullCommitMessage = `${commitMessage}\n\nCo-Authored-By: VAEL Worker Agent <worker@vael.ai>`;
    writeFileSync(join(ROOT, ".commit-msg-tmp"), fullCommitMessage);
    run('git commit -F .commit-msg-tmp');
    run('rm .commit-msg-tmp');
    run(`git push -u origin "${branchName}"`);

    // Create PR
    const prTitle = `[Worker] ${issue.title}`;
    writeFileSync(join(ROOT, ".pr-body-tmp"), `${prBody}\n\n---\n*Built autonomously by Worker Agent*`);
    const prUrl = run(
      `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body-file .pr-body-tmp --head "${branchName}"`
    );
    run('rm .pr-body-tmp');

    console.log(`\nPR created: ${prUrl}`);
    console.log("PR is open for your review — no auto-merge.");

    // Switch back to main
    run("git checkout main");
  } catch (err) {
    console.error("Failed to create PR:", err.message);
    run("git checkout main");
  }
}

work().catch((err) => {
  console.error("Worker failed:", err.message);
  // Make sure we're back on main
  try {
    execSync("git checkout main", { cwd: ROOT });
  } catch {}
  process.exit(1);
});
