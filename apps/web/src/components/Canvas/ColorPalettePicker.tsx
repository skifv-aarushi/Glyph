// apps/web/src/components/Canvas/ColorPalettePicker.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Pipette, Check, History, Palette as PaletteIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ColorPalettePickerProps {
  currentColor: string;
  onChangeColor: (color: string) => void;
  recentColors?: string[];
  onAddRecentColor?: (color: string) => void;
}

const DEFAULT_PRESETS = [
  '#F0F6FC', // White / Bone
  '#00F0FF', // Neon Cyan
  '#39FF14', // Acid Green
  '#FF003C', // Hot Red
  '#FCE205', // Electric Yellow
  '#BD00FF', // Violet
  '#FF8A00', // Amber
  '#58A6FF', // Sky Blue
  '#7EE787', // Mint
  '#8B949E', // Slate Grey
];

const RECENT_COLORS_STORAGE_KEY = 'pg_recent_colors';
const RECENT_COLORS_EVENT = 'pg_recent_colors_updated';

/**
 * Normalizes any hex string into a safe 7-character lowercase format (#rrggbb)
 * required by the native HTML <input type="color"> to prevent browser crashes.
 */
export function toColorInputValue(color: string): string {
  if (!color) return '#3b82f6';
  let cleaned = color.trim();
  if (!cleaned.startsWith('#')) cleaned = '#' + cleaned;
  if (/^#[0-9A-Fa-f]{3}$/.test(cleaned)) {
    cleaned = '#' + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3];
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return cleaned.toLowerCase();
  }
  return '#3b82f6';
}

/**
 * Dynamically recolors an SVG string by overriding currentColor, fills, and strokes
 * while preserving none/transparent attributes.
 */
export function recolorSvg(svgString: string, colorHex: string): string {
  if (!svgString) return '';
  return svgString
    .replace(/currentColor/gi, colorHex)
    .replace(/fill="(?!none|transparent)[^"]*"/gi, `fill="${colorHex}"`)
    .replace(/stroke="(?!none|transparent)[^"]*"/gi, `stroke="${colorHex}"`);
}

