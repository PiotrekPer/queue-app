/**
 * Message-template editor (§9.3D, §7.2). One editable body per TemplateKey seeded
 * from DEFAULT_TEMPLATES, each with the live SegmentCounter (§7.5) below it.
 * Bodies use {{placeholders}} ({{venue}}, {{name}}, {{ticket_no}}, {{hold}},
 * {{link}}) — shown as a hint so staff don't delete them by accident.
 */
import type { TemplateKey } from '@stoliq/core';
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS } from '@stoliq/core';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';
import { SegmentCounter } from './SegmentCounter';
import { useSettingsStore } from './store';

/** Human labels for each template row (local copy — not in core i18n yet §9.5). */
const TEMPLATE_LABELS: Record<TemplateKey, { pl: string; en: string }> = {
  joined: { pl: 'Dołączenie do kolejki', en: 'Joined the queue' },
  heads_up: { pl: 'Uprzedzenie', en: 'Heads-up' },
  table_ready: { pl: 'Stolik gotowy', en: 'Table ready' },
  renotify: { pl: 'Przypomnienie', en: 'Reminder' },
};

export function TemplateEditor() {
  const templates = useSettingsStore((s) => s.templates);

  return (
    <View className="gap-4">
      {TEMPLATE_KEYS.map((key) => (
        <TemplateRow key={key} templateKey={key} body={templates[key]} />
      ))}
    </View>
  );
}

function TemplateRow({ templateKey, body }: { templateKey: TemplateKey; body: string }) {
  const { t, i18n } = useTranslation();
  const setTemplate = useSettingsStore((s) => s.setTemplate);
  const resetTemplate = useSettingsStore((s) => s.resetTemplate);

  const locale = i18n.language === 'en' ? 'en' : 'pl';
  const label = TEMPLATE_LABELS[templateKey][locale];
  const isDefault = body === DEFAULT_TEMPLATES[templateKey].pl;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui text-small font-medium text-steam">{label}</Text>
        {!isDefault ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => resetTemplate(templateKey)}
            hitSlop={8}
            className="h-touch-min justify-center"
          >
            <Text className="font-ui text-caption text-smoke">{t('common.undo')}</Text>
          </Pressable>
        ) : null}
      </View>

      <TextInput
        value={body}
        onChangeText={(text) => setTemplate(templateKey, text)}
        multiline
        placeholder={DEFAULT_TEMPLATES[templateKey].pl}
        placeholderTextColor={darkTheme.textMuted}
        selectionColor={darkTheme.status.ready}
        className="min-h-touch-primary rounded-control bg-walnut-hi px-3 py-2 font-ui text-body text-steam"
        style={{ textAlignVertical: 'top' }}
      />

      <SegmentCounter body={body} />
    </View>
  );
}
