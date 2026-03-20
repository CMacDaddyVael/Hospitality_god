-- Migration: 002_guest_templates_deliverable
-- Creates the deliverables table (if not already present) and adds
-- the unique constraint needed for upsert-based regeneration of guest templates.
--
-- This is additive — it does not touch any existing table or schema.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. deliverables table
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.deliverables (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  listing_id    text,
  type          text not null,           -- e.g. 'guest_templates', 'listing_copy', etc.
  status        text not null default 'pending_review',
                                         -- pending_review | approved | archived
  payload       jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Unique constraint — one active deliverable per (user, listing, type)
--    Enables the upsert pattern used in saveGuestTemplatesDeliverable()
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from   pg_constraint
    where  conname = 'deliverables_user_listing_type_unique'
  ) then
    alter table public.deliverables
      add constraint deliverables_user_listing_type_unique
      unique (user_id, listing_id, type);
  end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Index for fast dashboard lookups (fetch all deliverables for a user)
-- ──────────────────────────────────────────────────────────────────────────────
create index if not exists deliverables_user_id_idx
  on public.deliverables (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger (reuse pattern if trigger fn already exists)
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists deliverables_set_updated_at on public.deliverables;
create trigger deliverables_set_updated_at
  before update on public.deliverables
  for each row execute function public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Row-level security (owners can only see their own deliverables)
-- ──────────────────────────────────────────────────────────────────────────────
alter table public.deliverables enable row level security;

drop policy if exists "Users can read own deliverables" on public.deliverables;
create policy "Users can read own deliverables"
  on public.deliverables for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own deliverables" on public.deliverables;
create policy "Users can update own deliverables"
  on public.deliverables for update
  using (auth.uid() = user_id);

drop policy if exists "Service role can insert deliverables" on public.deliverables;
create policy "Service role can insert deliverables"
  on public.deliverables for insert
  with check (true);   -- server-side inserts use service_role key, bypass RLS
