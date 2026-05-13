import { useEffect } from 'react';
import { useColorScheme, Text, Platform } from 'react-native';
import { Stack } from 'expo-router';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

// Fix Tamil (Indic) text + icon misalignment on Android.
if (Platform.OS === 'android') {
  const originalDefaultProps = (Text as any).defaultProps ?? {};
  (Text as any).defaultProps = {
    ...originalDefaultProps,
    style: [{ includeFontPadding: false }, originalDefaultProps.style],
  };
}
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Colors } from '@/constants/Colors';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Snackbar } from '@/components/ui';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const loadFromStorage = useSettingsStore((s) => s.loadFromStorage);
  const themePreference = useSettingsStore((s) => s.theme);
  const systemScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    loadFromStorage();
    const unsub = initialize();
    return unsub;
  }, []);

  useEffect(() => {
    if (initialized && fontsLoaded) SplashScreen.hideAsync();
  }, [initialized, fontsLoaded]);

  if (!fontsLoaded) return null;

  const isDark =
    themePreference === 'dark' ||
    (themePreference === 'system' && systemScheme === 'dark');

  const palette = isDark ? Colors.dark : Colors.light;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
        <Snackbar />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
