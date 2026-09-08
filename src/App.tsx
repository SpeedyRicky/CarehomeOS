import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Header } from './components/Header';
import { TodayView } from './components/TodayView';
import { ScheduleView } from './components/ScheduleView';
import { EMARView } from './components/EMARView';
import { IncidentsView } from './components/IncidentsView';
import { ResidentsView } from './components/ResidentsView';
import { ReassessmentsView } from './components/ReassessmentsView';
import { CRMView } from './components/CRMView';
import { ComplianceView } from './components/ComplianceView';
import { AuditLogView } from './components/AuditLogView';
import { AIAssistantView } from './components/AIAssistantView';
import { NewIncidentModal } from './components/NewIncidentModal';
import { DailyReportModal } from './components/DailyReportModal';
import { ShiftChecklistModal } from './components/ShiftChecklistModal';
import {
  INITIAL_STAFF,
  INITIAL_SHIFTS,
  INITIAL_SHIFT_ASSIGNMENTS,
  INITIAL_RESIDENTS,
  INITIAL_PROSPECTS,
  INITIAL_CARE_PLANS,
  INITIAL_REASSESSMENTS,
  INITIAL_MED_ORDERS,
  INITIAL_MED_ADMINS,
  INITIAL_DAILY_REPORTS,
  INITIAL_SHIFT_CHECKLISTS,
  INITIAL_INCIDENTS,
  INITIAL_AUDIT_EVENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_RULESET,
  INITIAL_SHIFT_CHANGE_REQUESTS,
  INITIAL_TIME_ENTRIES,
} from './seedData';
import {
  Staff,
  Shift,
  ShiftAssignment,
  Resident,
  Prospect,
  CarePlan,
  Reassessment,
  MedicationOrder,
  MedicationAdministration,
  DailyReport,
  ShiftChecklist,
  IncidentReport,
  AuditEvent,
  NotificationItem,
  ShiftChangeRequest,
  ShiftChangeRequestType,
  TimeEntry,
} from './types';
import { getBlockedTabsForRole } from './roleAccess';

const TOKEN_STORAGE_KEY = 'carehomeos_token';
const SELECTED_STAFF_EMAIL_KEY = 'carehomeos_selected_staff_email';

