-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_fix_pgcrypto_search_path.sql
--
-- On Supabase, pgcrypto is installed into the `extensions` schema, so
-- gen_random_bytes() is not on a `search_path = public` function. gen_public_token
-- (called by create_visit) therefore failed with "function gen_random_bytes(integer)
-- does not exist". Add `extensions` to its search_path. (gen_random_uuid used as a
-- column default is a pg_catalog built-in and is unaffected.)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function gen_public_token()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  out text := '';
  bytes bytea := gen_random_bytes(16);
  i int;
begin
  for i in 0..15 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 58) + 1, 1);
  end loop;
  return out;
end;
$$;
