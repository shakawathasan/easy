-- SohoJ Clinic — Supabase backend schema (Phase 1: backend wiring)
-- Paste this whole file into Supabase SQL Editor and click "Run".

-- 1. Generic document store, mirrors the app's existing col()/addDoc()/updateDoc() shape
create table if not exists docs (
  collection   text not null,
  id           text not null,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists docs_collection_idx on docs (collection);

-- keep updated_at fresh on every write
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists docs_set_updated_at on docs;
create trigger docs_set_updated_at
  before update on docs
  for each row execute function set_updated_at();

-- 2. Enable Row Level Security
alter table docs enable row level security;

-- Phase-1 policy: anon key can read/write everything.
-- NOTE (security): this is intentionally permissive for now so we can get
-- real-time multi-device sync working end-to-end. It matches your current
-- app's security model (PINs and roles are checked in the browser, not the
-- database) but it is NOT production-safe — anyone with your anon key could
-- read/edit the queue directly via the API. We'll tighten this in the
-- Security phase (item 25) once real auth (Supabase Auth, one account per
-- doctor/receptionist/admin) is wired in, and split sensitive collections
-- (precheck, reports) behind auth-gated policies.
create policy "phase1_anon_all" on docs
  for all
  to anon
  using (true)
  with check (true);

-- 3. Enable realtime on this table
alter publication supabase_realtime add table docs;
