// This file is the entire CareHomeOS API — every non-AI /api/* route and
// all in-memory state — with zero dependency on Vite, dev-server
// middleware, or static-file serving. That separation is deliberate and
// load-bearing: api/index.ts (Vercel's serverless entry point) imports
// createApiApp() from here directly, so the Vercel function's dependency
// graph never touches server.ts at all — not even the parts of server.ts
// that only *run* in local dev (the `if (NODE_ENV !== 'production')`
// branch), because merely being *importable* from the same file as
// createApiApp() was enough for Vercel's function bundler to have to
// reason about that code. Keep it this way: nothing in this file should
// ever import 'vite', reference `dist/`, or otherwise assume a persistent
// process — that all belongs in server.ts's startServer(), which wraps
// this file's createApiApp() for local dev and traditional Node hosts
// (Cloud Run, a VM, etc.).
//
// Authentication is two layers, both enforced here server-side (see
// SECURITY.md): username + password gets a short-lived pending_2fa token,
// then a one-time code to phone or email exchanges that for a real session
// token. Every route below except /api/health and /api/auth/* requires a
// valid session — see requireAuth().
import express from 'express';
import {
  INITIAL_ORGANIZATION,
  INITIAL_HOME,
  INITIAL_RULESET,
  INITIAL_STAFF,
  INITIAL_SHIFTS,
  INITIAL_SHIFT_ASSIGNMENTS,
  INITIAL_PROSPECTS,
  INITIAL_RESIDENTS,
  INITIAL_CARE_PLANS,
  INITIAL_REASSESSMENTS,
  INITIAL_MED_ORDERS,
  INITIAL_MED_ADMINS,
  INITIAL_DAILY_REPORTS,
  INITIAL_SHIFT_CHECKLISTS,
  INITIAL_INCIDENTS,
  INITIAL_AUDIT_EVENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_TASK_DEFINITIONS,
  INITIAL_SHIFT_TASK_TEMPLATES,
} from './seedData';
import { SEED_USERNAMES, SEED_PASSWORD_HASHES, SEED_MUST_CHANGE_PASSWORD } from './seedData.auth';
import {
  AuditEvent,
  IncidentReport,
  MedicationAdministration,
  DailyReport,
  ShiftChecklist,
  Reassessment,
  Resident,
  Prospect,
  Staff,
  TaskDefinition,
  ShiftTaskTemplate,
  ShiftTaskAssignment,
} from './types';
import { ensureShiftTasksGenerated } from './shiftTasks';
import { computeExceptions } from './exceptions';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  generateOtpCode,
  generateResetToken,
} from './lib/auth';
import { sendSms, sendEmail, maskPhone, maskEmail } from './services/notificationDeliveryService';

// Persisted review state for a computed exception, keyed by the exception's
// deterministic id (see src/exceptions.ts). Exceptions themselves are never
// stored — they're recomputed fresh from live data on every read — but once
// a Manager/Owner reviews one, that decision needs to stick across reads.
export interface ExceptionReview {
  status: 'acknowledged' | 'resolved';
  reviewed_by: string;
  reviewed_by_name: string;
  reviewed_at: string;
  corrective_action: string | null;
}

// In-memory data store mimicking relational Postgres tables. Exported so
// server.ts (local dev / Cloud Run only) can pass the same live reference
// into registerAiRoutes() — see src/aiRoutes.ts's file header for why that
// file is never imported from here directly.
export let dbState = {
  organization: { ...INITIAL_ORGANIZATION },
  home: { ...INITIAL_HOME },
  ruleset: { ...INITIAL_RULESET },
  staff: [...INITIAL_STAFF],
  shifts: [...INITIAL_SHIFTS],
  shiftAssignments: [...INITIAL_SHIFT_ASSIGNMENTS],
  prospects: [...INITIAL_PROSPECTS],
  residents: [...INITIAL_RESIDENTS],
  carePlans: [...INITIAL_CARE_PLANS],
  reassessments: [...INITIAL_REASSESSMENTS],
  medOrders: [...INITIAL_MED_ORDERS],
  medAdmins: [...INITIAL_MED_ADMINS],
  dailyReports: [...INITIAL_DAILY_REPORTS],
  shiftChecklists: [...INITIAL_SHIFT_CHECKLISTS],
  incidents: [...INITIAL_INCIDENTS],
  auditEvents: [...INITIAL_AUDIT_EVENTS],
  notifications: [...INITIAL_NOTIFICATIONS],
  taskDefinitions: [...INITIAL_TASK_DEFINITIONS] as TaskDefinition[],
  shiftTaskTemplates: [...INITIAL_SHIFT_TASK_TEMPLATES] as ShiftTaskTemplate[],
  shiftTaskAssignments: [] as ShiftTaskAssignment[],
  exceptionReviews: {} as Record<string, ExceptionReview>,
};

