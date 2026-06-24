-- ============================================================
-- smudgeGAMES — Playtime tracking (unlocks Muffin Clicker at 30 min)
-- Run ONCE in Supabase → SQL Editor → New query → Run.
-- ============================================================

-- total seconds this player has spent on the site
alter table profiles add column if not exists playtime_seconds integer not null default 0;

-- add playtime safely. Capped at 90s per call so nobody can fake huge time
-- (the app calls this every 15 seconds while the tab is open).
create or replace function add_playtime(p_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare add integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;
  add := greatest(0, least(p_seconds, 90));
  update profiles set playtime_seconds = playtime_seconds + add where id = auth.uid();
  return (select playtime_seconds from profiles where id = auth.uid());
end;
$$;

grant execute on function add_playtime(integer) to authenticated;
