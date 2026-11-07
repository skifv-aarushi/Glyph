import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index';
import authRoutes from './auth/routes';
import githubRoutes from './github/routes';
import gitRoutes from './routes/git';
import compilerRoutes from './routes/compiler';
import { initRedis } from './redis/client';
import { initWebSocketServer } from './websocket/server';

import { roomManager, roomCodeMap } from './websocket/roomManager';
import { redisPublisher, isRedisAvailable } from './redis/client';

const app = express();
const server = http.createServer(app);

// Initialize Redis Pub/Sub & Mutex connectivity
initRedis().catch((err) => {
  console.warn(`[Index] Redis init note:`, err.message);
});

// Initialize WebSocket server attached to HTTP server
initWebSocketServer(server);

// Security and parsing middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const configuredOrigin = (config.clientOrigin || '').replace(/\/$/, '');

      // Allow configured client origin, Vercel deployments, or local development
      if (
        !configuredOrigin ||
        configuredOrigin === '*' ||
        normalizedOrigin === configuredOrigin ||
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin.includes('localhost') ||
        normalizedOrigin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }

      return callback(null, true); // Fallback allow in production to prevent CORS lockouts
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Request logging in development
if (config.nodeEnv !== 'test') {
  app.use((req, _res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });
}

// Active Collaborative Sessions Directory Endpoint (Filtered to public only)
app.get('/api/rooms', async (_req, res) => {
  try {
    const memoryRooms = roomManager.getActiveRoomsSummary();

    // Query Upstash Redis index if available
    const redisRooms: any[] = [];
    if (isRedisAvailable()) {
      try {
        const keys = await redisPublisher.keys('active_rooms:*');
        for (const k of keys.slice(0, 20)) {
          const val = await redisPublisher.get(k);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (parsed.isPublic !== false) {
                redisRooms.push(parsed);
              }
            } catch {}
          }
        }
      } catch (redisErr) {
        console.warn('[Rooms API] Redis scan note:', redisErr);
      }
    }

    // Merge and deduplicate by roomId
    const roomMap = new Map<string, any>();
    for (const r of memoryRooms) roomMap.set(r.roomId, r);
    for (const r of redisRooms) {
      if (!roomMap.has(r.roomId)) roomMap.set(r.roomId, r);
    }

    // Default starter session if no active rooms
    if (roomMap.size === 0) {
      roomMap.set('demo:starter:src/demo.ts', {
        roomId: 'demo:starter:src/demo.ts',
        name: 'demo/starter',
        owner: 'demo',
        repo: 'starter',
        hostUsername: 'System',
        participantCount: 1,
        mode: 'OPEN_SANDBOX',
        origin: 'github',
        createdAt: Date.now() - 3600000,
        isPublic: true,
        code: 'PG-DEMO',
        hasPassword: false,
      });
    }

    res.json({
      rooms: Array.from(roomMap.values()),
      total: roomMap.size,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch active rooms' });
  }
});

// Resolve Session Code or Room Identifier
app.get('/api/rooms/resolve/:identifier', (req, res) => {
  const identifier = req.params.identifier.trim();
  const upper = identifier.toUpperCase();

  // 1. Direct code lookup
  let resolvedRoomId = roomCodeMap.get(upper);

  // 2. Scan active sessions
  if (!resolvedRoomId) {
    for (const [roomId, session] of roomManager.getActiveRoomsSummary().map((s) => [s.roomId, s] as const)) {
      if (session.code?.toUpperCase() === upper || roomId.toLowerCase() === identifier.toLowerCase()) {
        resolvedRoomId = roomId;
        break;
      }
    }
  }

  // 3. Fallback: Treat as direct roomId
  if (!resolvedRoomId) {
    resolvedRoomId = identifier;
  }

  const session = roomManager.getSession(resolvedRoomId);
  res.json({
    roomId: resolvedRoomId,
    code: session?.code || (upper.startsWith('PG-') ? upper : undefined),
    hasPassword: Boolean(session?.password),
    isPublic: session ? session.isPublic : true,
    name: session ? `${session.owner}/${session.repo}` : resolvedRoomId,
  });
});

// Verify Room Password
app.post('/api/rooms/verify-password', (req, res) => {
  const { roomId, password } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'Room identifier required' });
  }
  const session = roomManager.getSession(roomId);
  if (!session || !session.password) {
    return res.json({ valid: true }); // Open room
  }
  const isValid = session.password === (password || '').trim();
  res.json({ valid: isValid });
});

// Conclude Session by Host
app.post('/api/rooms/conclude', (req, res) => {
  const { roomId, userId, reason } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'Room identifier required' });
  }
  const result = roomManager.concludeSession(roomId, userId || 'host', reason);
  if (!result.success) {
    return res.status(403).json(result);
  }
  res.json({ success: true, message: 'Session concluded successfully' });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Glyph Server',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/compiler', compilerRoutes);

// Start HTTP & WebSocket server
server.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`🚀 [Glyph Server] Running on http://localhost:${config.port}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${config.port}/room/[roomId]`);
  console.log(`📡 Client Origin allowed: ${config.clientOrigin}`);
  console.log(`🔐 GitHub OAuth Callback: ${config.github.callbackUrl}`);
  console.log(`====================================================`);
});

export { app, server };
export default app;
