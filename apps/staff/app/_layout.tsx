import '../global.css';
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
} from '@expo-google-fonts/schibsted-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { darkTheme } from '@/lib/theme';
import { Providers } from '@/providers/Providers';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Register fonts under the family names the NativeWind preset expects (§9.2).
  const [loaded] = useFonts({
    'Bricolage Grotesque': BricolageGrotesque_700Bold,
    'Bricolage Grotesque ExtraBold': BricolageGrotesque_800ExtraBold,
    'Schibsted Grotesk': SchibstedGrotesk_400Regular,
    'Schibsted Grotesk Medium': SchibstedGrotesk_500Medium,
    'Schibsted Grotesk SemiBold': SchibstedGrotesk_600SemiBold,
    'IBM Plex Mono': IBMPlexMono_500Medium,
    'IBM Plex Mono SemiBold': IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Providers>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: darkTheme.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="qr/[visitId]" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </Providers>
  );
}
