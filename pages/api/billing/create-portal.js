/**
 * POST /api/billing/create-portal
 *
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription, update payment method, or cancel.
 *
 * Returns: { url: string }
 */

import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = createServerSupabaseClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  try {
    // Look up Stripe customer ID
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    if (error || !sub?.stripe_customer_id) {
      return res.status(400).json({
        error: "No billing account found. Please start a subscription first.",
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/settings/billing`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err) {
    console.error("[create-portal] Error:", err);
    return res.status(500).json({ error: "Failed to create portal session" });
  }
}
