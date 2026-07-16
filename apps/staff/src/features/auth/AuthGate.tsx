/**
 * AuthGate — gates the app behind login when a backend is configured (§4.2).
 *   • no backend (demo build)   → render children straight through (no auth)
 *   • backend, session unknown  → blank dark screen while getSession() resolves
 *   • backend, no session       → <LoginScreen/>
 *   • backend, signed in        → render children (the tabs)
 */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { hasBackend } from '@/lib/env';
import { darkTheme } from '@/lib/theme';
import { LoginScreen } from './LoginScreen';
import { useAuthStore } from './store';

export function AuthGate({ children }: { children: ReactNode }): React.JSX.Element {
  // All hooks unconditionally (rules of hooks), then branch on state.
  const init = useAuthStore((s) => s.init);
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    init();
  }, [init]);

  if (!hasBackend) return <>{children}</>;
  if (!ready) return <View style={{ flex: 1, backgroundColor: darkTheme.background }} />;
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}
