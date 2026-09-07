# CareHomeOS — Architecture

CareHomeOS is a shift-scoped operations system for small personal care
homes, built first for Hi Haven Manor Inc. (St. John's, NL). This document
describes the current prototype's architecture and the additions made to
support staff login, shift-partner visibility, time & attendance, and
payroll integration.

## Stack

- **Client**: React 19 + Vite, Tailwind, `lucide-react` icons. Single-page
  app (`src/App.tsx`) with tab-based navigation, no router.
- **Server**: Express (`server.ts`), exposed two ways:
  - As a persistent Node process (`startServer()`, used for local dev and
    any traditional host like Cloud Run) that also serves the built client
    bundle.
  - As a Vercel serverless function (`api/[...all].ts`, `vercel.json`),
    which imports `createApiApp()` — the same route definitions with no
    dev-server/static-file logic attached — since Vercel serves the built
    frontend from its own CDN and only needs the API routes. **Vercel
    limitation**: each serverless invocation may be a fresh cold start, so
    `dbState` (see below) does not reliably persist writes across requests
    there. Login itself is unaffected (credentials are static seed data);
    treat a Vercel deployment as a login/UI demo until the data layer
    moves to a real database.
- **Data store**: an in-memory object (`dbState` in `server.ts`) seeded from
  `src/seedData.ts`, structured to mirror a relational schema 1:1. There is
  no database yet — see "Prototype → Production" below.
- **AI**: Google Gemini via `@google/genai`, used only for read-only
  summarization (shift handover briefs, compliance audit narratives, a
  natural-language Q&A assistant). No AI call has a write path back into
  `dbState`.

## Data model

Each `INITIAL_*` export in `src/seedData.ts` is a stand-in for a Postgres
table, keyed by `id`, scoped by `home_id` (and `organization_id` one level
up, for future multi-home tenancy).

Core entities (pre-existing): `Organization`, `Home`, `JurisdictionRuleset`,
`Staff`, `Shift`, `ShiftAssignment`, `Prospect`, `Resident`, `CarePlan`,
`Reassessment`, `MedicationOrder`, `MedicationAdministration`, `DailyReport`,
`ShiftChecklist`, `IncidentReport`, `AuditEvent`, `NotificationItem`.

Scheduling entities (added in this change):

| Entity | Purpose |
|---|---|
| `ShiftTemplate` | The recurring definition a `Shift`/`ShiftAssignment` is generated from — name, time window, `days_of_week`, `required_staff_count`, `required_credential_types`. Lets a manager define "Day Shift needs 2 staff, one of whom holds a valid Vulnerable Sector Check" once instead of per-instance. |
| `TimeEntry` | An append-only punch ledger (`clock_in` / `clock_out` / `break_start` / `break_end`), separate from `ShiftAssignment`'s "current status" fields. `ShiftAssignment.clocked_in_at/out_at` remains the fast-path projection the UI reads; `TimeEntry` is the audit-grade, correctable source of truth that feeds payroll. Carries `qbo_synced` / `qbo_sync_id` / `qbo_sync_error` for the QuickBooks Time integration. |
| `ShiftChangeRequest` | A worker-initiated swap, cover, or time-off request against one of their own `ShiftAssignment`s, with Manager/Owner approval (segregation of duties: a reviewer can never be the requester). Approving a `swap`/`cover` reassigns the underlying `ShiftAssignment.staff_id`. |

Relationships:

```
Organization 1─* Home 1─* Staff
Home 1─* ShiftTemplate
Home 1─* Shift ─* ShiftAssignment *─1 Staff
ShiftAssignment 1─* TimeEntry
ShiftAssignment 1─* ShiftChangeRequest ─1 Staff (requester) ─1 Staff (target, optional)
Home 1─* Resident (via Prospect pipeline) 1─* CarePlan / Reassessment / MedicationOrder / DailyReport / IncidentReport
```

## Shift-partner visibility

There is no `partner_staff_id` column anywhere — a "partner" isn't a stored
relationship, it's derived at read time: for a given `ShiftAssignment`,
any other `ShiftAssignment` with the same `shift_id` and `date` (excluding
the viewer) is a shift partner. See `getPartners()` in
`src/components/ScheduleView.tsx`. This keeps the data model normalized
(adding/removing a partner is just adding/removing a `ShiftAssignment` row)
and generalizes past pairs to any staffing ratio a template calls for.

## Component map

- `src/components/LoginView.tsx` — the auth gate. Renders until a session
  token exists; see SECURITY.md for the auth design.
- `src/components/Header.tsx` — top nav, clock in/out, notifications, and
  the signed-in account menu (replaces the old free-form "switch active
  staff" demo control, which bypassed authentication by design).
- `src/components/ScheduleView.tsx` — "My Schedule" tab: upcoming shifts
  with partner visibility, inline shift-change-request submission, a
  Manager/Owner approval queue, and a personal time-entry ledger.
- `src/components/TodayView.tsx`, `EMARView.tsx`, `IncidentsView.tsx`,
  `ResidentsView.tsx`, `ReassessmentsView.tsx`, `CRMView.tsx`,
  `ComplianceView.tsx`, `AuditLogView.tsx`, `AIAssistantView.tsx` —
  pre-existing modules, unchanged in shape.

## Server-only modules

These must never be imported from a client-bundled file (component, hook,
or `App.tsx`) — Vite would otherwise pull `node:crypto` and credential
material into the browser bundle:

- `src/lib/auth.ts` — password hashing (scrypt) and session token
  signing/verification (HMAC-SHA256).
- `src/seedData.auth.ts` — seed credential store (password hashes, demo MFA
  code), kept out of `seedData.ts` specifically so it never reaches the
  client bundle that `App.tsx` imports `seedData.ts` into.
- `src/services/quickbooksTimeService.ts` — the QuickBooks Time integration
  layer (see below).

## API surface

All endpoints below except `/api/health`, `/api/auth/login`, and the
QuickBooks Time webhook require `Authorization: Bearer <token>`.

| Endpoint | Notes |
|---|---|
| `POST /api/auth/login` | Email + password, then MFA code if `mfa_enabled`. |
| `GET /api/auth/me` | Resolve the current session. |
| `POST /api/auth/logout` | Audit-logs the logout. |
| `GET /api/state` | Full org snapshot (single-home prototype scope). |
| `POST /api/shifts/clock` | Clock in/out; also writes a `TimeEntry`. |
| `GET/POST /api/time-entries` | Punch ledger; Manager/Owner see all staff, others see only their own. |
| `GET/POST /api/shift-templates` | Reference/CRUD, Manager/Owner write. |
| `GET/POST /api/shift-change-requests` | Worker submits against their own shift. |
| `POST /api/shift-change-requests/:id/review` | Manager/Owner approve/deny; segregation of duties enforced. |
| `POST /api/integrations/quickbooks-time/sync` | Manual sync trigger (Manager/Owner). |
| `POST /api/integrations/quickbooks-time/webhook` | Inbound webhook, HMAC-verified, no session auth. |
| `POST /api/emar/administer`, `/api/daily-reports`, `/api/shift-checklists`, `/api/incidents/submit`, `/api/incidents/review`, `/api/reassessments/complete`, `/api/prospects/convert` | Pre-existing clinical/operational endpoints; now require auth and verify the caller isn't acting as another staff member. |
| `POST /api/ai/shift-handover`, `/api/ai/compliance-audit`, `/api/ai/ask-audit` | Read-only AI summarization; resident identity is redacted before any prompt reaches Gemini — see SECURITY.md. |

## QuickBooks Time integration layer

`src/services/quickbooksTimeService.ts` is the single seam between
`TimeEntry` and QuickBooks Time (Intuit TSheets). It is a **scaffold**: the
functions are shaped exactly like the real TSheets REST API calls but the
`fetch()` bodies are stubbed pending this organization's OAuth 2.0 app
registration. `isQuickBooksTimeConfigured()` gates everything on whether
`QBO_TIME_*` env vars are present, so the app runs safely with the
integration fully disabled (every `TimeEntry` just stays
`qbo_synced: false` with a clear `qbo_sync_error`).

Only `staff_id`, `entry_type`, and `timestamp` ever cross this boundary —
no resident or clinical field is reachable from a `TimeEntry` by
construction, so the integration carries no PHI disclosure risk regardless
of configuration state.

## Prototype → production migration notes

This app is still a single-process, in-memory prototype. Before any real
deployment:

1. **Persistence**: replace `dbState` with Postgres (the schema above maps
   almost directly to tables) and a real ORM/query layer with row-level
   `home_id` scoping enforced in SQL, not just in application code.
2. **Multi-home scoping**: `/api/state` currently returns the entire
   dataset for the one seeded home. A real deployment serving multiple
   homes needs every query scoped by the caller's `home_id`, not just the
   UI hiding tabs.
3. **Session transport**: move the session token from `localStorage` +
   `Authorization` header to an httpOnly, `Secure`, `SameSite=Strict`
   cookie, to remove it from JavaScript's reach entirely (see
   SECURITY.md).
4. **Realtime**: shift swap approvals currently take effect on the next
   `/api/state` refresh. A production system should push the update (SSE
   or WebSocket) so an affected worker's schedule updates live.

See `SECURITY.md` for the authentication, authorization, and PHIA
compliance framework this architecture is built to support.
