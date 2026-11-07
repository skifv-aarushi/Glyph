import { AuthStatusResponse, GitHubBlobResponse, GitHubRepoInfo, GitHubTreeResponse, CommitResponsePayload } from '@glyph/shared';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080';

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const res = await fetch(`${SERVER_URL}/api/auth/status`, {
      credentials: 'include',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return { authenticated: false, user: null };
    }
    return res.json();
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const res = await fetch(`${SERVER_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return res.json();
}

export async function loginWithToken(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
  const res = await fetch(`${SERVER_URL}/api/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  return res.json();
}

export async function loginAsGuest(username?: string): Promise<{ success: boolean; user?: any; error?: string }> {
  const res = await fetch(`${SERVER_URL}/api/auth/guest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function fetchRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo> {
  const res = await fetch(`${SERVER_URL}/api/github/repo/${owner}/${repo}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch repo ${owner}/${repo}`);
  }
  return res.json();
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  sha: string,
  recursive = false
): Promise<GitHubTreeResponse> {
  const query = recursive ? '?recursive=1' : '';
  const res = await fetch(`${SERVER_URL}/api/github/tree/${owner}/${repo}/${encodeURIComponent(sha)}${query}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch tree at SHA ${sha}`);
  }
  return res.json();
}

export async function fetchFileBlob(
  owner: string,
  repo: string,
  sha: string
): Promise<GitHubBlobResponse> {
  const res = await fetch(`${SERVER_URL}/api/github/blob/${owner}/${repo}/${encodeURIComponent(sha)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch file content for SHA ${sha}`);
  }
  return res.json();
}

import { CommitRequestPayload } from '@glyph/shared';

export function getGitHubLoginUrl(): string {
  return `${SERVER_URL}/api/auth/github`;
}

export async function pushRepoCommit(
  roomId: string,
  message?: string,
  options?: Partial<CommitRequestPayload>
): Promise<CommitResponsePayload> {
  const payload: CommitRequestPayload = {
    roomId,
    message,
    branch: options?.branch,
    createNewBranch: options?.createNewBranch,
    origin: options?.origin,
    repoName: options?.repoName,
    isPrivate: options?.isPrivate,
  };

  // Try /api/git/commit first, with fallback to /api/github/commit
  let res = await fetch(`${SERVER_URL}/api/git/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    res = await fetch(`${SERVER_URL}/api/github/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to push commit');
  }
  return data;
}

export async function fetchRepoBranches(roomId: string): Promise<string[]> {
  try {
    const res = await fetch(`${SERVER_URL}/api/git/branches?roomId=${encodeURIComponent(roomId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return ['main'];
    const data = await res.json();
    return data.branches || ['main'];
  } catch {
    return ['main'];
  }
}

export interface ActiveRoomSummary {
  roomId: string;
  name: string;
  owner: string;
  repo: string;
  hostUsername: string;
  participantCount: number;
  mode: string;
  origin: string;
  createdAt: number;
  isPublic?: boolean;
  code?: string;
  hasPassword?: boolean;
}

export async function fetchActiveRooms(): Promise<ActiveRoomSummary[]> {
  try {
    const res = await fetch(`${SERVER_URL}/api/rooms`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rooms || [];
  } catch {
    return [];
  }
}