export type DbState = typeof dbState;

// Helper: Append-only Event Logger. Exported for the same reason as
// dbState above — server.ts wires this into registerAiRoutes() for local
// dev / Cloud Run.
export function recordEvent(
  actorId: string,
  actorName: string,
  action: string,
  resourceType: string,
  resourceId: string,
  payload: Record<string, any>,
  priorEventId: string | null = null
): AuditEvent {
  const event: AuditEvent = {
    id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actor_id: actorId,
    actor_name: actorName,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    payload,
    prior_event_id: priorEventId,
    created_at: new Date().toISOString(),
  };
  dbState.auditEvents.unshift(event);
  return event;
}

// ==========================================
// AUTHENTICATION
// Two layers: username + password (layer one), then a one-time code to
// phone or email (layer two / the actual 2FA). See SECURITY.md.
//
// Everything in this block that's sensitive — password hashes, pending OTP
// codes, pending password-reset tokens — lives in module-level state here,
// NEVER inside dbState. dbState is what /api/state serializes wholesale to
// the client; anything added to it ships to the browser.
// ==========================================

const SESSION_SECRET = process.env.SESSION_SECRET || 'INSECURE-DEV-ONLY-SESSION-SECRET-CHANGE-ME';
if (!process.env.SESSION_SECRET) {
  console.warn('[SECURITY] SESSION_SECRET is not set. Using an insecure development default — set SESSION_SECRET before deploying.');
}

const PENDING_2FA_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

interface StaffAuthRecord {
  passwordHash: string;
  mustChangePassword: boolean;
}

// Seeded from src/seedData.auth.ts, mutated in place as passwords change
// (change-password / reset-password). Keyed by staff id.
const staffAuth: Record<string, StaffAuthRecord> = Object.fromEntries(
  Object.keys(SEED_PASSWORD_HASHES).map((staffId) => [
    staffId,
    { passwordHash: SEED_PASSWORD_HASHES[staffId], mustChangePassword: !!SEED_MUST_CHANGE_PASSWORD[staffId] },
  ])
);

interface PendingOtp {
  code: string;
  channel: 'sms' | 'email';
  destination: string;
  expiresAt: number;
  attempts: number;
}

// Keyed by staff id — one live OTP per staff member at a time; requesting a
// new one (send or resend) overwrites whatever was pending.
const pendingOtps = new Map<string, PendingOtp>();

interface PendingReset {
  staffId: string;
  expiresAt: number;
}

// Keyed by the single-use reset token itself.
const pendingResets = new Map<string, PendingReset>();

function findStaffByUsername(username: string): Staff | undefined {
  const needle = username.trim().toLowerCase();
  return dbState.staff.find((s) => s.username.toLowerCase() === needle);
}

function findStaffByEmail(email: string): Staff | undefined {
  const needle = email.trim().toLowerCase();
  return dbState.staff.find((s) => s.email.toLowerCase() === needle);
}

export interface AuthedRequest extends express.Request {
  staff?: Staff;
}

function getBearerToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

/** Guards every route that needs a real signed-in staff member. */
export function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const token = getBearerToken(req);
  const payload = verifyToken(token, SESSION_SECRET);
  if (!payload || payload.purpose !== 'session') {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const staffMember = dbState.staff.find((s) => s.id === payload.staffId);
  if (!staffMember) {
    return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
  }
  req.staff = staffMember;
  next();
}

/** Guards the OTP send/verify endpoints — accepts only a pending_2fa token
 * (issued by /api/auth/login after password verifies), never a full
 * session token, so a signed-in session can't be used to re-trigger OTPs
 * for a different account and a pending 2FA ticket can't be used as a
 * session elsewhere. */
function requirePendingAuth(req: AuthedRequest & { pendingStaffId?: string }, res: express.Response, next: express.NextFunction) {
  const token = getBearerToken(req);
  const payload = verifyToken(token, SESSION_SECRET);
  if (!payload || payload.purpose !== 'pending_2fa') {
    return res.status(401).json({ error: 'Verification session expired. Please sign in again.' });
  }
  const staffMember = dbState.staff.find((s) => s.id === payload.staffId);
  if (!staffMember) {
    return res.status(401).json({ error: 'Verification session is no longer valid. Please sign in again.' });
  }
  (req as any).pendingStaffId = staffMember.id;
  (req as any).pendingStaff = staffMember;
  next();
}

function requireRole(...roles: Array<Staff['role']>) {
  return (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      return res.status(403).json({ error: `This action requires one of the following roles: ${roles.join(', ')}.` });
    }
    next();
  };
}

/**
 * Rejects requests where the body claims to act as a different staff
 * member than the authenticated session — closes identity spoofing where a
 * mutating endpoint would otherwise trust a client-supplied staff id at
 * face value.
 */
