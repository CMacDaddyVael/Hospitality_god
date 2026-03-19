/**
 * AI message draft generator using Claude API.
 * Personalizes messages based on property details, guest info, and booking context.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate an AI-personalized message draft for a given sequence step.
 */
export async function generateMessageDraft({
  step,
  property,
  booking,
  template = null,
}) {
  const stepDescriptions = {
    pre_arrival: 'pre-arrival message sent 3 days before check-in',
    check_in: 'check-in day welcome message',
    mid_stay: 'mid-stay check-in message (day 2 of their stay)',
    post_stay: 'post-stay thank you message with review request (sent 24 hours after checkout)',
  };

  const checkInDate = new Date(booking.check_in_date);
  const checkOutDate = new Date(booking.check_out_date);
  const nights = Math.round((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

  const systemPrompt = `You are a warm, professional short-term rental host writing a ${stepDescriptions[step]} to a guest.

Write in a friendly, personal tone — like a local who genuinely cares about the guest experience. 
Be concise but thorough. Use natural language, not corporate-speak.
Do NOT use excessive emojis — 1-3 max per message.
Do NOT start with "I hope this message finds you well" or other clichés.
Keep it under 200 words unless there's critical information to include.
Format with line breaks for readability. Use bullet points sparingly for key details.`;

  const contextBlock = `
PROPERTY DETAILS:
- Name: ${property.name}
- Description: ${property.description || 'A beautiful vacation rental'}
- Check-in instructions: ${property.check_in_instructions || 'Keys are in the lockbox'}
- WiFi password: ${property.wifi_password || 'See welcome binder'}
- House rules: ${property.house_rules || 'Standard house rules apply'}
- Amenities: ${Array.isArray(property.amenities) ? property.amenities.join(', ') : 'Standard amenities'}
- Review page URL: ${property.review_page_url || 'https://airbnb.com/'}

BOOKING DETAILS:
- Guest name: ${booking.guest_name}
- Guest first name: ${booking.guest_first_name || booking.guest_name.split(' ')[0]}
- Check-in date: ${checkInDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
- Check-out date: ${checkOutDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
- Number of nights: ${nights}
- Number of guests: ${booking.num_guests || 1}`;

  let userPrompt;

  if (template) {
    userPrompt = `${contextBlock}

TEMPLATE TO PERSONALIZE (use this as the base, but make it feel personal and specific):
${template}

Please personalize this template using the property and booking details above. 
Fill in all placeholder variables like {guest_first_name}, {property_name}, etc.
Adjust the content to feel genuine and specific to this guest and property.
Return only the final message text, no explanations.`;
  } else {
    const stepPrompts = {
      pre_arrival: `${contextBlock}

Write a pre-arrival message for this guest arriving in 3 days. Include:
- Warm welcome and excitement about their upcoming stay
- Check-in logistics (date, time, access instructions)
- WiFi info if relevant
- Brief mention of key amenities or what makes the property special
- Invitation to reach out with questions

Return only the message text.`,

      check_in: `${contextBlock}

Write a check-in day message. Include:
- Morning greeting and welcome to their check-in day
- Reminder of check-in time
- WiFi password and network name
- Key access/check-in instructions
- Offer to help if they need anything
- Brief, genuine excitement about hosting them

Return only the message text.`,

      mid_stay: `${contextBlock}

Write a brief mid-stay check-in message for day 2 of their stay. Include:
- Casual, friendly check-in
- Ask if everything is going well / if they need anything
- Maybe a recommendation for something local (be creative but don't make up specific places)
- Keep it SHORT — this is just a quick friendly check-in, not another info dump

Return only the message text.`,

      post_stay: `${contextBlock}

Write a post-stay thank you message sent 24 hours after checkout. Include:
- Warm thanks for staying
- Genuine compliment about being a great guest (keep it authentic, not over the top)
- Review request with the direct link: ${property.review_page_url || 'the Airbnb review page'}
- Invitation to return
- Brief warm sign-off

The review request is important — make it feel natural and not pushy. Mention that reviews help other travelers discover the property.

Return only the message text.`,
    };

    userPrompt = stepPrompts[step];
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  return response.content[0].text.trim();
}

/**
 * Substitute template variables with actual values.
 * Used for custom templates that use {variable} placeholders.
 */
export function substituteTemplateVars(template, { property, booking }) {
  const checkInDate = new Date(booking.check_in_date);
  const checkOutDate = new Date(booking.check_out_date);

  const vars = {
    guest_name: booking.guest_name,
    guest_first_name: booking.guest_first_name || booking.guest_name.split(' ')[0],
    property_name: property.name,
    check_in_date: checkInDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    check_out_date: checkOutDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    check_in_time: '3:00 PM',
    check_out_time: '11:00 AM',
    check_in_instructions: property.check_in_instructions || '',
    wifi_password: property.wifi_password || '',
    wifi_network: property.wifi_network || 'See welcome binder',
    review_link: property.review_page_url || 'https://airbnb.com',
    num_guests: booking.num_guests || 1,
  };

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}
