import * as Y from 'yjs';
import { WebSocket } from 'ws';
import { LockStatusWsMessage } from '@glyph/shared';
import { redisPublisher, redisSubscriber, isRedisAvailable, SERVER_INSTANCE_ID } from '../redis/client';
import { roomManager } from './roomManager';

export interface RedisCrdtPayload {
  serverId: string;
  type: 'crdt_update' | 'lock_status';
  update?: string; // Base64 encoded binary Yjs update
  lockActive?: boolean;
}

class PubSubManager {
  private subscribedRooms = new Set<string>();
  private isSubListenerAttached = false;

  constructor() {
    this.setupRedisSubscriber();
  }

  /**
   * Sets up Redis subscriber message event listener
   */
  private setupRedisSubscriber() {
    if (this.isSubListenerAttached) return;
    this.isSubListenerAttached = true;

    redisSubscriber.on('message', (channel: string, rawMessage: string) => {
      if (!channel.startsWith('room:')) return;

      const roomId = channel.slice('room:'.length);

      try {
        const payload = JSON.parse(rawMessage) as RedisCrdtPayload;

        // Ignore messages published by this specific server instance to prevent echo loops
        if (payload.serverId === SERVER_INSTANCE_ID) {
          return;
        }

        // 1. Handle remote CRDT binary update from another server instance
        if (payload.type === 'crdt_update' && payload.update) {
          const doc = roomManager.get(roomId);
          if (doc) {
            const updateBuffer = Buffer.from(payload.update, 'base64');
            const updateBytes = new Uint8Array(updateBuffer);

            // Apply update with origin 'redis' so local observer does not re-publish
            // y-websocket's internal updateHandler will broadcast this update to all local clients
            console.log(`📡 [PubSub] Received remote CRDT update (${updateBytes.byteLength} bytes) for room "${roomId}"`);
            Y.applyUpdate(doc, updateBytes, 'redis');
          }
        }

        // 2. Handle remote Git Push Mutex Lock status update
        if (payload.type === 'lock_status' && typeof payload.lockActive === 'boolean') {
          console.log(`🔒 [PubSub] Received remote lock_status: active=${payload.lockActive} for room "${roomId}"`);
          this.broadcastLocalLockStatus(roomId, payload.lockActive);
        }
      } catch (err) {
        console.error(`[PubSub] Failed to parse message on channel "${channel}":`, err);
      }
    });
  }

  /**
   * Subscribes this server instance to the Redis channel for a room
   */
  async subscribeRoom(roomId: string): Promise<void> {
    if (this.subscribedRooms.has(roomId)) return;
    this.subscribedRooms.add(roomId);

    const channel = `room:${roomId}`;
    console.log(`📡 [PubSub] Subscribing server instance to channel: "${channel}"`);

    try {
      if (isRedisAvailable()) {
        await redisSubscriber.subscribe(channel);
      }
    } catch (err) {
      console.warn(`[PubSub] Failed to subscribe to Redis channel "${channel}":`, err);
    }
  }

  /**
   * Unsubscribes this server instance from the Redis channel when room is purged
   */
  async unsubscribeRoom(roomId: string): Promise<void> {
    if (!this.subscribedRooms.has(roomId)) return;
    this.subscribedRooms.delete(roomId);

    const channel = `room:${roomId}`;
    console.log(`📡 [PubSub] Unsubscribing server instance from channel: "${channel}"`);

    try {
      if (isRedisAvailable()) {
        await redisSubscriber.unsubscribe(channel);
      }
    } catch (err) {
      console.warn(`[PubSub] Failed to unsubscribe from Redis channel "${channel}":`, err);
    }
  }

  /**
   * Binds Y.Doc update listener to publish CRDT mutations to Redis
   */
  bindDocPubSub(roomId: string, doc: Y.Doc): void {
    // Avoid attaching multiple listeners to the same doc
    if ((doc as any)._pubSubBound) return;
    (doc as any)._pubSubBound = true;

    doc.on('update', (update: Uint8Array, origin: any) => {
      // Do not republish updates that originated from Redis itself
      if (origin === 'redis') {
        return;
      }

      const base64Update = Buffer.from(update).toString('base64');
      const payload: RedisCrdtPayload = {
        serverId: SERVER_INSTANCE_ID,
        type: 'crdt_update',
        update: base64Update,
      };

      const channel = `room:${roomId}`;
      if (isRedisAvailable()) {
        redisPublisher.publish(channel, JSON.stringify(payload)).catch((err) => {
          console.warn(`[PubSub] Failed to publish update to channel "${channel}":`, err);
        });
      }
    });
  }

  /**
   * Broadcasts lock status locally to all connected clients and publishes to Redis
   */
  async broadcastLockStatus(roomId: string, active: boolean): Promise<void> {
    // 1. Broadcast to all local WebSocket connections
    this.broadcastLocalLockStatus(roomId, active);

    // 2. Publish to Redis so all other server instances can notify their connected clients
    const channel = `room:${roomId}`;
    const payload: RedisCrdtPayload = {
      serverId: SERVER_INSTANCE_ID,
      type: 'lock_status',
      lockActive: active,
    };

    if (isRedisAvailable()) {
      try {
        await redisPublisher.publish(channel, JSON.stringify(payload));
      } catch (err) {
        console.warn(`[PubSub] Failed to publish lock_status to Redis channel "${channel}":`, err);
      }
    }
  }

  /**
   * Broadcasts lock status message to all local WebSocket clients in a room
   */
  private broadcastLocalLockStatus(roomId: string, active: boolean): void {
    const doc = roomManager.get(roomId);
    if (!doc || !doc.conns) return;

    const lockMessage: LockStatusWsMessage = {
      type: 'lock_status',
      active,
    };
    const serialized = JSON.stringify(lockMessage);

    doc.conns.forEach((_, conn) => {
      try {
        if (conn.readyState === WebSocket.OPEN) {
          conn.send(serialized);
        }
      } catch (err) {
        // Ignore dead socket send errors
      }
    });
  }
}

export const pubsubManager = new PubSubManager();

