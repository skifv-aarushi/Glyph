import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index';
import { parseRoomId } from '../websocket/roomManager';

/**
 * Normalizes a collaborative roomId into the canonical ephemeral Supabase path:
 * ephemeral/{owner}-{repo}-{file_id}.bin
 */
export function getEphemeralBlobPath(roomId: string): string {
  const meta = parseRoomId(roomId);
  if (meta) {
    const fileId = meta.filePath
      .replace(/^[\\/]+/, '')
      .replace(/[\\/]/g, '-')
      .replace(/--+/g, '-');
    return `ephemeral/${meta.owner}-${meta.repo}-${fileId}.bin`;
  }

  // Fallback for non-standard room identifiers
  const sanitized = roomId
    .replace(/^room[\\/]+/, '')
    .replace(/[:\\/]/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return `ephemeral/${sanitized}.bin`;
}

/**
 * In-memory fallback cache for development or when Supabase credentials
 * are placeholders / offline.
 */
const inMemoryEphemeralCache = new Map<string, Uint8Array>();

const isSupabaseConfigured = Boolean(
  config.supabase.url &&
    !config.supabase.url.includes('placeholder') &&
    config.supabase.serviceRoleKey &&
    !config.supabase.serviceRoleKey.includes('placeholder')
);

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

if (!isSupabaseConfigured) {
  console.log(
    '📦 [Supabase Storage] Supabase credentials not set or using placeholders. Initialized in-memory fallback cache.'
  );
} else {
  console.log(`📦 [Supabase Storage] Initialized Supabase client for bucket: "${config.supabase.bucket}"`);
}

/**
 * Ensures the target Supabase storage bucket exists
 */
async function ensureBucketExists(bucketName: string): Promise<void> {
  if (!supabaseClient) return;
  try {
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      console.log(`[Supabase Storage] Creating storage bucket: "${bucketName}"`);
      await supabaseClient.storage.createBucket(bucketName, {
        public: false,
      });
    }
  } catch (err) {
    // Ignore error if bucket listing is restricted; upload will proceed
  }
}

let bucketVerified = false;

/**
 * Serializes and uploads a Yjs CRDT binary state update to Supabase Storage:
 * PUT /ephemeral/{owner}-{repo}-{file_id}.bin
 */
export async function uploadEphemeralBlob(roomId: string, data: Uint8Array): Promise<boolean> {
  const path = getEphemeralBlobPath(roomId);
  const bucket = config.supabase.bucket;

  // Always mirror to in-memory fallback cache for fast recovery
  inMemoryEphemeralCache.set(path, data);

  if (!supabaseClient) {
    console.log(
      `💾 [Supabase Storage (Fallback)] Persisted ephemeral state for "${roomId}" -> ${path} (${data.byteLength} bytes in RAM cache)`
    );
    return true;
  }

  try {
    if (!bucketVerified) {
      await ensureBucketExists(bucket);
      bucketVerified = true;
    }

    const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);

    const { error } = await supabaseClient.storage.from(bucket).upload(path, buffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });

    if (error) {
      console.error(`❌ [Supabase Storage] Error uploading blob to ${bucket}/${path}:`, error.message);
      return false;
    }

    console.log(
      `💾 [Supabase Storage] Successfully uploaded ephemeral state for "${roomId}" -> ${bucket}/${path} (${data.byteLength} bytes)`
    );
    return true;
  } catch (err: any) {
    console.error(`❌ [Supabase Storage] Unexpected upload failure for "${roomId}":`, err.message || err);
    return false;
  }
}

/**
 * Downloads the binary Yjs CRDT state blob from Supabase Storage:
 * GET /ephemeral/{owner}-{repo}-{file_id}.bin
 */
export async function downloadEphemeralBlob(roomId: string): Promise<Uint8Array | null> {
  const path = getEphemeralBlobPath(roomId);
  const bucket = config.supabase.bucket;

  if (!supabaseClient) {
    const cached = inMemoryEphemeralCache.get(path);
    if (cached) {
      console.log(
        `📦 [Supabase Storage (Fallback)] Cache hit for "${roomId}" -> ${path} (${cached.byteLength} bytes)`
      );
      return cached;
    }
    return null;
  }

  try {
    const { data, error } = await supabaseClient.storage.from(bucket).download(path);

    if (error || !data) {
      // Check in-memory fallback if Supabase returned 404 or not found
      const fallback = inMemoryEphemeralCache.get(path);
      if (fallback) {
        console.log(
          `📦 [Supabase Storage] Remote blob not found, restored from RAM fallback cache for "${roomId}" (${fallback.byteLength} bytes)`
        );
        return fallback;
      }
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const result = new Uint8Array(arrayBuffer);

    console.log(
      `📦 [Supabase Storage] Downloaded ephemeral draft blob for "${roomId}" -> ${bucket}/${path} (${result.byteLength} bytes)`
    );

    // Keep RAM cache synchronized
    inMemoryEphemeralCache.set(path, result);
    return result;
  } catch (err: any) {
    console.warn(`[Supabase Storage] Download failed for "${roomId}":`, err.message || err);
    const fallback = inMemoryEphemeralCache.get(path);
    return fallback || null;
  }
}

/**
 * Deletes the ephemeral .bin file from Supabase Storage post-commit or upon explicit reset.
 */
export async function deleteEphemeralBlob(roomId: string): Promise<boolean> {
  const path = getEphemeralBlobPath(roomId);
  const bucket = config.supabase.bucket;

  inMemoryEphemeralCache.delete(path);

  if (!supabaseClient) {
    console.log(`🗑️ [Supabase Storage (Fallback)] Deleted ephemeral RAM cache for "${roomId}" -> ${path}`);
    return true;
  }

  try {
    const { error } = await supabaseClient.storage.from(bucket).remove([path]);
    if (error) {
      console.warn(`[Supabase Storage] Note: Could not remove ${bucket}/${path}:`, error.message);
      return false;
    }

    console.log(`🗑️ [Supabase Storage] Deleted ephemeral draft blob for "${roomId}" -> ${bucket}/${path}`);
    return true;
  } catch (err: any) {
    console.warn(`[Supabase Storage] Remove error for "${roomId}":`, err.message || err);
    return false;
  }
}

