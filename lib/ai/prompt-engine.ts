/**
 * Prompt engine — the single call-site for all Claude interactions.
 * Loads the prompt template for the given key, injects variables,
 * calls Claude, parses the JSON response, and returns structured output
 * with token cost.
 *
 * All agents MUST go through this — no raw Claude calls anywhere else.
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type PromptEngineResult = {
  output: unknown
  raw: string
  tokenCost: number
  inputTokens: number
  outputTokens: number
}

/**
 * Registered prompt templates.
 * Each template is a function that accepts variables and returns the full
 * system + user message pair.
 */
type PromptTemplate = (vars: Record<string, unknown>) => {
  system: string
  user: string
  model?: string
  maxTokens?: number
}

// Dynamic import map — avoids circular deps and keeps templates in .mjs files
const TEMPLATE_REGISTRY: Record<string, () => Promise<{ default: PromptTemplate }>> = {
  listing_rewrite: () => import('./prompts/listing_rewrite.mjs') as any,
  review_response: () => import('./prompts/review_response.mjs') as any,
  guest_message: () => import('./prompts/guest_message.mjs') as any,
  social_caption: () => import('./prompts/social_caption.mjs') as any,
}

export async function promptEngine(
  templateKey: string,
  variables: Record<string, unknown>
): Promise<PromptEngineResult> {
  const loader = TEMPLATE_REGISTRY[templateKey]
  if (!loader) {
    throw new Error(`Unknown prompt template: "${templateKey}"`)
  }

  const mod = await loader()
  const template = mod.default
  const { system, user, model = 'claude-opus-4-5', maxTokens = 2048 } = template(variables)

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })

  const raw = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('')

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  // Approx cost in USD cents for claude-3-5-sonnet — adjust per model
  const tokenCost = inputTokens * 0.000003 + outputTokens * 0.000015

  let output: unknown
  try {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()
    output = JSON.parse(cleaned)
  } catch {
    // Return raw string if not valid JSON — callers must handle
    output = raw
  }

  return { output, raw, tokenCost, inputTokens, outputTokens }
}
