import { describe, expect, it } from 'vitest';
import { VISIT_STATUSES, type VisitStatus } from './constants';
import {
  InvalidTransitionError,
  canTransition,
  describeTransition,
  nextStatus,
  type TransitionIntent,
} from './state-machine';

const ALL: VisitStatus[] = [...VISIT_STATUSES];

/** Legal source → target map per §5. `null` source = pre-creation. */
const LEGAL: Array<{ intent: TransitionIntent; from: VisitStatus | null; to: VisitStatus }> = [
  { intent: 'create', from: null, to: 'waiting' },
  { intent: 'notify', from: 'waiting', to: 'notified' },
  { intent: 'guest_on_way', from: 'notified', to: 'on_way' },
  { intent: 'seat', from: 'waiting', to: 'seated' },
  { intent: 'seat', from: 'notified', to: 'seated' },
  { intent: 'seat', from: 'on_way', to: 'seated' },
  { intent: 'hold_expired', from: 'notified', to: 'notified' },
  { intent: 'renotify', from: 'notified', to: 'notified' },
  { intent: 'skip', from: 'waiting', to: 'waiting' },
  { intent: 'skip', from: 'notified', to: 'waiting' },
  { intent: 'no_show', from: 'notified', to: 'no_show' },
  { intent: 'guest_cancel', from: 'waiting', to: 'guest_cancelled' },
  { intent: 'guest_cancel', from: 'notified', to: 'guest_cancelled' },
  { intent: 'guest_cancel', from: 'on_way', to: 'guest_cancelled' },
  { intent: 'staff_remove', from: 'waiting', to: 'staff_removed' },
  { intent: 'staff_remove', from: 'notified', to: 'staff_removed' },
  { intent: 'guest_delay', from: 'waiting', to: 'waiting' },
  { intent: 'guest_delay', from: 'notified', to: 'notified' },
  { intent: 'guest_delay', from: 'on_way', to: 'on_way' },
];

describe('state machine — legal transitions (§5)', () => {
  for (const { intent, from, to } of LEGAL) {
    it(`${intent} from ${from ?? 'nil'} → ${to}`, () => {
      expect(nextStatus(intent, from)).toBe(to);
      expect(canTransition(intent, from)).toBe(true);
    });
  }
});

describe('state machine — illegal transitions throw 409 (§5)', () => {
  const legalKeys = new Set(LEGAL.map((l) => `${l.intent}:${l.from ?? 'nil'}`));
  const intents: TransitionIntent[] = [
    'notify',
    'guest_on_way',
    'seat',
    'hold_expired',
    'renotify',
    'skip',
    'no_show',
    'guest_cancel',
    'staff_remove',
    'guest_delay',
  ];

  for (const intent of intents) {
    for (const from of ALL) {
      if (legalKeys.has(`${intent}:${from}`)) continue;
      it(`${intent} from ${from} is rejected`, () => {
        expect(() => describeTransition(intent, from)).toThrow(InvalidTransitionError);
        try {
          describeTransition(intent, from);
        } catch (e) {
          expect((e as InvalidTransitionError).httpStatus).toBe(409);
          expect((e as InvalidTransitionError).code).toBe('invalid_transition');
        }
      });
    }
  }

  it('create from an existing state is rejected', () => {
    expect(() => describeTransition('create', 'waiting')).toThrow(InvalidTransitionError);
  });
});

describe('state machine — side effects (§5 exhaustive column)', () => {
  it('#2 notify sets both timers and enqueues table_ready only when SMS-eligible', () => {
    const eligible = describeTransition('notify', 'waiting', { smsEligible: true });
    expect(eligible.setTimestamps).toEqual(['notified_at', 'hold_expires_at']);
    expect(eligible.enqueueJob).toBe('table_ready');
    expect(eligible.haptic).toBe('success');

    const free = describeTransition('notify', 'waiting', { smsEligible: false });
    expect(free.enqueueJob).toBeNull(); // ticket page still updates; no SMS
  });

  it('#4 guest_on_way sets on_way_at + medium haptic', () => {
    const e = describeTransition('guest_on_way', 'notified');
    expect(e.setTimestamps).toContain('on_way_at');
    expect(e.haptic).toBe('medium');
  });

  it('#6 seat from waiting flags skipped_notify', () => {
    expect(describeTransition('seat', 'waiting').meta).toEqual({ skipped_notify: true });
    expect(describeTransition('seat', 'notified').meta).toEqual({});
    expect(describeTransition('seat', 'on_way').setTimestamps).toEqual(['seated_at', 'ended_at']);
  });

  it('#7 hold_expired does not change state but pulses', () => {
    const e = describeTransition('hold_expired', 'notified');
    expect(e.stateChanged).toBe(false);
    expect(e.pulse).toBe(true);
    expect(e.event).toBe('hold_expired');
  });

  it('#7 renotify enforces a single renotify', () => {
    expect(describeTransition('renotify', 'notified', { renotifyCount: 0 }).event).toBe(
      'renotified',
    );
    expect(() => describeTransition('renotify', 'notified', { renotifyCount: 1 })).toThrow(
      /renotify limit/,
    );
  });

  it('#8 skip clears notify timers; state only changes from notified', () => {
    const fromWaiting = describeTransition('skip', 'waiting');
    expect(fromWaiting.stateChanged).toBe(false);
    expect(fromWaiting.clearTimestamps).toEqual(['notified_at', 'hold_expires_at']);
    expect(describeTransition('skip', 'notified').stateChanged).toBe(true);
  });

  it('#12 guest_delay is capped at 2 uses and carries delay meta', () => {
    const ok = describeTransition('guest_delay', 'notified', { delayUses: 1 });
    expect(ok.meta).toEqual({ delay: 5 });
    expect(ok.stateChanged).toBe(false);
    expect(() => describeTransition('guest_delay', 'notified', { delayUses: 2 })).toThrow(
      /delay limit/,
    );
  });

  it('terminal states accept no intent', () => {
    for (const terminal of ['seated', 'no_show', 'guest_cancelled', 'staff_removed'] as const) {
      expect(canTransition('seat', terminal)).toBe(false);
      expect(canTransition('guest_cancel', terminal)).toBe(false);
      expect(canTransition('guest_delay', terminal)).toBe(false);
    }
  });
});
