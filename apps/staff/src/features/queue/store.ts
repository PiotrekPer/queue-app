/**
 * Queue store — the single source of visit state for the staff app (§5, §5.1).
 *
 * Optimistic-first (§1.3 "never block on the network"): every mutation applies
 * locally at once, fires the state-machine's haptic, and records an undo entry;
 * persistence to Supabase (create_visit / set_visit_status RPCs) happens in the
 * background when a backend is configured. Without a backend the store seeds a
 * deterministic, lively demo queue so the whole UI is alive for the sales demo.
 *
 * All ordering/positioning is derived from `rank` via @stoliq/core (§5.1); this
 * store never renumbers — skip drops a party exactly one place via a fractional
 * rank (§5 #8).
 */
import {
  DEFAULT_SETTINGS,
  bracket,
  computePosition,
  computeQuote,
  describeTransition,
  initialRank,
  isActiveStatus,
  isTerminalStatus,
  skipRank,
  type CreateVisitInput,
  type TransitionEffect,
  type TransitionIntent,
  type Visit,
  type VisitStatus,
} from '@stoliq/core';
import { create } from 'zustand';
import { useEffect } from 'react';
import { fireHaptic } from '@/lib/haptics';
import { hasBackend } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/** Fixed venue for the demo build (matches seed §12.6 "Trattoria Demo"). */
const DEMO_VENUE_ID = '00000000-0000-4000-8000-000000000047';
const DEMO_VENUE_NAME = 'Trattoria Demo';

export const venueName = DEMO_VENUE_NAME;

/** Runtime context the state machine needs; derived from a visit's own history. */
interface IntentContext {
  /** override smsEligible (defaults to false in the demo build) */
  smsEligible?: boolean;
}

/** One reversible mutation: the full pre-mutation snapshot of every touched row. */
interface UndoEntry {
  event: string;
  before: Visit[];
}

interface QueueState {
  visits: Visit[];
  hydrated: boolean;
  undoStack: UndoEntry[];

  /** Replace the whole set (used by hydrate / realtime full loads). */
  setVisits: (visits: Visit[]) => void;
  upsertVisit: (visit: Visit) => void;
  removeVisit: (id: string) => void;

  addVisit: (input: CreateVisitInput) => Visit;
  applyIntent: (visitId: string, intent: TransitionIntent, ctx?: IntentContext) => void;
  undoLast: () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────

const nowIso = (): string => new Date().toISOString();

/** base58 (Bitcoin) alphabet — unguessable public token (§4). */
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function publicToken(): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += BASE58[Math.floor(Math.random() * BASE58.length)];
  }
  return out;
}

/** RFC-4122-ish v4 id; crypto.randomUUID when present, else a good-enough fallback. */
function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Per-venue-per-day ticket number = max(today) + 1 (§4.3, client-side for demo). */
function nextTicketNo(visits: readonly Visit[]): number {
  const today = new Date().toDateString();
  let max = 0;
  for (const v of visits) {
    if (new Date(v.created_at).toDateString() === today && v.ticket_no > max) {
      max = v.ticket_no;
    }
  }
  return max + 1;
}

/** Active ranks (waiting|notified|on_way) for position math (§5.1). */
function activeRanks(visits: readonly Visit[]): number[] {
  return visits.filter((v) => isActiveStatus(v.status)).map((v) => v.rank);
}

/** Apply a transition effect's timestamp writes to a visit, returning a new row. */
function applyEffectToVisit(visit: Visit, effect: TransitionEffect): Visit {
  const patch: Record<string, string | null> = {};
  for (const col of effect.setTimestamps) patch[col] = nowIso();
  for (const col of effect.clearTimestamps) patch[col] = null;

  const next: Visit = { ...visit, ...patch, status: effect.status };

  // Terminal states record why they ended (§4 ended_reason).
  if (isTerminalStatus(effect.status)) {
    next.ended_reason =
      effect.status === 'seated'
        ? 'seated'
        : effect.status === 'no_show'
          ? 'no_show'
          : effect.status === 'guest_cancelled'
            ? 'guest_cancelled'
            : 'staff_removed';
  }
  return next;
}

/**
 * Recompute the skipped party's rank so it lands exactly one slot lower (§5 #8).
 * Returns the new rank, or the current rank if there is nobody behind to swap with.
 */
