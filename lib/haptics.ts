import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '@/store/settingsStore';

export function triggerHaptic(style: 'light' | 'medium' = 'light') {
  if (!useSettingsStore.getState().vibrationEnabled) return;
  const impact = style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
  Haptics.impactAsync(impact).catch(() => {});
}
