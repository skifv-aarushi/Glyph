'use client';

import React from 'react';
import { X, Keyboard, Command, MousePointer, Layers, MoveHorizontal } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutCategory {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  items: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Modes & Navigation',
    icon: Command,
    items: [
      { keys: ['Alt', 'D'], description: 'Spatial Draw Mode' },
      { keys: ['Alt', 'C'], description: 'Monaco Code Mode' },
      { keys: ['Esc'], description: 'Return to Code Mode' },
      { keys: ['Ctrl', 'Enter'], description: 'Execute sandbox runner' },
      { keys: ['Ctrl', 'P'], description: 'Quick open file' },
    ],
  },
  {
    title: 'Canvas Tools (Draw Mode)',
    icon: MousePointer,
    items: [
      { keys: ['V'], description: 'Select & Transform' },
      { keys: ['D'], description: 'Pencil / Draw' },
      { keys: ['E'], description: 'Eraser (Active layer)' },
      { keys: ['A'], description: 'Arrow connector' },
      { keys: ['R'], description: 'Rectangle shape' },
      { keys: ['T'], description: 'Text note' },
    ],
  },
  {
    title: 'Layers & History',
    icon: Layers,
    items: [
      { keys: ['L'], description: 'Toggle Layers HUD' },
      { keys: ['S'], description: 'Toggle Sticker catalog' },
      { keys: ['Ctrl', 'Z'], description: 'Undo canvas edit' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo canvas edit' },
    ],
  },
  {
    title: 'Layout',
    icon: MoveHorizontal,
    items: [
      {
        keys: ['Drag Edge'],
        description: 'Drag right edge of File Explorer to resize',
      },
    ],
  },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { palette } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 font-mono select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 flex-none"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Modal Header: Stationary height */}
        <div
          className="h-14 px-6 border-b flex items-center justify-between flex-none"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.surfaceBorder}20`,
          }}
        >
          <div className="flex items-center space-x-2.5">
            <div
              className="w-7 h-7 rounded-lg border flex items-center justify-center flex-none"
              style={{
                borderColor: `${palette.accent}50`,
                backgroundColor: `${palette.accent}15`,
                color: palette.accent,
              }}
            >
              <Keyboard className="w-4 h-4 flex-none" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-sm font-bold tracking-tight truncate">
                Keyboard Shortcuts & Controls
              </h2>
              <p className="text-[11px] opacity-60 truncate">Direct keybindings</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center flex-none transition-colors btn-tactile"
            style={{ color: palette.subtext }}
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {SHORTCUT_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.title} className="space-y-2">
                <div className="flex items-center space-x-2 text-[11px] font-semibold opacity-70 uppercase tracking-wider">
                  <Icon className="w-3.5 h-3.5 flex-none" style={{ color: palette.accent }} />
                  <span className="truncate">{cat.title}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="h-9 flex items-center justify-between px-3 rounded-lg border"
                      style={{
                        borderColor: palette.surfaceBorder,
                        backgroundColor: `${palette.surfaceBorder}10`,
                      }}
                    >
                      <span className="opacity-80 text-[11px] truncate mr-2">{item.description}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="h-5 min-w-[20px] px-1.5 rounded border text-[10px] font-mono tabular-nums font-bold shadow-sm flex items-center justify-center flex-none"
                            style={{
                              backgroundColor: palette.isDark ? '#18181B' : '#FFFFFF',
                              borderColor: palette.surfaceBorder,
                              color: palette.text,
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer: Stationary height */}
        <div
          className="h-12 px-6 border-t flex items-center justify-between text-[11px] flex-none"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.surfaceBorder}20`,
            color: palette.subtext,
          }}
        >
          <span className="truncate">Press Esc or click outside to dismiss</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 min-w-[72px] px-3.5 rounded-lg border font-semibold text-xs transition-colors hover:bg-white/10 flex items-center justify-center flex-none btn-tactile"
            style={{
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
