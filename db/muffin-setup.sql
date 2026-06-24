-- ============================================================
-- smudgeGAMES — Muffin Clicker save data
-- Run ONCE in Supabase → SQL Editor → New query → Run.
-- One row per player holds their muffin count + buildings, so the
-- game remembers progress across refreshes. Single-player data, so
-- each player can only read/write their OWN save.
-- ============================================================

create table if not exists muffin_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  muffins    numeric not null default 0,
  buildings  jsonb   not null default '{}'::jsonb,
  upgrades   jsonb   not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- if the table already exists from an earlier version, add the upgrades column
alter table muffin_saves add column if not exists upgrades jsonb not null default '[]'::jsonb;

alter table muffin_saves enable row level security;
create policy "own muffin save read"   on muffin_saves for select using (user_id = auth.uid());
create policy "own muffin save insert" on muffin_saves for insert with check (user_id = auth.uid());
create policy "own muffin save update" on muffin_saves for update using (user_id = auth.uid());
