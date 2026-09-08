// This file is the entire CareHomeOS API — every /api/* route, all in-memory
// state, auth, and integrations — with zero dependency on Vite, dev-server
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
import express from 'express';
import dotenv from 'dotenv';
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
  INITIAL_SHIFT_TEMPLATES,
  INITIAL_TIME_ENTRIES,
  INITIAL_SHIFT_CHANGE_REQUESTS,
} from './seedData';
import { SEED_PASSWORD_HASHES, SEED_MFA_DEMO_CODE } from './seedData.auth';
import { verifyPassword, createSessionToken, verifySessionToken } from './lib/auth';
import { syncTimeEntryToQuickBooksTime, verifyQuickBooksWebhookSignature } from './services/quickbooksTimeService';
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
  TimeEntry,
  TimeEntryType,
  ShiftTemplate,
  ShiftChangeRequest,
  ShiftChangeRequestType,
} from './types';

dotenv.config();

// Session signing secret. MUST be overridden via env in any real deployment —
// see SECURITY.md "Secrets Management". The fallback exists only so the
// prototype boots without configuration; it is intentionally obvious so it's
// never mistaken for a real secret.
const SESSION_SECRET = process.env.SESSION_SECRET || 'INSECURE-DEV-ONLY-SESSION-SECRET-CHANGE-ME';
if (!process.env.SESSION_SECRET) {
  console.warn('[SECURITY] SESSION_SECRET is not set. Using an insecure development default — set SESSION_SECRET before deploying.');
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
  shiftTemplates: [...INITIAL_SHIFT_TEMPLATES],
  timeEntries: [...INITIAL_TIME_ENTRIES],
  shiftChangeRequests: [...INITIAL_SHIFT_CHANGE_REQUESTS],
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
};

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
// AUTHENTICATION & AUTHORIZATION
// See SECURITY.md for the full design (password hashing, session tokens,
// MFA, rate limiting) and its production hardening checklist.
// ==========================================

export interface AuthedRequest extends express.Request {
  staff?: Staff;
}

function getBearerToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

export function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const token = getBearerToken(req);
  const payload = verifySessionToken(token, SESSION_SECRET);
  if (!payload) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const staffMember = dbState.staff.find((s) => s.id === payload.staffId);
  if (!staffMember) {
    return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
  }
  req.staff = staffMember;
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
 * Rejects requests where the body claims to act as a different staff member
 * than the authenticated session. Closes the identity-spoofing hole in the
 * original prototype, where every mutating endpoint trusted a client-supplied
 * staff id at face value.
 */
function requireSelf(req: AuthedRequest, res: express.Response, claimedStaffId: string | undefined): boolean {
  if (claimedStaffId && req.staff && claimedStaffId !== req.staff.id) {
    res.status(403).json({ error: 'You may not perform this action on behalf of another staff member.' });
    return false;
  }
  return true;
}

// ==========================================
// TIME ENTRIES (append-only punch ledger, separate from the shift_assignment
// "current status" projection) + QuickBooks Time sync
// ==========================================

