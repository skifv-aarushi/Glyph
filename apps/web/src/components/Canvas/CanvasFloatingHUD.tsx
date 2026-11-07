'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Editor as TldrawEditor } from '@tldraw/tldraw';
import {
  DefaultColorStyle,
  DefaultColorThemePalette,
  DefaultDashStyle,
  DefaultFontStyle,
  DefaultHorizontalAlignStyle,
  DefaultSizeStyle,
  TLDefaultDashStyle,
  TLDefaultSizeStyle,
} from '@tldraw/tldraw';
import {
  MousePointer,
  Pencil,
  Eraser,
  ArrowRight,
  Square,
  Type,
  Layers,
  Sparkles,
  Palette,
  ChevronUp,
  ChevronDown,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ColorPalettePicker } from './ColorPalettePicker';

interface ColorPoint {
  id:
    | 'black'
    | 'grey'
    | 'light-violet'
    | 'violet'
    | 'blue'
    | 'light-blue'
    | 'yellow'
    | 'orange'
    | 'green'
    | 'light-green'
    | 'light-red'
    | 'red'
    | 'white';
  rgb: [number, number, number];
}

const TL_COLOR_POINTS: ColorPoint[] = [
  { id: 'black', rgb: [29, 29, 29] },
  { id: 'grey', rgb: [142, 142, 147] },
  { id: 'white', rgb: [245, 245, 245] },
  { id: 'light-violet', rgb: [229, 153, 247] },
  { id: 'violet', rgb: [174, 62, 201] },
  { id: 'blue', rgb: [59, 130, 246] },
  { id: 'light-blue', rgb: [96, 165, 250] },
  { id: 'yellow', rgb: [255, 192, 52] },
  { id: 'orange', rgb: [247, 103, 7] },
  { id: 'green', rgb: [39, 174, 96] },
  { id: 'light-green', rgb: [111, 207, 151] },
  { id: 'light-red', rgb: [235, 87, 87] },
  { id: 'red', rgb: [224, 49, 49] },
];

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const int = parseInt(clean, 16);
  if (isNaN(int)) return [59, 130, 246];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

export function mapHexToTldrawColor(hex: string): ColorPoint['id'] {
  const [r, g, b] = hexToRgb(hex);
  let bestDist = Infinity;
  let bestId: ColorPoint['id'] = 'blue';

  for (const item of TL_COLOR_POINTS) {
    const dr = r - item.rgb[0];
    const dg = g - item.rgb[1];
    const db = b - item.rgb[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = item.id;
    }
  }
  return bestId;
}

interface CanvasFloatingHUDProps {
  editor: TldrawEditor | null;
  onToggleStickers: () => void;
  isStickersOpen: boolean;
  onToggleLayers: () => void;
  isLayersOpen: boolean;
  activeLayerName?: string;
}

