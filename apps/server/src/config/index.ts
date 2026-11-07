import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from workspace root and local package
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'glyph-fallback-jwt-secret-replace-in-prod',
  jwtExpiresIn: '7d',
  cookieName: 'pg_auth_token',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/api/auth/github/callback',
    fallbackToken: process.env.GITHUB_AUTH_TOKEN || '',
    scopes: ['repo', 'read:user'].join(' '),
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'ephemeral-sessions',
  },
  gcTimeoutMs: parseInt(process.env.EPHEMERAL_GC_TIMEOUT_MS || '300000', 10), // 5 minutes default (300,000 ms)
};
