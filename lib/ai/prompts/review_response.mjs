/**
 * Prompt template for: review_response
 *
 * Input context:
 *   - reviewText: string (the guest's review)
 *   - reviewRating: number (1-5 stars)
 *   - guestName: string (first name if available)
 *   - propertyName: string
 *   - ownerName: string
 *   - ownerVoiceProfile: {
 *       tone: "warm" | "professional" | "brief",
 *       samplePhrases: string[] (optional — example phrases the owner uses)
 *     }
 *   - specificIssues: string[] (optional — issues mentioned to address)
 *
 * Output JSON schema:
 *   - response: string (the full response to post publicly)
 *   - tone: string (tone actually used)
 *   - keyPointsAddressed: string[] (what issues/praise was acknowledged)
 *   - lengthCategory: "brief" | "standard" | "detailed"
 *   - warningFlags: string[] (any sensitive content to flag for human review)
 */

export function reviewResponsePrompt(context) {
  const {
    reviewText = "",
    reviewRating = 5,
    guestName = "Guest",
    propertyName = "our property",
    ownerName = "The Host",
    ownerVoiceProfile = { tone: "warm", samplePhrases: [] },
    specificIssues = [],
  } = context;

  const { tone = "warm", samplePhrases = [] } = ownerVoiceProfile;

  // Build owner voice section
  const voiceSection = buildOwnerVoiceSection(tone, samplePhrases);

  // Build rating-specific guidance
  const ratingGuidance = buildRatingGuidance(reviewRating);

  const systemPrompt = `You are a hospitality expert ghostwriter who crafts authentic, personalized review responses for short-term rental owners.

Your responses must:
- Sound like a real person, not a corporate template
- Match the owner's specific voice and tone profile (provided below)
- Be warm, genuine, and never defensive — even for negative reviews
- Acknowledge specific details from the guest's review (shows you read it)
- Invite future bookings naturally, without being pushy
- Stay under 200 words for positive reviews, up to 300 for mixed/negative
- NEVER use generic phrases like "Thank you for your feedback" or "We appreciate your review"

## Owner Voice Profile
${voiceSection}

CRITICAL: You must respond ONLY with a valid JSON object. No prose, no explanation outside the JSON. Return exactly this structure:
{
  "response": "string — the full public response to post",
  "tone": "string — tone used (warm/professional/brief)",
  "keyPointsAddressed": ["array of issues or praise points you addressed"],
  "lengthCategory": "brief|standard|detailed",
  "warningFlags": ["any sensitive content needing human review, empty array if none"]
}`;

  const userPrompt = `Write a review response for this guest review.

## Review Details
- **Rating:** ${reviewRating}/5 stars
- **Guest Name:** ${guestName}
- **Property:** ${propertyName}
- **Owner Name (sign off as):** ${ownerName}

## Guest's Review:
"${reviewText}"

${specificIssues.length > 0 ? `## Issues to Address:\n${specificIssues.map((i) => `- ${i}`).join("\n")}` : ""}

## Response Strategy
${ratingGuidance}

The response will be posted publicly on Airbnb/Vrbo. Write it in the owner's voice as if ${ownerName} is writing it personally.

Return ONLY the JSON object as specified.`;

  return { systemPrompt, userPrompt };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildOwnerVoiceSection(tone, samplePhrases) {
  const toneDescriptions = {
    warm: `Tone: WARM
- Conversational, friendly, like talking to a neighbor
- Uses light humor when appropriate
- Expresses genuine delight in hosting
- Ends with a heartfelt invitation to return`,

    professional: `Tone: PROFESSIONAL
- Polished but approachable, like a boutique hotel manager
- Respectful and formal without being stiff
- Focuses on quality and attention to detail
- Confident acknowledgment of both praise and issues`,

    brief: `Tone: BRIEF
- Short, authentic, gets to the point
- No filler phrases or excess words
- Genuine but concise — max 2-3 sentences for positive reviews
- Direct acknowledgment of any issues with clear resolution`,
  };

  const toneDesc = toneDescriptions[tone] || toneDescriptions.warm;
  let section = toneDesc;

  if (samplePhrases && samplePhrases.length > 0) {
    section += `\n\nOwner's Signature Phrases (weave these in naturally — do NOT copy verbatim):\n`;
    section += samplePhrases.map((p) => `- "${p}"`).join("\n");
  }

  return section;
}

function buildRatingGuidance(rating) {
  if (rating === 5) {
    return `5-star review — express genuine appreciation, echo one specific detail they loved, invite them back.`;
  }
  if (rating === 4) {
    return `4-star review — thank them warmly, acknowledge what they enjoyed, gently probe if anything could have made it 5 stars, invite return.`;
  }
  if (rating === 3) {
    return `3-star review — validate their experience, address any specific concerns directly and constructively, explain any improvements made, invite dialogue.`;
  }
  if (rating <= 2) {
    return `${rating}-star review — respond with empathy, not defensiveness. Acknowledge their experience, apologize for falling short of expectations, explain what steps are being taken. Do NOT argue with factual claims. If review seems unfair, remain professional. Flag for human review.`;
  }
  return `Respond appropriately for a ${rating}-star experience.`;
}
