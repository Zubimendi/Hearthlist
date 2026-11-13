// src/ui/theme/store.ts
// Global theme preference store with persistence via SecureStore.
// Supports 'system', 'light', and 'dark'.

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Appearance, type ColorSchemeName } from 'react-native';
import { colors, type ThemeColors } from './index';

export type ThemePreference = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'hearthlist_theme_pref';

interface ThemeStoreState {
  preference: ThemePreference;
  systemScheme: ColorSchemeName | null;
  setPreference: (pref: ThemePreference) => Promise<void>;
  setSystemScheme: (scheme: ColorSchemeName | null) => void;
  loadInitialPreference: () => Promise<void>;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  preference: 'system',
  systemScheme: Appearance.getColorScheme(),
  setPreference: async (pref) => {
    set({ preference: pref });
    try {
      await SecureStore.setItemAsync(THEME_STORAGE_KEY, pref);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  },
  setSystemScheme: (scheme) => set({ systemScheme: scheme }),
  loadInitialPreference: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ preference: stored });
      }
    } catch {}
  },
}));

// Hook for components to access the active theme and toggle it
export function useTheme(): {
  theme: ThemeColors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => Promise<void>;
} {
  const preference = useThemeStore((s) => s.preference);
  const systemScheme = useThemeStore((s) => s.systemScheme);
  const setPreference = useThemeStore((s) => s.setPreference);

  const isDark =
    preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const theme = isDark ? colors.dark : colors.light;

  return { theme, isDark, preference, setPreference };
}
