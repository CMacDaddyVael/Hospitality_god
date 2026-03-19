/**
 * Dispatcher — reads open issues and outputs a matrix for parallel workers.
 * GitHub Actions uses this to spawn one worker job per issue.
 */
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { appendFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

// Get open issues, skip any that already have a PR branch
let issues;
try {
  issues = JSON.parse(
    run("gh issue list --state open --limit 20 --json number,title,body,labels")
  );
} catch (err) {
  console.log("No issues or gh unavailable:", err.message);
  process.exit(0);
}

if (issues.length === 0) {
  console.log("No open issues.");
}

// Check which issues already have worker branches (in-progress or PR open)
let existingBranches;
try {
  existingBranches = run("git branch -r").split("\n").map((b) => b.trim());
} catch {
  existingBranches = [];
}

const available = issues.filter((issue) => {
  const branchPattern = `worker/issue-${issue.number}-`;
  const alreadyInProgress = existingBranches.some((b) => b.includes(branchPattern));
  if (alreadyInProgress) {
    console.log(`Skipping #${issue.number} — branch already exists`);
  }
  return !alreadyInProgress;
});

console.log(`${available.length} issues ready for workers (${issues.length} total open)`);

// Output matrix for GitHub Actions
const matrix = available.map((i) => ({
  number: i.number,
  title: i.title,
}));

// Write to GITHUB_OUTPUT
const output = process.env.GITHUB_OUTPUT;
if (output) {
  appendFileSync(output, `matrix=${JSON.stringify({ include: matrix })}\n`);
  appendFileSync(output, `has_work=${matrix.length > 0}\n`);
} else {
  console.log("Matrix:", JSON.stringify({ include: matrix }, null, 2));
  console.log("Has work:", matrix.length > 0);
}
