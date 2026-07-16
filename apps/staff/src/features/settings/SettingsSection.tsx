/**
 * A settings card (§9.3D): walnut surface, rounded-card, a small smoke-coloured
 * title, and its controls stacked inside. One quiet card per concern — no
 * decoration (§9.1). Everything else in the product is louder than Ustawienia.
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface SettingsSectionProps {
  title: string;
  /** optional short line under the title (e.g. RODO reassurance copy) */
  subtitle?: string;
  children: ReactNode;
}

export function SettingsSection({ title, subtitle, children }: SettingsSectionProps) {
  return (
    <View className="rounded-card bg-walnut px-4 py-4">
      <Text className="font-ui text-caption uppercase tracking-wide text-smoke">{title}</Text>
      {subtitle ? (
        <Text className="mt-1 font-ui text-small text-smoke">{subtitle}</Text>
      ) : null}
      <View className="mt-3 gap-3">{children}</View>
    </View>
  );
}

/**
 * A labelled row inside a section: label on the left, control on the right,
 * vertically centred, ≥48px tall so any inline control keeps its touch target.
 */
export function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View className="min-h-touch-min flex-row items-center justify-between gap-3">
      <View className="flex-1">
        <Text className="font-ui text-body text-steam">{label}</Text>
        {hint ? <Text className="mt-0.5 font-ui text-caption text-smoke">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}
