import { Router, Request, Response } from 'express';
import { config } from '../config/index';
import { verifyAuthToken } from '../auth/jwt';
import {
  GitHubRepoInfo,
  GitHubTreeResponse,
  CommitRequestPayload,
  CommitResponsePayload,
} from '@glyph/shared';
import {
  parseRoomId,
  verifyUserRepoPermission,
  invalidateFileContentCache,
} from '../websocket/roomManager';
import {
  withPushCollisionLock,
  pushLocalOriginToGitHub,
  pushClonedRepoToGitHub,
  fetchRepoBranches,
  LockBusyConflictError,
} from '../services/gitPushService';

const router = Router();

// In-memory performance caches to avoid hitting GitHub API repeatedly
const repoCache = new Map<string, { data: GitHubRepoInfo; expiresAt: number }>();
const treeCache = new Map<string, { data: GitHubTreeResponse; expiresAt: number }>();
const blobCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Built-in demo repository files for offline testing and rate-limit recovery
 */
export const DEMO_FILES: Record<string, string> = {
  'src/index.ts': `import { renderWorkspace } from './workspace';

console.log('⚡ Glyph Spatial IDE initialized.');
renderWorkspace();
`,
  'src/workspace.ts': `/**
 * Collaborative Spatial Editor Canvas
 * Layers Monaco Editor directly beneath Tldraw HTML5 Canvas
 */
export function renderWorkspace(): void {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<h1>Glyph Workspace Active</h1>';
  }
}
`,
  'src/components/CanvasLayer.tsx': `import React from 'react';

export const CanvasLayer: React.FC = () => {
  return (
    <div className="spatial-canvas-overlay pointer-events-auto">
      {/* Real-time Tldraw annotations bound to Monaco text */}
      <p>Drawing layer active</p>
    </div>
  );
};
`,
  'README.md': `# Glyph Studio 🌌
A spatial collaborative repository editor combining Monaco Editor, Tldraw, and Yjs CRDTs.

## Features
- **Spatial Drawing:** Draw directly on code lines with scroll binding
- **Real-time CRDT:** Multi-user sync via Yjs and Redis
- **Living Backgrounds:** 7 Canvas environments (Ghost Koi, Watercolor, etc.)
`,
  'package.json': `{
  "name": "glyph-demo",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts"
}
`,
};

export function isDemoRepo(owner: string, repo: string): boolean {
  const o = owner.toLowerCase();
  const r = repo.toLowerCase();
  return o === 'demo' || (o === 'glyph' && r === 'demo');
}

/**
 * Helper to resolve the appropriate GitHub Authorization header
 */
function getGitHubAuthHeader(req: Request): Record<string, string> {
  const cookieToken = req.cookies[config.cookieName];
  if (cookieToken) {
    const payload = verifyAuthToken(cookieToken);
    if (payload?.githubToken) {
      return { Authorization: `Bearer ${payload.githubToken}` };
    }
  }

  // Fallback to server environment token if available
  if (config.github.fallbackToken) {
    return { Authorization: `Bearer ${config.github.fallbackToken}` };
  }

  return {};
}

/**
 * GET /api/github/repo/:owner/:repo
 * Fetches repository metadata and default branch (cached 10 mins)
 */
