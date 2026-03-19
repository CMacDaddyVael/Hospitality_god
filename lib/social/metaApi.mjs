/**
 * Meta Graph API Integration
 * Handles Instagram Business OAuth and post scheduling
 */

const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Generate Meta OAuth authorization URL
 */
export function getMetaOAuthUrl(state) {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !redirectUri) {
    throw new Error("META_APP_ID and META_REDIRECT_URI must be set");
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: [
      "instagram_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(","),
    response_type: "code",
    state: state || "oauth",
  });

  return `https://www.facebook.com/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(code) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(
    `${META_BASE_URL}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Meta OAuth error: ${err.error?.message || response.status}`);
  }

  const data = await response.json();

  // Exchange for long-lived token (60 days)
  const longLivedToken = await getLongLivedToken(data.access_token);

  return longLivedToken;
}

/**
 * Exchange short-lived token for long-lived token
 */
async function getLongLivedToken(shortLivedToken) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `${META_BASE_URL}/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Meta long-lived token error: ${err.error?.message || response.status}`);
  }

  return response.json();
}

/**
 * Get user's Instagram Business Account ID
 */
export async function getInstagramAccountId(accessToken) {
  // First get Facebook pages
  const pagesResp = await fetch(
    `${META_BASE_URL}/me/accounts?access_token=${accessToken}`
  );

  if (!pagesResp.ok) {
    throw new Error("Failed to fetch Facebook pages");
  }

  const pagesData = await pagesResp.json();
  const pages = pagesData.data || [];

  if (pages.length === 0) {
    throw new Error(
      "No Facebook Pages found. An Instagram Business account must be connected to a Facebook Page."
    );
  }

  // Find Instagram business account connected to the page
  for (const page of pages) {
    const igResp = await fetch(
      `${META_BASE_URL}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );

    if (!igResp.ok) continue;

    const igData = await igResp.json();
    if (igData.instagram_business_account?.id) {
      return {
        instagramAccountId: igData.instagram_business_account.id,
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
      };
    }
  }

  throw new Error(
    "No Instagram Business Account found. Please connect your Instagram Business account to a Facebook Page."
  );
}

/**
 * Create an Instagram media container (step 1 of 2-step posting)
 * @param {string} instagramAccountId
 * @param {string} imageUrl - Publicly accessible URL of the image
 * @param {string} caption
 * @param {string} accessToken
 */
export async function createMediaContainer(instagramAccountId, imageUrl, caption, accessToken) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

  const response = await fetch(
    `${META_BASE_URL}/${instagramAccountId}/media`,
    {
      method: "POST",
      body: params,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      `Failed to create media container: ${err.error?.message || response.status}`
    );
  }

  const data = await response.json();
  return data.id; // creation_id
}

/**
 * Publish a media container (step 2 of 2-step posting)
 */
export async function publishMediaContainer(instagramAccountId, creationId, accessToken) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const response = await fetch(
    `${META_BASE_URL}/${instagramAccountId}/media_publish`,
    {
      method: "POST",
      body: params,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(
      `Failed to publish media: ${err.error?.message || response.status}`
    );
  }

  return response.json(); // { id: instagram_post_id }
}

/**
 * Schedule a post via Meta's Content Publishing API
 * Note: Meta requires the image to be publicly accessible at publish time
 * We store the scheduled time and use a cron job to publish at the right moment
 */
export async function schedulePost(instagramAccountId, imageUrl, caption, scheduledAt, accessToken) {
  // Meta Graph API doesn't support future scheduling directly for feed posts
  // We manage the queue ourselves and publish at the right time
  // Store everything needed, cron will call publishPost at scheduledAt

  return {
    instagramAccountId,
    imageUrl,
    caption,
    scheduledAt,
    status: "scheduled",
  };
}

/**
 * Actually publish a post to Instagram (called by scheduler at the right time)
 */
export async function publishPost(instagramAccountId, imageUrl, caption, accessToken) {
  // Step 1: Create container
  const creationId = await createMediaContainer(
    instagramAccountId,
    imageUrl,
    caption,
    accessToken
  );

  // Wait a moment for container to be ready
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 2: Publish
  const result = await publishMediaContainer(instagramAccountId, creationId, accessToken);

  return {
    instagramPostId: result.id,
    publishedAt: new Date().toISOString(),
  };
}

/**
 * Get basic account insights (follower count, etc.)
 */
export async function getAccountInsights(instagramAccountId, accessToken) {
  const response = await fetch(
    `${META_BASE_URL}/${instagramAccountId}?fields=name,biography,followers_count,media_count,profile_picture_url&access_token=${accessToken}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Instagram account insights");
  }

  return response.json();
}

/**
 * Validate that an access token is still valid
 */
export async function validateAccessToken(accessToken) {
  try {
    const response = await fetch(
      `${META_BASE_URL}/me?access_token=${accessToken}`
    );
    return response.ok;
  } catch {
    return false;
  }
}
