'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Editor as TldrawEditor, TLImageAsset } from '@tldraw/tldraw';
import { createShapeId } from '@tldraw/tldraw';
import {
  Search,
  X,
  Sparkles,
  Cloud,
  Database,
  Cpu,
  Layers,
  Palette,
  Loader2,
  Check,
  Shapes,
  Layout,
  GripVertical,
} from 'lucide-react';
import { ARCHITECTURE_STICKERS, ArchitectureSticker } from './stickersData';
import { ColorPalettePicker } from '../Canvas/ColorPalettePicker';
import { useTheme } from '../../context/ThemeContext';

export interface StickerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  editor?: TldrawEditor | null;
  onInsertSticker?: (sticker: ArchitectureSticker) => void;
  onInsertSvgSticker?: (svgUrl: string, name: string) => void;
}

export interface StickerItem {
  id: string; // e.g. "logos:aws" or "lucide:database"
  prefix: string;
  name: string;
  category: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All Stickers', icon: Shapes },
  { id: 'cloud', label: 'Cloud Providers', icon: Cloud },
  { id: 'database', label: 'Databases', icon: Database },
  { id: 'devtools', label: 'Dev Tools', icon: Cpu },
  { id: 'architecture', label: 'Architecture', icon: Layers },
  { id: 'ui', label: 'UI Icons', icon: Layout },
];

const CURATED_STICKERS: StickerItem[] = [
  // Cloud
  { id: 'logos:aws', prefix: 'logos', name: 'aws', category: 'cloud' },
  { id: 'logos:google-cloud', prefix: 'logos', name: 'google-cloud', category: 'cloud' },
  { id: 'logos:azure-icon', prefix: 'logos', name: 'azure-icon', category: 'cloud' },
  { id: 'logos:cloudflare', prefix: 'logos', name: 'cloudflare', category: 'cloud' },
  { id: 'logos:vercel-icon', prefix: 'logos', name: 'vercel-icon', category: 'cloud' },
  { id: 'logos:kubernetes', prefix: 'logos', name: 'kubernetes', category: 'cloud' },
  { id: 'logos:docker-icon', prefix: 'logos', name: 'docker-icon', category: 'cloud' },

  // Databases
  { id: 'logos:postgresql', prefix: 'logos', name: 'postgresql', category: 'database' },
  { id: 'logos:redis', prefix: 'logos', name: 'redis', category: 'database' },
  { id: 'logos:mongodb-icon', prefix: 'logos', name: 'mongodb-icon', category: 'database' },
  { id: 'logos:mysql-icon', prefix: 'logos', name: 'mysql-icon', category: 'database' },
  { id: 'logos:supabase-icon', prefix: 'logos', name: 'supabase-icon', category: 'database' },
  { id: 'logos:sqlite', prefix: 'logos', name: 'sqlite', category: 'database' },

  // Dev Tools
  { id: 'logos:github-icon', prefix: 'logos', name: 'github-icon', category: 'devtools' },
  { id: 'logos:git-icon', prefix: 'logos', name: 'git-icon', category: 'devtools' },
  { id: 'logos:nodejs-icon', prefix: 'logos', name: 'nodejs-icon', category: 'devtools' },
  { id: 'logos:typescript-icon', prefix: 'logos', name: 'typescript-icon', category: 'devtools' },
  { id: 'logos:react', prefix: 'logos', name: 'react', category: 'devtools' },
  { id: 'logos:nextjs-icon', prefix: 'logos', name: 'nextjs-icon', category: 'devtools' },
  { id: 'logos:python', prefix: 'logos', name: 'python', category: 'devtools' },
  { id: 'logos:rust', prefix: 'logos', name: 'rust', category: 'devtools' },
  { id: 'logos:go', prefix: 'logos', name: 'go', category: 'devtools' },

  // Architecture / Components
  { id: 'lucide:server', prefix: 'lucide', name: 'server', category: 'architecture' },
  { id: 'lucide:network', prefix: 'lucide', name: 'network', category: 'architecture' },
  { id: 'lucide:cpu', prefix: 'lucide', name: 'cpu', category: 'architecture' },
  { id: 'lucide:shield', prefix: 'lucide', name: 'shield', category: 'architecture' },
  { id: 'lucide:lock', prefix: 'lucide', name: 'lock', category: 'architecture' },
  { id: 'lucide:globe', prefix: 'lucide', name: 'globe', category: 'architecture' },
  { id: 'lucide:activity', prefix: 'lucide', name: 'activity', category: 'architecture' },

  // UI Icons
  { id: 'lucide:layout', prefix: 'lucide', name: 'layout', category: 'ui' },
  { id: 'lucide:terminal', prefix: 'lucide', name: 'terminal', category: 'ui' },
  { id: 'lucide:box', prefix: 'lucide', name: 'box', category: 'ui' },
  { id: 'lucide:code-2', prefix: 'lucide', name: 'code-2', category: 'ui' },
  { id: 'lucide:zap', prefix: 'lucide', name: 'zap', category: 'ui' },
  { id: 'lucide:sliders', prefix: 'lucide', name: 'sliders', category: 'ui' },
];

