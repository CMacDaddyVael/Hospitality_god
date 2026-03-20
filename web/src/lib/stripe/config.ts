/**
 * Stripe configuration and environment validation.
 *
 * This module centralises all Stripe-related environment variable access
 * so that misconfiguration fails loudly at startup rather than silently
 * at checkout time.
 *
 * Import individual exports — do NOT import the Stripe client here;
 * that lives in web/src/lib/stripe/client.ts to keep server-only code
 * separated from this config module.
 */

// ---------------------------------------------------------------------------
// Price ID map
// ---------------------------------------------------------------------------

/**
 * Map of plan name → Stripe Price ID.
 * Values come from environment variables so they work in both test and live
 * environments without code changes.
 */
export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
  autopilot: process.env.STRIPE_AUTOPILOT_PRICE_ID ?? '',
} as const

export type StripePlan = keyof typeof STRIPE_PRICE_IDS

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Validates that all required Stripe environment variables are present.
 * Call this from server-side code that initialises Stripe (e.g., the
 * checkout route) to surface missing config early.
 *
 * @throws {Error} if any required variable is missing
 */
export function assertStripeEnv(): void {
  const required: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID,
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Missing required Stripe environment variables: ${missing.join(', ')}. ` +
        'See .env.example and docs/stripe-setup.md for setup instructions.'
    )
  }
}

/**
 * Returns the Stripe Price ID for the given plan name.
 *
 * @throws {Error} if the plan is unknown or its price ID env var is not set
 */
export function getPriceId(plan: StripePlan): string {
  const priceId = STRIPE_PRICE_IDS[plan]

  if (!priceId) {
    throw new Error(
      `Stripe Price ID for plan "${plan}" is not configured. ` +
        `Set STRIPE_${plan.toUpperCase()}_PRICE_ID in your environment. ` +
        'See docs/stripe-setup.md for instructions.'
    )
  }

  return priceId
}

// ---------------------------------------------------------------------------
// Webhook events we care about
// ---------------------------------------------------------------------------

/**
 * The Stripe event types that the webhook handler should process.
 * Defined here so both the webhook registration docs and the handler
 * reference the same list.
 */
export const HANDLED_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
] as const

export type HandledWebhookEvent = (typeof HANDLED_WEBHOOK_EVENTS)[number]

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * Base URL for Stripe redirect URLs (success / cancel).
 * Falls back to localhost in development.
 */
export const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const STRIPE_SUCCESS_URL = `${APP_BASE_URL}/dashboard?checkout=success`
export const STRIPE_CANCEL_URL = `${APP_BASE_URL}/onboarding?checkout=cancelled`
