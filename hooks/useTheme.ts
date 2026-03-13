import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/Colors';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const systemScheme = useColorScheme();
  const theme = useSettingsStore((s) => s.theme);

  const isDark =
    theme === 'dark' || (theme === 'system' && systemScheme === 'dark');

  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
