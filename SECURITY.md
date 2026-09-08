# CareHomeOS — Security

## Authentication: two layers, hardcoded demo credentials

1. **Username + password** (`POST /api/auth/login`) — checked against a
   fixed, plaintext password literal per staff member
   (`src/seedData.auth.ts`'s `SEED_PASSWORDS`), with a constant-shape
   response whether the username doesn't exist or the password is wrong,
   so a failed attempt never reveals which one was incorrect. On success
   this issues a **pending_2fa token** — not a session — valid for 5
   minutes.
2. **One-time code to phone or email** (`POST /api/auth/otp/send` then
   `POST /api/auth/otp/verify`) — the actual second factor. Each staff
   member has their own fixed 6-digit code (`SEED_OTP_CODES`); entering
   the correct one exchanges the pending_2fa token for a real **session
   token** (12-hour TTL).

Both token kinds are the same HMAC-SHA256 signed, base64url-encoded shape
(`src/lib/auth.ts`'s `createToken`/`verifyToken`), distinguished by a
`purpose` field (`'pending_2fa' | 'session'`). `requireAuth` (guards every
route except `/api/health` and `/api/auth/*`) only accepts `session`;
`requirePendingAuth` (guards only the OTP endpoints) only accepts
`pending_2fa`. A pending 2FA ticket can never be replayed as a session and
a session can never be used to re-trigger OTPs for another account.

Note on factor strength: a phone/email code alone is one factor
(something you have). Paired with the password (something you know) that
is genuine two-factor. A deployment that skipped the password layer and
used the code alone would not be.

### Why every credential is a hardcoded literal

This is a deliberate, demo-only simplification — not an oversight. An
earlier version of this build hashed passwords with scrypt and generated a
random OTP code per login attempt, tracked in an in-memory `Map` keyed by
staff id (and a second `Map` for password reset tokens). That worked in
local testing but failed unpredictably once deployed to Vercel: Vercel
serverless functions are stateless across invocations, and the three
requests that make up one login (`/login`, then `/otp/send`, then
`/otp/verify`) are not guaranteed to land on the same warm function
instance. A request that hits a freshly cold-started instance sees an
empty `Map` — the OTP that a previous request just generated and stored
simply isn't there, and verification fails with no way to distinguish that
from an actually-wrong code.

Fixing that properly means a persistent, shared store (see "What's still
a prototype" below). Short of that, every credential and OTP code here is
now a fixed literal in `src/seedData.auth.ts`, and `/api/auth/login` /
`/otp/verify` do plain string comparisons against those literals — nothing
in the auth flow depends on state surviving between requests, so the
"works locally, flaky on Vercel" failure mode is eliminated by
construction. `src/lib/auth.ts`'s token signing/verification is unaffected
by this — it was always pure, stateless HMAC verification with no shared
memory involved.

## OTP delivery

`src/services/notificationDeliveryService.ts` sends codes via SMS or
email, gated entirely on whether `SMS_PROVIDER_*` / `EMAIL_PROVIDER_*` env
vars are configured (see `.env.example`). Unconfigured, it runs in **dev
mode**: the code is logged server-side and also returned to the client as
`devCode` in the `/api/auth/otp/send` response, so the whole flow is
testable without a paid provider account. **A configured deployment never
returns the code in the API response** — set the provider env vars before
any real deployment. Since every OTP code in this demo is a fixed literal
rather than a per-login secret, `devCode` is not itself a meaningful
disclosure here.

## Username recovery / forgot password

`POST /api/auth/forgot-username` always returns the same generic success
message regardless of whether the supplied email matches an account — it
cannot be used to enumerate valid staff emails — and emails the real
username to a matching account.

`POST /api/auth/forgot-password` uses the same non-revealing response
shape, but since this demo has no self-serve password reset (passwords are
fixed literals, not something a user changes), it simply tells the
requester an administrator will follow up.

## Identity spoofing (`requireSelf`)

Being authenticated only proves *who you are*, not that a request body's
claimed staff id matches that identity. Every mutating endpoint that
represents "an action I am personally taking" (clocking in, administering
a medication, submitting a daily report, claiming a shift task, etc.)
calls `requireSelf(req, res, claimedId)`, which 403s if the body's id
doesn't match `req.staff.id`. Endpoints that determine a *caller's*
authorization level (Owner-only task catalog edits, Manager/Owner incident
review) read the role from `req.staff` — set by `requireAuth` from the
verified session — never from a client-supplied field.

## What's still a prototype

- **Hardcoded credentials.** Every password and OTP code is a fixed
  literal in `src/seedData.auth.ts`, not hashed, not rotated, not
  per-session. Fine for a demo; replace with a real credential store and
  dynamically-issued, single-use OTP codes before handling real resident
  data — see "Why every credential is a hardcoded literal" above.
- **In-memory `dbState`.** All other application data still lives in
  process memory — a restart or Vercel cold start clears every write made
  since boot. Move to a real database before production; see
  `src/apiApp.ts`'s file header for the Vercel serverless implication
  (each cold start is a fresh, empty-of-writes copy).
- **No login rate limiting or lockout.** Nothing currently throttles
  repeated failed password or OTP attempts.
- **No session revocation list.** A session token is valid until it
  expires; there's no server-side way to invalidate one early (e.g. "sign
  out my other devices").
- **Encryption at rest** depends entirely on the hosting platform (Vercel
  manages TLS in transit); there is no application-level encryption of the
  in-memory store, because there's no persistent store yet to encrypt.

## Credential rotation

Every seeded demo account (`src/seedData.auth.ts`) has its own distinct
password and OTP code, listed there directly, and none of them has a real
phone/SMS provider behind it. Replace every seed literal with a real
hashed-password + dynamic-OTP flow backed by a persistent store, set real
`SMS_PROVIDER_*`/`EMAIL_PROVIDER_*` credentials, and set a strong random
`SESSION_SECRET` before any deployment handling real resident data.
