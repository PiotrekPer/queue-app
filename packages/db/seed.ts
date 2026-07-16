/**
 * Deterministic demo seed (§12.6). One command populates a realistic Friday at
 * "Trattoria Demo" (Warszawa, pro plan) so that Kolejka, Dziś, guest ticket pages
 * and the daily digest all render with life. Everything is keyed on stable UUIDs
 * derived from a fixed seed, so re-running is idempotent (upsert, no dupes).
 *
 * Run: pnpm --filter @stoliq/db seed
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment. If either
 * is missing the script prints a clear note and exits 0 (never crashes CI).
 *
 * Timezone rule (§4): we build wall-clock Warsaw times, convert to UTC ISO for
 * storage. faker.seed(47) makes every run byte-identical.
 */
import { createHash } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  LOCALES,
  TEMPLATE_KEYS,
  analyze,
  bracket,
  computeQuote,
  initialRank,
  type Bracket,
  type Locale,
  type TemplateKey,
  type VisitStatus,
} from '@stoliq/core';
import { generatePublicToken } from './src/token';
import type { Database } from './src/generated/types';

// ─── config ────────────────────────────────────────────────────────────────

const DEMO = {
  venueName: 'Trattoria Demo',
  venueSlug: 'trattoria-demo',
  city: 'Warszawa',
  plan: 'pro',
  smsBalanceGrosz: 5000,
  locale: 'pl' as Locale,
  ownerEmail: 'demo@stoliq.app',
  staffEmail: 'kelner@stoliq.app',
  password: 'stoliq-demo-1',
  /** Fixed Friday the seeded queue happens on (Europe/Warsaw). */
  serviceDate: '2026-07-17',
  /** "Now" for the demo — mid-service so 5 parties are live in the queue. */
  nowWarsaw: '2026-07-17T20:15:00',
  totalVisits: 30,
  activeVisits: 5,
} as const;

const FAKER_SEED = 47;
/** Estimated SMS unit price for the demo's cost accounting (grosz). §7.1 */
const SMS_UNIT_COST_GROSZ = 8;

// ─── deterministic id helpers ───────────────────────────────────────────────

/** Stable UUID v5-ish derived from a namespace string — same input, same id,
 *  so every re-run upserts the same rows (idempotent, no dupes). */
function stableUuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  // Shape 32 hex chars into a canonical UUID (version/variant nibbles fixed).
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join('-');
}

// ─── time helpers (build Warsaw wall-clock → UTC ISO) ───────────────────────

/**
 * Interpret a naive "YYYY-MM-DDTHH:MM:SS" as an Europe/Warsaw wall clock and
 * return the corresponding UTC ISO string. Warsaw is UTC+2 in July (CEST); we
 * compute the offset from the zone itself so this stays correct off-season too.
 */
function warsawWallToUtcIso(naive: string): string {
  // Parse as if UTC, then shift by the zone's offset at that instant.
  const asUtc = new Date(`${naive}Z`);
  const offsetMinutes = warsawOffsetMinutes(asUtc);
  return new Date(asUtc.getTime() - offsetMinutes * 60000).toISOString();
}

/** Minutes Europe/Warsaw is ahead of UTC at a given instant (60 or 120). */
function warsawOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(dtf.formatToParts(at).map((p) => [p.type, p.value]));
  const asIfLocal = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfLocal - at.getTime()) / 60000);
}

const NOW_ISO = warsawWallToUtcIso(DEMO.nowWarsaw);

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}

// ─── party-size + status distributions (§12.6) ──────────────────────────────

/** Party sizes weighted 2 > 4 > 3 > 1 > 5+. */
function weightedPartySize(): number {
  const roll = faker.number.int({ min: 1, max: 100 });
  if (roll <= 34) return 2;
  if (roll <= 58) return 4;
  if (roll <= 76) return 3;
  if (roll <= 90) return 1;
  // 5+ tail
  return faker.number.int({ min: 5, max: 7 });
}

