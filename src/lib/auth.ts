// SERVER-ONLY module. Do not import from client-bundled components — it pulls
// in node:crypto and handles password/session-token material.
//
// Password hashing: scrypt (Node's built-in, OWASP-recommended KDF) with a
// random 16-byte salt per credential, stored as `${saltHex}:${derivedKeyHex}`.
// Session tokens: a minimal HMAC-SHA256 signed, base64url JSON token (same
// shape as a JWT but dependency-free) carrying staff id, role, home id and an
// expiry. See SECURITY.md for the production hardening checklist (httpOnly
// cookies instead of client-stored bearer tokens, refresh-token rotation, a
// real TOTP/SMS MFA provider, login rate limiting/lockout).
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, stored: string | undefined | null): boolean {
  if (!stored) return false;
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derivedKey = scryptSync(password, salt, SCRYPT_KEYLEN);
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(derivedKey, keyBuffer);
}

export interface SessionPayload {
  staffId: string;
  role: string;
  homeId: string;
  iat: number;
  exp: number;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

export function createSessionToken(
  payload: Pick<SessionPayload, 'staffId' | 'role' | 'homeId'>,
  secret: string,
  ttlSeconds = 60 * 60 * 12
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const body = base64url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null, secret: string): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expectedSignature = createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload: SessionPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
