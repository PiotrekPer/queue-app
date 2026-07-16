/**
 * Dziś (today) — the calm end-of-day tally (§9.3C).
 *
 * A mono stat strip (Przyjęte · Posadzone · Rezygnacje · No-show · Mediana) over
 * a neutral list of finished visits. Rich analytics live in the daily email, so
 * this screen stays factual and quiet — dark theme, tabular figures, no colour
 * as decoration and nothing tappable.
 */
import type { Visit } from '@stoliq/core';
import { useFinishedVisits, useTodayVisits } from '@/features/queue/store';
import { FinishedRow, StatStrip, TODAY_COPY } from '@/features/today';
import { useTranslation } from 'react-i18next';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTheme } from '@/lib/theme';

/** Empty state when the day hasn't started (no finished visits yet). */
function EmptyToday() {
  return (
    <View className="items-center px-8 py-16">
      <Text className="text-center font-display text-h2 text-steam">{TODAY_COPY.emptyTitle}</Text>
      <Text className="mt-2 text-center font-ui text-body text-smoke">
        {TODAY_COPY.emptySubtitle}
      </Text>
    </View>
  );
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const todayVisits = useTodayVisits();
  const finished = useFinishedVisits();

  return (
    <View className="flex-1 bg-espresso" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-2 pt-2">
        <Text className="font-display text-h1 text-steam">{t('staff.tabToday')}</Text>
      </View>

      <FlatList<Visit>
        data={finished}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <FinishedRow visit={item} />}
        ListHeaderComponent={
          <View className="pb-2 pt-1">
            <StatStrip visits={todayVisits} />
          </View>
        }
        ListEmptyComponent={<EmptyToday />}
        ItemSeparatorComponent={() => (
          <View className="h-px" style={{ backgroundColor: darkTheme.hairline }} />
        )}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
