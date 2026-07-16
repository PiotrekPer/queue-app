/**
 * Ustawienia (§9.3D) — the venue's control panel: basics, hold/heads-up timers,
 * quote defaults, the message-template editor with the LIVE SMS segment counter
 * (§7.5, the business model's guardrail), channels + SMS balance, the RODO card
 * (§11), and web-only invites/billing links. Dark „service-bar instrument"
 * surface, token colours only, everything undoable via re-editing.
 */
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTheme, space } from '@/lib/theme';
import { LinkRow, TextField, Toggle } from '@/features/settings/controls';
import { RetentionSlider } from '@/features/settings/RetentionSlider';
import { SettingsRow, SettingsSection } from '@/features/settings/SettingsSection';
import { Stepper } from '@/features/settings/Stepper';
import { TemplateEditor } from '@/features/settings/TemplateEditor';
import {
  PRIVILEGED_ROLES,
  useHydrateSettings,
  useSettingsStore,
} from '@/features/settings/hooks';

/** Web surfaces the app links out to (payments are always web — §2, §14). */
const BILLING_URL = 'https://stq.pl/panel/platnosci';
const TOPUP_URL = 'https://stq.pl/panel/sms';
const INVITE_URL = 'https://stq.pl/panel/zespol';
const DPA_URL = 'https://stq.pl/umowa-powierzenia.pdf';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hydrated = useHydrateSettings();

  const settings = useSettingsStore((s) => s.settings);
  const venue = useSettingsStore((s) => s.venue);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const patchVenue = useSettingsStore((s) => s.patchVenue);

  const privileged = PRIVILEGED_ROLES.includes(venue.role);
  const smsZl = (venue.smsBalanceGrosz / 100).toFixed(2);
  const lowBalance = venue.smsBalanceGrosz <= 500;

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-espresso">
        <ActivityIndicator color={darkTheme.status.ready} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space(4),
          paddingBottom: insets.bottom + space(8),
          paddingHorizontal: space(4),
          gap: space(3),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-1 font-display text-h1 text-steam">{t('staff.tabSettings')}</Text>

        {/* ── Venue basics ─────────────────────────────────────────────── */}
        <SettingsSection title={t('settings.venueBasics')}>
          <TextField
            label={t('common.appName')}
            value={venue.name}
            onChangeText={(name) => patchVenue({ name })}
            placeholder="Trattoria Demo"
          />
          <TextField
            label="Miasto"
            value={venue.city}
            onChangeText={(city) => patchVenue({ city })}
            placeholder="Warszawa"
          />
        </SettingsSection>

        {/* ── Hold timer & heads-up thresholds ─────────────────────────── */}
        <SettingsSection title={t('settings.holdTimer')}>
          <SettingsRow label={t('settings.holdTimer')} hint="§5">
            <Stepper
              value={settings.hold_minutes}
              onChange={(hold_minutes) => patchSettings({ hold_minutes })}
              min={1}
              max={30}
              unit={t('common.minutesShort')}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title={t('settings.headsUp')}>
          <SettingsRow label="Pozycja">
            <Stepper
              value={settings.heads_up_position}
              onChange={(heads_up_position) => patchSettings({ heads_up_position })}
              min={1}
              max={10}
            />
          </SettingsRow>
          <SettingsRow label="ETA">
            <Stepper
              value={settings.heads_up_eta_minutes}
              onChange={(heads_up_eta_minutes) => patchSettings({ heads_up_eta_minutes })}
              min={1}
              max={30}
              unit={t('common.minutesShort')}
            />
          </SettingsRow>
        </SettingsSection>

        {/* ── Quote defaults per bracket (§6) ──────────────────────────── */}
        <SettingsSection title={t('settings.quoteDefaults')}>
          {(['1-2', '3-4', '5+'] as const).map((b) => (
            <SettingsRow key={b} label={`${b} ${t('common.people')}`}>
              <Stepper
                value={settings.quote_defaults[b]}
                onChange={(min) =>
                  patchSettings({
                    quote_defaults: { ...settings.quote_defaults, [b]: min },
                  })
                }
                min={5}
                max={90}
                step={5}
                unit={t('common.minutesShort')}
              />
            </SettingsRow>
          ))}
        </SettingsSection>

        {/* ── Message templates + live segment counter (§7.5) ──────────── */}
        <SettingsSection title={t('settings.templates')}>
          <TemplateEditor />
        </SettingsSection>

        {/* ── Channels + SMS balance (§7.1) ────────────────────────────── */}
        <SettingsSection title={t('settings.channels')}>
          <SettingsRow label="SMS">
            <Toggle
              label="SMS"
              value={settings.channels.sms}
              onChange={(sms) =>
                patchSettings({ channels: { ...settings.channels, sms } })
              }
            />
          </SettingsRow>
          <SettingsRow label="Email">
            <Toggle
              label="Email"
              value={settings.channels.email}
              onChange={(email) =>
                patchSettings({ channels: { ...settings.channels, email } })
              }
            />
          </SettingsRow>
          <View className="h-px bg-hairline" />
          <View className="flex-row items-center justify-between">
            <Text
              className="font-ui text-body"
              style={{ color: lowBalance ? darkTheme.status.notified : darkTheme.text }}
            >
              {t('settings.smsBalance', { amount: smsZl })}
            </Text>
          </View>
          <LinkRow label={t('settings.topUp')} url={TOPUP_URL} />
        </SettingsSection>

        {/* ── RODO (§11) ───────────────────────────────────────────────── */}
        <SettingsSection title={t('settings.rodoTitle')} subtitle={t('settings.rodoRetention')}>
          <Text className="font-ui text-small text-smoke">
            {t('settings.rodoRetentionDays', { days: settings.retention_days })}
          </Text>
          <RetentionSlider
            value={settings.retention_days}
            onChange={(retention_days) => patchSettings({ retention_days })}
          />
          <LinkRow label="Umowa powierzenia (PDF)" url={DPA_URL} />
        </SettingsSection>

        {/* ── Team & billing (web-only, role-gated §4.2) ───────────────── */}
        {privileged ? (
          <SettingsSection title={t('settings.staffInvites')}>
            <LinkRow label={t('settings.staffInvites')} hint="stq.pl" url={INVITE_URL} />
          </SettingsSection>
        ) : null}

        <SettingsSection title={t('settings.plan')}>
          <LinkRow label={t('settings.plan')} hint="stq.pl" url={BILLING_URL} />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
