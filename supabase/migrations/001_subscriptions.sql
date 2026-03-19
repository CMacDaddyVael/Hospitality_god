-- Subscriptions table
-- Tracks each user's Stripe subscription state, synced via webhook.

create table if not exists public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id  text unique,
  stripe_subscription_id text unique,
  plan                text not null default 'none',   -- 'none' | 'starter' | 'pro'
  status              text not null default 'trialing', -- mirrors Stripe status values
  trial_end           timestamptz,
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One subscription row per user
create unique index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- RLS: users can only read their own subscription row
alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role can do everything (webhooks use service role key)
create policy "Service role full access"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.handle_updated_at();
