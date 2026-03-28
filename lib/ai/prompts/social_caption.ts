import type { VoiceProfile, SocialCaptionPayload } from '../../../types/tasks'

const PLATFORM_GUIDANCE: Record<SocialCaptionPayload['platform'], string> = {
  instagram: `Platform: INSTAGRAM
- Captions can be longer (up to 2,200 chars) but the first 125 chars must hook the reader before "more"
- Use line breaks liberally for readability — Instagram readers skim
- Emojis are expected and effective — use 3-8 strategically placed emojis
- Call-to-action should encourage saves, shares, or comments (not just likes)
- Hashtags: 8-15 hashtags, mix of high-volume and niche STR/travel tags
- Strong visual description for alt text`,

  tiktok: `Platform: TIKTOK
- Caption must be punchy and attention-grabbing — first 5 words are critical
- 100-150 characters ideal (most TikTok captions are short)
- Trending audio/challenge tie-ins if relevant
- Hashtags: 3-6 hashtags max, trending > niche on TikTok
- Conversational, energetic tone — TikTok is Gen Z/Millennial
- Strong hook text that would overlay the video`,

  facebook: `Platform: FACEBOOK
- Facebook allows longer, more storytelling-style captions
- Aim for 40-80 words — enough to tell a story, not overwhelming
- Personal and community-focused tone
- 1-3 hashtags max — Facebook hashtags are less effective
- Call-to-action: link clicks, shares, or tagging friends
- Can be slightly more formal than Instagram`,

  twitter: `Platform: TWITTER/X
- 280 character limit — every word counts
- Punchy, witty, or provocative to earn engagement
- 1-2 hashtags max
- No fluff — direct and interesting
- Can be a question, a hot take, or a visual hook
- Thread-worthy if the story is bigger than 280 chars`,
}

const CONTENT_TYPE_GUIDANCE: Record<SocialCaptionPayload['contentType'], string> = {
  property_showcase: 'Showcase the property itself — architecture, spaces, views, ambiance. Make followers want to be there.',
  local_experience: 'Highlight the local area, neighborhood, or nearby attractions — sell the destination, not just the room.',
  guest_highlight: 'Feature a guest experience or testimonial (anonymized) — social proof that drives bookings.',
  seasonal: 'Tie into the current season, upcoming holiday, or local event — timely and relevant.',
  amenity_spotlight: 'Deep-dive on one specific amenity (pool, kitchen, view, etc.) — make one feature feel extraordinary.',
}

export function buildSocialCaptionPrompt(
  payload: SocialCaptionPayload,
  voiceProfile?: VoiceProfile
): { system: string; user: string } {
  const voiceSection = voiceProfile
    ? `
## Brand Voice
Write in this property's established social media voice:
- **Tone:** ${voiceProfile.tone ?? 'warm and aspirational'}
- **Brand name:** ${voiceProfile.signOffName ?? payload.propertyName}
${voiceProfile.alwaysUse?.length ? `- **Always use:** ${voiceProfile.alwaysUse.join(', ')}` : ''}
${voiceProfile.neverUse?.length ? `- **Never use:** ${voiceProfile.neverUse.join(', ')}` : ''}
${voiceProfile.personalityNotes ? `- **Brand personality:** ${voiceProfile.personalityNotes}` : ''}
`
    : `
## Brand Voice
Write with an aspirational, warm, and lifestyle-forward tone that makes followers dream about visiting this property.
`

  const system = `You are an expert social media content creator specializing in short-term rental and travel content.
You create captions that stop the scroll, build engaged followings, and drive direct booking inquiries.

Your captions:
- Lead with the most compelling element — never bury the hook
- Use sensory language that puts the reader inside the experience  
- Are platform-native — they feel right for the platform, not copy-pasted across channels
- Drive measurable engagement (saves, shares, DMs, comments)
- Build a lifestyle brand around the property, not just a listing ad
${voiceSection}
${PLATFORM_GUIDANCE[payload.platform]}

Content focus: ${CONTENT_TYPE_GUIDANCE[payload.contentType]}

## Output Format
You MUST return a valid JSON object with EXACTLY this structure — no markdown, no explanation, just JSON:
{
  "caption": "string (the complete, ready-to-post caption including emojis and line breaks)",
  "hashtags": ["string", "string", ...],
  "altText": "string (descriptive alt text for the image/video for accessibility)",
  "bestTimeToPost": "string (suggested day/time, e.g., 'Tuesday evening 6-8pm EST')",
  "platform": "${payload.platform}"
}

Rules:
- caption should NOT include the hashtags inline — put hashtags in the hashtags array
- caption must be complete and ready to post — no placeholders
- altText must be descriptive enough for a visually impaired person to understand the image
- hashtags array should contain the # symbol already (e.g., "#airbnb" not "airbnb")
- bestTimeToPost should be a specific, actionable suggestion based on the platform and content type`

  const user = `Create a ${payload.contentType.replace(/_/g, ' ')} caption for ${payload.propertyName} on ${payload.platform}.

## Property Details
- **Property:** ${payload.propertyName}
- **Location:** ${payload.location}
- **Content type:** ${payload.contentType.replace(/_/g, ' ')}
- **Target audience:** ${payload.targetAudience ?? 'Travelers and vacation rental seekers'}
${payload.photoDescription ? `\n## What's in the Image/Video\n${payload.photoDescription}` : ''}
${payload.highlights?.length ? `\n## Key Features to Highlight\n${payload.highlights.map((h) => `- ${h}`).join('\n')}` : ''}
${payload.callToAction ? `\n## Desired Call to Action\n${payload.callToAction}` : ''}
${payload.hashtags?.length ? `\n## Seed Hashtags to Include\n${payload.hashtags.join(', ')}` : ''}

Create a scroll-stopping caption that makes people want to book or share this property.`

  return { system, user }
}
