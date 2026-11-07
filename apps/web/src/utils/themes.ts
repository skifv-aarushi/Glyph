// apps/web/src/utils/themes.ts
import type * as MonacoType from 'monaco-editor';

export type DarkThemeId =
  | 'lobby-dark'
  | 'tokyo-dusk'
  | 'dracula-midnight'
  | 'monokai-warm'
  | 'cyber-slate'
  | 'obsidian-charcoal'
  | 'dracula-night'
  | 'tokyo-night'
  | 'monokai-pro'
  | 'cyber-twilight';

export type LightThemeId =
  | 'lobby-light'
  | 'github-pure'
  | 'solarized-sand'
  | 'nord-blizzard'
  | 'minimal-zinc'
  | 'solarized-paper'
  | 'warm-sand'
  | 'minimal-slate-light'
  | 'github-clean'
  | 'nord-snow'
  | 'aura-rose-light';

export type LegacyThemeId = 'cyberpunk' | 'dracula' | 'monokai' | 'github-light';

export type ThemeId = DarkThemeId | LightThemeId | LegacyThemeId;

export interface ThemePalette {
  id: string;
  name: string;
  isDark: boolean;
  monacoTheme: string;
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  subtext: string;
  accent: string;
  colors: {
    black: string;
    grey: string;
    blue: string;
    red: string;
    green: string;
    yellow: string;
    orange: string;
    violet: string;
  };
}

/**
 * 10 Precision Solid Color Themes (5 Dark, 5 Light)
 * Designed for distraction-free code editing, 60fps rendering, high WCAG contrast,
 * and crisp spatial canvas annotation.
 */
