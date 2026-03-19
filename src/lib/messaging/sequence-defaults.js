/**
 * Default sequence configuration for new properties.
 * These are the 4 message steps with their timing offsets.
 */

export const SEQUENCE_STEPS = {
  pre_arrival: {
    label: 'Pre-Arrival',
    description: 'Sent 3 days before check-in',
    icon: '✈️',
    send_offset_hours: -72, // 72 hours before check-in
    send_time_hour: 10,     // 10am
    default_mode: 'approve',
  },
  check_in: {
    label: 'Check-In Day',
    description: 'Sent morning of check-in day',
    icon: '🏠',
    send_offset_hours: 0,   // day of check-in (at send_time_hour)
    send_time_hour: 9,      // 9am
    default_mode: 'approve',
  },
  mid_stay: {
    label: 'Mid-Stay Check-In',
    description: 'Sent on day 2 of their stay',
    icon: '💬',
    send_offset_hours: 28,  // ~28 hours after check-in (day 2 morning)
    send_time_hour: 10,     // 10am
    default_mode: 'approve',
  },
  post_stay: {
    label: 'Post-Stay Thank You',
    description: 'Sent 24 hours after checkout',
    icon: '⭐',
    send_offset_hours: 24,  // 24 hours after check-OUT
    send_time_hour: 11,     // 11am
    default_mode: 'approve',
  },
};

export const DEFAULT_TEMPLATES = {
  pre_arrival: `Hi {guest_first_name}! 

I'm so excited to welcome you to {property_name} in just 3 days! 🎉

I wanted to reach out with a few things to help you prepare for your stay:

**Check-in Details:**
• Check-in: {check_in_date} (anytime after {check_in_time})
• Check-out: {check_out_date} (by {check_out_time})

**Getting Here:**
{check_in_instructions}

If you have any questions before your arrival, don't hesitate to reach out. I'm here to make sure you have an amazing stay!

Looking forward to hosting you 😊`,

  check_in: `Good morning, {guest_first_name}! 

Welcome to your check-in day! 🏠 I hope you're excited for your stay at {property_name}.

**Quick Reminders:**
• Check-in is ready anytime after {check_in_time}
• WiFi: {wifi_network} | Password: {wifi_password}

**The Space:**
{check_in_instructions}

Please message me once you've arrived and let me know if everything is to your liking. I want to make sure you feel right at home!

Safe travels today! 🚗`,

  mid_stay: `Hey {guest_first_name}! 

Just checking in to make sure everything is going smoothly with your stay at {property_name} 😊

Is there anything you need? Any questions about the area or the space?

I want to make sure you're having an amazing time! If there's anything at all I can do to make your stay even better, just let me know.

Enjoy the rest of your stay! ☀️`,

  post_stay: `Hi {guest_first_name},

I hope you had a wonderful stay at {property_name}! It was such a pleasure hosting you 🙏

If you enjoyed your time here, I'd be incredibly grateful if you could take a moment to leave a review. It really helps other travelers discover the property and helps me continue improving the experience.

You can leave a review here: {review_link}

I hope to welcome you back someday — whether it's for a return trip or another adventure! 

Thank you again for being such a wonderful guest. Wishing you safe travels wherever you're headed next! ✈️

Warm regards`,
};

/**
 * Calculate the scheduled send time for a message step.
 * @param {string} step - 'pre_arrival' | 'check_in' | 'mid_stay' | 'post_stay'
 * @param {Date} checkInDate - booking check-in date
 * @param {Date} checkOutDate - booking check-out date
 * @param {number} sendTimeHour - hour of day to send (0-23)
 * @returns {Date} scheduled send time
 */
export function calculateSendTime(step, checkInDate, checkOutDate, sendTimeHour = null) {
  const stepConfig = SEQUENCE_STEPS[step];
  const hour = sendTimeHour ?? stepConfig.send_time_hour;

  let baseDate;
  if (step === 'post_stay') {
    // Post-stay is relative to check-out
    baseDate = new Date(checkOutDate);
  } else {
    // All others are relative to check-in
    baseDate = new Date(checkInDate);
  }

  // Set to the specified hour
  baseDate.setHours(hour, 0, 0, 0);

  // Add the offset hours
  const offsetMs = stepConfig.send_offset_hours * 60 * 60 * 1000;
  const scheduledTime = new Date(baseDate.getTime() + offsetMs);

  return scheduledTime;
}
