import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config/index';

/**
 * Unique identifier for this Node.js server instance
 * Used to prevent Redis Pub/Sub echo loops back to local clients
 */
export const SERVER_INSTANCE_ID = `srv_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

let isRedisConnected = false;
let hasLoggedRedisError = false;

const redisOptions: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      if (!hasLoggedRedisError) {
        console.warn(`⚠️ [Redis] Could not connect to Redis at ${config.redis.url}. Operating in local in-memory fallback mode.`);
        hasLoggedRedisError = true;
      }
      return null; // Stop retrying
    }
    return Math.min(times * 500, 2000);
  },
  enableOfflineQueue: false,
};

/**
 * Dedicated Redis instance for publishing updates and issuing lock commands
 */
export const redisPublisher = new Redis(config.redis.url, redisOptions);

/**
 * Dedicated Redis instance for subscribing to collaborative room channels
 */
export const redisSubscriber = new Redis(config.redis.url, redisOptions);

redisPublisher.on('connect', () => {
  isRedisConnected = true;
  hasLoggedRedisError = false;
  console.log(`⚡ [Redis Publisher] Connected successfully to Upstash / Redis.`);
});

redisSubscriber.on('connect', () => {
  console.log(`📡 [Redis Subscriber] Connected successfully to Upstash / Redis.`);
});

redisPublisher.on('error', (err) => {
  isRedisConnected = false;
  if (!hasLoggedRedisError) {
    console.warn(`⚠️ [Redis] Publisher notice (${err.message}). Using local in-memory fallback.`);
    hasLoggedRedisError = true;
  }
});

redisSubscriber.on('error', (err) => {
  if (!hasLoggedRedisError) {
    console.warn(`⚠️ [Redis] Subscriber notice (${err.message}). Using local in-memory fallback.`);
    hasLoggedRedisError = true;
  }
});

/**
 * Initializes Redis connections if configured
 */
export async function initRedis(): Promise<boolean> {
  try {
    await Promise.all([
      redisPublisher.connect().catch(() => {}),
      redisSubscriber.connect().catch(() => {}),
    ]);
    isRedisConnected = redisPublisher.status === 'ready' || redisPublisher.status === 'connect';
    return isRedisConnected;
  } catch (err) {
    isRedisConnected = false;
    return false;
  }
}

/**
 * Checks whether active Redis connection is established
 */
export function isRedisAvailable(): boolean {
  return isRedisConnected && redisPublisher.status === 'ready';
}

/**
 * Gracefully disconnects Redis clients
 */
export async function closeRedis(): Promise<void> {
  try {
    await Promise.all([
      redisPublisher.quit().catch(() => {}),
      redisSubscriber.quit().catch(() => {}),
    ]);
  } catch {
    // Ignore shutdown errors
  }
}

