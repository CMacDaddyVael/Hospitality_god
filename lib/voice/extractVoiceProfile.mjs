/**
 * Voice Profile Extraction
 * Analyzes listing description and host review responses to produce
 * a structured voice profile for personalizing all written deliverables.
 *
 * Issue #179 — Owner voice profile extraction
 */

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Minimum character threshold to attempt extraction vs. fall back to default
 */
const MIN_TEXT_LENGTH = 150

/**
 * Default voice profile for new/sparse hosts
 */
export const DEFAULT_VOICE_PROFILE = {
  tone: 'warm',
  formality_score: 3,
  characteristic_phrases: [],
  avoid_phrases: [
    'cozy',
    'nestled',
    'charming',
    'stunning',
    'spacious',
    'perfect for',
    'you won\'t be disappointed',
    'home away from home',
    'look no further',
  ],
  personality_markers: ['welcoming', 'attentive'],
  voice_profile_confidence: 'low',
  fallback_reason: 'insufficient_text',
  extracted_at: new Date().toISOString(),
}

/**
 * Extracts a structured voice profile from available text samples.
 *
 * @param {Object} params
 * @param {string} [params.listingDescription]  - The full listing description text
 * @param {string[]} [params.hostReviewResponses] - Array of host-written review responses
 * @param {string} [params.propertyTitle]       - Listing title (supplementary signal)
 * @returns {Promise<VoiceProfile>}
 */
export async function extractVoiceProfile({
  listingDescription = '',
  hostReviewResponses = [],
  propertyTitle = '',
}) {
  // Aggregate all available text
  const allText = [
    propertyTitle,
    listingDescription,
    ...hostReviewResponses,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim()

  // Fall back to default if there's not enough text to analyze
  if (allText.length < MIN_TEXT_LENGTH) {
    return {
      ...DEFAULT_VOICE_PROFILE,
      fallback_reason:
        allText.length === 0 ? 'no_text_available' : 'insufficient_text',
    }
  }

  const prompt = buildExtractionPrompt({
    listingDescription,
    hostReviewResponses,
    propertyTitle,
    allText,
  })

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const rawContent = message.content[0]?.text ?? ''
    const parsed = parseVoiceProfileResponse(rawContent, allText.length)
    return parsed
  } catch (err) {
    console.error('[voice-extraction] Claude API error:', err?.message ?? err)
    // Graceful degradation — return default on API failure
    return {
      ...DEFAULT_VOICE_PROFILE,
      fallback_reason: 'extraction_api_error',
    }
  }
}

/**
 * Builds the Claude prompt for voice extraction.
 */
function buildExtractionPrompt({
  listingDescription,
  hostReviewResponses,
  propertyTitle,
  allText,
}) {
  const sections = []

  if (propertyTitle) {
    sections.push(`LISTING TITLE:\n${propertyTitle}`)
  }
  if (listingDescription) {
    sections.push(`LISTING DESCRIPTION:\n${listingDescription}`)
  }
  if (hostReviewResponses.length > 0) {
    sections.push(
      `HOST REVIEW RESPONSES (${hostReviewResponses.length} samples):\n` +
        hostReviewResponses.slice(0, 10).join('\n---\n')
    )
  }

  return `You are a writing style analyst. Analyze the following short-term rental host writing samples and extract a structured voice profile.

${sections.join('\n\n')}

---

Analyze the writing above and respond with ONLY a valid JSON object matching this exact schema (no markdown fences, no extra text):

{
  "tone": "<one of: warm | professional | casual | luxury | friendly | authoritative>",
  "formality_score": <integer 1-5, where 1=very casual, 5=very formal>,
  "characteristic_phrases": [<up to 8 short phrases or sentence patterns this host uses that feel authentic and distinctive>],
  "avoid_phrases": [<up to 8 clichéd or overused STR phrases present in the text that we should NOT repeat, e.g. "cozy", "nestled", "stunning views", "home away from home">],
  "personality_markers": [<up to 6 adjectives or short descriptors capturing the host's personality, e.g. "uses humor", "emphasizes local knowledge", "detail-oriented", "family-focused", "adventure-oriented">],
  "voice_profile_confidence": "<low | medium | high>",
  "extracted_at": "<ISO 8601 timestamp>"
}

Rules:
- "tone" must be exactly one of the listed options
- "formality_score" must be an integer from 1 to 5
- "characteristic_phrases" should be actual phrases/patterns from the text, not generic descriptions
- "avoid_phrases" should be clichés you detected — phrases that sound generic or overused in STR copy
- "personality_markers" describe HOW this person writes and what they emphasize
- "voice_profile_confidence" should be "high" if there are 3+ substantial text samples, "medium" if there are 1-2, "low" if very sparse
- Set "extracted_at" to the current UTC time in ISO 8601 format
- Return ONLY the JSON object, nothing else`
}

