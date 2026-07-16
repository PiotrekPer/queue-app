/**
 * A ±stepper for the numeric venue settings (hold minutes, heads-up thresholds,
 * quote defaults). Two 48px round buttons flank a big mono tabular value so the
 * digit reads like the rest of the product's numbers (§9.2). Haptic on change.
 */
import { useCallback } from 'react';
import type { TextStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { fireHaptic } from '@/lib/haptics';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** short unit shown after the value, e.g. „min" */
  unit?: string;
  /** fixed width for the value column so rows align (mono tabular) */
  valueWidth?: number;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  valueWidth = 64,
}: StepperProps) {
  const bump = useCallback(
    (delta: number) => {
      const next = Math.min(max, Math.max(min, value + delta));
      if (next === value) return;
      void fireHaptic('selection');
      onChange(next);
    },
    [value, min, max, onChange],
  );

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View className="flex-row items-center gap-2">
      <StepButton label="−" onPress={() => bump(-step)} disabled={atMin} />
      <View style={{ width: valueWidth }} className="flex-row items-baseline justify-center gap-1">
        <Text className="font-mono text-timer text-steam" style={TABULAR}>
          {value}
        </Text>
        {unit ? <Text className="font-ui text-caption text-smoke">{unit}</Text> : null}
      </View>
      <StepButton label="+" onPress={() => bump(step)} disabled={atMax} />
    </View>
  );
}

function StepButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'więcej' : 'mniej'}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={`h-touch-min w-touch-min items-center justify-center rounded-control ${
        disabled ? 'bg-walnut' : 'bg-walnut-hi active:bg-walnut'
      }`}
    >
      <Text
        className={`font-ui text-h2 ${disabled ? 'text-smoke' : 'text-steam'}`}
        style={{ opacity: disabled ? 0.4 : 1 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };
