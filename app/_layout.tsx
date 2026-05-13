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
import { Provider as PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Typography';
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

  const paperTheme = isDark
    ? {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: palette.primary,
          background: palette.background,
          surface: palette.card,
          onSurface: palette.text,
        },
        fonts: {
          ...MD3DarkTheme.fonts,
          default: { ...MD3DarkTheme.fonts.default, fontFamily: Fonts.medium },
        },
      }
    : {
        ...MD3LightTheme,
        colors: {
          ...MD3LightTheme.colors,
          primary: palette.primary,
          background: palette.background,
          surface: palette.card,
          onSurface: palette.text,
        },
        fonts: {
          ...MD3LightTheme.fonts,
          default: { ...MD3LightTheme.fonts.default, fontFamily: Fonts.medium },
        },
      };

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
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
      </PaperProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
