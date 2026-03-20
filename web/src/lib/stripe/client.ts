/**
 * Stripe Node.js client — server-side only.
 *
 * Import this module only from API routes and server components.
 * It must never be imported from client-side code because it references
 * STRIPE_SECRET_KEY which must remain secret.
 */

import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    'STRIPE_SECRET_KEY is not set. ' +
      'Copy .env.example to .env.local and add your Stripe test key. ' +
      'See docs/stripe-setup.md for full setup instructions.'
  )
}

/**
 * Singleton Stripe client instance.
 *
 * Uses the API version pinned here so upgrades are deliberate and
 * reviewed rather than automatic.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
  // Telemetry is disabled so Stripe doesn't receive our user-agent string.
  telemetry: false,
})

export default stripe
