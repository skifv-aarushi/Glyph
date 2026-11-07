'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Palette, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeId } from '../../utils/themes';

export interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className = '' }) => {
  const { theme, setTheme, palette, allPalettes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const darkThemes = Object.values(allPalettes).filter(
    (p, idx, arr) => p.isDark && arr.findIndex((x) => x.name === p.name) === idx
  );
  const lightThemes = Object.values(allPalettes).filter(
    (p, idx, arr) => !p.isDark && arr.findIndex((x) => x.name === p.name) === idx
  );

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative flex-none ${className}`}>
      {/* Fixed-dimension trigger button: Prevents layout shift across varying theme name lengths */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex-none w-[140px] h-8 px-2.5 rounded-lg border text-xs flex items-center justify-between gap-1.5 transition-all duration-100 ease-out active:scale-[0.98] select-none cursor-pointer focus:outline-none"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surfaceBorder}20`,
          color: palette.text,
        }}
        title="Theme Selector"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <Palette className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
          <span className="font-mono text-[11px] truncate whitespace-nowrap overflow-hidden text-ellipsis">
            {palette.name}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-none opacity-60 transition-transform duration-150 ease-out ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu: Strict 1px border, subtle shadow elevation, zero neon glow */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available Themes"
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border p-1.5 z-50 backdrop-blur-md shadow-lg transition-all duration-150 ease-out font-mono text-xs select-none"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.surfaceBorder,
            color: palette.text,
            boxShadow: palette.isDark
              ? '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.4)'
              : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider opacity-50">
            Dark Themes
          </div>
          <div className="space-y-0.5">
            {darkThemes.map((p) => {
              const isSelected = theme === p.id || allPalettes[theme]?.name === p.name;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setTheme(p.id as ThemeId);
                    setIsOpen(false);
                  }}
                  className={`w-full h-7.5 px-2.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer ${
                    isSelected
                      ? palette.isDark
                        ? 'bg-white/15 font-semibold'
                        : 'bg-black/10 font-semibold'
                      : palette.isDark
                      ? 'hover:bg-white/5 opacity-80 hover:opacity-100'
                      : 'hover:bg-black/5 opacity-80 hover:opacity-100'
                  }`}
                  style={{ color: palette.text }}
                >
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/30 flex-none"
                      style={{ backgroundColor: p.background }}
                    />
                    <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis text-[11px]">
                      {p.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
                  )}
                </button>
              );
            })}
          </div>

          <div
            className="px-2 py-1 pt-2 mt-1 text-[10px] uppercase font-bold tracking-wider opacity-50 border-t"
            style={{ borderColor: palette.surfaceBorder }}
          >
            Light Themes
          </div>
          <div className="space-y-0.5">
            {lightThemes.map((p) => {
              const isSelected = theme === p.id || allPalettes[theme]?.name === p.name;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setTheme(p.id as ThemeId);
                    setIsOpen(false);
                  }}
                  className={`w-full h-7.5 px-2.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-all duration-100 ease-out active:scale-[0.98] cursor-pointer ${
                    isSelected
                      ? palette.isDark
                        ? 'bg-white/15 font-semibold'
                        : 'bg-black/10 font-semibold'
                      : palette.isDark
                      ? 'hover:bg-white/5 opacity-80 hover:opacity-100'
                      : 'hover:bg-black/5 opacity-80 hover:opacity-100'
                  }`}
                  style={{ color: palette.text }}
                >
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-black/30 flex-none"
                      style={{ backgroundColor: p.background }}
                    />
                    <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis text-[11px]">
                      {p.name}
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;

