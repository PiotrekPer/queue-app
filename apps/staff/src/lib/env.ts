import Constants from 'expo-constants';

/** EXPO_PUBLIC_* are inlined at build; fall back to expo config `extra`. No secrets here. */
function pick(key: string): string {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return extra[key] ?? '';
}

export const env = {
  supabaseUrl: pick('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: pick('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
} as const;

/** True when a live Supabase backend is configured (else the app runs on demo data). */
export const hasBackend = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
