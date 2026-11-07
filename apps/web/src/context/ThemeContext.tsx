'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  ThemeId,
  ThemePalette,
  THEME_PALETTES,
  applyTldrawPaletteOverride,
  injectThemeStyles,
} from '../utils/themes';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  palette: ThemePalette;
  allPalettes: Record<ThemeId, ThemePalette>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'glyph_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>('obsidian-charcoal');

  // Load persisted theme on mount or respect system preference by default
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
      if (saved && THEME_PALETTES[saved]) {
        setThemeState(saved);
      } else if (typeof window !== 'undefined' && window.matchMedia) {
        const isSystemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        setThemeState(isSystemLight ? 'github-pure' : 'obsidian-charcoal');
      }
    } catch {
      // Local storage disabled or error
    }
  }, []);

  const palette = useMemo(() => THEME_PALETTES[theme] || THEME_PALETTES['obsidian-charcoal'], [theme]);

  // Synchronize CSS injection and Tldraw palette overrides on theme change
  useEffect(() => {
    applyTldrawPaletteOverride(palette).catch(() => {});
    injectThemeStyles(palette);
  }, [palette]);

  const setTheme = (newTheme: ThemeId) => {
    if (!THEME_PALETTES[newTheme]) return;
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        palette,
        allPalettes: THEME_PALETTES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

