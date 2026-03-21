-- Migration: 002_subscribers_and_swarm_jobs
-- Creates the subscribers table and swarm_jobs queue table
-- needed by the Stripe webhook handler (Issue #221)
-- Additive only — does not modify existing tables.

-- ─── subscribers ─────────────────────────────────────────────────────────────
create table if not exists public.subscribers (
  id                      uuid primary key default gen_random_uuid(),
  stripe_customer_id      text not null unique,
  stripe_subscription_id  text,
  email                   text not null,
  plan                    text not null default 'pro',
  status                  text not null default 'active'
                            check (status in ('active', 'cancelled', 'past_due', 'inactive', 'trialing')),
  listing_url             text,
  session_id              text,       -- links back to onboarding session
  cancelled_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.subscribers is
  'One row per paying subscriber. Created/updated by the Stripe webhook handler.';

-- Indexes
create index if not exists subscribers_email_idx
  on public.subscribers (email);

create index if not exists subscribers_status_idx
  on public.subscribers (status);

create index if not exists subscribers_session_id_idx
  on public.subscribers (session_id);

-- ─── swarm_jobs ──────────────────────────────────────────────────────────────
create table if not exists public.swarm_jobs (
  id                  uuid primary key default gen_random_uuid(),
  subscriber_id       uuid references public.subscribers (id) on delete cascade,
  stripe_customer_id  text not null,
  email               text not null,
  listing_url         text,
  plan                text not null default 'pro',
  job_type            text not null,   -- e.g. 'initial_swarm_run', 'weekly_brief', 'social_content'
  status              text not null default 'queued'
                        check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority            integer not null default 5,  -- higher = more urgent
  payload             jsonb,
  result              jsonb,
  error               text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.swarm_jobs is
  'Queue of swarm jobs to be processed by the agent dispatcher. Written by the webhook, consumed by the swarm.';

-- Indexes
create index if not exists swarm_jobs_status_priority_idx
  on public.swarm_jobs (status, priority desc, created_at asc);

create index if not exists swarm_jobs_stripe_customer_id_idx
  on public.swarm_jobs (stripe_customer_id);

create index if not exists swarm_jobs_subscriber_id_idx
  on public.swarm_jobs (subscriber_id);

create index if not exists swarm_jobs_type_status_idx
  on public.swarm_jobs (job_type, status);

-- ─── Row-level security ───────────────────────────────────────────────────────
-- Enable RLS so these tables are not publicly readable.
-- The webhook uses the service role key, which bypasses RLS.

alter table public.subscribers enable row level security;
alter table public.swarm_jobs enable row level security;

-- Service role (webhook, backend scripts) has full access.
-- No additional policies needed for the MVP — subscribers
-- are managed exclusively by the backend, not by end users directly.

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscribers_updated_at on public.subscribers;
create trigger subscribers_updated_at
  before update on public.subscribers
  for each row execute function public.set_updated_at();

drop trigger if exists swarm_jobs_updated_at on public.swarm_jobs;
create trigger swarm_jobs_updated_at
  before update on public.swarm_jobs
  for each row execute function public.set_updated_at();
