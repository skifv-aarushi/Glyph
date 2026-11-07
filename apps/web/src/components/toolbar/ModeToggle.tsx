'use client';

import React from 'react';
import { Code2, PenTool } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type InteractionMode = 'code' | 'draw';

interface ModeToggleProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  isReadOnly?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onModeChange }) => {
  const { palette } = useTheme();

  return (
    <div
      className="flex items-center p-1 rounded-xl border shadow-sm font-mono text-xs select-none"
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.surfaceBorder,
      }}
    >
      <button
        onClick={() => onModeChange('code')}
        title="Code Mode (Alt+C): View & navigate text in Monaco"
        className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
          mode === 'code' ? 'font-bold shadow-sm' : 'opacity-60 hover:opacity-100'
        }`}
        style={{
          backgroundColor:
            mode === 'code'
              ? palette.isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.08)'
              : undefined,
          color: mode === 'code' ? palette.text : palette.subtext,
        }}
      >
        <Code2 className="w-3.5 h-3.5" style={{ color: mode === 'code' ? palette.accent : undefined }} />
        <span>Code</span>
      </button>

      <button
        onClick={() => onModeChange('draw')}
        title="Draw Mode (Alt+D): Annotate directly over code buffer"
        className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
          mode === 'draw' ? 'font-bold shadow-sm' : 'opacity-60 hover:opacity-100'
        }`}
        style={{
          backgroundColor:
            mode === 'draw'
              ? palette.isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(0, 0, 0, 0.08)'
              : undefined,
          color: mode === 'draw' ? palette.text : palette.subtext,
        }}
      >
        <PenTool className="w-3.5 h-3.5" style={{ color: mode === 'draw' ? palette.accent : undefined }} />
        <span>Annotate</span>
      </button>
    </div>
  );
};

export default ModeToggle;
