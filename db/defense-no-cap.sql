-- Removes the Smudge's payout cap for Tower Defense (normal + hardcore).
--
-- WHY: award_coins() used to cap EVERY game at 1500 per play. Tower Defense runs
-- can go very long, so a great run got its payout chopped at 1500. This gives
-- coin_rates a per-game `cap` column (default 1500 keeps every other game the
-- same) and sets Defense + Defense-hardcore to NULL = no cap.
--
-- SAFE TO RUN ANY TIME: column add is `if not exists`, the update is idempotent,
-- and the function is `create or replace`. No policies, so it won't stop partway
-- like re-running the whole shop-setup.sql would. Run once in Supabase → SQL Editor.

-- 1) add the per-game cap (every existing row defaults to the old 1500)
alter table coin_rates add column if not exists cap integer default 1500;

-- 2) Tower Defense pays with NO cap
update coin_rates set cap = null where game in ('defense', 'defense_hard');

-- 3) teach the cashier to use each game's own cap (NULL = uncapped)
create or replace function award_coins(p_game text, p_score integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       coin_rates%rowtype;
  earned  integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;

  select * into r from coin_rates where game = p_game;
  if not found then
    return (select coins from profiles where id = auth.uid());  -- game gives no coins
  end if;

  if r.lower_better then
    earned := floor((r.baseline - p_score) * r.rate);
  else
    earned := floor(p_score * r.rate);
  end if;

  earned := greatest(0, earned);                 -- never negative
  if r.cap is not null then
    earned := least(earned, r.cap);              -- apply this game's cap (NULL = uncapped)
  end if;

  update profiles set coins = coins + earned where id = auth.uid();
  return (select coins from profiles where id = auth.uid());
end;
$$;
