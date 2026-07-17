/**
 * Wallet pass model — the platform-neutral design (docs/specs/push-notifications.md).
 *
 * One source of truth for what the numerek looks like in a wallet, consumed by
 * the notifier's `apple-wallet.ts` (pass.json) and `google-wallet.ts` (Generic
 * pass). The pass IS the ticket (§9.1 signature element): giant ticket number,
 * position while waiting, and the green STOLIK GOTOWY moment when notified.
 *
 * Lives in core (§3: shared logic is never copy-pasted) so both wallet platforms
 * and any tooling render the SAME numerek, and so the design is unit-testable —
 * the Deno notifier has no test runner.
 *
 * Colors mirror packages/ui-tokens/tokens.json. `ready` is the only green in the
 * product (§9.2: if it's green, a table is ready). The hexes are duplicated here
 * deliberately — a wallet pass is built server-side where the token package's
 * Tailwind/RN outputs don't apply — and annotated with their token name.
 */
import type { VisitStatus } from './constants';

// ─── tokens (mirror of packages/ui-tokens/tokens.json) ───────────────────────
export const PASS_COLORS = {
  paper: '#F6F1E7', // token: color.paper — waiting background
  ink: '#1A1512', // token: color.ink — text on paper
  inkSoft: '#5C544C', // token: color.ink-soft — labels
  readyFill: '#1F9D5B', // token: color.ready-fill — the STOLIK GOTOWY moment
  neutralEnd: '#8F867C', // token: color.neutral-end — terminal/ended
} as const;

/** What the pass should say + look like right now. */
export interface PassModel {
  /** Stable pass identity = the visit's public_token (the guest's only key, §4.2). */
  serial: string;
  venueName: string;
  ticketNo: number;
  status: VisitStatus;
  /** Live queue position; null once notified/terminal. */
  position: number | null;
  /** Deep link back to the live ticket page. */
  ticketUrl: string;
  /** Localized copy, already resolved. */
  locale: 'pl' | 'en';
}

/** Resolved display strings + colors for one pass state. */
export interface PassPresentation {
  /** Big value: the position ("3.") or the ready shout. */
  headline: string;
  /** Label above the headline. */
  headlineLabel: string;
  /** Secondary line (wait hint / hold deadline / farewell). */
  detail: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  /** Terminal states stop updating and grey out. */
  isTerminal: boolean;
}

const COPY = {
  pl: {
    numerek: 'NUMEREK',
    inQueue: 'w kolejce',
    ready: 'STOLIK GOTOWY',
    readyDetail: 'Pokaż ten numerek przy wejściu.',
    waitingDetail: 'Odśwież się automatycznie — możesz iść na spacer.',
    onWay: 'Do zobaczenia!',
    onWayDetail: 'Czekamy na Was na miejscu.',
    ended: 'Wizyta zakończona',
    endedDetail: 'Dziękujemy! Dołącz ponownie przy wejściu.',
    seated: 'Smacznego!',
    seatedDetail: 'Miłego posiłku.',
  },
  en: {
    numerek: 'TICKET',
    inQueue: 'in queue',
    ready: 'TABLE READY',
    readyDetail: 'Show this ticket at the entrance.',
    waitingDetail: 'Updates automatically — feel free to take a walk.',
    onWay: 'See you soon!',
    onWayDetail: "We're holding your table.",
    ended: 'Visit ended',
    endedDetail: 'Thanks! Join again at the door.',
    seated: 'Enjoy!',
    seatedDetail: 'Have a great meal.',
  },
} as const;

/**
 * Map a visit state to the pass's presentation. This is the whole design
 * decision surface: waiting = calm paper + position; notified = the green
 * stamp; terminal = neutral and frozen.
 */
export function presentPass(model: PassModel): PassPresentation {
  const t = COPY[model.locale];

  switch (model.status) {
    case 'waiting':
      return {
        headline: model.position !== null ? `${model.position}.` : '—',
        headlineLabel: t.inQueue,
        detail: t.waitingDetail,
        backgroundColor: PASS_COLORS.paper,
        foregroundColor: PASS_COLORS.ink,
        labelColor: PASS_COLORS.inkSoft,
        isTerminal: false,
      };

    case 'notified':
      // The one theatrical moment (§9.4) — the whole pass turns green.
      return {
        headline: t.ready,
        headlineLabel: '',
        detail: t.readyDetail,
        backgroundColor: PASS_COLORS.readyFill,
        foregroundColor: PASS_COLORS.paper,
        labelColor: PASS_COLORS.paper,
        isTerminal: false,
      };

    case 'on_way':
      return {
        headline: t.onWay,
        headlineLabel: '',
        detail: t.onWayDetail,
        backgroundColor: PASS_COLORS.readyFill,
        foregroundColor: PASS_COLORS.paper,
        labelColor: PASS_COLORS.paper,
        isTerminal: false,
      };

    case 'seated':
      return {
        headline: t.seated,
        headlineLabel: '',
        detail: t.seatedDetail,
        backgroundColor: PASS_COLORS.neutralEnd,
        foregroundColor: PASS_COLORS.paper,
        labelColor: PASS_COLORS.paper,
        isTerminal: true,
      };

    default:
      // guest_cancelled | no_show | staff_removed — neutral, frozen (§8 state 5).
      return {
        headline: t.ended,
        headlineLabel: '',
        detail: t.endedDetail,
        backgroundColor: PASS_COLORS.neutralEnd,
        foregroundColor: PASS_COLORS.paper,
        labelColor: PASS_COLORS.paper,
        isTerminal: true,
      };
  }
}

/** `NUMEREK 47` / `TICKET 47` — the pass's identity line. */
export function ticketLabel(model: PassModel): string {
  return `${COPY[model.locale].numerek} ${model.ticketNo}`;
}

// ─── Google Wallet envelope ──────────────────────────────────────────────────

/** Ids are env-derived at the call site, so this stays a pure function. */
export interface GooglePassIds {
  /** `{issuerId}.{serial}` */
  objectId: string;
  /** `{issuerId}.{classSuffix}` */
  classId: string;
}

/** Google's localized-string envelope. */
function localized(locale: string, value: string): Record<string, unknown> {
  return { defaultValue: { language: locale, value } };
}

/**
 * The Generic pass object. Shared by the notifier's sender and the dev tooling
 * that mints save URLs, so a pass looks identical wherever it's built (§3).
 */
export function buildGooglePassObject(
  model: PassModel,
  ids: GooglePassIds,
): Record<string, unknown> {
  const p = presentPass(model);

  return {
    id: ids.objectId,
    classId: ids.classId,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    state: p.isTerminal ? 'INACTIVE' : 'ACTIVE',
    hexBackgroundColor: p.backgroundColor,

    cardTitle: localized(model.locale, model.venueName),
    // THE element (§9.4): the position, or the green shout.
    header: localized(model.locale, p.headline),
    subheader: localized(model.locale, p.headlineLabel || ticketLabel(model)),

    textModulesData: [{ id: 'detail', header: ticketLabel(model), body: p.detail }],

    barcode: {
      type: 'QR_CODE',
      value: model.ticketUrl,
      alternateText: `#${model.ticketNo}`,
    },

    linksModuleData: {
      uris: [{ uri: model.ticketUrl, description: 'Numerek na żywo' }],
    },
  };
}

/** Hex → Apple's `rgb(r, g, b)` string form (PassKit rejects hex). */
export function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}