export const THEME_PALETTES: Record<string, ThemePalette> = {
  // ==========================================================
  // 5 CANONICAL DARK THEMES
  // ==========================================================

  // 1. Obsidian Charcoal (GitHub Dark / Linear pitch black)
  'lobby-dark': {
    id: 'lobby-dark',
    name: 'Obsidian Charcoal',
    isDark: true,
    monacoTheme: 'lobby-dark',
    background: '#0D1117',
    surface: '#161B22',
    surfaceBorder: '#30363D',
    text: '#F0F6FC',
    subtext: '#8B949E',
    accent: '#58A6FF',
    colors: {
      black: '#F0F6FC',
      grey: '#8B949E',
      blue: '#58A6FF',
      red: '#FF7B72',
      green: '#7EE787',
      yellow: '#FFA657',
      orange: '#FFA657',
      violet: '#D2A8FF',
    },
  },

  // 2. Tokyo Dusk (Deep midnight indigo)
  'tokyo-dusk': {
    id: 'tokyo-dusk',
    name: 'Tokyo Dusk',
    isDark: true,
    monacoTheme: 'tokyo-dusk',
    background: '#1A1B26',
    surface: '#24283B',
    surfaceBorder: '#383E5A',
    text: '#C0CAF5',
    subtext: '#828BB8',
    accent: '#7AA2F7',
    colors: {
      black: '#C0CAF5',
      grey: '#565F89',
      blue: '#7AA2F7',
      red: '#F7768E',
      green: '#9ECE6A',
      yellow: '#E0AF68',
      orange: '#FF9E64',
      violet: '#BB9AF7',
    },
  },

  // 3. Dracula Midnight (Gothic classic navy)
  'dracula-midnight': {
    id: 'dracula-midnight',
    name: 'Dracula Midnight',
    isDark: true,
    monacoTheme: 'dracula-midnight',
    background: '#21222C',
    surface: '#282A36',
    surfaceBorder: '#44475A',
    text: '#F8F8F2',
    subtext: '#9CA7C5',
    accent: '#BD93F9',
    colors: {
      black: '#F8F8F2',
      grey: '#6272A4',
      blue: '#8BE9FD',
      red: '#FF5555',
      green: '#50FA7B',
      yellow: '#F1FA8C',
      orange: '#FFB86C',
      violet: '#BD93F9',
    },
  },

  // 4. Monokai Warm (Warm espresso charcoal with earthy accents)
  'monokai-warm': {
    id: 'monokai-warm',
    name: 'Monokai Warm',
    isDark: true,
    monacoTheme: 'monokai-warm',
    background: '#272822',
    surface: '#34352E',
    surfaceBorder: '#49483E',
    text: '#F8F8F2',
    subtext: '#969280',
    accent: '#FFD866',
    colors: {
      black: '#F8F8F2',
      grey: '#75715E',
      blue: '#66D9EF',
      red: '#F92672',
      green: '#A6E22E',
      yellow: '#E6DB74',
      orange: '#FD971F',
      violet: '#AE81FF',
    },
  },

  // 5. Cyber Slate (High-contrast obsidian with neon accents)
  'cyber-slate': {
    id: 'cyber-slate',
    name: 'Cyber Slate',
    isDark: true,
    monacoTheme: 'cyber-slate',
    background: '#0A0E17',
    surface: '#111827',
    surfaceBorder: '#1F293D',
    text: '#F3F4F6',
    subtext: '#9CA3AF',
    accent: '#00F0FF',
    colors: {
      black: '#F3F4F6',
      grey: '#6E7681',
      blue: '#00F0FF',
      red: '#FF003C',
      green: '#39FF14',
      yellow: '#FCE205',
      orange: '#FF8A00',
      violet: '#BD00FF',
    },
  },

  // ==========================================================
  // 5 REVAMPED LIGHT THEMES (Clean, High-Contrast, No Wash-Out)
  // ==========================================================

  // 1. Lobby Light / Warm Sand (Editorial paper white with terracotta accents)
  'lobby-light': {
    id: 'lobby-light',
    name: 'Warm Sand',
    isDark: false,
    monacoTheme: 'lobby-light',
    background: '#FDFCF7',
    surface: '#FFFFFF',
    surfaceBorder: '#E5E0D5',
    text: '#1C1917',
    subtext: '#57534E',
    accent: '#C85A32',
    colors: {
      black: '#1C1917',
      grey: '#78716C',
      blue: '#0284C7',
      red: '#DC2626',
      green: '#15803D',
      yellow: '#D97706',
      orange: '#EA580C',
      violet: '#7C3AED',
    },
  },

  // 2. GitHub Pure (Authentic GitHub Primer Light)
  'github-pure': {
    id: 'github-pure',
    name: 'GitHub Clean',
    isDark: false,
    monacoTheme: 'github-pure',
    background: '#FFFFFF',
    surface: '#F6F8FA',
    surfaceBorder: '#D0D7DE',
    text: '#1F2328',
    subtext: '#59636E',
    accent: '#0969DA',
    colors: {
      black: '#1F2328',
      grey: '#8C959F',
      blue: '#0969DA',
      red: '#CF222E',
      green: '#1A7F37',
      yellow: '#9A6700',
      orange: '#BC4C00',
      violet: '#8250DF',
    },
  },

  // 3. Solarized Cream (Authentic Solarized Light with dark slate teal text)
  'solarized-sand': {
    id: 'solarized-sand',
    name: 'Solarized Cream',
    isDark: false,
    monacoTheme: 'solarized-sand',
    background: '#FDF6E3',
    surface: '#F7EED8',
    surfaceBorder: '#E0D6C3',
    text: '#073642',
    subtext: '#586E75',
    accent: '#B58900',
    colors: {
      black: '#073642',
      grey: '#839496',
      blue: '#268BD2',
      red: '#DC322F',
      green: '#859900',
      yellow: '#B58900',
      orange: '#CB4B16',
      violet: '#6C71C4',
    },
  },

  // 4. Nord Blizzard (Polar frost arctic white with navy-slate text)
  'nord-blizzard': {
    id: 'nord-blizzard',
    name: 'Nord Frost',
    isDark: false,
    monacoTheme: 'nord-blizzard',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceBorder: '#CBD5E1',
    text: '#0F172A',
    subtext: '#475569',
    accent: '#2563EB',
    colors: {
      black: '#0F172A',
      grey: '#64748B',
      blue: '#0284C7',
      red: '#BE123C',
      green: '#059669',
      yellow: '#D97706',
      orange: '#EA580C',
      violet: '#7C3AED',
    },
  },

  // 5. Minimal Zinc (Modern Linear / Stripe technical off-white)
  'minimal-zinc': {
    id: 'minimal-zinc',
    name: 'Minimal Zinc',
    isDark: false,
    monacoTheme: 'minimal-zinc',
    background: '#FFFFFF',
    surface: '#F4F4F5',
    surfaceBorder: '#E4E4E7',
    text: '#09090B',
    subtext: '#52525B',
    accent: '#18181B',
    colors: {
      black: '#09090B',
      grey: '#71717A',
      blue: '#2563EB',
      red: '#E11D48',
      green: '#16A34A',
      yellow: '#CA8A04',
      orange: '#EA580C',
      violet: '#9333EA',
    },
  },

  // ==========================================================
  // COMPATIBILITY ALIASES
  // ==========================================================
  'obsidian-charcoal': {
    id: 'lobby-dark',
    name: 'Obsidian Charcoal',
    isDark: true,
    monacoTheme: 'lobby-dark',
    background: '#0D1117',
    surface: '#161B22',
    surfaceBorder: '#30363D',
    text: '#F0F6FC',
    subtext: '#8B949E',
    accent: '#58A6FF',
    colors: {
      black: '#F0F6FC',
      grey: '#8B949E',
      blue: '#58A6FF',
      red: '#FF7B72',
      green: '#7EE787',
      yellow: '#FFA657',
      orange: '#FFA657',
      violet: '#D2A8FF',
    },
  },
  'dracula-night': {
    id: 'dracula-midnight',
    name: 'Dracula Midnight',
    isDark: true,
    monacoTheme: 'dracula-midnight',
    background: '#21222C',
    surface: '#282A36',
    surfaceBorder: '#44475A',
    text: '#F8F8F2',
    subtext: '#9CA7C5',
    accent: '#BD93F9',
    colors: {
      black: '#F8F8F2',
      grey: '#6272A4',
      blue: '#8BE9FD',
      red: '#FF5555',
      green: '#50FA7B',
      yellow: '#F1FA8C',
      orange: '#FFB86C',
      violet: '#BD93F9',
    },
  },
  'tokyo-night': {
    id: 'tokyo-dusk',
    name: 'Tokyo Dusk',
    isDark: true,
    monacoTheme: 'tokyo-dusk',
    background: '#1A1B26',
    surface: '#24283B',
    surfaceBorder: '#383E5A',
    text: '#C0CAF5',
    subtext: '#828BB8',
    accent: '#7AA2F7',
    colors: {
      black: '#C0CAF5',
      grey: '#565F89',
      blue: '#7AA2F7',
      red: '#F7768E',
      green: '#9ECE6A',
      yellow: '#E0AF68',
      orange: '#FF9E64',
      violet: '#BB9AF7',
    },
  },
  'monokai-pro': {
    id: 'monokai-warm',
    name: 'Monokai Warm',
    isDark: true,
    monacoTheme: 'monokai-warm',
    background: '#272822',
    surface: '#34352E',
    surfaceBorder: '#49483E',
    text: '#F8F8F2',
    subtext: '#969280',
    accent: '#FFD866',
    colors: {
      black: '#F8F8F2',
      grey: '#75715E',
      blue: '#66D9EF',
      red: '#F92672',
      green: '#A6E22E',
      yellow: '#E6DB74',
      orange: '#FD971F',
      violet: '#AE81FF',
    },
  },
  'cyber-twilight': {
    id: 'cyber-slate',
    name: 'Cyber Slate',
    isDark: true,
    monacoTheme: 'cyber-slate',
    background: '#0A0E17',
    surface: '#111827',
    surfaceBorder: '#1F293D',
    text: '#F3F4F6',
    subtext: '#9CA3AF',
    accent: '#00F0FF',
    colors: {
      black: '#F3F4F6',
      grey: '#6E7681',
      blue: '#00F0FF',
      red: '#FF003C',
      green: '#39FF14',
      yellow: '#FCE205',
      orange: '#FF8A00',
      violet: '#BD00FF',
    },
  },
  'github-clean': {
    id: 'github-pure',
    name: 'GitHub Clean',
    isDark: false,
    monacoTheme: 'github-pure',
    background: '#FFFFFF',
    surface: '#F6F8FA',
    surfaceBorder: '#D0D7DE',
    text: '#1F2328',
    subtext: '#59636E',
    accent: '#0969DA',
    colors: {
      black: '#1F2328',
      grey: '#8C959F',
      blue: '#0969DA',
      red: '#CF222E',
      green: '#1A7F37',
      yellow: '#9A6700',
      orange: '#BC4C00',
      violet: '#8250DF',
    },
  },
  'solarized-paper': {
    id: 'solarized-sand',
    name: 'Solarized Cream',
    isDark: false,
    monacoTheme: 'solarized-sand',
    background: '#FDF6E3',
    surface: '#F7EED8',
    surfaceBorder: '#E0D6C3',
    text: '#073642',
    subtext: '#586E75',
    accent: '#B58900',
    colors: {
      black: '#073642',
      grey: '#839496',
      blue: '#268BD2',
      red: '#DC322F',
      green: '#859900',
      yellow: '#B58900',
      orange: '#CB4B16',
      violet: '#6C71C4',
    },
  },
  'nord-snow': {
    id: 'nord-blizzard',
    name: 'Nord Frost',
    isDark: false,
    monacoTheme: 'nord-blizzard',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceBorder: '#CBD5E1',
    text: '#0F172A',
    subtext: '#475569',
    accent: '#2563EB',
    colors: {
      black: '#0F172A',
      grey: '#64748B',
      blue: '#0284C7',
      red: '#BE123C',
      green: '#059669',
      yellow: '#D97706',
      orange: '#EA580C',
      violet: '#7C3AED',
    },
  },
  'warm-sand': {
    id: 'lobby-light',
    name: 'Warm Sand',
    isDark: false,
    monacoTheme: 'lobby-light',
    background: '#FDFCF7',
    surface: '#FFFFFF',
    surfaceBorder: '#E5E0D5',
    text: '#1C1917',
    subtext: '#57534E',
    accent: '#C85A32',
    colors: {
      black: '#1C1917',
      grey: '#78716C',
      blue: '#0284C7',
      red: '#DC2626',
      green: '#15803D',
      yellow: '#D97706',
      orange: '#EA580C',
      violet: '#7C3AED',
    },
  },
  'minimal-slate-light': {
    id: 'minimal-zinc',
    name: 'Minimal Zinc',
    isDark: false,
    monacoTheme: 'minimal-zinc',
    background: '#FFFFFF',
    surface: '#F4F4F5',
    surfaceBorder: '#E4E4E7',
    text: '#09090B',
    subtext: '#52525B',
    accent: '#18181B',
    colors: {
      black: '#09090B',
      grey: '#71717A',
      blue: '#2563EB',
      red: '#E11D48',
      green: '#16A34A',
      yellow: '#CA8A04',
      orange: '#EA580C',
      violet: '#9333EA',
    },
  },
  cyberpunk: {
    id: 'cyber-slate',
    name: 'Cyber Slate',
    isDark: true,
    monacoTheme: 'cyber-slate',
    background: '#0A0E17',
    surface: '#111827',
    surfaceBorder: '#1F293D',
    text: '#F3F4F6',
    subtext: '#9CA3AF',
    accent: '#00F0FF',
    colors: {
      black: '#F3F4F6',
      grey: '#6E7681',
      blue: '#00F0FF',
      red: '#FF003C',
      green: '#39FF14',
      yellow: '#FCE205',
      orange: '#FF8A00',
      violet: '#BD00FF',
    },
  },
  dracula: {
    id: 'dracula-midnight',
    name: 'Dracula Midnight',
    isDark: true,
    monacoTheme: 'dracula-midnight',
    background: '#21222C',
    surface: '#282A36',
    surfaceBorder: '#44475A',
    text: '#F8F8F2',
    subtext: '#9CA7C5',
    accent: '#BD93F9',
    colors: {
      black: '#F8F8F2',
      grey: '#6272A4',
      blue: '#8BE9FD',
      red: '#FF5555',
      green: '#50FA7B',
      yellow: '#F1FA8C',
      orange: '#FFB86C',
      violet: '#BD93F9',
    },
  },
  monokai: {
    id: 'monokai-warm',
    name: 'Monokai Warm',
    isDark: true,
    monacoTheme: 'monokai-warm',
    background: '#272822',
    surface: '#34352E',
    surfaceBorder: '#49483E',
    text: '#F8F8F2',
    subtext: '#969280',
    accent: '#FFD866',
    colors: {
      black: '#F8F8F2',
      grey: '#75715E',
      blue: '#66D9EF',
      red: '#F92672',
      green: '#A6E22E',
      yellow: '#E6DB74',
      orange: '#FD971F',
      violet: '#AE81FF',
    },
  },
  'github-light': {
    id: 'github-pure',
    name: 'GitHub Clean',
    isDark: false,
    monacoTheme: 'github-pure',
    background: '#FFFFFF',
    surface: '#F6F8FA',
    surfaceBorder: '#D0D7DE',
    text: '#1F2328',
    subtext: '#59636E',
    accent: '#0969DA',
    colors: {
      black: '#1F2328',
      grey: '#8C959F',
      blue: '#0969DA',
      red: '#CF222E',
      green: '#1A7F37',
      yellow: '#9A6700',
      orange: '#BC4C00',
      violet: '#8250DF',
    },
  },
};