router.get('/repo/:owner/:repo', async (req: Request, res: Response) => {
  const { owner, repo } = req.params;

  // 1. Built-in Demo Repository Handler
  if (isDemoRepo(owner, repo)) {
    const demoInfo: GitHubRepoInfo = {
      name: repo || 'starter',
      full_name: `${owner}/${repo}`,
      default_branch: 'main',
      private: false,
      description: 'Built-in offline sample workspace with Monaco & Tldraw',
      owner: {
        login: owner,
        avatar_url: 'https://github.com/github.png',
      },
    };
    return res.json(demoInfo);
  }

  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const cached = repoCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json(cached.data);
  }

  try {
    const authHeaders = getGitHubAuthHeader(req);
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(
        `[GitHub API] Fetch for ${owner}/${repo} returned status ${response.status}. Serving seamless offline fallback.`
      );
      const fallbackRepoInfo: GitHubRepoInfo = {
        name: repo,
        full_name: `${owner}/${repo}`,
        default_branch: 'main',
        private: false,
        description: `${owner}/${repo} (Offline Fallback: Add GITHUB_AUTH_TOKEN to .env to enable live GitHub syncing)`,
        owner: {
          login: owner,
          avatar_url: 'https://github.com/github.png',
        },
      };
      return res.json(fallbackRepoInfo);
    }

    const data = (await response.json()) as any;
    const repoInfo: GitHubRepoInfo = {
      name: data.name,
      full_name: data.full_name,
      default_branch: data.default_branch || 'main',
      private: Boolean(data.private),
      description: data.description,
      owner: {
        login: data.owner.login,
        avatar_url: data.owner.avatar_url,
      },
    };

    repoCache.set(cacheKey, {
      data: repoInfo,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json(repoInfo);
  } catch (err: any) {
    console.warn(`[GitHub API] Network or server error fetching repo ${owner}/${repo}: ${err?.message}. Serving offline fallback.`);
    const fallbackRepoInfo: GitHubRepoInfo = {
      name: repo,
      full_name: `${owner}/${repo}`,
      default_branch: 'main',
      private: false,
      description: `${owner}/${repo} (Offline Fallback Workspace)`,
      owner: {
        login: owner,
        avatar_url: 'https://github.com/github.png',
      },
    };
    return res.json(fallbackRepoInfo);
  }
});

/**
 * GET /api/github/tree/:owner/:repo/:sha
 * Fetches the git tree at the specified SHA (supports ?recursive=1 for 1-shot full tree retrieval)
 */
