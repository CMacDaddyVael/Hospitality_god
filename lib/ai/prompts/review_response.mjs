/**
 * Review Response Prompt Templates
 * Used by the review response generation pipeline
 */

/**
 * Build the system prompt for review response generation
 * @param {Object} voiceProfile - Owner's voice profile from onboarding
 * @returns {string}
 */
export function buildSystemPrompt(voiceProfile) {
  if (!voiceProfile) {
    return `You are a professional short-term rental host writing responses to guest reviews on Airbnb.
Your tone is warm, professional, and grateful. You write concisely and authentically.
Keep all responses under 150 words.`;
  }

  const { tone, signOffName, alwaysUse, neverUse, personalityNotes } = voiceProfile;

  return `You are a short-term rental host writing responses to guest reviews on Airbnb.
Write in this owner's authentic voice with these characteristics:

Tone: ${tone || 'warm-professional'}
Sign-off name: ${signOffName || 'Your host'}
${alwaysUse ? `Always include: ${alwaysUse}` : ''}
${neverUse ? `Never say or use: ${neverUse}` : ''}
${personalityNotes ? `Personality notes: ${personalityNotes}` : ''}

Keep all responses under 150 words. Sound like a real human host, not a robot.
Do not use corporate-speak or generic filler phrases.`;
}

/**
 * Build the user prompt for a single review response
 * @param {string} reviewText - The guest's review text
 * @param {number} rating - Star rating (1-5)
 * @param {string} variant - 'warm' or 'professional'
 * @param {boolean} isNegative - Whether to use empathy opener
 * @returns {string}
 */
export function buildReviewPrompt(reviewText, rating, variant = 'warm', isNegative = false) {
  const variantInstruction =
    variant === 'warm'
      ? 'Write in a warm, personal, and heartfelt style. Show genuine appreciation.'
      : 'Write in a polished, professional style. Be appreciative but concise and businesslike.';

  const negativeInstruction = isNegative
    ? `This is a negative or neutral review. Start with a brief, sincere empathy opener that acknowledges the guest's experience without being defensive. Then address the concern constructively and end on a positive, forward-looking note.`
    : `This is a positive review. Express genuine gratitude and warmth.`;

  return `Write a host response to the following Airbnb guest review.

${negativeInstruction}
${variantInstruction}

REVIEW (${rating} stars):
"${reviewText}"

Requirements:
- Under 150 words
- Sound authentic, not templated
- Do not start with "Thank you for your review" or "Thank you for staying"
- Do not use exclamation points more than once
- End with a warm closing that invites future stays (for positive reviews) or expresses hope to make it right (for negative reviews)

Write ONLY the response text. No preamble, no explanation.`;
}

/**
 * Classify a review as positive, neutral, or negative
 * @param {number} rating - Star rating (1-5)
 * @returns {'positive'|'neutral'|'negative'}
 */
export function classifyReview(rating) {
  if (rating >= 4) return 'positive';
  if (rating === 3) return 'neutral';
  return 'negative';
}

/**
 * Determine if a review needs the empathy opener treatment
 * @param {number} rating
 * @returns {boolean}
 */
export function needsEmpathyOpener(rating) {
  return rating <= 3;
}
