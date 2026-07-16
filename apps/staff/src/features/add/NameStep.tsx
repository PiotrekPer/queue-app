/**
 * Step 2 of the add path (§9.3B): a single autofocus name field. „Pomiń →" is
 * EQUALLY prominent (name is optional — the 5-second add must never block on it).
 * Phone is DELIBERATELY absent from this whole flow (§1 guest contract).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { darkTheme } from '@/lib/theme';
import { fireHaptic } from '@/lib/haptics';

interface Props {
  /** Commit with an optional name (null when skipped or left blank). */
  onDone: (name: string | null) => void;
}

export function NameStep({ onDone }: Props): React.JSX.Element {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  function commit(): void {
    void fireHaptic('light');
    const trimmed = name.trim();
    onDone(trimmed.length > 0 ? trimmed : null);
  }

  return (
    <View className="flex-1 px-5">
      <Text className="mb-6 text-center font-display text-h2 text-steam">
        {t('staff.add_step_name')}
      </Text>

      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        onSubmitEditing={commit}
        returnKeyType="done"
        maxLength={80}
        placeholder="Ania"
        placeholderTextColor={darkTheme.textMuted}
        selectionColor={darkTheme.status.ready}
        className="h-touch-primary rounded-control bg-walnut px-5 font-ui text-h2 text-steam"
      />

      <View className="mt-8 flex-row gap-3">
        {/* Skip — equally prominent per §9.3B. */}
        <Pressable
          onPress={() => {
            void fireHaptic('light');
            onDone(null);
          }}
          accessibilityRole="button"
          className="h-touch-primary flex-1 items-center justify-center rounded-control bg-walnut active:bg-walnut-hi"
        >
          <Text className="font-ui text-body font-semibold text-steam">
            {t('staff.add_skipName')}
          </Text>
        </Pressable>

        {/* Confirm with a name. */}
        <Pressable
          onPress={commit}
          accessibilityRole="button"
          className="h-touch-primary flex-1 items-center justify-center rounded-control bg-ready-fill active:opacity-90"
        >
          <Text className="font-ui text-body font-semibold text-steam">{t('common.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