/**
 * Registers all 10 custom solid-color themes into Monaco Editor
 */
export function registerMonacoThemes(monaco: typeof MonacoType): void {
  const registered = new Set<string>();

  Object.entries(THEME_PALETTES).forEach(([key, p]) => {
    const aliasNames = [key, p.id, p.monacoTheme];

    aliasNames.forEach((themeName) => {
      if (!themeName || registered.has(themeName)) return;
      registered.add(themeName);

      monaco.editor.defineTheme(themeName, {
        base: p.isDark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [
          { token: '', foreground: p.text.replace('#', '') },
          { token: 'keyword', foreground: p.colors.red.replace('#', ''), fontStyle: 'bold' },
          { token: 'string', foreground: p.colors.green.replace('#', '') },
          { token: 'variable', foreground: p.colors.blue.replace('#', '') },
          { token: 'function', foreground: p.colors.yellow.replace('#', '') },
          { token: 'type', foreground: p.colors.violet.replace('#', ''), fontStyle: 'italic' },
          { token: 'number', foreground: p.colors.orange.replace('#', '') },
          { token: 'comment', foreground: p.subtext.replace('#', ''), fontStyle: 'italic' },
          { token: 'operator', foreground: p.colors.blue.replace('#', '') },
        ],
        colors: {
          'editor.background': p.background,
          'editor.foreground': p.text,
          'editor.lineHighlightBackground': p.isDark ? `${p.surface}66` : `${p.surface}99`,
          'editorLineNumber.foreground': p.subtext,
          'editorLineNumber.activeForeground': p.accent,
          'editor.selectionBackground': `${p.accent}25`,
          'editorCursor.foreground': p.accent,
          'editorIndentGuide.background': p.isDark ? `${p.surfaceBorder}66` : `${p.surfaceBorder}aa`,
          'editorBracketMatch.border': p.accent,
          'editorGutter.background': p.background,
        },
      });
    });
  });
}

