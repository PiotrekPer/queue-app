/**
 * Staff-app theme helpers. Colours come from @stoliq/ui-tokens (dark surface).
 * Status IS colour (§9.2): waiting=blue, notified=amber, on_way=green, terminal=neutral.
 * Never use these for decoration.
 */
import type { VisitStatus } from '@stoliq/core';
import { darkTheme, radius, space, tokens } from '@stoliq/ui-tokens';

export { darkTheme, radius, space, tokens };

/** Indicator-lamp colour for a visit's status bar/chip. */
export function statusColor(status: VisitStatus): string {
  switch (status) {
    case 'waiting':
      return darkTheme.status.waiting;
    case 'notified':
      return darkTheme.status.notified;
    case 'on_way':
      return darkTheme.status.ready;
    case 'seated':
      return darkTheme.status.ready;
    case 'no_show':
    case 'guest_cancelled':
    case 'staff_removed':
      return darkTheme.status.neutral;
    default:
      return darkTheme.status.neutral;
  }
}
