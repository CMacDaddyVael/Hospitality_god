/**
 * Prompt template for: guest_message
 *
 * Input context:
 *   - messageType: "pre_arrival" | "check_in" | "mid_stay" | "post_stay" | "review_request"
 *   - guestName: string
 *   - propertyName: string
 *   - ownerName: string
 *   - checkInDate: string (ISO date)
 *   - checkOutDate: string (ISO date)
 *   - checkInInstructions: object (optional — lockbox code, parking, wifi)
 *   - houseRules: string[] (optional)
 *   - localRecommendations: string[] (optional)
 *   - customContext: string (optional — special circumstances)
 *
 * Output JSON schema:
 *   - subject: string (message subject/title if applicable)
 *   - message: string (the full message body)
 *   - timing: string (when to send this message)
 *   - callToAction: string (what you want the guest to do)
 *   - tone: string (tone used)
 */

export function guestMessagePrompt(context) {
  const {
    messageType = "pre_arrival",
    guestName = "Guest",
    propertyName = "our property",
    ownerName = "Your Host",
    checkInDate = "",
    checkOutDate = "",
    checkInInstructions = {},
    houseRules = [],
    localRecommendations = [],
    customContext = "",
  } = context;

  const messageTypeConfig = MESSAGE_TYPE_CONFIGS[messageType] || MESSAGE_TYPE_CONFIGS.pre_arrival;

  const systemPrompt = `You are a professional short-term rental host assistant. You write guest messages that feel genuinely personal, not automated.

Message principles:
- Sound like a real host, not a robot or template
- Be warm but efficient — guests don't want to read essays
- Every message has one clear purpose and one clear call to action
- Use the guest's first name naturally (not robotically at the start of every sentence)
- Local recommendations feel curated, not copy-pasted from a list

CRITICAL: You must respond ONLY with a valid JSON object. Return exactly this structure:
{
  "subject": "string — message subject line",
  "message": "string — full message body with natural line breaks",
  "timing": "string — when to send (e.g., '3 days before check-in')",
  "callToAction": "string — what you want the guest to do",
  "tone": "string — tone description"
}`;

  const userPrompt = `Write a ${messageTypeConfig.label} message for this guest.

## Guest Information
- **Guest Name:** ${guestName}
- **Property:** ${propertyName}
- **Host Name:** ${ownerName}
- **Check-in:** ${checkInDate || "not specified"}
- **Check-out:** ${checkOutDate || "not specified"}

## Message Type: ${messageTypeConfig.label}
${messageTypeConfig.guidance}

${buildCheckInSection(checkInInstructions, messageType)}
${buildHouseRulesSection(houseRules, messageType)}
${buildLocalRecsSection(localRecommendations, messageType)}
${customContext ? `## Additional Context:\n${customContext}` : ""}

Write the message as ${ownerName} sending it personally to ${guestName}.

Return ONLY the JSON object as specified.`;

  return { systemPrompt, userPrompt };
}

// ─── Message Type Configurations ─────────────────────────────────────────────

const MESSAGE_TYPE_CONFIGS = {
  pre_arrival: {
    label: "Pre-Arrival Welcome",
    guidance: `Send 3 days before check-in. Goal: build excitement and ensure guest is prepared.
- Express genuine excitement about their stay
- Confirm check-in time and process
- Highlight 1-2 things to look forward to
- Let them know how to reach you`,
  },

  check_in: {
    label: "Check-In Instructions",
    guidance: `Send morning of check-in. Goal: seamless arrival with all info they need.
- Step-by-step access instructions (lockbox, door code, parking)
- WiFi credentials
- Quick orientation (where is everything?)
- Your contact info for anything urgent`,
  },

  mid_stay: {
    label: "Mid-Stay Check-In",
    guidance: `Send day 2-3 of their stay. Goal: surface any issues before they become review fodder.
- Keep it short and genuine, not a form letter
- Ask one simple open question about their stay
- Offer any additional help
- Mention something they might enjoy they haven't tried yet`,
  },

  post_stay: {
    label: "Post-Stay Thank You",
    guidance: `Send 2 hours after check-out. Goal: warm close and review request.
- Genuine thank you for choosing your place
- Hope they'll return (only if it felt like a great fit)
- Naturally mention that reviews help your hosting
- Do NOT beg — a single mention is enough`,
  },

  review_request: {
    label: "Review Request",
    guidance: `Send 24 hours after check-out if no review yet. Goal: prompt a review authentically.
- Reference something specific from their stay
- Explain briefly why reviews matter (helps future guests find great places)
- Make it easy — single clear ask
- Keep it very short (3-4 sentences max)`,
  },
};

// ─── Section Builders ─────────────────────────────────────────────────────────

function buildCheckInSection(instructions, messageType) {
  if (!instructions || Object.keys(instructions).length === 0) return "";
  if (!["check_in", "pre_arrival"].includes(messageType)) return "";

  const lines = [];
  if (instructions.lockboxCode) lines.push(`- Lockbox code: ${instructions.lockboxCode}`);
  if (instructions.doorCode) lines.push(`- Door code: ${instructions.doorCode}`);
  if (instructions.parkingInfo) lines.push(`- Parking: ${instructions.parkingInfo}`);
  if (instructions.wifiName) lines.push(`- WiFi network: ${instructions.wifiName}`);
  if (instructions.wifiPassword) lines.push(`- WiFi password: ${instructions.wifiPassword}`);
  if (instructions.additionalNotes) lines.push(`- Notes: ${instructions.additionalNotes}`);

  return lines.length > 0
    ? `## Check-In Instructions to Include:\n${lines.join("\n")}`
    : "";
}

function buildHouseRulesSection(rules, messageType) {
  if (!rules || rules.length === 0) return "";
  if (messageType !== "pre_arrival") return "";

  return `## Key House Rules to Mention (weave in naturally, not as a lecture):\n${rules.map((r) => `- ${r}`).join("\n")}`;
}

function buildLocalRecsSection(recs, messageType) {
  if (!recs || recs.length === 0) return "";
  if (!["pre_arrival", "mid_stay"].includes(messageType)) return "";

  return `## Local Recommendations (mention 1-2 if relevant):\n${recs.map((r) => `- ${r}`).join("\n")}`;
}
