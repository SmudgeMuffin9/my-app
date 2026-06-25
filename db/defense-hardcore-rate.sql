-- Adds the coin payout rate for HARDCORE Smudge Defense (game key 'defense_hard').
-- Hardcore runs save their score under 'defense_hard' so they get their OWN
-- leaderboard, but award_coins() pays 0 for any game with no coin_rate row — so
-- this row makes hardcore pay out. Rate is 200 = 25× normal Defense (rate 8), a
-- big payout to reward the much harder run (Defense has no cap, so it scales up).
--
-- SAFE TO RUN ANY TIME: it's a single upsert (no policies), so unlike re-running
-- the whole shop-setup.sql, it won't stop partway. Run it once in Supabase →
-- SQL Editor.
insert into coin_rates (game, rate, lower_better, baseline)
values ('defense_hard', 200.0, false, 0)
on conflict (game) do update set rate = excluded.rate;
