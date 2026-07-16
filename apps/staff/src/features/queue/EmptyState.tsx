/**
 * EmptyState — the calm "empty queue" moment (§9.3A): a big outline numerek
 * graphic, „Pusta kolejka. Miły widok — albo cisza przed burzą." and a ＋ Dodaj.
 * The one place the queue screen is allowed to breathe.
 */
import { View, Text, Pressable } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';

interface EmptyStateProps {
  onAdd: () => void;
}

/** Outline "numerek" ticket motif — the signature element, quiet here (§9.1). */
function OutlineNumerek() {
  return (
    <View className="items-center justify-center">
      <Svg width={180} height={120} viewBox="0 0 180 120">
        <Rect
          x={6}
          y={6}
          width={168}
          height={108}
          rx={20}
          ry={20}
          fill="none"
          stroke={darkTheme.textMuted}
          strokeOpacity={0.35}
          strokeWidth={2}
          strokeDasharray="2 8"
        />
      </Svg>
      <Text
        className="absolute font-mono text-ticket-no"
        style={{ color: darkTheme.textMuted, opacity: 0.45 }}
      >
        47
      </Text>
    </View>
  );
}

export function EmptyState({ onAdd }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8">
      <OutlineNumerek />
      <Text className="mt-8 text-center font-display text-h2 text-steam">
        {t('staff.emptyTitle')}
      </Text>
      <Text className="mt-2 text-center font-ui text-body text-smoke">
        {t('staff.emptySubtitle')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        className="mt-8 h-touch-primary items-center justify-center rounded-control bg-ready-fill px-8 active:opacity-85"
      >
        <Text className="font-ui text-body text-espresso" style={{ fontWeight: '600' }}>
          {t('staff.add')}
        </Text>
      </Pressable>
    </View>
  );
}
