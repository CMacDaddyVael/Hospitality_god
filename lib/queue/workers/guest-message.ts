/**
 * Worker: guest_message
 * Sends automated guest communication sequences.
 */

import type { WorkerContext, TaskResult } from '../types';

export async function runGuestMessage(ctx: WorkerContext): Promise<TaskResult> {
  const { task } = ctx;
  const { reservation_id, message_type, guest_name, platform } = task.payload as {
    reservation_id?: string;
    message_type?: 'pre_arrival' | 'check_in' | 'mid_stay' | 'post_stay' | 'review_request';
    guest_name?: string;
    platform?: string;
  };

  if (!reservation_id || !message_type) {
    return { success: false, error: 'Missing reservation_id or message_type in payload' };
  }

  console.log(`[guest_message] Sending ${message_type} message for reservation ${reservation_id}`);

  // TODO: call Claude API to personalize message
  // TODO: send via Airbnb/Vrbo messaging API

  const templates: Record<string, string> = {
    pre_arrival: `Hi ${guest_name ?? 'there'}! We're excited to welcome you. Here are your check-in details...`,
    check_in: `Welcome! We hope your journey was smooth. Your access code is...`,
    mid_stay: `Hi ${guest_name ?? 'there'}! Just checking in — is everything comfortable? Let us know if you need anything.`,
    post_stay: `Thank you for staying with us, ${guest_name ?? 'friend'}! We hope you had a wonderful time.`,
    review_request: `Hi ${guest_name ?? 'there'}! We'd love to hear about your experience. Would you mind leaving us a review?`,
  };

  const result = {
    reservation_id,
    message_type,
    platform: platform ?? 'airbnb',
    sent_at: new Date().toISOString(),
    message_preview: templates[message_type] ?? 'Message content generated.',
    delivered: false, // set to true once API integration is live
  };

  return { success: true, data: result };
}