function rankAfterSkip(visits: readonly Visit[], skippedId: string): number {
  const active = visits
    .filter((v) => isActiveStatus(v.status))
    .sort((a, b) => a.rank - b.rank);
  const idx = active.findIndex((v) => v.id === skippedId);
  if (idx === -1 || idx >= active.length - 1) {
    // last (or not active) — nothing behind to drop past
    return active[idx]?.rank ?? 0;
  }
  const next = active[idx + 1];
  const nextNext = active[idx + 2] ?? null;
  return skipRank((next as Visit).rank, nextNext ? nextNext.rank : null);
}

// ─── background persistence (no-op without a backend) ───────────────────────

function persistCreate(visit: Visit): void {
  if (!hasBackend) return;
  void supabase
    .rpc('create_visit', {
      p_venue_id: visit.venue_id,
      p_party_size: visit.party_size,
      p_display_name: visit.display_name,
      p_quote_minutes: visit.quote_minutes,
      p_quote_source: visit.quote_source,
      p_public_token: visit.public_token,
    })
    .then(({ error }) => {
      if (error) console.warn('[queue] create_visit failed', error.message);
    });
}

function persistIntent(visitId: string, intent: TransitionIntent, status: VisitStatus): void {
  if (!hasBackend) return;
  void supabase
    .rpc('set_visit_status', {
      p_visit_id: visitId,
      p_intent: intent,
      p_status: status,
    })
    .then(({ error }) => {
      if (error) console.warn('[queue] set_visit_status failed', error.message);
    });
}

// ─── store ──────────────────────────────────────────────────────────────

export const useQueueStore = create<QueueState>((set, get) => ({
  visits: [],
  hydrated: false,
  undoStack: [],

  setVisits: (visits) => set({ visits, hydrated: true }),

  upsertVisit: (visit) =>
    set((s) => {
      const idx = s.visits.findIndex((v) => v.id === visit.id);
      if (idx === -1) return { visits: [...s.visits, visit] };
      const copy = s.visits.slice();
      copy[idx] = visit;
      return { visits: copy };
    }),

  removeVisit: (id) => set((s) => ({ visits: s.visits.filter((v) => v.id !== id) })),

  addVisit: (input) => {
    const state = get();
    const b = bracket(input.party_size);
    const partiesAhead = state.visits.filter((v) => isActiveStatus(v.status)).length;
    const quote =
      input.quote_minutes ??
      computeQuote({
        samples: [],
        partiesAhead,
        bracket: b,
        quoteDefaults: DEFAULT_SETTINGS.quote_defaults,
      });

    const created = nowIso();
    const effect = describeTransition('create', null, {});
    const name = input.display_name ?? input.first_name ?? null;
    const displayName = name ? `${name} · ${input.party_size} os.` : `${input.party_size} os.`;

    const visit: Visit = {
      id: uuid(),
      created_at: created,
      venue_id: input.venue_id || DEMO_VENUE_ID,
      guest_id: null,
      type: input.type ?? 'walk_in',
      status: 'waiting',
      party_size: input.party_size,
      display_name: displayName,
      public_token: publicToken(),
      ticket_no: nextTicketNo(state.visits),
      rank: initialRank(Date.now()),
      quote_minutes: quote,
      quote_source: input.quote_source ?? 'auto',
      notified_at: null,
      heads_up_sent_at: null,
      hold_expires_at: null,
      on_way_at: null,
      seated_at: null,
      ended_at: null,
      ended_reason: null,
      reservation_at: null,
      notes: input.notes ?? null,
    };

    set((s) => ({ visits: [...s.visits, visit] }));
    void fireHaptic(effect.haptic);
    persistCreate(visit);
    return visit;
  },

  applyIntent: (visitId, intent, ctx) => {
    const state = get();
    const visit = state.visits.find((v) => v.id === visitId);
    if (!visit) return;

    let effect: TransitionEffect;
    try {
      effect = describeTransition(intent, visit.status, {
        smsEligible: ctx?.smsEligible ?? false,
        // guest-driven guards live on other tracks; staff intents don't need them
      });
    } catch {
      // Invalid transition (409) — never coerce; ignore the tap (§5).
      return;
    }

    // Snapshot every row we're about to change for a generic undo (off the effect log).
    const before: Visit[] = [{ ...visit }];
    let next = applyEffectToVisit(visit, effect);

    // Skip repositions the party one slot lower via a fractional rank (§5 #8, no cascade).
    if (intent === 'skip') {
      next = { ...next, rank: rankAfterSkip(state.visits, visitId) };
    }

    set((s) => ({
      visits: s.visits.map((v) => (v.id === visitId ? next : v)),
      undoStack: [...s.undoStack, { event: effect.event, before }],
    }));

    void fireHaptic(effect.haptic);
    persistIntent(visitId, intent, next.status);
  },

  undoLast: () => {
    const { undoStack } = get();
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    const restore = new Map(entry.before.map((v) => [v.id, v]));
    set((s) => ({
      visits: s.visits.map((v) => restore.get(v.id) ?? v),
      undoStack: s.undoStack.slice(0, -1),
    }));
    void fireHaptic('selection');
    // Backend undo is a compensating transition (event `undo:<original>`, §5) and
    // belongs to the RPC layer owned by another track; the local restore above is
    // the source of truth here. Intentionally no bogus intent is sent.
  },
}));

