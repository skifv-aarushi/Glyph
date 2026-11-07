'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthUser, GitHubRepoInfo, GitHubTreeItem, GitHubTreeResponse } from '@glyph/shared';
import {
  fetchAuthStatus,
  logoutUser,
  fetchRepoInfo,
  fetchRepoTree,
  fetchFileBlob,
  getGitHubLoginUrl,
} from '../lib/api';

export interface ActiveRepoState {
  owner: string;
  repo: string;
  defaultBranch: string;
  rootSha: string;
  description: string | null;
}

export interface SelectedFileState {
  path: string;
  sha: string;
  content: string;
}

export const localFileContentMap = new Map<string, string>();

export function useGitHubApi() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  const [activeRepo, setActiveRepo] = useState<ActiveRepoState | null>(null);
  const [isLoadingRepo, setIsLoadingRepo] = useState<boolean>(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  // Cache: sha -> list of tree items (depth=1)
  const [treeCache, setTreeCache] = useState<Record<string, GitHubTreeItem[]>>({});
  // Set of folder SHAs currently being fetched
  const [loadingShas, setLoadingShas] = useState<Set<string>>(new Set());

  // Active selected file content
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Check auth status on mount
  const checkAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const data = await fetchAuthStatus();
      setIsAuthenticated(data.authenticated);
      setAuthUser(data.user);
    } catch (err) {
      console.error('[useGitHubApi] Auth check failed:', err);
      setIsAuthenticated(false);
      setAuthUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle OAuth callback URL params (cleanup url)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('auth_success') || url.searchParams.has('auth_error')) {
        checkAuth();
        // Clean URL query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [checkAuth]);

  const loginWithGitHub = useCallback(() => {
    window.location.href = getGitHubLoginUrl();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setIsAuthenticated(false);
      setAuthUser(null);
    } catch (err) {
      console.error('[useGitHubApi] Logout failed:', err);
    }
  }, []);

  /**
   * Loads a repository by slug (e.g., "facebook/react" or "owner/repo")
   * Strictly fetches only depth=1 for the root directory.
   */
  const loadRepository = useCallback(
    async (repoSlug: string) => {
      let trimmed = repoSlug.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      if (trimmed.toLowerCase() === 'demo' || trimmed.toLowerCase() === 'starter') {
        trimmed = 'demo/starter';
      }
      const parts = trimmed.split('/');

      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        setRepoError('Please specify the repository in "owner/repo" format (e.g. demo/starter or facebook/react).');
        return;
      }

      const [owner, repo] = parts;

      try {
        setIsLoadingRepo(true);
        setRepoError(null);
        setSelectedFile(null);
        setTreeCache({}); // Reset cache for fresh repo

        // 1. Fetch repository information to get default branch
        const repoInfo = await fetchRepoInfo(owner, repo);

        // 2. High-Performance Full Tree Pre-population:
        // Attempt recursive tree fetch first. For standard repos, this retrieves all folders
        // and files in 1 request so every folder expands instantly (0ms) without network lag.
        let rootTreeResponse: GitHubTreeResponse;
        const initialTreeCache: Record<string, GitHubTreeItem[]> = {};

        try {
          const recResponse = await fetchRepoTree(owner, repo, repoInfo.default_branch, true);
          rootTreeResponse = recResponse;

          // Parse full recursive tree into a hierarchical treeCache
          // folderMap: directoryPath -> direct children with item.path = basename
          const folderMap = new Map<string, GitHubTreeItem[]>();
          folderMap.set('', []);

          for (const item of recResponse.tree) {
            const parts = item.path.split('/');
            const basename = parts[parts.length - 1];
            const parentDir = parts.slice(0, parts.length - 1).join('/');

            if (!folderMap.has(parentDir)) {
              folderMap.set(parentDir, []);
            }

            const childItem: GitHubTreeItem = {
              ...item,
              path: basename,
            };

            folderMap.get(parentDir)!.push(childItem);

            if (item.type === 'tree') {
              if (!folderMap.has(item.path)) {
                folderMap.set(item.path, []);
              }
            }
          }

          // Populate root children
          initialTreeCache[recResponse.sha] = folderMap.get('') || [];

          // Map every subdirectory SHA to its pre-parsed children
          for (const item of recResponse.tree) {
            if (item.type === 'tree') {
              const children = folderMap.get(item.path) || [];
              initialTreeCache[item.sha] = children;
            }
          }

          console.log(
            `🚀 [useGitHubApi] Pre-populated tree cache for ${recResponse.tree.length} items across all directories.`
          );
        } catch (recErr) {
          console.warn('[useGitHubApi] Recursive tree fetch failed, falling back to depth=1:', recErr);
          rootTreeResponse = await fetchRepoTree(owner, repo, repoInfo.default_branch, false);
          initialTreeCache[rootTreeResponse.sha] = rootTreeResponse.tree;
        }

        const newRepoState: ActiveRepoState = {
          owner,
          repo,
          defaultBranch: repoInfo.default_branch,
          rootSha: rootTreeResponse.sha,
          description: repoInfo.description,
        };

        setActiveRepo(newRepoState);
        setTreeCache(initialTreeCache);
      } catch (err: any) {
        console.error('[useGitHubApi] Failed to load repository:', err);
        setRepoError(err.message || 'Failed to load repository. Check owner/repo or rate limits.');
      } finally {
        setIsLoadingRepo(false);
      }
    },
    []
  );

  /**
   * Lazy-loads the children of a specific folder by SHA
   */
  const fetchFolderTree = useCallback(
    async (folderSha: string): Promise<GitHubTreeItem[]> => {
      if (!activeRepo) return [];

      // Return cached results if already loaded
      if (treeCache[folderSha]) {
        return treeCache[folderSha];
      }

      try {
        setLoadingShas((prev) => new Set(prev).add(folderSha));

        const response = await fetchRepoTree(activeRepo.owner, activeRepo.repo, folderSha);
        
        setTreeCache((prev) => ({
          ...prev,
          [folderSha]: response.tree,
        }));

        return response.tree;
      } catch (err: any) {
        console.error(`[useGitHubApi] Error fetching folder SHA ${folderSha}:`, err);
        return [];
      } finally {
        setLoadingShas((prev) => {
          const next = new Set(prev);
          next.delete(folderSha);
          return next;
        });
      }
    },
    [activeRepo, treeCache]
  );

  /**
   * Loads the content blob for a selected file
   */
  const loadFileContent = useCallback(
    async (file: GitHubTreeItem) => {
      if (!activeRepo) return;

      try {
        setIsLoadingFile(true);
        setFileError(null);

        // Check local uploaded file store first
        if (localFileContentMap.has(file.path)) {
          const content = localFileContentMap.get(file.path)!;
          setSelectedFile({
            path: file.path,
            sha: file.sha,
            content,
          });
          return;
        }

        const blob = await fetchFileBlob(activeRepo.owner, activeRepo.repo, file.sha);
        setSelectedFile({
          path: file.path,
          sha: file.sha,
          content: blob.content,
        });
      } catch (err: any) {
        console.error(`[useGitHubApi] Error loading file ${file.path}:`, err);
        setFileError(err.message || 'Failed to fetch file content');
      } finally {
        setIsLoadingFile(false);
      }
    },
    [activeRepo]
  );

  const importLocalFolder = useCallback(
    (folderName: string, files: { path: string; content: string }[]) => {
      const rootSha = `local-root-${Date.now()}`;
      const cleanFolderName =
        folderName.replace(/[^a-zA-Z0-9._-]/g, '-') || 'local-workspace';

      // Store contents in local file map
      files.forEach((f) => {
        const cleanPath = f.path.replace(/^\/+/, '');
        localFileContentMap.set(cleanPath, f.content);
        localFileContentMap.set(`${cleanFolderName}:${cleanPath}`, f.content);
        localFileContentMap.set(`local:${cleanFolderName}:${cleanPath}`, f.content);
      });

      // Build hierarchical tree structure from paths
      const dirMap = new Map<string, GitHubTreeItem[]>();
      dirMap.set('', []);

      for (const f of files) {
        const cleanPath = f.path.replace(/^\/+/, '');
        const parts = cleanPath.split('/');

        // Ensure all ancestor directories exist in dirMap
        let cur = '';
        for (let i = 0; i < parts.length - 1; i++) {
          const seg = parts[i];
          const parent = cur;
          cur = cur ? `${cur}/${seg}` : seg;

          if (!dirMap.has(cur)) {
            dirMap.set(cur, []);
            const parentList = dirMap.get(parent) || [];
            if (!parentList.some((item) => item.path === seg)) {
              parentList.push({
                path: seg,
                mode: '040000',
                type: 'tree',
                sha: `tree-${cur}`,
                url: '',
              });
              dirMap.set(parent, parentList);
            }
          }
        }

        // Add file item into its parent dir
        const parentDir = parts.slice(0, -1).join('/');
        const fileName = parts[parts.length - 1];
        const parentList = dirMap.get(parentDir) || [];
        if (!parentList.some((item) => item.path === fileName)) {
          parentList.push({
            path: fileName,
            mode: '100644',
            type: 'blob',
            sha: `file-${cleanPath}`,
            size: f.content.length,
            url: '',
          });
          dirMap.set(parentDir, parentList);
        }
      }

      // Convert dirMap into treeCache
      const newTreeCache: Record<string, GitHubTreeItem[]> = {};
      newTreeCache[rootSha] = dirMap.get('') || [];

      for (const [dirPath, children] of dirMap.entries()) {
        if (dirPath !== '') {
          newTreeCache[`tree-${dirPath}`] = children;
        }
      }

      setActiveRepo({
        owner: 'local',
        repo: cleanFolderName,
        defaultBranch: 'main',
        rootSha,
        description: 'Local Folder Workspace',
      });

      setTreeCache(newTreeCache);
    },
    []
  );

  const createScratchWorkspace = useCallback((name: string = 'scratch') => {
    const rootSha = `scratch-root-${Date.now()}`;
    const initialFiles: GitHubTreeItem[] = [
      {
        path: 'index.ts',
        mode: '100644',
        type: 'blob',
        sha: `scratch-file-${Date.now()}`,
        size: 50,
        url: '',
      },
      {
        path: 'README.md',
        mode: '100644',
        type: 'blob',
        sha: `scratch-readme-${Date.now()}`,
        size: 100,
        url: '',
      },
    ];

    setActiveRepo({
      owner: 'workspace',
      repo: name,
      defaultBranch: 'main',
      rootSha,
      description: 'Ephemeral Scratch Workspace',
    });

    setTreeCache({
      [rootSha]: initialFiles,
    });
  }, []);

  const addVirtualFile = useCallback(
    (filePath: string) => {
      if (!activeRepo) return;
      const clean = filePath.replace(/^\/+/, '');
      const newItem: GitHubTreeItem = {
        path: clean,
        mode: '100644',
        type: 'blob',
        sha: `virtual-${Date.now()}`,
        url: '',
      };

      setTreeCache((prev) => {
        const root = prev[activeRepo.rootSha] || [];
        if (root.some((i) => i.path === clean)) return prev;
        return {
          ...prev,
          [activeRepo.rootSha]: [...root, newItem],
        };
      });
      return newItem;
    },
    [activeRepo]
  );

  const addVirtualFolder = useCallback(
    (folderPath: string) => {
      if (!activeRepo) return;
      const clean = folderPath.replace(/^\/+/, '');
      const newItem: GitHubTreeItem = {
        path: clean,
        mode: '040000',
        type: 'tree',
        sha: `virtual-folder-${Date.now()}`,
        url: '',
      };

      setTreeCache((prev) => {
        const root = prev[activeRepo.rootSha] || [];
        if (root.some((i) => i.path === clean)) return prev;
        return {
          ...prev,
          [activeRepo.rootSha]: [...root, newItem],
        };
      });
      return newItem;
    },
    [activeRepo]
  );

  const deleteVirtualItem = useCallback(
    (itemPath: string) => {
      if (!activeRepo) return;
      setTreeCache((prev) => {
        const root = prev[activeRepo.rootSha] || [];
        return {
          ...prev,
          [activeRepo.rootSha]: root.filter((i) => i.path !== itemPath),
        };
      });
    },
    [activeRepo]
  );

  const renameVirtualItem = useCallback(
    (oldPath: string, newPath: string) => {
      if (!activeRepo) return;
      setTreeCache((prev) => {
        const root = prev[activeRepo.rootSha] || [];
        return {
          ...prev,
          [activeRepo.rootSha]: root.map((i) =>
            i.path === oldPath ? { ...i, path: newPath } : i
          ),
        };
      });
    },
    [activeRepo]
  );

  return {
    authUser,
    isAuthenticated,
    isLoadingAuth,
    loginWithGitHub,
    logout,
    activeRepo,
    isLoadingRepo,
    repoError,
    treeCache,
    loadingShas,
    selectedFile,
    isLoadingFile,
    fileError,
    loadRepository,
    fetchFolderTree,
    loadFileContent,
    createScratchWorkspace,
    importLocalFolder,
    addVirtualFile,
    addVirtualFolder,
    deleteVirtualItem,
    renameVirtualItem,
  };
}

