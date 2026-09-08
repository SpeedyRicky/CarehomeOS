# CareHomeOS — Security

## Authentication: demo login, checked entirely client-side

Login is a two-step UI (username + password, then a 6-digit code to phone
or email) but there is **no server-side credential check at all**. Both
steps are verified in the browser in `src/components/LoginView.tsx`
against a fixed `DEMO_ACCOUNTS` table — each of the 5 seeded staff members
has their own distinct, hardcoded password and OTP code, visible directly
in that file (and offered as one-click "Quick sign in" buttons on the
login screen for demo convenience).

### Why this is client-side instead of a real server-checked login

This wasn't the first version. An earlier build hashed passwords with
scrypt and generated a random OTP code per attempt, checked server-side
and exchanged for a cryptographically signed session token — a real,
if still prototype-grade, two-factor flow. It worked in local testing but
failed unpredictably once deployed to Vercel, and a second attempt that
replaced the dynamic per-login secrets with fixed hardcoded ones (to rule
out Vercel's serverless functions losing in-memory state between the
login → otp/send → otp/verify requests) *still* failed on the live
deployment. Since the underlying cause of that failure was never
conclusively identified from outside Vercel's own function logs, the
reliable fix was to remove the server round trip from login entirely:
nothing that happens only in the browser can be broken by however the
Vercel Node function handles requests.

### What the token is now

Every other route (`/api/state`, `/api/shifts/clock`, etc.) still requires
`Authorization: Bearer <token>` via `requireAuth` in `src/apiApp.ts` — but
the token is simply the signed-in staff member's own id. `LoginView.tsx`
sets it directly once it has checked the hardcoded credentials in the
browser, with no server call needed to obtain it, and `requireAuth` just
confirms that id names a real staff member. There is no signature, no
expiry, and no real proof of identity here — anyone who guesses or
inspects a staff id could construct a valid token by hand. That's an
acceptable trade for a demo with fixed, publicly-visible passwords anyway;
it would not be for a deployment handling real resident data (see below).

## Identity spoofing (`requireSelf`)

Being "authenticated" only proves the bearer token names a real staff id,
not that a request body's claimed staff id matches it. Every mutating
endpoint that represents "an action I am personally taking" (clocking in,
administering a medication, submitting a daily report, claiming a shift
task, etc.) calls `requireSelf(req, res, claimedId)`, which 403s if the
body's id doesn't match `req.staff.id`. Endpoints that determine a
*caller's* authorization level (Owner-only task catalog edits,
Manager/Owner incident review) read the role from `req.staff` — set by
`requireAuth` — never from a client-supplied field.

## What's still a prototype

- **No real login.** Every credential is a fixed, public literal checked
  in the browser; the bearer token used for every other API call is just
  a staff id with no signature or expiry. Replace with a real
  server-checked credential store, dynamically-issued single-use OTP
  codes, and a signed session token before handling real resident data.
- **In-memory `dbState`.** All application data lives in process memory —
  a restart or Vercel cold start clears every write made since boot. Move
  to a real database before production; see `src/apiApp.ts`'s file header
  for the Vercel serverless implication (each cold start is a fresh,
  empty-of-writes copy).
- **No rate limiting or lockout** on any endpoint.
- **No session revocation.** A token (staff id) is valid indefinitely;
  there's no server-side way to invalidate one.
- **Encryption at rest** depends entirely on the hosting platform (Vercel
  manages TLS in transit); there is no application-level encryption of the
  in-memory store, because there's no persistent store yet to encrypt.

## Credential rotation

Every seeded demo account and its password/OTP code are hardcoded
literals in `src/components/LoginView.tsx`'s `DEMO_ACCOUNTS`, visible to
anyone who opens the browser's dev tools — that's expected for this demo.
Replace all of it with real, server-checked, non-public credentials before
any deployment handling real resident data.
