import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/lib/i18n';

type Language = 'en' | 'ta';
type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  language: Language;
  theme: Theme;
  overdueAlertDays: number;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => void;
  setOverdueAlertDays: (days: number) => void;
  loadFromStorage: () => Promise<void>;
}

const STORAGE_KEY = 'lendtrack_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  theme: 'system',
  overdueAlertDays: 5,

  setLanguage: async (lang) => {
    set({ language: lang });
    await i18n.changeLanguage(lang);
    const current = get();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language: lang, theme: current.theme, overdueAlertDays: current.overdueAlertDays })
    );
  },

  setTheme: (theme) => {
    set({ theme });
    const current = get();
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language: current.language, theme, overdueAlertDays: current.overdueAlertDays })
    );
  },

  setOverdueAlertDays: (days) => {
    set({ overdueAlertDays: days });
    const current = get();
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language: current.language, theme: current.theme, overdueAlertDays: days })
    );
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { language, theme, overdueAlertDays } = JSON.parse(raw);
        if (language) {
          set({ language });
          await i18n.changeLanguage(language);
        }
        if (theme) set({ theme });
        if (overdueAlertDays) set({ overdueAlertDays });
      }
    } catch {
      // ignore
    }
  },
}));