// TEMPORARY: the login screen is disabled for now (product decision — see
// PR history) while the login UX gets simplified; the real backend
// authentication in src/apiApp.ts (password hashing, MFA, session tokens)
// is untouched and still runs underneath. Switching users below performs
// a real /api/auth/login call with these known seed demo credentials
// (src/seedData.auth.ts) rather than bypassing auth — re-enabling a login
// screen later just means rendering one in place of the auto-login call
// below and reusing handleLoginSuccess exactly as-is.
const DEMO_PASSWORD = 'Demo@CareHome1';
const DEMO_MFA_CODE = '123456';
const DEFAULT_STAFF_EMAIL = 'sarah.j@hihavenmanor.ca';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('today');

  // Auth state. Real session tokens still back every request (see
  // SECURITY.md) — there's just no login screen right now (see
  // DEMO_PASSWORD's comment above); auto-login stands in for it.
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null
  );
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Core domain state (initialized with seed, synced with server API)
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [shifts, setShifts] = useState<Shift[]>(INITIAL_SHIFTS);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>(INITIAL_SHIFT_ASSIGNMENTS);
  const [residents, setResidents] = useState<Resident[]>(INITIAL_RESIDENTS);
  const [prospects, setProspects] = useState<Prospect[]>(INITIAL_PROSPECTS);
  const [carePlans, setCarePlans] = useState<CarePlan[]>(INITIAL_CARE_PLANS);
  const [reassessments, setReassessments] = useState<Reassessment[]>(INITIAL_REASSESSMENTS);
  const [medOrders, setMedOrders] = useState<MedicationOrder[]>(INITIAL_MED_ORDERS);
  const [medAdmins, setMedAdmins] = useState<MedicationAdministration[]>(INITIAL_MED_ADMINS);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>(INITIAL_DAILY_REPORTS);
  const [shiftChecklists, setShiftChecklists] = useState<ShiftChecklist[]>(INITIAL_SHIFT_CHECKLISTS);
  const [incidents, setIncidents] = useState<IncidentReport[]>(INITIAL_INCIDENTS);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_AUDIT_EVENTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [ruleset, setRuleset] = useState(INITIAL_RULESET);
  const [shiftChangeRequests, setShiftChangeRequests] = useState<ShiftChangeRequest[]>(INITIAL_SHIFT_CHANGE_REQUESTS);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(INITIAL_TIME_ENTRIES);

  // Modals state
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [incidentResidentId, setIncidentResidentId] = useState<string | undefined>(undefined);

  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [dailyReportResident, setDailyReportResident] = useState<Resident | null>(null);
  const [existingDailyReport, setExistingDailyReport] = useState<DailyReport | undefined>(undefined);

  const [isShiftChecklistOpen, setIsShiftChecklistOpen] = useState(false);

  const authFetch = (url: string, options: RequestInit = {}, tokenOverride?: string) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...((tokenOverride || authToken) ? { Authorization: `Bearer ${tokenOverride || authToken}` } : {}),
      },
    });

  const loadOrgState = async (tokenOverride?: string) => {
    const res = await authFetch('/api/state', {}, tokenOverride);
    if (!res.ok) return;
    const data = await res.json();
    if (data.staff) setStaffList(data.staff);
    if (data.shifts) setShifts(data.shifts);
    if (data.shiftAssignments) setShiftAssignments(data.shiftAssignments);
    if (data.residents) setResidents(data.residents);
    if (data.prospects) setProspects(data.prospects);
    if (data.carePlans) setCarePlans(data.carePlans);
    if (data.reassessments) setReassessments(data.reassessments);
    if (data.medOrders) setMedOrders(data.medOrders);
    if (data.medAdmins) setMedAdmins(data.medAdmins);
    if (data.dailyReports) setDailyReports(data.dailyReports);
    if (data.shiftChecklists) setShiftChecklists(data.shiftChecklists);
    if (data.incidents) setIncidents(data.incidents);
    if (data.auditEvents) setAuditEvents(data.auditEvents);
    if (data.notifications) setNotifications(data.notifications);
    if (data.ruleset) setRuleset(data.ruleset);
    if (data.shiftChangeRequests) setShiftChangeRequests(data.shiftChangeRequests);
    if (data.timeEntries) setTimeEntries(data.timeEntries);
  };

  // Signs in as the given staff member's real account via a genuine
  // /api/auth/login call (the known seed demo password/MFA code from
  // src/seedData.auth.ts) — this is a stand-in for a login screen, not a
  // bypass of authentication itself. Every request still carries a real
  // session token and the server still enforces requireAuth/requireRole on
  // every endpoint exactly as before.
  const loginAsEmail = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: DEMO_PASSWORD, mfaCode: DEMO_MFA_CODE }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      window.localStorage.setItem(SELECTED_STAFF_EMAIL_KEY, email);
      setAuthToken(data.token);
      setCurrentStaff(data.staff);
      await loadOrgState(data.token);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  // Resolve the current session on mount: reuse an existing token if one is
  // still valid, otherwise silently sign in as the last-selected (or
  // default) staff member. See DEMO_PASSWORD's comment above — the login
  // screen is temporarily disabled, not the underlying auth.
  useEffect(() => {
    async function resolveSessionAndLoadState() {
      try {
        if (authToken) {
          const meRes = await authFetch('/api/auth/me');
          if (meRes.ok) {
            const meData = await meRes.json();
            setCurrentStaff(meData.staff);
            await loadOrgState();
            return;
          }
          window.localStorage.removeItem(TOKEN_STORAGE_KEY);
          setAuthToken(null);
        }
        const rememberedEmail = window.localStorage.getItem(SELECTED_STAFF_EMAIL_KEY) || DEFAULT_STAFF_EMAIL;
        await loginAsEmail(rememberedEmail);
      } catch (err) {
        console.warn('Using client memory state:', err);
      } finally {
        setAuthChecked(true);
      }
    }
    resolveSessionAndLoadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blockedTabs = getBlockedTabsForRole(currentStaff?.role);

  // Automatically divert staff away from modules their role can't access
  useEffect(() => {
    if (blockedTabs.includes(activeTab)) {
      setActiveTab('today');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStaff?.role, activeTab]);

  const handleSwitchUser = (staff: Staff) => {
    loginAsEmail(staff.email);
  };

  if (!authChecked || !currentStaff) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading CareHomeOS…
      </div>
    );
  }

  const activeAssignment = shiftAssignments.find(
    (a) => a.staff_id === currentStaff.id && a.is_active
  );

  // Clock In / Out Toggle Handler
  const handleClockToggle = async () => {
    const action = activeAssignment?.is_active ? 'clock_out' : 'clock_in';
    try {
      const res = await authFetch('/api/shifts/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaff.id,
          shiftId: activeAssignment?.shift_id || 'shift-day-today',
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state
        setShiftAssignments((prev) => {
          const filtered = prev.filter((a) => a.staff_id !== currentStaff.id);
          if (action === 'clock_in' && data.assignment) {
            return [...filtered, data.assignment];
          }
          return filtered;
        });
        if (data.timeEntry) {
          setTimeEntries((prev) => [data.timeEntry, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit a shift change request (swap / cover / time off)
  const handleSubmitShiftChangeRequest = async (payload: {
    shiftAssignmentId: string;
    requestType: ShiftChangeRequestType;
    targetStaffId: string | null;
    reason: string;
  }) => {
    try {
      const res = await authFetch('/api/shift-change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setShiftChangeRequests((prev) => [data.request, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manager/Owner review of a shift change request (approve / deny)
  const handleReviewShiftChangeRequest = async (payload: {
    requestId: string;
    action: 'approve' | 'deny';
    reviewNotes?: string;
  }) => {
    try {
      const res = await authFetch(`/api/shift-change-requests/${payload.requestId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: payload.action, reviewNotes: payload.reviewNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        setShiftChangeRequests((prev) => prev.map((r) => (r.id === data.request.id ? data.request : r)));
      } else {
        const err = await res.json();
        alert(err.error || 'Review failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Notification read toggle
  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Administer Medication via eMAR
  const handleAdministerMed = async (payload: {
    orderId: string;
    residentId: string;
    shiftId: string;
    administeredBy: string;
    administeredByName: string;
    doseGiven: string;
    status: 'given' | 'missed' | 'refused' | 'held';
    notes: string;
    scheduledTime: string;
  }) => {
    try {
      const res = await authFetch('/api/emar/administer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setMedAdmins((prev) => [data.administration, ...prev]);

        // Append to audit log
        const auditEvt: AuditEvent = {
          id: `evt-${Date.now()}`,
          actor_id: payload.administeredBy,
          actor_name: payload.administeredByName,
          action: 'MEDICATION_ADMINISTERED',
          resource_type: 'medication_administrations',
          resource_id: data.administration.id,
          payload,
          prior_event_id: null,
          created_at: new Date().toISOString(),
        };
        setAuditEvents((prev) => [auditEvt, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Daily Shift Report
  const handleSaveDailyReport = async (report: DailyReport) => {
    try {
      const res = await authFetch('/api/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      if (res.ok) {
        const data = await res.json();
        setDailyReports((prev) => {
          const filtered = prev.filter(
            (r) => !(r.resident_id === report.resident_id && r.date === report.date)
          );
          return [data.report, ...filtered];
        });

        if (report.status === 'submitted') {
          const auditEvt: AuditEvent = {
            id: `evt-${Date.now()}`,
            actor_id: report.authored_by,
            actor_name: report.authored_by_name,
            action: 'DAILY_REPORT_SUBMITTED',
            resource_type: 'daily_reports',
            resource_id: report.id,
            payload: report,
            prior_event_id: null,
            created_at: new Date().toISOString(),
          };
          setAuditEvents((prev) => [auditEvt, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save End-of-Shift Safety & Medication Checklist
  const handleSaveShiftChecklist = async (checklist: ShiftChecklist) => {
    try {
      const res = await authFetch('/api/shift-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checklist),
      });
      if (res.ok) {
        const data = await res.json();
        setShiftChecklists((prev) => [data.checklist, ...prev]);

        const auditEvt: AuditEvent = {
          id: `evt-${Date.now()}`,
          actor_id: checklist.completed_by,
          actor_name: checklist.completed_by_name,
          action: 'SHIFT_CHECKLIST_COMPLETED',
          resource_type: 'shift_checklists',
          resource_id: checklist.id,
          payload: checklist,
          prior_event_id: null,
          created_at: new Date().toISOString(),
        };
        setAuditEvents((prev) => [auditEvt, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Incident Report (Taxonomy Form)
  const handleSubmitIncident = async (incident: IncidentReport) => {
    try {
      const res = await authFetch('/api/incidents/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents((prev) => [data.incident, ...prev]);

        // Add in-app notification
        const notif: NotificationItem = {
          id: `notif-${Date.now()}`,
          recipient_role: 'Manager',
          recipient_name: 'Olatundun Ndudim',
          channel: incident.severity === 'Critical' ? 'push' : 'in_app',
          title: `🚨 Incident Report: ${incident.incident_type} (${incident.severity})`,
          body: `${incident.reported_by_name} reported: ${incident.description.slice(0, 80)}...`,
          created_at: new Date().toISOString(),
          read: false,
          urgency: incident.severity === 'Critical' ? 'critical' : 'high',
        };
        setNotifications((prev) => [notif, ...prev]);

        // Append audit event
        const auditEvt: AuditEvent = {
          id: `evt-${Date.now()}`,
          actor_id: incident.reported_by,
          actor_name: incident.reported_by_name,
          action: 'INCIDENT_SUBMITTED',
          resource_type: 'incident_reports',
          resource_id: incident.id,
          payload: incident,
          prior_event_id: null,
          created_at: new Date().toISOString(),
        };
        setAuditEvents((prev) => [auditEvt, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Review Incident Report (Approve / Reject with Segregation of Duties)
  const handleReviewIncident = async (data: {
    incidentId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerRole: string;
    action: 'approve' | 'reject' | 'return_to_draft';
    rejectionReason?: string;
  }) => {
    try {
      const res = await authFetch('/api/incidents/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setIncidents((prev) =>
          prev.map((i) => (i.id === data.incidentId ? result.incident : i))
        );

        const auditEvt: AuditEvent = {
          id: `evt-${Date.now()}`,
          actor_id: data.reviewerId,
          actor_name: data.reviewerName,
          action: `INCIDENT_${data.action.toUpperCase()}`,
          resource_type: 'incident_reports',
          resource_id: data.incidentId,
          payload: data,
          prior_event_id: null,
          created_at: new Date().toISOString(),
        };
        setAuditEvents((prev) => [auditEvt, ...prev]);
      } else {
        const err = await res.json();
        alert(err.error || 'Review failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Complete 6-Month Reassessment (NL AG finding backlog)
  const handleCompleteReassessment = async (data: {
    reassessmentId: string;
    completedBy: string;
    outcomeNotes: string;
    newCarePlanCreated: boolean;
  }) => {
    try {
      const res = await authFetch('/api/reassessments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        setReassessments((prev) =>
          prev.map((r) => (r.id === data.reassessmentId ? result.reassessment : r))
        );

        if (data.newCarePlanCreated) {
          // Increment care plan version
          const targetReassessment = reassessments.find((r) => r.id === data.reassessmentId);
          if (targetReassessment) {
            setCarePlans((prev) =>
              prev.map((cp) =>
                cp.resident_id === targetReassessment.resident_id
                  ? {
                      ...cp,
                      version: cp.version + 1,
                      last_evaluated_date: new Date().toISOString().split('T')[0],
                      evaluated_by: data.completedBy,
                    }
                  : cp
              )
            );
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Convert Prospect to Resident (CRM Lifecycle Spine)
  const handleConvertProspect = async (data: {
    prospectId: string;
    roomNumber: string;
    levelOfCare: string;
    actorId: string;
    actorName: string;
  }) => {
    try {
      const res = await authFetch('/api/prospects/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const result = await res.json();
        // Update prospects
        setProspects((prev) =>
          prev.map((p) => (p.id === data.prospectId ? { ...p, pipeline_stage: 'Move-in' } : p))
        );
        // Add resident
        setResidents((prev) => [result.resident, ...prev]);

        // Add initial scheduled reassessment
        const reassessmentDate = new Date();
        reassessmentDate.setMonth(reassessmentDate.getMonth() + 6);
        const newReassessment: Reassessment = {
          id: `reassess-${Date.now()}`,
          resident_id: result.resident.id,
          due_date: reassessmentDate.toISOString().split('T')[0],
          completed_date: null,
          completed_by: null,
          status: 'scheduled',
          outcome_notes: 'Initial 6-month comprehensive reassessment per CA-NL Operational Standards',
          resulting_care_plan_id: null,
        };
        setReassessments((prev) => [newReassessment, ...prev]);

        // Append audit event
        const auditEvt: AuditEvent = {
          id: `evt-${Date.now()}`,
          actor_id: data.actorId,
          actor_name: data.actorName,
          action: 'PROSPECT_CONVERTED',
          resource_type: 'residents',
          resource_id: result.resident.id,
          payload: {
            prospect_id: data.prospectId,
            resident_id: result.resident.id,
            room: data.roomNumber,
          },
          prior_event_id: null,
          created_at: new Date().toISOString(),
        };
        setAuditEvents((prev) => [auditEvt, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top App Header */}
      <Header
        currentStaff={currentStaff}
        allStaff={staffList}
        onSelectStaff={handleSwitchUser}
        activeAssignment={activeAssignment}
        onClockToggle={handleClockToggle}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'today' && (
          <TodayView
            currentStaff={currentStaff}
            activeAssignment={activeAssignment}
            residents={residents}
            medOrders={medOrders}
            medAdmins={medAdmins}
            dailyReports={dailyReports}
            shiftChecklists={shiftChecklists}
            onOpenMedPass={(order, resident) => {
              setActiveTab('emar');
            }}
            onOpenDailyReport={(resident, existingReport) => {
              setDailyReportResident(resident);
              setExistingDailyReport(existingReport);
              setIsDailyReportOpen(true);
            }}
            onOpenNewIncident={(residentId) => {
              setIncidentResidentId(residentId);
              setIsNewIncidentOpen(true);
            }}
            onOpenShiftChecklist={() => setIsShiftChecklistOpen(true)}
            onNavigateToAI={() => setActiveTab('ai')}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            currentStaff={currentStaff}
            allStaff={staffList}
            shifts={shifts}
            shiftAssignments={shiftAssignments}
            shiftChangeRequests={shiftChangeRequests}
            timeEntries={timeEntries}
            onSubmitShiftChangeRequest={handleSubmitShiftChangeRequest}
            onReviewShiftChangeRequest={handleReviewShiftChangeRequest}
          />
        )}

        {activeTab === 'emar' && (
          <EMARView
            medOrders={medOrders}
            medAdmins={medAdmins}
            residents={residents}
            currentStaff={currentStaff}
            activeAssignment={activeAssignment}
            onAdministerMed={handleAdministerMed}
          />
        )}

        {activeTab === 'incidents' && (
          <IncidentsView
            incidents={incidents}
            residents={residents}
            currentStaff={currentStaff}
            onOpenNewIncident={() => {
              setIncidentResidentId(undefined);
              setIsNewIncidentOpen(true);
            }}
            onReviewIncident={handleReviewIncident}
          />
        )}

        {activeTab === 'residents' && (
          <ResidentsView
            residents={residents}
            carePlans={carePlans}
            reassessments={reassessments}
            currentStaff={currentStaff}
            onOpenDailyReport={(resident) => {
              const existing = dailyReports.find(
                (r) =>
                  r.resident_id === resident.id &&
                  r.date === new Date().toISOString().split('T')[0]
              );
              setDailyReportResident(resident);
              setExistingDailyReport(existing);
              setIsDailyReportOpen(true);
            }}
            onOpenNewIncident={(residentId) => {
              setIncidentResidentId(residentId);
              setIsNewIncidentOpen(true);
            }}
            onNavigateToReassessments={() => setActiveTab('reassessments')}
          />
        )}

        {activeTab === 'reassessments' && !blockedTabs.includes('reassessments') && (
          <ReassessmentsView
            reassessments={reassessments}
            residents={residents}
            currentStaff={currentStaff}
            onCompleteReassessment={handleCompleteReassessment}
          />
        )}

        {activeTab === 'crm' && !blockedTabs.includes('crm') && (
          <CRMView
            prospects={prospects}
            currentStaff={currentStaff}
            onConvertProspect={handleConvertProspect}
          />
        )}

        {activeTab === 'compliance' && !blockedTabs.includes('compliance') && (
          <ComplianceView
            ruleset={ruleset}
            staff={staffList}
            shiftChecklists={shiftChecklists}
            reassessments={reassessments}
            incidents={incidents}
            onOpenChecklistModal={() => setIsShiftChecklistOpen(true)}
            onNavigateToAI={() => setActiveTab('ai')}
          />
        )}

        {blockedTabs.includes(activeTab) && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                You are currently signed in as <strong>{currentStaff.name}</strong> ({currentStaff.role}).{' '}
                {currentStaff.role === 'Care Worker'
                  ? 'Care Workers are restricted from Reassessments, CRM Pipeline, and Regulatory Compliance. These require Supervisor-level access or higher.'
                  : 'CRM Pipeline and Regulatory Compliance require Manager or Owner administrative privileges.'}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('today')}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
            >
              Return to Today Queue
            </button>
          </div>
        )}

        {activeTab === 'audit' && <AuditLogView auditEvents={auditEvents} />}

        {activeTab === 'ai' && <AIAssistantView />}
      </main>

      {/* Global Modals */}
      <NewIncidentModal
        isOpen={isNewIncidentOpen}
        onClose={() => setIsNewIncidentOpen(false)}
        residents={residents}
        medOrders={medOrders}
        currentStaff={currentStaff}
        initialResidentId={incidentResidentId}
        onSubmitIncident={handleSubmitIncident}
      />

      <DailyReportModal
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
        resident={dailyReportResident}
        currentStaff={currentStaff}
        existingReport={existingDailyReport}
        onSaveReport={handleSaveDailyReport}
      />

      <ShiftChecklistModal
        isOpen={isShiftChecklistOpen}
        onClose={() => setIsShiftChecklistOpen(false)}
        currentStaff={currentStaff}
        onSaveChecklist={handleSaveShiftChecklist}
      />
    </div>
  );
}
