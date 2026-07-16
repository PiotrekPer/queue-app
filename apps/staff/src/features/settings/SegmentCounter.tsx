/**
 * The live SMS segment counter (§7.5) — the business model's guardrail.
 *
 * Runs `analyze(body)` on every keystroke and shows chars · segments · encoding
 * in mono tabular. A single Polish diacritic flips GSM-7 → UCS-2 (160→70 chars/
 * segment, ~2–3× cost), so when the encoding is UCS-2 we surface an amber warning
 * („Znaki ą/ę/ś podwoją koszt SMS"). Default templates ship diacritic-free.
 */
import { analyze } from '@stoliq/core';
import { useMemo } from 'react';
import type { TextStyle } from 'react-native';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { darkTheme } from '@/lib/theme';

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export function SegmentCounter({ body }: { body: string }) {
  const { t } = useTranslation();
  const info = useMemo(() => analyze(body), [body]);
  const isUcs2 = info.encoding === 'UCS-2';

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text
          className="font-mono text-caption text-smoke"
          style={TABULAR}
          accessibilityLabel={t('settings.segmentCounter', {
            chars: info.length,
            segments: info.segments,
            encoding: info.encoding,
          })}
        >
          {t('settings.segmentCounter', {
            chars: info.length,
            segments: info.segments,
            encoding: info.encoding,
          })}
        </Text>
        {/* A small segment "pip" per SMS — glows amber under UCS-2 to make the
            cost jump legible without reading the number. */}
        <View className="flex-row gap-1">
          {Array.from({ length: Math.min(info.segments, 6) }).map((_, i) => (
            <View
              key={i}
              className="h-1.5 w-4 rounded-pill"
              style={{
                backgroundColor: isUcs2 ? darkTheme.status.notified : darkTheme.status.ready,
              }}
            />
          ))}
        </View>
      </View>

      {isUcs2 ? (
        <View className="flex-row items-center gap-2 rounded-control bg-walnut-hi px-2 py-1.5">
          <View
            className="h-2 w-2 rounded-pill"
            style={{ backgroundColor: darkTheme.status.notified }}
          />
          <Text
            className="flex-1 font-ui text-caption"
            style={{ color: darkTheme.status.notified }}
          >
            {t('settings.templateUcs2Warning')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
