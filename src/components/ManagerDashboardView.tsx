import React, { useState } from 'react';
import {
  ClipboardList,
  FileWarning,
  AlertCircle,
  CalendarClock,
  Users,
  Pill,
  ShieldAlert,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Staff,
  Resident,
  IncidentReport,
  Reassessment,
  DailyReport,
  ShiftTaskAssignment,
  ExceptionRecord,
  ExceptionSeverity,
} from '../types';

interface ManagerDashboardViewProps {
  currentStaff: Staff;
  residents: Resident[];
  incidents: IncidentReport[];
  reassessments: Reassessment[];
  dailyReports: DailyReport[];
  shiftTasks: ShiftTaskAssignment[];
  exceptions: ExceptionRecord[];
  onReviewException: (exceptionId: string, status: 'acknowledged' | 'resolved', correctiveAction?: string) => void;
  onNavigateToIncidents: () => void;
  onNavigateToTasks: () => void;
}

const severityStyles: Record<ExceptionSeverity, string> = {
  high: 'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: 'rose' | 'amber' | 'blue' | 'slate' | 'emerald';
  onClick?: () => void;
}> = ({ label, value, icon, tone, onClick }) => {
  const toneClasses: Record<string, string> = {
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    slate: 'text-slate-600',
    emerald: 'text-emerald-600',
  };
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-xs ${onClick ? 'cursor-pointer hover:border-slate-300 transition' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={toneClasses[tone]}>{icon}</span>
      </div>
      <div className={`text-2xl font-bold mt-2 ${toneClasses[tone]}`}>{value}</div>
    </div>
  );
};

const typeLabels: Record<string, string> = {
  missed_task: 'Missed Task',
  missed_medication: 'Missed Medication',
  overdue_reassessment: 'Overdue Reassessment',
  expiring_credential: 'Expiring Credential',
  understaffed_shift: 'Understaffed Shift',
};

export const ManagerDashboardView: React.FC<ManagerDashboardViewProps> = ({
  currentStaff,
  residents,
  incidents,
  reassessments,
  dailyReports,
  shiftTasks,
  exceptions,
  onReviewException,
  onNavigateToIncidents,
  onNavigateToTasks,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [correctiveDraft, setCorrectiveDraft] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const activeResidents = residents.filter((r) => r.status === 'active');

  const pendingTasks = shiftTasks.filter((t) => t.status === 'pending' || t.status === 'claimed');
  const missingDocs = activeResidents.filter(
    (r) => !dailyReports.some((d) => d.resident_id === r.id && d.date === today && d.status === 'submitted')
  );
  const openIncidents = incidents.filter((i) => i.status === 'submitted');
  const overdueReviews = reassessments.filter((r) => r.status === 'overdue' || (r.status === 'scheduled' && r.due_date < today));

  const openExceptions = exceptions.filter((e) => e.status === 'open');
  const staffIssues = openExceptions.filter((e) => e.type === 'understaffed_shift');
  const medExceptions = openExceptions.filter((e) => e.type === 'missed_medication');
  const complianceIssues = openExceptions.filter((e) => e.type === 'expiring_credential' || e.type === 'overdue_reassessment');

  const handleSubmitReview = (exceptionId: string, status: 'acknowledged' | 'resolved') => {
    onReviewException(exceptionId, status, correctiveDraft.trim() || undefined);
    setCorrectiveDraft('');
    setExpandedId(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Manager Dashboard</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
            What do I need to deal with today?
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Signed in as <strong className="text-slate-700">{currentStaff.name}</strong> ({currentStaff.role}). Everything below is pulled live from today's tasks, documentation, incidents, and detected exceptions.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Tasks" value={pendingTasks.length} icon={<ClipboardList className="w-4 h-4" />} tone="blue" onClick={onNavigateToTasks} />
        <StatCard label="Missed Documentation" value={missingDocs.length} icon={<FileWarning className="w-4 h-4" />} tone="amber" />
        <StatCard label="Open Incidents" value={openIncidents.length} icon={<AlertCircle className="w-4 h-4" />} tone="rose" onClick={onNavigateToIncidents} />
        <StatCard label="Overdue Reviews" value={overdueReviews.length} icon={<CalendarClock className="w-4 h-4" />} tone="rose" />
        <StatCard label="Staff Issues" value={staffIssues.length} icon={<Users className="w-4 h-4" />} tone="amber" />
        <StatCard label="Medication Exceptions" value={medExceptions.length} icon={<Pill className="w-4 h-4" />} tone="rose" />
        <StatCard label="Compliance Issues" value={complianceIssues.length} icon={<ShieldAlert className="w-4 h-4" />} tone="amber" />
        <StatCard label="Open Exceptions (Total)" value={openExceptions.length} icon={<ShieldAlert className="w-4 h-4" />} tone="slate" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Exceptions Requiring Attention</h2>
          <span className="text-[11px] text-slate-400">{openExceptions.length} open</span>
        </div>
        <div className="divide-y divide-slate-100">
          {openExceptions.length === 0 ? (
            <p className="p-6 text-xs text-slate-400 text-center">No open exceptions right now. Nice work.</p>
          ) : (
            openExceptions.map((exc) => {
              const isExpanded = expandedId === exc.id;
              return (
                <div key={exc.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase shrink-0 mt-0.5 ${severityStyles[exc.severity]}`}>
                        {exc.severity}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {typeLabels[exc.type] || exc.type}
                          {exc.resident_name && <span className="text-slate-500 font-normal"> · {exc.resident_name}</span>}
                          {exc.staff_name && <span className="text-slate-500 font-normal"> · {exc.staff_name}</span>}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{exc.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : exc.id)}
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-1 space-y-2">
                      <textarea
                        value={correctiveDraft}
                        onChange={(e) => setCorrectiveDraft(e.target.value)}
                        placeholder="Corrective action taken (optional)..."
                        rows={2}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSubmitReview(exc.id, 'acknowledged')}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold hover:bg-slate-200 transition"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => handleSubmitReview(exc.id, 'resolved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 transition flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Resolved
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
