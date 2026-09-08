# CareHomeOS — Security

## Authentication: two layers

1. **Username + password** (`POST /api/auth/login`) — scrypt-hashed
   passwords (`src/lib/auth.ts`), checked with a constant-shape response
   whether the username doesn't exist or the password is wrong, so a
   failed attempt never reveals which one was incorrect. On success this
   issues a **pending_2fa token** — not a session — valid for 5 minutes.
2. **One-time code to phone or email** (`POST /api/auth/otp/send` then
   `POST /api/auth/otp/verify`) — the actual second factor. A verified
   code exchanges the pending_2fa token for a real **session token**
   (12-hour TTL).

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

## OTP delivery

`src/services/notificationDeliveryService.ts` sends codes via SMS or
email, gated entirely on whether `SMS_PROVIDER_*` / `EMAIL_PROVIDER_*` env
vars are configured (see `.env.example`). Unconfigured, it runs in **dev
mode**: the code is logged server-side and also returned to the client as
`devCode` in the `/api/auth/otp/send` response, so the whole flow is
testable without a paid provider account. **A configured deployment never
returns the code in the API response** — set the provider env vars before
any real deployment.

## Password reset / username recovery

`POST /api/auth/forgot-username` and `POST /api/auth/forgot-password`
always return the same generic success message regardless of whether the
supplied email matches an account — this endpoint cannot be used to
enumerate valid staff emails. A password reset delivers a single-use,
30-minute token by email; `POST /api/auth/reset-password` consumes it.

New accounts (and password resets) can be provisioned with
`mustChangePassword: true`; `POST /api/auth/set-initial-password` lets a
signed-in session set a first real password without re-proving the
temporary one — reasonable because reaching that endpoint already required
a full username+password+2FA sign-in.

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

- **In-memory state.** `dbState`, `staffAuth`, `pendingOtps`, and
  `pendingResets` all live in process memory — a restart clears every
  session, pending OTP, and password change made since boot. Move to a
  real database before production; see `ARCHITECTURE.md`-equivalent notes
  in `src/apiApp.ts`'s file header for the Vercel serverless implication
  (each cold start is a fresh, empty-of-writes copy).
- **No login rate limiting or lockout.** `staffAuth`/`pendingOtps` don't
  currently throttle repeated failed password or OTP attempts beyond the
  per-OTP 5-attempt cap.
- **No session revocation list.** A session token is valid until it
  expires; there's no server-side way to invalidate one early (e.g. "sign
  out my other devices").
- **Encryption at rest** depends entirely on the hosting platform (Vercel
  manages TLS in transit); there is no application-level encryption of the
  in-memory store, because there's no persistent store yet to encrypt.

## Credential rotation

Every seeded demo account (`src/seedData.auth.ts`) shares the password
`demo123` and has no real phone/SMS provider behind it. Replace every seed
hash, set real `SMS_PROVIDER_*`/`EMAIL_PROVIDER_*` credentials, and set a
strong random `SESSION_SECRET` before any deployment handling real
resident data.
