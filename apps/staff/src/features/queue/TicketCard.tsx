/**
 * TicketCard — one party in the Kolejka rail (§9.3A). The instrument's basic unit.
 *
 * Anatomy (min height 88):
 *  - left 4px status colour bar (the indicator lamp, §9.2)
 *  - Row 1: „Ania · 4 os." (card-name, steam) + „Nr 47" (mono, smoke, right)
 *  - Row 2: StatusChip + elapsed/quote (mono; amber when over quote — the host's
 *           early-warning system, §9.3A/§6) + optional „+5 min" chip
 *  - right: context action — Powiadom (waiting) → notify; Posadź (notified|on_way)
 *           → seat. A hold-expired notified card pulses (§5 #7) and swaps the
 *           single action for an inline 3-button row: renotify / skip / no_show.
 *
 * Mutations run through the store's applyIntent (optimistic + haptic + undo);
 * the parent (rail) shows the Undo toast.
 */
import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { TransitionIntent, Visit } from '@stoliq/core';
import { elapsedMinutes } from '@stoliq/core';
import { darkTheme, statusColor } from '@/lib/theme';
import { StatusChip } from './StatusChip';
import { QueueButton } from './QueueButton';

export interface TicketCardProps {
  visit: Visit;
  /** current wall clock in ms (shared useNow tick) */
  nowMs: number;
  /** venue hold length in minutes (scales the notified countdown ring) */
  holdMinutes: number;
  onIntent: (visitId: string, intent: TransitionIntent) => void;
}

/** A notified visit whose hold deadline has passed (§5 #7 pulsing state). */
export function isHoldExpired(visit: Visit, nowMs: number): boolean {
  return (
    visit.status === 'notified' &&
    visit.hold_expires_at != null &&
    Date.parse(visit.hold_expires_at) <= nowMs
  );
}

/**
 * A guest who used „+5 minut" shows a chip (§5 #12). The local/demo build doesn't
 * track delay uses on the visit row, so this is always false here; kept as a seam
 * so the card renders the chip once other tracks surface delay state.
 */
function hasDelayChip(_visit: Visit): boolean {
  return false;
}

export function TicketCard({ visit, nowMs, holdMinutes, onIntent }: TicketCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const barColor = statusColor(visit.status);
  const expired = isHoldExpired(visit, nowMs);

  // elapsed vs quote — turns amber once we're over the quote (§6, §9.3A).
  const elapsed = elapsedMinutes(visit.created_at, new Date(nowMs).toISOString());
  const overQuote = elapsed > visit.quote_minutes;

  // Pulse animation for the hold-expired card (§9.2 motion.pulse), Reduce-Motion aware.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (expired && !reduceMotion) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [expired, reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.015 }],
    borderColor: darkTheme.status.notified,
    borderWidth: pulse.value > 0.001 ? 1.5 : 0,
  }));

  return (
    <Animated.View
      style={pulseStyle}
      className="overflow-hidden rounded-card bg-walnut"
    >
      <View className="flex-row" style={{ minHeight: 88 }}>
        {/* left status lamp */}
        <View style={{ width: 4, backgroundColor: barColor }} />

        <View className="flex-1 px-4 py-3">
          {/* Row 1: name + ticket number */}
          <View className="flex-row items-center justify-between">
            <Text
              className="font-ui text-card-name text-steam"
              style={{ fontWeight: '600' }}
              numberOfLines={1}
            >
              {visit.display_name}
            </Text>
            <Text className="font-mono text-small text-smoke">
              {t('common.ticketNo', { n: visit.ticket_no })}
            </Text>
          </View>

          {/* Row 2: status chip + elapsed/quote + optional delay chip */}
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <StatusChip visit={visit} nowMs={nowMs} holdMinutes={holdMinutes} />
              {hasDelayChip(visit) && (
                <View className="ml-2 rounded-pill bg-walnut-hi px-2 py-0.5">
                  <Text className="font-ui text-caption text-smoke">
                    {t('staff.chipDelay')}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="font-mono text-small"
              style={{ color: overQuote ? darkTheme.status.notified : darkTheme.textMuted }}
            >
              {t('staff.elapsedOfQuote', { elapsed, quote: visit.quote_minutes })}
            </Text>
          </View>

          {/* Hold-expired: 3-button decision row (§5 #7) */}
          {expired && (
            <View className="mt-3 flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <QueueButton
                  compact
                  variant="primary"
                  label={t('staff.actionRenotify')}
                  onPress={() => onIntent(visit.id, 'renotify')}
                />
              </View>
              <View className="flex-1">
                <QueueButton
                  compact
                  variant="neutral"
                  label={t('staff.actionSkip')}
                  onPress={() => onIntent(visit.id, 'skip')}
                />
              </View>
              <View className="flex-1">
                <QueueButton
                  compact
                  variant="danger"
                  label={t('staff.actionNoShow')}
                  onPress={() => onIntent(visit.id, 'no_show')}
                />
              </View>
            </View>
          )}
        </View>

        {/* Right context action (hidden when the expired decision row is showing) */}
        {!expired && (
          <View className="items-center justify-center pr-3">
            {visit.status === 'waiting' ? (
              <QueueButton
                variant="primary"
                label={t('staff.actionNotify')}
                onPress={() => onIntent(visit.id, 'notify')}
              />
            ) : (
              <QueueButton
                variant="ready"
                label={t('staff.actionSeat')}
                onPress={() => onIntent(visit.id, 'seat')}
              />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}
