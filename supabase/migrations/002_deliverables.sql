-- Migration: 002_deliverables
-- Creates the deliverables table for storing generated content batches
-- including lifestyle image sets produced by the image generation pipeline.

-- Deliverables table
create table if not exists public.deliverables (
  id                text        primary key,
  subscriber_id     text        not null,
  type              text        not null,           -- e.g. 'lifestyle_images', 'social_post', 'listing_rewrite'
  status            text        not null default 'pending',  -- 'pending' | 'ready' | 'failed'
  image_urls        text[]      not null default '{}',
  error_message     text        null,
  metadata          jsonb       null,               -- flexible slot for future fields
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Index for querying by subscriber
create index if not exists deliverables_subscriber_id_idx
  on public.deliverables (subscriber_id);

-- Index for querying by type + status (dashboard queries)
create index if not exists deliverables_type_status_idx
  on public.deliverables (type, status);

-- Row-level security: subscribers can only see their own deliverables
alter table public.deliverables enable row level security;

create policy "Subscribers see own deliverables"
  on public.deliverables
  for select
  using (auth.uid()::text = subscriber_id);

-- Service role bypasses RLS (used by the generation pipeline)
-- No additional policy needed — service role key bypasses RLS by default.

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deliverables_updated_at
  before update on public.deliverables
  for each row
  execute procedure public.set_updated_at();

-- Storage bucket (run once manually or via Supabase dashboard)
-- insert into storage.buckets (id, name, public)
-- values ('listing-images', 'listing-images', true)
-- on conflict (id) do nothing;

-- Storage policy: public read on listing-images bucket
-- (create via Supabase dashboard or CLI — SQL policies for storage use a different system)
