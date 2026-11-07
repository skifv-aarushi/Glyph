'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function NotFound() {
  const { palette } = useTheme();

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 font-mono text-xs select-none"
      style={{
        backgroundColor: palette.background,
        color: palette.text,
      }}
    >
      <div
        className="max-w-md w-full p-8 rounded-2xl border shadow-2xl space-y-5 text-center"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.surfaceBorder,
        }}
      >
        <span
          className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border"
          style={{
            borderColor: palette.surfaceBorder,
            backgroundColor: `${palette.surfaceBorder}30`,
            color: palette.accent,
          }}
        >
          404 // NOT FOUND
        </span>

        <h1 className="text-xl font-bold tracking-tight">Spatial Route Not Found</h1>
        <p className="text-xs opacity-70 leading-relaxed">
          The collaborative session, buffer route, or resource you requested does not exist or has expired.
        </p>

        <div className="pt-2 flex items-center justify-center space-x-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-xl font-semibold text-xs inline-flex items-center space-x-2 transition-all hover:opacity-90 shadow-sm"
            style={{
              backgroundColor: palette.accent,
              color: palette.isDark ? '#09090B' : '#FFFFFF',
            }}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Lobby</span>
          </Link>

          <Link
            href="/editor"
            className="px-4 py-2 rounded-xl border font-semibold text-xs inline-flex items-center space-x-2 transition-colors"
            style={{
              borderColor: palette.surfaceBorder,
              color: palette.text,
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Studio</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

