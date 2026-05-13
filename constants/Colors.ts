/**
 * Slice-inspired palette. Vivid magenta primary, stark backgrounds, soft accents.
 * Used everywhere via useTheme().colors.
 */
export const Colors = {
  light: {
    background: '#FFFFFF',
    card: '#FFFFFF',
    cardAlt: '#F8FAFC',
    surface: '#F1F5F9',
    elevatedShadow: 'rgba(15, 23, 42, 0.06)',

    primary: '#D81FB8',      // slice magenta
    primaryDeep: '#B5119A',
    primaryTint: '#FCE7F5',  // light pink wash for backgrounds

    success: '#16A34A',
    successTint: '#DCFCE7',
    warning: '#F59E0B',
    warningTint: '#FEF3C7',
    info: '#3B82F6',
    danger: '#EF4444',
    dangerTint: '#FEE2E2',
    partial: '#A78BFA',
    partialTint: '#EDE9FE',

    text: '#0F172A',
    textMuted: '#64748B',
    textSecondary: '#334155',
    textOnPrimary: '#FFFFFF',

    border: '#F1F5F9',
    divider: '#E2E8F0',
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#0F172A',
  },
  dark: {
    background: '#000000',
    card: '#0F0F12',
    cardAlt: '#16161B',
    surface: '#1C1C22',
    elevatedShadow: 'rgba(0, 0, 0, 0.6)',

    primary: '#E938C2',
    primaryDeep: '#C12AA0',
    primaryTint: '#2A0F26',

    success: '#22C55E',
    successTint: '#082E1A',
    warning: '#FBBF24',
    warningTint: '#2A1E05',
    info: '#60A5FA',
    danger: '#F87171',
    dangerTint: '#2A0F10',
    partial: '#C4B5FD',
    partialTint: '#1F1830',

    text: '#FFFFFF',
    textMuted: '#A1A1AA',
    textSecondary: '#D4D4D8',
    textOnPrimary: '#FFFFFF',

    border: '#1F1F24',
    divider: '#27272A',
    icon: '#A1A1AA',
    tabIconDefault: '#52525B',
    tabIconSelected: '#FFFFFF',
  },
} as const;

export type ColorScheme = 'dark' | 'light';
export type ThemeColors = { -readonly [K in keyof typeof Colors.light]: string };
