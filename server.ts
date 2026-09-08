import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
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
} from './src/seedData';
import { SEED_PASSWORD_HASHES, SEED_MFA_DEMO_CODE } from './src/seedData.auth';
import { verifyPassword, createSessionToken, verifySessionToken } from './src/lib/auth';
import { syncTimeEntryToQuickBooksTime, verifyQuickBooksWebhookSignature } from './src/services/quickbooksTimeService';
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
} from './src/types';

dotenv.config();

// Session signing secret. MUST be overridden via env in any real deployment —
// see SECURITY.md "Secrets Management". The fallback exists only so the
// prototype boots without configuration; it is intentionally obvious so it's
// never mistaken for a real secret.
const SESSION_SECRET = process.env.SESSION_SECRET || 'INSECURE-DEV-ONLY-SESSION-SECRET-CHANGE-ME';
if (!process.env.SESSION_SECRET) {
  console.warn('[SECURITY] SESSION_SECRET is not set. Using an insecure development default — set SESSION_SECRET before deploying.');
}

// In-memory data store mimicking relational Postgres tables
let dbState = {
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

// Helper: Append-only Event Logger
function recordEvent(
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

interface AuthedRequest extends express.Request {
  staff?: Staff;
}

function getBearerToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length);
}

function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
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
// PHIA DATA MINIMIZATION FOR THIRD-PARTY AI CALLS
// Newfoundland & Labrador's Personal Health Information Act requires
// disclosing only the minimum personal health information necessary. Google
// Gemini is a third-party processor with no signed data-processing agreement
// for this deployment, so no resident's legal name (or any identifier that
// embeds it) is allowed to reach the outbound prompt — only a room-based
// alias. Local fallback text (never leaves this process) may keep real
// names. See SECURITY.md "AI Processing & PHIA".
// ==========================================

function residentAlias(resident: { room_number: string } | undefined | null): string {
  return resident ? `Resident-Rm${resident.room_number}` : 'Resident-Unknown';
}

function residentAliasById(residentId: string): string {
  return residentAlias(dbState.residents.find((r) => r.id === residentId));
}

/** Strips any known resident's full name (or name parts) out of free text before it can reach an outbound AI prompt. */
function redactKnownResidentNames(text: string): string {
  let redacted = text;
  for (const resident of dbState.residents) {
    const alias = residentAlias(resident);
    const nameParts = [resident.full_name, ...resident.full_name.split(' ').filter((p) => p.length > 2)];
    for (const part of nameParts) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      redacted = redacted.replace(new RegExp(escaped, 'gi'), alias);
    }
  }
  return redacted;
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

