/**
 * Local toast copy for the Kolejka undo affordance. The core i18n bundle covers
 * button verbs and the guest-cancelled toast; the past-tense "you just did X"
 * lines live here (LOCAL copy per the track contract — never edit @stoliq/core).
 *
 * Same verb across the flow (§9.5): Powiadom → „Powiadomiono", Posadź → posadzić.
 * Keyed by TransitionIntent; `{name}` is the party's display name.
 */
import type { TransitionIntent } from '@stoliq/core';

type Locale = 'pl' | 'en';

const COPY: Record<Locale, Partial<Record<TransitionIntent, (name: string) => string>>> = {
  pl: {
    notify: (n) => `Powiadomiono: ${n}`,
    seat: (n) => `Posadzono: ${n}`,
    renotify: (n) => `Powiadomiono ponownie: ${n}`,
    skip: (n) => `Pominięto: ${n}`,
    no_show: (n) => `Oznaczono „nie przyszli": ${n}`,
    staff_remove: (n) => `Usunięto: ${n}`,
    guest_cancel: (n) => `Rezygnacja: ${n}`,
  },
  en: {
    notify: (n) => `Notified: ${n}`,
    seat: (n) => `Seated: ${n}`,
    renotify: (n) => `Notified again: ${n}`,
    skip: (n) => `Skipped: ${n}`,
    no_show: (n) => `Marked no-show: ${n}`,
    staff_remove: (n) => `Removed: ${n}`,
    guest_cancel: (n) => `Cancelled: ${n}`,
  },
};

/** Past-tense toast line for a completed staff mutation. Falls back to the name. */
export function toastMessage(
  intent: TransitionIntent,
  name: string,
  locale: string,
): string {
  const table = COPY[locale === 'en' ? 'en' : 'pl'];
  const fn = table[intent];
  return fn ? fn(name) : name;
}
