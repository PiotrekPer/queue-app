/**
 * QueueHeader — the top of Kolejka (§9.3A): venue name (small, smoke), a live
 * „W kolejce: N" count pill, and the big ＋ Dodaj button in the right thumb zone
 * (ready-fill, 56px). Dodaj opens the add flow (owned by another track).
 */
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';

interface QueueHeaderProps {
  venueName: string;
  count: number;
  onAdd: () => void;
}

export function QueueHeader({ venueName, count, onAdd }: QueueHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <View className="flex-1">
        <Text className="font-ui text-small text-smoke" numberOfLines={1}>
          {venueName}
        </Text>
        <View className="mt-1 self-start rounded-pill px-3 py-1" style={{ backgroundColor: darkTheme.cardElevated }}>
          <Text className="font-ui text-body text-steam" style={{ fontWeight: '600' }}>
            {t('staff.queueCount', { n: count })}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onAdd}
        className="h-touch-primary items-center justify-center rounded-control bg-ready-fill px-6 active:opacity-85"
      >
        <Text className="font-ui text-body text-espresso" style={{ fontWeight: '600' }}>
          {t('staff.add')}
        </Text>
      </Pressable>
    </View>
  );
}
