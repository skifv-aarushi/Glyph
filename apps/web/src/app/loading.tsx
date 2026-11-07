'use client';

import React from 'react';
import { WorkspaceLoadingScreen } from '../components/UI/WorkspaceLoadingScreen';

export default function Loading() {
  return (
    <WorkspaceLoadingScreen
      title="Loading Workspace"
      subtitle="Synchronizing session state and CRDT layers..."
      stageIndex={1}
    />
  );
}

