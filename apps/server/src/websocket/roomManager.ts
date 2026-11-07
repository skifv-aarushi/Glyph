import * as Y from 'yjs';
import { getYDoc, docs, WSSharedDoc } from 'y-websocket/bin/utils';
import { config } from '../config/index';
import {
  PermissionRole,
  RoomRole,
  SessionMode,
  RoomOrigin,
  ConnectedParticipant,
} from '@glyph/shared';
import { uploadEphemeralBlob, downloadEphemeralBlob } from '../services/supabase';
import { pubsubManager } from './pubsub';

export interface RoomInitOptions {
  owner: string;
  repo: string;
  filePath: string;
  token?: string;
  origin?: RoomOrigin;
  isPublic?: boolean;
  code?: string;
  password?: string;
}

export interface ConnectedUser {
  socketId: string;
  ws: any;
  userId: string;
  username: string;
  role: RoomRole;
  connectionTimestamp: number;
}

export interface RoomSession {
  doc: WSSharedDoc;
  connectionCount: number;
  gcTimer: NodeJS.Timeout | null;
  owner: string;
  repo: string;
  filePath: string;
  isRestoredFromDraft?: boolean;
  users: Map<string, ConnectedUser>;
  hostId: string;
  isPublic: boolean;
  code: string;
  password?: string;
}

export const roomCodeMap = new Map<string, string>();

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PG-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface CachedPermission {
  permission: PermissionRole;
  expiresAt: number;
}
const permissionCache = new Map<string, CachedPermission>();

interface CachedContent {
  content: string;
  cachedAt: number;
}
export const fileContentCache = new Map<string, CachedContent>();

