import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Header } from './components/Header';
import { TodayView } from './components/TodayView';
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
} from './seedData';
import {
  Staff,
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
} from './types';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('today');

  // Core domain state (initialized with seed, synced with server API)
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [currentStaff, setCurrentStaff] = useState<Staff>(INITIAL_STAFF[0]); // Default: Sarah Jenkins (Care Worker)
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

  // Modals state
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [incidentResidentId, setIncidentResidentId] = useState<string | undefined>(undefined);

  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [dailyReportResident, setDailyReportResident] = useState<Resident | null>(null);
  const [existingDailyReport, setExistingDailyReport] = useState<DailyReport | undefined>(undefined);

  const [isShiftChecklistOpen, setIsShiftChecklistOpen] = useState(false);

  // Fetch initial state from server
  useEffect(() => {
    async function loadServerState() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data.staff) setStaffList(data.staff);
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
        }
      } catch (err) {
        console.warn('Using client memory state:', err);
      }
    }
    loadServerState();
  }, []);

  const activeAssignment = shiftAssignments.find(
    (a) => a.staff_id === currentStaff.id && a.is_active
  );

  const isCareWorker = currentStaff.role === 'Care Worker';
  const restrictedTabs = ['reassessments', 'crm', 'compliance'];

  // Automatically divert Care Workers away from restricted modules
  useEffect(() => {
    if (isCareWorker && restrictedTabs.includes(activeTab)) {
      setActiveTab('today');
    }
  }, [isCareWorker, activeTab]);

  // Clock In / Out Toggle Handler
  const handleClockToggle = async () => {
    const action = activeAssignment?.is_active ? 'clock_out' : 'clock_in';
    try {
      const res = await fetch('/api/shifts/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: currentStaff.id,
          shiftId: 'shift-day-today',
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Switch Active Staff Member (Demonstrates RBAC & Segregation of Duties)
  const handleSelectStaff = (staff: Staff) => {
    setCurrentStaff(staff);
    if (staff.role === 'Care Worker' && restrictedTabs.includes(activeTab)) {
      setActiveTab('today');
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
      const res = await fetch('/api/emar/administer', {
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
      const res = await fetch('/api/daily-reports', {
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
      const res = await fetch('/api/shift-checklists', {
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
      const res = await fetch('/api/incidents/submit', {
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
      const res = await fetch('/api/incidents/review', {
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
      const res = await fetch('/api/reassessments/complete', {
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
      const res = await fetch('/api/prospects/convert', {
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
      {/* Top App Header & Shift/Role Switcher */}
      <Header
        currentStaff={currentStaff}
        allStaff={staffList}
        onSelectStaff={handleSelectStaff}
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

        {activeTab === 'reassessments' && !isCareWorker && (
          <ReassessmentsView
            reassessments={reassessments}
            residents={residents}
            currentStaff={currentStaff}
            onCompleteReassessment={handleCompleteReassessment}
          />
        )}

        {activeTab === 'crm' && !isCareWorker && (
          <CRMView
            prospects={prospects}
            currentStaff={currentStaff}
            onConvertProspect={handleConvertProspect}
          />
        )}

        {activeTab === 'compliance' && !isCareWorker && (
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

        {restrictedTabs.includes(activeTab) && isCareWorker && (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                You are currently signed in as <strong>{currentStaff.name}</strong> ({currentStaff.role}).
                Care Workers are restricted from accessing Reassessments, CRM Pipeline, and Regulatory Compliance pages. These modules require Manager or Owner administrative privileges.
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
