'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { PermissionRole } from '@glyph/shared';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface YjsContextValue {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  connectionStatus: ConnectionStatus;
  isSynced: boolean;
  permission: PermissionRole;
  isOnline: boolean;
  isPushLocked: boolean;
  yText: Y.Text | null;
  activeFileId: string | null;
  setActiveFileId: (fileId: string | null) => void;
}

const YjsContext = createContext<YjsContextValue>({
  doc: null,
  provider: null,
  connectionStatus: 'disconnected',
  isSynced: false,
  permission: 'read',
  isOnline: true,
  isPushLocked: false,
  yText: null,
  activeFileId: null,
  setActiveFileId: () => {},
});

export const useYjsContext = () => useContext(YjsContext);

export interface YjsContextProviderProps {
  value: YjsContextValue;
  children: ReactNode;
}

export const YjsContextProvider: React.FC<YjsContextProviderProps> = ({ value, children }) => {
  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>;
};

