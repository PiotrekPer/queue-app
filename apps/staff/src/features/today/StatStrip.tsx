/**
 * Dziś — the mono stat strip (§9.3C).
 *
 *   Przyjęte 84 · Posadzone 71 · Rezygnacje 9 · No-show 4 · Mediana 19 min
 *
 * Calm and factual: tabular mono figures, no charts, no colour-as-decoration.
 * The rich analytics live in the daily email — this is just an honest tally.
 */
import { type Visit, elapsedMinutes, median } from '@stoliq/core';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { darkTheme } from '@/lib/theme';
import { TABULAR, TODAY_COPY } from './copy';

export interface TodayStats {
  accepted: number;
  seated: number;
  cancelled: number;
  noShow: number;
  /** median waited minutes across seated visits (null when none seated yet) */
  medianWaitedMin: number | null;
}

/**
 * Reduce today's visits to the five headline numbers.
 * waited = created_at → seated_at for each seated visit (§9.3C).
 */
export function computeTodayStats(visits: readonly Visit[]): TodayStats {
  let seated = 0;
  let cancelled = 0;
  let noShow = 0;
  const waited: number[] = [];

  for (const v of visits) {
    switch (v.status) {
      case 'seated': {
        seated += 1;
        if (v.seated_at) {
          waited.push(elapsedMinutes(v.created_at, v.seated_at));
        }
        break;
      }
      case 'guest_cancelled':
        cancelled += 1;
        break;
      case 'no_show':
        noShow += 1;
        break;
      default:
        break;
    }
  }

  return {
    accepted: visits.length,
    seated,
    cancelled,
    noShow,
    medianWaitedMin: waited.length > 0 ? Math.round(median(waited)) : null,
  };
}

/** A single „Label 42" pair in the strip. Value is mono tabular. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center px-3">
      <Text
        className="font-mono text-h2 text-steam"
        style={TABULAR}
        accessibilityLabel={`${label} ${value}`}
      >
        {value}
      </Text>
      <Text className="mt-1 font-ui text-caption text-smoke">{label}</Text>
    </View>
  );
}

/** Thin vertical hairline separating stats (the „·" of the spec, made structural). */
function Divider() {
  return <View className="mx-1 h-8 w-px" style={{ backgroundColor: darkTheme.hairline }} />;
}

export function StatStrip({ visits }: { visits: readonly Visit[] }) {
  const stats = useMemo(() => computeTodayStats(visits), [visits]);
  const medianText =
    stats.medianWaitedMin === null
      ? '—'
      : `${stats.medianWaitedMin} ${TODAY_COPY.minutesShort}`;

  return (
    <View
      className="flex-row items-center justify-center rounded-card bg-walnut px-2 py-4"
      accessibilityRole="summary"
    >
      <Stat label={TODAY_COPY.accepted} value={String(stats.accepted)} />
      <Divider />
      <Stat label={TODAY_COPY.seated} value={String(stats.seated)} />
      <Divider />
      <Stat label={TODAY_COPY.cancelled} value={String(stats.cancelled)} />
      <Divider />
      <Stat label={TODAY_COPY.noShow} value={String(stats.noShow)} />
      <Divider />
      <Stat label={TODAY_COPY.median} value={medianText} />
    </View>
  );
}
