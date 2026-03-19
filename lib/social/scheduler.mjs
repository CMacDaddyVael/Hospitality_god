/**
 * Post Scheduler
 * Manages the queue of scheduled posts and publishes them at the right time
 */
import { publishPost, validateAccessToken } from "./metaApi.mjs";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key);
}

/**
 * Process all posts that are due to be published
 * This is called by a cron job every 15 minutes
 */
export async function processScheduledPosts() {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // Find posts that are approved, scheduled, and due
  const { data: duePosts, error } = await supabase
    .from("social_posts")
    .select(`
      *,
      properties (
        id,
        name,
        instagram_account_id,
        instagram_access_token
      )
    `)
    .eq("status", "approved")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("Error fetching due posts:", error);
    return { published: 0, failed: 0, errors: [error.message] };
  }

  if (!duePosts || duePosts.length === 0) {
    console.log("No posts due for publishing");
    return { published: 0, failed: 0 };
  }

  console.log(`Found ${duePosts.length} posts due for publishing`);

  let published = 0;
  let failed = 0;
  const errors = [];

  for (const post of duePosts) {
    try {
      const property = post.properties;

      if (!property?.instagram_account_id || !property?.instagram_access_token) {
        console.warn(`Post ${post.id}: Property missing Instagram credentials`);
        await markPostFailed(supabase, post.id, "Missing Instagram credentials");
        failed++;
        continue;
      }

      // Validate token is still good
      const tokenValid = await validateAccessToken(property.instagram_access_token);
      if (!tokenValid) {
        console.warn(`Post ${post.id}: Instagram access token expired`);
        await markPostFailed(supabase, post.id, "Instagram access token expired — please reconnect");
        failed++;
        errors.push(`Property ${property.name}: Instagram token expired`);
        continue;
      }

      // Publish to Instagram
      console.log(`Publishing post ${post.id} for ${property.name}...`);
      const result = await publishPost(
        property.instagram_account_id,
        post.photo_url,
        post.instagram_caption,
        property.instagram_access_token
      );

      // Mark as published
      const { error: updateError } = await supabase
        .from("social_posts")
        .update({
          status: "published",
          instagram_post_id: result.instagramPostId,
          published_at: result.publishedAt,
        })
        .eq("id", post.id);

      if (updateError) {
        console.error(`Failed to update post ${post.id} status:`, updateError);
      }

      published++;
      console.log(`✓ Published post ${post.id} → Instagram ${result.instagramPostId}`);
    } catch (err) {
      console.error(`Failed to publish post ${post.id}:`, err.message);
      await markPostFailed(supabase, post.id, err.message);
      failed++;
      errors.push(`Post ${post.id}: ${err.message}`);
    }
  }

  return { published, failed, errors };
}

async function markPostFailed(supabase, postId, reason) {
  await supabase
    .from("social_posts")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

/**
 * Auto-approve posts if owner hasn't reviewed within 48 hours
 * (Optional behavior — configurable per property)
 */
export async function autoApproveExpiredPosts() {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: properties } = await supabase
    .from("properties")
    .select("id, auto_approve_posts")
    .eq("auto_approve_posts", true);

  if (!properties?.length) return;

  const propertyIds = properties.map((p) => p.id);

  const { error } = await supabase
    .from("social_posts")
    .update({ status: "approved" })
    .eq("status", "pending_approval")
    .in("property_id", propertyIds)
    .lte("created_at", cutoff);

  if (error) {
    console.error("Error auto-approving posts:", error);
  }
}
