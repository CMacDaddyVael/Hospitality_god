/**
 * Claude Prompt Engine — Centralized AI execution layer for Hospitality God
 * Handles all content generation tasks: listing rewrites, review responses,
 * guest messages, and social captions.
 *
 * All calls are logged to the agent_tasks table for auditability and cost tracking.
 */

import Anthropic from "@anthropic-ai/sdk";
import { listingRewritePrompt } from "./prompts/listing_rewrite.mjs";
import { reviewResponsePrompt } from "./prompts/review_response.mjs";
import { guestMessagePrompt } from "./prompts/guest_message.mjs";
import { socialCaptionPrompt } from "./prompts/social_caption.mjs";
import { validateOutput } from "./schemas.mjs";
import { logAgentTask } from "./logger.mjs";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL = "claude-opus-4-5";
const MAX_TOKENS = 2048;
const MAX_RETRIES = 2;

const TASK_TYPES = ["listing_rewrite", "review_response", "guest_message", "social_caption"];

// ─── Prompt Builders ─────────────────────────────────────────────────────────

const PROMPT_BUILDERS = {
  listing_rewrite: listingRewritePrompt,
  review_response: reviewResponsePrompt,
  guest_message: guestMessagePrompt,
  social_caption: socialCaptionPrompt,
};

// ─── Core Engine ─────────────────────────────────────────────────────────────

/**
 * Generate content using Claude for a given task type.
 *
 * @param {string} taskType - One of: listing_rewrite, review_response, guest_message, social_caption
 * @param {Object} context - Task-specific context data
 * @param {string} [context.propertyId] - Property identifier for logging
 * @param {Object} [context.ownerVoiceProfile] - For review_response: { tone, samplePhrases }
 * @returns {Promise<Object>} Validated, structured output from Claude
 */
export async function generateContent(taskType, context = {}) {
  // Validate task type
  if (!TASK_TYPES.includes(taskType)) {
    throw new Error(
      `Invalid taskType "${taskType}". Must be one of: ${TASK_TYPES.join(", ")}`
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });
  const promptBuilder = PROMPT_BUILDERS[taskType];
  const { systemPrompt, userPrompt } = promptBuilder(context);
  const propertyId = context.propertyId || null;

  let lastError = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;

    try {
      console.log(
        `[claude] ${taskType} attempt ${attempt}/${MAX_RETRIES + 1}` +
          (propertyId ? ` (property: ${propertyId})` : "")
      );

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const rawText = extractText(response);
      const usage = {
        promptTokens: response.usage?.input_tokens ?? 0,
        completionTokens: response.usage?.output_tokens ?? 0,
      };

      // Parse JSON from the response
      let parsed;
      try {
        parsed = parseJSON(rawText);
      } catch (parseErr) {
        console.warn(
          `[claude] JSON parse failed on attempt ${attempt}: ${parseErr.message}`
        );
        lastError = new Error(`JSON parse error: ${parseErr.message}`);

        await logAgentTask({
          taskType,
          propertyId,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          status: "parse_error",
          outputPreview: rawText.slice(0, 200),
        });

        if (attempt > MAX_RETRIES) break;
        continue;
      }

      // Validate against schema
      const validation = validateOutput(taskType, parsed);
      if (!validation.valid) {
        console.warn(
          `[claude] Schema validation failed on attempt ${attempt}: ${validation.errors.join(", ")}`
        );
        lastError = new Error(
          `Schema validation failed: ${validation.errors.join(", ")}`
        );

        await logAgentTask({
          taskType,
          propertyId,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          status: "validation_error",
          outputPreview: JSON.stringify(parsed).slice(0, 200),
        });

        if (attempt > MAX_RETRIES) break;
        continue;
      }

      // Success — log and return
      await logAgentTask({
        taskType,
        propertyId,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        status: "success",
        outputPreview: JSON.stringify(parsed).slice(0, 200),
      });

      console.log(
        `[claude] ${taskType} succeeded on attempt ${attempt} ` +
          `(${usage.promptTokens} prompt + ${usage.completionTokens} completion tokens)`
      );

      return parsed;
    } catch (err) {
      // Network / API errors
      lastError = err;
      console.error(`[claude] API error on attempt ${attempt}: ${err.message}`);

      if (attempt > MAX_RETRIES) break;

      // Exponential backoff: 1s, 2s
      const delay = attempt * 1000;
      console.log(`[claude] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  await logAgentTask({
    taskType,
    propertyId,
    promptTokens: 0,
    completionTokens: 0,
    status: "failed",
    outputPreview: lastError?.message?.slice(0, 200) ?? "Unknown error",
  });

  throw new Error(
    `generateContent failed for "${taskType}" after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract text content from an Anthropic response.
 */
function extractText(response) {
  const block = response.content?.find((b) => b.type === "text");
  return block?.text ?? "";
}

/**
 * Parse JSON from Claude's response. Handles markdown code blocks.
 */
function parseJSON(text) {
  // Strip markdown code fences if present
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  return JSON.parse(stripped);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
