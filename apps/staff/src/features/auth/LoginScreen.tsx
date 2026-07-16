/**
 * Staff login (§4.2). Email + password against Supabase Auth. Shown by AuthGate
 * only when a backend is configured and there's no session. Prefilled with the
 * seeded demo staff account (§12.6) so a pilot can sign in with one tap.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { darkTheme } from '@/lib/theme';
import { useAuthStore } from './store';

export function LoginScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('kelner@stoliq.app');
  const [password, setPassword] = useState('stoliq-demo-1');

  const submit = (): void => {
    void signIn(email, password);
  };

  return (
    <SafeAreaView className="flex-1 bg-espresso" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center px-6">
        <Text className="font-display text-h1 text-steam">{t('auth.title')}</Text>
        <Text className="mt-2 font-ui text-body text-smoke">{t('auth.subtitle')}</Text>

        <View className="mt-8 gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={darkTheme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className="rounded-control bg-walnut px-4 py-4 font-ui text-body text-steam"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.password')}
            placeholderTextColor={darkTheme.textMuted}
            secureTextEntry
            onSubmitEditing={submit}
            className="rounded-control bg-walnut px-4 py-4 font-ui text-body text-steam"
          />
        </View>

        {error ? (
          <Text className="mt-4 font-ui text-small text-danger-dark">{t('auth.error')}</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={signingIn}
          accessibilityRole="button"
          accessibilityLabel={t('auth.signIn')}
          className="mt-6 h-14 items-center justify-center rounded-control bg-ready-fill active:opacity-90"
        >
          {signingIn ? (
            <ActivityIndicator color={darkTheme.text} />
          ) : (
            <Text className="font-ui text-body font-semibold text-steam">{t('auth.signIn')}</Text>
          )}
        </Pressable>

        <Text className="mt-6 text-center font-mono text-caption text-smoke">
          {t('auth.demoHint')}
        </Text>
      </View>
    </SafeAreaView>
  );
}
