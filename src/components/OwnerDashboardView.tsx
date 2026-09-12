import React from 'react';
import {
  HeartPulse,
  CalendarClock,
  Pill,
  Users,
  BadgeAlert,
  AlertCircle,
  Wrench,
  ShieldCheck,
  Building2,
  DollarSign,
} from 'lucide-react';
import {
  Home,
  Resident,
  Staff,
  ShiftAssignment,
  IncidentReport,
  ExceptionRecord,
} from '../types';

interface OwnerDashboardViewProps {
  home: Home;
  residents: Resident[];
  staff: Staff[];
  shiftAssignments: ShiftAssignment[];
  incidents: IncidentReport[];
  exceptions: ExceptionRecord[];
}

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; tone: 'rose' | 'amber' | 'blue' | 'slate' | 'emerald' }> = ({
  label,
  value,
  icon,
  tone,
}) => {
  const toneClasses: Record<string, string> = {
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    slate: 'text-slate-600',
    emerald: 'text-emerald-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={toneClasses[tone]}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold mt-2 ${toneClasses[tone]}`}>{value}</div>
    </div>
  );
};

export const OwnerDashboardView: React.FC<OwnerDashboardViewProps> = ({
  home,
  residents,
  staff,
  shiftAssignments,
  incidents,
  exceptions,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const activeResidents = residents.filter((r) => r.status === 'active');
  const openExceptions = exceptions.filter((e) => e.status === 'open');

  const residentsRequiringAttention = new Set(
    openExceptions.filter((e) => e.resident_id && (e.severity === 'high' || e.severity === 'medium')).map((e) => e.resident_id)
  ).size;
  const overdueAssessments = openExceptions.filter((e) => e.type === 'overdue_reassessment').length;
  const medicationIssues = openExceptions.filter((e) => e.type === 'missed_medication').length;
  const staffShortages = openExceptions.filter((e) => e.type === 'understaffed_shift').length;
  const expiringCerts = openExceptions.filter((e) => e.type === 'expiring_credential').length;

  const openIncidents = incidents.filter((i) => i.status === 'submitted');
  const correctiveActionsLogged = exceptions.filter((e) => e.status === 'resolved' && e.corrective_action).length;

  // A simple 0-100 readiness score: start at 100, dock points per open
  // exception weighted by severity. This is a heuristic, not a regulator's
  // formula — it's meant to give the Owner a single "are we ready if
  // someone walks in today" number, not to represent any official rating.
  const severityPenalty: Record<string, number> = { high: 8, medium: 4, low: 1 };
  const readinessScore = Math.max(
    0,
    100 - openExceptions.reduce((sum, e) => sum + (severityPenalty[e.severity] || 1), 0) - openIncidents.length * 5
  );

  const occupancyPct = home.capacity > 0 ? Math.round((activeResidents.length / home.capacity) * 100) : 0;

  const staffOnDutyToday = new Set(shiftAssignments.filter((a) => a.date === today).map((a) => a.staff_id)).size;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Owner Dashboard</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            How is my home doing?
          </span>
        </div>
        <p className="text-xs text-slate-500">
          {home.name} · {activeResidents.length}/{home.capacity} beds occupied · {staff.length} staff on roster.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Residents Needing Attention" value={residentsRequiringAttention} icon={<HeartPulse className="w-4 h-4" />} tone="rose" />
        <StatCard label="Overdue Assessments" value={overdueAssessments} icon={<CalendarClock className="w-4 h-4" />} tone="amber" />
        <StatCard label="Medication Issues" value={medicationIssues} icon={<Pill className="w-4 h-4" />} tone="rose" />
        <StatCard label="Staff Shortages" value={staffShortages} icon={<Users className="w-4 h-4" />} tone="amber" />
        <StatCard label="Expiring Certifications" value={expiringCerts} icon={<BadgeAlert className="w-4 h-4" />} tone="amber" />
      </div>

      {/* Business & Compliance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Business & Compliance</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <AlertCircle className="w-3.5 h-3.5" /> Open Incidents
            </div>
            <div className="text-xl font-bold text-slate-900">{openIncidents.length}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <Wrench className="w-3.5 h-3.5" /> Corrective Actions Logged
            </div>
            <div className="text-xl font-bold text-slate-900">{correctiveActionsLogged}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Inspection Readiness
            </div>
            <div className={`text-xl font-bold ${readinessScore >= 80 ? 'text-emerald-600' : readinessScore >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
              {readinessScore}/100
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <Users className="w-3.5 h-3.5" /> Staffing Today
            </div>
            <div className="text-xl font-bold text-slate-900">{staffOnDutyToday} on duty</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <Building2 className="w-3.5 h-3.5" /> Occupancy
            </div>
            <div className="text-xl font-bold text-slate-900">{occupancyPct}%</div>
            <div className="text-[10px] text-slate-400">{activeResidents.length} of {home.capacity} beds</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              <DollarSign className="w-3.5 h-3.5" /> Revenue
            </div>
            <div className="text-sm font-semibold text-slate-400">Billing not yet configured</div>
          </div>
        </div>
      </div>
    </div>
  );
};