/** Terminal outcome mix for finished visits (seated dominates a good service). */
function weightedTerminalStatus(): Extract<
  VisitStatus,
  'seated' | 'no_show' | 'guest_cancelled' | 'staff_removed'
> {
  const roll = faker.number.int({ min: 1, max: 100 });
  if (roll <= 74) return 'seated';
  if (roll <= 86) return 'guest_cancelled';
  if (roll <= 95) return 'no_show';
  return 'staff_removed';
}

/** Active status mix for the 5 live parties: mostly waiting, some notified/on_way. */
function activeStatusFor(index: number): Extract<VisitStatus, 'waiting' | 'notified' | 'on_way'> {
  // Deterministic spread across the 5 live parties: 3 waiting, 1 notified, 1 on_way.
  if (index === 0) return 'on_way';
  if (index === 1) return 'notified';
  return 'waiting';
}

const ENDED_REASON_BY_STATUS: Record<string, string> = {
  seated: 'seated',
  no_show: 'no_show',
  guest_cancelled: 'guest_cancelled',
  staff_removed: 'staff_removed',
};

const POLISH_FIRST_NAMES = [
  'Ania',
  'Kasia',
  'Tomek',
  'Marek',
  'Ewa',
  'Piotr',
  'Zofia',
  'Jan',
  'Ola',
  'Bartek',
  'Magda',
  'Krzysztof',
  'Natalia',
  'Wojtek',
  'Julia',
] as const;

// ─── row builders ────────────────────────────────────────────────────────────

type Rows = Database['public']['Tables'];

interface BuiltVisit {
  visit: Rows['visits']['Insert'];
  guest: Rows['guests']['Insert'] | null;
  events: Rows['visit_events']['Insert'][];
  notifications: Rows['notifications']['Insert'][];
}

interface BuildCtx {
  venueId: string;
  staffUserId: string;
  /** trailing seat-interval samples per bracket, grown as we seat parties (§6). */
  seatSamples: Record<Bracket, number[]>;
  /** running count of parties ahead per bracket for the quote model. */
  aheadByBracket: Record<Bracket, number>;
}

/**
 * Build one visit + its guest, events and notifications. `startIso` is when the
 * party joined; `active` selects a live status, otherwise a terminal one.
 */
