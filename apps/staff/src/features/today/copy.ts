/**
 * Local Dziś (today) copy constants (§9.3C, §9.5).
 *
 * These labels have no keys under `staff.*` in @stoliq/core yet, so — per the
 * track contract — we keep a LOCAL copy here rather than editing the core i18n
 * package. Warm-direct Polish, factual, calm: the rich analytics live in the
 * daily email, this screen is just an honest tally.
 */
import type { TerminalStatus } from '@stoliq/core';

/** Mono stat-strip labels (§9.3C: „Przyjęte 84 · Posadzone 71 · …"). */
export const TODAY_COPY = {
  /** parties added today */
  accepted: 'Przyjęte',
  /** seated (terminal 'seated') */
  seated: 'Posadzone',
  /** guest_cancelled */
  cancelled: 'Rezygnacje',
  /** no_show */
  noShow: 'No-show',
  /** median waited minutes across seated visits */
  median: 'Mediana',
  minutesShort: 'min',
  /** shown when there is nothing yet today */
  emptyTitle: 'Jeszcze nic dziś.',
  emptySubtitle: 'Pierwszy gość pojawi się tutaj.',
  /** placeholder when a party had no name entered */
  noName: 'Gość',
} as const;

/** Finished-visit outcome label per terminal status (§5 terminal reasons). */
export const OUTCOME_LABEL: Record<TerminalStatus, string> = {
  seated: 'Posadzeni',
  no_show: 'Nie przyszli',
  guest_cancelled: 'Rezygnacja',
  staff_removed: 'Usunięci',
};

/**
 * Tabular figures for every number (§9.2). Mutable literal-typed array (not a
 * `readonly` tuple) so it satisfies RN's `FontVariant[]` — matching the pattern
 * that already typechecks green in the add track.
 */
export const TABULAR = { fontVariant: ['tabular-nums' as const] };