// ─── hydration + realtime ───────────────────────────────────────────────

/**
 * Mount effect: load the venue queue and subscribe to realtime when a backend is
 * configured; otherwise seed a deterministic demo set so the UI is alive (§ store
 * contract). Safe to call from multiple screens — hydration runs once.
 */
export function useHydrateQueue(): void {
  const hydrated = useQueueStore((s) => s.hydrated);
  const setVisits = useQueueStore((s) => s.setVisits);
  const upsertVisit = useQueueStore((s) => s.upsertVisit);
  const removeVisit = useQueueStore((s) => s.removeVisit);

  useEffect(() => {
    if (hydrated) return;

    if (!hasBackend) {
      setVisits(buildDemoQueue());
      return;
    }

    let active = true;
    void supabase
      .from('visits')
      .select('*')
      .order('rank', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.warn('[queue] load failed, falling back to demo', error.message);
          setVisits(buildDemoQueue());
          return;
        }
        setVisits((data ?? []) as Visit[]);
      });

    // Realtime: two devices must feel like one (§9.3A). Venue channel on visits.
    const channel = supabase
      .channel('visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        (payload: { eventType: string; new: unknown; old: unknown }) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as { id?: string };
            if (old.id) removeVisit(old.id);
          } else {
            upsertVisit(payload.new as Visit);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [hydrated, setVisits, upsertVisit, removeVisit]);
}

// ─── selectors ────────────────────────────────────────────────────────────

const byRankAsc = (a: Visit, b: Visit): number => a.rank - b.rank;
const isToday = (iso: string): boolean =>
  new Date(iso).toDateString() === new Date().toDateString();

/** Active visits (waiting|notified|on_way), ordered by rank (§5.1). */
export function useActiveVisits(): Visit[] {
  return useQueueStore((s) => s.visits.filter((v) => isActiveStatus(v.status)).sort(byRankAsc));
}

/** Terminal visits created today, newest first (Dziś rail). */
export function useFinishedVisits(): Visit[] {
  return useQueueStore((s) =>
    s.visits
      .filter((v) => isTerminalStatus(v.status) && isToday(v.created_at))
      .sort((a, b) => Date.parse(b.ended_at ?? b.created_at) - Date.parse(a.ended_at ?? a.created_at)),
  );
}

/** Every visit created today (Dziś stats). */
export function useTodayVisits(): Visit[] {
  return useQueueStore((s) => s.visits.filter((v) => isToday(v.created_at)));
}

/** Live count of parties in the queue (header pill). */
export function useQueueCount(): number {
  return useQueueStore((s) => s.visits.filter((v) => isActiveStatus(v.status)).length);
}

/**
 * 1-based position of a visit among the active queue (§5.1). Reads the current
 * store snapshot, so callers can pass just the visit. Terminal visits → 0.
 */
export function positionOf(visit: Visit): number {
  if (!isActiveStatus(visit.status)) return 0;
  return computePosition(visit.rank, activeRanks(useQueueStore.getState().visits));
}

// ─── deterministic demo seed ────────────────────────────────────────────────

interface DemoSpec {
  name: string | null;
  size: number;
  status: VisitStatus;
  /** minutes ago this party joined */
  joinedMinAgo: number;
  /** minutes ago it was notified (for notified/on_way/no_show) */
  notifiedMinAgo?: number;
  /** minutes ago it ended (terminal) */
  endedMinAgo?: number;
  /** force a hold-expired (pulsing) card */
  holdExpired?: boolean;
}

