import type { TextStyle } from 'react-native';

/**
 * Manrope-based type scale matching slice's display feel.
 * Use via Type.heroXXL etc., spread into Text style.
 */
export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const Type = {
  heroXXL: {
    fontFamily: Fonts.extrabold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  } satisfies TextStyle,
  heroXL: {
    fontFamily: Fonts.extrabold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.5,
  } satisfies TextStyle,
  hero: {
    fontFamily: Fonts.extrabold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1,
  } satisfies TextStyle,
  titleLg: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
  } satisfies TextStyle,
  title: {
    fontFamily: Fonts.bold,
    fontSize: 18,
    lineHeight: 24,
  } satisfies TextStyle,
  bodyBold: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  } satisfies TextStyle,
  body: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,
  caption: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  captionBold: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
  } satisfies TextStyle,
  micro: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  } satisfies TextStyle,
  pill: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.2,
  } satisfies TextStyle,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;
