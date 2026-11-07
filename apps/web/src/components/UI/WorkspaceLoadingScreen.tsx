'use client';

import React from 'react';
import { Loader2, CheckCircle2, ShieldCheck, GitBranch, Layers, Code2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface WorkspaceLoadingScreenProps {
  title?: string;
  subtitle?: string;
  stageIndex?: number; // 0..3
  onCancel?: () => void;
}

const DEFAULT_STAGES = [
  { id: 'auth', label: 'Verifying session token & permissions', icon: ShieldCheck },
  { id: 'relay', label: 'Connecting to real-time CRDT relay', icon: Layers },
  { id: 'tree', label: 'Fetching repository tree & AST metadata', icon: GitBranch },
  { id: 'mount', label: 'Mounting Monaco editor & spatial canvas', icon: Code2 },
];

export const WorkspaceLoadingScreen: React.FC<WorkspaceLoadingScreenProps> = ({
  title = 'Initializing Workspace',
  subtitle = 'Connecting to real-time collaborative session...',
  stageIndex = 1,
  onCancel,
}) => {
  const { palette } = useTheme();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 font-mono select-none"
      style={{
        backgroundColor: palette.background,
        color: palette.text,
      }}
    >
      {/* Background Subtle Radar Effect */}
      <div className="relative flex items-center justify-center mb-8">
        <div
          className="w-24 h-24 rounded-full border animate-ping opacity-15"
          style={{ borderColor: palette.accent }}
        />
        <div
          className="w-16 h-16 rounded-full border flex items-center justify-center shadow-lg"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: palette.surface,
          }}
        >
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: palette.accent }} />
        </div>
      </div>

      {/* Main Loading Card */}
      <div
        className="w-full max-w-md rounded-2xl border p-6 space-y-6 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
        }}
      >
        {/* Title & Badge */}
        <div className="text-center space-y-1.5 pb-2 border-b" style={{ borderColor: palette.surfaceBorder }}>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider"
            style={{
              borderColor: palette.surfaceBorder,
              backgroundColor: `${palette.surfaceBorder}20`,
              color: palette.accent,
            }}
          >
            <span>Glyph Studio</span>
          </div>
          <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
          <p className="text-xs opacity-60 truncate">{subtitle}</p>
        </div>

        {/* 4-Stage Progressive Checklist */}
        <div className="space-y-3">
          {DEFAULT_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isDone = idx < stageIndex;
            const isCurrent = idx === stageIndex;

            return (
              <div
                key={stage.id}
                className={`flex items-center space-x-3 text-xs transition-opacity ${
                  isDone
                    ? 'opacity-100 text-emerald-400'
                    : isCurrent
                    ? 'opacity-100 font-semibold'
                    : 'opacity-40'
                }`}
                style={{ color: isDone ? '#34D399' : isCurrent ? palette.text : palette.subtext }}
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: palette.accent }} />
                  ) : (
                    <Icon className="w-3.5 h-3.5 opacity-50" />
                  )}
                </div>

                <span className="truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: `${palette.surfaceBorder}60` }}
        >
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${Math.min(((stageIndex + 1) / 4) * 100, 100)}%`,
              backgroundColor: palette.accent,
            }}
          />
        </div>

        {/* Cancel Action */}
        {onCancel && (
          <div className="pt-2 text-center">
            <button
              onClick={onCancel}
              className="text-xs opacity-50 hover:opacity-100 underline transition-opacity"
            >
              Cancel and Return
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceLoadingScreen;

