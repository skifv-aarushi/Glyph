import { redisPublisher, isRedisAvailable } from '../redis/client';
import { pubsubManager } from '../websocket/pubsub';

export class LockAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockAcquisitionError';
  }
}

// In-memory fallback lock map for environments where Redis is temporarily offline
interface LocalLockEntry {
  expiresAt: number;
}
const localLocks = new Map<string, LocalLockEntry>();

/**
 * Returns canonical Redis Mutex lock key for a collaborative room
 */
export function getLockKey(roomId: string): string {
  return `lock:repo:${roomId}`;
}

/**
 * Attempts to acquire distributed Mutex lock using atomic SET NX EX 15
 * Returns true if lock was acquired, false if lock already exists
 */
export async function acquirePushLock(roomId: string, ttlSeconds = 15): Promise<boolean> {
  const key = getLockKey(roomId);

  if (isRedisAvailable()) {
    try {
      // Atomic command: SET lock:repo:{roomId} 1 NX EX 15
      const result = await redisPublisher.set(key, '1', 'EX', ttlSeconds, 'NX');
      const acquired = result === 'OK';
      console.log(`🔒 [RedisLock] Acquire lock for "${key}": ${acquired ? 'GRANTED' : 'DENIED (collision)'}`);
      return acquired;
    } catch (err) {
      console.warn(`[RedisLock] Redis command failed, using in-memory lock:`, err);
    }
  }

  // Fallback in-memory atomic lock
  const now = Date.now();
  const existing = localLocks.get(key);
  if (existing && existing.expiresAt > now) {
    console.log(`🔒 [LocalLock] Fallback acquire for "${key}": DENIED (collision)`);
    return false;
  }

  localLocks.set(key, { expiresAt: now + ttlSeconds * 1000 });
  console.log(`🔒 [LocalLock] Fallback acquire for "${key}": GRANTED`);
  return true;
}

/**
 * Checks if the distributed Mutex lock is currently active
 */
export async function isPushLockActive(roomId: string): Promise<boolean> {
  const key = getLockKey(roomId);

  if (isRedisAvailable()) {
    try {
      const exists = await redisPublisher.exists(key);
      return exists === 1;
    } catch (err) {
      console.warn(`[RedisLock] Failed to check lock existence in Redis:`, err);
    }
  }

  const existing = localLocks.get(key);
  return Boolean(existing && existing.expiresAt > Date.now());
}

/**
 * Releases distributed Mutex lock and cleans up keys
 */
export async function releasePushLock(roomId: string): Promise<void> {
  const key = getLockKey(roomId);

  if (isRedisAvailable()) {
    try {
      await redisPublisher.del(key);
      console.log(`🔓 [RedisLock] Lock released for "${key}"`);
    } catch (err) {
      console.warn(`[RedisLock] Failed to release Redis lock for "${key}":`, err);
    }
  }

  localLocks.delete(key);
}

/**
 * Executes an asynchronous Git action under the distributed Redis Mutex lock.
 * Automatically broadcasts { type: 'lock_status', active: true } upon acquiring lock,
 * and ensures lock release & { type: 'lock_status', active: false } in a finally block.
 */
export async function withPushLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
  const acquired = await acquirePushLock(roomId, 15);
  if (!acquired) {
    throw new LockAcquisitionError(
      `Commit lock is active for room "${roomId}". Push is currently in progress by another collaborator.`
    );
  }

  try {
    // 1. Broadcast active lock status to all users in the room
    await pubsubManager.broadcastLockStatus(roomId, true);

    // 2. Execute the protected Git commit task
    const result = await task();
    return result;
  } finally {
    // 3. Ensure lock is released and status is broadcast even on error
    await releasePushLock(roomId);
    await pubsubManager.broadcastLockStatus(roomId, false);
  }
}

