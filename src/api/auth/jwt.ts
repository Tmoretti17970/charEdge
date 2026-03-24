// ═══════════════════════════════════════════════════════════════════
// charEdge — JWT Authentication Service (TypeScript)
//
// Phase 5 Task 5.1.3: JWT access + refresh tokens with httpOnly
// cookies for refresh token storage.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

import { randomUUID, createHmac, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import type { Response } from 'express';

// ─── Types ──────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  jti?: string;
  iss: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface TokenUser {
  id: string;
  email?: string;
  role?: string;
}

export interface RefreshTokenResult {
  token: string;
  jti: string;
  expiresAt: Date;
}

// ─── Configuration ──────────────────────────────────────────────

const ACCESS_TOKEN_TTL = 15 * 60; // 15 minutes (seconds)
const REFRESH_TOKEN_TTL = 7 * 24 * 3600; // 7 days (seconds)
const ISSUER = 'charEdge';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[Auth] JWT_SECRET environment variable is required');
  }
  return secret;
}

// ─── Token Generation ───────────────────────────────────────────

function b64url(input: string | Record<string, unknown>): string {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(str).toString('base64url');
}

function b64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verify(token: string, secret: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig!, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(b64urlDecode(body!)) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────

export function generateAccessToken(user: TokenUser): string {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      iss: ISSUER,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL,
      type: 'access',
    },
    getSecret(),
  );
}

export function generateRefreshToken(user: TokenUser): RefreshTokenResult {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomUUID();
  const token = sign(
    {
      sub: user.id,
      jti,
      iss: ISSUER,
      iat: now,
      exp: now + REFRESH_TOKEN_TTL,
      type: 'refresh',
    },
    getSecret(),
  );

  return {
    token,
    jti,
    expiresAt: new Date((now + REFRESH_TOKEN_TTL) * 1000),
  };
}

export function verifyAccessToken(token: string): JWTPayload | null {
  const payload = verify(token, getSecret());
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  const payload = verify(token, getSecret());
  if (!payload || payload.type !== 'refresh') return null;
  return payload;
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL * 1000,
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/api/auth' });
}

// ─── Password Hashing (scrypt) ──────────────────────────────
// Uses Node.js built-in scrypt with random salt.
// Hash format: "scrypt:<salt_hex>:<derived_hex>"
// Legacy format (HMAC-SHA256): 64-char hex string — auto-detected for migration.

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N — CPU/memory cost (2^14)
const SCRYPT_BLOCK = 8; // r — block size
const SCRYPT_PARALLEL = 1; // p — parallelization

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    cost: SCRYPT_COST,
    blockSize: SCRYPT_BLOCK,
    parallelization: SCRYPT_PARALLEL,
  });
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function comparePassword(password: string, hash: string): boolean {
  // New scrypt format
  if (hash.startsWith('scrypt:')) {
    const parts = hash.split(':');
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1]!, 'hex');
    const stored = Buffer.from(parts[2]!, 'hex');
    const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
      cost: SCRYPT_COST,
      blockSize: SCRYPT_BLOCK,
      parallelization: SCRYPT_PARALLEL,
    });
    return derived.length === stored.length && timingSafeEqual(derived, stored);
  }

  // Legacy HMAC-SHA256 format (64-char hex) — supports login migration
  const computed = createHmac('sha256', getSecret()).update(password).digest('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Check if a hash uses the legacy format and needs rehashing. */
export function needsRehash(hash: string): boolean {
  return !hash.startsWith('scrypt:');
}

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashPassword,
  comparePassword,
  needsRehash,
};
