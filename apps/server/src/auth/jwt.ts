import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { AuthUser } from '@glyph/shared';

export interface TokenPayload {
  githubToken: string;
  user: AuthUser;
}

export function signAuthToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d',
  });
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

