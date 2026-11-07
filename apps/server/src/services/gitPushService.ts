// apps/server/src/services/gitPushService.ts
/**
 * Stateless Git Push & Collision Avoidance Service
 * Manages atomic Git tree creation, branch creation/selection, remote repository provisioning,
 * and Redis Mutex concurrency locking with Lua script release.
 */

import { GitCommitResult } from '@glyph/shared';
import { roomManager, parseRoomId } from '../websocket/roomManager';
import { deleteEphemeralBlob } from './supabase';
import { redisPublisher, isRedisAvailable } from '../redis/client';
import { pubsubManager } from '../websocket/pubsub';

export class LockBusyConflictError extends Error {
  public currentHolder: string;
  constructor(message: string, currentHolder: string) {
    super(message);
    this.name = 'LockBusyConflictError';
    this.currentHolder = currentHolder;
  }
}

export interface PushCommitOptions {
  roomId: string;
  token: string;
  userId: string;
  message?: string;
  branch?: string;
  createNewBranch?: boolean;
}

export interface CreateLocalRepoOptions {
  roomId: string;
  token: string;
  userId: string;
  repoName: string;
  description?: string;
  isPrivate?: boolean;
  message?: string;
}

export interface CreateLocalRepoResult {
  commitSha: string;
  treeSha: string;
  ref: string;
  repoUrl: string;
}

// In-memory fallback map for environments where Redis is temporarily offline
interface LocalLockHolder {
  userId: string;
  expiresAt: number;
}
const localPushLocks = new Map<string, LocalLockHolder>();

export function getPushLockKey(roomId: string): string {
  return `lock:push:${roomId}`;
}

/**
 * Attempts to acquire an exclusive Redis Mutex lock:
 * SET lock:push:{roomId} {userId} NX EX 15
 */
export async function acquireRedisPushLock(
  roomId: string,
  userId: string,
  ttlSeconds = 15
): Promise<{ acquired: boolean; currentHolder?: string }> {
  const key = getPushLockKey(roomId);

  if (isRedisAvailable()) {
    try {
      const res = await redisPublisher.set(key, userId, 'EX', ttlSeconds, 'NX');
      if (res === 'OK') {
        return { acquired: true };
      }
      const currentHolder = (await redisPublisher.get(key)) || 'unknown-user';
      return { acquired: false, currentHolder };
    } catch (err) {
      console.warn(`[RedisLock] Redis lock attempt failed, falling back to local memory:`, err);
    }
  }

  // Fallback in-memory lock
  const now = Date.now();
  const existing = localPushLocks.get(key);
  if (existing && existing.expiresAt > now) {
    return { acquired: false, currentHolder: existing.userId };
  }

  localPushLocks.set(key, { userId, expiresAt: now + ttlSeconds * 1000 });
  return { acquired: true };
}

/**
 * Releases the Redis Mutex lock safely via Lua script verifying ownership:
 * Only the user who acquired the lock can release it.
 */
export async function releaseRedisPushLock(roomId: string, userId: string): Promise<boolean> {
  const key = getPushLockKey(roomId);

  if (isRedisAvailable()) {
    try {
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redisPublisher.eval(luaScript, 1, key, userId);
      return result === 1;
    } catch (err) {
      console.warn(`[RedisLock] Lua unlock script failed:`, err);
    }
  }

  // Local fallback release
  const entry = localPushLocks.get(key);
  if (entry && entry.userId === userId) {
    localPushLocks.delete(key);
    return true;
  }
  return false;
}

/**
 * Wraps any push action with distributed collision avoidance, broadcasting WebSocket
 * lock states before and after execution.
 */
export async function withPushCollisionLock<T>(
  roomId: string,
  userId: string,
  task: () => Promise<T>
): Promise<T> {
  const { acquired, currentHolder } = await acquireRedisPushLock(roomId, userId, 15);

  if (!acquired) {
    // Broadcast LOCK_BUSY notification
    pubsubManager.broadcastLockStatus(roomId, true);
    throw new LockBusyConflictError(
      `Push conflict: Room "${roomId}" is locked by active push from ${currentHolder}.`,
      currentHolder || 'unknown'
    );
  }

  // Broadcast lock active to disable push button across all collaborative peers
  pubsubManager.broadcastLockStatus(roomId, true);

  try {
    return await task();
  } finally {
    await releaseRedisPushLock(roomId, userId);
    pubsubManager.broadcastLockStatus(roomId, false);
  }
}