export const CanvasFloatingHUD: React.FC<CanvasFloatingHUDProps> = ({
  editor,
  onToggleStickers,
  isStickersOpen,
  onToggleLayers,
  isLayersOpen,
  activeLayerName,
}) => {
  const { palette } = useTheme();
  const [activeTool, setActiveTool] = useState<string>('draw');
  const [activeDash, setActiveDash] = useState<TLDefaultDashStyle>('solid');
  const [activeSize, setActiveSize] = useState<TLDefaultSizeStyle>('m');
  const [activeColor, setActiveColor] = useState<string>('#3B82F6');
  const [activeFont, setActiveFont] = useState<'draw' | 'sans' | 'serif' | 'mono'>('sans');
  const [activeAlign, setActiveAlign] = useState<'start' | 'middle' | 'end'>('start');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isFontPickerOpen, setIsFontPickerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fontPickerRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setIsColorPickerOpen(false);
      }
      if (fontPickerRef.current && !fontPickerRef.current.contains(target)) {
        setIsFontPickerOpen(false);
      }
    };
    if (isColorPickerOpen || isFontPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorPickerOpen, isFontPickerOpen]);

  // Sync current tool from editor
  useEffect(() => {
    if (!editor) return;
    try {
      const tool = editor.getCurrentToolId();
      if (tool) setActiveTool(tool);
    } catch {
      // Ignore initial state
    }
  }, [editor]);

  const selectTool = (tool: string) => {
    if (!editor) return;
    try {
      editor.setCurrentTool(tool);
      setActiveTool(tool);
    } catch (err) {
      console.warn('[FloatingHUD] selectTool error:', err);
    }
  };

  const handleSetDash = (dash: TLDefaultDashStyle) => {
    if (!editor) return;
    setActiveDash(dash);
    try {
      editor.setStyleForNextShapes(DefaultDashStyle, dash);
      editor.setStyleForSelectedShapes(DefaultDashStyle, dash);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSetSize = (size: TLDefaultSizeStyle) => {
    if (!editor) return;
    setActiveSize(size);
    try {
      editor.setStyleForNextShapes(DefaultSizeStyle, size);
      editor.setStyleForSelectedShapes(DefaultSizeStyle, size);
    } catch (err) {
      console.warn(err);
    }
  };

  const handleSetFont = (font: 'draw' | 'sans' | 'serif' | 'mono') => {
    setActiveFont(font);
    if (!editor) return;
    try {
      editor.setStyleForNextShapes(DefaultFontStyle, font);
      editor.setStyleForSelectedShapes(DefaultFontStyle, font);
    } catch (err) {
      console.warn('[FloatingHUD] Error setting font:', err);
    }
  };

  const handleSetAlign = (align: 'start' | 'middle' | 'end') => {
    setActiveAlign(align);
    if (!editor) return;
    try {
      editor.setStyleForNextShapes(DefaultHorizontalAlignStyle, align);
      editor.setStyleForSelectedShapes(DefaultHorizontalAlignStyle, align);
    } catch (err) {
      console.warn('[FloatingHUD] Error setting align:', err);
    }
  };

  const handleColorChange = (hex: string) => {
    setActiveColor(hex);
    if (!editor) return;

    const tldrawColor = mapHexToTldrawColor(hex);

    try {
      if (DefaultColorThemePalette?.lightMode?.[tldrawColor]) {
        (DefaultColorThemePalette.lightMode[tldrawColor] as any).solid = hex;
        (DefaultColorThemePalette.lightMode[tldrawColor] as any).fill = hex;
      }
      if (DefaultColorThemePalette?.darkMode?.[tldrawColor]) {
        (DefaultColorThemePalette.darkMode[tldrawColor] as any).solid = hex;
        (DefaultColorThemePalette.darkMode[tldrawColor] as any).fill = hex;
      }

      editor.setStyleForNextShapes(DefaultColorStyle, tldrawColor);
      editor.setStyleForSelectedShapes(DefaultColorStyle, tldrawColor);
    } catch (err) {
      console.warn('[FloatingHUD] Error setting shape color:', err);
    }
  };

  const isDark = palette.isDark;
  const hoverClass = isDark
    ? 'text-gray-400 hover:text-white hover:bg-white/10'
    : 'text-gray-600 hover:text-black hover:bg-black/5';
  const activeClass = isDark
    ? 'bg-white/20 text-white font-bold'
    : 'bg-black/10 text-black font-bold';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center select-none font-mono text-xs animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Main Dock Container: Rigid padding & border */}
      <div
        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border transition-all shadow-xl"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`h-8 px-2 rounded-md transition-colors flex items-center space-x-1 flex-none btn-tactile ${hoverClass}`}
          title={isCollapsed ? 'Expand Dock' : 'Collapse Dock'}
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 flex-none" />
              <span
                className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded transition-colors flex-none"
                style={{
                  backgroundColor: `${palette.surfaceBorder}40`,
                  color: palette.text,
                }}
              >
                ~ Annotate
              </span>
            </>
          ) : (
            <ChevronDown className="w-3.5 h-3.5 flex-none" />
          )}
        </button>

        {!isCollapsed && (
          <>
            {/* Divider */}
            <div
              className="h-5 w-[1px] mx-1 shrink-0 flex-none"
              style={{ backgroundColor: palette.surfaceBorder }}
            />

            {/* Core Primitive Drawing Tools: Fixed 32x32px action targets */}
            <div className="flex items-center space-x-0.5 flex-none">
              {/* Select */}
              <button
                type="button"
                onClick={() => selectTool('select')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'select' ? activeClass : hoverClass
                }`}
                title="Select Tool (V)"
              >
                <MousePointer className="w-4 h-4" />
              </button>

              {/* Draw / Pen */}
              <button
                type="button"
                onClick={() => selectTool('draw')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'draw' ? activeClass : hoverClass
                }`}
                title="Pencil / Draw (D)"
              >
                <Pencil className="w-4 h-4" />
              </button>

              {/* Eraser */}
              <button
                type="button"
                onClick={() => selectTool('eraser')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'eraser' ? activeClass : hoverClass
                }`}
                title="Eraser (E)"
              >
                <Eraser className="w-4 h-4" />
              </button>

              {/* Arrow */}
              <button
                type="button"
                onClick={() => selectTool('arrow')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'arrow' ? activeClass : hoverClass
                }`}
                title="Arrow (A)"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Rectangle / Box */}
              <button
                type="button"
                onClick={() => selectTool('geo')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'geo' ? activeClass : hoverClass
                }`}
                title="Rectangle / Geometry (R)"
              >
                <Square className="w-4 h-4" />
              </button>

              {/* Text Tool */}
              <button
                type="button"
                onClick={() => {
                  selectTool('text');
                  setIsFontPickerOpen(true);
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-none transition-colors btn-tactile ${
                  activeTool === 'text' ? activeClass : hoverClass
                }`}
                title="Text Annotation (T)"
              >
                <Type className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div
              className="h-5 w-[1px] mx-1 shrink-0 flex-none"
              style={{ backgroundColor: palette.surfaceBorder }}
            />

            {/* Dash Style Selector */}
            <div className="flex items-center space-x-0.5 flex-none">
              {(['solid', 'dashed', 'dotted'] as TLDefaultDashStyle[]).map((dash) => (
                <button
                  key={dash}
                  type="button"
                  onClick={() => handleSetDash(dash)}
                  className={`w-7 h-7 rounded text-[10px] font-mono flex items-center justify-center flex-none transition-colors btn-tactile ${
                    activeDash === dash ? activeClass : hoverClass
                  }`}
                  title={`Dash: ${dash}`}
                >
                  {dash === 'solid' ? '—' : dash === 'dashed' ? '--' : '··'}
                </button>
              ))}
            </div>

            {/* Size Selector */}
            <div className="flex items-center space-x-0.5 flex-none">
              {(['s', 'm', 'l'] as TLDefaultSizeStyle[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSetSize(size)}
                  className={`w-7 h-7 rounded text-[10px] uppercase font-bold flex items-center justify-center flex-none transition-colors btn-tactile ${
                    activeSize === size ? activeClass : hoverClass
                  }`}
                  title={`Stroke: ${size.toUpperCase()}`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Typography & Font Formatting Popover */}
            <div className="relative flex-none" ref={fontPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setIsFontPickerOpen(!isFontPickerOpen);
                  setIsColorPickerOpen(false);
                }}
                className={`h-8 min-w-[72px] flex items-center justify-center space-x-1 px-2 rounded-lg transition-colors flex-none btn-tactile ${
                  isFontPickerOpen || activeTool === 'text' ? activeClass : hoverClass
                }`}
                title="Font Selection & Layout"
              >
                <span className="text-[10px] uppercase font-bold truncate">
                  {activeFont === 'draw'
                    ? 'Chalk'
                    : activeFont === 'serif'
                    ? 'Serif'
                    : activeFont === 'mono'
                    ? 'Mono'
                    : 'Sans'}
                </span>
                <ChevronUp className="w-3 h-3 opacity-60 flex-none" />
              </button>

              {isFontPickerOpen && (
                <div
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 w-64 p-3 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 mb-2.5 border-b"
                    style={{ borderColor: palette.surfaceBorder }}
                  >
                    <span className="font-semibold text-[11px] flex items-center space-x-1.5">
                      <Type className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
                      <span>Typography</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFontPickerOpen(false)}
                      className={`w-6 h-6 rounded flex items-center justify-center flex-none transition-colors btn-tactile ${hoverClass}`}
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Font Family Selection */}
                  <div className="space-y-1.5 mb-3">
                    <span className="text-[10px] opacity-60 uppercase font-semibold block">
                      Font Family
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'sans', label: 'Sans (Inter)', fontClass: 'font-sans' },
                        { id: 'serif', label: 'Serif (Georgia)', fontClass: 'font-serif' },
                        { id: 'mono', label: 'Mono (Fira)', fontClass: 'font-mono' },
                        { id: 'draw', label: 'Draw (Chalk)', fontClass: 'italic' },
                      ].map((item) => {
                        const isSelected = activeFont === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSetFont(item.id as any)}
                            className={`h-8 px-2.5 rounded-lg text-xs border text-left flex items-center truncate transition-all btn-tactile ${
                              item.fontClass
                            } ${isSelected ? 'font-bold' : 'opacity-70 hover:opacity-100'}`}
                            style={{
                              borderColor: isSelected ? palette.accent : palette.surfaceBorder,
                              backgroundColor: isSelected
                                ? isDark
                                  ? 'rgba(255,255,255,0.15)'
                                  : 'rgba(0,0,0,0.08)'
                                : undefined,
                              color: isSelected ? palette.accent : palette.text,
                            }}
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horizontal Alignment */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] opacity-60 uppercase font-semibold block">
                      Alignment
                    </span>
                    <div
                      className="flex items-center space-x-1 p-0.5 rounded-lg border"
                      style={{ borderColor: palette.surfaceBorder }}
                    >
                      {[
                        { id: 'start', label: 'Left', icon: AlignLeft },
                        { id: 'middle', label: 'Center', icon: AlignCenter },
                        { id: 'end', label: 'Right', icon: AlignRight },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeAlign === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSetAlign(item.id as any)}
                            className={`h-7 flex-1 rounded flex items-center justify-center space-x-1 transition-all btn-tactile ${
                              isSelected ? 'font-bold' : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{
                              backgroundColor: isSelected
                                ? isDark
                                  ? 'rgba(255,255,255,0.15)'
                                  : 'rgba(0,0,0,0.08)'
                                : undefined,
                              color: isSelected ? palette.accent : palette.text,
                            }}
                            title={`Align ${item.label}`}
                          >
                            <Icon className="w-3.5 h-3.5 flex-none" />
                            <span className="text-[10px] truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Color Palette Button & Popover */}
            <div className="relative flex-none" ref={colorPickerRef}>
              <button
                type="button"
                onClick={() => {
                  setIsColorPickerOpen(!isColorPickerOpen);
                  setIsFontPickerOpen(false);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-none btn-tactile ${
                  isColorPickerOpen ? activeClass : hoverClass
                }`}
                title="Color Palette"
              >
                <span
                  className="w-4 h-4 rounded-full border border-black/20 shadow-sm flex-none"
                  style={{ backgroundColor: activeColor }}
                />
              </button>

              {isColorPickerOpen && (
                <div
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 w-64 p-3 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.surfaceBorder,
                    color: palette.text,
                  }}
                >
                  <div
                    className="flex items-center justify-between pb-2 mb-2 border-b"
                    style={{ borderColor: palette.surfaceBorder }}
                  >
                    <span className="font-semibold text-[11px] flex items-center space-x-1.5">
                      <Palette className="w-3.5 h-3.5 text-blue-400 flex-none" />
                      <span>Stroke Color</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsColorPickerOpen(false)}
                      className={`w-6 h-6 rounded flex items-center justify-center flex-none transition-colors btn-tactile ${hoverClass}`}
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ColorPalettePicker
                    currentColor={activeColor}
                    onChangeColor={(c: string) => {
                      handleColorChange(c);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div
              className="h-5 w-[1px] mx-1 shrink-0 flex-none"
              style={{ backgroundColor: palette.surfaceBorder }}
            />

            {/* SVG Stickers Catalog Toggle */}
            <button
              type="button"
              onClick={onToggleStickers}
              className={`h-8 px-2.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 flex-none transition-all btn-tactile ${
                isStickersOpen ? activeClass : hoverClass
              }`}
              title="Open SVG Sticker Catalog"
            >
              <Sparkles className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
              <span className="text-[11px] truncate">Stickers</span>
            </button>

            {/* Canvas Layer Manager Toggle */}
            <button
              type="button"
              onClick={onToggleLayers}
              className={`h-8 max-w-[140px] px-2.5 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 flex-none transition-all btn-tactile ${
                isLayersOpen ? activeClass : hoverClass
              }`}
              title="Open Canvas Layer Manager"
            >
              <Layers className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
              <span className="text-[11px] truncate">
                {activeLayerName ? `Layers (${activeLayerName})` : 'Layers'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CanvasFloatingHUD;