/**
 * StickerPanel: Crisp, Linear/Stripe-grade SVG sticker catalog.
 * Connects to open-source Iconify API with category filters, dynamic recoloring (solid/line),
 * and precision insertion into the Tldraw spatial canvas overlay.
 */
export const StickerPanel: React.FC<StickerPanelProps> = ({
  isOpen,
  onClose,
  editor,
  onInsertSticker,
  onInsertSvgSticker,
}) => {
  const { palette } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StickerItem[]>(CURATED_STICKERS);
  const [isLoadingSearch, setIsLoadingSearch] = useState<boolean>(false);
  const [currentColor, setCurrentColor] = useState<string>(palette.accent || '#3B82F6');
  const [fillMode, setFillMode] = useState<'solid' | 'outline'>('outline');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = React.useRef<HTMLDivElement>(null);

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setIsColorPickerOpen(false);
      }
    };
    if (isColorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isColorPickerOpen]);

  // Live Iconify API Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      if (selectedCategory === 'all') {
        setSearchResults(CURATED_STICKERS);
      } else {
        setSearchResults(CURATED_STICKERS.filter((s) => s.category === selectedCategory));
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSearch(true);
      try {
        const query = encodeURIComponent(searchQuery.trim());
        const res = await fetch(`https://api.iconify.design/search?query=${query}&limit=32`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.icons)) {
            const parsed: StickerItem[] = data.icons.map((itemStr: string) => {
              const [prefix, ...rest] = itemStr.split(':');
              return {
                id: itemStr,
                prefix: prefix || 'custom',
                name: rest.join(':') || itemStr,
                category: 'search',
              };
            });
            setSearchResults(parsed);
          }
        }
      } catch (err) {
        console.warn('[StickerPanel] Iconify API search error:', err);
      } finally {
        setIsLoadingSearch(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSearchQuery('');
    if (catId === 'all') {
      setSearchResults(CURATED_STICKERS);
    } else {
      setSearchResults(CURATED_STICKERS.filter((s) => s.category === catId));
    }
  };

  const getSvgUrl = useCallback(
    (item: StickerItem) => {
      const hex = currentColor.replace('#', '');
      const colorParam = fillMode === 'solid' ? `?color=%23${hex}` : `?color=%23${hex}&stroke=%23${hex}`;
      return `https://api.iconify.design/${item.prefix}/${item.name}.svg${colorParam}`;
    },
    [currentColor, fillMode]
  );

  const handleInsertStickerItem = async (item: StickerItem) => {
    const svgUrl = getSvgUrl(item);

    if (onInsertSvgSticker) {
      onInsertSvgSticker(svgUrl, item.name);
      return;
    }

    if (!editor) return;

    try {
      const assetId = `asset:${item.id}-${Date.now()}` as any;
      const shapeId = createShapeId();

      const viewport = editor.getViewportScreenBounds();
      const centerScreen = {
        x: viewport.x + viewport.w / 2,
        y: viewport.y + viewport.h / 2,
      };
      const centerPage = editor.screenToPage(centerScreen);

      // Measure natural aspect ratio to eliminate clipping or distortion
      let width = 90;
      let height = 90;
      try {
        const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const nw = img.naturalWidth || 80;
            const nh = img.naturalHeight || 80;
            const aspect = nw / nh;
            const base = 96;
            if (aspect >= 1) {
              resolve({ w: base, h: Math.round(base / aspect) });
            } else {
              resolve({ w: Math.round(base * aspect), h: base });
            }
          };
          img.onerror = () => resolve({ w: 90, h: 90 });
          img.src = svgUrl;
        });
        width = dimensions.w;
        height = dimensions.h;
      } catch {
        width = 90;
        height = 90;
      }

      const imageAsset: TLImageAsset = {
        id: assetId,
        typeName: 'asset',
        type: 'image',
        props: {
          w: width,
          h: height,
          name: `${item.name}.svg`,
          isAnimated: false,
          mimeType: 'image/svg+xml',
          src: svgUrl,
        },
        meta: {},
      };

      editor.createAssets([imageAsset]);

      editor.createShapes([
        {
          id: shapeId,
          type: 'image',
          x: centerPage.x - width / 2,
          y: centerPage.y - height / 2,
          props: {
            assetId,
            w: width,
            h: height,
          },
          meta: {
            layerId: 'layer-architecture',
            stickerName: item.name,
          },
        },
      ]);

      editor.setCurrentTool('select');
      editor.select(shapeId);
    } catch (err) {
      console.warn('[StickerPanel] Error inserting sticker into canvas:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      aria-label="SVG Sticker Catalog"
      className="fixed bottom-20 right-8 z-40 w-96 rounded-xl border flex flex-col font-mono text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.surfaceBorder,
        color: palette.text,
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Panel Header */}
      <div
        className="h-11 px-4 flex items-center justify-between border-b"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surface}80`,
        }}
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4" style={{ color: palette.accent }} />
          <span className="font-semibold text-xs tracking-tight">SVG Sticker Catalog</span>
          <span
            className="text-[10px] px-1.5 py-0.2 rounded border"
            style={{
              borderColor: palette.surfaceBorder,
              backgroundColor: `${palette.surfaceBorder}30`,
              color: palette.subtext,
            }}
          >
            Iconify API
          </span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors"
          style={{ color: palette.subtext }}
          title="Close Stickers Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 border-b space-y-2" style={{ borderColor: palette.surfaceBorder }}>
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 absolute left-2.5 top-2.5"
            style={{ color: palette.subtext }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 200,000+ open-source icons..."
            className="w-full pl-8 pr-3 py-1.5 rounded border focus:outline-none text-xs transition-colors"
            style={{
              backgroundColor: palette.isDark ? 'rgba(0,0,0,0.25)' : '#ffffff',
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
          />
        </div>

        {/* Categories Carousel */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors border ${
                  isSelected
                    ? palette.isDark ? 'font-bold bg-white/15' : 'font-bold bg-black/10'
                    : palette.isDark ? 'hover:bg-white/5 opacity-70 hover:opacity-100' : 'hover:bg-black/5 opacity-70 hover:opacity-100'
                }`}
                style={{
                  borderColor: isSelected ? palette.accent : palette.surfaceBorder,
                  color: isSelected ? palette.text : palette.subtext,
                }}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recolor & Stroke Controls */}
      <div
        className="px-3 py-2 border-b flex items-center justify-between text-[11px]"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surface}40`,
        }}
      >
        <div className="flex items-center space-x-2">
          {/* Fill Mode Toggle */}
          <div
            className="flex items-center rounded border p-0.5 text-[10px]"
            style={{ borderColor: palette.surfaceBorder }}
          >
            <button
              onClick={() => setFillMode('outline')}
              className={`px-2 py-0.5 rounded transition-colors ${
                fillMode === 'outline'
                  ? palette.isDark ? 'bg-white/20 font-bold' : 'bg-black/10 font-bold'
                  : 'opacity-60'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setFillMode('solid')}
              className={`px-2 py-0.5 rounded transition-colors ${
                fillMode === 'solid'
                  ? palette.isDark ? 'bg-white/20 font-bold' : 'bg-black/10 font-bold'
                  : 'opacity-60'
              }`}
            >
              Solid
            </button>
          </div>

          {/* Color Indicator */}
          <div className="relative" ref={colorPickerRef}>
            <button
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition-colors ${
                palette.isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'
              }`}
              style={{ borderColor: palette.surfaceBorder }}
              title="Change Sticker Color"
            >
              <span
                className="w-3 h-3 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: currentColor }}
              />
              <Palette className="w-3 h-3" style={{ color: palette.subtext }} />
            </button>

            {isColorPickerOpen && (
              <div
                className="absolute bottom-full mb-2 left-0 z-[70] w-64 p-3 rounded-xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
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
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sticker Tint</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(false)}
                    className={`p-0.5 rounded transition-colors ${
                      palette.isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-black'
                    }`}
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ColorPalettePicker
                  currentColor={currentColor}
                  onChangeColor={(c) => {
                    setCurrentColor(c);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <span className="text-[10px] opacity-60">Click to insert on canvas</span>
      </div>

      {/* Stickers Grid */}
      <div className="p-3 max-h-[300px] overflow-y-auto grid grid-cols-4 gap-2 custom-scrollbar">
        {isLoadingSearch ? (
          <div className="col-span-4 py-8 flex flex-col items-center justify-center space-y-2 opacity-60">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: palette.accent }} />
            <span className="text-[11px]">Searching Iconify...</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="col-span-4 py-8 text-center text-[11px] opacity-60">
            No SVG stickers found.
          </div>
        ) : (
          searchResults.map((item) => {
            const svgUrl = getSvgUrl(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleInsertStickerItem(item)}
                className="group relative flex flex-col items-center justify-center p-1.5 rounded-lg border hover:border-current transition-all hover:bg-white/10"
                style={{
                  borderColor: palette.surfaceBorder,
                }}
                title={`Insert "${item.name}"`}
              >
                <div className="w-full h-9 flex items-center justify-center p-0.5 mb-1 transition-transform group-hover:scale-105">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={svgUrl}
                    alt={item.name}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    loading="lazy"
                  />
                </div>
                <span className="text-[9px] truncate max-w-full opacity-70 group-hover:opacity-100">
                  {item.name}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default StickerPanel;
