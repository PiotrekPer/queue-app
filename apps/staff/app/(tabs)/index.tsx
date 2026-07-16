/**
 * Kolejka (home) — the sales-demo screen (§9.3A). The dark, warm "service-bar
 * instrument": venue name + live count pill + big ＋ Dodaj, then a vertical rail
 * of swipeable ticket cards. Every mutation is optimistic, haptic, and undoable.
 *
 * The screen owns two things beyond the store: the shared 1s clock (so elapsed /
 * hold values stay live) and the Undo toast (armed after each mutation).
 */
import { useCallback, useMemo, useState } from 'react';
import { View, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SETTINGS, type TransitionIntent, type Visit } from '@stoliq/core';
import {
  useActiveVisits,
  useHydrateQueue,
  useQueueCount,
  useQueueStore,
  venueName,
} from '@/features/queue/store';
import { QueueHeader } from '@/features/queue/QueueHeader';
import { EmptyState } from '@/features/queue/EmptyState';
import { SwipeableTicketCard } from '@/features/queue/SwipeableTicketCard';
import { UndoToast } from '@/features/queue/UndoToast';
import { useNow } from '@/features/queue/useNow';
import { toastMessage } from '@/features/queue/toastCopy';

const HOLD_MINUTES = DEFAULT_SETTINGS.hold_minutes;

export default function KolejkaScreen() {
  useHydrateQueue();
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const nowMs = useNow();

  const visits = useActiveVisits();
  const count = useQueueCount();
  const applyIntent = useQueueStore((s) => s.applyIntent);
  const undoLast = useQueueStore((s) => s.undoLast);

  // Undo toast: bump the nonce + set the past-tense line on each mutation (§9.3A).
  const [toast, setToast] = useState<{ nonce: number; message: string }>({
    nonce: 0,
    message: '',
  });

  const onIntent = useCallback(
    (visitId: string, intent: TransitionIntent) => {
      const visit = useQueueStore.getState().visits.find((v) => v.id === visitId);
      const name = visit?.display_name ?? '';
      applyIntent(visitId, intent);
      setToast((prev) => ({
        nonce: prev.nonce + 1,
        message: toastMessage(intent, name, i18n.language),
      }));
    },
    [applyIntent, i18n.language],
  );

  const onUndo = useCallback(() => {
    undoLast();
  }, [undoLast]);

  const onAdd = useCallback(() => {
    router.push('/add');
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: Visit }) => (
      <SwipeableTicketCard
        visit={item}
        nowMs={nowMs}
        holdMinutes={HOLD_MINUTES}
        onIntent={onIntent}
      />
    ),
    [nowMs, onIntent],
  );

  const contentPadding = useMemo(
    () => ({ paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }),
    [insets.bottom],
  );

  return (
    <View className="flex-1 bg-espresso" style={{ paddingTop: insets.top }}>
      <QueueHeader venueName={venueName} count={count} onAdd={onAdd} />

      {visits.length === 0 ? (
        <EmptyState onAdd={onAdd} />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={contentPadding}
          ItemSeparatorComponent={Separator}
          showsVerticalScrollIndicator={false}
        />
      )}

      <UndoToast nonce={toast.nonce} message={toast.message} onUndo={onUndo} />
    </View>
  );
}

/** 12px gap between ticket cards (§9.3A). */
function Separator() {
  return <View style={{ height: 12 }} />;
}
