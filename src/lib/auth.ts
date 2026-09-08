// SERVER-ONLY module. Never import from a client-bundled file (component,
// hook, or App.tsx) — this pulls in node:crypto and signs tokens with a
// server secret that must never reach the browser bundle.
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
//
// This is pure, stateless verification — no in-memory Map or other
// cross-request state involved — so it works the same whether a request
// lands on a warm or freshly cold-started Vercel serverless instance. See
// src/seedData.auth.ts for why credentials and OTP codes are hardcoded
// literals rather than dynamically generated/stored.
import { timingSafeEqual, createHmac } from 'node:crypto';

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
