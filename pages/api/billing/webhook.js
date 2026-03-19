/**
 * POST /api/billing/webhook
 *
 * Receives Stripe webhook events and syncs subscription state to Supabase.
 *
 * Verified events handled:
 *   - checkout.session.completed
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 *
 * Security: Stripe-Signature header is verified against STRIPE_WEBHOOK_SECRET.
 * Raw body is required — Next.js bodyParser must be disabled for this route.
 */

import { stripe, PRICE_TO_TIER } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// Disable Next.js body parsing — we need the raw buffer for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

/** Read raw request body as a Buffer */
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Extract the tier/plan from a Stripe subscription object */
function getTierFromSubscription(subscription) {
  if (!subscription.items?.data?.length) return null;

  const priceId = subscription.items.data[0].price.id;
  return PRICE_TO_TIER[priceId] || null;
}

/** Upsert subscription row keyed by stripe_customer_id */
async function syncSubscription(subscription, customerId) {
  const tier = getTierFromSubscription(subscription);

  // Look up Supabase user by stripe_customer_id
  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!existing?.user_id) {
    // Try to find via customer metadata
    const customer = await stripe.customers.retrieve(customerId);
    const userId = customer.metadata?.supabase_user_id;

    if (!userId) {
      console.error(`[webhook] No user found for customer ${customerId}`);
      return;
    }

    await upsertByUserId(userId, customerId, subscription, tier);
    return;
  }

  await upsertByUserId(existing.user_id, customerId, subscription, tier);
}

async function upsertByUserId(userId, customerId, subscription, tier) {
  const payload = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan: tier || "none",
    status: subscription.status,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[webhook] Supabase upsert error:", error);
    throw error;
  }

  console.log(`[webhook] Synced subscription for user ${userId} — status: ${subscription.status}, plan: ${tier}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Verify Stripe signature ───────────────────────────────────────────────
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    console.warn("[webhook] Missing Stripe-Signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  console.log(`[webhook] Received event: ${event.type} (${event.id})`);

  // ── Handle events ─────────────────────────────────────────────────────────
  try {
    switch (event.type) {
      // Checkout completed — subscription is now created
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;

        // Subscription object is already in the event if expanded,
        // otherwise we fetch it from the subscription.created event below.
        // Just log for now; subscription.created handles the upsert.
        console.log(`[webhook] Checkout completed for customer ${session.customer}`);
        break;
      }

      // New subscription created (fires after checkout)
      case "customer.subscription.created": {
        const subscription = event.data.object;
        await syncSubscription(subscription, subscription.customer);
        break;
      }

      // Subscription changed (plan upgrade, trial → paid, cancellation scheduled, etc.)
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        await syncSubscription(subscription, subscription.customer);
        break;
      }

      // Subscription fully canceled
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        await syncSubscription(subscription, subscription.customer);
        break;
      }

      // Payment succeeded — subscription is active
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        await syncSubscription(subscription, invoice.customer);
        break;
      }

      // Payment failed — mark past_due
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );
        await syncSubscription(subscription, invoice.customer);
        break;
      }

      // Trial ending soon — could trigger email (future enhancement)
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object;
        console.log(
          `[webhook] Trial ending soon for customer ${subscription.customer} — ` +
          `ends ${new Date(subscription.trial_end * 1000).toISOString()}`
        );
        // TODO: trigger "trial ending" email via Resend/SendGrid
        break;
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[webhook] Error handling ${event.type}:`, err);
    // Return 500 so Stripe retries
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
