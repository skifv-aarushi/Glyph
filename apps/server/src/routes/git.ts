import { Router, Request, Response } from 'express';
import { CommitRequestPayload, CommitResponsePayload } from '@glyph/shared';
import { config } from '../config/index';
import { verifyAuthToken } from '../auth/jwt';
import { parseRoomId, verifyUserRepoPermission, invalidateFileContentCache } from '../websocket/roomManager';
import {
  withPushCollisionLock,
  pushLocalOriginToGitHub,
  pushClonedRepoToGitHub,
  fetchRepoBranches,
  LockBusyConflictError,
} from '../services/gitPushService';

const router = Router();

/**
 * Helper to extract verified GitHub token and user metadata from request cookie
 */
function getAuthenticatedUser(req: Request) {
  const token = req.cookies[config.cookieName];
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload || !payload.githubToken) return null;
  return payload;
}

/**
 * GET /api/git/branches?roomId=...
 * Fetches remote branches for the active repository
 */
router.get('/branches', async (req: Request, res: Response) => {
  const roomId = req.query.roomId as string;
  if (!roomId) {
    return res.status(400).json({ error: 'Missing required query param: roomId' });
  }

  const meta = parseRoomId(roomId);
  if (!meta) {
    return res.status(400).json({ error: `Invalid roomId: ${roomId}` });
  }

  const auth = getAuthenticatedUser(req);
  const token = auth?.githubToken || config.github.fallbackToken || '';

  try {
    const branches = await fetchRepoBranches(meta.owner, meta.repo, token);
    return res.json({ branches });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch branches' });
  }
});

/**
 * POST /api/git/commit or POST /api/github/commit
 * Executes an atomic, stateless Git push under the Redis Mutex lock.
 * Supports both Origin types:
 * 1. LOCAL ORIGIN: Creates a new remote GitHub repository (POST /user/repos), uploads Blob/Tree, commits, and creates default branch.
 * 2. GITHUB CLONE ORIGIN: Pushes to existing repo with Target Branch selection (push to current branch or create new branch).
 * Concurrency Lock: Redis Mutex (SET lock:push:{roomId} 1 NX EX 15).
 */
router.post('/commit', async (req: Request, res: Response) => {
  const auth = getAuthenticatedUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'Authentication required. Please sign in with GitHub.' });
  }

  const {
    roomId,
    message = 'Update via Glyph Collaborative Studio',
    branch = 'main',
    createNewBranch = false,
    origin = 'github',
    repoName,
    isPrivate = false,
  } = req.body as CommitRequestPayload;

  if (!roomId) {
    return res.status(400).json({ error: 'Missing required field: roomId' });
  }

  const meta = parseRoomId(roomId);
  if (!meta) {
    return res.status(400).json({ error: `Invalid roomId format: ${roomId}` });
  }

  // 1. Local Origin Pipeline: Create remote GitHub repo and push initial state
  if (origin === 'local' || meta.owner === 'local' || meta.owner === 'scratch') {
    const targetRepoName = repoName || meta.repo || 'glyph-workspace';
    try {
      const result = await withPushCollisionLock(roomId, auth.user.login, async () => {
        return await pushLocalOriginToGitHub({
          roomId,
          token: auth.githubToken,
          userId: auth.user.login,
          repoName: targetRepoName,
          description: 'Collaborative workspace created in Glyph Studio',
          isPrivate,
          message,
        });
      });

      invalidateFileContentCache(meta.owner, targetRepoName, meta.filePath);

      const response: CommitResponsePayload = {
        success: true,
        commitSha: result.commitSha,
        ref: result.ref,
        repoUrl: result.repoUrl,
      };

      return res.json(response);
    } catch (err: any) {
      if (err instanceof LockBusyConflictError) {
        return res.status(409).json({
          success: false,
          error: `Push Mutex Locked: Collaborator ${err.currentHolder} is actively committing. Please retry in a few seconds.`,
          lockedBy: err.currentHolder,
        });
      }
      return res.status(500).json({ success: false, error: err.message || 'Failed to push local repository to GitHub' });
    }
  }

  // 2. GitHub Origin Pipeline: Verify collaborator write permissions
  try {
    const permission = await verifyUserRepoPermission(
      meta.owner,
      meta.repo,
      auth.user.login,
      auth.githubToken
    );

    if (permission !== 'write') {
      return res.status(403).json({
        success: false,
        error: `Permission Denied: User "${auth.user.login}" is a spectator and does not have write access to ${meta.owner}/${meta.repo}.`,
      });
    }

    // 3. Acquire Redis Mutex and push stateless commit to GitHub
    const result = await withPushCollisionLock(roomId, auth.user.login, async () => {
      return await pushClonedRepoToGitHub({
        roomId,
        token: auth.githubToken,
        userId: auth.user.login,
        message,
        branch,
        createNewBranch,
      });
    });

    invalidateFileContentCache(meta.owner, meta.repo, meta.filePath);

    const response: CommitResponsePayload = {
      success: true,
      commitSha: result.commitSha,
      ref: result.ref,
      repoUrl: `https://github.com/${meta.owner}/${meta.repo}`,
    };

    return res.json(response);
  } catch (err: any) {
    if (err instanceof LockBusyConflictError) {
      return res.status(409).json({
        success: false,
        error: `Push Mutex Locked: Collaborator ${err.currentHolder} is actively committing. Please retry in a few seconds.`,
        lockedBy: err.currentHolder,
      });
    }
    return res.status(500).json({ success: false, error: err.message || 'Stateless commit failed' });
  }
});

export default router;
