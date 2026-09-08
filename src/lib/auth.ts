// SERVER-ONLY module. Never import from a client-bundled file (component,
// hook, or App.tsx) — this pulls in node:crypto and handles password/token
// material that must never reach the browser bundle.
//
// Password hashing: scrypt (Node's built-in, OWASP-recommended KDF) with a
// random 16-byte salt per credential, stored as `${saltHex}:${derivedKeyHex}`.
//
// Tokens: a minimal HMAC-SHA256 signed, base64url JSON token (same shape as
// a JWT but dependency-free) carrying a `purpose` field so one mechanism
// serves two different lifetimes safely:
//   - 'pending_2fa' — issued after username+password verifies, before the
//     OTP step. Short-lived (5 min) and only ever accepted by the OTP
//     send/verify endpoints, never by requireAuth.
//   - 'session' — issued after OTP verifies. Longer-lived and accepted by
//     requireAuth for every other route.
// A pending_2fa token can never be used as a session token and vice versa —
// requireAuth and the OTP endpoints each check `purpose` explicitly.
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

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

export interface TokenPayload {
  purpose: 'pending_2fa' | 'session';
  staffId: string;
  role: string;
  homeId: string;
  iat: number;
  exp: number;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

export function createToken(
  payload: Pick<TokenPayload, 'purpose' | 'staffId' | 'role' | 'homeId'>,
  secret: string,
  ttlSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const body = base64url(JSON.stringify(fullPayload));
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(token: string | undefined | null, secret: string): TokenPayload | null {
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
    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Six-digit numeric OTP, generated with a CSPRNG (not Math.random). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** URL-safe single-use token for password reset links. */
export function generateResetToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Generates a unique username from a staff member's name (first.last,
 * lowercased, deduplicated against existing usernames by appending a
 * number). Used when an Owner/Manager provisions a new staff account.
 */
export function generateUsername(fullName: string, existingUsernames: string[]): string {
  const base = fullName
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('.')
    .replace(/[^a-z0-9.]/g, '');

  const taken = new Set(existingUsernames.map((u) => u.toLowerCase()));
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

/** A temporary initial password for a newly provisioned account — random,
 * readable enough to hand to someone verbally, and always paired with
 * mustChangePassword: true. */
export function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}