function buildVisit(
  ctx: BuildCtx,
  opts: { index: number; ticketNo: number; startIso: string; active: boolean; activeIndex: number },
): BuiltVisit {
  const { index, ticketNo, startIso, active } = opts;
  const visitId = stableUuid(`visit:${index}`);
  const partySize = weightedPartySize();
  const br = bracket(partySize);
  const firstName = POLISH_FIRST_NAMES[index % POLISH_FIRST_NAMES.length] as string;
  const displayName = `${firstName} · ${partySize} os.`;

  // Quote via the real model: blend live samples with venue defaults (§6).
  const partiesAhead = ctx.aheadByBracket[br];
  const quoteMinutes = computeQuote({
    samples: ctx.seatSamples[br],
    partiesAhead,
    bracket: br,
    quoteDefaults: DEFAULT_SETTINGS.quote_defaults,
  });
  ctx.aheadByBracket[br] = partiesAhead + 1;

  // ~40% of parties give a phone (guest-entered on the ticket page, §8).
  const hasPhone = faker.number.int({ min: 1, max: 100 }) <= 40;
  const phone = hasPhone
    ? `+48${faker.string.numeric({ length: 9, allowLeadingZeros: false })}`
    : null;
  const guestId = stableUuid(`guest:${index}`);
  const purgeAfter = warsawDatePlusDays(DEMO.serviceDate, DEFAULT_SETTINGS.retention_days);

  const guest: Rows['guests']['Insert'] = {
    id: guestId,
    venue_id: ctx.venueId,
    first_name: firstName,
    phone_e164: phone,
    email: null,
    marketing_consent_at: null,
    purge_after: purgeAfter,
    created_at: startIso,
  };

  const events: Rows['visit_events']['Insert'][] = [];
  const notifications: Rows['notifications']['Insert'][] = [];

  const pushEvent = (
    event: string,
    atIso: string,
    actor: string,
    meta: Record<string, unknown> = {},
  ): void => {
    events.push({
      id: stableUuid(`event:${index}:${event}:${events.length}`),
      visit_id: visitId,
      venue_id: ctx.venueId,
      actor,
      event,
      meta: meta as Rows['visit_events']['Insert']['meta'],
      created_at: atIso,
    });
  };

  const staffActor = `staff:${ctx.staffUserId}`;

  // Every visit starts with a `created` event (§5 #1).
  pushEvent('created', startIso, staffActor, { party_size: partySize, quote: quoteMinutes });

  const visit: Rows['visits']['Insert'] = {
    id: visitId,
    venue_id: ctx.venueId,
    guest_id: guestId,
    type: 'walk_in',
    status: 'waiting',
    party_size: partySize,
    display_name: displayName,
    // Deterministic token from faker's PRNG so re-runs are byte-identical.
    public_token: generatePublicToken(() => faker.number.float({ min: 0, max: 0.999999 })),
    ticket_no: ticketNo,
    rank: initialRank(Date.parse(startIso)),
    quote_minutes: quoteMinutes,
    quote_source: 'auto',
    notified_at: null,
    heads_up_sent_at: null,
    hold_expires_at: null,
    on_way_at: null,
    seated_at: null,
    ended_at: null,
    ended_reason: null,
    reservation_at: null,
    notes: null,
    created_at: startIso,
  };

  const link = `https://stq.pl/v/${visit.public_token}`;
  const holdMinutes = DEFAULT_SETTINGS.hold_minutes;

  const maybePushSms = (
    templateKey: TemplateKey,
    atIso: string,
    status: 'sent' | 'delivered',
  ): void => {
    if (!phone) return;
    const body = renderPlBody(templateKey, {
      name: firstName,
      venue: DEMO.venueName,
      ticket_no: ticketNo,
      hold: holdMinutes,
      link,
    });
    const seg = analyze(body);
    notifications.push({
      id: stableUuid(`notif:${index}:${templateKey}`),
      visit_id: visitId,
      venue_id: ctx.venueId,
      channel: 'sms',
      template_key: templateKey,
      to_addr: phone,
      body,
      segments: seg.segments,
      cost_grosz: seg.segments * SMS_UNIT_COST_GROSZ,
      status,
      provider_id: `demo-${stableUuid(`prov:${index}:${templateKey}`).slice(0, 12)}`,
      sent_at: atIso,
      error: null,
      created_at: atIso,
    });
  };

  if (active) {
    buildActiveVisit(visit, opts.activeIndex, {
      startIso,
      holdMinutes,
      staffActor,
      pushEvent,
      maybePushSms,
      hasPhone: Boolean(phone),
    });
  } else {
    buildTerminalVisit(ctx, visit, br, {
      index,
      startIso,
      holdMinutes,
      staffActor,
      pushEvent,
      maybePushSms,
      hasPhone: Boolean(phone),
    });
  }

  return { visit, guest, events, notifications };
}

interface StageHelpers {
  startIso: string;
  holdMinutes: number;
  staffActor: string;
  pushEvent: (event: string, atIso: string, actor: string, meta?: Record<string, unknown>) => void;
  maybePushSms: (key: TemplateKey, atIso: string, status: 'sent' | 'delivered') => void;
  hasPhone: boolean;
}

/** Live party (in the queue right now): waiting / notified / on_way. */
function buildActiveVisit(
  visit: Rows['visits']['Insert'],
  activeIndex: number,
  h: StageHelpers,
): void {
  const status = activeStatusFor(activeIndex);
  if (status === 'waiting') {
    visit.status = 'waiting';
    return;
  }
  // notified: staff tapped Powiadom a couple of minutes ago (§5 #2).
  const notifiedAt = addMinutesIso(NOW_ISO, -faker.number.int({ min: 1, max: 4 }));
  const holdExpires = addMinutesIso(notifiedAt, h.holdMinutes);
  visit.status = status;
  visit.notified_at = notifiedAt;
  visit.hold_expires_at = holdExpires;
  h.pushEvent('notified', notifiedAt, h.staffActor);
  h.maybePushSms('table_ready', notifiedAt, 'delivered');

  if (status === 'on_way') {
    const onWayAt = addMinutesIso(notifiedAt, 1);
    visit.on_way_at = onWayAt;
    h.pushEvent('on_way', onWayAt, 'guest');
  }
}

