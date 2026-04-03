import { useEffect } from 'react';
import { useColorScheme, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';

// Fix Tamil (Indic) text + icon misalignment on Android:
// Android adds extra vertical padding around fonts (includeFontPadding).
// This makes tall-glyph scripts like Tamil shift out of alignment with icons.
if (Platform.OS === 'android') {
  const originalDefaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps = {
    ...originalDefaultProps,
    style: [{ includeFontPadding: false }, originalDefaultProps.style],
  };
}
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Colors } from '@/constants/Colors';
import { ErrorBoundary } from '@/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);
  const themePreference = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();

  useEffect(() => {
    loadFromStorage();
    const unsub = initialize();
    return unsub;
  }, []);

  useEffect(() => {
    if (initialized) SplashScreen.hideAsync();
  }, [initialized]);

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

  return (
    <ErrorBoundary>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </PaperProvider>
    </ErrorBoundary>
  );
}
