/**
 * Guest-surface strings NOT present in @stoliq/core i18n (which we must not edit).
 * Same warm-direct voice, „Ty" form, max one emoji (§9.5). pl default, en mirror.
 */
import type { Locale } from '@stoliq/core';

const copy = {
  pl: {
    // waiting wait-line has a core key; these are the extras §8 asks for
    onWayAddressHint: 'Do zobaczenia na miejscu.',
    seatedReview: 'Zostaw opinię',
    marketingOptional: '(opcjonalnie)',
    phoneSubmit: 'Zapisz numer',
    phoneSubmitting: 'Zapisuję…',
    phoneError: 'Sprawdź numer i spróbuj ponownie.',
    phoneSaved: 'Zapiszemy numer i damy znać SMS-em.',
    actionError: 'Coś poszło nie tak. Spróbuj ponownie.',
    cancelKeep: 'Zostajemy',
    cancelConfirmCta: 'Tak, rezygnujemy',
    notFoundHint: 'Zeskanuj kod ponownie przy wejściu.',
    liveRefresh: 'Odświeża się automatycznie',
  },
  en: {
    onWayAddressHint: 'See you here.',
    seatedReview: 'Leave a review',
    marketingOptional: '(optional)',
    phoneSubmit: 'Save number',
    phoneSubmitting: 'Saving…',
    phoneError: 'Check the number and try again.',
    phoneSaved: "We'll save it and text you.",
    actionError: 'Something went wrong. Please try again.',
    cancelKeep: "We'll stay",
    cancelConfirmCta: 'Yes, cancel',
    notFoundHint: 'Scan the code again at the entrance.',
    liveRefresh: 'Refreshes automatically',
  },
} as const;

export type GuestCopyKey = keyof (typeof copy)['pl'];

/** Local translator for guest-only strings. Falls back to pl for unknown locales. */
export function guestCopy(locale: Locale): (key: GuestCopyKey) => string {
  const dict = copy[locale] ?? copy.pl;
  return (key) => dict[key];
}
