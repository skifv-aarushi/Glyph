'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import {
  PermissionRole,
  RoomRole,
  SessionMode,
  ConnectedParticipant,
} from '@glyph/shared';
import { ConnectionStatus } from '../context/YjsContext';

const WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL || 'ws://localhost:8080';

export interface UseYjsSyncResult {
  doc: Y.Doc | null;
  provider: WebsocketProvider | null;
  connectionStatus: ConnectionStatus;
  isSynced: boolean;
  permission: PermissionRole;
  role: RoomRole;
  sessionMode: SessionMode;
  canWriteMonaco: boolean;
  canWriteTldraw: boolean;
  setSessionMode: (mode: SessionMode) => void;
  isOnline: boolean;
  isPushLocked: boolean;
  isDraftRestored: boolean;
  draftRestoredMessage: string | null;
  yText: Y.Text | null;
  textValue: string;
  participants: ConnectedParticipant[];
  roomCode: string;
  isPublic: boolean;
  hasPassword: boolean;
  authError: string | null;
  isSessionConcluded: boolean;
  sessionConcludedInfo: { by: string; reason?: string } | null;
  concludeSession: (reason?: string) => void;
  setUserRole: (targetUserId: string, newRole: RoomRole) => void;
  updateRoomSettings: (settings: { isPublic?: boolean; password?: string; mode?: SessionMode }) => void;
  refreshParticipants: () => void;
}

/**
 * Creates an RBAC-, Mutex-, & Draft-aware WebSocket wrapper class that intercepts
 * custom text/JSON handshake packets before y-websocket's binary decoder attempts to parse them.
 */
function createRBACWebSocketClass(
  onAuthStatus: (perm: PermissionRole, role?: RoomRole, mode?: SessionMode, code?: string, isPublic?: boolean, hasPassword?: boolean) => void,
  onLockStatus: (active: boolean) => void,
  onDraftRestored: (msg: string) => void,
  onRoleUpdate: (role: RoomRole) => void,
  onSessionMode: (mode: SessionMode) => void,
  onParticipants: (participants: ConnectedParticipant[]) => void,
  onRoomSettings: (isPublic: boolean, code: string, hasPassword: boolean, mode?: SessionMode) => void,
  onAuthError: (err: string) => void,
  onSessionConcluded?: (by: string, reason?: string) => void
) {
  if (typeof window === 'undefined' || !window.WebSocket) {
    return undefined;
  }
  const NativeWebSocket = window.WebSocket;

  return class RBACWebSocket extends NativeWebSocket {
    private _messageListener: ((this: WebSocket, ev: MessageEvent) => any) | null = null;

    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
    }

    set onmessage(handler: ((this: WebSocket, ev: MessageEvent) => any) | null) {
      if (!handler) {
        this._messageListener = null;
        super.onmessage = null;
        return;
      }

      this._messageListener = handler;
      super.onmessage = (event: MessageEvent) => {
        // Intercept textual JSON messages
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data) as any;
            if (data && data.type === 'auth_status') {
              console.log(`⚡ [RBAC Handshake] permission: "${data.permission}", role: "${data.role}", mode: "${data.mode}", code: "${data.code}"`);
              onAuthStatus(data.permission, data.role, data.mode, data.code, data.isPublic, data.hasPassword);
              return;
            }
            if (data && data.type === 'auth_error') {
              console.warn(`🔒 [Auth Error] ${data.message}`);
              onAuthError(data.message || 'Authentication failed');
              return;
            }
            if (data && data.type === 'session_concluded') {
              console.log(`🛑 [Session Concluded] Concluded by: ${data.concludedBy}`);
              onSessionConcluded?.(data.concludedBy || 'Host', data.reason);
              return;
            }
            if (data && data.type === 'participant_list' && Array.isArray(data.participants)) {
              onParticipants(data.participants);
              return;
            }
            if (data && data.type === 'room_settings_update') {
              onRoomSettings(data.isPublic, data.code, data.hasPassword, data.mode);
              return;
            }
            if (data && data.type === 'role_update' && data.role) {
              console.log(`👑 [Role Update] New role: "${data.role}"`);
              onRoleUpdate(data.role);
              return;
            }
            if (data && data.type === 'session_mode' && data.mode) {
              console.log(`🔀 [Session Mode] Mode: "${data.mode}"`);
              onSessionMode(data.mode);
              return;
            }
            if (data && data.type === 'lock_status' && typeof data.active === 'boolean') {
              onLockStatus(data.active);
              return;
            }
            if (data && data.type === 'draft_restored') {
              onDraftRestored(data.message || 'Restored unsaved workspace draft.');
              return;
            }
          } catch {
            // Not a valid JSON string
          }
          return;
        }

        // Forward binary arraybuffer packets directly to y-websocket
        handler.call(this, event);
      };
    }

    get onmessage() {
      return this._messageListener;
    }
  };
}

