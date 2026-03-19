/**
 * useSubscription — React hook to fetch and cache the current user's subscription.
 *
 * Returns:
 *   subscription  — the row from the subscriptions table (or null)
 *   loading       — true while fetching
 *   error         — any fetch error
 *   refetch       — function to manually re-fetch
 */

import { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { hasActiveAccess, trialDaysRemaining } from "../lib/subscription";

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const supabase = createClientComponentClient();

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSubscription(null);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = row not found (new user, no subscription yet)
        throw fetchError;
      }

      setSubscription(data || null);
    } catch (err) {
      console.error("[useSubscription] Error:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    refetch: fetchSubscription,
    // Computed helpers
    hasAccess: hasActiveAccess(subscription),
    trialDaysLeft: trialDaysRemaining(subscription),
    isTrialing: subscription?.status === "trialing",
    isActive: subscription?.status === "active",
    plan: subscription?.plan || "none",
  };
}