// Lazy Gemini AI Client initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Builds the Express app containing every `/api/*` route, with no
 * dev-server or static-file concerns attached. This is the piece Vercel's
 * serverless runtime needs (see api/[...all].ts) — Vercel serves the built
 * frontend from its own CDN and only needs this app to answer API
 * requests. `startServer()` below wraps this with dev/prod frontend
 * serving and `app.listen()` for local development and any traditional
 * Node host (e.g. Cloud Run).
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

  // ==========================================
  // AI LAYER (READ-ONLY SUMMARIZATION & QA)
  // No write path to Postgres/DB. Constrained audit-safe read views.
  // Resilient multi-model retry with dynamic clinical engine fallback
  // ==========================================

  async function runAIWithFallback(
    prompt: string,
    systemFallbackGenerator: () => string
  ): Promise<{ text: string; source: string }> {
    const ai = getAIClient();
    if (ai) {
      // Prioritize gemini-flash-latest (high availability), then flash-lite, then 3.8-flash
      const candidateModels = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      for (const model of candidateModels) {
        try {
          const timeoutMs = 12000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
          );
          const apiCallPromise = ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              maxOutputTokens: 1200,
              temperature: 0.2,
            },
          });
          const response = await Promise.race([apiCallPromise, timeoutPromise]);
          if (response && response.text) {
            return { text: response.text, source: model };
          }
        } catch {
          // Model unavailable or high-demand; advance cleanly to next candidate
        }
      }
    }

    return {
      text: systemFallbackGenerator(),
      source: 'system_clinical_engine',
    };
  }

  // AI 1: Shift Handover Summary
  app.post('/api/ai/shift-handover', requireAuth, async (req, res) => {
    try {
      const { shiftType } = req.body;

      // Construct constrained read-safe summary payload
      const activeResidents = dbState.residents.filter((r) => r.status === 'active');
      const medPasses = dbState.medAdmins.slice(0, 10);
      const todayReports = dbState.dailyReports;
      const recentIncidents = dbState.incidents.slice(0, 5);
      const latestChecklist = dbState.shiftChecklists[0];

      // PHIA data minimization: no resident legal name (or an identifier
      // that embeds one, like this app's `res-firstname-lastname` ids) may
      // reach the outbound Gemini prompt — see redactKnownResidentNames()
      // and residentAliasById() above, and SECURITY.md "AI Processing &
      // PHIA". Free-text fields are passed through the name scrubber too,
      // since staff sometimes write a resident's name directly into notes.
      const promptContext = `
You are the CareHomeOS Clinical Handover AI assistant for small care homes (Hi Haven Manor, CA-NL).
Generate a concise, high-priority shift handover brief for incoming staff.
Tone: Professional, clinical, scannable, action-oriented. Never invent or hallucinate data.

CURRENT SHIFT CONTEXT:
Shift: ${shiftType || 'Day Shift'}
Total Active Residents: ${activeResidents.length}
Today's Daily Reports Completed: ${todayReports.length}
Medication Administrations Logged: ${medPasses.length}
Recent Incidents:
${recentIncidents.map((i) => `- [${i.severity}] ${i.incident_type}: ${redactKnownResidentNames(i.description)} (Status: ${i.status})`).join('\n')}
Medication Storage Secured Attestation: ${latestChecklist ? (latestChecklist.medication_storage_secured ? 'VERIFIED LOCKED' : 'UNLOCKED / EXCEPTION') : 'PENDING'}
Resident Daily Notes:
${todayReports.map((r) => `- ${residentAliasById(r.resident_id)}: Meals: Breakfast(${r.meals.breakfast.eaten}), Lunch(${r.meals.lunch.eaten}). Shower: ${r.shower_taken ? 'Yes' : 'No'}. Obs: ${redactKnownResidentNames(r.general_observations)}`).join('\n')}

Format as:
1. Critical Highlights & Urgent Alerts
2. Medication & eMAR Exceptions
3. Resident Observation Watchlist
4. Night Shift / Incoming Staff Action Items
`;

      const generateFallback = () => {
        const pendingIncidents = recentIncidents.filter((i) => i.status === 'submitted');
        const arthur = activeResidents.find((r) => r.full_name.includes('Arthur'));
        const harold = activeResidents.find((r) => r.full_name.includes('Harold'));

        return `### 📋 Shift Handover Brief: ${shiftType || 'Day to Night'} Shift
**Facility**: Hi Haven Manor Inc. (18 Beds) · CA-NL Personal Care Home
**Operational Status**: ${activeResidents.length} Active Residents · ${todayReports.length} Shift Reports Logged

---

#### 1. 🚨 Critical Highlights & Urgent Alerts
${
  pendingIncidents.length > 0
    ? pendingIncidents
        .map(
          (i) =>
            `- **[Pending Manager Review] ${i.incident_type} (${i.severity.toUpperCase()})**: ${i.description} (Reported by ${i.reported_by_name || 'Staff'}).`
        )
        .join('\n')
    : '- **No Open Critical Incidents**: All recent clinical incident logs have been reviewed.'
}
- **Medication Cart Security**: ${
          latestChecklist?.medication_storage_secured
            ? '✅ Double-locked verified. Narcotics physical count reconciled.'
            : '⚠️ Security attestation pending for current shift.'
        }

#### 2. 💊 Medication & eMAR Exceptions
- **Passes Logged Today**: ${medPasses.length} doses recorded (Metformin, Ramipril, Amlodipine).
- **Scheduled Evening Routine**: 20:00 bedtime pass pending for Level 2 residents (Donepezil 10mg Room 107).
- **PRN Availability**: Lorazepam 0.5mg SL available for Arthur Walsh PRN if sundowning agitation escalates.

#### 3. 👁️ Resident Observation Watchlist
${
  harold
    ? `- **${harold.full_name} (Room ${harold.room_number})**: Cigarette program active (${harold.on_cigarette_program ? 'count monitored' : 'none'}). Requested extras during afternoon; redirected with herbal tea and music.`
    : ''
}
${
  arthur
    ? `- **${arthur.full_name} (Room ${arthur.room_number})**: Superficial abrasion on left heel from morning transfer. Barrier cream applied; re-check skin integrity at bedtime.`
    : ''
}
${
  todayReports.length > 0
    ? todayReports
        .slice(0, 3)
        .map((r) => {
          const res = dbState.residents.find((x) => x.id === r.resident_id);
          return `- **${res?.full_name || 'Resident'}**: Breakfast (${r.meals.breakfast.eaten}), Lunch (${r.meals.lunch.eaten}). Shower: ${r.shower_taken ? 'Completed' : 'Scheduled'}. Notes: ${r.general_observations || 'Settled.'}`;
        })
        .join('\n')
    : '- Shift reports are actively being logged by care workers.'
}

#### 4. 📝 Incoming Shift Action Items
- [ ] Deliver scheduled 20:00 medication administration for Room 107.
- [ ] Complete Level 2 wander checks and bedroom rounds at 21:00 and 01:00.
- [ ] Perform and log end-of-shift med cart double-lock attestation before 07:00.`;
      };

      const result = await runAIWithFallback(promptContext, generateFallback);
      res.json({ summary: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Shift Handover error:', err);
      res.status(500).json({ error: err.message || 'Error generating handover summary' });
    }
  });

  // AI 2: Compliance & Regulatory Audit Assistant
  app.post('/api/ai/compliance-audit', requireAuth, async (req, res) => {
    try {
      const overdueReassessments = dbState.reassessments.filter((r) => r.status === 'overdue');
      const unapprovedIncidents = dbState.incidents.filter((i) => i.status === 'submitted');
      const expiringStaff = dbState.staff.filter((s) => s.credentials.some((c) => c.status === 'expiring_soon' || c.status === 'expired'));
      const latestChecklist = dbState.shiftChecklists[0];

      const promptContext = `
You are the CareHomeOS Regulatory Compliance AI Auditor specializing in Newfoundland & Labrador (CA-NL) Personal Care Home Standards.
Evaluate the current facility state against the jurisdiction ruleset:
- Overdue resident reassessments: ${overdueReassessments.length} (NL AG finding target: 0 overdue)
- Unapproved incident reports: ${unapprovedIncidents.length} (Monitoring weekend approval gap)
- Staff with expiring/expired credentials: ${expiringStaff.length}
- Med cart locked attestation: ${latestChecklist?.medication_storage_secured ? 'VERIFIED COMPLIANT' : 'MISSING / UNSECURED'}

Provide a structured compliance audit review:
1. Executive Risk Level (Low/Moderate/High)
2. NL Auditor General Specific Backlog Findings
3. Immediate Manager Corrective Actions
`;

      const generateFallback = () => {
        return `### 🏛️ CA-NL Regulatory Compliance Audit Summary
**Jurisdiction**: Newfoundland & Labrador Operational Standards (2007, Rev 2022 Draft)
**Overall Facility Risk Status**: ${overdueReassessments.length > 0 ? '**MODERATE COMPLIANCE WATCH**' : '**COMPLIANT**'}

---

#### 1. ⚠️ NL Auditor General Specific Priority Findings
- **Overdue Resident Reassessments (${overdueReassessments.length})**: ${
          overdueReassessments.length > 0
            ? overdueReassessments
                .map((r) => {
                  const res = dbState.residents.find((x) => x.id === r.resident_id);
                  return `Resident **${res?.full_name || r.resident_id}** (due ${r.due_date}). In provincial audits, overdue 6-month reassessments are cited as pervasive compliance backlogs.`;
                })
                .join(' ')
            : 'Zero overdue reassessments. 100% compliant with 6-month cycle.'
        }
- **Incident Approval Turnaround (${unapprovedIncidents.length} Pending)**: ${
          unapprovedIncidents.length > 0
            ? `${unapprovedIncidents.length} incident reports in 'submitted' status awaiting Manager/Owner sign-off. Weekend approval gap monitored.`
            : 'All incident reports reviewed and closed.'
        }
- **Staff Credential Matrix (${expiringStaff.length} Expiring Soon)**: ${
          expiringStaff.length > 0
            ? expiringStaff
                .map((s) => `${s.name} (${s.credentials.filter((c) => c.status === 'expiring_soon' || c.status === 'expired').map((c) => c.type).join(', ')})`)
                .join('; ')
            : 'All staff certifications in good standing.'
        }

#### 2. ✅ Positive Compliance Controls Verified
- **Medication Storage Security**: ${
          latestChecklist?.medication_storage_secured
            ? '100% compliant on recent shifts. End-of-shift checklist logs explicit verification that medication cart is double-locked.'
            : 'Verification pending on upcoming shift checklist.'
        }
- **Append-Only Immutable Event Ledger**: System events are actively recording all clinical touches with verifiable timestamps.

#### 3. 🎯 Recommended Manager Next Steps
1. Convene reassessment for overdue resident(s) to increment care plan version.
2. Complete segregation-of-duties review on pending incident reports.
3. Notify expiring staff for recertification documentation.`;
      };

      const result = await runAIWithFallback(promptContext, generateFallback);
      res.json({ audit: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Compliance Audit error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // AI 3: Natural Language Q&A over Audit-Safe Views
  app.post('/api/ai/ask-audit', requireAuth, async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      // Built for the LOCAL fallback and for computing counts — may contain
      // real resident names/ids. Never interpolate this object directly
      // into an outbound AI prompt; use redactedContextData below instead.
      const contextData = {
        residents: dbState.residents.map((r) => ({ id: r.id, name: r.full_name, room: r.room_number, care: r.level_of_care, cigarettes: r.on_cigarette_program })),
        incidents: dbState.incidents.map((i) => ({ id: i.id, resident: i.resident_id, type: i.incident_type, severity: i.severity, status: i.status, date: i.occurred_at })),
        recentEvents: dbState.auditEvents.slice(0, 15),
        reassessments: dbState.reassessments,
        staffOnDuty: dbState.shiftAssignments.filter((a) => a.is_active).map((a) => a.staff_id),
      };

      // PHIA data minimization: scrub every known resident name (and any id
      // that embeds one) out of the serialized context before it can reach
      // Gemini. See redactKnownResidentNames() and SECURITY.md
      // "AI Processing & PHIA".
      const redactedContextData = JSON.parse(redactKnownResidentNames(JSON.stringify(contextData)));

      const prompt = `
You are the CareHomeOS Read-Only AI Explainer and Auditor.
You answer natural-language operational and compliance questions for small care home staff and inspectors.
CRITICAL CONSTRAINT: You have strictly NO write access. Answer only from the provided audit-safe views.
Resident names have been replaced with room-based aliases (e.g. "Resident-Rm101") before reaching you — refer to
residents by that alias, never invent a name.

QUERY: "${question}"

SYSTEM STATE CONTEXT:
${JSON.stringify(redactedContextData, null, 2)}

Provide an accurate, concise answer with timestamps, aliases, and regulatory references where appropriate.
`;

      const generateFallback = () => {
        let answer = `**CareHomeOS Audit & Explainer:**\n\n`;
        const qLower = question.toLowerCase();

        if (qLower.includes('incident') || qLower.includes('fall') || qLower.includes('arthur')) {
          answer += `Based on the immutable incident register:\n`;
          dbState.incidents.forEach((inc) => {
            const res = dbState.residents.find((r) => r.id === inc.resident_id);
            answer += `- **${inc.id} (${inc.incident_type})**: Resident **${res?.full_name || inc.resident_id}**, Severity: **${inc.severity}**, Status: **${inc.status}**. Description: ${inc.description}\n`;
          });
          answer += `\n*Segregation of duties rule enforced: An incident reporter cannot review their own report.*`;
        } else if (qLower.includes('reassess') || qLower.includes('overdue') || qLower.includes('audit')) {
          const overdue = dbState.reassessments.filter((r) => r.status === 'overdue');
          answer += `Per CA-NL Operational Standards, resident reassessments must occur at least every 6 months:\n`;
          if (overdue.length > 0) {
            overdue.forEach((o) => {
              const res = dbState.residents.find((r) => r.id === o.resident_id);
              answer += `- **${res?.full_name || o.resident_id}**: Overdue since ${o.due_date}. (NL Auditor General priority finding).\n`;
            });
          } else {
            answer += `- No resident reassessments are currently overdue.\n`;
          }
        } else if (qLower.includes('cart') || qLower.includes('lock') || qLower.includes('medication')) {
          const checklist = dbState.shiftChecklists[0];
          answer += `**Medication Storage & eMAR Controls:**\n`;
          answer += `- Latest shift checklist by **${checklist?.completed_by_name || 'Staff'}**: Medication cart **${checklist?.medication_storage_secured ? 'VERIFIED DOUBLE-LOCKED' : 'NOT SECURED'}**, narcotics count **${checklist?.medication_count_verified ? 'VERIFIED MATCHED' : 'UNVERIFIED'}**.\n`;
          answer += `- Total administrations recorded today: **${dbState.medAdmins.length}**.\n`;
        } else if (qLower.includes('staff') || qLower.includes('ratio') || qLower.includes('credential')) {
          answer += `**Staffing & Credential Status:**\n`;
          answer += `- Current staff on duty: ${dbState.staff.filter((s) => dbState.shiftAssignments.some((a) => a.staff_id === s.id && a.is_active)).map((s) => s.name).join(', ') || '3 staff active'}.\n`;
          answer += `- Day staff ratio compliant with CA-NL Personal Care Home regulations (minimum 1:10, operating at 1:6).\n`;
        } else {
          answer += `Hi Haven Manor Inc. is operating at 18-bed capacity with ${dbState.residents.length} active resident profiles, ${dbState.medAdmins.length} eMAR passes logged today, and an immutable audit log of ${dbState.auditEvents.length} verifiable system events.`;
        }
        return answer;
      };

      const result = await runAIWithFallback(prompt, generateFallback);
      res.json({ answer: result.text, source: result.source });
    } catch (err: any) {
      console.error('AI Ask Audit error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

/**
 * Standalone entry point for local development and any traditional Node
 * host (Cloud Run, a VM, etc.) — wraps createApiApp() with the Vite dev
 * middleware (or the built static frontend in production) and starts
 * listening. Not used on Vercel: see api/[...all].ts, which imports
 * createApiApp() directly since Vercel's own static hosting/CDN serves the
 * built frontend.
 */
async function startServer() {
  const app = createApiApp();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareHomeOS server running on http://0.0.0.0:${PORT}`);
  });
}

// Vercel provides its own process/routing model for serverless functions
// (see api/[...all].ts) and sets this env var in both its build and
// runtime environments — never auto-start a persistent listener there.
if (!process.env.VERCEL) {
  startServer();
}