async function recordTimeEntry(
  staffId: string,
  shiftAssignmentId: string | null,
  entryType: TimeEntryType,
  source: TimeEntry['source'] = 'app'
): Promise<TimeEntry> {
  const entry: TimeEntry = {
    id: `time-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    home_id: dbState.home.id,
    staff_id: staffId,
    shift_assignment_id: shiftAssignmentId,
    entry_type: entryType,
    timestamp: new Date().toISOString(),
    source,
    is_corrected: false,
    corrected_by: null,
    correction_reason: null,
    qbo_synced: false,
    qbo_sync_id: null,
    qbo_sync_error: null,
  };
  dbState.timeEntries.unshift(entry);

  const syncResult = await syncTimeEntryToQuickBooksTime(entry);
  entry.qbo_synced = syncResult.success;
  entry.qbo_sync_id = syncResult.qboId || null;
  entry.qbo_sync_error = syncResult.error || null;

  return entry;
}

/**
 * Builds the Express app containing every `/api/*` route. See the file
 * header above for why this lives in its own module: api/index.ts (Vercel)
 * imports this function directly, and server.ts's startServer() (local
 * dev / Cloud Run) wraps it with dev/prod frontend serving and
 * `app.listen()`.
 */
export function createApiApp(): express.Express {
  const app = express();

  // Capture the raw request body alongside the parsed JSON so webhook
  // handlers (e.g. QuickBooks Time) can verify an HMAC signature against the
  // exact bytes Intuit signed, not a re-serialized copy.
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString('utf-8');
      },
    })
  );

  // API: Health check (no auth — carries no PHI)
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

  // API: Login (email + password, MFA code required on the second step for
  // any account with mfa_enabled). See SECURITY.md for the full flow and its
  // production hardening checklist (rate limiting/lockout, real MFA/TOTP
  // provider, httpOnly cookie transport).
  app.post('/api/auth/login', async (req, res) => {
    const { email, password, mfaCode } = req.body as { email?: string; password?: string; mfaCode?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const staffMember = dbState.staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
    const passwordHash = staffMember ? SEED_PASSWORD_HASHES[staffMember.id] : undefined;

    // Constant-shape response whether the email doesn't exist or the
    // password is wrong — never reveal which one failed.
    if (!staffMember || !verifyPassword(password, passwordHash)) {
      recordEvent('anonymous', email, 'LOGIN_FAILED', 'staff', staffMember?.id || 'unknown', { reason: 'invalid_credentials' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (staffMember.mfa_enabled) {
      if (!mfaCode) {
        return res.status(401).json({ mfaRequired: true, error: 'Enter the 6-digit verification code for your account.' });
      }
      if (mfaCode !== SEED_MFA_DEMO_CODE) {
        recordEvent(staffMember.id, staffMember.name, 'LOGIN_FAILED', 'staff', staffMember.id, { reason: 'invalid_mfa_code' });
        return res.status(401).json({ mfaRequired: true, error: 'Incorrect verification code.' });
      }
    }

    const token = createSessionToken(
      { staffId: staffMember.id, role: staffMember.role, homeId: staffMember.home_id },
      SESSION_SECRET
    );

    recordEvent(staffMember.id, staffMember.name, 'LOGIN_SUCCESS', 'staff', staffMember.id, {});
    res.json({ success: true, token, staff: staffMember });
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

  // API: Get Full State (Scoped to current home_id; requires an authenticated session)
  app.get('/api/state', requireAuth, (req, res) => {
    res.json(dbState);
  });

  // API: Clock In / Clock Out
  app.post('/api/shifts/clock', requireAuth, async (req: AuthedRequest, res) => {
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
      const timeEntry = await recordTimeEntry(staffId, assignment.id, 'clock_in');
      return res.json({ success: true, assignment, timeEntry });
    } else {
      let timeEntry: TimeEntry | undefined;
      if (assignment) {
        assignment.clocked_out_at = new Date().toISOString();
        assignment.is_active = false;
        recordEvent(staffId, staffMember.name, 'CLOCK_OUT', 'shift_assignments', assignment.id, {
          clocked_out_at: assignment.clocked_out_at,
        });
        timeEntry = await recordTimeEntry(staffId, assignment.id, 'clock_out');
      }
      return res.json({ success: true, assignment, timeEntry });
    }
  });

  // API: Convert Prospect to Resident (Lifecycle Spine)
  app.post('/api/prospects/convert', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { prospectId, roomNumber, levelOfCare, actorId, actorName } = req.body;
    if (!requireSelf(req, res, actorId)) return;

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

    recordEvent(req.staff!.id, req.staff!.name, 'PROSPECT_CONVERTED', 'residents', newResident.id, {
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
    const { incidentId, reviewerId, reviewerName, reviewerRole, action, rejectionReason } = req.body;
    if (!requireSelf(req, res, reviewerId)) return;

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

    recordEvent(completedBy, 'Staff', 'REASSESSMENT_COMPLETED', 'reassessments', reassessment.id, {
      outcome_notes: outcomeNotes,
      resident_id: reassessment.resident_id,
      new_care_plan_created: !!newCarePlanCreated,
    });

    res.json({ success: true, reassessment });
  });

  // ==========================================
  // SCHEDULING: time_entries, shift_templates, shift_change_requests
  // ==========================================

  // API: List time entries (own entries for Care Workers; full roster for
  // Manager/Owner) — the append-only punch ledger behind payroll/QuickBooks
  // Time sync.
  app.get('/api/time-entries', requireAuth, (req: AuthedRequest, res) => {
    const isManager = req.staff!.role === 'Manager' || req.staff!.role === 'Owner';
    const entries = isManager
      ? dbState.timeEntries
      : dbState.timeEntries.filter((t) => t.staff_id === req.staff!.id);
    res.json({ timeEntries: entries });
  });

  // API: Record a time entry punch. Staff may only punch for themselves;
  // recording a punch on someone else's behalf is a correction and is
  // restricted to Manager/Owner with a mandatory reason.
  app.post('/api/time-entries', requireAuth, async (req: AuthedRequest, res) => {
    const { staffId, shiftAssignmentId, entryType, correctionReason } = req.body as {
      staffId: string;
      shiftAssignmentId: string | null;
      entryType: TimeEntryType;
      correctionReason?: string;
    };

    const isOwnEntry = staffId === req.staff!.id;
    const isManager = req.staff!.role === 'Manager' || req.staff!.role === 'Owner';

    if (!isOwnEntry && !isManager) {
      return res.status(403).json({ error: 'Only a Manager or Owner may record a time entry correction for another staff member.' });
    }
    if (!isOwnEntry && (!correctionReason || !correctionReason.trim())) {
      return res.status(400).json({ error: 'A correction reason is required when recording a time entry for another staff member.' });
    }

    const targetStaff = dbState.staff.find((s) => s.id === staffId);
    if (!targetStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const entry: TimeEntry = {
      id: `time-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      home_id: dbState.home.id,
      staff_id: staffId,
      shift_assignment_id: shiftAssignmentId || null,
      entry_type: entryType,
      timestamp: new Date().toISOString(),
      source: isOwnEntry ? 'app' : 'manual_correction',
      is_corrected: !isOwnEntry,
      corrected_by: isOwnEntry ? null : req.staff!.id,
      correction_reason: isOwnEntry ? null : correctionReason!.trim(),
      qbo_synced: false,
      qbo_sync_id: null,
      qbo_sync_error: null,
    };
    dbState.timeEntries.unshift(entry);

    const syncResult = await syncTimeEntryToQuickBooksTime(entry);
    entry.qbo_synced = syncResult.success;
    entry.qbo_sync_id = syncResult.qboId || null;
    entry.qbo_sync_error = syncResult.error || null;

    recordEvent(req.staff!.id, req.staff!.name, isOwnEntry ? 'TIME_ENTRY_RECORDED' : 'TIME_ENTRY_CORRECTED', 'time_entries', entry.id, {
      staff_id: staffId,
      entry_type: entryType,
      correction_reason: entry.correction_reason,
    });

    res.json({ success: true, timeEntry: entry });
  });

  // API: List shift templates (reference data — visible to all authenticated staff)
  app.get('/api/shift-templates', requireAuth, (req, res) => {
    res.json({ shiftTemplates: dbState.shiftTemplates });
  });

  // API: Create or update a shift template (Manager/Owner only)
  app.post('/api/shift-templates', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const templateData: ShiftTemplate = req.body;
    const existingIndex = dbState.shiftTemplates.findIndex((t) => t.id === templateData.id);

    if (existingIndex >= 0) {
      dbState.shiftTemplates[existingIndex] = { ...templateData };
    } else {
      templateData.id = templateData.id || `template-${Date.now()}`;
      templateData.home_id = dbState.home.id;
      dbState.shiftTemplates.unshift(templateData);
    }

    recordEvent(req.staff!.id, req.staff!.name, existingIndex >= 0 ? 'SHIFT_TEMPLATE_UPDATED' : 'SHIFT_TEMPLATE_CREATED', 'shift_templates', templateData.id, {
      name: templateData.name,
    });

    res.json({ success: true, shiftTemplate: templateData });
  });

  // API: List shift change requests (own requests for Care Workers; all
  // pending + own for Manager/Owner so approvals are visible)
  app.get('/api/shift-change-requests', requireAuth, (req: AuthedRequest, res) => {
    const isManager = req.staff!.role === 'Manager' || req.staff!.role === 'Owner';
    const requests = isManager
      ? dbState.shiftChangeRequests
      : dbState.shiftChangeRequests.filter((r) => r.requested_by === req.staff!.id);
    res.json({ shiftChangeRequests: requests });
  });

  // API: Submit a shift change request (swap / cover / time off). A worker
  // may only request a change against their own shift assignment.
  app.post('/api/shift-change-requests', requireAuth, (req: AuthedRequest, res) => {
    const { shiftAssignmentId, requestType, targetStaffId, reason } = req.body as {
      shiftAssignmentId: string;
      requestType: ShiftChangeRequestType;
      targetStaffId: string | null;
      reason: string;
    };

    const assignment = dbState.shiftAssignments.find((a) => a.id === shiftAssignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Shift assignment not found.' });
    }
    if (assignment.staff_id !== req.staff!.id) {
      return res.status(403).json({ error: 'You may only request a change against your own shift.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required.' });
    }

    const targetStaff = targetStaffId ? dbState.staff.find((s) => s.id === targetStaffId) : undefined;

    const request: ShiftChangeRequest = {
      id: `change-req-${Date.now()}`,
      home_id: dbState.home.id,
      shift_assignment_id: shiftAssignmentId,
      requested_by: req.staff!.id,
      requested_by_name: req.staff!.name,
      request_type: requestType,
      target_staff_id: targetStaff?.id || null,
      target_staff_name: targetStaff?.name || null,
      reason: reason.trim(),
      status: 'pending',
      reviewed_by: null,
      reviewed_by_name: null,
      reviewed_at: null,
      review_notes: null,
      created_at: new Date().toISOString(),
    };
    dbState.shiftChangeRequests.unshift(request);

    recordEvent(req.staff!.id, req.staff!.name, 'SHIFT_CHANGE_REQUESTED', 'shift_change_requests', request.id, {
      request_type: requestType,
      shift_assignment_id: shiftAssignmentId,
      target_staff_id: request.target_staff_id,
    });

    res.json({ success: true, request });
  });

  // API: Review a shift change request — Manager/Owner only, with
  // segregation of duties (a manager cannot approve their own request).
  app.post('/api/shift-change-requests/:id/review', requireAuth, requireRole('Manager', 'Owner'), (req: AuthedRequest, res) => {
    const { action, reviewNotes } = req.body as { action: 'approve' | 'deny'; reviewNotes?: string };
    const request = dbState.shiftChangeRequests.find((r) => r.id === req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Shift change request not found.' });
    }
    if (request.requested_by === req.staff!.id) {
      return res.status(403).json({
        error: 'Segregation of duties violation: you cannot approve or deny your own shift change request.',
      });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({ error: `This request has already been ${request.status}.` });
    }

    request.status = action === 'approve' ? 'approved' : 'denied';
    request.reviewed_by = req.staff!.id;
    request.reviewed_by_name = req.staff!.name;
    request.reviewed_at = new Date().toISOString();
    request.review_notes = reviewNotes?.trim() || null;

    // A swap/cover approval reassigns the underlying shift to the target
    // staff member. Time off approvals leave the assignment for the
    // manager to re-staff separately.
    if (action === 'approve' && request.target_staff_id && (request.request_type === 'swap' || request.request_type === 'cover')) {
      const assignment = dbState.shiftAssignments.find((a) => a.id === request.shift_assignment_id);
      if (assignment) {
        assignment.staff_id = request.target_staff_id;
      }
    }

    recordEvent(req.staff!.id, req.staff!.name, action === 'approve' ? 'SHIFT_CHANGE_APPROVED' : 'SHIFT_CHANGE_DENIED', 'shift_change_requests', request.id, {
      review_notes: request.review_notes,
    });

    res.json({ success: true, request });
  });

  // ==========================================
  // QUICKBOOKS TIME INTEGRATION
  // ==========================================

  // API: Manually trigger a sync pass over unsynced time entries
  // (Manager/Owner only). A production deployment would run this on a
  // schedule instead of on demand.
  app.post('/api/integrations/quickbooks-time/sync', requireAuth, requireRole('Manager', 'Owner'), async (req: AuthedRequest, res) => {
    const unsynced = dbState.timeEntries.filter((t) => !t.qbo_synced);
    let syncedCount = 0;

    for (const entry of unsynced) {
      const result = await syncTimeEntryToQuickBooksTime(entry);
      entry.qbo_synced = result.success;
      entry.qbo_sync_id = result.qboId || null;
      entry.qbo_sync_error = result.error || null;
      if (result.success) syncedCount += 1;
    }

    recordEvent(req.staff!.id, req.staff!.name, 'QUICKBOOKS_TIME_SYNC_TRIGGERED', 'time_entries', 'bulk', {
      attempted: unsynced.length,
      synced: syncedCount,
    });

    res.json({ success: true, attempted: unsynced.length, synced: syncedCount });
  });

  // API: Inbound QuickBooks Time webhook. Verified via HMAC signature — see
  // src/services/quickbooksTimeService.ts. No session auth applies here;
  // trust is established entirely by the signature check.
  app.post('/api/integrations/quickbooks-time/webhook', (req: express.Request & { rawBody?: string }, res) => {
    const signature = req.headers['x-qbtime-signature'] as string | undefined;
    if (!verifyQuickBooksWebhookSignature(req.rawBody || '', signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    // TODO(go-live): map the verified payload to time entry sync-status
    // updates once this organization's QuickBooks Time webhook schema is
    // finalized.
    recordEvent('system-quickbooks-time', 'QuickBooks Time', 'QUICKBOOKS_WEBHOOK_RECEIVED', 'integration_events', 'qbo-webhook', {});
    res.json({ received: true });
  });

  return app;
}

/**
 * Safety-net error handler: converts any error that reaches it (a
 * synchronous throw in a route handler, or an explicit next(err) call)
 * into a clean JSON 500 instead of Express's default HTML error page.
 * That distinction matters concretely here — the client always does
 * `await res.json()` on the response (see src/App.tsx / LoginView.tsx),
 * and parsing an HTML error page throws a SyntaxError that surfaces as a
 * generic "Could not reach the server" message, hiding the real failure
 * exactly as happened during the Vercel deployment issues above.
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
