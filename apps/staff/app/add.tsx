/**
 * The Add flow — the sacred ≤5s, one-hand path (§1, §9.3B).
 * Full-screen modal, TWO steps max:
 *   1. party size (giant 3×3 grid + „9+" stepper) → auto-advances on tap
 *   2. name (autofocus, „Pomiń →" equally prominent) → commit or skip
 * On commit we optimistically add the visit to the queue store and hand off to
 * the QR screen. Phone is deliberately absent here (§1 guest contract).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isActiveStatus } from '@stoliq/core';
import { NameStep, PartySizeGrid, autoQuoteForSize, DEMO_VENUE_ID } from '@/features/add';
import { useAuthStore } from '@/features/auth/store';
import { useQueueStore } from '@/features/queue/store';

type Step = 'size' | 'name';

export default function AddScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('size');
  const [partySize, setPartySize] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);

  function pickSize(size: number): void {
    setPartySize(size);
    setStep('name');
  }

  async function commit(displayName: string | null): Promise<void> {
    if (partySize === null || committing) return;
    setCommitting(true);
    // Parties currently ahead → shapes the humble default quote (§6).
    const partiesAhead = useQueueStore
      .getState()
      .visits.filter((v) => isActiveStatus(v.status)).length;
    const quote = autoQuoteForSize(partySize, partiesAhead);

    try {
      // With a backend, the server assigns the authoritative id + public_token
      // (the QR must encode the server token), so await the created row.
      const visit = await useQueueStore.getState().addVisit({
        // Real venue once signed in (RLS/RPC scope by it); demo id offline.
        venue_id: useAuthStore.getState().venueId ?? DEMO_VENUE_ID,
        party_size: partySize,
        display_name: displayName,
        quote_minutes: quote,
        quote_source: 'auto',
        type: 'walk_in',
      });
      // Replace so „back" from the QR screen lands on Kolejka, not this modal.
      router.replace(`/qr/${visit.id}`);
    } catch (err) {
      console.warn('[add] create failed', err);
      setCommitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-espresso" edges={['top', 'bottom']}>
      {/* Header: title + close. Close target ≥48px, top-left thumb-safe. */}
      <View className="mb-2 flex-row items-center justify-between px-5 pt-2">
        <Text className="font-display text-h1 text-steam">{t('staff.add')}</Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="h-12 w-12 items-center justify-center rounded-pill active:bg-walnut"
          hitSlop={8}
        >
          <Text className="font-ui text-h2 text-smoke">✕</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step === 'size' ? (
          <PartySizeGrid onPick={pickSize} />
        ) : (
          <NameStep onDone={commit} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