/**
 * Detects whether the active workspace session originated from a local PC upload or a cloned GitHub repository.
 */
export function detectSessionOrigin(roomId: string, originHint?: string): 'local' | 'github' {
  if (originHint === 'local') return 'local';
  const meta = parseRoomId(roomId);
  if (!meta) return 'local';
  if (meta.owner === 'local' || meta.owner === 'upload') return 'local';
  return 'github';
}

/**
 * Fetches available branches for a repository to populate target branch dropdowns.
 */
export async function fetchRepoBranches(owner: string, repo: string, token: string): Promise<string[]> {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Glyph-App',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, { headers });
  if (!res.ok) {
    return ['main'];
  }
  const branches = (await res.json()) as Array<{ name: string }>;
  return branches.map((b) => b.name);
}

/**
 * Local Origin Pipeline:
 * Creates a brand new GitHub repository on the authenticated user's account via POST /user/repos,
 * uploads the active editor buffer as the initial file commit, and establishes the 'main' branch ref.
 */
export async function pushLocalOriginToGitHub(options: CreateLocalRepoOptions): Promise<CreateLocalRepoResult> {
  const { roomId, token, repoName, description, isPrivate, message, userId } = options;

  const doc = roomManager.get(roomId);
  if (!doc) {
    throw new Error(`Active collaborative session for room "${roomId}" was not found in server memory.`);
  }

  const yText = doc.getText('monaco');
  const codeContent = yText.toString();

  const meta = parseRoomId(roomId);
  const rawPath = meta?.filePath || 'main.ts';
  const cleanPath = rawPath.replace(/^\/+/, '');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Glyph-App',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log(`📦 [Git Local Origin] Creating new GitHub repo "${repoName}" for user...`);

  // 1. Create Remote Repository: POST /user/repos
  const createRepoRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: description || 'Created from Glyph Spatial Collaborative Editor',
      private: !!isPrivate,
      auto_init: true, // Initializes with README so default branch ref exists immediately
    }),
  });

  if (!createRepoRes.ok) {
    const err = await createRepoRes.json().catch(() => ({}));
    throw new Error(`Failed to create remote repository "${repoName}": ${JSON.stringify(err)}`);
  }

  const newRepoData = (await createRepoRes.json()) as any;
  const owner = newRepoData.owner?.login;
  const repo = newRepoData.name;
  const defaultBranch = newRepoData.default_branch || 'main';
  const repoUrl = newRepoData.html_url || `https://github.com/${owner}/${repo}`;

  console.log(`✅ [Git Local Origin] Remote repo created: ${owner}/${repo} at ${repoUrl}. Pushing buffer...`);

  // 2. Push active buffer commit into freshly created repo
  const commitRes = await pushClonedRepoToGitHub({
    roomId,
    token,
    userId,
    branch: defaultBranch,
    message: message || `Initial commit of ${cleanPath} via Glyph`,
    createNewBranch: false,
  });

  return {
    commitSha: commitRes.commitSha,
    treeSha: commitRes.treeSha,
    ref: commitRes.ref,
    repoUrl,
  };
}

/**
 * Cloned GitHub Origin Pipeline:
 * Stateless Git Data API sequence pushing directly from Yjs in-memory CRDT code buffer
 * to an existing branch or creating a new branch ref via POST /repos/{owner}/{repo}/git/refs.
 */
