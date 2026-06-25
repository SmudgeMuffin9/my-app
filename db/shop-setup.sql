-- ============================================================
-- smudgeGAMES — Shop / "Smudge's" economy setup
-- Run ONCE in Supabase → SQL Editor → New query → Run.
--
-- Big idea: players can NEVER change their own coin balance directly.
-- All coin changes go through two "cashier" functions below
-- (award_coins / buy_game) which run with owner powers and do the
-- math safely on the server. That's what stops cheating.
-- ============================================================

-- 1) WALLET: every player gets a coin balance on their profile.
--    (profiles has no UPDATE policy for players, so they can't edit this
--    directly — only the cashier functions can.)
alter table profiles add column if not exists coins integer not null default 0;

-- 2) SHOP CATALOG: which games are buyable, and their price in Smudge's.
create table if not exists game_prices (
  game  text primary key,
  price integer not null
);
insert into game_prices (game, price) values
  ('shoot',    1500),
  ('snake',    4000),
  ('gravity',  9000),
  ('smudge',  20000),
  ('split',   40000)
on conflict (game) do update set price = excluded.price;

alter table game_prices enable row level security;
create policy "prices are public read" on game_prices for select using (true);

-- 3) OWNED GAMES: one row per (player, game) they've unlocked.
create table if not exists unlocks (
  user_id    uuid references auth.users(id) on delete cascade,
  game       text,
  created_at timestamptz default now(),
  primary key (user_id, game)
);
alter table unlocks enable row level security;
create policy "see my own unlocks" on unlocks for select using (user_id = auth.uid());
-- (no INSERT policy on purpose — only buy_game() can add unlocks)
-- owner powers: the owner can SEE and REMOVE any player's purchased games
-- (used by the 🔨 Players admin page to show game chips + remove them)
create policy "owner sees all unlocks" on unlocks for select
  using (lower((select username from profiles where id = auth.uid())) = 'smudgemuffin');
create policy "owner removes unlocks" on unlocks for delete
  using (lower((select username from profiles where id = auth.uid())) = 'smudgemuffin');
-- owner can GIVE any player any game (the 🎁 button on the Players admin page)
create policy "owner adds unlocks" on unlocks for insert
  with check (lower((select username from profiles where id = auth.uid())) = 'smudgemuffin');

-- 4) EXCHANGE RATES: how a game's score turns into Smudge's.
--    rate = coins per point. lower_better games (smaller score = better)
--    use baseline: coins = (baseline - score) * rate.
create table if not exists coin_rates (
  game         text primary key,
  rate         numeric not null,
  lower_better boolean not null default false,
  baseline     integer not null default 0
);
-- pricier games pay more, but everything pays less now (longer grind)
insert into coin_rates (game, rate, lower_better, baseline) values
  ('cps',       0.8, false, 0),    -- free   ~50
  ('whack',     3.3, false, 0),    -- free   ~50
  ('guess',     6.0, true,  12),   -- free   ~50  (4 guesses -> 48)
  ('reaction',  0.15, true, 600),  -- free   ~50  (250ms -> 52)
  ('shoot',     0.3, false, 0),    -- 1500   ~100 (scores run ~325, so low rate)
  ('snake',    10.0, false, 0),    -- 4000   ~150
  ('gravity',   1.5, false, 0),    -- 9000   ~225
  ('smudge',   16.0, false, 0),    -- 20000  ~325
  ('split',     3.0, false, 0),    -- 40000  ~450
  ('survivor',  1.5, false, 0),    -- free   ~60  (kills × 1.5, ~40 kills -> 60)
  ('defense',   8.0, false, 0),    -- free   ~64  (waves × 8, ~8 waves -> 64)
  ('defense_hard', 24.0, false, 0) -- hardcore Defense: 3× normal rate, separate leaderboard
on conflict (game) do update
  set rate = excluded.rate, lower_better = excluded.lower_better, baseline = excluded.baseline;

alter table coin_rates enable row level security;
create policy "rates are public read" on coin_rates for select using (true);

-- 5) CASHIER #1 — award_coins: the ONLY way to gain coins.
--    Computes the payout on the server, capped at 250 per play.
create or replace function award_coins(p_game text, p_score integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       coin_rates%rowtype;
  earned  integer;
  cap     integer := 1500;
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

  earned := greatest(0, least(earned, cap));  -- never negative, never above the cap
  update profiles set coins = coins + earned where id = auth.uid();
  return (select coins from profiles where id = auth.uid());
end;
$$;

-- 6) CASHIER #2 — buy_game: the ONLY way to spend coins.
--    Checks price + balance, subtracts, and unlocks — all in one safe step.
create or replace function buy_game(p_game text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p   integer;
  bal integer;
begin
  if auth.uid() is null then raise exception 'not logged in'; end if;

  select price into p from game_prices where game = p_game;
  if p is null then return 'not for sale'; end if;

  if exists (select 1 from unlocks where user_id = auth.uid() and game = p_game) then
    return 'already owned';
  end if;

  select coins into bal from profiles where id = auth.uid();
  if bal < p then return 'not enough'; end if;

  update profiles set coins = coins - p where id = auth.uid();
  insert into unlocks (user_id, game) values (auth.uid(), p_game);
  return 'ok';
end;
$$;

-- 7) CASHIER #3 — set_coins: OWNER-ONLY. Set any player's balance to an exact
--    amount (for the owner Players admin page). lower() so the owner check
--    works against the SMUDGEMUFFIN (caps) username.
create or replace function set_coins(p_username text, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  if lower((select username from profiles where id = auth.uid())) <> 'smudgemuffin' then
    raise exception 'only the owner can set coins';
  end if;
  if p_amount < 0 then raise exception 'coins cannot be negative'; end if;

  select id into target from profiles where lower(username) = lower(p_username);
  if target is null then raise exception 'no such player'; end if;

  update profiles set coins = p_amount where id = target;
  return p_amount;
end;
$$;

-- let logged-in players call the cashier functions
grant execute on function award_coins(text, integer) to authenticated;
grant execute on function buy_game(text)            to authenticated;
grant execute on function set_coins(text, integer)  to authenticated;