/** Finished party: reconstruct a plausible timeline ending in a terminal state. */
function buildTerminalVisit(
  ctx: BuildCtx,
  visit: Rows['visits']['Insert'],
  br: Bracket,
  h: StageHelpers & { index: number },
): void {
  const status = weightedTerminalStatus();
  const startMs = Date.parse(h.startIso);

  if (status === 'seated') {
    const skipNotify = faker.number.int({ min: 1, max: 100 }) <= 30;
    const waitMin = faker.number.int({ min: 6, max: 34 });
    const seatedAt = new Date(startMs + waitMin * 60000).toISOString();
    visit.status = 'seated';
    visit.seated_at = seatedAt;
    visit.ended_at = seatedAt;
    visit.ended_reason = ENDED_REASON_BY_STATUS.seated as string;

    if (!skipNotify) {
      const notifiedAt = new Date(startMs + Math.max(1, waitMin - 4) * 60000).toISOString();
      visit.notified_at = notifiedAt;
      visit.hold_expires_at = addMinutesIso(notifiedAt, h.holdMinutes);
      h.pushEvent('notified', notifiedAt, h.staffActor);
      h.maybePushSms('table_ready', notifiedAt, 'delivered');
      // Occasionally a heads-up landed just before the notify (§5 #3).
      if (h.hasPhone && faker.number.int({ min: 1, max: 100 }) <= 35) {
        const headsUpAt = new Date(startMs + Math.max(1, waitMin - 8) * 60000).toISOString();
        visit.heads_up_sent_at = headsUpAt;
        h.pushEvent('heads_up', headsUpAt, 'system');
        h.maybePushSms('heads_up', headsUpAt, 'delivered');
      }
    }
    h.pushEvent('seated', seatedAt, h.staffActor, skipNotify ? { skipped_notify: true } : {});
    // Feed the wait-time model: record this seating interval for the bracket (§6).
    ctx.seatSamples[br].push(faker.number.int({ min: 8, max: 22 }));
    if (ctx.seatSamples[br].length > 10) ctx.seatSamples[br].shift();
    return;
  }

  if (status === 'guest_cancelled') {
    const cancelAt = new Date(startMs + faker.number.int({ min: 3, max: 25 }) * 60000).toISOString();
    visit.status = 'guest_cancelled';
    visit.ended_at = cancelAt;
    visit.ended_reason = ENDED_REASON_BY_STATUS.guest_cancelled as string;
    h.pushEvent('guest_cancelled', cancelAt, 'guest');
    return;
  }

  if (status === 'no_show') {
    // Notified, hold expired, then marked no-show (§5 #2 → #7 → #9).
    const notifiedAt = new Date(startMs + faker.number.int({ min: 8, max: 20 }) * 60000).toISOString();
    const holdExpires = addMinutesIso(notifiedAt, h.holdMinutes);
    const noShowAt = addMinutesIso(holdExpires, faker.number.int({ min: 1, max: 6 }));
    visit.status = 'no_show';
    visit.notified_at = notifiedAt;
    visit.hold_expires_at = holdExpires;
    visit.ended_at = noShowAt;
    visit.ended_reason = ENDED_REASON_BY_STATUS.no_show as string;
    h.pushEvent('notified', notifiedAt, h.staffActor);
    h.maybePushSms('table_ready', notifiedAt, 'delivered');
    h.pushEvent('hold_expired', holdExpires, 'system');
    h.pushEvent('no_show', noShowAt, h.staffActor);
    return;
  }

  // staff_removed
  const removedAt = new Date(startMs + faker.number.int({ min: 5, max: 18 }) * 60000).toISOString();
  visit.status = 'staff_removed';
  visit.ended_at = removedAt;
  visit.ended_reason = ENDED_REASON_BY_STATUS.staff_removed as string;
  h.pushEvent('staff_removed', removedAt, h.staffActor);
}

