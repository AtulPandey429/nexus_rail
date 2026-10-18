import crypto from 'crypto';
import { requiredEnv } from '../config/env.js';

export type TokenUser = {
  id: string;
  email?: string;
  walletAddress?: string;
  role: 'user' | 'admin';
};

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64url');
}

export function signToken(user: TokenUser): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    })
  );
  const signature = crypto.createHmac('sha256', requiredEnv('JWT_SECRET')).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenUser {
  if (!token) throw new Error('Missing token');

  // Enforce strict 3-part cryptographic JWT format
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token: Cryptographic HMAC signature required');
  }
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', requiredEnv('JWT_SECRET')).update(`${header}.${body}`).digest('base64url');
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    throw new Error('Invalid token signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
    sub?: string;
    email?: string;
    walletAddress?: string;
    role?: string;
    exp?: number;
  };
  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  if (payload.role !== 'admin' && payload.role !== 'user') {
    throw new Error('Token role is invalid');
  }
  return {
    id: payload.sub,
    email: payload.email,
    walletAddress: payload.walletAddress,
    role: payload.role,
  };
}
