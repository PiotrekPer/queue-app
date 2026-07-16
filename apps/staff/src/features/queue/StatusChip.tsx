/**
 * StatusChip — the status "indicator lamp" in words (§9.3A card Row 2).
 *  - waiting  → „Czeka" (blue)
 *  - notified → „Powiadomiono m:ss" (amber) with a countdown ring around a bell
 *               showing hold time left; when the hold has expired the ring reads 0
 *  - on_way   → „W drodze" (green)
 *  - +5 min   → a separate delay chip (rendered by the card when a guest delayed)
 * Status IS colour — never decorative (§9.2). Colours come from statusColor().
 */
import { View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import type { Visit } from '@stoliq/core';
import { statusColor } from '@/lib/theme';
import { CountdownRing } from './CountdownRing';

interface StatusChipProps {
  visit: Visit;
  /** current wall clock in ms (from the shared useNow tick) */
  nowMs: number;
  /** hold length in minutes (venue setting) used to scale the ring */
  holdMinutes: number;
}

/** m:ss since the visit was notified (host reads how long ago at a glance). */
function sinceNotified(notifiedAtIso: string, nowMs: number): string {
  const secs = Math.max(0, Math.floor((nowMs - Date.parse(notifiedAtIso)) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function BellGlyph({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2a6 6 0 0 0-6 6c0 4-1.5 5.5-2 6.5h16c-.5-1-2-2.5-2-6.5a6 6 0 0 0-6-6Zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z"
        fill={color}
      />
    </Svg>
  );
}

export function StatusChip({ visit, nowMs, holdMinutes }: StatusChipProps) {
  const { t } = useTranslation();
  const color = statusColor(visit.status);

  if (visit.status === 'notified') {
    // Ring progress = fraction of hold remaining (0 when expired).
    let progress = 1;
    if (visit.notified_at && visit.hold_expires_at) {
      const total = holdMinutes * 60_000;
      const remaining = Date.parse(visit.hold_expires_at) - nowMs;
      progress = total > 0 ? remaining / total : 0;
    }
    const label = visit.notified_at
      ? t('staff.statusNotified', { time: sinceNotified(visit.notified_at, nowMs) })
      : t('staff.statusNotified', { time: '0:00' });

    return (
      <View className="flex-row items-center">
        <View className="mr-1.5 items-center justify-center">
          <CountdownRing progress={progress} color={color} size={24} />
          <View className="absolute">
            <BellGlyph color={color} />
          </View>
        </View>
        <Text className="font-mono text-small" style={{ color }}>
          {label}
        </Text>
      </View>
    );
  }

  const label =
    visit.status === 'waiting'
      ? t('staff.statusWaiting')
      : visit.status === 'on_way'
        ? t('staff.statusOnWay')
        : '';

  return (
    <View
      className="rounded-pill px-2.5 py-1"
      style={{ backgroundColor: `${color}22` }}
    >
      <Text className="font-ui text-small" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
