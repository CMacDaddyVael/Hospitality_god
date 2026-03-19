/**
 * Claude Content Generation Engine
 * 
 * Central function for all AI content generation in Hospitality God.
 * Automatically pulls and applies the property's voice profile.
 * 
 * Usage:
 *   const draft = await generateContent('review_response', {
 *     propertyId: 'prop_123',
 *     review: { guestName: 'Sarah', rating: 5, text: '...' }
 *   });
 */

import Anthropic from "@anthropic-ai/sdk";
import { buildVoiceInstruction, DEFAULT_VOICE_PROFILE } from "../voice-calibration/extract.mjs";

const client = new Anthropic();

/**
 * Fetch the voice profile for a property.
 * In production this hits Supabase; in test/dev environments
 * it can be passed directly in context.
 * 
 * @param {string} propertyId
 * @param {object} [supabaseClient] - Optional Supabase client
 * @returns {Promise<object>} Voice profile
 */
async function fetchVoiceProfile(propertyId, supabaseClient) {
  if (!propertyId) return DEFAULT_VOICE_PROFILE;

  // If a Supabase client is provided, use it
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("properties")
        .select("voice_profile")
        .eq("id", propertyId)
        .single();

      if (error || !data?.voice_profile) {
        console.warn(`[GenerateContent] No voice profile for property ${propertyId}, using default`);
        return DEFAULT_VOICE_PROFILE;
      }

      return data.voice_profile;
    } catch (err) {
      console.error("[GenerateContent] Failed to fetch voice profile:", err.message);
      return DEFAULT_VOICE_PROFILE;
    }
  }

  // No Supabase client — caller must pass voiceProfile in context
  return null;
}

/**
 * Build a content generation prompt for a specific content type.
 * 
 * @param {string} contentType - One of: review_response, guest_message, listing_description, social_post
 * @param {object} context - Content-specific context
 * @param {string} voiceInstruction - Voice profile instruction string
 * @returns {string} Full prompt
 */
