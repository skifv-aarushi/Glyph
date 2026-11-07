// apps/web/src/components/editor/EditorSkeleton.tsx
'use client';

import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { FileCode, Loader2 } from 'lucide-react';

interface EditorSkeletonProps {
  filePath?: string | null;
}

export const EditorSkeleton: React.FC<EditorSkeletonProps> = ({ filePath }) => {
  const { palette } = useTheme();

  // Staggered mock token widths for realistic code appearance
  const codeLines = [
    { indent: 0, width: 'w-48' },
    { indent: 0, width: 'w-32' },
    { indent: 4, width: 'w-72' },
    { indent: 4, width: 'w-56' },
    { indent: 8, width: 'w-80' },
    { indent: 8, width: 'w-64' },
    { indent: 12, width: 'w-40' },
    { indent: 8, width: 'w-24' },
    { indent: 4, width: 'w-16' },
    { indent: 0, width: 'w-36' },
    { indent: 4, width: 'w-60' },
    { indent: 8, width: 'w-96' },
    { indent: 8, width: 'w-52' },
    { indent: 12, width: 'w-48' },
    { indent: 8, width: 'w-36' },
    { indent: 4, width: 'w-20' },
    { indent: 0, width: 'w-12' },
  ];

  return (
    <div
      className="h-full w-full flex flex-col font-mono select-none overflow-hidden relative animate-in fade-in duration-150"
      style={{
        backgroundColor: palette.background,
        color: palette.text,
      }}
    >
      {/* File Tab Bar Header Skeleton */}
      <div
        className="h-10 px-4 border-b flex items-center justify-between"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surface}80`,
        }}
      >
        <div className="flex items-center space-x-2.5">
          <FileCode className="w-3.5 h-3.5 text-gray-500 animate-pulse" />
          {filePath ? (
            <span className="text-xs text-gray-300 font-medium truncate max-w-[200px]">
              {filePath}
            </span>
          ) : (
            <div className="h-3.5 w-28 rounded bg-white/10 animate-pulse" />
          )}
          <div className="flex items-center space-x-1 pl-2 text-[10px] opacity-60">
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: palette.accent }} />
            <span>Rehydrating AST...</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-4 w-16 rounded-full bg-white/5 animate-pulse" />
          <div className="h-4 w-12 rounded-full bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Editor Body with Line Numbers Gutter and Shimmering Code Lines */}
      <div className="flex-1 flex overflow-hidden p-4 pt-3">
        {/* Line Numbers Column */}
        <div className="flex flex-col space-y-2 pr-4 select-none border-r border-white/5 text-[11px] text-gray-600 font-mono text-right w-10 shrink-0">
          {codeLines.map((_, i) => (
            <span key={i} className="leading-5">
              {i + 1}
            </span>
          ))}
        </div>

        {/* Shimmering Code Lines */}
        <div className="flex-1 flex flex-col space-y-2 pl-4">
          {codeLines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-center h-5"
              style={{ paddingLeft: `${line.indent * 6}px` }}
            >
              <div
                className={`h-3 rounded-md bg-white/10 animate-pulse ${line.width}`}
                style={{
                  animationDelay: `${idx * 40}ms`,
                  backgroundColor:
                    idx % 3 === 0
                      ? `${palette.accent}25`
                      : 'rgba(255, 255, 255, 0.08)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Subtle Breadcrumb Footer */}
      <div
        className="h-6 px-4 border-t flex items-center justify-between text-[10px] text-gray-500"
        style={{
          borderColor: palette.surfaceBorder,
          backgroundColor: `${palette.surface}40`,
        }}
      >
        <span>UTF-8 • Ready</span>
        <span>Spatial VSync Active (60fps)</span>
      </div>
    </div>
  );
};

