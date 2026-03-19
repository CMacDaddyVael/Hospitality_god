/**
 * Shared Stripe client — used by API routes.
 * Validates that required env vars are present at import time.
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  appInfo: {
    name: "Hospitality God",
    version: "1.0.0",
  },
});

/** Map price IDs to our internal tier names */
export const PRICE_TO_TIER = {
  [process.env.STRIPE_STARTER_PRICE_ID]: "starter",
  [process.env.STRIPE_PRO_PRICE_ID]: "pro",
};

/** Map tier names to Stripe price IDs */
export const TIER_TO_PRICE = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  pro: process.env.STRIPE_PRO_PRICE_ID,
};

export const PLANS = {
  starter: {
    name: "Starter",
    price: 99,
    description: "Up to 3 properties. Listing optimization, review management, guest comms, social content.",
    features: [
      "Up to 3 properties",
      "AI listing optimization",
      "Automated review responses",
      "Guest communication sequences",
      "Social content generation",
      "Performance dashboard",
    ],
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    name: "Pro",
    price: 199,
    description: "Unlimited properties. Full AI CMO suite with paid ads and competitive intelligence.",
    features: [
      "Unlimited properties",
      "Everything in Starter",
      "Paid ads management",
      "Competitive intelligence",
      "Direct booking website",
      "Priority support",
    ],
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
};
