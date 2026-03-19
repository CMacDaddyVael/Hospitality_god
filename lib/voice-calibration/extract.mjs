/**
 * Voice Profile Extraction Engine
 * 
 * Analyzes a set of owner-written review responses or messages and
 * extracts a structured voice profile using Claude.
 * 
 * Voice Profile Schema:
 * {
 *   tone: string,                          // e.g. "warm and welcoming", "enthusiastic"
 *   formality: 'casual'|'professional'|'warm',
 *   avgLength: 'short'|'medium'|'long',
 *   signaturePhrase: string|null,          // e.g. "We hope to see you again!"
 *   usesEmoji: boolean,
 *   keyPersonalityTraits: string[],        // e.g. ["grateful", "detail-oriented"]
 *   calibratedAt: string,                  // ISO timestamp
 *   sampleCount: number,                   // how many samples were used
 *   fallbackUsed: boolean                  // true if default profile was used
 * }
 */

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * Default voice profile used when zero samples are available.
 * Professional, warm tone that works for most STR contexts.
 */
export const DEFAULT_VOICE_PROFILE = {
  tone: "warm and professional",
  formality: "warm",
  avgLength: "medium",
  signaturePhrase: null,
  usesEmoji: false,
  keyPersonalityTraits: ["hospitable", "grateful", "attentive"],
  calibratedAt: new Date().toISOString(),
  sampleCount: 0,
  fallbackUsed: true,
};

/**
 * Classify average response length from an array of text samples.
 * short: <100 chars avg, medium: 100-300, long: >300
 */
function classifyAvgLength(samples) {
  if (!samples || samples.length === 0) return "medium";
  const avg = samples.reduce((sum, s) => sum + s.length, 0) / samples.length;
  if (avg < 100) return "short";
  if (avg <= 300) return "medium";
  return "long";
}

/**
 * Check if any samples contain emoji characters.
 */
function detectEmoji(samples) {
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3297}\u{3299}\u{303D}\u{00A9}\u{00AE}\u{2122}\u{23F3}\u{24C2}\u{23E9}-\u{23EF}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/u;
  return samples.some((s) => emojiRegex.test(s));
}

/**
 * Extract a voice profile from an array of text samples using Claude.
 * 
 * @param {string[]} samples - Array of owner-written texts (review responses, messages)
 * @param {object} options
 * @param {string} [options.propertyName] - Property name for context
 * @param {string} [options.ownerName] - Owner name for context
 * @returns {Promise<object>} Voice profile object
 */
export async function extractVoiceProfile(samples, options = {}) {
  // Graceful fallback: zero samples → default profile
  if (!samples || samples.length === 0) {
    console.log("[VoiceCalibration] No samples available, using default profile");
    return { ...DEFAULT_VOICE_PROFILE, calibratedAt: new Date().toISOString() };
  }

  // Compute length classification locally (deterministic, no LLM needed)
  const avgLength = classifyAvgLength(samples);
  const usesEmoji = detectEmoji(samples);

  // Format samples for Claude
  const formattedSamples = samples
    .slice(0, 10) // cap at 10 samples
    .map((s, i) => `[Sample ${i + 1}]\n${s.trim()}`)
    .join("\n\n");

  const contextLine = [
    options.ownerName ? `Property owner: ${options.ownerName}` : null,
    options.propertyName ? `Property: ${options.propertyName}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = `You are analyzing writing samples from a short-term rental property owner to extract their unique communication style and voice.

${contextLine ? `Context: ${contextLine}\n` : ""}
Here are ${samples.slice(0, 10).length} writing samples from this owner:

${formattedSamples}

Analyze these samples carefully and return a JSON object describing this owner's voice profile. Return ONLY valid JSON, no explanation.

The JSON must have exactly these fields:
{
  "tone": "<2-5 word description, e.g. 'warm and enthusiastic', 'professional and concise'>",
  "formality": "<one of: casual, professional, warm>",
  "signaturePhrase": "<their most common closing phrase, or null if none detected>",
  "keyPersonalityTraits": ["<trait1>", "<trait2>", "<trait3>"]
}

Rules for analysis:
- "tone" should capture the overall emotional quality and energy of their writing
- "formality" should be:
  * "casual" if they use contractions heavily, slang, first-name basis, very relaxed phrasing
  * "professional" if they maintain formal structure, full sentences, business-like distance
  * "warm" if they are friendly and personal but not overly casual — the most common for good hosts
- "signaturePhrase" should be a phrase they repeat (closing lines like "Hope to see you again soon!" are common) or null
- "keyPersonalityTraits" should be 2-4 adjectives describing their personality as expressed in writing (e.g. "grateful", "detail-oriented", "enthusiastic", "nurturing", "efficient")`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].text.trim();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Validate and sanitize the response
    const voiceProfile = {
      tone: typeof parsed.tone === "string" ? parsed.tone : "warm and welcoming",
      formality: ["casual", "professional", "warm"].includes(parsed.formality)
        ? parsed.formality
        : "warm",
      avgLength,
      signaturePhrase:
        typeof parsed.signaturePhrase === "string" && parsed.signaturePhrase.length > 0
          ? parsed.signaturePhrase
          : null,
      usesEmoji,
      keyPersonalityTraits: Array.isArray(parsed.keyPersonalityTraits)
        ? parsed.keyPersonalityTraits.filter((t) => typeof t === "string").slice(0, 4)
        : ["hospitable", "grateful"],
      calibratedAt: new Date().toISOString(),
      sampleCount: samples.slice(0, 10).length,
      fallbackUsed: false,
    };

    return voiceProfile;
  } catch (err) {
    console.error("[VoiceCalibration] Claude extraction failed:", err.message);
    // Graceful fallback — never crash the onboarding flow
    return {
      ...DEFAULT_VOICE_PROFILE,
      avgLength,
      usesEmoji,
      calibratedAt: new Date().toISOString(),
      sampleCount: samples.length,
      fallbackUsed: true,
    };
  }
}

/**
 * Build a voice profile instruction string for use in Claude prompts.
 * This is injected into content generation to make output sound like the owner.
 * 
 * @param {object} voiceProfile
 * @returns {string} Instruction block for inclusion in prompts
 */
export function buildVoiceInstruction(voiceProfile) {
  if (!voiceProfile || voiceProfile.fallbackUsed) {
    return "Write in a warm, professional tone suitable for a hospitality host. Be genuine and appreciative.";
  }

  const parts = [
    `Write in this owner's specific voice:`,
    `- Tone: ${voiceProfile.tone}`,
    `- Formality level: ${voiceProfile.formality} (${
      voiceProfile.formality === "casual"
        ? "relaxed, contractions OK, conversational"
        : voiceProfile.formality === "professional"
        ? "structured, polished, business-appropriate"
        : "friendly yet polished, personal but not too casual"
    })`,
    `- Response length: ${voiceProfile.avgLength} (${
      voiceProfile.avgLength === "short"
        ? "under 80 words"
        : voiceProfile.avgLength === "medium"
        ? "80-200 words"
        : "200-400 words"
    })`,
    `- Personality: ${voiceProfile.keyPersonalityTraits.join(", ")}`,
    voiceProfile.usesEmoji
      ? "- Uses emoji occasionally and naturally"
      : "- Does NOT use emoji",
    voiceProfile.signaturePhrase
      ? `- Signature closing phrase: "${voiceProfile.signaturePhrase}"`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return parts;
}