function buildPrompt(contentType, context, voiceInstruction) {
  const baseInstruction = voiceInstruction || buildVoiceInstruction(DEFAULT_VOICE_PROFILE);

  switch (contentType) {
    case "review_response": {
      const { review, propertyName, hostName } = context;
      const rating = review?.rating ?? 5;
      const guestName = review?.guestName || review?.guest_name || "Guest";
      const reviewText = review?.text || review?.content || "";
      const isNegative = rating <= 3;

      return `You are writing a review response on behalf of ${hostName || "the property owner"} for their short-term rental property${propertyName ? ` "${propertyName}"` : ""}.

${baseInstruction}

Guest Review:
- Guest: ${guestName}
- Rating: ${rating}/5 stars
- Review: "${reviewText}"

Write a ${isNegative ? "professional, empathetic, and constructive" : "warm and grateful"} response to this review. 

Guidelines:
- Address the guest by their first name
- ${isNegative ? "Acknowledge any issues raised without being defensive, explain what you've done or will do to address them" : "Thank them specifically for what they mentioned"}
- Keep it genuine — avoid generic phrases like "Thank you for your feedback"
- ${isNegative ? "End on a positive, forward-looking note" : "Invite them to return or recommend to friends"}
- Match the voice profile instructions above precisely

Return ONLY the response text, no labels or explanation.`;
    }

    case "guest_message": {
      const { messageType, guestName, checkInDate, checkOutDate, propertyName, propertyDetails, hostName } = context;

      const messageTemplates = {
        pre_arrival: `Write a pre-arrival message to send 2-3 days before check-in.
Include: warm welcome, excitement for their stay, offer to answer questions.
Do NOT include: specific access codes or addresses (those go in check-in instructions).`,
        check_in: `Write check-in instructions / welcome message for the day of arrival.
Include: welcome, key/access instructions placeholder [ACCESS_DETAILS], WiFi info placeholder [WIFI_DETAILS], house rules summary, any important notes about the property.`,
        mid_stay: `Write a brief mid-stay check-in message (sent day 2 of their stay).
Include: hope they're enjoying themselves, offer to help with anything, local recommendation if appropriate.
Keep it SHORT — this is a quick check-in, not a sales pitch.`,
        post_stay: `Write a post-stay thank you message sent the day after checkout.
Include: thank you for staying, hope they enjoyed it, genuine (not pushy) invitation to leave a review, welcome them back.`,
      };

      const messageGuide = messageTemplates[messageType] || messageTemplates.pre_arrival;

      return `You are writing a guest message on behalf of ${hostName || "the property owner"} for their short-term rental${propertyName ? ` "${propertyName}"` : ""}.

${baseInstruction}

Message type: ${messageType?.replace("_", " ") || "pre-arrival"}
Guest name: ${guestName || "Guest"}
${checkInDate ? `Check-in: ${checkInDate}` : ""}
${checkOutDate ? `Check-out: ${checkOutDate}` : ""}
${propertyDetails ? `Property details: ${propertyDetails}` : ""}

${messageGuide}

Return ONLY the message text, no labels or explanation.`;
    }

    case "listing_description": {
      const { propertyName, propertyType, location, amenities, uniqueFeatures, targetGuest, hostName } = context;

      return `You are writing an Airbnb listing description for ${hostName || "a property owner"}.

${baseInstruction}

Property Details:
- Name: ${propertyName || "Property"}
- Type: ${propertyType || "vacation rental"}
- Location: ${location || ""}
- Key amenities: ${Array.isArray(amenities) ? amenities.join(", ") : amenities || ""}
- Unique features: ${Array.isArray(uniqueFeatures) ? uniqueFeatures.join(", ") : uniqueFeatures || ""}
- Ideal for: ${targetGuest || "all guests"}

Write a compelling, SEO-friendly Airbnb listing description. Structure:
1. Opening hook (1-2 sentences that capture the property's essence)
2. Space description (what makes it special, layout, feel)
3. Key amenities callout
4. Location/neighborhood 
5. Closing invitation

Return ONLY the description text.`;
    }

    case "social_post": {
      const { platform, theme, propertyName, propertyDetails, imageDescription, hostName } = context;

      const platformGuides = {
        instagram: "Instagram post (caption under 2200 chars, relevant hashtags at end)",
        tiktok: "TikTok video caption/hook (punchy, trend-aware, under 300 chars for caption)",
        facebook: "Facebook post (conversational, can be longer, no hashtag overload)",
      };

      return `You are writing a social media post for ${hostName || "a property owner"}'s short-term rental${propertyName ? ` "${propertyName}"` : ""}.

${baseInstruction}

Platform: ${platformGuides[platform] || platformGuides.instagram}
Theme/angle: ${theme || "showcase the property"}
${imageDescription ? `Image/video content: ${imageDescription}` : ""}
${propertyDetails ? `Property context: ${propertyDetails}` : ""}

Write an engaging ${platform || "social media"} post. Make it feel authentic to the host's voice, not like a hotel chain.

Return ONLY the post text (and hashtags if Instagram/TikTok).`;
    }

    default:
      return `Write content for a short-term rental property.

${baseInstruction}

Context: ${JSON.stringify(context, null, 2)}

Return the generated content only.`;
  }
}

/**
 * Main content generation function.
 * Automatically applies the property's voice profile.
 * 
 * @param {string} contentType - 'review_response' | 'guest_message' | 'listing_description' | 'social_post'
 * @param {object} context - Content context (varies by type)
 * @param {object} [options]
 * @param {object} [options.supabaseClient] - Supabase client for voice profile lookup
 * @param {object} [options.voiceProfile] - Pass directly to skip DB lookup
 * @param {string} [options.model] - Claude model override
 * @returns {Promise<{ content: string, voiceProfileUsed: object, contentType: string }>}
 */
export async function generateContent(contentType, context, options = {}) {
  const { supabaseClient, model = "claude-opus-4-5" } = options;

  // Resolve voice profile
  let voiceProfile = options.voiceProfile;

  if (!voiceProfile && context.propertyId) {
    voiceProfile = await fetchVoiceProfile(context.propertyId, supabaseClient);
  }

  if (!voiceProfile) {
    voiceProfile = DEFAULT_VOICE_PROFILE;
  }

  const voiceInstruction = buildVoiceInstruction(voiceProfile);
  const prompt = buildPrompt(contentType, context, voiceInstruction);

  console.log(
    `[GenerateContent] Generating ${contentType} for property ${context.propertyId || "unknown"} ` +
      `using voice profile (fallback: ${voiceProfile.fallbackUsed})`
  );

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0].text.trim();

  return {
    content,
    voiceProfileUsed: voiceProfile,
    contentType,
    generatedAt: new Date().toISOString(),
  };
}

export default generateContent;
