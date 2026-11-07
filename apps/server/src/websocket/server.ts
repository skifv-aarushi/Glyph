import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import * as decoding from 'lib0/decoding';
import { PermissionRole, AuthStatusWsMessage } from '@glyph/shared';
import { config } from '../config/index';
import { verifyAuthToken } from '../auth/jwt';
import { roomManager, parseRoomId, verifyUserRepoPermission } from './roomManager';
import { pubsubManager } from './pubsub';
import { isPushLockActive } from '../services/redisLock';

/**
 * Parses raw Cookie header string into key-value map
 */
function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    const trimmedName = name?.trim();
    if (!trimmedName) return;
    cookies[trimmedName] = decodeURIComponent(rest.join('=').trim());
  });

  return cookies;
}

/**
 * Attaches the collaborative Yjs WebSocket Server to the HTTP Server
 */
export function initWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // 1. Intercept HTTP Upgrade request
  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

    // Verify target path begins with /room/
    if (!url.pathname.startsWith('/room/')) {
      return; // Allow standard routes or other handlers
    }

    const rawRoomId = url.pathname.slice('/room/'.length);
    let decodedRoomId = rawRoomId;
    try {
      decodedRoomId = decodeURIComponent(rawRoomId);
    } catch {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const parsedMeta = parseRoomId(decodedRoomId);

    if (!parsedMeta) {
      console.warn(`[WebSocket Upgrade] Invalid room format received: ${rawRoomId}`);
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify JWT token from HTTP-only cookie
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[config.cookieName];
    let githubToken: string | undefined = undefined;
    let username: string | undefined = undefined;

    if (token) {
      const payload = verifyAuthToken(token);
      if (payload?.githubToken) {
        githubToken = payload.githubToken;
        username = payload.user?.login;
      }
    }

    // Extract optional query params (password, public visibility, custom code)
    const queryPwd = url.searchParams.get('pwd') || url.searchParams.get('password') || undefined;
    const queryPublic = url.searchParams.get('public');
    const isPublic = queryPublic !== null ? queryPublic !== 'false' : undefined;
    const queryCode = url.searchParams.get('code') || undefined;

    // Attach verified metadata to request instance for connection handler
    (req as any)._roomId = decodedRoomId;
    (req as any)._roomMeta = parsedMeta;
    (req as any)._githubToken = githubToken;
    (req as any)._username = username;
    (req as any)._queryPwd = queryPwd;
    (req as any)._isPublic = isPublic;
    (req as any)._roomCode = queryCode;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  // 2. Handle established WebSocket connections
  wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
    const roomId: string = (req as any)._roomId;
    const meta = (req as any)._roomMeta;
    const githubToken: string | undefined = (req as any)._githubToken;
    const username: string | undefined = (req as any)._username;
    const queryPwd: string | undefined = (req as any)._queryPwd;
    const isPublicParam: boolean | undefined = (req as any)._isPublic;
    const queryCode: string | undefined = (req as any)._roomCode;

    console.log(`[WebSocket] Client connected for room: ${roomId} (user: ${username || 'anonymous'})`);

    try {
      // 1. Check existing session password protection before room joining
      const existingSession = roomManager.getSession(roomId);
      if (existingSession && existingSession.password && existingSession.users.size > 0) {
        // If connecting client is not the original host and password does not match
        if (!queryPwd || queryPwd !== existingSession.password) {
          console.warn(`🔒 [Auth] Access denied for room "${roomId}": Invalid or missing password.`);
          ws.send(
            JSON.stringify({
              type: 'auth_error',
              code: 'PASSWORD_REQUIRED',
              message: 'Session is password protected. Valid passcode required.',
            })
          );
          setTimeout(() => ws.close(4403, 'Password required'), 100);
          return;
        }
      }

      // 2. Parallel Initialization:
      // Run RBAC Verification and Room Fetching/Rehydration simultaneously to cut connection latency.
      const [permission, { doc, isRestoredFromDraft }] = await Promise.all([
        verifyUserRepoPermission(meta.owner, meta.repo, username, githubToken),
        roomManager.getOrCreateRoom(roomId, {
          owner: meta.owner,
          repo: meta.repo,
          filePath: meta.filePath,
          token: githubToken,
          isPublic: isPublicParam,
          password: queryPwd,
          code: queryCode,
        }),
      ]);

      console.log(`[RBAC] Assigned permission "${permission}" for user "${username || 'anonymous'}" in room "${roomId}"`);

      // 3. Register socket into RoomManager and determine Granular RBAC Role (Host, Co-Host, Guest, Spectator)
      const socketId = Math.random().toString(36).substring(2, 11);
      const effectiveUserId = username || `guest-${socketId}`;
      const { role, hostId, mode, code, isPublic, hasPassword } = roomManager.addUser(
        roomId,
        socketId,
        ws,
        effectiveUserId,
        username || 'Guest',
        permission
      );

      // 4. Permission Handshake: Send custom JSON message immediately after connection
      const handshakeMsg: AuthStatusWsMessage = {
        type: 'auth_status',
        permission,
        role,
        mode,
        userId: effectiveUserId,
        code,
        isPublic,
        hasPassword,
      };

      const sendHandshake = async () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(handshakeMsg));
          // If Mutex push lock is actively held, notify the newly connected client immediately
          const isLocked = await isPushLockActive(roomId);
          if (isLocked && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'lock_status', active: true }));
          }
        }
      };

      if (ws.readyState === WebSocket.OPEN) {
        sendHandshake();
      } else {
        ws.once('open', sendHandshake);
      }

      // 3. WebSocket Message Filtering:
      // If user is Read-Only, intercept incoming binary update messages and drop mutations.
      // They continue receiving outgoing updates from the server so they can watch live sessions.
      // - messageType 0 (messageSync):
      //     - syncType 0 (messageYjsSyncStep1 / StateVector) -> ALLOWED (enables spectator to query missing state)
      //     - syncType 1 (messageYjsSyncStep2 / Structs update) -> DROPPED
      //     - syncType 2 (messageYjsUpdate / Incremental mutation) -> DROPPED
      // - messageType 1 (messageAwareness) -> ALLOWED (cursor awareness)
      if (permission === 'read') {
        const originalEmit = ws.emit.bind(ws);
        ws.emit = function (event: string | symbol, ...args: any[]): boolean {
          if (event === 'message') {
            const [data] = args;
            if (data) {
              try {
                const uint8 = new Uint8Array(data);
                if (uint8.length > 0) {
                  const decoder = decoding.createDecoder(uint8);
                  const messageType = decoding.readVarUint(decoder);
                  if (messageType === 0) {
                    const syncMessageType = decoding.readVarUint(decoder);
                    if (syncMessageType === 1 || syncMessageType === 2) {
                      console.log(
                        `[RBAC] Transport Filter: Dropped unauthorized mutation (syncType: ${syncMessageType}) from read-only spectator in room: ${roomId}`
                      );
                      return true; // Drop silently
                    }
                  }
                }
              } catch (parseErr) {
                // If decoding fails, ignore
              }
            }
          }
          return originalEmit(event, ...args);
        };
      }

      // 4. Ephemeral Lifecycle: Increment connection count & cancel teardown timer if active
      roomManager.incrementConnection(roomId);

      // If workspace was rehydrated from Supabase draft, inform client immediately
      if (isRestoredFromDraft) {
        const draftMsg = {
          type: 'draft_restored',
          roomId,
          message: 'Restored unsaved workspace draft.',
        };
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(draftMsg));
        } else {
          ws.once('open', () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(draftMsg));
            }
          });
        }
      }

      // 6. Redis Pub/Sub CRDT Routing:
      // Subscribe server to room:{roomId} and bind local Y.Doc mutations to Redis
      pubsubManager.bindDocPubSub(roomId, doc);
      await pubsubManager.subscribeRoom(roomId);

      // 7. Bind connection to Yjs room
      setupWSConnection(ws, req, { docName: roomId });

      // Handle custom client command events (e.g. Host switching session modes, role modification, settings)
      ws.on('message', (raw: any) => {
        try {
          const text = raw.toString();
          if (text.startsWith('{')) {
            const data = JSON.parse(text);
            if (data.type === 'set_mode' && data.mode) {
              const currentSession = roomManager.getSession(roomId);
              const currentRole = currentSession?.users.get(socketId)?.role || role;
              roomManager.setSessionMode(roomId, data.mode, currentRole);
            }
            if (data.type === 'set_user_role' && data.targetUserId && data.role) {
              roomManager.setUserRole(roomId, data.targetUserId, data.role, effectiveUserId);
            }
            if (data.type === 'update_room_settings') {
              roomManager.updateRoomSettings(roomId, data, effectiveUserId);
            }
            if (data.type === 'get_participants') {
              roomManager.broadcastParticipantList(roomId);
            }
            if (data.type === 'conclude_session') {
              roomManager.concludeSession(roomId, effectiveUserId, data.reason);
            }
          }
        } catch (e) {}
      });

      // 8. Ephemeral Memory Management & Host Migration:
      // Remove socket from room user roster (triggers Host Migration if Host leaves).
      // Decrement connection count on close. If count hits 0, starts 5-minute GC timer.
      let hasClosed = false;
      ws.on('close', () => {
        if (hasClosed) return;
        hasClosed = true;
        console.log(`[WebSocket] Client disconnected from room: ${roomId} (socket: ${socketId})`);
        roomManager.removeUser(roomId, socketId);
        roomManager.decrementConnection(roomId);
      });
    } catch (err) {
      console.error(`[WebSocket] Failed to bind room ${roomId}:`, err);
      ws.close(1011, 'Failed to initialize room document');
    }
  });

  console.log(`📡 [WebSocket Server] Initialized. Listening for /room/[roomId] connections.`);
  return wss;
}

