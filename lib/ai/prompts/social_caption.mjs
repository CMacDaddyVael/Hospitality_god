/**
 * Social Caption Prompt — updated to consume voice profile (issue #121)
 *
 * Original behavior preserved when no voiceProfile is provided.
 */

/**
 * Build a Claude prompt for generating a social media caption in the owner's voice.
 *
 * @param {object} params
 * @param {string} params.platform            - e.g. "instagram", "tiktok", "facebook"
 * @param {string} [params.theme]             - Content theme, e.g. "summer vibes", "cozy winter"
 * @param {string} [params.propertyName]      - Name of the property
 * @param {string} [params.propertyLocation]  - Location, e.g. "Malibu, CA"
 * @param {string} [params.callToAction]      - e.g. "Link in bio to book", "DM for dates"
 * @param {string[]} [params.amenities]       - Notable amenities to highlight
 * @param {string} [params.voiceProfile]      - Injected voice profile block from getVoiceProfileForPrompt()
 * @param {number} [params.captionCount]      - How many caption variants to produce (default 3)
 * @returns {string}
 */
export function buildSocialCaptionPrompt({
  platform = 'instagram',
  theme,
  propertyName,
  propertyLocation,
  callToAction,
  amenities = [],
  voiceProfile,
  captionCount = 3,
}) {
  const platformGuide = {
    instagram: 'Instagram (visual, aspirational, 150–220 characters ideal, up to 5 relevant hashtags)',
    tiktok: 'TikTok (punchy, trend-aware, conversational, 100–150 characters, 3–5 hashtags)',
    facebook: 'Facebook (friendly, slightly longer, 200–300 characters, minimal hashtags)',
  }[platform.toLowerCase()] || `${platform} (engaging, platform-appropriate length)`

  const voiceBlock = voiceProfile
    ? voiceProfile
    : `## Owner Voice Profile
Write in a warm, inviting tone that makes followers feel like they're getting a glimpse into a special place. Be genuine, not salesy.`

  const amenitiesLine =
    amenities.length > 0 ? `Key amenities to weave in: ${amenities.slice(0, 5).join(', ')}` : ''

  return `You are a social media copywriter for a short-term rental host.

${voiceBlock}

## Post Details
- Platform: ${platformGuide}
- Property: ${propertyName || 'a short-term rental property'}${propertyLocation ? ` in ${propertyLocation}` : ''}
${theme ? `- Theme / angle: ${theme}` : ''}
${amenitiesLine}
${callToAction ? `- Call to action: ${callToAction}` : ''}

## Instructions
Write ${captionCount} distinct caption variants for this post. Each caption should:
- Match the owner's voice profile exactly — sound like them, not a generic brand account
- Feel natural and human, not like AI-generated filler
- Be optimized for ${platform} engagement
- Include appropriate hashtags at the end
- Vary in hook style (question, statement, sensory detail) across the variants

Format your response as:

CAPTION 1:
[caption text with hashtags]

CAPTION 2:
[caption text with hashtags]

CAPTION 3:
[caption text with hashtags]

${captionCount > 3 ? `Continue through CAPTION ${captionCount}.` : ''}`.trim()
}

/**
 * Legacy export — simple string template for backward compatibility.
 */
export const socialCaptionPrompt = `You are a social media copywriter for a short-term rental host.
Write engaging, authentic captions that showcase the property's unique character.
Match the host's voice and keep it conversational. Include relevant hashtags.`
