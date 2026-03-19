import type { VoiceProfile, ListingRewritePayload } from '../../../types/tasks'

export function buildListingRewritePrompt(
  payload: ListingRewritePayload,
  voiceProfile?: VoiceProfile
): { system: string; user: string } {
  const voiceSection = voiceProfile
    ? `
## Owner Voice Profile
You must write in the owner's established voice and style:
- **Tone:** ${voiceProfile.tone ?? 'warm and professional'}
- **Sign-off name:** ${voiceProfile.signOffName ?? 'The Host'}
${voiceProfile.alwaysUse?.length ? `- **Always use these phrases/words:** ${voiceProfile.alwaysUse.join(', ')}` : ''}
${voiceProfile.neverUse?.length ? `- **Never use these phrases/words:** ${voiceProfile.neverUse.join(', ')}` : ''}
${voiceProfile.personalityNotes ? `- **Personality notes:** ${voiceProfile.personalityNotes}` : ''}
${voiceProfile.examplePhrases?.length ? `- **Example phrases from this owner:** ${voiceProfile.examplePhrases.join(' | ')}` : ''}
`
    : `
## Owner Voice Profile
Use a warm, inviting, and professional tone that feels personal and authentic — not corporate.
`

  const system = `You are an expert Airbnb/Vrbo listing copywriter specializing in short-term rental marketing. 
You write listings that rank high in OTA search results AND convert browsers into bookers.

Your listings are:
- Rich with sensory details that let guests picture themselves there
- Structured for skimmability (guests scan, not read)
- Optimized with high-intent search keywords woven naturally into the copy
- Honest and specific — never vague or generic
- Action-oriented — they make guests feel they'd be missing out by not booking
${voiceSection}
## Output Format
You MUST return a valid JSON object with EXACTLY this structure — no markdown, no explanation, just JSON:
{
  "title": "string (max 50 characters, compelling, keyword-rich)",
  "description": "string (full optimized listing description, 300-600 words)",
  "summary": "string (1-2 sentence hook, max 150 chars)",
  "highlights": ["string", "string", "string", "string", "string"],
  "tags": ["string", "string", ...],
  "seoNotes": "string (2-3 sentences explaining key optimization decisions)"
}

Rules:
- title MUST be under 50 characters
- highlights MUST be exactly 5 items
- tags should be 8-15 relevant search terms guests would actually use
- description should flow naturally with keywords embedded — not keyword-stuffed
- Never use hollow phrases like "charming", "cozy retreat", "home away from home" unless the owner's voice profile specifically calls for them`

  const amenitiesList = payload.amenities.length > 0
    ? payload.amenities.join(', ')
    : 'Standard amenities'

  const user = `Rewrite this ${payload.platform === 'both' ? 'Airbnb/Vrbo' : payload.platform} listing for maximum search visibility and conversion.

## Current Listing
**Title:** ${payload.currentTitle}
**Description:** ${payload.currentDescription}

## Property Details
- **Type:** ${payload.propertyType}
- **Location:** ${payload.location}
- **Price per night:** ${payload.pricePerNight ? `$${payload.pricePerNight}` : 'Not specified'}
- **Target guests:** ${payload.targetGuests ?? 'All traveler types'}
- **Amenities:** ${amenitiesList}
${payload.reviewHighlights?.length ? `\n## What Guests Love (from reviews)\n${payload.reviewHighlights.map((h) => `- ${h}`).join('\n')}` : ''}

Generate a high-converting, SEO-optimized listing that will rank above competitors and turn views into bookings.`

  return { system, user }
}
