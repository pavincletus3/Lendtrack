import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/lib/i18n';

type Language = 'en' | 'ta';
type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  language: Language;
  theme: Theme;
  overdueAlertDays: number;
  vibrationEnabled: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  setTheme: (theme: Theme) => void;
  setOverdueAlertDays: (days: number) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  loadFromStorage: () => Promise<void>;
}

const STORAGE_KEY = 'lendtrack_settings';

function persist(state: Pick<SettingsState, 'language' | 'theme' | 'overdueAlertDays' | 'vibrationEnabled'>) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  theme: 'system',
  overdueAlertDays: 5,
  vibrationEnabled: true,

  setLanguage: async (lang) => {
    set({ language: lang });
    await i18n.changeLanguage(lang);
    const { theme, overdueAlertDays, vibrationEnabled } = get();
    persist({ language: lang, theme, overdueAlertDays, vibrationEnabled });
  },

  setTheme: (theme) => {
    set({ theme });
    const { language, overdueAlertDays, vibrationEnabled } = get();
    persist({ language, theme, overdueAlertDays, vibrationEnabled });
  },

  setOverdueAlertDays: (days) => {
    set({ overdueAlertDays: days });
    const { language, theme, vibrationEnabled } = get();
    persist({ language, theme, overdueAlertDays: days, vibrationEnabled });
  },

  setVibrationEnabled: (enabled) => {
    set({ vibrationEnabled: enabled });
    const { language, theme, overdueAlertDays } = get();
    persist({ language, theme, overdueAlertDays, vibrationEnabled: enabled });
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.language) {
          set({ language: data.language });
          await i18n.changeLanguage(data.language);
        }
        if (data.theme) set({ theme: data.theme });
        if (data.overdueAlertDays) set({ overdueAlertDays: data.overdueAlertDays });
        if (typeof data.vibrationEnabled === 'boolean') set({ vibrationEnabled: data.vibrationEnabled });
      }
    } catch {
      // ignore
    }
  },
}));
