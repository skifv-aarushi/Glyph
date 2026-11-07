import type { Editor as TldrawEditor, TLRecord } from '@tldraw/tldraw';
import type * as Y from 'yjs';

/**
 * Binds Tldraw's record store to a Yjs Y.Map('tldraw') for real-time multiplayer synchronization.
 */
export function bindTldrawToYjs(
  tldrawEditor: TldrawEditor,
  doc: Y.Doc,
  mapName = 'tldraw'
): () => void {
  const yMap = doc.getMap<TLRecord>(mapName);
  const store = tldrawEditor.store;

  let isApplyingRemote = false;

  // 1. Initial hydration: Load records from Y.Map into Tldraw store
  const initialRecords: TLRecord[] = [];
  yMap.forEach((record) => {
    if (record && typeof record === 'object' && 'id' in record) {
      initialRecords.push(record);
    }
  });

  if (initialRecords.length > 0) {
    store.mergeRemoteChanges(() => {
      store.put(initialRecords);
    });
  }

  // 2. Local Tldraw changes -> push to Y.Map
  const unlistenStore = store.listen(
    (entry) => {
      if (isApplyingRemote) return;

      doc.transact(() => {
        // Added shapes/drawings
        for (const [id, record] of Object.entries(entry.changes.added)) {
          yMap.set(id, record);
        }
        // Updated shapes/drawings
        for (const [id, [, to]] of Object.entries(entry.changes.updated)) {
          yMap.set(id, to);
        }
        // Removed shapes/drawings
        for (const id of Object.keys(entry.changes.removed)) {
          yMap.delete(id);
        }
      }, 'tldraw-local');
    },
    { source: 'user', scope: 'document' }
  );

  // 3. Remote Y.Map changes -> apply to Tldraw store
  const handleYMapChange = (event: Y.YMapEvent<TLRecord>) => {
    if (event.transaction.origin === 'tldraw-local') return;

    isApplyingRemote = true;
    try {
      const toPut: TLRecord[] = [];
      const toRemove: string[] = [];

      event.changes.keys.forEach((change, key) => {
        if (change.action === 'add' || change.action === 'update') {
          const record = yMap.get(key);
          if (record) {
            toPut.push(record);
          }
        } else if (change.action === 'delete') {
          toRemove.push(key);
        }
      });

      store.mergeRemoteChanges(() => {
        if (toRemove.length > 0) {
          store.remove(toRemove as any);
        }
        if (toPut.length > 0) {
          store.put(toPut);
        }
      });
    } finally {
      isApplyingRemote = false;
    }
  };

  yMap.observe(handleYMapChange);

  return () => {
    unlistenStore();
    yMap.unobserve(handleYMapChange);
  };
}

