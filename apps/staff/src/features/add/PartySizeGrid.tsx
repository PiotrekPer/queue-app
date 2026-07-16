/**
 * Step 1 of the sacred ≤5s add path (§9.3B): a 3×3 grid of giant number buttons
 * 1–8 plus „9+". Tap a number → auto-advance. „9+" opens the stepper (up to 30).
 * One-handed, thumb-friendly: every target is far bigger than the 56px primary.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { fireHaptic } from '@/lib/haptics';
import { LIMITS } from '@stoliq/core';
import { useAddCopy } from './copy';

const QUICK_SIZES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

interface Props {
  /** Called with the chosen party size once the guest picks/commits it. */
  onPick: (size: number) => void;
}

export function PartySizeGrid({ onPick }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const copy = useAddCopy();
  const [custom, setCustom] = useState<number | null>(null);

  function pickQuick(size: number): void {
    void fireHaptic('light');
    onPick(size);
  }

  if (custom !== null) {
    return <CustomStepper value={custom} onChange={setCustom} onDone={() => onPick(custom)} />;
  }

  return (
    <View className="flex-1 px-5">
      <Text className="mb-6 text-center font-display text-h2 text-steam">
        {t('staff.add_step_size')}
      </Text>
      <View className="flex-row flex-wrap justify-between">
        {QUICK_SIZES.map((size) => (
          <SizeButton key={size} label={String(size)} onPress={() => pickQuick(size)} />
        ))}
        <SizeButton
          label={copy('sizeMore')}
          onPress={() => {
            void fireHaptic('light');
            setCustom(9);
          }}
        />
      </View>
    </View>
  );
}

/** One giant tappable cell. Sized so three fit per row with a 12px gutter. */
function SizeButton({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="mb-3 aspect-square w-[31%] items-center justify-center rounded-card bg-walnut active:bg-walnut-hi"
    >
      <Text className="font-mono text-position leading-none text-steam" style={TABULAR}>
        {label}
      </Text>
    </Pressable>
  );
}

/** „9+" path: a big +/− stepper from 9 up to the party-size ceiling (§4 CHECK 1–30). */
function CustomStepper({
  value,
  onChange,
  onDone,
}: {
  value: number;
  onChange: (n: number) => void;
  onDone: () => void;
}): React.JSX.Element {
  const copy = useAddCopy();

  function step(delta: number): void {
    const next = Math.min(LIMITS.maxPartySize, Math.max(9, value + delta));
    if (next !== value) void fireHaptic('selection');
    onChange(next);
  }

  return (
    <View className="flex-1 items-center px-5">
      <Text className="mb-8 text-center font-display text-h2 text-steam">
        {copy('sizeCustomTitle')}
      </Text>
      <View className="flex-row items-center justify-center">
        <StepKey label="−" onPress={() => step(-1)} disabled={value <= 9} />
        <View className="mx-8 min-w-[120px] items-center">
          <Text className="font-mono text-ticket-no leading-none text-steam" style={TABULAR}>
            {value}
          </Text>
        </View>
        <StepKey label="+" onPress={() => step(1)} disabled={value >= LIMITS.maxPartySize} />
      </View>

      <Pressable
        onPress={() => {
          void fireHaptic('light');
          onDone();
        }}
        accessibilityRole="button"
        className="mt-12 h-touch-primary items-center justify-center rounded-control bg-ready-fill px-10 active:opacity-90"
      >
        <Text className="font-ui text-body font-semibold text-steam">{copy('sizeCustomDone')}</Text>
      </Pressable>
    </View>
  );
}

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
      className={`h-20 w-20 items-center justify-center rounded-card bg-walnut active:bg-walnut-hi ${
        disabled ? 'opacity-30' : ''
      }`}
    >
      <Text className="font-mono text-h1 leading-none text-steam" style={TABULAR}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Tabular figures for every number (§9.2). */
const TABULAR = { fontVariant: ['tabular-nums' as const] };
