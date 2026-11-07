// apps/web/src/utils/localWorkspaceStore.ts
import { localFileContentMap } from '../hooks/useGitHubApi';

export interface LocalWorkspacePayload {
  folderName: string;
  files: { path: string; content: string }[];
  options?: { isPublic?: boolean; password?: string };
}

const MEMORY_KEY = '__PG_LOCAL_WORKSPACE_STORE__';
const SESSION_KEY = 'pg_local_workspace_payload';
const DB_NAME = 'pg_local_workspace_db';
const DB_STORE = 'workspace';
const DB_VERSION = 1;

/**
 * Open IndexedDB database for local workspace persistence
 */
function openWorkspaceDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save local folder workspace payload to in-memory store, localFileContentMap, and IndexedDB
 */
export async function saveLocalWorkspace(payload: LocalWorkspacePayload): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. In-memory global store (synchronous & instant for SPA navigation)
  (window as any)[MEMORY_KEY] = payload;

  // 2. Pre-populate localFileContentMap for 0ms Monaco file hits
  const cleanFolderName =
    payload.folderName.replace(/[^a-zA-Z0-9._-]/g, '-') || 'local-workspace';
  for (const f of payload.files) {
    const cleanPath = f.path.replace(/^\/+/, '');
    localFileContentMap.set(cleanPath, f.content);
    localFileContentMap.set(`${cleanFolderName}:${cleanPath}`, f.content);
    localFileContentMap.set(`local:${cleanFolderName}:${cleanPath}`, f.content);
  }

  // 3. Persist to IndexedDB (supports large codebases exceeding 5MB sessionStorage quota)
  try {
    const db = await openWorkspaceDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        store.put(payload, 'current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (err) {
    console.warn('[localWorkspaceStore] Error writing to IndexedDB:', err);
  }

  // 4. Best-effort sessionStorage (for backwards compatibility if small enough)
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceededError is safely caught and ignored because IndexedDB and memory hold the payload
  }
}

/**
 * Retrieve local folder workspace payload from memory, IndexedDB, or sessionStorage
 */
export async function loadLocalWorkspace(): Promise<LocalWorkspacePayload | null> {
  if (typeof window === 'undefined') return null;

  // 1. Check in-memory store first
  const mem = (window as any)[MEMORY_KEY] as LocalWorkspacePayload | undefined;
  if (mem && mem.files && mem.files.length > 0) {
    return mem;
  }

  // 2. Check IndexedDB
  try {
    const db = await openWorkspaceDb();
    if (db) {
      const payload = await new Promise<LocalWorkspacePayload | null>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE);
        const request = store.get('current');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });

      if (payload && payload.files && payload.files.length > 0) {
        (window as any)[MEMORY_KEY] = payload;
        return payload;
      }
    }
  } catch (err) {
    console.warn('[localWorkspaceStore] Error reading from IndexedDB:', err);
  }

  // 3. Fallback to sessionStorage
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as LocalWorkspacePayload;
      if (parsed && parsed.files && parsed.files.length > 0) {
        (window as any)[MEMORY_KEY] = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[localWorkspaceStore] Error reading from sessionStorage:', err);
  }

  return null;
}

/**
 * Clear local workspace payload
 */
export async function clearLocalWorkspace(): Promise<void> {
  if (typeof window === 'undefined') return;

  delete (window as any)[MEMORY_KEY];

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}

  try {
    const db = await openWorkspaceDb();
    if (db) {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete('current');
    }
  } catch {}
}

