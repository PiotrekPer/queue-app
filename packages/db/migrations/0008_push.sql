-- 0008_push.sql — free "table ready" push channel (docs/specs/push-notifications.md)
--
-- Adds a third notification channel `push` (web-push now; wallet passes later).
-- Push is free and available on ALL plans: the sweep/send pipeline applies no
-- plan gate and no wallet debit for it (§7.1 amended). SMS stays the paid,
-- guaranteed-reach channel.
--
-- Append-only. Three changes:
--   1. widen notifications.channel CHECK to allow 'push'
--   2. new guest_push_targets table (server-only RLS) storing a guest's web-push
--      subscription / wallet pass, keyed by visit (guests have no login — the
--      visit.public_token is their identity, §4.2)
--   3. a trigger that enqueues a free `push` sibling job whenever the state
--      machine enqueues an `sms` notification job — so we don't have to reissue
--      the 400-line set_visit_status SECURITY DEFINER RPC (0006/0007 territory).

-- ── 1. allow the new channel on the audit/log table ──────────────────────────
alter table notifications drop constraint notifications_channel_check;
alter table notifications
  add constraint notifications_channel_check
  check (channel in ('sms', 'email', 'push'));

-- ── 2. guest push targets (server-only; service_role bypasses RLS) ───────────
create table guest_push_targets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  visit_id      uuid not null references visits on delete cascade,
  kind          text not null
                  check (kind in ('webpush', 'apple_wallet', 'google_wallet')),
  -- webpush: endpoint + keys{p256dh, auth}. wallet: wallet_serial + push token.
  endpoint      text,
  keys          jsonb,
  wallet_serial text,
  revoked_at    timestamptz
);

-- Active targets for a visit — the send path's lookup.
create index on guest_push_targets (visit_id) where revoked_at is null;
-- One subscription per (visit, endpoint): re-subscribing is idempotent.
create unique index on guest_push_targets (visit_id, endpoint)
  where endpoint is not null;

-- Server-only, exactly like notification_jobs: RLS on, zero policies. Guests
-- write via the guest-action edge function (service_role); clients see nothing.
alter table guest_push_targets enable row level security;
-- (intentionally no policies)

-- ── 3. enqueue a free push job alongside every sms notification job ───────────
-- The RPC (§7.4) inserts one job per warranted notification with channel 'sms'.
-- Mirror it with a 'push' job so the guest gets a free lock-screen ping in
-- parallel; the sms job still does its own paid gating downstream. The guard on
-- channel='sms' prevents recursion (the inserted push row re-fires this trigger
-- but is skipped).
create function enqueue_push_sibling()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.channel = 'sms' then
    insert into notification_jobs (visit_id, template_key, channel)
    values (new.visit_id, new.template_key, 'push');
  end if;
  return new;
end;
$$;

create trigger trg_enqueue_push_sibling
  after insert on notification_jobs
  for each row execute function enqueue_push_sibling();
