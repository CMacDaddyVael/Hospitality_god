/**
 * Subscription helpers — pure functions used by both API routes and UI.
 */

/**
 * Returns true if the subscription grants full app access.
 * Active states: trialing (within trial), active (paid).
 */
export function hasActiveAccess(subscription) {
  if (!subscription) return false;

  const { status, trial_end } = subscription;

  if (status === "active") return true;

  if (status === "trialing") {
    // Double-check trial hasn't expired (Stripe should have updated this,
    // but guard against webhook delays)
    if (!trial_end) return true;
    return new Date(trial_end) > new Date();
  }

  return false;
}

/**
 * Returns how many trial days remain (0 if expired or not trialing).
 */
export function trialDaysRemaining(subscription) {
  if (!subscription || subscription.status !== "trialing") return 0;
  if (!subscription.trial_end) return 0;

  const msRemaining = new Date(subscription.trial_end) - new Date();
  if (msRemaining <= 0) return 0;

  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

/**
 * Human-readable status label for the billing page.
 */
export function subscriptionStatusLabel(subscription) {
  if (!subscription) return "No subscription";

  switch (subscription.status) {
    case "trialing": {
      const days = trialDaysRemaining(subscription);
      return days > 0 ? `Free trial — ${days} day${days !== 1 ? "s" : ""} remaining` : "Trial expired";
    }
    case "active":
      return subscription.cancel_at_period_end ? "Active (cancels at period end)" : "Active";
    case "past_due":
      return "Past due — payment required";
    case "canceled":
      return "Canceled";
    case "unpaid":
      return "Unpaid — payment required";
    case "paused":
      return "Paused";
    default:
      return subscription.status;
  }
}

/**
 * Format a date for display.
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