// ─── template rendering (diacritic-free PL, §7.5) ───────────────────────────

function renderPlBody(
  key: TemplateKey,
  vars: { name: string; venue: string; ticket_no: number; hold: number; link: string },
): string {
  const body = DEFAULT_TEMPLATES[key].pl;
  return body
    .replace(/\{\{\s*name\s*\}\}/g, vars.name)
    .replace(/\{\{\s*venue\s*\}\}/g, vars.venue)
    .replace(/\{\{\s*ticket_no\s*\}\}/g, String(vars.ticket_no))
    .replace(/\{\{\s*hold\s*\}\}/g, String(vars.hold))
    .replace(/\{\{\s*link\s*\}\}/g, vars.link);
}

function warsawDatePlusDays(dateKey: string, days: number): string {
  const parts = dateKey.split('-').map(Number);
  const y = parts[0] as number;
  const m = parts[1] as number;
  const d = parts[2] as number;
  const base = Date.UTC(y, m - 1, d);
  const next = new Date(base + days * 86400000);
  const iso = next.toISOString();
  return iso.slice(0, 10);
}

// ─── supabase writes (idempotent upserts) ───────────────────────────────────

type DbClient = SupabaseClient<Database>;

async function ensureAuthUser(
  supabase: DbClient,
  email: string,
): Promise<string> {
  // Try to create; if it already exists, look it up via listUsers.
  const created = await supabase.auth.admin.createUser({
    email,
    password: DEMO.password,
    email_confirm: true,
  });
  if (!created.error && created.data.user) {
    log(`  auth user ready: ${email} (${created.data.user.id})`);
    return created.data.user.id;
  }
  // Already exists (or other) → page through users to find the id.
  const found = await findUserByEmail(supabase, email);
  if (found) {
    log(`  auth user exists: ${email} (${found})`);
    return found;
  }
  throw new Error(`Could not create or find auth user ${email}: ${created.error?.message}`);
}

async function findUserByEmail(supabase: DbClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function upsert<T extends keyof Rows>(
  supabase: DbClient,
  table: T,
  rows: Rows[T]['Insert'][],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows as never, { onConflict: 'id' });
  if (error) throw new Error(`upsert ${String(table)} failed: ${error.message}`);
  log(`  upserted ${rows.length} row(s) into ${String(table)}`);
}

