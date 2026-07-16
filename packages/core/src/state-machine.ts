/**
 * Visit state machine (§5, walk_in v1).
 *
 * Pure + framework-free: given the current status and an intent, it returns the
 * resulting status plus an exhaustive description of side effects (event to log,
 * timestamps to set/clear, notification job to enqueue, haptic to fire). The
 * caller (RPC / edge function / optimistic UI) performs the writes.
 *
 * Illegal transitions throw `InvalidTransitionError` (HTTP 409) — never silently
 * coerced (§5). Terminal states are frozen except `notes`.
 */
import {
  LIMITS,
  isTerminalStatus,
  type VisitEvent,
  type VisitStatus,
  type TemplateKey,
} from './constants';

/** Haptic feedback keys mapped by the staff app (§9.3 haptics map). */
export type Haptic = 'light' | 'medium' | 'success' | 'warning' | 'selection';

/** The triggers that move (or touch) a visit — one per row of the §5 table. */
export type TransitionIntent =
  | 'create' // #1  → waiting
  | 'notify' // #2  waiting → notified
  | 'guest_on_way' // #4  notified → on_way
  | 'seat' // #5/#6 notified|on_way|waiting → seated
  | 'hold_expired' // #7  notified → notified (pulse)
  | 'renotify' // #7  notified → notified (new hold)
  | 'skip' // #8  waiting|notified → waiting
  | 'no_show' // #9  notified → no_show
  | 'guest_cancel' // #10 waiting|notified|on_way → guest_cancelled
  | 'staff_remove' // #11 waiting|notified → staff_removed
  | 'guest_delay'; // #12 any non-terminal → unchanged (+5 min hold)

export class InvalidTransitionError extends Error {
  readonly code = 'invalid_transition';
  readonly httpStatus = 409;
  readonly from: VisitStatus | null;
  readonly intent: TransitionIntent;
  constructor(intent: TransitionIntent, from: VisitStatus | null, detail?: string) {
    super(
      `invalid_transition: cannot '${intent}' from '${from ?? 'nil'}'${
        detail ? ` — ${detail}` : ''
      }`,
    );
    this.name = 'InvalidTransitionError';
    this.intent = intent;
    this.from = from;
  }
}

/** Fully describes what a transition does — the exhaustive §5 "side effects" column. */
export interface TransitionEffect {
  status: VisitStatus;
  /** whether the persisted status actually changes (some intents only touch timers) */
  stateChanged: boolean;
  /** primary event to append to visit_events */
  event: VisitEvent;
  /** visit timestamp columns to set to "now" */
  setTimestamps: readonly string[];
  /** visit timestamp columns to clear to null */
  clearTimestamps: readonly string[];
  /** notification job to enqueue (§7.6), or null for none */
  enqueueJob: TemplateKey | null;
  /** haptic to fire on staff devices, or null */
  haptic: Haptic | null;
  /** extra event meta */
  meta: Record<string, unknown>;
  /** the visit enters the pulsing hold-expired UI state (§5 #7) */
  pulse?: boolean;
}

/** Runtime context some transitions need to enforce guards / branch. */
export interface TransitionContext {
  /** current uses of guest „+5 minut" (§5 #12, max 2) */
  delayUses?: number;
  /** current count of renotifies already sent (§5 #7, max 1) */
  renotifyCount?: number;
  /** whether the guest supplied a phone AND venue is on a paid plan (gates SMS jobs) */
  smsEligible?: boolean;
}

const NIL = null;

/**
 * Describe (without applying) the effect of an intent on a visit in `from`.
 * Throws `InvalidTransitionError` for illegal source states or exceeded guards.
 */