export function invalidateFileContentCache(owner: string, repo: string, filePath: string): void {
  const cleanPath = filePath.replace(/^\/+/, '');
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}/${cleanPath.toLowerCase()}`;
  fileContentCache.delete(key);
}

/**
 * GitHub RBAC Verification:
 * Validates whether the user has 'write' (collaborator/owner) or 'read' (spectator) access.
 *
 * Rules:
 * - Anonymous or unauthenticated users -> 'read' (Spectator)
 * - Repository owner -> 'write' (Collaborator)
 * - Collaborators API (GET /repos/:owner/:repo/collaborators/:username):
 *     - Status 204 or 200 -> 'write' (Collaborator)
 *     - Status 404 -> 'read' (Spectator)
 *     - Any other status -> 'read' (Secure default)
 *
 * Caches permission per (owner, repo, user) for 10 minutes to make subsequent room connections instant.
 */
export async function verifyUserRepoPermission(
  owner: string,
  repo: string,
  username?: string,
  token?: string
): Promise<PermissionRole> {
  // 1. In development mode or for demo repositories, grant 'write' so drawing & collaboration can be fully tested
  if (
    config.nodeEnv === 'development' ||
    owner.toLowerCase() === 'demo' ||
    (owner.toLowerCase() === 'glyph' && repo.toLowerCase() === 'demo')
  ) {
    console.log(`[RBAC] Development / Demo workspace for ${owner}/${repo} -> 'write' (Full drawing access)`);
    return 'write';
  }

  if (!username || !token) {
    console.log(`[RBAC] Anonymous or unauthenticated client for ${owner}/${repo} -> Spectator ('read')`);
    return 'read';
  }

  // Repository owner always has write access
  if (username.toLowerCase() === owner.toLowerCase()) {
    console.log(`[RBAC] User "${username}" is repository owner of ${owner}/${repo} -> 'write'`);
    return 'write';
  }

  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}/${username.toLowerCase()}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.permission;
  }

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`;
    console.log(`[RBAC] Checking collaborator status at GitHub: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    let perm: PermissionRole = 'read';
    if (response.status === 204 || response.status === 200) {
      console.log(
        `[RBAC] GitHub verified: "${username}" is collaborator on ${owner}/${repo} (status ${response.status}) -> 'write'`
      );
      perm = 'write';
    } else if (response.status === 404) {
      console.log(
        `[RBAC] GitHub verified: "${username}" is NOT collaborator on ${owner}/${repo} (status 404) -> 'read'`
      );
      perm = 'read';
    } else {
      console.warn(`[RBAC] GitHub API returned unexpected status ${response.status} for ${username} -> fallback to 'read'`);
      perm = 'read';
    }

    permissionCache.set(cacheKey, {
      permission: perm,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
    });

    return perm;
  } catch (err) {
    console.error(`[RBAC] Collaborator verification failed for "${username}" on ${owner}/${repo}:`, err);
    return 'read';
  }
}

/**
 * In-memory map of active collaborative sessions with metadata and lifecycle tracking
 */
export const roomSessions = new Map<string, RoomSession>();

/**
 * Backward compatibility alias for activeRooms
 */
export const activeRooms = new Map<string, WSSharedDoc>();

/**
 * Normalizes and extracts room components (owner, repo, filePath)
 */
export function parseRoomId(rawRoomId: string): { owner: string; repo: string; filePath: string } | null {
  let decoded = rawRoomId;
  try {
    decoded = decodeURIComponent(rawRoomId);
  } catch {
    // If malformed URI, fallback to raw input
  }
  decoded = decoded.replace(/^\/+/, '').replace(/^room\//, '');

  // Format 0: Check short room code lookup (e.g. "PG-8492")
  const cleanUpper = decoded.trim().toUpperCase();
  if (roomCodeMap.has(cleanUpper)) {
    return parseRoomId(roomCodeMap.get(cleanUpper)!);
  }
  for (const session of roomSessions.values()) {
    if (session.code && session.code.toUpperCase() === cleanUpper) {
      return { owner: session.owner, repo: session.repo, filePath: session.filePath };
    }
  }

  // Format 1: owner:repo:filepath (recommended delimiter)
  if (decoded.includes(':')) {
    const [owner, repo, ...rest] = decoded.split(':');
    if (owner && repo && rest.length > 0) {
      return { owner, repo, filePath: rest.join(':') };
    }
  }

  // Format 2: owner--repo--filepath
  if (decoded.includes('--')) {
    const [owner, repo, ...rest] = decoded.split('--');
    if (owner && repo && rest.length > 0) {
      return { owner, repo, filePath: rest.join('--') };
    }
  }

  // Format 3: owner/repo/filepath
  const slashParts = decoded.split('/');
  if (slashParts.length >= 3) {
    return {
      owner: slashParts[0],
      repo: slashParts[1],
      filePath: slashParts.slice(2).join('/'),
    };
  }

  return null;
}

/**
 * Stateless GitHub REST content fetcher with in-memory caching and raw streaming.
 */
export async function fetchGitHubFileContent(
  owner: string,
  repo: string,
  filePath: string,
  token?: string
): Promise<string> {
  const cleanPath = filePath.replace(/^\/+/, '');
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}/${cleanPath.toLowerCase()}`;

  // 0. Built-in Demo Repository Handler (Works Offline without GitHub API)
  if (owner.toLowerCase() === 'demo' || (owner.toLowerCase() === 'glyph' && repo.toLowerCase() === 'demo')) {
    const demoMap: Record<string, string> = {
      'src/index.ts': `import { renderWorkspace } from './workspace';\n\nconsole.log('⚡ Glyph Spatial IDE initialized.');\nrenderWorkspace();\n`,
      'src/workspace.ts': `/**\n * Collaborative Spatial Editor Canvas\n * Layers Monaco Editor directly beneath Tldraw HTML5 Canvas\n */\nexport function renderWorkspace(): void {\n  console.log('Glyph Workspace Active');\n}\n`,
      'src/components/CanvasLayer.tsx': `import React from 'react';\n\nexport const CanvasLayer: React.FC = () => (\n  <div className="spatial-canvas-overlay pointer-events-auto">\n    <p>Drawing layer active</p>\n  </div>\n);\n`,
      'README.md': `# Glyph Studio 🌌\nA spatial collaborative repository editor combining Monaco Editor, Tldraw, and Yjs CRDTs.\n`,
      'package.json': `{\n  "name": "glyph-demo",\n  "version": "1.0.0",\n  "private": true\n}\n`,
    };
    return demoMap[cleanPath] || `// Built-in Demo file: ${cleanPath}\nconsole.log("Welcome to Glyph Studio");\n`;
  }

  // 1. In-memory fast cache check (TTL: 5 minutes)
  const cached = fileContentCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
    console.log(`⚡ [RoomManager] File content cache hit for ${cacheKey}`);
    return cached.content;
  }

  const authToken = token || config.github.fallbackToken;
  const authHeaders: Record<string, string> = {
    'User-Agent': 'Glyph-App',
  };
  if (authToken) {
    authHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  console.log(`[RoomManager] Fetching initial code blob from GitHub: ${owner}/${repo}/${cleanPath}`);

  // 2. High-performance Fast Path: Request raw format directly from GitHub API
  try {
    const rawUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
    const rawRes = await fetch(rawUrl, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (rawRes.ok) {
      const textContent = await rawRes.text();
      fileContentCache.set(cacheKey, {
        content: textContent,
        cachedAt: Date.now(),
      });
      return textContent;
    }
  } catch (rawErr) {
    console.warn(`[RoomManager] Raw content fetch failed, trying fallback JSON:`, rawErr);
  }

  // 3. Fallback: Standard GitHub API JSON contents endpoint
  try {
    const jsonUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`;
    const response = await fetch(jsonUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      let content = '';
      if (data.content && data.encoding === 'base64') {
        content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      } else if (typeof data === 'string') {
        content = data;
      } else {
        content = data.content || '';
      }

      fileContentCache.set(cacheKey, {
        content,
        cachedAt: Date.now(),
      });
      return content;
    }

    // 4. Edge Fallback: raw.githubusercontent.com CDN (useful if API rate limited)
    const cdnUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${cleanPath}`;
    const cdnRes = await fetch(cdnUrl, {
      headers: {
        'User-Agent': 'Glyph-App',
        ...(authToken ? { Authorization: `token ${authToken}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    if (cdnRes.ok) {
      const cdnText = await cdnRes.text();
      fileContentCache.set(cacheKey, {
        content: cdnText,
        cachedAt: Date.now(),
      });
      return cdnText;
    }

    const err = await response.json().catch(() => ({}));
    throw new Error(
      `GitHub API error ${response.status} fetching ${owner}/${repo}/${cleanPath}: ${JSON.stringify(err)}`
    );
  } catch (err: any) {
    // 5. Final fallback to raw CDN if standard fetch threw (e.g. network/timeout)
    try {
      const cdnUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${cleanPath}`;
      const cdnRes = await fetch(cdnUrl, {
        headers: {
          'User-Agent': 'Glyph-App',
          ...(authToken ? { Authorization: `token ${authToken}` } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });
      if (cdnRes.ok) {
        const cdnText = await cdnRes.text();
        fileContentCache.set(cacheKey, {
          content: cdnText,
          cachedAt: Date.now(),
        });
        return cdnText;
      }
    } catch {
      // CDN also failed
    }

    // 6. Graceful Offline Fallback: Return clean, extension-appropriate template code instead of crashing the room
    console.warn(`[RoomManager] Serving offline template for "${cleanPath}" on ${owner}/${repo} due to API/network unavailability.`);
    const ext = cleanPath.split('.').pop()?.toLowerCase() || '';
    let fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\n// Spatial Workspace active.\n`;

    if (ext === 'py') {
      fallbackTemplate = `# File: ${cleanPath} (${owner}/${repo})\n# Spatial Workspace active.\n\ndef main() -> None:\n    print(f"Spatial Workspace active for ${cleanPath}")\n\nif __name__ == "__main__":\n    main()\n`;
    } else if (ext === 'rs') {
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\n// Spatial Workspace active.\n\nfn main() {\n    println!("Spatial Workspace active for ${cleanPath}");\n}\n`;
    } else if (ext === 'go') {
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Spatial Workspace active for ${cleanPath}")\n}\n`;
    } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\n#include <iostream>\n\nint main() {\n    std::cout << "Spatial Workspace active for ${cleanPath}" << std::endl;\n    return 0;\n}\n`;
    } else if (ext === 'c' || ext === 'h') {
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\n#include <stdio.h>\n\nint main(void) {\n    printf("Spatial Workspace active for %s\\n", "${cleanPath}");\n    return 0;\n}\n`;
    } else if (ext === 'java') {
      const fileName = cleanPath.split('/').pop() || 'Main';
      const className = fileName.replace(/\.java$/i, '') || 'Main';
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\npublic class ${className} {\n    public static void main(String[] args) {\n        System.out.println("Spatial Workspace active for ${cleanPath}");\n    }\n}\n`;
    } else if (ext === 'html') {
      fallbackTemplate = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>${cleanPath}</title>\n</head>\n<body>\n  <h1>Spatial Workspace</h1>\n  <p>Active for ${cleanPath}</p>\n</body>\n</html>\n`;
    } else if (ext === 'css' || ext === 'scss') {
      fallbackTemplate = `/* File: ${cleanPath} (${owner}/${repo}) */\nbody {\n  margin: 0;\n  font-family: monospace;\n}\n`;
    } else if (ext === 'json') {
      fallbackTemplate = `{\n  "name": "${cleanPath.replace(/\.json$/i, '')}",\n  "status": "active"\n}\n`;
    } else if (ext === 'sql') {
      fallbackTemplate = `-- File: ${cleanPath} (${owner}/${repo})\nCREATE TABLE IF NOT EXISTS records (\n    id SERIAL PRIMARY KEY,\n    name VARCHAR(255) NOT NULL\n);\n`;
    } else if (ext === 'sh' || ext === 'bash') {
      fallbackTemplate = `#!/usr/bin/env bash\n# File: ${cleanPath} (${owner}/${repo})\necho "Spatial Workspace active for ${cleanPath}"\n`;
    } else if (ext === 'md' || ext === 'markdown') {
      fallbackTemplate = `# ${cleanPath}\n\nSpatial collaborative workspace for **${owner}/${repo}**.\n`;
    } else {
      fallbackTemplate = `// File: ${cleanPath} (${owner}/${repo})\nexport function main() {\n  console.log("Spatial Workspace active for ${cleanPath}");\n}\n\nmain();\n`;
    }
    fileContentCache.set(cacheKey, {
      content: fallbackTemplate,
      cachedAt: Date.now(),
    });
    return fallbackTemplate;
  }
}

/**
 * RoomManager controls the lifecycle of collaborative Y.Doc instances,
 * connection counts, 5-minute inactivity timeouts, and ephemeral Supabase persistence.
 */
export const roomManager = {
  /**
   * Checks if room already exists in memory
   */
  has(roomId: string): boolean {
    return roomSessions.has(roomId) || activeRooms.has(roomId) || docs.has(roomId);
  },

  /**
   * Retrieves an existing room document from memory
   */
  get(roomId: string): WSSharedDoc | undefined {
    return roomSessions.get(roomId)?.doc || activeRooms.get(roomId) || docs.get(roomId);
  },

  /**
   * Retrieves session metadata
   */
  getSession(roomId: string): RoomSession | undefined {
    return roomSessions.get(roomId);
  },

  /**
   * Returns active collaborative sessions directory for lobby discovery
   */
  getActiveRoomsSummary(): Array<{
    roomId: string;
    name: string;
    owner: string;
    repo: string;
    hostUsername: string;
    participantCount: number;
    mode: SessionMode;
    origin: RoomOrigin;
    createdAt: number;
    isPublic: boolean;
    code: string;
    hasPassword: boolean;
  }> {
    const list: Array<{
      roomId: string;
      name: string;
      owner: string;
      repo: string;
      hostUsername: string;
      participantCount: number;
      mode: SessionMode;
      origin: RoomOrigin;
      createdAt: number;
      isPublic: boolean;
      code: string;
      hasPassword: boolean;
    }> = [];

    for (const [roomId, session] of roomSessions.entries()) {
      if (session.isPublic === false) {
        continue; // Hide unlisted/private sessions from directory
      }
      const settings = session.doc.getMap('room-settings');
      let hostName = 'Host';
      for (const u of session.users.values()) {
        if (u.role === 'host') {
          hostName = u.username;
          break;
        }
      }

      const mode = (settings.get('mode') as SessionMode) || 'OPEN_SANDBOX';
      const origin = (settings.get('origin') as RoomOrigin) || 'github';

      list.push({
        roomId,
        name: `${session.owner}/${session.repo}`,
        owner: session.owner,
        repo: session.repo,
        hostUsername: hostName,
        participantCount: session.connectionCount,
        mode,
        origin,
        createdAt: Date.now() - 60000,
        isPublic: session.isPublic,
        code: session.code,
        hasPassword: Boolean(session.password),
      });
    }

    return list;
  },

  /**
   * Returns list of currently connected participants in the room
   */
  getConnectedParticipants(roomId: string): ConnectedParticipant[] {
    const session = roomSessions.get(roomId);
    if (!session) return [];
    return Array.from(session.users.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
      role: u.role,
      connectionTimestamp: u.connectionTimestamp,
    }));
  },

  /**
   * Broadcasts live participant roster to all active WebSocket clients in the room
   */
  broadcastParticipantList(roomId: string): void {
    const session = roomSessions.get(roomId);
    if (!session) return;
    const participants = roomManager.getConnectedParticipants(roomId);
    const payload = JSON.stringify({
      type: 'participant_list',
      participants,
    });
    for (const u of session.users.values()) {
      if (u.ws && u.ws.readyState === 1 /* OPEN */) {
        try {
          u.ws.send(payload);
        } catch {}
      }
    }
  },

  /**
   * Host can change access roles for any participant in the room
   */
  setUserRole(
    roomId: string,
    targetUserId: string,
    newRole: RoomRole,
    requesterUserId: string
  ): boolean {
    const session = roomSessions.get(roomId);
    if (!session) return false;

    const requester = Array.from(session.users.values()).find((u) => u.userId === requesterUserId);
    if (!requester || (requester.role !== 'host' && requester.role !== 'co-host')) {
      console.warn(`[RBAC] Non-host user "${requesterUserId}" cannot change roles in "${roomId}"`);
      return false;
    }

    // Co-host cannot change Host role
    if (requester.role === 'co-host' && targetUserId === session.hostId) {
      return false;
    }

    // Transferring Host role
    if (newRole === 'host') {
      if (requester.role !== 'host') return false;
      requester.role = 'co-host';
      session.hostId = targetUserId;
      const settings = session.doc.getMap('room-settings');
      settings.set('hostId', targetUserId);
    }

    let modified = false;
    for (const u of session.users.values()) {
      if (u.userId === targetUserId) {
        u.role = newRole;
        modified = true;
        if (u.ws && u.ws.readyState === 1) {
          try {
            u.ws.send(
              JSON.stringify({
                type: 'role_update',
                role: newRole,
                hostId: session.hostId,
              })
            );
          } catch {}
        }
      }
    }

    if (modified) {
      console.log(`👑 [RBAC] User "${requesterUserId}" changed role of "${targetUserId}" to "${newRole}" in "${roomId}"`);
      roomManager.broadcastParticipantList(roomId);
      return true;
    }
    return false;
  },

  /**
   * Updates room visibility, password, and session mode
   */
  updateRoomSettings(
    roomId: string,
    updates: { isPublic?: boolean; password?: string; mode?: SessionMode },
    requesterUserId: string
  ): boolean {
    const session = roomSessions.get(roomId);
    if (!session) return false;

    const requester = Array.from(session.users.values()).find((u) => u.userId === requesterUserId);
    if (!requester || (requester.role !== 'host' && requester.role !== 'co-host')) {
      return false;
    }

    const settings = session.doc.getMap('room-settings');
    if (updates.isPublic !== undefined) {
      session.isPublic = updates.isPublic;
      settings.set('isPublic', updates.isPublic);
    }
    if (updates.password !== undefined) {
      session.password = updates.password ? updates.password.trim() : undefined;
      settings.set('hasPassword', Boolean(session.password));
    }
    if (updates.mode) {
      settings.set('mode', updates.mode);
    }

    const payload = JSON.stringify({
      type: 'room_settings_update',
      isPublic: session.isPublic,
      code: session.code,
      hasPassword: Boolean(session.password),
      mode: (settings.get('mode') as SessionMode) || 'open-sandbox',
      hostId: session.hostId,
    });

    for (const u of session.users.values()) {
      if (u.ws && u.ws.readyState === 1) {
        try {
          u.ws.send(payload);
        } catch {}
      }
    }
    return true;
  },

  /**
   * Concludes / ends a session by the host(s).
   * Broadcasts session_concluded event, cleans up room registrations, and closes sockets.
   */
  concludeSession(
    roomId: string,
    requesterUserId: string,
    reason?: string
  ): { success: boolean; error?: string } {
    const session = roomSessions.get(roomId);
    if (!session) {
      return { success: false, error: 'Session not found or already closed' };
    }

    const requester = Array.from(session.users.values()).find((u) => u.userId === requesterUserId);
    const isHost = requester
      ? requester.role === 'host' || requester.role === 'co-host'
      : session.hostId === requesterUserId || !session.hostId || requesterUserId === 'host';

    if (!isHost) {
      console.warn(`[RoomManager] Non-host user "${requesterUserId}" attempted to conclude session "${roomId}"`);
      return { success: false, error: 'Permission denied: Only the host or co-host can conclude this session' };
    }

    console.log(`🛑 [RoomManager] Session "${roomId}" concluded by host "${requesterUserId}". Reason: ${reason || 'Host concluded the session'}`);

    // Broadcast session_concluded to all connected peers
    const payload = JSON.stringify({
      type: 'session_concluded',
      concludedBy: requester?.username || requesterUserId,
      reason: reason || 'Host concluded the session',
      timestamp: Date.now(),
    });

    const activeSockets = Array.from(session.users.values()).map((u) => u.ws);

    for (const ws of activeSockets) {
      if (ws && ws.readyState === 1) {
        try {
          ws.send(payload);
        } catch {}
      }
    }

    // Clean up room code from registry
    if (session.code) {
      roomCodeMap.delete(session.code);
      roomCodeMap.delete(session.code.toLowerCase());
    }

    // Disconnect peers after slight delay to allow message transmission
    setTimeout(() => {
      for (const ws of activeSockets) {
        if (ws && ws.readyState === 1) {
          try {
            ws.close(1000, 'Session Concluded');
          } catch {}
        }
      }
    }, 400);

    // Immediate cleanup of room in memory
    roomManager.deleteRoom(roomId);

    return { success: true };
  },

  /**
   * Registers a connected socket and determines role (Host, Co-Host, Guest, Spectator).
   * First active writer becomes Host.
   */
  addUser(
    roomId: string,
    socketId: string,
    ws: any,
    userId: string,
    username: string,
    permission: PermissionRole
  ): { role: RoomRole; hostId: string; mode: SessionMode; code: string; isPublic: boolean; hasPassword: boolean } {
    const session = roomSessions.get(roomId);
    if (!session) {
      return {
        role: 'guest',
        hostId: '',
        mode: 'open-sandbox',
        code: '',
        isPublic: true,
        hasPassword: false,
      };
    }

    const settings = session.doc.getMap('room-settings');
    if (!settings.has('mode')) {
      settings.set('mode', 'open-sandbox');
    }

    let role: RoomRole = 'guest';
    if (permission === 'read') {
      role = 'spectator';
    } else if (!session.hostId || session.users.size === 0) {
      // First connecting collaborator becomes Host
      role = 'host';
      session.hostId = userId;
      settings.set('hostId', userId);
      console.log(`👑 [RBAC] Assigned user "${username}" (${userId}) as HOST for room "${roomId}"`);
    } else if (username.toLowerCase() === session.owner.toLowerCase()) {
      // Repository owner joining an existing session becomes Host or Co-Host
      role = 'host';
      session.hostId = userId;
      settings.set('hostId', userId);
    } else {
      role = 'guest';
    }

    const connectedUser: ConnectedUser = {
      socketId,
      ws,
      userId,
      username,
      role,
      connectionTimestamp: Date.now(),
    };

    session.users.set(socketId, connectedUser);

    // Broadcast updated participant list to all participants
    setTimeout(() => {
      roomManager.broadcastParticipantList(roomId);
    }, 100);

    const mode = (settings.get('mode') as SessionMode) || 'open-sandbox';
    return {
      role,
      hostId: session.hostId,
      mode,
      code: session.code,
      isPublic: session.isPublic,
      hasPassword: Boolean(session.password),
    };
  },

  /**
   * Removes a connected socket. If the disconnected client was the Host,
   * triggers the Host Migration Algorithm to transfer leadership to the oldest active socket.
   */
  removeUser(roomId: string, socketId: string): void {
    const session = roomSessions.get(roomId);
    if (!session) return;

    const departingUser = session.users.get(socketId);
    session.users.delete(socketId);

    // Broadcast updated participant list
    roomManager.broadcastParticipantList(roomId);

    if (departingUser && departingUser.role === 'host') {
      console.log(`👋 [Host Disconnected] Host "${departingUser.username}" left room "${roomId}". Triggering Host Migration...`);
      roomManager.handleHostMigration(session, roomId);
    }
  },

  /**
   * Host Migration Algorithm:
   * Finds the connected client with the oldest connection_timestamp, assigns them as new Host,
   * updates the CRDT room-settings, and broadcasts a role_update WebSocket event.
   */
  handleHostMigration(session: RoomSession, roomId: string): void {
    if (session.users.size === 0) {
      session.hostId = '';
      return;
    }

    // Find oldest active socket by connectionTimestamp
    let oldestUser: ConnectedUser | null = null;
    for (const user of session.users.values()) {
      if (user.role === 'spectator') continue; // Spectators cannot become host
      if (!oldestUser || user.connectionTimestamp < oldestUser.connectionTimestamp) {
        oldestUser = user;
      }
    }

    // Fallback: if all remaining are spectators, pick oldest spectator
    if (!oldestUser) {
      for (const user of session.users.values()) {
        if (!oldestUser || user.connectionTimestamp < oldestUser.connectionTimestamp) {
          oldestUser = user;
        }
      }
    }

    if (oldestUser) {
      oldestUser.role = 'host';
      session.hostId = oldestUser.userId;

      const settings = session.doc.getMap('room-settings');
      settings.set('hostId', oldestUser.userId);

      console.log(
        `👑 [Host Migration] Successfully promoted "${oldestUser.username}" (${oldestUser.userId}) as new HOST of "${roomId}" (connected at ${oldestUser.connectionTimestamp})`
      );

      // Build assignments map
      const assignments: Record<string, RoomRole> = {};
      for (const u of session.users.values()) {
        assignments[u.userId] = u.role;
      }

      // Broadcast HOST_MIGRATED & role_update WebSocket event to all remaining clients in the room
      for (const u of session.users.values()) {
        if (u.ws && u.ws.readyState === 1 /* OPEN */) {
          try {
            const payload = {
              type: 'HOST_MIGRATED',
              newHostId: oldestUser.userId,
              role: u.role,
              assignments,
            };
            u.ws.send(JSON.stringify(payload));
            u.ws.send(
              JSON.stringify({
                type: 'role_update',
                role: u.role,
                hostId: oldestUser.userId,
                assignments,
              })
            );
          } catch (sendErr) {
            console.warn(`[Host Migration] Failed to deliver HOST_MIGRATED to socket ${u.socketId}:`, sendErr);
          }
        }
      }
    }
  },

  /**
   * Determines if a user role can write to Monaco or Tldraw based on current SessionMode.
   */
  canUserWrite(role: RoomRole, mode: SessionMode, target: 'monaco' | 'tldraw'): boolean {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'spectator') return false;

    const normalizedMode = mode.toLowerCase().replace(/_/g, '-');

    switch (normalizedMode) {
      case 'open-sandbox':
        // Everyone (Host, Co-Host, Guest) has Write access to Monaco and Tldraw
        return true;

      case 'lecture':
        // Host and Co-Host Write; Guests Read-Only
        return normalizedRole === 'host' || normalizedRole === 'co-host';

      case 'whiteboard':
        // Monaco locked to Host; Guests can draw/place stickers in Tldraw
        if (target === 'monaco') {
          return normalizedRole === 'host' || normalizedRole === 'co-host';
        }
        return true; // Tldraw open for guests

      case 'code-review':
        // Monaco Read-Only for everyone; Tldraw open for visual annotations
        if (target === 'monaco') {
          return false;
        }
        return true; // Tldraw open for annotations

      default:
        return true;
    }
  },

  /**
   * Updates session mode (Open Sandbox, Lecture, Whiteboard, Code-Review)
   */
  setSessionMode(roomId: string, mode: SessionMode, requesterRole: RoomRole): boolean {
    if (requesterRole !== 'host' && requesterRole !== 'co-host') {
      return false;
    }
    const session = roomSessions.get(roomId);
    if (!session) return false;

    const settings = session.doc.getMap('room-settings');
    settings.set('mode', mode);

    // Broadcast session_mode update to all connected clients
    for (const u of session.users.values()) {
      if (u.ws && u.ws.readyState === 1 /* OPEN */) {
        try {
          u.ws.send(
            JSON.stringify({
              type: 'session_mode',
              mode,
            })
          );
        } catch (err) {}
      }
    }
    return true;
  },

  /**
   * Increments connected user count and cancels any active teardown timer
   */
  incrementConnection(roomId: string): number {
    const session = roomSessions.get(roomId);
    if (!session) return 1;

    session.connectionCount++;

    // Reconnection detected: cancel the 5-minute teardown timer immediately
    if (session.gcTimer) {
      console.log(`⏱️ [RoomManager] Reconnection detected for "${roomId}". Canceling 5-minute ephemeral GC timer.`);
      clearTimeout(session.gcTimer);
      session.gcTimer = null;
    }

    console.log(`👥 [RoomManager] Room "${roomId}" connection count incremented: ${session.connectionCount}`);
    return session.connectionCount;
  },

  /**
   * Decrements connected user count. When count drops to 0, starts the 5-minute GC timer.
   */
  decrementConnection(roomId: string): number {
    const session = roomSessions.get(roomId);
    if (!session) return 0;

    session.connectionCount = Math.max(0, session.connectionCount - 1);
    console.log(`👥 [RoomManager] Room "${roomId}" connection count decremented: ${session.connectionCount}`);

    if (session.connectionCount === 0) {
      // Clear any prior timer just in case
      if (session.gcTimer) {
        clearTimeout(session.gcTimer);
      }

      console.log(
        `⏳ [RoomManager] Last client disconnected from "${roomId}". Scheduling ephemeral GC in 5 minutes (${config.gcTimeoutMs}ms)...`
      );

      session.gcTimer = setTimeout(async () => {
        try {
          await roomManager.purgeAndSaveRoom(roomId);
        } catch (gcErr) {
          console.error(`❌ [RoomManager] Error during ephemeral GC for "${roomId}":`, gcErr);
        }
      }, config.gcTimeoutMs);
    }

    return session.connectionCount;
  },

  /**
   * The Purge & Save Lifecycle:
   * Serializes the document to binary Uint8Array, saves to Supabase,
   * destroys the Y.Doc, and completely frees memory from the Node.js heap.
   */
  async purgeAndSaveRoom(roomId: string): Promise<void> {
    const session = roomSessions.get(roomId);
    if (!session) return;

    // Double-check: If clients reconnected while timer was resolving, do not purge
    if (session.connectionCount > 0) {
      console.log(`[RoomManager] Ephemeral GC aborted for "${roomId}": active connections present (${session.connectionCount}).`);
      session.gcTimer = null;
      return;
    }

    console.log(`🧹 [RoomManager] Ephemeral GC executing for room "${roomId}". Serializing CRDT state...`);

    try {
      // 1. Serialize entire Yjs document into binary Uint8Array
      const binaryState = Y.encodeStateAsUpdate(session.doc);

      // 2. Upload binary file to Supabase: PUT /ephemeral/{owner}-{repo}-{file_id}.bin
      await uploadEphemeralBlob(roomId, binaryState);

      // 3. Unsubscribe from Redis Pub/Sub channel
      await pubsubManager.unsubscribeRoom(roomId);

      // 4. Destroy Y.Doc and purge from all in-memory registries
      session.doc.destroy();
      docs.delete(roomId);
      activeRooms.delete(roomId);
      roomSessions.delete(roomId);

      console.log(
        `✅ [RoomManager] Room "${roomId}" successfully purged from heap. Ephemeral blob (${binaryState.byteLength} bytes) persisted in Supabase.`
      );
    } catch (err) {
      console.error(`❌ [RoomManager] Failed to purge and persist room "${roomId}":`, err);
    }
  },

  /**
   * Retrieves an active room or rehydrates from Supabase Storage / GitHub API.
   * If an ephemeral draft blob exists in Supabase, restores exact WIP code & canvas annotations.
   */
  async getOrCreateRoom(
    roomId: string,
    options: RoomInitOptions
  ): Promise<{ doc: WSSharedDoc; isRestoredFromDraft: boolean }> {
    // 1. Memory Cache Hit
    const existingSession = roomSessions.get(roomId);
    if (existingSession) {
      console.log(`[RoomManager] In-memory cache hit for room: ${roomId}`);
      if (existingSession.gcTimer) {
        clearTimeout(existingSession.gcTimer);
        existingSession.gcTimer = null;
      }
      return {
        doc: existingSession.doc,
        isRestoredFromDraft: false,
      };
    }

    console.log(`[RoomManager] Initializing collaborative room: ${roomId}`);

    // 2. Rehydration: Check Supabase Storage for existing ephemeral .bin blob
    let draftBlob: Uint8Array | null = null;
    try {
      draftBlob = await downloadEphemeralBlob(roomId);
    } catch (supaErr) {
      console.warn(`[RoomManager] Supabase check skipped or failed for ${roomId}:`, supaErr);
    }

    if (draftBlob && draftBlob.byteLength > 0) {
      console.log(
        `📦 [RoomManager] Found existing ephemeral draft in Supabase for "${roomId}" (${draftBlob.byteLength} bytes). Restoring exact WIP state...`
      );

      const doc = getYDoc(roomId, true);

      // Apply the serialized binary update (restores both Monaco Y.Text and Tldraw Y.Map)
      Y.applyUpdate(doc, draftBlob);

      // Ensure required structures exist
      doc.getText('monaco');
      doc.getMap('tldraw-state');
      const settingsMap = doc.getMap('room-settings');
      if (!settingsMap.has('mode')) {
        settingsMap.set('mode', 'open-sandbox');
      }
      if (!settingsMap.has('origin')) {
        settingsMap.set('origin', options.origin || (options.owner === 'local' || options.owner === 'upload' ? 'local' : 'github'));
      }

      const roomCode = options.code || generateRoomCode();
      const isPublic = options.isPublic ?? true;
      const password = options.password ? options.password.trim() : undefined;
      roomCodeMap.set(roomCode.toUpperCase(), roomId);

      settingsMap.set('code', roomCode);
      settingsMap.set('isPublic', isPublic);
      settingsMap.set('hasPassword', Boolean(password));

      const session: RoomSession = {
        doc,
        connectionCount: 0,
        gcTimer: null,
        owner: options.owner,
        repo: options.repo,
        filePath: options.filePath,
        isRestoredFromDraft: true,
        users: new Map(),
        hostId: (settingsMap.get('hostId') as string) || '',
        isPublic,
        code: roomCode,
        password,
      };

      roomSessions.set(roomId, session);
      activeRooms.set(roomId, doc);

      console.log(`✨ [RoomManager] Room "${roomId}" rehydrated from Supabase draft (code: ${roomCode}, public: ${isPublic}).`);
      return { doc, isRestoredFromDraft: true };
    }

    // 3. Fallback: Fetch initial code from GitHub REST API
    let initialCode = '';
    try {
      initialCode = await fetchGitHubFileContent(
        options.owner,
        options.repo,
        options.filePath,
        options.token
      );
    } catch (err) {
      console.error(`[RoomManager] Failed to fetch initial GitHub content for ${roomId}:`, err);
      initialCode = `// Failed to load content from GitHub: ${options.owner}/${options.repo}/${options.filePath}\n// Error: ${err}`;
    }

    // Initialize Y.Doc via y-websocket's shared doc constructor
    const doc = getYDoc(roomId, true);

    // Populate Y.Text('monaco') with fetched GitHub code
    const yText = doc.getText('monaco');
    if (yText.length === 0) {
      yText.insert(0, initialCode);
    }

    // Initialize Tldraw map for spatial drawings
    doc.getMap('tldraw-state');
    const settingsMap = doc.getMap('room-settings');
    if (!settingsMap.has('mode')) {
      settingsMap.set('mode', 'open-sandbox');
    }
    if (!settingsMap.has('origin')) {
      settingsMap.set('origin', options.origin || (options.owner === 'local' || options.owner === 'upload' ? 'local' : 'github'));
    }

    const roomCode = options.code || generateRoomCode();
    const isPublic = options.isPublic ?? true;
    const password = options.password ? options.password.trim() : undefined;
    roomCodeMap.set(roomCode.toUpperCase(), roomId);

    settingsMap.set('code', roomCode);
    settingsMap.set('isPublic', isPublic);
    settingsMap.set('hasPassword', Boolean(password));

    const session: RoomSession = {
      doc,
      connectionCount: 0,
      gcTimer: null,
      owner: options.owner,
      repo: options.repo,
      filePath: options.filePath,
      isRestoredFromDraft: false,
      users: new Map(),
      hostId: '',
      isPublic,
      code: roomCode,
      password,
    };

    roomSessions.set(roomId, session);
    activeRooms.set(roomId, doc);

    console.log(`[RoomManager] Room "${roomId}" initialized fresh (code: ${roomCode}, public: ${isPublic}) with ${initialCode.length} characters.`);
    return { doc, isRestoredFromDraft: false };
  },

  /**
   * Immediate room deletion
   */
  deleteRoom(roomId: string): void {
    const session = roomSessions.get(roomId);
    if (session) {
      if (session.gcTimer) clearTimeout(session.gcTimer);
      session.doc.destroy();
    }
    const doc = activeRooms.get(roomId) || docs.get(roomId);
    if (doc) doc.destroy();

    docs.delete(roomId);
    activeRooms.delete(roomId);
    roomSessions.delete(roomId);
  },

  /**
   * Gets total number of active rooms currently in memory
   */
  size(): number {
    return roomSessions.size;
  },
};
