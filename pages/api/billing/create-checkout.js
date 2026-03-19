/**
 * POST /api/billing/create-checkout
 *
 * Creates a Stripe Checkout session for the selected plan.
 * Requires the user to be authenticated (Supabase session cookie).
 *
 * Body: { plan: 'starter' | 'pro' }
 * Returns: { url: string }  — redirect to Stripe Checkout
 */

import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { stripe, TIER_TO_PRICE, PLANS } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: "Unauthorized — please log in" });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  // ── Validate plan ─────────────────────────────────────────────────────────
  const { plan } = req.body;

  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: "Invalid plan. Must be 'starter' or 'pro'." });
  }

  const priceId = TIER_TO_PRICE[plan];
  if (!priceId) {
    return res.status(500).json({ error: `Price ID not configured for plan: ${plan}` });
  }

  try {
    // ── Get or create Stripe customer ────────────────────────────────────────
    let stripeCustomerId = null;

    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", userId)
      .single();

    if (existingSub?.stripe_customer_id) {
      stripeCustomerId = existingSub.stripe_customer_id;

      // If they already have an active/trialing subscription, redirect to portal instead
      if (
        existingSub.stripe_subscription_id &&
        ["active", "trialing"].includes(existingSub.status)
      ) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: stripeCustomerId,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings/billing`,
        });
        return res.status(200).json({ url: portalSession.url });
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId },
      });
      stripeCustomerId = customer.id;
    }

    // ── Create Checkout session ───────────────────────────────────────────────
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          supabase_user_id: userId,
          plan,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings/billing?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings/billing?checkout=canceled`,
      allow_promotion_codes: true,
      metadata: {
        supabase_user_id: userId,
        plan,
      },
    });

    // ── Optimistically upsert subscription row (webhook will confirm) ────────
    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        plan,
        status: "trialing",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return res.status(200).json({ url: checkoutSession.url });
  } catch (err) {
    console.error("[create-checkout] Error:", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
