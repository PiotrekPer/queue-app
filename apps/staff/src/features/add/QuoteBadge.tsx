/**
 * The huge auto-quote on the QR screen (§9.3B): „ok. ~25 min", with ± controls
 * to override in 5-minute steps (→ quote_source='manual', event `quote_overridden`).
 * This lives on the PAPER screen, so it uses ink/ink-soft colours, not steam.
 */
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { fireHaptic } from '@/lib/haptics';
import { LIMITS } from '@stoliq/core';
import { useAddCopy } from './copy';

interface Props {
  quoteMinutes: number;
  /** Deltas are ±1 step (= ±5 min); parent clamps + flips quote_source to manual. */
  onAdjust: (deltaSteps: number) => void;
}

export function QuoteBadge({ quoteMinutes, onAdjust }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const copy = useAddCopy();

  function adjust(deltaSteps: number): void {
    void fireHaptic('selection');
    onAdjust(deltaSteps);
  }

  const atMin = quoteMinutes <= LIMITS.minQuoteMinutes;
  const atMax = quoteMinutes >= LIMITS.maxQuoteMinutes;

  return (
    <View className="items-center">
      <View className="flex-row items-center">
        <StepKey label="−" onPress={() => adjust(-1)} disabled={atMin} />

        {/* „ok. 25 min" — mono tabular, huge (§9.2). */}
        <View className="mx-6 flex-row items-baseline">
          <Text className="mr-2 font-ui text-h2 text-ink-soft">{copy('quotePrefix')}</Text>
          <Text className="font-mono text-ticket-no leading-none text-ink" style={TABULAR}>
            {quoteMinutes}
          </Text>
          <Text className="ml-2 font-ui text-h2 text-ink-soft">{t('common.minutesShort')}</Text>
        </View>

        <StepKey label="+" onPress={() => adjust(1)} disabled={atMax} />
      </View>

      <Text className="mt-2 font-ui text-small text-ink-soft">{copy('quoteAdjustHint')}</Text>
    </View>
  );
}

/** Round ± control on paper. ≥56px target. */
function StepKey({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-touch-primary w-touch-primary items-center justify-center rounded-pill bg-paper-hi ${
        disabled ? 'opacity-30' : 'active:bg-paper'
      }`}
      style={BORDER}
    >
      <Text className="font-mono text-h1 leading-none text-ink" style={TABULAR}>
        {label}
      </Text>
    </Pressable>
  );
}

const TABULAR = { fontVariant: ['tabular-nums' as const] };
/** 1px ink@12% hairline — the only border allowed on the paper controls. */
const BORDER = { borderWidth: 1, borderColor: 'rgba(26,21,18,0.12)' };