/**
 * Parses and validates the Claude response, falling back gracefully on errors.
 *
 * @param {string} rawText - Raw text from Claude
 * @param {number} textLength - Length of source text (for confidence fallback)
 * @returns {VoiceProfile}
 */
function parseVoiceProfileResponse(rawText, textLength) {
  try {
    // Strip any accidental markdown fences if Claude adds them
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    // Validate required fields and types
    const validTones = ['warm', 'professional', 'casual', 'luxury', 'friendly', 'authoritative']
    const validConfidence = ['low', 'medium', 'high']

    const tone = validTones.includes(parsed.tone) ? parsed.tone : 'warm'
    const formalityScore =
      Number.isInteger(parsed.formality_score) &&
      parsed.formality_score >= 1 &&
      parsed.formality_score <= 5
        ? parsed.formality_score
        : 3

    const characteristicPhrases = Array.isArray(parsed.characteristic_phrases)
      ? parsed.characteristic_phrases.slice(0, 8).filter((p) => typeof p === 'string')
      : []

    const avoidPhrases = Array.isArray(parsed.avoid_phrases)
      ? parsed.avoid_phrases.slice(0, 8).filter((p) => typeof p === 'string')
      : DEFAULT_VOICE_PROFILE.avoid_phrases

    const personalityMarkers = Array.isArray(parsed.personality_markers)
      ? parsed.personality_markers.slice(0, 6).filter((p) => typeof p === 'string')
      : ['welcoming']

    const confidence = validConfidence.includes(parsed.voice_profile_confidence)
      ? parsed.voice_profile_confidence
      : textLength > 500
      ? 'medium'
      : 'low'

    return {
      tone,
      formality_score: formalityScore,
      characteristic_phrases: characteristicPhrases,
      avoid_phrases: avoidPhrases,
      personality_markers: personalityMarkers,
      voice_profile_confidence: confidence,
      extracted_at: parsed.extracted_at ?? new Date().toISOString(),
    }
  } catch (err) {
    console.error('[voice-extraction] Failed to parse Claude response:', err?.message)
    console.error('[voice-extraction] Raw response was:', rawText?.slice(0, 500))
    return {
      ...DEFAULT_VOICE_PROFILE,
      fallback_reason: 'parse_error',
    }
  }
}

/**
 * Formats a voice profile into a system prompt injection string.
 * Used by review response, guest comms, and listing rewrite pipelines.
 *
 * @param {VoiceProfile} voiceProfile
 * @returns {string}
 */
export function buildVoiceSystemPromptBlock(voiceProfile) {
  if (!voiceProfile) {
    return buildVoiceSystemPromptBlock(DEFAULT_VOICE_PROFILE)
  }

  const {
    tone,
    formality_score,
    characteristic_phrases,
    avoid_phrases,
    personality_markers,
    voice_profile_confidence,
  } = voiceProfile

  const formalityLabel = {
    1: 'very casual (contractions, slang, relaxed)',
    2: 'casual (friendly, conversational)',
    3: 'balanced (approachable but clear)',
    4: 'professional (polished, structured)',
    5: 'formal (precise, minimal contractions)',
  }[formality_score] ?? 'balanced (approachable but clear)'

  const phraseBlock =
    characteristic_phrases.length > 0
      ? `\nWrite using phrases and patterns like: ${characteristic_phrases.map((p) => `"${p}"`).join(', ')}`
      : ''

  const avoidBlock =
    avoid_phrases.length > 0
      ? `\nAvoid these overused phrases: ${avoid_phrases.map((p) => `"${p}"`).join(', ')}`
      : ''

  const markerBlock =
    personality_markers.length > 0
      ? `\nPersonality traits to reflect: ${personality_markers.join(', ')}`
      : ''

  const confidenceNote =
    voice_profile_confidence === 'low'
      ? '\nNote: Voice profile has low confidence — use warm, welcoming STR host defaults while applying these guidelines.'
      : ''

  return `## Owner Voice Profile
Write in a ${tone} tone. Formality level: ${formalityLabel}.${phraseBlock}${avoidBlock}${markerBlock}${confidenceNote}

Always write as if you are the property owner. The content must feel authentically theirs — not like AI-generated copy.`
}

/**
 * @typedef {Object} VoiceProfile
 * @property {string} tone
 * @property {number} formality_score
 * @property {string[]} characteristic_phrases
 * @property {string[]} avoid_phrases
 * @property {string[]} personality_markers
 * @property {'low'|'medium'|'high'} voice_profile_confidence
 * @property {string} extracted_at
 * @property {string} [fallback_reason]
 */
