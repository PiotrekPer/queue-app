/** Public runtime config (guest + marketing). No secrets — links are built server-side. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  guestBaseUrl: process.env.NEXT_PUBLIC_GUEST_BASE_URL ?? 'https://stq.pl',
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  /** Web Push VAPID public key (client half); empty → the push opt-in hides. */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  /** Edge Functions base — used by the guest page to read/mutate a ticket (§4.2). */
  functionsUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
    : '',
} as const;

/** True when a live Supabase backend is configured (else the app uses demo data). */
export const hasBackend = env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
