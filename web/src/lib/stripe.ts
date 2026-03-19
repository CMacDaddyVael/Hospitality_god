/**
 * Client-side Stripe utilities.
 * Server-side operations are handled in API routes.
 */

/**
 * Initiate the Stripe Checkout flow from the client.
 * Creates a session server-side, then redirects to Stripe-hosted checkout.
 */
export async function startProCheckout({
  userId,
  email,
  auditId,
}: {
  userId: string
  email: string
  auditId?: string
}): Promise<void> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, auditId }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Failed to start checkout')
  }

  if (!data.url) {
    throw new Error('No checkout URL returned')
  }

  // Hard redirect to Stripe Checkout
  window.location.href = data.url
}

/**
 * Open the Stripe Billing Portal for subscription management/cancellation.
 */
export async function openBillingPortal(userId: string): Promise<void> {
  const res = await fetch('/api/stripe/billing-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'Failed to open billing portal')
  }

  if (!data.url) {
    throw new Error('No billing portal URL returned')
  }

  window.location.href = data.url
}
