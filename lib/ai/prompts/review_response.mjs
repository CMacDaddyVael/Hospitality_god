/**
 * Review Response Prompt — updated to consume voice profile (issue #121)
 *
 * Original behavior preserved when no voiceProfile is provided.
 */

/**
 * Build a Claude prompt for generating a review response in the owner's voice.
 *
 * @param {object} params
 * @param {string} params.reviewText       - The guest's review text
 * @param {number} params.rating           - Star rating (1–5)
 * @param {string} [params.guestName]      - Guest's first name if known
 * @param {string} [params.propertyName]   - Name of the property
 * @param {string} [params.voiceProfile]   - Injected voice profile block from getVoiceProfileForPrompt()
 * @returns {string}
 */
export function buildReviewResponsePrompt({
  reviewText,
  rating,
  guestName,
  propertyName,
  voiceProfile,
}) {
  const guestRef = guestName ? guestName : 'the guest'
  const propertyRef = propertyName ? `at ${propertyName}` : ''
  const isPositive = rating >= 4
  const isNegative = rating <= 2

  const voiceBlock = voiceProfile
    ? voiceProfile
    : `## Owner Voice Profile
Write in a warm, welcoming, and professional tone. Be genuine and appreciative — not robotic or overly formal.`

  return `You are writing a public review response on behalf of a short-term rental host.

${voiceBlock}

## Review Details
- Guest: ${guestRef}
- Property: ${propertyRef || 'the property'}
- Star rating: ${rating}/5
- Review text: "${reviewText}"

## Instructions
Write a single review response (2–4 sentences) that:
${isPositive ? '- Thanks the guest warmly and highlights a specific detail they mentioned' : ''}
${isNegative ? '- Acknowledges the concern sincerely, takes responsibility where appropriate, and notes how it will be addressed' : ''}
${!isPositive && !isNegative ? '- Acknowledges the feedback and thanks them for staying' : ''}
- Sounds like a real human host, not a template or bot
- Is appropriately concise — short responses feel more authentic
- Ends with a warm closing that invites them back (positive) or expresses hope to improve their experience (negative)
- Matches the owner's voice profile above exactly

Respond with ONLY the review response text. No labels, no quotes, no explanation.`.trim()
}

/**
 * Legacy export — simple string template for backward compatibility.
 * Kept so any existing callers that import this as a raw string don't break.
 */
export const reviewResponsePrompt = `You are writing a public review response on behalf of a short-term rental host.
Write in a warm, professional, and genuine tone.
Keep responses to 2-4 sentences. Thank the guest, reference something specific from their review, and invite them back.
Sound like a real human host, not a corporate template.`