export const ColorPalettePicker: React.FC<ColorPalettePickerProps> = ({
  currentColor,
  onChangeColor,
  recentColors: propsRecentColors,
  onAddRecentColor,
}) => {
  const { palette } = useTheme();
  const [internalRecents, setInternalRecents] = useState<string[]>(DEFAULT_PRESETS);
  const [textInput, setTextInput] = useState<string>(currentColor);
  const [hasEyeDropper, setHasEyeDropper] = useState(false);

  // Synchronize textInput when external currentColor changes
  useEffect(() => {
    setTextInput(currentColor);
  }, [currentColor]);

  // Load from localStorage and listen to cross-instance sync events
  useEffect(() => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      setHasEyeDropper(true);
    }

    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setInternalRecents(parsed.slice(0, 10));
          }
        }
      } catch {}
    };

    loadFromStorage();

    const handleCustomSync = (e: Event) => {
      const customEvt = e as CustomEvent<string[]>;
      if (Array.isArray(customEvt.detail) && customEvt.detail.length > 0) {
        setInternalRecents(customEvt.detail.slice(0, 10));
      } else {
        loadFromStorage();
      }
    };

    window.addEventListener(RECENT_COLORS_EVENT, handleCustomSync);
    window.addEventListener('storage', loadFromStorage);

    return () => {
      window.removeEventListener(RECENT_COLORS_EVENT, handleCustomSync);
      window.removeEventListener('storage', loadFromStorage);
    };
  }, []);

  const effectiveRecents = useMemo(() => {
    if (propsRecentColors && propsRecentColors.length > 0) {
      return propsRecentColors.slice(0, 10);
    }
    return internalRecents;
  }, [propsRecentColors, internalRecents]);

  const commitRecentColor = useCallback(
    (color: string) => {
      const upper = color.toUpperCase().trim();
      let normalized = upper.startsWith('#') ? upper : '#' + upper;
      if (/^#[0-9A-F]{3}$/i.test(normalized)) {
        normalized = '#' + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
      }
      if (!/^#[0-9A-F]{6}$/i.test(normalized)) return;

      const updated = [normalized, ...effectiveRecents.filter((c) => c.toUpperCase() !== normalized)].slice(0, 10);
      setInternalRecents(updated);

      try {
        localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(updated));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(RECENT_COLORS_EVENT, { detail: updated }));
        }
      } catch {}

      if (onAddRecentColor) {
        onAddRecentColor(normalized);
      }
    },
    [effectiveRecents, onAddRecentColor]
  );

  const handleSelectRecent = (color: string) => {
    setTextInput(color);
    onChangeColor(color);
    commitRecentColor(color);
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setTextInput(val);
    onChangeColor(val);
  };

  const handleNativeColorBlur = () => {
    commitRecentColor(textInput);
  };

  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextInput(val);
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      onChangeColor(val);
    }
  };

  const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let val = textInput.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
        onChangeColor(val);
        commitRecentColor(val);
      }
    }
  };

  const handleTextInputBlur = () => {
    let val = textInput.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
      onChangeColor(val);
      commitRecentColor(val);
    } else {
      setTextInput(currentColor);
    }
  };

  const handleEyeDropper = async () => {
    if (!hasEyeDropper || typeof window === 'undefined') return;
    try {
      const EyeDropperClass = (window as any).EyeDropper;
      const eyeDropper = new EyeDropperClass();
      const result = await eyeDropper.open();
      if (result?.sRGBHex) {
        handleSelectRecent(result.sRGBHex.toUpperCase());
      }
    } catch (err) {
      console.warn('EyeDropper cancelled or unsupported:', err);
    }
  };

  const safeColorInputValue = toColorInputValue(currentColor);

  return (
    <div className="flex flex-col space-y-2.5 font-mono text-xs select-none">
      {/* Current Color Indicator + Native Color Input + EyeDropper */}
      <div className="flex items-center space-x-2">
        <div className="relative flex items-center space-x-2 flex-1">
          <input
            type="color"
            value={safeColorInputValue}
            onChange={handleNativeColorChange}
            onBlur={handleNativeColorBlur}
            className="w-8 h-8 rounded border bg-transparent cursor-pointer p-0"
            style={{ borderColor: palette.surfaceBorder }}
            title="Choose custom HEX color"
          />
          <input
            type="text"
            value={textInput}
            onChange={handleTextInputChange}
            onKeyDown={handleTextInputKeyDown}
            onBlur={handleTextInputBlur}
            className="w-24 px-2 py-1 text-[11px] rounded border font-mono uppercase focus:outline-none transition-colors"
            style={{
              backgroundColor: palette.isDark ? 'rgba(0,0,0,0.3)' : '#ffffff',
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
            placeholder="#00F0FF"
          />
        </div>

        {hasEyeDropper && (
          <button
            type="button"
            onClick={handleEyeDropper}
            className={`p-1.5 rounded border transition-colors ${
              palette.isDark
                ? 'bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white'
                : 'bg-black/5 hover:bg-black/10 text-gray-700 hover:text-black'
            }`}
            style={{ borderColor: palette.surfaceBorder }}
            title="Pick color from screen (EyeDropper)"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Recents Swatch Bar (10 Swatches) */}
      <div className="space-y-1">
        <div className="text-[10px] text-gray-400 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <History className="w-2.5 h-2.5" />
            <span>Recent Palette (10)</span>
          </span>
          <span className="text-[9px] text-gray-500 uppercase">{currentColor}</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 pt-0.5">
          {effectiveRecents.map((hex, idx) => {
            const isSelected = hex.toLowerCase() === currentColor.toLowerCase();
            return (
              <button
                key={`${hex}-${idx}`}
                type="button"
                onClick={() => handleSelectRecent(hex)}
                className="w-6 h-6 rounded flex items-center justify-center border border-black/40 transition-transform hover:scale-110 relative"
                style={{ backgroundColor: hex }}
                title={`Select ${hex}`}
              >
                {isSelected && (
                  <Check
                    className={`w-3 h-3 ${
                      ['#ffffff', '#f0f6fc', '#fdf6e3', '#f8f8f2'].includes(hex.toLowerCase())
                        ? 'text-black'
                        : 'text-white'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ColorPalettePicker;
