/**
 * Airbnb message delivery via Playwright browser automation.
 * 
 * This is the scraping-based delivery layer used until Airbnb provides
 * an official messaging API. Handles session management, retry logic,
 * and error recovery.
 * 
 * NOTE: This requires @playwright/test to be installed and browsers to be
 * available. In production (Vercel), this runs in a separate worker service
 * with a Playwright-compatible environment (e.g., a Railway/Fly.io container).
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AIRBNB_BASE_URL = 'https://www.airbnb.com';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Send a message via Airbnb's messaging interface.
 * Uses stored session cookies for authentication.
 */
export async function sendAirbnbMessage({
  ownerId,
  threadId,
  message,
  scheduledMessageId,
}) {
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    try {
      const result = await attemptSendMessage({ ownerId, threadId, message });
      
      // Update scheduled message as sent
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          airbnb_message_id: result.messageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduledMessageId);

      console.log(`[AirbnbDelivery] Message sent successfully. Thread: ${threadId}`);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      lastError = error;
      attempt++;
      console.error(`[AirbnbDelivery] Attempt ${attempt} failed:`, error.message);

      // Update retry count
      await supabase
        .from('scheduled_messages')
        .update({
          retry_count: attempt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', scheduledMessageId);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt); // exponential backoff
      }
    }
  }

  // All retries exhausted — mark as failed
  await supabase
    .from('scheduled_messages')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: lastError?.message || 'Unknown error after max retries',
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduledMessageId);

  console.error(`[AirbnbDelivery] Failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return { success: false, error: lastError?.message };
}

/**
 * Core Playwright automation to send a message via Airbnb web.
 * This function handles the actual browser interaction.
 */
async function attemptSendMessage({ ownerId, threadId, message }) {
  // Dynamic import of playwright — only available in worker environment
  let chromium, Browser;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (err) {
    throw new Error('Playwright not available in this environment. Message delivery requires worker service.');
  }

  // Retrieve session cookies for this owner
  const { data: sessionData } = await supabase
    .from('airbnb_sessions')
    .select('cookies, user_agent')
    .eq('owner_id', ownerId)
    .eq('status', 'active')
    .single();

  if (!sessionData?.cookies) {
    throw new Error('No active Airbnb session found for owner. Please reconnect your Airbnb account.');
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    userAgent: sessionData.user_agent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });

  // Restore session cookies
  await context.addCookies(sessionData.cookies);

  const page = await context.newPage();

  try {
    // Navigate to the messaging thread
    const threadUrl = `${AIRBNB_BASE_URL}/messaging/inbox/${threadId}`;
    await page.goto(threadUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Check if we're still logged in
    const isLoggedIn = await checkLoginStatus(page);
    if (!isLoggedIn) {
      // Mark session as expired
      await supabase
        .from('airbnb_sessions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('owner_id', ownerId);
      
      throw new Error('Airbnb session expired. Please reconnect your account.');
    }

    // Find the message input area
    const messageInput = await page.waitForSelector(
      '[data-testid="message-input"], textarea[placeholder*="message"], [aria-label*="message"]',
      { timeout: 10000 }
    );

    if (!messageInput) {
      throw new Error('Could not find message input field on Airbnb');
    }

    // Clear existing content and type the message
    await messageInput.click();
    await messageInput.fill(message);

    // Small delay to ensure content is registered
    await sleep(500);

    // Find and click send button
    const sendButton = await page.waitForSelector(
      '[data-testid="send-message-button"], button[type="submit"], [aria-label="Send"]',
      { timeout: 5000 }
    );

    if (!sendButton) {
      throw new Error('Could not find send button on Airbnb');
    }

    await sendButton.click();

    // Wait for message to appear in thread (confirmation)
    await page.waitForTimeout(2000);

    // Try to extract the message ID from the response/DOM
    const messageId = await extractLastMessageId(page);

    // Update session last verified time
    await supabase
      .from('airbnb_sessions')
      .update({ 
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', ownerId);

    return { messageId: messageId || `sent-${Date.now()}` };

  } finally {
    await browser.close();
  }
}

/**
 * Check if the current page indicates the user is logged in.
 */
async function checkLoginStatus(page) {
  try {
    // If redirected to login page, we're not logged in
    const url = page.url();
    if (url.includes('/login') || url.includes('/authenticate')) {
      return false;
    }

    // Check for user-specific elements
    const hasUserMenu = await page.$('[data-testid="header-profile-button"], [aria-label*="Profile"]');
    return !!hasUserMenu;
  } catch {
    return false;
  }
}

/**
 * Try to extract the ID of the last sent message from the thread.
 */
async function extractLastMessageId(page) {
  try {
    // Try to get message IDs from the DOM
    const messages = await page.$$('[data-message-id], [data-testid*="message"]');
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      return await lastMessage.getAttribute('data-message-id') || null;
    }
  } catch {
    // Not critical if we can't get the ID
  }
  return null;
}

/**
 * Verify that a stored Airbnb session is still valid.
 * Called periodically to detect session expiry before delivery attempts.
 */
export async function verifyAirbnbSession(ownerId) {
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch {
    return { valid: false, error: 'Playwright not available' };
  }

  const { data: sessionData } = await supabase
    .from('airbnb_sessions')
    .select('cookies, user_agent')
    .eq('owner_id', ownerId)
    .single();

  if (!sessionData?.cookies) {
    return { valid: false, error: 'No session found' };
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ userAgent: sessionData.user_agent });
  await context.addCookies(sessionData.cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${AIRBNB_BASE_URL}/hosting`, { waitUntil: 'networkidle', timeout: 20000 });
    const isValid = await checkLoginStatus(page);

    await supabase
      .from('airbnb_sessions')
      .update({
        status: isValid ? 'active' : 'expired',
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('owner_id', ownerId);

    return { valid: isValid };
  } catch (err) {
    return { valid: false, error: err.message };
  } finally {
    await browser.close();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
