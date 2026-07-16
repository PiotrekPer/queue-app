/**
 * SMS segment analysis (§7.5) — the Polish cost trap, enforced in code.
 *
 * GSM-7 packs 160 chars/segment (153 in a multipart message). A *single* Polish
 * diacritic (ą ć ę ł ń ó ś ź ż) forces the whole message to UCS-2 → 70 chars/
 * segment (67 multipart), ~2–3× the cost. Default templates ship diacritic-free.
 */

/** GSM 03.38 basic character set (each = 1 septet). */
const GSM7_BASIC = new Set(
  [
    '@',
    '£',
    '$',
    '¥',
    'è',
    'é',
    'ù',
    'ì',
    'ò',
    'Ç',
    '\n',
    'Ø',
    'ø',
    '\r',
    'Å',
    'å',
    'Δ',
    '_',
    'Φ',
    'Γ',
    'Λ',
    'Ω',
    'Π',
    'Ψ',
    'Σ',
    'Θ',
    'Ξ',
    'Æ',
    'æ',
    'ß',
    'É',
    ' ',
    '!',
    '"',
    '#',
    '¤',
    '%',
    '&',
    "'",
    '(',
    ')',
    '*',
    '+',
    ',',
    '-',
    '.',
    '/',
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    ':',
    ';',
    '<',
    '=',
    '>',
    '?',
    '¡',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    'Ä',
    'Ö',
    'Ñ',
    'Ü',
    '§',
    '¿',
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    'ä',
    'ö',
    'ñ',
    'ü',
    'à',
  ],
);

/** GSM 03.38 extension set (each = 2 septets). */
const GSM7_EXTENSION = new Set(['\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€']);

/** The nine Polish diacritics that break GSM-7 (§7.5). */
export const POLISH_DIACRITICS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'] as const;

export type SmsEncoding = 'GSM-7' | 'UCS-2';

export interface SegmentInfo {
  encoding: SmsEncoding;
  segments: number;
  /** characters remaining before the next segment starts */
  chars_left: number;
  /** effective length (septets for GSM-7, UTF-16 units for UCS-2) */
  length: number;
  /** per-segment capacity for the chosen encoding */
  perSegment: number;
}

const GSM7_SINGLE = 160;
const GSM7_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

/** Count GSM-7 septets, or return null if any char is outside GSM-7. */
function gsm7Septets(body: string): number | null {
  let count = 0;
  for (const ch of body) {
    if (GSM7_BASIC.has(ch)) count += 1;
    else if (GSM7_EXTENSION.has(ch)) count += 2;
    else return null;
  }
  return count;
}

/** True if the body contains any Polish diacritic (the common UCS-2 trigger). */
export function containsPolishDiacritic(body: string): boolean {
  return POLISH_DIACRITICS.some((d) => body.includes(d) || body.includes(d.toUpperCase()));
}

/**
 * Analyse an SMS body → encoding, segment count, and characters left in the
 * current segment. `packages/core` export used by the template editor's live
 * counter (§7.5) and the send pipeline's cost accounting.
 */
export function analyze(body: string): SegmentInfo {
  const septets = gsm7Septets(body);

  if (septets !== null) {
    const segments = septets <= GSM7_SINGLE ? 1 : Math.ceil(septets / GSM7_MULTI);
    const perSegment = segments <= 1 ? GSM7_SINGLE : GSM7_MULTI;
    return {
      encoding: 'GSM-7',
      segments,
      perSegment,
      length: septets,
      chars_left: segments * perSegment - septets,
    };
  }

  // UCS-2: count UTF-16 code units (surrogate pairs = 2).
  const units = body.length;
  const segments = units <= UCS2_SINGLE ? 1 : Math.ceil(units / UCS2_MULTI);
  const perSegment = segments <= 1 ? UCS2_SINGLE : UCS2_MULTI;
  return {
    encoding: 'UCS-2',
    segments,
    perSegment,
    length: units,
    chars_left: segments * perSegment - units,
  };
}
