# CareHomeOS — Security & Privacy Framework

CareHomeOS handles **personal health information (PHI)** for residents of a
Newfoundland & Labrador personal care home and is governed primarily by:

- **PHIA** — the *Personal Health Information Act* (NL, in force 2011,
  amended since), which regulates collection, use, disclosure, retention,
  and disposal of personal health information by a "custodian" (Hi Haven
  Manor, as the licensed personal care home) and any information manager or
  service provider it engages (including this software and any third-party
  processor it calls).
- The **CA-NL Personal Care Home Operational Standards** already modeled in
  `JurisdictionRuleset` (reassessment cadence, credential requirements,
  incident retention).

This document is written as a working control framework, not a compliance
certificate — items marked **prototype limitation** are real gaps this
codebase has today and must be closed before handling real resident data.

## 1. Authentication

- **Password storage**: scrypt (Node's built-in, OWASP-recommended KDF),
  random 16-byte salt per credential, `salt:derivedKey` format —
  `src/lib/auth.ts`. Never store or log plaintext passwords.
- **MFA**: every seeded account has `mfa_enabled: true`. The current second
  factor is a **static demo code** (`src/seedData.auth.ts`,
  `SEED_MFA_DEMO_CODE`) — **prototype limitation**: replace with a real
  TOTP (authenticator app) or SMS/push provider (e.g., Twilio Verify)
  before any production use of accounts with real PHI access.
- **Sessions**: a minimal HMAC-SHA256 signed token (`src/lib/auth.ts`,
  `createSessionToken`/`verifySessionToken`) carrying `staffId`, `role`,
  `homeId`, and a 12-hour expiry. Transported today as a bearer token
  stored in `localStorage` — **prototype limitation**: move to an httpOnly,
  `Secure`, `SameSite=Strict` cookie so the token is never reachable from
  JavaScript (removes the XSS-exfiltration path `localStorage` has by
  design).
- **Rate limiting / lockout**: not yet implemented — **prototype
  limitation**. Add per-account and per-IP throttling on
  `POST /api/auth/login` before production (failed attempts are already
  audit-logged as `LOGIN_FAILED`, which a rate limiter can key off of).
- **Secrets management**: `SESSION_SECRET` must be a long random value from
  a secrets manager (not `.env` in source control) in any real deployment;
  the server logs a warning and falls back to an obviously-fake value if
  unset, specifically so that fallback is never mistaken for a real secret.
- **Credential rotation**: every seeded account shares one demo password
  (`Demo@CareHome1`) purely for this prototype/demo. Before go-live: force
  a password reset for every account, rotate `SESSION_SECRET` (which
  invalidates all sessions), and remove the "Demo/reviewer sign-in
  reference" panel from `LoginView.tsx`.

## 2. Authorization

- **RBAC**: `Role = 'Care Worker' | 'Manager' | 'Owner'`. Care Workers are
  denied the Reassessments, CRM, and Compliance tabs client-side (UX) *and*
  the corresponding mutating endpoints server-side via `requireRole()` (the
  authority — never trust the client-side tab hiding alone).
- **Identity spoofing closed**: every mutating endpoint that accepts a
  "who did this" field (`staffId`, `administeredBy`, `reportedBy`,
  `completedBy`, `actorId`, …) now runs `requireSelf()`, rejecting the
  request with 403 if the claimed id doesn't match the authenticated
  session. Before this change, any authenticated (or even unauthenticated)
  client could submit an incident, administer medication, or complete a
  reassessment *as any other staff member* just by changing a JSON field —
  this was the most serious gap found in the original prototype.
- **Segregation of duties**: enforced for incident review (a reviewer
  cannot be the reporter) and now also for shift-change-request review (a
  Manager/Owner cannot approve/deny their own request) — both checks live
  server-side, not just in the UI.
- **Least privilege on scheduling**: a worker may only submit a
  shift-change request against a `ShiftAssignment` that is their own
  (`assignment.staff_id === req.staff.id`); recording a `TimeEntry` for
  someone else requires Manager/Owner role and a mandatory correction
  reason, and is flagged `is_corrected: true` in the ledger.

## 3. Audit logging

Every state-changing action (clock in/out, medication administration,
incident submit/review, reassessment completion, shift-change request and
review, login success/failure, logout) writes an immutable `AuditEvent` —
`actor_id`, `actor_name`, `action`, `resource_type`, `resource_id`,
`payload`, `created_at`. This satisfies PHIA's expectation that a custodian
can produce an access/disclosure trail for PHI. **Prototype limitation**:
events live in the same in-memory array as everything else; production
needs this in an append-only table (or a separate log store) with
retention independent of the operational data it describes, per the
retention schedule below.

## 4. AI processing & PHIA (third-party disclosure minimization)

The AI features (`/api/ai/shift-handover`, `/api/ai/compliance-audit`,
`/api/ai/ask-audit`) call Google's Gemini API — a third-party processor.
**There is no signed Data Processing Agreement or PHIA-compliant
information-sharing agreement with Google for this deployment**, so PHIA's
"minimum necessary" principle applies strictly: no resident's legal name,
or any identifier that embeds one, may reach an outbound prompt.

Two concrete leaks existed in the original prototype and are fixed in this
change:

1. `/api/ai/ask-audit` serialized `{ id: r.id, name: r.full_name, ... }`
   for every resident directly into the Gemini prompt (`JSON.stringify`).
   Fixed by redacting the entire outbound context object through
   `redactKnownResidentNames()` before it's stringified into the prompt.
2. Several endpoints referenced `resident_id` values shaped like
   `res-arthur-walsh` — the seed data's internal ids embed the resident's
   name, so passing the "id" through was itself a name leak. Fixed by
   replacing every resident reference in an outbound prompt with
   `residentAlias()` (a room-number-based alias, e.g. `Resident-Rm101`)
   via `residentAliasById()`.

`redactKnownResidentNames()` also scrubs free-text fields (incident
descriptions, daily-report observations) for literal occurrences of a
resident's full name or name parts before they reach a prompt. This is a
regex-based safety net, not NLP-grade de-identification — **residual risk**:
a staff member can still write identifying detail into free text in ways
the scrubber won't catch (e.g. a nickname, or identifying context without
a name). Two complementary mitigations, not yet implemented:

