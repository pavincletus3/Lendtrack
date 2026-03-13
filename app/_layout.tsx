import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Colors } from '@/constants/Colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const user = useAuthStore((s) => s.user);
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);
  const themePreference = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadFromStorage();
    const unsub = initialize();
    return unsub;
  }, []);

  useEffect(() => {
    if (!initialized) return;
    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(app)/dashboard');
    }
  }, [initialized, user, segments]);

  const isDark =
    themePreference === 'dark' ||
    (themePreference === 'system' && systemScheme === 'dark');

  const paperTheme = isDark
    ? {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: Colors.dark.primary,
          background: Colors.dark.background,
          surface: Colors.dark.card,
        },
      }
    : {
        ...MD3LightTheme,
        colors: {
          ...MD3LightTheme.colors,
          primary: Colors.light.primary,
          background: Colors.light.background,
          surface: Colors.light.card,
        },
      };

  if (!initialized) return null;

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </PaperProvider>
  );
}
