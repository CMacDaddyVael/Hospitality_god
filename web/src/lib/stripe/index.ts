/**
 * Public barrel export for the Stripe library.
 *
 * Import Stripe utilities from '@/lib/stripe' (this file) rather than
 * from the individual modules so internal paths can be refactored without
 * touching every call site.
 */

export { stripe } from './client'
export {
  STRIPE_PRICE_IDS,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  APP_BASE_URL,
  HANDLED_WEBHOOK_EVENTS,
  assertStripeEnv,
  getPriceId,
} from './config'
export type { StripePlan, HandledWebhookEvent } from './config'
