/**
 * Guest Message Prompt
 * Issue #179 — Voice profile injection added (additive)
 *
 * IMPORTANT: Original prompt logic is unchanged. Voice profile block is
 * injected into the system prompt when provided. All existing callers
 * continue to work without passing voiceProfile.
 */
import { buildVoiceSystemPromptBlock } from '../../voice/extractVoiceProfile.mjs'

/**
 * Message type configurations — maps message types to instructions
 */
const MESSAGE_TYPE_CONFIG = {
  booking_confirmation: {
    instruction: 'Write a warm booking confirmation message welcoming the guest and confirming their reservation details.',
    tone_hint: 'excited and welcoming',
  },
  pre_arrival: {
    instruction: 'Write a pre-arrival message with check-in instructions and key details the guest needs to know before arriving.',
    tone_hint: 'helpful and clear',
  },
  check_in: {
    instruction: 'Write a check-in day message welcoming the guest and letting them know you are available if they need anything.',
    tone_hint: 'warm and reassuring',
  },
  mid_stay: {
    instruction: 'Write a mid-stay check-in message asking how everything is going and if there is anything the guest needs.',
    tone_hint: 'casual and caring',
  },
  checkout_reminder: {
    instruction: 'Write a friendly checkout reminder with the checkout time and any key instructions (keys, trash, etc.).',
    tone_hint: 'friendly and clear',
  },
  review_request: {
    instruction: 'Write a post-checkout message thanking the guest and kindly asking them to leave a review.',
    tone_hint: 'grateful and gentle',
  },
}

/**
 * Builds a guest message prompt.
 *
 * @param {Object} params
 * @param {string} params.messageType        - One of the MESSAGE_TYPE_CONFIG keys
 * @param {string} [params.guestName]        - Guest's first name
 * @param {string} [params.propertyName]     - Property name
 * @param {string} [params.checkInDate]      - Check-in date string
 * @param {string} [params.checkOutDate]     - Check-out date string
 * @param {string} [params.checkInTime]      - Check-in time (e.g. "3:00 PM")
 * @param {string} [params.checkOutTime]     - Checkout time (e.g. "11:00 AM")
 * @param {string} [params.specialNotes]     - Any special instructions or context
 * @param {Object} [params.voiceProfile]     - Voice profile from issue #179 (optional)
 * @returns {{ system: string, user: string }}
 */
export function buildGuestMessagePrompt({
  messageType,
  guestName = 'Guest',
  propertyName = 'our property',
  checkInDate = '',
  checkOutDate = '',
  checkInTime = '3:00 PM',
  checkOutTime = '11:00 AM',
  specialNotes = '',
  voiceProfile = null,
}) {
  const config = MESSAGE_TYPE_CONFIG[messageType] ?? MESSAGE_TYPE_CONFIG.booking_confirmation
  const voiceBlock = buildVoiceSystemPromptBlock(voiceProfile)

  const system = `You are a short-term rental host writing a guest communication message.

${voiceBlock}

Guidelines:
- Be ${config.tone_hint}
- Keep the message concise and easy to read
- Use the guest's name naturally
- Do not use em dashes (—)
- Do not sound like a hotel or a bot — write like a real person who owns this property
- Include only relevant details — don't pad with filler`

  const contextLines = [
    `Guest name: ${guestName}`,
    `Property: ${propertyName}`,
    checkInDate ? `Check-in: ${checkInDate} at ${checkInTime}` : '',
    checkOutDate ? `Check-out: ${checkOutDate} at ${checkOutTime}` : '',
    specialNotes ? `Special notes: ${specialNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const user = `${config.instruction}

Context:
${contextLines}

Message:`

  return { system, user }
}

/**
 * Legacy single-string export for backwards compatibility.
 *
 * @deprecated Use buildGuestMessagePrompt() for voice profile support
 */
export const guestMessagePrompt = `You are a short-term rental host writing a friendly, helpful message to a guest.
Write in first person, be warm and personal. Keep messages concise and easy to read.
Do not use em dashes (—). Sound like a real person, not a hotel or a bot.`