// ─── logging ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(msg);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    log(
      [
        'ℹ  Skipping seed: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set.',
        '   Set both env vars (EU/Frankfurt project, service_role key) then re-run:',
        '     pnpm --filter @stoliq/db seed',
      ].join('\n'),
    );
    process.exit(0);
  }

  faker.seed(FAKER_SEED);
  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log(`▶  Seeding "${DEMO.venueName}" — deterministic Friday ${DEMO.serviceDate}`);

  // 1) Venue -----------------------------------------------------------------
  const venueId = stableUuid('venue:trattoria-demo');
  const venue: Rows['venues']['Insert'] = {
    id: venueId,
    name: DEMO.venueName,
    slug: DEMO.venueSlug,
    city: DEMO.city,
    plan: DEMO.plan,
    settings: DEFAULT_SETTINGS as unknown as Rows['venues']['Insert']['settings'],
    sms_balance_grosz: DEMO.smsBalanceGrosz,
    locale: DEMO.locale,
  };
  await upsert(supabase, 'venues', [venue]);

  // 2) Message templates (pl + en for each key) ------------------------------
  const templates: Rows['message_templates']['Insert'][] = [];
  for (const key of TEMPLATE_KEYS) {
    for (const locale of LOCALES) {
      templates.push({
        id: stableUuid(`template:${key}:${locale}`),
        venue_id: venueId,
        key,
        locale,
        body: DEFAULT_TEMPLATES[key][locale],
      });
    }
  }
  await upsert(supabase, 'message_templates', templates);

  // 3) Auth users + memberships ----------------------------------------------
  const ownerId = await ensureAuthUser(supabase, DEMO.ownerEmail);
  const staffId = await ensureAuthUser(supabase, DEMO.staffEmail);
  const memberships: Rows['memberships']['Insert'][] = [
    {
      id: stableUuid(`membership:${ownerId}`),
      user_id: ownerId,
      venue_id: venueId,
      role: 'owner',
      display_name: 'Właściciel',
    },
    {
      id: stableUuid(`membership:${staffId}`),
      user_id: staffId,
      venue_id: venueId,
      role: 'staff',
      display_name: 'Kelner',
    },
  ];
  await upsert(supabase, 'memberships', memberships);

  // 4) The Friday: 30 visits across 17:00–21:00 ------------------------------
  const ctx: BuildCtx = {
    venueId,
    staffUserId: staffId,
    seatSamples: { '1-2': [], '3-4': [], '5+': [] },
    aheadByBracket: { '1-2': 0, '3-4': 0, '5+': 0 },
  };

  const built: BuiltVisit[] = [];
  const activeCount = DEMO.activeVisits;
  const terminalCount = DEMO.totalVisits - activeCount;

  // Terminal parties fill 17:00 → ~19:45; active parties are the recent tail.
  let activeIndex = 0;
  for (let i = 0; i < DEMO.totalVisits; i += 1) {
    const isActive = i >= terminalCount;
    const startIso = isActive
      ? // live parties joined within the last ~40 minutes, staggered
        addMinutesIso(NOW_ISO, -(40 - activeIndex * 8) - faker.number.int({ min: 0, max: 3 }))
      : // finished parties spread across the earlier service window
        spreadStartIso(i, terminalCount);
    built.push(
      buildVisit(ctx, {
        index: i,
        ticketNo: i + 1, // sequential per day (§4.3)
        startIso,
        active: isActive,
        activeIndex: isActive ? activeIndex : -1,
      }),
    );
    if (isActive) activeIndex += 1;
  }

  await upsert(
    supabase,
    'guests',
    built.map((b) => b.guest).filter((g): g is Rows['guests']['Insert'] => g !== null),
  );
  await upsert(
    supabase,
    'visits',
    built.map((b) => b.visit),
  );
  await upsert(
    supabase,
    'visit_events',
    built.flatMap((b) => b.events),
  );
  await upsert(
    supabase,
    'notifications',
    built.flatMap((b) => b.notifications),
  );

  // 5) Summary ---------------------------------------------------------------
  const byStatus = built.reduce<Record<string, number>>((acc, b) => {
    const s = b.visit.status ?? 'waiting';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const smsCount = built.reduce((n, b) => n + b.notifications.length, 0);

  log('');
  log('✓  Seed complete.');
  log(`   venue        : ${DEMO.venueName} (${venueId})`);
  log(`   staff logins : ${DEMO.ownerEmail} / ${DEMO.staffEmail} — pw ${DEMO.password}`);
  log(`   visits       : ${built.length} (${JSON.stringify(byStatus)})`);
  log(`   events       : ${built.flatMap((b) => b.events).length}`);
  log(`   sms sent     : ${smsCount}`);
}

/** Deterministically spread the k-th of `total` finished visits over 17:00–19:45. */
function spreadStartIso(index: number, total: number): string {
  const windowStart = warsawWallToUtcIso(`${DEMO.serviceDate}T17:00:00`);
  const windowMinutes = 165; // 17:00 → 19:45
  const base = Math.floor((index / Math.max(1, total)) * windowMinutes);
  const jitter = faker.number.int({ min: 0, max: 4 });
  return addMinutesIso(windowStart, base + jitter);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗  Seed failed: ${message}`);
  process.exit(1);
});