function requireSelf(req: AuthedRequest, res: express.Response, claimedStaffId: string | undefined): boolean {
  if (claimedStaffId && req.staff && claimedStaffId !== req.staff.id) {
    res.status(403).json({ error: 'You may not perform this action on behalf of another staff member.' });
    return false;
  }
  return true;
}

/**
 * Builds the Express app containing every non-AI `/api/*` route. See the
 * file header above for why this lives in its own module: api/index.ts
 * (Vercel) imports this function directly, and server.ts's startServer()
 * (local dev / Cloud Run) wraps it with dev/prod frontend serving and
 * `app.listen()`.
 */
export function createApiApp(): express.Express {
  const app = express();

  app.use(express.json());

  // API: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      system: 'CareHomeOS v1.0',
      home: dbState.home.name,
      jurisdiction: dbState.home.jurisdiction_code,
    });
  });

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  // API: Layer one — username + password. On success, issues a short-lived
  // pending_2fa token (not a session) so the client can proceed to the OTP
  // step without a session existing yet.
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const staffMember = findStaffByUsername(username);
    const auth = staffMember ? staffAuth[staffMember.id] : undefined;

    // Constant-shape response whether the username doesn't exist or the
    // password is wrong — never reveal which one failed.
    if (!staffMember || !auth || !verifyPassword(password, auth.passwordHash)) {
      recordEvent('anonymous', username, 'LOGIN_FAILED', 'staff', staffMember?.id || 'unknown', { reason: 'invalid_credentials' });
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const pendingToken = createToken(
      { purpose: 'pending_2fa', staffId: staffMember.id, role: staffMember.role, homeId: staffMember.home_id },
      SESSION_SECRET,
      PENDING_2FA_TTL_SECONDS
    );

    recordEvent(staffMember.id, staffMember.name, 'LOGIN_PASSWORD_VERIFIED', 'staff', staffMember.id, {});
    res.json({
      success: true,
      pendingToken,
      staff: { name: staffMember.name, role: staffMember.role },
      contact: { maskedPhone: maskPhone(staffMember.phone), maskedEmail: maskEmail(staffMember.email) },
      mustChangePassword: auth.mustChangePassword,
    });
  });

  // API: Layer two, step 1 — send a one-time code to the chosen contact
  // method. Requires the pending_2fa token from /api/auth/login.
  app.post('/api/auth/otp/send', requirePendingAuth, async (req: any, res) => {
    const { channel } = req.body as { channel?: 'sms' | 'email' };
    if (channel !== 'sms' && channel !== 'email') {
      return res.status(400).json({ error: 'channel must be "sms" or "email".' });
    }
    const staffMember: Staff = req.pendingStaff;
    const destination = channel === 'sms' ? staffMember.phone : staffMember.email;
    const code = generateOtpCode();

    pendingOtps.set(staffMember.id, {
      code,
      channel,
      destination,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    const message = `Your CareHomeOS verification code is ${code}. It expires in 5 minutes.`;
    const result = channel === 'sms' ? await sendSms(destination, message) : await sendEmail(destination, 'Your CareHomeOS verification code', message);

    if (!result.success) {
      return res.status(502).json({ error: `Could not send the code by ${channel === 'sms' ? 'text' : 'email'}. Try the other option.` });
    }

    res.json({
      success: true,
      maskedDestination: channel === 'sms' ? maskPhone(destination) : maskEmail(destination),
      // Only ever present when no real provider is configured — see
      // notificationDeliveryService.ts. A configured deployment never
      // returns the code in the response body.
      devCode: result.devMode ? code : undefined,
    });
  });

  // API: Layer two, step 2 — verify the code and issue a real session.
  app.post('/api/auth/otp/verify', requirePendingAuth, (req: any, res) => {
    const { code } = req.body as { code?: string };
    const staffMember: Staff = req.pendingStaff;
    const pending = pendingOtps.get(staffMember.id);

    if (!pending || Date.now() > pending.expiresAt) {
      return res.status(401).json({ error: 'That code has expired. Request a new one.' });
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      pendingOtps.delete(staffMember.id);
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }
    if (code !== pending.code) {
      pending.attempts += 1;
      return res.status(401).json({ error: 'Incorrect code.' });
    }

    pendingOtps.delete(staffMember.id);
    const auth = staffAuth[staffMember.id];
    const token = createToken(
      { purpose: 'session', staffId: staffMember.id, role: staffMember.role, homeId: staffMember.home_id },
      SESSION_SECRET,
      SESSION_TTL_SECONDS
    );

    recordEvent(staffMember.id, staffMember.name, 'LOGIN_SUCCESS', 'staff', staffMember.id, { channel: pending.channel });
    res.json({ success: true, token, staff: staffMember, mustChangePassword: auth?.mustChangePassword ?? false });
  });

  // API: Resolve the current session
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ staff: req.staff });
  });

  // API: Logout (primarily client-side token discard; recorded for audit)
  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    recordEvent(req.staff!.id, req.staff!.name, 'LOGOUT', 'staff', req.staff!.id, {});
    res.json({ success: true });
  });

  // API: Change password while signed in (also clears mustChangePassword —
  // this is what the forced first-login password change calls).
  app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    const auth = staffAuth[req.staff!.id];
    if (!currentPassword || !verifyPassword(currentPassword, auth?.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    staffAuth[req.staff!.id] = { passwordHash: hashPassword(newPassword), mustChangePassword: false };
    recordEvent(req.staff!.id, req.staff!.name, 'PASSWORD_CHANGED', 'staff', req.staff!.id, {});
    res.json({ success: true });
  });

  // API: Set a new password when mustChangePassword is true (e.g. right
  // after signing in with a temporary, system-generated password). Doesn't
  // require the current password — a full username+password+2FA sign-in
  // already just proved identity — but only works while mustChangePassword
  // is actually set, so it can't be used to silently reset an established
  // password without knowing it.
  app.post('/api/auth/set-initial-password', requireAuth, (req: AuthedRequest, res) => {
    const auth = staffAuth[req.staff!.id];
    if (!auth?.mustChangePassword) {
      return res.status(400).json({ error: 'A password change is not required for this account.' });
    }
    const { newPassword } = req.body as { newPassword?: string };
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    staffAuth[req.staff!.id] = { passwordHash: hashPassword(newPassword), mustChangePassword: false };
    recordEvent(req.staff!.id, req.staff!.name, 'PASSWORD_CHANGED', 'staff', req.staff!.id, {});
    res.json({ success: true });
  });

  // API: Forgot username — always returns a generic success regardless of
  // whether the email matches an account, so this endpoint can't be used
  // to enumerate valid staff emails.
  app.post('/api/auth/forgot-username', async (req, res) => {
    const { email } = req.body as { email?: string };
    if (email) {
      const staffMember = findStaffByEmail(email);
      if (staffMember) {
        await sendEmail(
          staffMember.email,
          'Your CareHomeOS username',
          `Your username is ${staffMember.username}. If you didn't request this, you can ignore this email.`
        );
        recordEvent(staffMember.id, staffMember.name, 'USERNAME_RECOVERY_SENT', 'staff', staffMember.id, {});
      }
    }
    res.json({ success: true, message: "If that email matches an account, we've sent a username reminder." });
  });

  // API: Forgot password — same non-revealing shape as forgot-username. A
  // real deployment would email a reset link containing this token; here
  // the token itself is the "instructions" delivered by sendEmail (see
  // notificationDeliveryService's dev-mode console log).
  app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body as { email?: string };
    if (email) {
      const staffMember = findStaffByEmail(email);
      if (staffMember) {
        const token = generateResetToken();
        pendingResets.set(token, { staffId: staffMember.id, expiresAt: Date.now() + RESET_TOKEN_TTL_MS });
        await sendEmail(
          staffMember.email,
          'Reset your CareHomeOS password',
          `Use this one-time reset token in the app within 30 minutes: ${token}. If you didn't request this, you can ignore this email.`
        );
        recordEvent(staffMember.id, staffMember.name, 'PASSWORD_RESET_REQUESTED', 'staff', staffMember.id, {});
      }
    }
    res.json({ success: true, message: "If that email matches an account, we've sent password reset instructions." });
  });

  // API: Complete a password reset with the token from forgot-password.
  app.post('/api/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token) return res.status(400).json({ error: 'Reset token is required.' });
    const pending = pendingResets.get(token);
    if (!pending || Date.now() > pending.expiresAt) {
      return res.status(401).json({ error: 'That reset link has expired. Request a new one.' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    staffAuth[pending.staffId] = { passwordHash: hashPassword(newPassword), mustChangePassword: false };
    pendingResets.delete(token);
    const staffMember = dbState.staff.find((s) => s.id === pending.staffId);
    if (staffMember) {
      recordEvent(staffMember.id, staffMember.name, 'PASSWORD_RESET_COMPLETED', 'staff', staffMember.id, {});
    }
    res.json({ success: true });
  });

  // API: Get Full State (Scoped to current home_id; requires an authenticated session)
  app.get('/api/state', requireAuth, (req, res) => {
    res.json(dbState);
  });

  // API: Clock In / Clock Out
  app.post('/api/shifts/clock', requireAuth, (req: AuthedRequest, res) => {
    const { staffId, shiftId, action } = req.body;
    if (!requireSelf(req, res, staffId)) return;
    const staffMember = dbState.staff.find((s) => s.id === staffId);
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    let assignment = dbState.shiftAssignments.find(
      (a) => a.staff_id === staffId && a.is_active
    );

    if (action === 'clock_in') {
      if (!assignment) {
        assignment = {
          id: `assign-${Date.now()}`,
          staff_id: staffId,
          shift_id: shiftId || 'shift-day-today',
          date: new Date().toISOString().split('T')[0],
          clocked_in_at: new Date().toISOString(),
          clocked_out_at: null,
          is_active: true,
        };
        dbState.shiftAssignments.push(assignment);
      }
      recordEvent(staffId, staffMember.name, 'CLOCK_IN', 'shift_assignments', assignment.id, {
        shift_id: assignment.shift_id,
        clocked_in_at: assignment.clocked_in_at,
      });
      return res.json({ success: true, assignment });
    } else {
      if (assignment) {
        assignment.clocked_out_at = new Date().toISOString();
        assignment.is_active = false;
        recordEvent(staffId, staffMember.name, 'CLOCK_OUT', 'shift_assignments', assignment.id, {
          clocked_out_at: assignment.clocked_out_at,
        });
      }
      return res.json({ success: true, assignment });
    }
  });

  // API: Convert Prospect to Resident (Lifecycle Spine)
  app.post('/api/prospects/convert', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { prospectId, roomNumber, levelOfCare, actorId } = req.body;
    if (!requireSelf(req, res, actorId)) return;
    const actorName = req.staff!.name;

    const prospect = dbState.prospects.find((p) => p.id === prospectId);
    if (!prospect) {
      return res.status(404).json({ error: 'Prospect not found' });
    }

    prospect.pipeline_stage = 'Move-in';

    const newResident: Resident = {
      id: `res-${Date.now()}`,
      home_id: dbState.home.id,
      prospect_id: prospect.id,
      full_name: prospect.full_name,
      room_number: roomNumber || '114',
      dob: '1946-05-10',
      age: prospect.age,
      status: 'active',
      admission_date: new Date().toISOString().split('T')[0],
      level_of_care: levelOfCare || 'Level 2',
      funding_status: prospect.funding_status,
      emergency_contact: {
        name: 'Family Contact',
        relationship: 'Primary Kin',
        phone: prospect.contact_phone,
      },
      on_cigarette_program: false,
      primary_physician: 'Dr. Katherine Mercer',
      allergies: ['No known drug allergies (NKDA)'],
    };

    dbState.residents.unshift(newResident);

    // Create initial reassessment scheduled 6 months out (NL compliance standard)
    const reassessmentDate = new Date();
    reassessmentDate.setMonth(reassessmentDate.getMonth() + 6);
    const newReassessment: Reassessment = {
      id: `reassess-${Date.now()}`,
      resident_id: newResident.id,
      due_date: reassessmentDate.toISOString().split('T')[0],
      completed_date: null,
      completed_by: null,
      status: 'scheduled',
      outcome_notes: 'Initial 6-month comprehensive reassessment per CA-NL Operational Standards',
      resulting_care_plan_id: null,
    };
    dbState.reassessments.unshift(newReassessment);

    recordEvent(req.staff!.id, actorName, 'PROSPECT_CONVERTED', 'residents', newResident.id, {
      prospect_id: prospect.id,
      resident_name: newResident.full_name,
      room: newResident.room_number,
    });

    res.json({ success: true, resident: newResident, prospect });
  });

  // API: eMAR Administer Medication
  app.post('/api/emar/administer', requireAuth, (req: AuthedRequest, res) => {
    const { orderId, residentId, shiftId, administeredBy, administeredByName, doseGiven, status, notes, scheduledTime } = req.body;
    if (!requireSelf(req, res, administeredBy)) return;

    const administration: MedicationAdministration = {
      id: `med-adm-${Date.now()}`,
      order_id: orderId,
      resident_id: residentId,
      shift_id: shiftId || 'shift-day-today',
      administered_by: administeredBy,
      administered_by_name: administeredByName,
      timestamp: new Date().toISOString(),
      scheduled_time: scheduledTime || '08:00',
      dose_given: doseGiven,
      status: status || 'given',
      notes: notes || '',
      is_correction: false,
    };

    dbState.medAdmins.unshift(administration);

    recordEvent(administeredBy, administeredByName, 'MEDICATION_ADMINISTERED', 'medication_administrations', administration.id, {
      order_id: orderId,
      resident_id: residentId,
      dose_given: doseGiven,
      status: administration.status,
      notes: administration.notes,
    });

    res.json({ success: true, administration });
  });

  // API: Daily Report Submit / Update
  app.post('/api/daily-reports', requireAuth, (req: AuthedRequest, res) => {
    const reportData: DailyReport = req.body;
    if (!requireSelf(req, res, reportData.authored_by)) return;
    const existingIndex = dbState.dailyReports.findIndex(
      (r) => r.resident_id === reportData.resident_id && r.date === reportData.date
    );

    if (existingIndex >= 0) {
      if (dbState.dailyReports[existingIndex].status === 'submitted') {
        return res.status(403).json({ error: 'Submitted daily reports are locked. Use correction event.' });
      }
      dbState.dailyReports[existingIndex] = { ...reportData };
    } else {
      dbState.dailyReports.unshift(reportData);
    }

    if (reportData.status === 'submitted') {
      recordEvent(reportData.authored_by, reportData.authored_by_name, 'DAILY_REPORT_SUBMITTED', 'daily_reports', reportData.id, {
        resident_id: reportData.resident_id,
        date: reportData.date,
        shower_taken: reportData.shower_taken,
        cigarette_count: reportData.cigarette_count,
      });
    }

    res.json({ success: true, report: reportData });
  });

  // API: Shift Checklist (Medication Storage Secured - NL AG Finding)
  app.post('/api/shift-checklists', requireAuth, (req: AuthedRequest, res) => {
    const checklist: ShiftChecklist = req.body;
    if (!requireSelf(req, res, checklist.completed_by)) return;
    dbState.shiftChecklists.unshift(checklist);

    recordEvent(checklist.completed_by, checklist.completed_by_name, 'SHIFT_CHECKLIST_COMPLETED', 'shift_checklists', checklist.id, {
      medication_storage_secured: checklist.medication_storage_secured,
      medication_count_verified: checklist.medication_count_verified,
      fridge_temp_celsius: checklist.fridge_temp_celsius,
    });

    res.json({ success: true, checklist });
  });

  // API: Incident Submit (Draft -> Submitted)
  app.post('/api/incidents/submit', requireAuth, (req: AuthedRequest, res) => {
    const incidentData: IncidentReport = req.body;
    if (!requireSelf(req, res, incidentData.reported_by)) return;
    const existingIndex = dbState.incidents.findIndex((i) => i.id === incidentData.id);

    if (existingIndex >= 0) {
      dbState.incidents[existingIndex] = { ...incidentData, status: 'submitted' };
    } else {
      incidentData.status = 'submitted';
      dbState.incidents.unshift(incidentData);
    }

    // Immediate notification to Owner & Manager regardless of time
    const notification: any = {
      id: `notif-${Date.now()}`,
      recipient_role: 'Manager',
      recipient_name: 'Olatundun Ndudim',
      channel: incidentData.severity === 'Critical' ? 'push' : 'in_app',
      title: `🚨 Incident Report: ${incidentData.incident_type} (${incidentData.severity})`,
      body: `${incidentData.reported_by_name} submitted report for resident ${incidentData.resident_id}: "${incidentData.description.slice(0, 100)}..."`,
      created_at: new Date().toISOString(),
      read: false,
      urgency: incidentData.severity === 'Critical' ? 'critical' : 'high',
    };
    dbState.notifications.unshift(notification);

    recordEvent(incidentData.reported_by, incidentData.reported_by_name, 'INCIDENT_SUBMITTED', 'incident_reports', incidentData.id, {
      incident_type: incidentData.incident_type,
      severity: incidentData.severity,
      resident_id: incidentData.resident_id,
      type_details: incidentData.type_details,
    });

    res.json({ success: true, incident: incidentData });
  });

  // API: Incident Review (Approve / Reject) with SEGREGATION OF DUTIES
  app.post('/api/incidents/review', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { incidentId, action, rejectionReason } = req.body;
    const reviewerId = req.staff!.id;
    const reviewerName = req.staff!.name;
    const reviewerRole = req.staff!.role;

    const incident = dbState.incidents.find((i) => i.id === incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Segregation of duties check: Reviewer CANNOT be the author!
    if (incident.reported_by === reviewerId) {
      return res.status(403).json({
        error: 'Segregation of duties violation: The reviewer cannot be the author who reported the incident.',
      });
    }

    if (action === 'approve') {
      incident.status = 'approved';
      incident.reviewed_by = reviewerId;
      incident.reviewed_by_name = reviewerName;
      incident.reviewed_at = new Date().toISOString();
      incident.rejection_reason = null;

      recordEvent(reviewerId, reviewerName, 'INCIDENT_APPROVED', 'incident_reports', incident.id, {
        reviewer_role: reviewerRole,
      });
    } else if (action === 'reject') {
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        return res.status(400).json({ error: 'A rejection reason is strictly required when rejecting an incident report.' });
      }
      incident.status = 'rejected';
      incident.reviewed_by = reviewerId;
      incident.reviewed_by_name = reviewerName;
      incident.reviewed_at = new Date().toISOString();
      incident.rejection_reason = rejectionReason;

      recordEvent(reviewerId, reviewerName, 'INCIDENT_REJECTED', 'incident_reports', incident.id, {
        rejection_reason: rejectionReason,
      });
    } else if (action === 'return_to_draft') {
      incident.status = 'draft';
      recordEvent(reviewerId, reviewerName, 'INCIDENT_REOPENED_FOR_EDIT', 'incident_reports', incident.id, {});
    }

    res.json({ success: true, incident });
  });

  // API: Complete Reassessment (NL AG finding backlog clearance)
  app.post('/api/reassessments/complete', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { reassessmentId, completedBy, outcomeNotes, newCarePlanCreated } = req.body;
    if (!requireSelf(req, res, completedBy)) return;

    const reassessment = dbState.reassessments.find((r) => r.id === reassessmentId);
    if (!reassessment) {
      return res.status(404).json({ error: 'Reassessment not found' });
    }

    reassessment.status = 'completed';
    reassessment.completed_date = new Date().toISOString().split('T')[0];
    reassessment.completed_by = completedBy;
    reassessment.outcome_notes = outcomeNotes;

    recordEvent(req.staff!.id, req.staff!.name, 'REASSESSMENT_COMPLETED', 'reassessments', reassessment.id, {
      outcome_notes: outcomeNotes,
      resident_id: reassessment.resident_id,
      new_care_plan_created: !!newCarePlanCreated,
    });

    res.json({ success: true, reassessment });
  });

  // ==========================================
  // SCHEDULING & SHARED SHIFT TASKS
  // ==========================================

  // API: Task catalog (owner-configurable list of task types that can occur
  // on a shift, e.g. "Assist with Shower", "Medication Pass").
  app.get('/api/task-definitions', requireAuth, (req, res) => {
    res.json({ taskDefinitions: dbState.taskDefinitions });
  });

  // API: Create or update a task definition. Owner-only — this is the
  // catalog every home's shift task setup draws from.
  app.post('/api/task-definitions', requireAuth, requireRole('Owner'), (req: AuthedRequest, res) => {
    const { taskDefinition } = req.body as { taskDefinition: TaskDefinition };
    const actor = req.staff!;

    const existingIndex = dbState.taskDefinitions.findIndex((t) => t.id === taskDefinition.id);
    if (existingIndex >= 0) {
      dbState.taskDefinitions[existingIndex] = { ...taskDefinition, home_id: dbState.home.id };
    } else {
      taskDefinition.id = taskDefinition.id || `task-${Date.now()}`;
      taskDefinition.home_id = dbState.home.id;
      dbState.taskDefinitions.push(taskDefinition);
    }

    recordEvent(actor.id, actor.name, existingIndex >= 0 ? 'TASK_DEFINITION_UPDATED' : 'TASK_DEFINITION_CREATED', 'task_definitions', taskDefinition.id, {
      name: taskDefinition.name,
      is_active: taskDefinition.is_active,
    });

    res.json({ success: true, taskDefinition });
  });

  // API: Which tasks occur on which shift type — this is the "owner should
  // be able to adjust tasks" control surface.
  app.get('/api/shift-task-templates', requireAuth, (req, res) => {
    res.json({ shiftTaskTemplates: dbState.shiftTaskTemplates });
  });

  app.post('/api/shift-task-templates', requireAuth, requireRole('Owner'), (req: AuthedRequest, res) => {
    const { shiftTaskTemplate } = req.body as { shiftTaskTemplate: ShiftTaskTemplate };
    const actor = req.staff!;

    const existingIndex = dbState.shiftTaskTemplates.findIndex((t) => t.id === shiftTaskTemplate.id);
    if (existingIndex >= 0) {
      dbState.shiftTaskTemplates[existingIndex] = { ...shiftTaskTemplate, home_id: dbState.home.id };
    } else {
      shiftTaskTemplate.id = shiftTaskTemplate.id || `stt-${Date.now()}`;
      shiftTaskTemplate.home_id = dbState.home.id;
      dbState.shiftTaskTemplates.push(shiftTaskTemplate);
    }

    recordEvent(actor.id, actor.name, existingIndex >= 0 ? 'SHIFT_TASK_TEMPLATE_UPDATED' : 'SHIFT_TASK_TEMPLATE_CREATED', 'shift_task_templates', shiftTaskTemplate.id, {
      shift_type: shiftTaskTemplate.shift_type,
      task_definition_id: shiftTaskTemplate.task_definition_id,
      is_active: shiftTaskTemplate.is_active,
    });

    res.json({ success: true, shiftTaskTemplate });
  });

  // API: The shared task board for a given date (defaults to today).
  // Generates today's task instances on first read of the day, from
  // whichever staff are actually scheduled — see src/shiftTasks.ts.
  app.get('/api/shift-tasks', requireAuth, (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    ensureShiftTasksGenerated(dbState, date);
    const tasks = dbState.shiftTaskAssignments.filter((t) => t.date === date);
    res.json({ shiftTasks: tasks });
  });

  // API: Claim an unclaimed task (self-organizing shift duties — whoever
  // picks it up owns it until completed or skipped).
  app.post('/api/shift-tasks/:id/claim', requireAuth, (req: AuthedRequest, res) => {
    const { staffId } = req.body as { staffId: string };
    if (!requireSelf(req, res, staffId)) return;
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'pending') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'claimed';
    task.claimed_by = req.staff!.id;
    task.claimed_by_name = req.staff!.name;
    res.json({ success: true, task });
  });

  // API: Mark a task complete.
  app.post('/api/shift-tasks/:id/complete', requireAuth, (req: AuthedRequest, res) => {
    const { staffId, notes } = req.body as { staffId: string; notes?: string };
    if (!requireSelf(req, res, staffId)) return;
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status === 'completed' || task.status === 'skipped') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'completed';
    task.completed_by = req.staff!.id;
    task.completed_by_name = req.staff!.name;
    task.completed_at = new Date().toISOString();
    task.notes = notes || task.notes;

    recordEvent(req.staff!.id, req.staff!.name, 'SHIFT_TASK_COMPLETED', 'shift_task_assignments', task.id, {
      task_name: task.task_name,
      resident_id: task.resident_id,
    });

    res.json({ success: true, task });
  });

  // API: Skip a task with a required reason (feeds the exception if it
  // shouldn't have been skippable, but keeps the record honest either way).
  app.post('/api/shift-tasks/:id/skip', requireAuth, (req: AuthedRequest, res) => {
    const { staffId, reason } = req.body as { staffId: string; reason: string };
    if (!requireSelf(req, res, staffId)) return;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to skip a task.' });
    }
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status === 'completed' || task.status === 'skipped') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'skipped';
    task.completed_by = req.staff!.id;
    task.completed_by_name = req.staff!.name;
    task.completed_at = new Date().toISOString();
    task.notes = reason.trim();

    recordEvent(req.staff!.id, req.staff!.name, 'SHIFT_TASK_SKIPPED', 'shift_task_assignments', task.id, {
      task_name: task.task_name,
      resident_id: task.resident_id,
      reason: task.notes,
    });

    res.json({ success: true, task });
  });

  // ==========================================
  // EXCEPTIONS — detected automatically, not hand-filed. See src/exceptions.ts.
  // ==========================================

  app.get('/api/exceptions', requireAuth, (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    ensureShiftTasksGenerated(dbState, date);
    res.json({ exceptions: computeExceptions(dbState) });
  });

  // API: Acknowledge or resolve an exception, optionally logging a
  // corrective action. Manager/Owner only.
  app.post('/api/exceptions/:id/review', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { status, correctiveAction } = req.body as {
      status: 'acknowledged' | 'resolved';
      correctiveAction?: string;
    };
    const actor = req.staff!;
    if (status !== 'acknowledged' && status !== 'resolved') {
      return res.status(400).json({ error: 'status must be "acknowledged" or "resolved".' });
    }

    dbState.exceptionReviews[req.params.id] = {
      status,
      reviewed_by: actor.id,
      reviewed_by_name: actor.name,
      reviewed_at: new Date().toISOString(),
      corrective_action: correctiveAction?.trim() || null,
    };

    recordEvent(actor.id, actor.name, status === 'resolved' ? 'EXCEPTION_RESOLVED' : 'EXCEPTION_ACKNOWLEDGED', 'exceptions', req.params.id, {
      corrective_action: correctiveAction || null,
    });

    res.json({ success: true, exceptions: computeExceptions(dbState) });
  });

  return app;
}

/**
 * Safety-net error handler: converts any error that reaches it (a
 * synchronous throw in a route handler, or an explicit next(err) call)
 * into a clean JSON 500 instead of Express's default HTML error page.
 * That distinction matters concretely here — the client always does
 * `await res.json()` on the response, and parsing an HTML error page
 * throws a SyntaxError that surfaces as a generic "Could not reach the
 * server" message, hiding the real failure.
 *
 * A separate function rather than something createApiApp() registers
 * itself, because Express identifies error-handling middleware by arity
 * alone and requires it be registered LAST, after every route — and some
 * callers (server.ts, mounting registerAiRoutes() afterwards for local
 * dev) add more routes after calling createApiApp(). Call this only once
 * every route this app will ever have is registered.
 */
export function attachSafetyNetErrorHandler(app: express.Express): void {
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[api] Unhandled error on ${req.method} ${req.path}:`, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'An unexpected server error occurred.', detail: err?.message || String(err) });
  });
}
