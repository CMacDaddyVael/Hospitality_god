# Stripe Setup Guide

This document explains how to create the required Stripe products and prices
for VAEL Host, configure webhooks for local development and production, and
wire the resulting IDs into your environment.

> **Prerequisite:** A Stripe account at [stripe.com](https://stripe.com).  
> All steps below use the **test mode** dashboard unless otherwise noted.
> Repeat the same steps in **live mode** before launching to real customers.

---

## 1. Install the Stripe CLI (local development only)

The Stripe CLI lets you forward webhook events to your local machine.

```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# Linux / Windows: https://stripe.com/docs/stripe-cli#install
```

Log in once:

```bash
stripe login
```

---

## 2. Create the Pro Tier Product & Price ($49/mo)

### Via the Stripe Dashboard (recommended for first-time setup)

1. Go to [dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** `VAEL Host Pro`
   - **Description:** `Daily/weekly AI-generated content, listing optimization, review responses, and social posts for STR owners.`
   - **Image:** *(optional — upload your logo)*
4. Under **Pricing**, choose:
   - **Pricing model:** Standard pricing
   - **Price:** `$49.00`
   - **Billing period:** Monthly
   - **Currency:** USD
5. Click **"Save product"**
6. On the product page, copy the **Price ID** — it starts with `price_` (e.g., `price_1AbCdEfGhIjKlMnO`)
7. Paste it into `.env.local` as `STRIPE_PRO_PRICE_ID`

### Via the Stripe CLI (scriptable)

```bash
# Create the product
stripe products create \
  --name="VAEL Host Pro" \
  --description="AI CMO for short-term rental owners — $49/mo"

# Note the product ID (prod_...) from the output, then create a price:
stripe prices create \
  --unit-amount=4900 \
  --currency=usd \
  --recurring[interval]=month \
  --product=prod_YOUR_PRODUCT_ID_HERE

# The output will include the price ID (price_...) — copy it to .env.local
```

---

## 3. Create the Autopilot Tier Product & Price ($149/mo — placeholder)

This product is **not yet sold** but is created now so the codebase can
reference it when the tier launches.

### Via the Stripe Dashboard

1. Go to [dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** `VAEL Host Autopilot`
   - **Description:** `Full AI execution tier — coming soon. Agent acts directly on your listings (requires API access). $149/mo.`
4. Under **Pricing**:
   - **Price:** `$149.00`
   - **Billing period:** Monthly
   - **Currency:** USD
5. Click **"Save product"**
6. Copy the **Price ID** and paste it into `.env.local` as `STRIPE_AUTOPILOT_PRICE_ID`

### Via the Stripe CLI

```bash
stripe products create \
  --name="VAEL Host Autopilot" \
  --description="Full AI execution tier — coming soon"

stripe prices create \
  --unit-amount=14900 \
  --currency=usd \
  --recurring[interval]=month \
  --product=prod_YOUR_AUTOPILOT_PRODUCT_ID_HERE
```

---

## 4. Configure Webhooks

Webhooks let Stripe notify your app when events occur (e.g., subscription
created, payment failed). VAEL Host listens on `/api/webhooks/stripe`.

### Local Development (Stripe CLI forwarding)

In a separate terminal, run:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

You'll see output like:

```
> Ready! Your webhook signing secret is whsec_abcdef1234567890...  (^C to quit)
```

Copy that `whsec_...` value and set it in `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_abcdef1234567890...
```

Keep this terminal running while you test checkout locally.

### Production (Vercel deployment)

1. Go to [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"+ Add endpoint"**
3. Set **Endpoint URL** to:
   ```
   https://your-vercel-app.vercel.app/api/webhooks/stripe
   ```
   Replace `your-vercel-app` with your actual Vercel project subdomain.
4. Under **"Select events to listen to"**, add at minimum:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **"Add endpoint"**
6. On the endpoint detail page, click **"Reveal"** under **Signing secret**
7. Copy the `whsec_...` value and add it as `STRIPE_WEBHOOK_SECRET` in your
   Vercel project environment variables:
   - [vercel.com](https://vercel.com) → your project → **Settings** → **Environment Variables**

> **Note:** Repeat steps 1–7 in **live mode** (toggle at top-left of Stripe
> Dashboard) before accepting real payments, using your production Vercel URL.

---

## 5. Verify Your `.env.local`

After completing the steps above, your `.env.local` should have these Stripe
variables set (no placeholder values):

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AUTOPILOT_PRICE_ID=price_...
```

---

## 6. Test the Checkout Flow

1. Start the dev server: `cd web && npm run dev`
2. Start the Stripe CLI listener (separate terminal):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. Navigate to the plan selection step in the onboarding wizard
4. Select the **Pro** plan and proceed to checkout
5. On the Stripe-hosted checkout page, use the test card:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/29`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `90210`)
6. Complete the purchase — you should be redirected to the success page
7. In the Stripe CLI terminal, confirm you see:
   ```
   --> checkout.session.completed [evt_...]
   ```

### Other Useful Test Cards

| Scenario | Card Number |
|---|---|
| Successful payment | `4242 4242 4242 4242` |
| Authentication required (3D Secure) | `4000 0025 0000 3155` |
| Card declined | `4000 0000 0000 9995` |
| Insufficient funds | `4000 0000 0000 9995` |

Full list: [stripe.com/docs/testing#cards](https://stripe.com/docs/testing#cards)

---

## 7. Going Live

When you're ready to accept real payments:

1. Toggle the Stripe Dashboard to **Live mode**
2. Repeat steps 2–4 above in live mode to create live products/prices and a live webhook
3. Get your **live** API keys from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
4. Update your Vercel production environment variables with the live keys:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
   - `STRIPE_WEBHOOK_SECRET` → `whsec_...` (from live webhook endpoint)
   - `STRIPE_PRO_PRICE_ID` → live `price_...`
   - `STRIPE_AUTOPILOT_PRICE_ID` → live `price_...`
5. Redeploy on Vercel — live payments are now active

> ⚠️ **Never mix test and live keys.** Test keys will silently fail on live
> checkouts and vice versa.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No such price` error on checkout | Verify `STRIPE_PRO_PRICE_ID` matches the price ID in your Stripe test dashboard |
| Webhook signature verification failed | Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen` output (local) or the dashboard endpoint (production) |
| Checkout redirects to an error page | Check that `NEXT_PUBLIC_APP_URL` is set correctly (no trailing slash) |
| CLI says "not authenticated" | Run `stripe login` again |
| Events not reaching local server | Confirm `stripe listen` terminal is running and the port matches your dev server |
