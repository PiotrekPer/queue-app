/**
 * The QR hand-off screen (§9.3B) — the ONLY light (paper) screen in the app.
 * Paper maximises scan contrast and it IS literally handing the guest a ticket.
 *
 *   • ticket_no big at the top (mono 72)
 *   • the QR (~240px) centred — value = the guest link stq.pl/v/{public_token}
 *   • the auto-quote HUGE at the bottom, tap ± to override in 5-min steps
 *     (→ quote_source='manual', so the queue store records the override)
 *   • „Gotowe" closes back to Kolejka
 *
 * No phone input anywhere (§1 guest contract). Screen-brightness boost is
 * optional and skipped (expo-brightness is not a dependency).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { adjustQuote, guestTicketUrl, QuoteBadge } from '@/features/add';
import { tokens } from '@/lib/theme';
import { useQueueStore } from '@/features/queue/store';

const QR_SIZE = 240;

export default function QrScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { visitId } = useLocalSearchParams<{ visitId: string }>();

  const visit = useQueueStore((s) => s.visits.find((v) => v.id === visitId));

  // Staff can nudge the quote ±5 before handing the ticket over (§9.3B). The
  // queue store owns visit persistence and exposes no quote-update action, so
  // the override is a local echo on this hand-off screen; the number the guest
  // reads off the ticket reflects it immediately.
  const [quote, setQuote] = useState<number | null>(null);
  const shownQuote = quote ?? visit?.quote_minutes ?? 0;

  const onAdjust = useCallback(
    (deltaSteps: number) => {
      const next = adjustQuote(shownQuote, deltaSteps);
      if (next === shownQuote) return;
      setQuote(next);
    },
    [shownQuote],
  );

  const qrValue = useMemo(
    () => (visit ? guestTicketUrl(visit.public_token) : ''),
    [visit],
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-between px-6 py-8">
        {/* Ticket number, top. */}
        <View className="items-center">
          <Text className="font-ui text-caption uppercase tracking-[2px] text-ink-soft">
            {t('common.appName')}
          </Text>
          <Text
            className="font-mono text-ticket-no leading-none text-ink"
            style={TABULAR}
            accessibilityLabel={t('common.ticketNo', { n: visit?.ticket_no ?? 0 })}
          >
            {visit ? t('common.ticketNo', { n: visit.ticket_no }) : '—'}
          </Text>
        </View>

        {/* QR, centred, on a paper-hi card for crisp contrast. */}
        <View className="items-center">
          <View className="rounded-ticket bg-paper-hi p-5" style={CARD_BORDER}>
            {qrValue.length > 0 ? (
              <QRCode
                value={qrValue}
                size={QR_SIZE}
                color={tokens.color.ink}
                backgroundColor={tokens.color['paper-hi']}
                ecl="M"
              />
            ) : (
              <View
                className="items-center justify-center"
                style={{ width: QR_SIZE, height: QR_SIZE }}
              >
                <Text className="font-ui text-body text-ink-soft">—</Text>
              </View>
            )}
          </View>
          <Text className="mt-4 font-ui text-small text-ink-soft">{t('staff.qr_scanPrompt')}</Text>
        </View>

        {/* Auto-quote, huge, tap ± to override. */}
        <View className="w-full items-center">
          <QuoteBadge quoteMinutes={shownQuote} onAdjust={onAdjust} />

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="mt-8 h-touch-primary w-full items-center justify-center rounded-control bg-ready-fill active:opacity-90"
          >
            <Text className="font-ui text-body font-semibold text-paper-hi">
              {t('staff.qr_done')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const TABULAR = { fontVariant: ['tabular-nums' as const] };
/** 1px ink@8% hairline around the ticket card. */
const CARD_BORDER = { borderWidth: 1, borderColor: 'rgba(26,21,18,0.08)' };