/**
 * A realistic Friday snapshot (§12.6): ~6 active parties across waiting/notified/
 * on_way plus a few terminal, with plausible timestamps relative to *now* so
 * elapsed values read live. Deterministic order (no RNG on timing).
 */
function buildDemoQueue(): Visit[] {
  const specs: DemoSpec[] = [
    // Active — ordered as they'll appear (rank ascending = longest waiting first).
    { name: 'Ania', size: 4, status: 'notified', joinedMinAgo: 22, notifiedMinAgo: 3 },
    { name: 'Marek', size: 2, status: 'on_way', joinedMinAgo: 19, notifiedMinAgo: 6 },
    {
      name: 'Kasia',
      size: 5,
      status: 'notified',
      joinedMinAgo: 17,
      notifiedMinAgo: 9,
      holdExpired: true,
    },
    { name: 'Tomek', size: 3, status: 'waiting', joinedMinAgo: 12 },
    { name: null, size: 2, status: 'waiting', joinedMinAgo: 7 },
    { name: 'Zofia', size: 6, status: 'waiting', joinedMinAgo: 3 },
    // Terminal — earlier in the evening.
    { name: 'Piotr', size: 2, status: 'seated', joinedMinAgo: 61, endedMinAgo: 44 },
    { name: 'Ewa', size: 4, status: 'seated', joinedMinAgo: 52, endedMinAgo: 38 },
    { name: 'Jan', size: 3, status: 'no_show', joinedMinAgo: 40, notifiedMinAgo: 30, endedMinAgo: 22 },
    { name: 'Ola', size: 2, status: 'guest_cancelled', joinedMinAgo: 34, endedMinAgo: 25 },
  ];

  const nowMs = Date.now();
  const settings = DEFAULT_SETTINGS;
  let ticket = 40;

  return specs.map((spec, i) => {
    ticket += 1;
    const createdMs = nowMs - spec.joinedMinAgo * 60_000;
    const created = new Date(createdMs).toISOString();
    const b = bracket(spec.size);
    const quote = settings.quote_defaults[b];

    const notifiedAt =
      spec.notifiedMinAgo != null
        ? new Date(nowMs - spec.notifiedMinAgo * 60_000).toISOString()
        : null;
    // hold = notified + hold_minutes; if holdExpired, push it into the past.
    const holdExpires =
      notifiedAt != null
        ? new Date(
            Date.parse(notifiedAt) +
              (spec.holdExpired ? -1 : settings.hold_minutes) * 60_000,
          ).toISOString()
        : null;
    const onWayAt =
      spec.status === 'on_way' && spec.notifiedMinAgo != null
        ? new Date(nowMs - Math.max(0, spec.notifiedMinAgo - 2) * 60_000).toISOString()
        : null;
    const endedAt =
      spec.endedMinAgo != null ? new Date(nowMs - spec.endedMinAgo * 60_000).toISOString() : null;
    const endedReason =
      spec.status === 'seated'
        ? 'seated'
        : spec.status === 'no_show'
          ? 'no_show'
          : spec.status === 'guest_cancelled'
            ? 'guest_cancelled'
            : spec.status === 'staff_removed'
              ? 'staff_removed'
              : null;

    const displayName = spec.name
      ? `${spec.name} · ${spec.size} os.`
      : `${spec.size} os.`;

    return {
      id: `demo-${i}-${ticket}`,
      created_at: created,
      venue_id: DEMO_VENUE_ID,
      guest_id: null,
      type: 'walk_in',
      status: spec.status,
      party_size: spec.size,
      display_name: displayName,
      public_token: `demo${ticket}${'0'.repeat(9)}`.slice(0, 16),
      ticket_no: ticket,
      // rank ascending with join order; longest-waiting first.
      rank: initialRank(createdMs),
      quote_minutes: quote,
      quote_source: 'auto',
      notified_at: notifiedAt,
      heads_up_sent_at: null,
      hold_expires_at: holdExpires,
      on_way_at: onWayAt,
      seated_at: spec.status === 'seated' ? endedAt : null,
      ended_at: endedAt,
      ended_reason: endedReason,
      reservation_at: null,
      notes: null,
    } satisfies Visit;
  });
}
