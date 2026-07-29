-- 0009_wallet_target_dedupe.sql — make guest_push_targets upsert arbiters usable
--
-- 0008 added a PARTIAL unique index `(visit_id, endpoint) WHERE endpoint IS NOT
-- NULL` for webpush dedupe. But PostgREST/supabase-js `.upsert({ onConflict })`
-- emits `ON CONFLICT (cols) DO UPDATE` with NO index predicate, and Postgres
-- cannot infer a PARTIAL index as the arbiter without its predicate → it raises
-- 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
-- specification"). So the webpush upsert (guest-action) and the google_wallet
-- upsert (issue-pass) would both throw the moment they run.
--
-- Fix: use NON-partial unique indexes. NULLs are distinct by default, so rows
-- that leave the keyed column null still coexist:
--   • webpush rows     → wallet_serial NULL, dedupe on (visit_id, endpoint)
--   • wallet-pass rows → endpoint NULL,      dedupe on (visit_id, wallet_serial)
--
-- Append-only.

-- Replace 0008's partial endpoint index with a non-partial (arbiter-usable) one.
drop index if exists guest_push_targets_visit_id_endpoint_idx;
create unique index if not exists guest_push_targets_visit_endpoint_key
  on guest_push_targets (visit_id, endpoint);

-- The wallet-serial arbiter the google_wallet upsert (issue-pass) needs.
create unique index if not exists guest_push_targets_visit_serial_key
  on guest_push_targets (visit_id, wallet_serial);
