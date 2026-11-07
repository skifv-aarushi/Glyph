'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../../../context/ThemeContext';
import { EditorSkeleton } from '../../../components/editor/EditorSkeleton';

const EditorShell = dynamic(
  () => import('../../../components/editor/EditorShell').then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
);

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

export default function RoomPage({ params }: RoomPageProps) {
  const decodedRoomId = decodeURIComponent(params.roomId);

  return (
    <ThemeProvider>
      <EditorShell initialRoomId={decodedRoomId} />
    </ThemeProvider>
  );
}

