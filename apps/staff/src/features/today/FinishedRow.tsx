/**
 * Dziś — one finished-visit row (§9.3C).
 *
 *   Ania · 4 os.            Posadzeni · 19:42
 *
 * Neutral by design: terminal visits are frozen history, so the status lamp is
 * the muted `neutral-end` grey (never a live colour) and nothing here is
 * tappable. Time is a Warsaw wall-clock; the party size uses tabular figures.
 */
import { type Visit, formatWarsawTime, isTerminalStatus } from '@stoliq/core';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { darkTheme } from '@/lib/theme';
import { OUTCOME_LABEL, TABULAR, TODAY_COPY } from './copy';

/** The instant a visit ended — falls back to created_at if somehow unset. */
function endedTime(visit: Visit): string {
  return formatWarsawTime(visit.ended_at ?? visit.created_at);
}

export function FinishedRow({ visit }: { visit: Visit }) {
  const { t } = useTranslation();
  const name = visit.display_name?.trim() || TODAY_COPY.noName;
  const outcome = isTerminalStatus(visit.status) ? OUTCOME_LABEL[visit.status] : '';
  const size = `${visit.party_size} ${t('common.people')}`;
  const time = endedTime(visit);

  return (
    <View
      className="flex-row items-center py-3"
      accessibilityRole="text"
      accessibilityLabel={`${name}, ${size}, ${outcome}, ${time}`}
    >
      {/* Muted indicator lamp — history never glows. */}
      <View
        className="mr-3 h-2 w-2 rounded-pill"
        style={{ backgroundColor: darkTheme.status.neutral }}
      />

      {/* Name · size */}
      <View className="flex-1 flex-row items-baseline">
        <Text className="font-ui text-body text-steam" numberOfLines={1}>
          {name}
        </Text>
        <Text className="ml-2 font-mono text-small text-smoke" style={TABULAR}>
          {`· ${size}`}
        </Text>
      </View>

      {/* Outcome · time */}
      <Text className="ml-3 font-ui text-small text-smoke">{outcome}</Text>
      <Text className="ml-2 font-mono text-small text-smoke" style={TABULAR}>
        {time}
      </Text>
    </View>
  );
}