export async function pushClonedRepoToGitHub(options: PushCommitOptions): Promise<GitCommitResult> {
  const { roomId, token, message, branch, createNewBranch } = options;

  const doc = roomManager.get(roomId);
  if (!doc) {
    throw new Error(`Active collaborative session for room "${roomId}" was not found in server memory.`);
  }

  const yText = doc.getText('monaco');
  const codeContent = yText.toString();

  const meta = parseRoomId(roomId);
  if (!meta) {
    throw new Error(`Invalid room format: "${roomId}". Cannot parse repository components.`);
  }

  const { owner, repo, filePath } = meta;
  const cleanPath = filePath.replace(/^\/+/, '');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Glyph-App',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  console.log(`🚀 [Git Push] Initiating commit push for ${owner}/${repo}/${cleanPath} (${codeContent.length} chars)`);

  // 1. Resolve target branch
  let targetBranch = branch;
  if (!targetBranch) {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (repoRes.ok) {
      const repoData = (await repoRes.json()) as any;
      targetBranch = repoData.default_branch || 'main';
    } else {
      targetBranch = 'main';
    }
  }

  console.log(`[Git Push] Target branch: ${targetBranch} (createNewBranch: ${!!createNewBranch})`);

  // 2. Get current base branch HEAD commit SHA
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${targetBranch}`,
    { headers }
  );

  let commitSha = '';
  if (refRes.ok) {
    const refData = (await refRes.json()) as any;
    commitSha = Array.isArray(refData) ? refData[0]?.object?.sha : refData?.object?.sha;
  }

  // If target branch not found or creating new branch, get default branch HEAD as parent base
  if (!commitSha) {
    const defaultBranchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/main`, { headers });
    if (defaultBranchRes.ok) {
      const defData = (await defaultBranchRes.json()) as any;
      commitSha = Array.isArray(defData) ? defData[0]?.object?.sha : defData?.object?.sha;
    }
  }

  if (!commitSha) {
    throw new Error(`Could not resolve base HEAD commit SHA for ${owner}/${repo}.`);
  }

  // 3. Get parent commit tree SHA
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, { headers });
  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({}));
    throw new Error(`Failed to fetch parent commit ${commitSha}: ${JSON.stringify(err)}`);
  }
  const commitData = (await commitRes.json()) as any;
  const parentTreeSha = commitData.tree?.sha;

  // 4. Create Git Blob
  const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      content: codeContent,
      encoding: 'utf-8',
    }),
  });
  if (!blobRes.ok) {
    const err = await blobRes.json().catch(() => ({}));
    throw new Error(`Failed to create Git blob: ${JSON.stringify(err)}`);
  }
  const blobData = (await blobRes.json()) as any;
  const newBlobSha = blobData.sha;

  // 5. Create new Git Tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: parentTreeSha,
      tree: [
        {
          path: cleanPath,
          mode: '100644',
          type: 'blob',
          sha: newBlobSha,
        },
      ],
    }),
  });
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    throw new Error(`Failed to create Git tree: ${JSON.stringify(err)}`);
  }
  const treeData = (await treeRes.json()) as any;
  const newTreeSha = treeData.sha;

  // 6. Create new Git Commit
  const commitMsg = message?.trim() || `Update ${cleanPath} via Glyph Spatial Editor`;
  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: commitMsg,
      tree: newTreeSha,
      parents: [commitSha],
    }),
  });
  if (!newCommitRes.ok) {
    const err = await newCommitRes.json().catch(() => ({}));
    throw new Error(`Failed to create Git commit: ${JSON.stringify(err)}`);
  }
  const newCommitData = (await newCommitRes.json()) as any;
  const newCommitSha = newCommitData.sha;

  // 7. Update or Create Branch Reference Pointer
  let branchUpdated = false;
  if (!createNewBranch) {
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${targetBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommitSha,
          force: false,
        }),
      }
    );
    if (updateRefRes.ok) {
      branchUpdated = true;
    }
  }

  // If new branch requested or ref didn't exist yet, create refs/heads/{new-branch}
  if (!branchUpdated) {
    console.log(`[Git Push] Creating new branch reference refs/heads/${targetBranch} at ${newCommitSha}...`);
    const createRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${targetBranch}`,
          sha: newCommitSha,
        }),
      }
    );
    if (!createRefRes.ok) {
      const err = await createRefRes.json().catch(() => ({}));
      throw new Error(`Failed to update or create branch reference for "${targetBranch}": ${JSON.stringify(err)}`);
    }
  }

  console.log(`✅ [Git Push] Successfully committed ${newCommitSha} to ${targetBranch}`);

  // Post-Commit: Cleanup Supabase draft
  try {
    await deleteEphemeralBlob(roomId);
    console.log(`🧹 [Git Push] Supabase draft for "${roomId}" cleared post-commit.`);
  } catch (cleanErr) {
    console.warn(`[Git Push] Supabase cleanup note:`, cleanErr);
  }

  return {
    commitSha: newCommitSha,
    treeSha: newTreeSha,
    ref: `refs/heads/${targetBranch}`,
  };
}

