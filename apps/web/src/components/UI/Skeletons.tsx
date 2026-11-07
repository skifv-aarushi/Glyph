'use client';

import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Clean pulse/shimmer skeleton matching the Lobby card elevation and surface tokens.
 */
export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 3, className = '' }) => {
  const { palette } = useTheme();

  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl border animate-pulse flex items-center justify-between"
          style={{
            backgroundColor: `${palette.surface}80`,
            borderColor: palette.surfaceBorder,
          }}
        >
          <div className="space-y-2 flex-1 pr-4">
            <div className="flex items-center space-x-2">
              <div
                className="h-4 w-36 rounded bg-white/10"
                style={{ backgroundColor: `${palette.text}18` }}
              />
              <div
                className="h-3 w-16 rounded bg-white/10"
                style={{ backgroundColor: `${palette.accent}25` }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <div
                className="h-3 w-24 rounded bg-white/5"
                style={{ backgroundColor: `${palette.text}10` }}
              />
              <div
                className="h-3 w-16 rounded bg-white/5"
                style={{ backgroundColor: `${palette.text}10` }}
              />
            </div>
          </div>
          <div
            className="h-8 w-20 rounded-lg bg-white/10"
            style={{ backgroundColor: `${palette.text}15` }}
          />
        </div>
      ))}
    </div>
  );
};

export const TreeSkeleton: React.FC<{ items?: number }> = ({ items = 8 }) => {
  const { palette } = useTheme();

  return (
    <div className="p-3 space-y-2 animate-pulse font-mono">
      {Array.from({ length: items }).map((_, i) => {
        const indent = (i % 3) * 16;
        const width = [96, 128, 80, 112, 140, 72, 120, 100][i % 8];
        return (
          <div
            key={i}
            className="flex items-center space-x-2 py-1"
            style={{ paddingLeft: `${indent}px` }}
          >
            <div
              className="w-3.5 h-3.5 rounded bg-white/10 shrink-0"
              style={{ backgroundColor: `${palette.text}18` }}
            />
            <div
              className="h-3 rounded bg-white/10"
              style={{
                width: `${width}px`,
                backgroundColor: `${palette.text}14`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export const EditorCodeSkeleton: React.FC<{ lines?: number }> = ({ lines = 18 }) => {
  const { palette } = useTheme();

  return (
    <div
      className="h-full w-full p-6 space-y-2.5 animate-pulse font-mono select-none"
      style={{ backgroundColor: palette.background }}
    >
      {Array.from({ length: lines }).map((_, i) => {
        const indent = (i % 4 === 1 ? 24 : i % 4 === 2 ? 48 : i % 4 === 3 ? 24 : 0);
        const widthPercent = [65, 40, 80, 30, 50, 70, 45, 90, 60, 35, 75, 55][i % 12];

        return (
          <div key={i} className="flex items-center space-x-4">
            <span
              className="w-8 text-right text-[11px] select-none opacity-25"
              style={{ color: palette.text }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div
              className="h-3.5 rounded"
              style={{
                marginLeft: `${indent}px`,
                width: `${widthPercent}%`,
                backgroundColor: `${palette.text}14`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export type RoomTransitionStage =
  | 'idle'
  | 'verifying-token'
  | 'fetching-tree'
  | 'rehydrating-crdt'
  | 'mounted';

export interface ProgressiveStatusModalProps {
  currentStage: RoomTransitionStage;
  onCancel?: () => void;
}

const STAGES: { id: RoomTransitionStage; title: string; subtitle: string }[] = [
  {
    id: 'verifying-token',
    title: 'Verifying session token',
    subtitle: 'Checking collaborator identity and role permissions...',
  },
  {
    id: 'fetching-tree',
    title: 'Fetching repository tree',
    subtitle: 'Extracting Git commit tree and file hierarchy...',
  },
  {
    id: 'rehydrating-crdt',
    title: 'Rehydrating CRDT document',
    subtitle: 'Synchronizing Yjs binary update stream and spatial layers...',
  },
  {
    id: 'mounted',
    title: 'Mounted',
    subtitle: 'Workspace ready. Initializing Monaco and Tldraw canvas...',
  },
];

export const ProgressiveStatusModal: React.FC<ProgressiveStatusModalProps> = ({
  currentStage,
  onCancel,
}) => {
  const { palette } = useTheme();

  if (currentStage === 'idle') return null;

  const getStageIndex = (stage: RoomTransitionStage): number => {
    switch (stage) {
      case 'verifying-token':
        return 0;
      case 'fetching-tree':
        return 1;
      case 'rehydrating-crdt':
        return 2;
      case 'mounted':
        return 3;
      default:
        return -1;
    }
  };

  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono text-xs select-none animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-xl p-6 border shadow-2xl space-y-5"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
          color: palette.text,
        }}
      >
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3 border-b" style={{ borderColor: palette.surfaceBorder }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-xs"
            style={{
              backgroundColor: `${palette.accent}20`,
              borderColor: palette.accent,
              color: palette.accent,
            }}
          >
            PG
          </div>
          <div>
            <h3 className="font-semibold text-sm">Connecting to Workspace</h3>
            <span className="text-[11px] opacity-60">Spatial session initialization</span>
          </div>
        </div>

        {/* Stack of 4 stages */}
        <div className="space-y-3">
          {STAGES.map((s, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div
                key={s.id}
                className={`flex items-start space-x-3 p-2.5 rounded-lg border transition-all duration-200 ${
                  isCurrent
                    ? palette.isDark ? 'bg-white/5 border-white/20' : 'bg-black/5 border-black/10'
                    : isCompleted
                    ? 'opacity-85 border-transparent'
                    : 'opacity-30 border-transparent'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: palette.accent }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-gray-600 flex items-center justify-center text-[9px]">
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${isCurrent ? 'font-bold' : ''}`} style={{ color: palette.text }}>
                      {s.title}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">
                        DONE
                      </span>
                    )}
                    {isCurrent && (
                      <span
                        className="text-[10px] uppercase tracking-wider font-semibold animate-pulse"
                        style={{ color: palette.accent }}
                      >
                        SYNCING
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] opacity-60 mt-0.5 line-clamp-1">
                    {s.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {onCancel && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onCancel}
              className="text-[11px] opacity-60 hover:opacity-100 hover:underline transition-opacity"
            >
              Cancel Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

