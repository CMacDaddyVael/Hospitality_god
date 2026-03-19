/**
 * Worker: social_post
 * Creates and publishes social media content for a property.
 */

import type { WorkerContext, TaskResult } from '../types';

export async function runSocialPost(ctx: WorkerContext): Promise<TaskResult> {
  const { task } = ctx;
  const { platform, content, image_url, scheduled_time } = task.payload as {
    platform?: 'instagram' | 'tiktok';
    content?: string;
    image_url?: string;
    scheduled_time?: string;
  };

  if (!platform) {
    return { success: false, error: 'Missing platform in payload' };
  }

  console.log(`[social_post] Publishing to ${platform} for property ${task.property_id}`);

  // TODO: call Meta Graph API for Instagram
  // TODO: call TikTok API for TikTok
  // TODO: call Claude/Gemini to generate content if not provided

  const result = {
    platform,
    property_id: task.property_id,
    published_at: new Date().toISOString(),
    content_preview: content ?? 'AI-generated content will appear here.',
    image_url: image_url ?? null,
    post_id: null, // set to platform post ID once live
    scheduled_time: scheduled_time ?? null,
  };

  return { success: true, data: result };
}
