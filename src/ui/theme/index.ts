// src/ui/theme/index.ts
// All design tokens. No raw hex/spacing literals anywhere in components —
// import from here exclusively. Matches docs/design.md exactly.

export const colors = {
  light: {
    bg: '#F8F9FA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#8E8E93',
    textDone: '#C7C7CC',
    primary: '#34C759',
    primaryPressed: '#28A745',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    border: '#E5E5EA',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    text: '#F5F5F7',
    textSecondary: '#8E8E93',
    textDone: '#48484A',
    primary: '#30D158',
    primaryPressed: '#28B84D',
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    border: '#38383A',
  },
} as const;

/** Spacing scale in dp (4-pt grid). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Border radius values. */
export const radius = {
  card: 12,
  input: 12,
  pill: 999,
} as const;

/** Typography scale — system fonts only. */
export const typography = {
  title:   { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const },
  body:    { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  label:   { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

/** Minimum touch target size (accessibility). */
export const minTouchTarget = 48;

/** Motion durations in ms. */
export const duration = {
  tap: 120,
  layout: 200,
  sheet: 250,
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = {
  readonly [K in keyof typeof colors.light]: string;
};

export { useTheme, useThemeStore, type ThemePreference } from './store';
