import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Pill,
  FileText,
  AlertCircle,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  Lock,
  User,
  Cigarette,
  Bath,
  Utensils,
  ChevronRight,
  AlertTriangle,
  ListChecks,
  Hand,
  SkipForward,
} from 'lucide-react';
import {
  Resident,
  MedicationOrder,
  MedicationAdministration,
  DailyReport,
  ShiftChecklist,
  Staff,
  ShiftAssignment,
  ShiftTaskAssignment,
} from '../types';

interface TodayViewProps {
  currentStaff: Staff;
  activeAssignment: ShiftAssignment | undefined;
  residents: Resident[];
  medOrders: MedicationOrder[];
  medAdmins: MedicationAdministration[];
  dailyReports: DailyReport[];
  shiftChecklists: ShiftChecklist[];
  shiftTasks: ShiftTaskAssignment[];
  onOpenMedPass: (order: MedicationOrder, resident: Resident) => void;
  onOpenDailyReport: (resident: Resident, existingReport?: DailyReport) => void;
  onOpenNewIncident: (residentId?: string) => void;
  onOpenShiftChecklist: () => void;
  onNavigateToAI: () => void;
  onClaimTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onSkipTask: (taskId: string, reason: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  currentStaff,
  activeAssignment,
  residents,
  medOrders,
  medAdmins,
  dailyReports,
  shiftChecklists,
  shiftTasks,
  onOpenMedPass,
  onOpenDailyReport,
  onOpenNewIncident,
  onOpenShiftChecklist,
  onNavigateToAI,
  onClaimTask,
  onCompleteTask,
  onSkipTask,
}) => {
  const [skippingTaskId, setSkippingTaskId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'meds' | 'reports' | 'checklist'>('all');

  const isShiftActive = activeAssignment?.is_active ?? false;
  const todayDate = new Date().toISOString().split('T')[0];

  // Latest end-of-shift checklist status
  const todayChecklist = shiftChecklists.find((c) => c.date === todayDate);

  // Compute pending med passes
  const pendingMedTasks = medOrders.flatMap((order) => {
    const resident = residents.find((r) => r.id === order.resident_id);
    if (!resident || resident.status !== 'active') return [];

    return order.schedule_times
      .filter((t) => t !== 'PRN')
      .map((scheduledTime) => {
        const isDone = medAdmins.some(
          (a) =>
            a.order_id === order.id &&
            a.scheduled_time === scheduledTime &&
            a.timestamp.startsWith(todayDate)
        );

        return {
          type: 'med_pass' as const,
          id: `${order.id}-${scheduledTime}`,
          time: scheduledTime,
          title: `Med Pass: ${order.drug_name} (${order.dose})`,
          subtitle: `Resident: ${resident.full_name} · Room ${resident.room_number}`,
          resident,
          order,
          isCompleted: isDone,
        };
      });
  });

  // Compute daily documentation tasks per active resident
  const dailyDocTasks = residents
    .filter((r) => r.status === 'active')
    .map((resident) => {
      const existingReport = dailyReports.find(
        (dr) => dr.resident_id === resident.id && dr.date === todayDate
      );
      const isSubmitted = existingReport?.status === 'submitted';

      return {
        type: 'daily_doc' as const,
        id: `doc-${resident.id}`,
        title: `Shift Documentation: ${resident.full_name}`,
        subtitle: `Room ${resident.room_number} · ${resident.level_of_care} · ${
          resident.on_cigarette_program ? '🚬 On Cigarette Program' : 'No smoking allotment'
        }`,
        resident,
        existingReport,
        isCompleted: isSubmitted,
        isDraft: existingReport?.status === 'draft',
      };
    });

  const allTasks = [
    ...pendingMedTasks,
    ...dailyDocTasks,
  ].sort((a, b) => (a.isCompleted === b.isCompleted ? 0 : a.isCompleted ? 1 : -1));

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.isCompleted).length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Shift Banner & Safety Attestation Alert */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Today’s Work Queue</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Shift-Scoped Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Logged in as <strong className="text-slate-700">{currentStaff.name}</strong> ({currentStaff.role}).{' '}
              {isShiftActive ? (
                <span className="text-emerald-600 font-medium">
                  Active Shift: Day Shift (07:00 – 19:00). Shift-scoped access granted to all 18 beds in Hi Haven Manor.
                </span>
              ) : (
                <span className="text-rose-600 font-medium">
                  You are currently clocked out. Clock in via the top bar to record documentation and administer medications.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="quick-incident-btn"
              onClick={() => onOpenNewIncident()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Report Incident</span>
            </button>

            <button
              id="shift-checklist-quick-btn"
              onClick={onOpenShiftChecklist}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition shadow-xs ${
                todayChecklist?.medication_storage_secured
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {todayChecklist?.medication_storage_secured
                  ? 'Med Cart Locked ✓ (Attested)'
                  : 'Log Med Cart Lock Attestation'}
              </span>
            </button>

            <button
              id="ai-handover-quick-btn"
              onClick={onNavigateToAI}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 transition shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Shift Handover Brief</span>
            </button>
          </div>
        </div>

        {/* NL AG Priority Callout: Medication Cart Security Attestation */}
        {!todayChecklist?.medication_storage_secured && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <strong className="font-semibold">NL Auditor General Compliance Mandate:</strong> In audited small care homes, unattended or unlocked medication carts were cited as a primary finding. Staff must explicitly verify that medication storage is double-locked before shift completion.
              <button
                onClick={onOpenShiftChecklist}
                className="ml-2 underline font-semibold text-amber-950 hover:text-amber-800"
              >
                Sign Attestation Now &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-slate-600">Today’s Shift Execution Progress</span>
            <span className="font-bold text-slate-900">
              {completedTasks} / {totalTasks} Tasks Completed ({completionPercentage}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Shared Shift Duties — the actual task board for whoever's on shift.
          Tasks aren't pre-assigned to one person; 2-3 day staff split them
          up (one does showers, another does meds or breakfast) and claim
          whichever they're picking up. */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-emerald-600" />
            Shared Shift Duties
          </h2>
          <span className="text-[11px] text-slate-400">
            {shiftTasks.filter((t) => t.status === 'completed' || t.status === 'skipped').length}/{shiftTasks.length} done
          </span>
        </div>
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {shiftTasks.length === 0 ? (
            <p className="p-6 text-xs text-slate-400 text-center">No shift tasks generated yet — clock in to start today's shift.</p>
          ) : (
            shiftTasks.map((task) => {
              const resident = task.resident_id ? residents.find((r) => r.id === task.resident_id) : undefined;
              const isDone = task.status === 'completed' || task.status === 'skipped';

              return (
                <div key={task.id} className={`p-3.5 text-xs flex items-center justify-between gap-3 ${isDone ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        task.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : task.status === 'skipped'
                          ? 'bg-slate-100 text-slate-500'
                          : task.status === 'claimed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {task.task_name}
                        {resident && <span className="text-slate-500 font-normal"> · {resident.full_name}</span>}
                      </div>
                      {task.status === 'claimed' && (
                        <div className="text-[11px] text-blue-600 mt-0.5">Claimed by {task.claimed_by_name}</div>
                      )}
                      {task.status === 'completed' && (
                        <div className="text-[11px] text-emerald-600 mt-0.5">Done by {task.completed_by_name}</div>
                      )}
                      {task.status === 'skipped' && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Skipped by {task.completed_by_name}: {task.notes}</div>
                      )}
                    </div>
                  </div>

                  {!isDone && (
                    <div className="shrink-0 flex items-center gap-1.5">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => onClaimTask(task.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                          title="Claim"
                        >
                          <Hand className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => onCompleteTask(task.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition"
                      >
                        Done
                      </button>
                      <button
                        onClick={() => setSkippingTaskId(skippingTaskId === task.id ? null : task.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                        title="Skip"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {skippingTaskId === task.id && (
                    <div className="w-full flex items-center gap-2 mt-2">
                      <input
                        autoFocus
                        value={skipReason}
                        onChange={(e) => setSkipReason(e.target.value)}
                        placeholder="Reason for skipping..."
                        className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() => {
                          if (!skipReason.trim()) return;
                          onSkipTask(task.id, skipReason.trim());
                          setSkippingTaskId(null);
                          setSkipReason('');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 transition"
                      >
                        Confirm Skip
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterType === 'all'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Tasks ({allTasks.length})
        </button>
        <button
          onClick={() => setFilterType('meds')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterType === 'meds'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Scheduled Med Passes ({pendingMedTasks.length})
        </button>
        <button
          onClick={() => setFilterType('reports')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            filterType === 'reports'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Daily Shift Logs ({dailyDocTasks.length})
        </button>
      </div>

      {/* Tasks Queue Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Med Passes Column */}
        {(filterType === 'all' || filterType === 'meds') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-blue-600" />
                <span>eMAR Medication Passes</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {pendingMedTasks.filter((t) => t.isCompleted).length}/{pendingMedTasks.length} Passed
              </span>
            </div>

            <div className="space-y-2">
              {pendingMedTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => !task.isCompleted && onOpenMedPass(task.order, task.resident)}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                    task.isCompleted
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        task.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {task.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{task.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                          {task.time}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-0.5">{task.subtitle}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Indication: {task.order.indication} · Route: {task.order.route}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    {task.isCompleted ? (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                        Administered
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded hover:bg-blue-100 flex items-center gap-1">
                        Administer <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Reports Column */}
        {(filterType === 'all' || filterType === 'reports') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Resident Shift Documentation</span>
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {dailyDocTasks.filter((t) => t.isCompleted).length}/{dailyDocTasks.length} Submitted
              </span>
            </div>

            <div className="space-y-2">
              {dailyDocTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onOpenDailyReport(task.resident, task.existingReport)}
                  className={`p-3.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                    task.isCompleted
                      ? 'bg-slate-50 border-slate-200'
                      : task.isDraft
                      ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400 hover:shadow-xs cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        task.isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : task.isDraft
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {task.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <span>{task.title}</span>
                        {task.isCompleted && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Locked (Submitted)
                          </span>
                        )}
                        {task.isDraft && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Draft
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-0.5">{task.subtitle}</div>
                      {task.existingReport && (
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600">
                          <span className="flex items-center gap-1">
                            <Utensils className="w-3 h-3 text-slate-400" />
                            Breakfast: {task.existingReport.meals.breakfast.eaten}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="w-3 h-3 text-slate-400" />
                            Shower: {task.existingReport.shower_taken ? 'Yes' : 'No'}
                          </span>
                          {task.resident.on_cigarette_program && (
                            <span className="flex items-center gap-1 text-slate-700">
                              <Cigarette className="w-3 h-3 text-slate-400" />
                              Count: {task.existingReport.cigarette_count}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ml-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded flex items-center gap-1 ${
                        task.isCompleted
                          ? 'text-slate-600 bg-slate-100'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {task.isCompleted ? 'View Locked Record' : task.isDraft ? 'Resume Draft' : 'Start Log'}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
