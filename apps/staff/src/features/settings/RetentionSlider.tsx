/**
 * RODO retention control (§9.3D, §11): guest PII auto-purges after this many days.
 * Only three legal values (30 / 60 / 90 — SettingsSchema clamps to this range),
 * so a segmented control is truer + more touch-friendly than a continuous slider.
 * The selected segment glows the brand green ("this data goes away" is good news).
 */
import type { TextStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { darkTheme } from '@/lib/theme';

const OPTIONS = [30, 60, 90] as const;
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export function RetentionSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <View className="h-touch-primary flex-row gap-1 rounded-control bg-walnut-hi p-1">
      {OPTIONS.map((days) => {
        const active = value === days;
        return (
          <Pressable
            key={days}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${days} dni`}
            onPress={() => onChange(days)}
            className="flex-1 items-center justify-center rounded-control"
            style={{ backgroundColor: active ? darkTheme.status.readyFill : 'transparent' }}
          >
            <Text
              className="font-mono text-body"
              style={[TABULAR, { color: active ? darkTheme.background : darkTheme.textMuted }]}
            >
              {days}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
