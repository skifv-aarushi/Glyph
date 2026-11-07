// apps/web/src/components/explorer/ExplorerSkeleton.tsx
'use client';

import React from 'react';
import { Folder, FileCode, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ExplorerSkeleton: React.FC = () => {
  const { palette } = useTheme();

  const mockTree = [
    { type: 'dir', depth: 0, width: 'w-24', open: true },
    { type: 'dir', depth: 1, width: 'w-28', open: false },
    { type: 'file', depth: 2, width: 'w-32' },
    { type: 'file', depth: 2, width: 'w-20' },
    { type: 'file', depth: 2, width: 'w-36' },
    { type: 'dir', depth: 1, width: 'w-20', open: true },
    { type: 'file', depth: 2, width: 'w-28' },
    { type: 'file', depth: 2, width: 'w-16' },
    { type: 'file', depth: 1, width: 'w-24' },
    { type: 'file', depth: 0, width: 'w-28' },
    { type: 'file', depth: 0, width: 'w-20' },
  ];

  return (
    <div className="flex flex-col space-y-1 p-2 select-none font-mono text-xs">
      {mockTree.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center space-x-1.5 py-1 px-1 rounded opacity-75"
          style={{ paddingLeft: `${item.depth * 14 + 6}px` }}
        >
          {item.type === 'dir' ? (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <Folder className="w-3.5 h-3.5 text-gray-500" />
            </>
          ) : (
            <div className="flex items-center space-x-1 pl-4">
              <FileCode className="w-3.5 h-3.5 text-gray-600" />
            </div>
          )}

          <div
            className={`h-3 rounded bg-white/10 animate-pulse ${item.width}`}
            style={{
              animationDelay: `${idx * 45}ms`,
              backgroundColor:
                idx % 4 === 0
                  ? `${palette.accent}25`
                  : 'rgba(255, 255, 255, 0.08)',
            }}
          />
        </div>
      ))}
    </div>
  );
};

