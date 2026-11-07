'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../../context/ThemeContext';
import { EditorSkeleton } from '../../components/editor/EditorSkeleton';

const EditorShell = dynamic(
  () => import('../../components/editor/EditorShell').then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

export default function EditorPage() {
  return (
    <ThemeProvider>
      <EditorShell />
    </ThemeProvider>
  );
}

