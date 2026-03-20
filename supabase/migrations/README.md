# VAEL Host — Supabase Migrations

This directory contains all database migrations for the VAEL Host platform,
applied in filename order via `supabase db push`.

---

## Running Migrations

### Against a fresh Supabase project
```bash
# One-time setup
supabase login
supabase link --project-ref <your-project-ref>

# Apply all pending migrations
supabase db push
```

### Local development
```bash
# Start local Supabase stack (Docker required)
supabase start

# Apply migrations to the local DB
supabase db reset        # wipe + replay all migrations
# or
supabase db push         # apply only new migrations
```

---

## Migration Index

| File | Description |
|------|-------------|
| `20260320000001_core_schema.sql` | Initial schema — users, listings, audits, audit_scores, deliverables |

---

## Table Reference

### `public.users`
Extends `auth.users` with VAEL-specific profile data.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Same UUID as `auth.users.id` |
| `email` | text | Unique. Mirrors auth email. |
| `full_name` | text | Owner display name |
| `tier` | text | `free` \| `pro` \| `autopilot` |
| `stripe_customer_id` | text | Stripe customer record |
| `stripe_subscription_id` | text | Active Stripe subscription |
| `preferences` | jsonb | Voice calibration, swarm settings |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

**RLS:** Users can only SELECT/UPDATE/INSERT their own row (`auth.uid() = id`).

---

### `public.listings`
One row per property URL connected by an owner.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Owner |
| `platform` | enum | `airbnb` \| `vrbo` |
| `url` | text | Canonical listing URL. Unique per user. |
| `raw_data` | jsonb | Full scraper output (title, description, photos, reviews…) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

**RLS:** Full CRUD restricted to the owning user.

---

### `public.audits`
One audit run per listing (there can be many over time).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `listing_id` | uuid FK → listings | |
| `status` | enum | `pending` \| `complete` \| `failed` |
| `overall_score` | integer | 0–100. NULL while pending. |
| `claude_summary` | text | Markdown narrative from Claude |
| `claude_raw` | jsonb | Raw Claude API envelope for debugging |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

**RLS:** Accessible only if `auth.uid()` owns the parent listing.

---

### `public.audit_scores`
Per-category score breakdown rows for a single audit.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `audit_id` | uuid FK → audits | |
| `category` | varchar(100) | e.g. `photos`, `title`, `amenities`, `reviews` |
| `score` | integer | Points awarded (0…max_score) |
| `max_score` | integer | Max points for this category |
| `notes` | text | Human-readable feedback from scoring engine |
| `created_at` | timestamptz | |

**Category weights (reference):**

| Category | max_score |
|----------|-----------|
| photos | 30 |
| title | 15 |
| description | 15 |
| amenities | 15 |
| reviews | 15 |
| pricing | 10 |

**RLS:** Accessible only if `auth.uid()` owns the ancestor listing (via audit → listing → user).

---

### `public.deliverables`
AI-generated content items waiting for owner review in the dashboard.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK → users | Owner |
| `listing_id` | uuid FK → listings | Nullable — some deliverables aren't listing-specific |
| `type` | enum | `listing_copy` \| `review_response` \| `social_post` \| `seasonal` |
| `status` | enum | `pending` \| `approved` \| `dismissed` |
| `content` | jsonb | Type-specific payload (see below) |
| `audit_id` | uuid FK → audits | Nullable — traceability link |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-updated by trigger |

**`content` shape by type:**

```jsonc
// listing_copy
{ "title": "...", "description": "...", "tags": ["..."] }

// review_response
{ "review_id": "...", "original_review": "...", "response_text": "..." }

// social_post
{ "caption": "...", "hashtags": ["..."], "image_brief": "...", "platform": "instagram" }

// seasonal
{ "season": "winter", "copy_updates": { "title": "...", "description": "..." }, "image_prompts": ["..."] }
```

**RLS:** Full CRUD restricted to the owning user (`auth.uid() = user_id`).

---

## Architecture Notes

### Row-Level Security
RLS is **enabled on every table**. The Supabase client running in the browser
always operates as the authenticated user — cross-user data leakage is
prevented at the database level, not just in application code.

Background services (scraper, scoring engine, Claude pipeline) use the
**service role key** (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS.
Never expose the service role key to the browser or mobile client.

### Post-Signup Trigger
`auth.users → public.users` is kept in sync by the
`on_auth_user_created` trigger. Whenever Supabase Auth creates a new user
(email sign-up, Google OAuth, magic link), a matching row is inserted into
`public.users` automatically — application code doesn't need to do this
manually.

### `updated_at` Trigger
All mutable tables have a `BEFORE UPDATE` trigger that sets `updated_at =
now()` automatically. Application code never needs to set this field.
