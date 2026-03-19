/**
 * One-time script to create Stripe products and prices.
 * Run: node stripe/setup-products.mjs
 *
 * This creates:
 *   - Starter plan: $99/mo with 14-day trial
 *   - Pro plan: $199/mo with 14-day trial
 *
 * Outputs the price IDs to copy into .env
 */

import Stripe from "stripe";
import { config } from "dotenv";

config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

async function setup() {
  console.log("Setting up Stripe products and prices...\n");

  // ── Starter Plan ────────────────────────────────────────────────────────────
  const starterProduct = await stripe.products.create({
    name: "Hospitality God — Starter",
    description:
      "AI CMO for STR owners. Listing optimization, review management, guest communication, and social content for up to 3 properties.",
    metadata: {
      tier: "starter",
      max_properties: "3",
    },
  });

  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 9900, // $99.00
    currency: "usd",
    recurring: {
      interval: "month",
      trial_period_days: 14,
    },
    metadata: {
      tier: "starter",
    },
  });

  console.log("✅ Starter Plan created");
  console.log(`   Product ID: ${starterProduct.id}`);
  console.log(`   Price ID:   ${starterPrice.id}`);
  console.log(`   → STRIPE_STARTER_PRICE_ID=${starterPrice.id}\n`);

  // ── Pro Plan ────────────────────────────────────────────────────────────────
  const proProduct = await stripe.products.create({
    name: "Hospitality God — Pro",
    description:
      "Full AI CMO suite. Everything in Starter plus unlimited properties, paid ads management, competitive intelligence, and priority support.",
    metadata: {
      tier: "pro",
      max_properties: "unlimited",
    },
  });

  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 19900, // $199.00
    currency: "usd",
    recurring: {
      interval: "month",
      trial_period_days: 14,
    },
    metadata: {
      tier: "pro",
    },
  });

  console.log("✅ Pro Plan created");
  console.log(`   Product ID: ${proProduct.id}`);
  console.log(`   Price ID:   ${proPrice.id}`);
  console.log(`   → STRIPE_PRO_PRICE_ID=${proPrice.id}\n`);

  console.log("─────────────────────────────────────────────────────────────");
  console.log("Add these to your .env file:");
  console.log(`STRIPE_STARTER_PRICE_ID=${starterPrice.id}`);
  console.log(`STRIPE_PRO_PRICE_ID=${proPrice.id}`);
  console.log("─────────────────────────────────────────────────────────────");
}

setup().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