- Obtain a Google Cloud data-processing addendum before using AI features
  against real resident data, and/or
- Add staff-facing guidance/training to reference residents by room number
  in any free-text field that might be summarized by AI.

The local fallback (`generateFallback()` in each AI endpoint, used when
Gemini is unavailable) intentionally keeps real names — that text is
generated and rendered entirely server/client-side and never leaves this
process, so it carries no third-party disclosure risk.

## 5. QuickBooks Time integration security

- **Data minimization by construction**: `TimeEntry` (the only object this
  integration touches) has no resident or clinical field — only
  `staff_id`, `entry_type`, `timestamp`. There is no path for PHI to reach
  QuickBooks Time.
- **Credentials**: OAuth client id/secret and access/refresh tokens are
  read from environment variables only (`QBO_TIME_*`), never hardcoded.
  Store them in a secrets manager in production, with refresh-token
  rotation handled server-side.
- **Webhook authenticity**: inbound webhooks are verified via HMAC
  signature (`verifyQuickBooksWebhookSignature`) against the raw request
  body (captured via Express's `verify` hook specifically so the signature
  check runs against the exact bytes Intuit signed, not a re-serialized
  copy). An unverified or missing signature is rejected with 401 before any
  payload processing.
- **Fail-safe when unconfigured**: `isQuickBooksTimeConfigured()` gates all
  sync attempts; with no OAuth credentials present the integration simply
  leaves entries `qbo_synced: false` rather than erroring the request that
  triggered them (clocking in/out never fails because payroll sync is
  down).

## 6. Data retention & disposal

`JurisdictionRuleset.rules.incident_report_retention_years` already encodes
the CA-NL-driven retention period for incident reports. PHIA requires a
custodian to retain personal health information only as long as reasonably
necessary and to dispose of it securely afterward. **Prototype
limitation**: retention is not yet enforced anywhere — no job purges or
archives expired records. Before production, add a scheduled process that,
per record type, archives-then-deletes (or anonymizes) records past their
retention window, and log the disposal itself as an `AuditEvent`.

## 7. Breach response

Not yet implemented in-app. PHIA requires notifying affected individuals
(and, above a threshold, the Newfoundland & Labrador Information and
Privacy Commissioner) of a breach involving personal health information.
Before production, this organization should designate a Privacy Officer,
document a breach response procedure, and — from this system's side —
ensure the audit log (Section 3) is complete and tamper-evident enough to
support a breach investigation (who accessed what, when).

## 8. Known prototype limitations (summary)

For quick reference, everything in this document flagged as a limitation:

- Static demo MFA code instead of a real TOTP/SMS provider.
- Session token in `localStorage`/bearer header instead of an httpOnly
  cookie.
- No login rate limiting or account lockout.
- Shared demo password across all seeded accounts.
- Audit log is in-memory, not a durable/independent append-only store.
- No automated retention/disposal enforcement.
- No formal breach-response tooling or designated Privacy Officer workflow.
- Single-process, in-memory data store (see ARCHITECTURE.md "Prototype →
  Production").
- AI free-text redaction is regex-based, not a substitute for a signed
  data-processing agreement with the AI provider.

None of these block continued development or demoing the product — they're
the explicit checklist for the gap between "working prototype" and
"handling a real resident's PHI in production."