/**
 * Dynamically injects theme surface and background variables into the DOM
 */
export function injectThemeStyles(palette: ThemePalette): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--pg-background', palette.background);
  root.style.setProperty('--pg-surface', palette.surface);
  root.style.setProperty('--pg-border', palette.surfaceBorder);
  root.style.setProperty('--pg-text', palette.text);
  root.style.setProperty('--pg-subtext', palette.subtext);
  root.style.setProperty('--pg-accent', palette.accent);
  root.style.setProperty(
    '--pg-hover',
    palette.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
  );
  root.style.setProperty(
    '--pg-active',
    palette.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.10)'
  );
  root.style.setProperty(
    '--pg-input-bg',
    palette.isDark ? 'rgba(0, 0, 0, 0.3)' : '#ffffff'
  );
  root.style.setProperty(
    '--pg-code-bg',
    palette.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.06)'
  );

  root.style.colorScheme = palette.isDark ? 'dark' : 'light';
}

/**
 * Applies palette overrides to Tldraw's CSS variables
 */
export async function applyTldrawPaletteOverride(palette: ThemePalette): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  root.style.setProperty('--color-background', palette.background);
  root.style.setProperty('--color-panel', palette.surface);
  root.style.setProperty('--color-muted-1', palette.surfaceBorder);
  root.style.setProperty('--color-text', palette.text);
  root.style.setProperty('--color-text-0', palette.text);
  root.style.setProperty('--color-text-1', palette.subtext);
}