router.get('/tree/:owner/:repo/:sha', async (req: Request, res: Response) => {
  const { owner, repo, sha } = req.params;

  // 1. Built-in Demo Repository Tree
  if (isDemoRepo(owner, repo)) {
    const demoTreeItems = [
      { path: 'src', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src', url: '' },
      { path: 'src/index.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-index', url: '', size: DEMO_FILES['src/index.ts'].length },
      { path: 'src/workspace.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-ws', url: '', size: DEMO_FILES['src/workspace.ts'].length },
      { path: 'src/components', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src-components', url: '' },
      { path: 'src/components/CanvasLayer.tsx', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-canvas', url: '', size: DEMO_FILES['src/components/CanvasLayer.tsx'].length },
      { path: 'README.md', mode: '100644', type: 'blob' as const, sha: 'demo-sha-readme', url: '', size: DEMO_FILES['README.md'].length },
      { path: 'package.json', mode: '100644', type: 'blob' as const, sha: 'demo-sha-pkg', url: '', size: DEMO_FILES['package.json'].length },
    ];
    return res.json({
      sha: 'demo-tree-sha',
      url: '',
      truncated: false,
      tree: demoTreeItems,
    });
  }

  const isRecursive = req.query.recursive === '1' || req.query.recursive === 'true';
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}/${sha.toLowerCase()}:${isRecursive ? 'rec' : 'flat'}`;

  const cached = treeCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(cached.data);
  }

  try {
    const authHeaders = getGitHubAuthHeader(req);
    const queryParam = isRecursive ? '?recursive=1' : '';
    const targetUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(sha)}${queryParam}`;

    let response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(10000),
    });

    // Automatic fallback: If recursive fetch failed (e.g. 409 repo too large or 422), retry with flat depth=1
    if (!response.ok && isRecursive && response.status !== 401 && response.status !== 403) {
      console.warn(`[GitHub API] Recursive tree returned ${response.status}, retrying depth=1 flat tree...`);
      const fallbackUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(sha)}`;
      response = await fetch(fallbackUrl, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Glyph-App',
          ...authHeaders,
        },
        signal: AbortSignal.timeout(8000),
      });
    }

    if (!response.ok) {
      console.warn(
        `[GitHub API] Tree fetch failed (${response.status}) for ${owner}/${repo}/${sha}. Serving seamless offline fallback tree.`
      );
      const fallbackTree = {
        sha: sha || 'fallback-sha',
        url: '',
        truncated: false,
        tree: [
          { path: 'src', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src', url: '' },
          { path: 'src/index.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-index', url: '', size: DEMO_FILES['src/index.ts'].length },
          { path: 'src/workspace.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-ws', url: '', size: DEMO_FILES['src/workspace.ts'].length },
          { path: 'src/components', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src-components', url: '' },
          { path: 'src/components/CanvasLayer.tsx', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-canvas', url: '', size: DEMO_FILES['src/components/CanvasLayer.tsx'].length },
          { path: 'README.md', mode: '100644', type: 'blob' as const, sha: 'demo-sha-readme', url: '', size: DEMO_FILES['README.md'].length },
          { path: 'package.json', mode: '100644', type: 'blob' as const, sha: 'demo-sha-pkg', url: '', size: DEMO_FILES['package.json'].length },
        ],
      };
      return res.json(fallbackTree);
    }

    const data = (await response.json()) as GitHubTreeResponse;

    // Sort items: directories ('tree') first, then files ('blob'), both alphabetically
    const sortedTree = [...data.tree].sort((a, b) => {
      if (a.type === b.type) {
        return a.path.localeCompare(b.path);
      }
      return a.type === 'tree' ? -1 : 1;
    });

    const result: GitHubTreeResponse = {
      sha: data.sha,
      url: data.url,
      truncated: data.truncated,
      tree: sortedTree,
    };

    treeCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (err: any) {
    console.warn(`[GitHub API] Network or proxy error for tree ${owner}/${repo}/${sha}: ${err?.message}. Serving offline fallback tree.`);
    const fallbackTree = {
      sha: sha || 'fallback-sha',
      url: '',
      truncated: false,
      tree: [
        { path: 'src', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src', url: '' },
        { path: 'src/index.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-index', url: '', size: DEMO_FILES['src/index.ts'].length },
        { path: 'src/workspace.ts', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-ws', url: '', size: DEMO_FILES['src/workspace.ts'].length },
        { path: 'src/components', mode: '040000', type: 'tree' as const, sha: 'demo-sha-src-components', url: '' },
        { path: 'src/components/CanvasLayer.tsx', mode: '100644', type: 'blob' as const, sha: 'demo-sha-src-canvas', url: '', size: DEMO_FILES['src/components/CanvasLayer.tsx'].length },
        { path: 'README.md', mode: '100644', type: 'blob' as const, sha: 'demo-sha-readme', url: '', size: DEMO_FILES['README.md'].length },
        { path: 'package.json', mode: '100644', type: 'blob' as const, sha: 'demo-sha-pkg', url: '', size: DEMO_FILES['package.json'].length },
      ],
    };
    return res.json(fallbackTree);
  }
});

/**
 * GET /api/github/blob/:owner/:repo/:sha
 * Fetches and decodes the file content of a specific blob (cached 15 mins)
 */
router.get('/blob/:owner/:repo/:sha', async (req: Request, res: Response) => {
  const { owner, repo, sha } = req.params;

  // 1. Built-in Demo Repository Blobs
  if (isDemoRepo(owner, repo) || sha.startsWith('demo-')) {
    for (const [filePath, content] of Object.entries(DEMO_FILES)) {
      if (sha.includes(filePath.replace(/[^a-zA-Z0-9]/g, '-')) || sha.endsWith(filePath.split('/').pop() || '')) {
        return res.json({ sha, size: content.length, content });
      }
    }
    const sample = DEMO_FILES['src/index.ts'];
    return res.json({ sha, size: sample.length, content: sample });
  }
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}/${sha.toLowerCase()}`;

  const cached = blobCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.json(cached.data);
  }

  try {
    const authHeaders = getGitHubAuthHeader(req);
    const targetUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${encodeURIComponent(sha)}`;

    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Glyph-App',
        ...authHeaders,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(
        `[GitHub API] Blob fetch failed (${response.status}) for ${owner}/${repo}/${sha}. Serving seamless offline fallback code.`
      );
      const fallbackContent = `// Glyph Offline File Fallback
// GitHub API returned ${response.status} (Rate limit exceeded or unauthenticated)
// Configure GITHUB_AUTH_TOKEN in .env or sign in with GitHub for live repo syncing.

export function renderFallback() {
  console.log("Glyph offline workspace ready.");
}
`;
      return res.json({
        sha,
        size: fallbackContent.length,
        content: fallbackContent,
      });
    }

    const data = (await response.json()) as {
      sha: string;
      size: number;
      content: string;
      encoding: string;
    };

    let decodedContent = data.content;
    if (data.encoding === 'base64') {
      decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
    }

    const result = {
      sha: data.sha,
      size: data.size,
      content: decodedContent,
    };

    blobCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    res.setHeader('Cache-Control', 'public, max-age=900');
    return res.json(result);
  } catch (err: any) {
    console.warn(`[GitHub API] Network or proxy error fetching blob for ${owner}/${repo}/${sha}: ${err?.message}. Serving offline fallback.`);
    const fallbackContent = `// Glyph Offline File Fallback\n// Active offline workspace\nexport const ready = true;\n`;
    return res.json({
      sha,
      size: fallbackContent.length,
      content: fallbackContent,
    });
  }
});

