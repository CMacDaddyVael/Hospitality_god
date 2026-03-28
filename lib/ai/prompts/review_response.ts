import type { VoiceProfile, ReviewResponsePayload } from '../../../types/tasks'

export function buildReviewResponsePrompt(
  payload: ReviewResponsePayload,
  voiceProfile?: VoiceProfile
): { system: string; user: string } {
  const isNegative = payload.rating <= 2
  const isMixed = payload.rating === 3
  const isPositive = payload.rating >= 4

  const voiceSection = voiceProfile
    ? `
## Owner Voice Profile
Write the response in this owner's established voice:
- **Tone:** ${voiceProfile.tone ?? 'warm and professional'}
- **Sign-off name:** ${voiceProfile.signOffName ?? 'Your Host'}
${voiceProfile.alwaysUse?.length ? `- **Always use:** ${voiceProfile.alwaysUse.join(', ')}` : ''}
${voiceProfile.neverUse?.length ? `- **Never use:** ${voiceProfile.neverUse.join(', ')}` : ''}
${voiceProfile.personalityNotes ? `- **Personality:** ${voiceProfile.personalityNotes}` : ''}
`
    : `
## Owner Voice Profile
Use a warm, genuine, professional tone. Sound like a real person — not a corporate response.
`

  const toneGuidance = isNegative
    ? `This is a negative review (${payload.rating}/5). The response must:
- Acknowledge the guest's experience without being defensive
- Take responsibility where appropriate — do not make excuses
- Address specific issues mentioned professionally
- Show what will be improved or has been improved
- Invite future guests reading this to reach out directly
- NEVER argue, deflect blame to the guest, or sound passive-aggressive`
    : isMixed
    ? `This is a mixed review (${payload.rating}/5). The response must:
- Thank the guest genuinely for the honest feedback
- Acknowledge both the positives they mentioned and the concerns
- Address the concerns directly and constructively
- Show commitment to improvement
- End on a warm, forward-looking note`
    : `This is a positive review (${payload.rating}/5). The response must:
- Thank the guest warmly and specifically (reference what they enjoyed)
- Feel personal and genuine — not templated
- Reinforce 1-2 things they mentioned that make the property special
- Invite them back or wish them well on future travels
- Keep it concise — positive responses should be brief (2-3 sentences)`

  const system = `You are an expert in short-term rental reputation management. You write review responses that:
- Make the reviewer feel heard and valued
- Show prospective guests that the host is responsive and professional  
- Protect and enhance the property's reputation on Airbnb/Vrbo
- Sound authentic and personal — never corporate or copy-paste
${voiceSection}
${toneGuidance}

## Output Format
You MUST return a valid JSON object with EXACTLY this structure — no markdown, no explanation, just JSON:
{
  "response": "string (the full review response text)",
  "tone": "string (brief description of tone used, e.g., 'warm and appreciative')",
  "keyPointsAddressed": ["string", "string", ...]
}

Rules:
- Positive reviews: 2-4 sentences max
- Negative/mixed reviews: 4-8 sentences, structured and clear
- Never start with "Dear [name]" — it sounds robotic
- Never use the phrase "We take your feedback seriously" — it's a cliché
- Always address the reviewer by their first name at least once
- The response field must be the complete, ready-to-post text`

  const user = `Write a response to this ${payload.platform ?? 'Airbnb'} review for "${payload.propertyName}".

## The Review
**Reviewer:** ${payload.reviewerName}
**Rating:** ${payload.rating}/5 stars
**Date:** ${payload.reviewDate}
**Review text:**
"${payload.reviewText}"
${payload.specificIssues?.length ? `\n## Specific Issues to Address\n${payload.specificIssues.map((i) => `- ${i}`).join('\n')}` : ''}
${payload.ownerResponse ? `\n## Existing Response to Improve\n"${payload.ownerResponse}"` : ''}

Write a response that protects the property's reputation and demonstrates genuine hospitality.`

  return { system, user }
}