export function useYjsSync(activeFileId: string | null, roomPassword?: string): UseYjsSyncResult {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [permission, setPermission] = useState<PermissionRole>('read');
  const [role, setRole] = useState<RoomRole>('guest');
  const [sessionMode, setSessionModeState] = useState<SessionMode>('open-sandbox');
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isPushLocked, setIsPushLocked] = useState<boolean>(false);
  const [isDraftRestored, setIsDraftRestored] = useState<boolean>(false);
  const [draftRestoredMessage, setDraftRestoredMessage] = useState<string | null>(null);
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [textValue, setTextValue] = useState<string>('');

  // Extended session states
  const [participants, setParticipants] = useState<ConnectedParticipant[]>([]);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSessionConcluded, setIsSessionConcluded] = useState<boolean>(false);
  const [sessionConcludedInfo, setSessionConcludedInfo] = useState<{ by: string; reason?: string } | null>(null);

  const activeDocRef = useRef<Y.Doc | null>(null);
  const activeProviderRef = useRef<WebsocketProvider | null>(null);

  // Compute Granular Permissions based on SessionMode and Role
  let canWriteMonaco = false;
  let canWriteTldraw = false;

  if (permission === 'write' && role !== 'spectator') {
    switch (sessionMode) {
      case 'open-sandbox':
        canWriteMonaco = true;
        canWriteTldraw = true;
        break;
      case 'lecture':
        canWriteMonaco = role === 'host' || role === 'co-host';
        canWriteTldraw = role === 'host' || role === 'co-host';
        break;
      case 'whiteboard':
        canWriteMonaco = role === 'host' || role === 'co-host';
        canWriteTldraw = true;
        break;
      case 'code-review':
        canWriteMonaco = false;
        canWriteTldraw = true;
        break;
      default:
        canWriteMonaco = true;
        canWriteTldraw = true;
    }
  }

  const setSessionMode = useCallback((mode: SessionMode) => {
    setSessionModeState(mode);
    if (activeProviderRef.current?.ws && activeProviderRef.current.ws.readyState === WebSocket.OPEN) {
      activeProviderRef.current.ws.send(JSON.stringify({ type: 'set_mode', mode }));
    }
  }, []);

  const setUserRole = useCallback((targetUserId: string, newRole: RoomRole) => {
    if (activeProviderRef.current?.ws && activeProviderRef.current.ws.readyState === WebSocket.OPEN) {
      activeProviderRef.current.ws.send(
        JSON.stringify({
          type: 'set_user_role',
          targetUserId,
          role: newRole,
        })
      );
    }
  }, []);

  const updateRoomSettings = useCallback(
    (settings: { isPublic?: boolean; password?: string; mode?: SessionMode }) => {
      if (activeProviderRef.current?.ws && activeProviderRef.current.ws.readyState === WebSocket.OPEN) {
        activeProviderRef.current.ws.send(
          JSON.stringify({
            type: 'update_room_settings',
            ...settings,
          })
        );
      }
    },
    []
  );

  const refreshParticipants = useCallback(() => {
    if (activeProviderRef.current?.ws && activeProviderRef.current.ws.readyState === WebSocket.OPEN) {
      activeProviderRef.current.ws.send(JSON.stringify({ type: 'get_participants' }));
    }
  }, []);

  const concludeSession = useCallback(
    async (reason?: string) => {
      if (activeProviderRef.current?.ws && activeProviderRef.current.ws.readyState === WebSocket.OPEN) {
        activeProviderRef.current.ws.send(
          JSON.stringify({
            type: 'conclude_session',
            reason: reason || 'Host concluded the session',
          })
        );
      }
      if (activeFileId) {
        try {
          const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';
          await fetch(`${serverUrl}/api/rooms/conclude`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: activeFileId, reason }),
          });
        } catch {
          // Graceful fallback
        }
      }
    },
    [activeFileId]
  );

  // Monitor browser network online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (activeProviderRef.current && !activeProviderRef.current.wsconnected) {
        activeProviderRef.current.connect();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!activeFileId) {
      if (activeProviderRef.current) {
        activeProviderRef.current.destroy();
        activeProviderRef.current = null;
      }
      if (activeDocRef.current) {
        activeDocRef.current.destroy();
        activeDocRef.current = null;
      }
      setDoc(null);
      setProvider(null);
      setYText(null);
      setTextValue('');
      setConnectionStatus('disconnected');
      setIsSynced(false);
      setPermission('read');
      setIsPushLocked(false);
      setIsDraftRestored(false);
      setDraftRestoredMessage(null);
      setParticipants([]);
      setRoomCode('');
      setAuthError(null);
      setIsSessionConcluded(false);
      setSessionConcludedInfo(null);
      return;
    }

    console.log(`[useYjsSync] Connecting WebSocket room: ${activeFileId}`);
    setAuthError(null);
    setIsDraftRestored(false);
    setDraftRestoredMessage(null);
    setIsSessionConcluded(false);
    setSessionConcludedInfo(null);

    const localDoc = new Y.Doc();
    activeDocRef.current = localDoc;
    setDoc(localDoc);

    const monacoText = localDoc.getText('monaco');
    setYText(monacoText);

    const handleTextObserver = () => {
      setTextValue(monacoText.toString());
    };
    monacoText.observe(handleTextObserver);

    // Resolve effective password from arg or window searchParams
    const effectivePassword =
      roomPassword ||
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('pwd') || undefined
        : undefined);

    const baseWsUrl = `${WS_SERVER_URL.replace(/\/+$/, '')}/room`;
    // Pass password as query param on room identifier so upgrade interceptor receives it
    const roomParam = effectivePassword
      ? `${activeFileId}?pwd=${encodeURIComponent(effectivePassword)}`
      : activeFileId;
    const encodedRoomName = encodeURIComponent(roomParam);

    const RBACWebSocketClass = createRBACWebSocketClass(
      (perm, newRole, newMode, code, pub, hasPwd) => {
        setPermission(perm);
        if (newRole) setRole(newRole);
        if (newMode) setSessionModeState(newMode);
        if (code) setRoomCode(code);
        if (pub !== undefined) setIsPublic(pub);
        if (hasPwd !== undefined) setHasPassword(hasPwd);
      },
      (active) => setIsPushLocked(active),
      (msg) => {
        setIsDraftRestored(true);
        setDraftRestoredMessage(msg);
      },
      (newRole) => setRole(newRole),
      (newMode) => setSessionModeState(newMode),
      (plist) => setParticipants(plist),
      (pub, code, hasPwd, mode) => {
        if (pub !== undefined) setIsPublic(pub);
        if (code) setRoomCode(code);
        if (hasPwd !== undefined) setHasPassword(hasPwd);
        if (mode) setSessionModeState(mode);
      },
      (err) => setAuthError(err),
      (by, reason) => {
        setIsSessionConcluded(true);
        setSessionConcludedInfo({ by, reason });
        try {
          activeProviderRef.current?.disconnect();
        } catch {}
      }
    );

    const wsProvider = new WebsocketProvider(baseWsUrl, encodedRoomName, localDoc, {
      connect: true,
      maxBackoffTime: 5000,
      WebSocketPolyfill: (RBACWebSocketClass as unknown as typeof WebSocket) || WebSocket,
    });
    activeProviderRef.current = wsProvider;
    setProvider(wsProvider);

    wsProvider.on('status', (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      setConnectionStatus(event.status);

      if (event.status === 'connected') {
        const stateVector = Y.encodeStateVector(localDoc);
        console.log(
          `📡 [StateVector Sync] Client transmitted StateVector (${stateVector.byteLength} bytes) to server.`
        );

        if (wsProvider.ws) {
          const currentWs = wsProvider.ws;
          const originalHandler = currentWs.onmessage;
          currentWs.onmessage = (ev: MessageEvent) => {
            if (typeof ev.data === 'string') {
              try {
                const parsed = JSON.parse(ev.data);
                if (parsed?.type === 'auth_status' && (parsed.permission === 'write' || parsed.permission === 'read')) {
                  setPermission(parsed.permission);
                  if (parsed.role) setRole(parsed.role);
                  if (parsed.mode) setSessionModeState(parsed.mode);
                  if (parsed.code) setRoomCode(parsed.code);
                  if (parsed.isPublic !== undefined) setIsPublic(parsed.isPublic);
                  if (parsed.hasPassword !== undefined) setHasPassword(parsed.hasPassword);
                  return;
                }
                if (parsed?.type === 'auth_error') {
                  setAuthError(parsed.message || 'Authentication error');
                  return;
                }
                if (parsed?.type === 'session_concluded') {
                  setIsSessionConcluded(true);
                  setSessionConcludedInfo({
                    by: parsed.concludedBy || 'Host',
                    reason: parsed.reason,
                  });
                  try {
                    wsProvider.disconnect();
                  } catch {}
                  return;
                }
                if (parsed?.type === 'participant_list' && Array.isArray(parsed.participants)) {
                  setParticipants(parsed.participants);
                  return;
                }
                if (parsed?.type === 'room_settings_update') {
                  if (parsed.isPublic !== undefined) setIsPublic(parsed.isPublic);
                  if (parsed.code) setRoomCode(parsed.code);
                  if (parsed.hasPassword !== undefined) setHasPassword(parsed.hasPassword);
                  if (parsed.mode) setSessionModeState(parsed.mode);
                  return;
                }
                if (parsed?.type === 'role_update' && parsed.role) {
                  setRole(parsed.role);
                  return;
                }
                if (parsed?.type === 'session_mode' && parsed.mode) {
                  setSessionModeState(parsed.mode);
                  return;
                }
                if (parsed?.type === 'lock_status' && typeof parsed.active === 'boolean') {
                  setIsPushLocked(parsed.active);
                  return;
                }
                if (parsed?.type === 'draft_restored') {
                  setIsDraftRestored(true);
                  setDraftRestoredMessage(parsed.message || 'Restored unsaved workspace draft.');
                  return;
                }
              } catch {
                // not JSON
              }
              return;
            }
            originalHandler?.call(currentWs, ev);
          };
        }
      }
    });

    wsProvider.on('synced', (syncedState: boolean) => {
      setIsSynced(syncedState);
      if (syncedState) {
        setTextValue(monacoText.toString());
      }
    });

    return () => {
      monacoText.unobserve(handleTextObserver);
      wsProvider.disconnect();
      wsProvider.destroy();
      localDoc.destroy();
      activeProviderRef.current = null;
      activeDocRef.current = null;
    };
  }, [activeFileId, roomPassword]);

  return {
    doc,
    provider,
    connectionStatus,
    isSynced,
    permission,
    role,
    sessionMode,
    canWriteMonaco,
    canWriteTldraw,
    setSessionMode,
    isOnline,
    isPushLocked,
    isDraftRestored,
    draftRestoredMessage,
    yText,
    textValue,
    participants,
    roomCode,
    isPublic,
    hasPassword,
    authError,
    isSessionConcluded,
    sessionConcludedInfo,
    concludeSession,
    setUserRole,
    updateRoomSettings,
    refreshParticipants,
  };
}