/**
 * POST /api/github/commit
 * Executes an atomic, stateless push to GitHub under the Redis Mutex lock
 */
router.post('/commit', async (req: Request, res: Response) => {
  // 1. Verify user's JWT from HTTP-only cookie
  const token = req.cookies[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to push commits.' });
  }

  const payload = verifyAuthToken(token);
  if (!payload || !payload.githubToken) {
    return res.status(401).json({ error: 'Invalid or expired session. Please re-authenticate.' });
  }

  const { roomId, message, branch, createNewBranch, origin, repoName, isPrivate } = req.body as CommitRequestPayload;
  if (!roomId) {
    return res.status(400).json({ error: 'Missing required field: roomId.' });
  }

  const meta = parseRoomId(roomId);
  if (!meta) {
    return res.status(400).json({ error: `Invalid roomId format: ${roomId}` });
  }

  const isLocalOrigin = origin === 'local' || meta.owner === 'local' || meta.owner === 'upload';

  // 2. Enforce Role-Based Access Control: spectators cannot push code (local origin creator always has write)
  if (!isLocalOrigin) {
    const permission = await verifyUserRepoPermission(
      meta.owner,
      meta.repo,
      payload.user.login,
      payload.githubToken
    );

    if (permission !== 'write') {
      return res.status(403).json({
        error: `Permission denied: Spectators cannot push commits to ${meta.owner}/${meta.repo}.`,
      });
    }
  }

  // 3. Acquire distributed Redis Mutex lock and execute stateless commit sequence
  try {
    const userId = payload.user.login || 'authenticated-user';
    const result = await withPushCollisionLock(roomId, userId, async () => {
      if (isLocalOrigin) {
        // Local Origin Pipeline: Create remote repo via POST /user/repos and initialize commit
        const targetRepoName = repoName?.trim() || meta.repo || 'glyph-project';
        return await pushLocalOriginToGitHub({
          roomId,
          token: payload.githubToken,
          userId,
          repoName: targetRepoName,
          isPrivate: !!isPrivate,
          message,
        });
      }

      // GitHub Origin Pipeline: Push stateless commit to target branch (or create new branch)
      return await pushClonedRepoToGitHub({
        roomId,
        token: payload.githubToken,
        userId,
        message,
        branch,
        createNewBranch: !!createNewBranch,
      });
    });

    // Invalidate cached file content so any subsequent room rehydration fetches freshly committed state
    invalidateFileContentCache(meta.owner, meta.repo, meta.filePath);

    const response: CommitResponsePayload = {
      success: true,
      commitSha: result.commitSha,
      ref: result.ref,
      repoUrl: (result as any).repoUrl,
    };
    return res.status(200).json(response);
  } catch (err: any) {
    if (err instanceof LockBusyConflictError) {
      console.warn(`🔒 [Git Route] Lock collision for room "${roomId}": ${err.message}`);
      return res.status(409).json({
        error: err.message,
        locked: true,
        currentHolder: err.currentHolder,
      });
    }

    console.error(`❌ [Git Route] Commit failed for room "${roomId}":`, err);
    return res.status(500).json({
      error: err.message || 'Failed to complete commit to GitHub.',
    });
  }
});

/**
 * GET /api/github/branches
 * Fetches branch names for a repository to populate branch selector dropdowns
 */
router.get('/branches', async (req: Request, res: Response) => {
  const { owner, repo } = req.query as { owner?: string; repo?: string };
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo query params required' });
  }

  const token = req.cookies[config.cookieName];
  const payload = token ? verifyAuthToken(token) : null;
  const githubToken = payload?.githubToken || config.github.fallbackToken;

  try {
    const branches = await fetchRepoBranches(owner, repo, githubToken);
    return res.status(200).json({ branches });
  } catch (err: any) {
    return res.status(200).json({ branches: ['main'] });
  }
});

export default router;

