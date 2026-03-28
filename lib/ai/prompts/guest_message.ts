import type { VoiceProfile, GuestMessagePayload } from '../../../types/tasks'

const MESSAGE_TYPE_GUIDANCE: Record<GuestMessagePayload['messageType'], string> = {
  pre_arrival: `This is a PRE-ARRIVAL message sent 24-48 hours before check-in. It should:
- Build excitement for their upcoming stay
- Provide essential check-in information clearly
- Include WiFi details, parking, and access instructions
- Share 2-3 local tips to make them feel welcomed
- Set expectations for a smooth arrival
- Be warm but informative — they need this info`,

  check_in: `This is a CHECK-IN DAY message sent the morning of arrival. It should:
- Welcome them warmly on arrival day
- Confirm check-in time and access method
- Provide the property address and any last-minute logistics
- Let them know you're available if they need anything
- Keep it brief — they're traveling and will skim it`,

  mid_stay: `This is a MID-STAY check-in message sent 1-2 days into their stay. It should:
- Check in warmly to see if everything is going well
- Offer to help with any questions or issues
- Share a local tip or recommendation they might not know about
- Make them feel valued — not like a form letter
- Keep it very short (3-4 sentences max) — don't interrupt their vacation`,

  post_stay: `This is a POST-STAY thank-you message sent within 24 hours of checkout. It should:
- Thank them genuinely for staying and being a great guest
- Express that you hope they had a wonderful experience
- Mention something specific if possible (reference their dates/occasion)
- Invite them to return
- Segue naturally into the review request (but don't be pushy in this message)
- Warm and genuine — this is your last impression`,

  review_request: `This is a REVIEW REQUEST message sent 2-3 days after checkout. It should:
- Remind them of their stay warmly
- Explain that reviews genuinely help the property
- Make leaving a review feel easy and low-effort
- Include the direct review link if provided in the payload
- Be brief and conversational — a favor request, not a demand
- Never guilt-trip or pressure — hosts who do this get bad reviews`,

  custom: `This is a CUSTOM message. Write it based on the context provided in the customContext field.
- Match the context and purpose described
- Use the owner's voice profile
- Be clear, warm, and helpful`,
}

export function buildGuestMessagePrompt(
  payload: GuestMessagePayload,
  voiceProfile?: VoiceProfile
): { system: string; user: string } {
  const voiceSection = voiceProfile
    ? `
## Owner Voice Profile
Write in this host's established communication style:
- **Tone:** ${voiceProfile.tone ?? 'warm and welcoming'}
- **Sign-off name:** ${voiceProfile.signOffName ?? 'Your Host'}
${voiceProfile.alwaysUse?.length ? `- **Always use:** ${voiceProfile.alwaysUse.join(', ')}` : ''}
${voiceProfile.neverUse?.length ? `- **Never use:** ${voiceProfile.neverUse.join(', ')}` : ''}
${voiceProfile.personalityNotes ? `- **Style notes:** ${voiceProfile.personalityNotes}` : ''}
${voiceProfile.examplePhrases?.length ? `- **Phrases this host uses:** ${voiceProfile.examplePhrases.join(' | ')}` : ''}
`
    : `
## Owner Voice Profile
Write with a warm, welcoming, personal tone — like a message from a friend who happens to be an excellent host.
`

  const system = `You are an expert in short-term rental guest communications. You write messages that:
- Make guests feel genuinely welcomed and valued
- Provide information clearly without overwhelming
- Build the host-guest relationship that leads to 5-star reviews
- Sound like a real, caring person — not an automated system
- Are mobile-optimized (short paragraphs, easy to read on a phone)
${voiceSection}
${MESSAGE_TYPE_GUIDANCE[payload.messageType]}

## Output Format
You MUST return a valid JSON object with EXACTLY this structure — no markdown, no explanation, just JSON:
{
  "subject": "string (short, clear subject line for the message)",
  "body": "string (the complete message body, ready to send)",
  "messageType": "${payload.messageType}",
  "estimatedReadTime": "string (e.g., '1 min read', '2 min read')"
}

Rules:
- body must be complete and ready-to-send — no [placeholder] brackets left unfilled
- Use the actual guest name, property name, and dates from the payload
- Keep paragraphs short — 1-3 sentences max per paragraph
- End with the owner's sign-off name from the voice profile
- Never start the message with "Dear" — use their name directly or start with a warm greeting`

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const user = `Write a ${payload.messageType.replace(/_/g, ' ')} message for this guest stay at "${payload.propertyName}".

## Guest Details
- **Guest name:** ${payload.guestName}
- **Property:** ${payload.propertyName}
- **Check-in:** ${formatDate(payload.checkInDate)}
- **Check-out:** ${formatDate(payload.checkOutDate)}
${payload.propertyAddress ? `- **Address:** ${payload.propertyAddress}` : ''}
${payload.checkInInstructions ? `\n## Check-in Instructions\n${payload.checkInInstructions}` : ''}
${payload.wifiDetails ? `\n## WiFi Details\n${payload.wifiDetails}` : ''}
${payload.houseRules?.length ? `\n## Key House Rules\n${payload.houseRules.map((r) => `- ${r}`).join('\n')}` : ''}
${payload.localRecommendations?.length ? `\n## Local Recommendations to Share\n${payload.localRecommendations.map((r) => `- ${r}`).join('\n')}` : ''}
${payload.customContext ? `\n## Additional Context\n${payload.customContext}` : ''}

Write a message that feels personal, helpful, and makes ${payload.guestName} excited about their stay.`

  return { system, user }
}
