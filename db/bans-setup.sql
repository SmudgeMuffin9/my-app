-- ============================================================
-- smudgeGAMES — "real ban" setup
-- Run this ONCE in Supabase → SQL Editor → New query → Run.
-- It makes banned usernames unable to post scores (enforced by
-- the database itself, not just the front-end button).
-- ============================================================

-- 1) A list of banned usernames.
create table if not exists bans (
  username   text primary key,
  created_at timestamptz default now()
);

-- 2) Turn on Row Level Security (so the rules below actually apply).
alter table bans enable row level security;

-- 3) Anyone can READ the ban list. The score rules below need to read it
--    to check whether the current player is banned.
create policy "bans are public read"
  on bans for select
  using (true);

-- 4) Only the owner (smudgemuffin) can ADD a ban.
--    lower() makes the check ignore capitalization (the username is stored as
--    SMUDGEMUFFIN), matching how the front-end owner check works.
create policy "owner can ban"
  on bans for insert
  with check (
    lower((select username from profiles where id = auth.uid())) = 'smudgemuffin'
  );

-- 5) Only the owner can REMOVE a ban (un-ban someone).
create policy "owner can unban"
  on bans for delete
  using (
    lower((select username from profiles where id = auth.uid())) = 'smudgemuffin'
  );

-- 6) RESTRICTIVE rules = AND'd on top of your existing score rules.
--    A banned player can no longer INSERT or UPDATE a score.
--    (They can still read leaderboards; the owner can still delete their stuff.)
create policy "banned cannot insert scores"
  on scores as restrictive for insert
  with check (
    (select username from profiles where id = auth.uid()) not in (select username from bans)
  );

create policy "banned cannot update scores"
  on scores as restrictive for update
  using (
    (select username from profiles where id = auth.uid()) not in (select username from bans)
  );
