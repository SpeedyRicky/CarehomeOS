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
// There is no authentication layer here — every route is open, matching
// the original prototype. Identity in this demo is established entirely
// client-side by LoginView.tsx's hardcoded credential check; the server
// trusts whatever staff id the client sends, same as before any of that
// existed. Do not add real access control on top of this without also
// adding real server-side session verification — a client-side login
// screen alone proves nothing to this server.
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
import {
  AuditEvent,
  IncidentReport,
  MedicationAdministration,
  DailyReport,
  ShiftChecklist,
  Reassessment,
  Resident,
  Prospect,
  TaskDefinition,
  ShiftTaskTemplate,
  ShiftTaskAssignment,
} from './types';
import { ensureShiftTasksGenerated } from './shiftTasks';
import { computeExceptions } from './exceptions';

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

  // API: Get Full State (Scoped to current home_id)
  app.get('/api/state', (req, res) => {
    res.json(dbState);
  });

  // API: Clock In / Clock Out
  app.post('/api/shifts/clock', (req, res) => {
    const { staffId, shiftId, action } = req.body;
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
  app.post('/api/prospects/convert', (req, res) => {
    const { prospectId, roomNumber, levelOfCare, actorId, actorName } = req.body;

    const actor = dbState.staff.find((s) => s.id === actorId);
    if (actor && actor.role === 'Care Worker') {
      return res.status(403).json({ error: 'Access restricted: Care workers are not permitted to manage CRM prospects or resident admissions.' });
    }

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

    recordEvent(actorId || 'staff-olatundun', actorName || 'Manager', 'PROSPECT_CONVERTED', 'residents', newResident.id, {
      prospect_id: prospect.id,
      resident_name: newResident.full_name,
      room: newResident.room_number,
    });

    res.json({ success: true, resident: newResident, prospect });
  });

  // API: eMAR Administer Medication
  app.post('/api/emar/administer', (req, res) => {
    const { orderId, residentId, shiftId, administeredBy, administeredByName, doseGiven, status, notes, scheduledTime } = req.body;

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
  app.post('/api/daily-reports', (req, res) => {
    const reportData: DailyReport = req.body;
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
  app.post('/api/shift-checklists', (req, res) => {
    const checklist: ShiftChecklist = req.body;
    dbState.shiftChecklists.unshift(checklist);

    recordEvent(checklist.completed_by, checklist.completed_by_name, 'SHIFT_CHECKLIST_COMPLETED', 'shift_checklists', checklist.id, {
      medication_storage_secured: checklist.medication_storage_secured,
      medication_count_verified: checklist.medication_count_verified,
      fridge_temp_celsius: checklist.fridge_temp_celsius,
    });

    res.json({ success: true, checklist });
  });

  // API: Incident Submit (Draft -> Submitted)
  app.post('/api/incidents/submit', (req, res) => {
    const incidentData: IncidentReport = req.body;
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
  app.post('/api/incidents/review', (req, res) => {
    const { incidentId, reviewerId, reviewerName, reviewerRole, action, rejectionReason } = req.body;

    const incident = dbState.incidents.find((i) => i.id === incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Role check: Only Owner or Manager
    if (reviewerRole !== 'Manager' && reviewerRole !== 'Owner') {
      return res.status(403).json({ error: 'Only Manager or Owner roles can review incident reports.' });
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
  app.post('/api/reassessments/complete', (req, res) => {
    const { reassessmentId, completedBy, outcomeNotes, newCarePlanCreated } = req.body;

    const actor = dbState.staff.find((s) => s.id === completedBy);
    if (actor && actor.role === 'Care Worker') {
      return res.status(403).json({ error: 'Access restricted: Care workers are not permitted to conduct or complete statutory reassessments.' });
    }

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
  // SCHEDULING & SHARED SHIFT TASKS
  // ==========================================

  // API: Task catalog (owner-configurable list of task types that can occur
  // on a shift, e.g. "Assist with Shower", "Medication Pass").
  app.get('/api/task-definitions', (req, res) => {
    res.json({ taskDefinitions: dbState.taskDefinitions });
  });

  // API: Create or update a task definition. Owner-only — this is the
  // catalog every home's shift task setup draws from.
  app.post('/api/task-definitions', (req, res) => {
    const { actorId, taskDefinition } = req.body as { actorId: string; taskDefinition: TaskDefinition };
    const actor = dbState.staff.find((s) => s.id === actorId);
    if (!actor || actor.role !== 'Owner') {
      return res.status(403).json({ error: 'Only the Owner may edit the task catalog.' });
    }

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
  app.get('/api/shift-task-templates', (req, res) => {
    res.json({ shiftTaskTemplates: dbState.shiftTaskTemplates });
  });

  app.post('/api/shift-task-templates', (req, res) => {
    const { actorId, shiftTaskTemplate } = req.body as { actorId: string; shiftTaskTemplate: ShiftTaskTemplate };
    const actor = dbState.staff.find((s) => s.id === actorId);
    if (!actor || actor.role !== 'Owner') {
      return res.status(403).json({ error: 'Only the Owner may adjust which tasks occur on a shift.' });
    }

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
  app.get('/api/shift-tasks', (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    ensureShiftTasksGenerated(dbState, date);
    const tasks = dbState.shiftTaskAssignments.filter((t) => t.date === date);
    res.json({ shiftTasks: tasks });
  });

  // API: Claim an unclaimed task (self-organizing shift duties — whoever
  // picks it up owns it until completed or skipped).
  app.post('/api/shift-tasks/:id/claim', (req, res) => {
    const { staffId, staffName } = req.body as { staffId: string; staffName: string };
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status !== 'pending') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'claimed';
    task.claimed_by = staffId;
    task.claimed_by_name = staffName;
    res.json({ success: true, task });
  });

  // API: Mark a task complete.
  app.post('/api/shift-tasks/:id/complete', (req, res) => {
    const { staffId, staffName, notes } = req.body as { staffId: string; staffName: string; notes?: string };
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status === 'completed' || task.status === 'skipped') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'completed';
    task.completed_by = staffId;
    task.completed_by_name = staffName;
    task.completed_at = new Date().toISOString();
    task.notes = notes || task.notes;

    recordEvent(staffId, staffName, 'SHIFT_TASK_COMPLETED', 'shift_task_assignments', task.id, {
      task_name: task.task_name,
      resident_id: task.resident_id,
    });

    res.json({ success: true, task });
  });

  // API: Skip a task with a required reason (feeds the exception if it
  // shouldn't have been skippable, but keeps the record honest either way).
  app.post('/api/shift-tasks/:id/skip', (req, res) => {
    const { staffId, staffName, reason } = req.body as { staffId: string; staffName: string; reason: string };
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to skip a task.' });
    }
    const task = dbState.shiftTaskAssignments.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    if (task.status === 'completed' || task.status === 'skipped') {
      return res.status(409).json({ error: `This task is already ${task.status}.` });
    }
    task.status = 'skipped';
    task.completed_by = staffId;
    task.completed_by_name = staffName;
    task.completed_at = new Date().toISOString();
    task.notes = reason.trim();

    recordEvent(staffId, staffName, 'SHIFT_TASK_SKIPPED', 'shift_task_assignments', task.id, {
      task_name: task.task_name,
      resident_id: task.resident_id,
      reason: task.notes,
    });

    res.json({ success: true, task });
  });

  // ==========================================
  // EXCEPTIONS — detected automatically, not hand-filed. See src/exceptions.ts.
  // ==========================================

  app.get('/api/exceptions', (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    ensureShiftTasksGenerated(dbState, date);
    res.json({ exceptions: computeExceptions(dbState) });
  });

  // API: Acknowledge or resolve an exception, optionally logging a
  // corrective action. Manager/Owner only.
  app.post('/api/exceptions/:id/review', (req, res) => {
    const { actorId, status, correctiveAction } = req.body as {
      actorId: string;
      status: 'acknowledged' | 'resolved';
      correctiveAction?: string;
    };
    const actor = dbState.staff.find((s) => s.id === actorId);
    if (!actor || (actor.role !== 'Manager' && actor.role !== 'Owner')) {
      return res.status(403).json({ error: 'Only a Manager or Owner may review an exception.' });
    }
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