export function describeTransition(
  intent: TransitionIntent,
  from: VisitStatus | null,
  ctx: TransitionContext = {},
): TransitionEffect {
  const smsJob = (key: TemplateKey): TemplateKey | null => (ctx.smsEligible ? key : null);

  switch (intent) {
    // #1 — create
    case 'create': {
      if (from !== NIL) {
        throw new InvalidTransitionError(intent, from, 'visit already exists');
      }
      return effect('waiting', true, 'created', {
        haptic: 'light',
      });
    }

    // #2 — waiting → notified (staff taps Powiadom)
    case 'notify': {
      requireFrom(intent, from, ['waiting']);
      return effect('notified', true, 'notified', {
        setTimestamps: ['notified_at', 'hold_expires_at'],
        enqueueJob: smsJob('table_ready'),
        haptic: 'success',
      });
    }

    // #4 — notified → on_way (guest taps „Już idziemy")
    case 'guest_on_way': {
      requireFrom(intent, from, ['notified']);
      return effect('on_way', true, 'on_way', {
        setTimestamps: ['on_way_at'],
        haptic: 'medium',
      });
    }

    // #5 / #6 — → seated (staff swipes Posadź). From waiting = skipping notify.
    case 'seat': {
      requireFrom(intent, from, ['waiting', 'notified', 'on_way']);
      const skippedNotify = from === 'waiting';
      return effect('seated', true, 'seated', {
        setTimestamps: ['seated_at', 'ended_at'],
        haptic: 'success',
        meta: skippedNotify ? { skipped_notify: true } : {},
      });
    }

    // #7 — notified → notified, hold elapsed (sweep). No state change; pulse.
    case 'hold_expired': {
      requireFrom(intent, from, ['notified']);
      return effect('notified', false, 'hold_expired', {
        pulse: true,
      });
    }

    // #7 — notified → notified, staff re-notifies (max 1). New hold timer.
    case 'renotify': {
      requireFrom(intent, from, ['notified']);
      if ((ctx.renotifyCount ?? 0) >= LIMITS.maxRenotify) {
        throw new InvalidTransitionError(intent, from, 'renotify limit reached');
      }
      return effect('notified', false, 'renotified', {
        setTimestamps: ['notified_at', 'hold_expires_at'],
        enqueueJob: smsJob('renotify'),
        haptic: 'success',
      });
    }

    // #8 — waiting|notified → waiting (staff Pomiń). Drops exactly one place.
    case 'skip': {
      requireFrom(intent, from, ['waiting', 'notified']);
      return effect('waiting', from !== 'waiting', 'skipped', {
        clearTimestamps: ['notified_at', 'hold_expires_at'],
        haptic: 'selection',
      });
    }

    // #9 — notified → no_show (staff „Nie przyszli")
    case 'no_show': {
      requireFrom(intent, from, ['notified']);
      return effect('no_show', true, 'no_show', {
        setTimestamps: ['ended_at'],
        haptic: 'warning',
      });
    }

    // #10 — waiting|notified|on_way → guest_cancelled (guest „Rezygnujemy")
    case 'guest_cancel': {
      requireFrom(intent, from, ['waiting', 'notified', 'on_way']);
      return effect('guest_cancelled', true, 'guest_cancelled', {
        setTimestamps: ['ended_at'],
        haptic: 'light',
      });
    }

    // #11 — waiting|notified → staff_removed (staff Usuń)
    case 'staff_remove': {
      requireFrom(intent, from, ['waiting', 'notified']);
      return effect('staff_removed', true, 'staff_removed', {
        setTimestamps: ['ended_at'],
        haptic: 'selection',
      });
    }

    // #12 — any non-terminal → unchanged (guest „+5 minut", max 2)
    case 'guest_delay': {
      if (from === NIL || isTerminalStatus(from)) {
        throw new InvalidTransitionError(intent, from, 'visit is not active');
      }
      if ((ctx.delayUses ?? 0) >= LIMITS.maxDelayUses) {
        throw new InvalidTransitionError(intent, from, 'delay limit reached');
      }
      return effect(from, false, 'delay_extended', {
        meta: { delay: LIMITS.delayMinutes },
      });
    }

    default: {
      // Exhaustiveness guard — a new intent must be handled above.
      const _never: never = intent;
      throw new InvalidTransitionError(_never as TransitionIntent, from);
    }
  }
}

/** Convenience: describe + return just the next status. */
export function nextStatus(
  intent: TransitionIntent,
  from: VisitStatus | null,
  ctx?: TransitionContext,
): VisitStatus {
  return describeTransition(intent, from, ctx).status;
}

export function canTransition(
  intent: TransitionIntent,
  from: VisitStatus | null,
  ctx?: TransitionContext,
): boolean {
  try {
    describeTransition(intent, from, ctx);
    return true;
  } catch {
    return false;
  }
}

// ─── internals ──────────────────────────────────────────────────────────────

function requireFrom(
  intent: TransitionIntent,
  from: VisitStatus | null,
  allowed: readonly VisitStatus[],
): asserts from is VisitStatus {
  if (from === null || !allowed.includes(from)) {
    throw new InvalidTransitionError(intent, from, `expected one of [${allowed.join(', ')}]`);
  }
}

function effect(
  status: VisitStatus,
  stateChanged: boolean,
  event: VisitEvent,
  partial: Partial<Omit<TransitionEffect, 'status' | 'stateChanged' | 'event'>> = {},
): TransitionEffect {
  return {
    status,
    stateChanged,
    event,
    setTimestamps: partial.setTimestamps ?? [],
    clearTimestamps: partial.clearTimestamps ?? [],
    enqueueJob: partial.enqueueJob ?? null,
    haptic: partial.haptic ?? null,
    meta: partial.meta ?? {},
    ...(partial.pulse ? { pulse: true } : {}),
  };
}
