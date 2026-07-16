/**
 * Small shared settings controls: a Toggle (channels on/off) and a LinkRow
 * (opens the web billing / top-up / DPA in the browser — payments are always
 * web, never in-app §2, §14). Token colours only, ≥48px targets.
 */
import { useCallback } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { darkTheme } from '@/lib/theme';
import { fireHaptic } from '@/lib/haptics';

/** A labelled single-line text field for venue basics (name, city). */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-ui text-small text-smoke">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={darkTheme.textMuted}
        selectionColor={darkTheme.status.ready}
        className="h-touch-primary rounded-control bg-walnut-hi px-3 font-ui text-body text-steam"
      />
    </View>
  );
}

/** iOS-style switch built from primitives (no extra dep). Green = on. */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  const toggle = useCallback(() => {
    void fireHaptic('selection');
    onChange(!value);
  }, [value, onChange]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={toggle}
      hitSlop={8}
      className="h-8 w-14 justify-center rounded-pill px-1"
      style={{ backgroundColor: value ? darkTheme.status.readyFill : darkTheme.cardElevated }}
    >
      <View
        className="h-6 w-6 rounded-pill"
        style={{
          backgroundColor: darkTheme.text,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

/** A tappable row that opens a URL in the system browser (web billing etc.). */
export function LinkRow({
  label,
  hint,
  url,
}: {
  label: string;
  hint?: string;
  url: string;
}) {
  const open = useCallback(() => {
    void Linking.openURL(url).catch(() => {
      /* no-op: a dead link should never crash the host stand */
    });
  }, [url]);

  return (
    <Pressable
      accessibilityRole="link"
      onPress={open}
      className="min-h-touch-min flex-row items-center justify-between gap-3 active:opacity-70"
    >
      <View className="flex-1">
        <Text className="font-ui text-body text-steam">{label}</Text>
        {hint ? <Text className="mt-0.5 font-ui text-caption text-smoke">{hint}</Text> : null}
      </View>
      <Text className="font-ui text-body" style={{ color: darkTheme.status.ready }}>
        ↗
      </Text>
    </Pressable>
  );
}
