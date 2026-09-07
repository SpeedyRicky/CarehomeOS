import React, { useState } from 'react';
import {
  CalendarDays,
  Users,
  UserCheck,
  Clock,
  Repeat,
  Send,
  CheckCircle2,
  XCircle,
  History,
  RefreshCw,
} from 'lucide-react';
import {
  Staff,
  Shift,
  ShiftAssignment,
  ShiftChangeRequest,
  ShiftChangeRequestType,
  TimeEntry,
} from '../types';

interface ScheduleViewProps {
  currentStaff: Staff;
  allStaff: Staff[];
  shifts: Shift[];
  shiftAssignments: ShiftAssignment[];
  shiftChangeRequests: ShiftChangeRequest[];
  timeEntries: TimeEntry[];
  onSubmitShiftChangeRequest: (payload: {
    shiftAssignmentId: string;
    requestType: ShiftChangeRequestType;
    targetStaffId: string | null;
    reason: string;
  }) => void;
  onReviewShiftChangeRequest: (payload: {
    requestId: string;
    action: 'approve' | 'deny';
    reviewNotes?: string;
  }) => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('');
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  denied: 'bg-rose-50 text-rose-800 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  currentStaff,
  allStaff,
  shifts,
  shiftAssignments,
  shiftChangeRequests,
  timeEntries,
  onSubmitShiftChangeRequest,
  onReviewShiftChangeRequest,
}) => {
  const [openRequestFormFor, setOpenRequestFormFor] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<ShiftChangeRequestType>('swap');
  const [targetStaffId, setTargetStaffId] = useState<string>('');
  const [reason, setReason] = useState('');

  const isManager = currentStaff.role === 'Manager' || currentStaff.role === 'Owner';
  const todayDate = new Date().toISOString().split('T')[0];

  const myUpcomingShifts = shiftAssignments
    .filter((a) => a.staff_id === currentStaff.id && a.date >= todayDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const getShiftMeta = (shiftId: string) => shifts.find((s) => s.id === shiftId);

  const getPartners = (assignment: ShiftAssignment): Staff[] => {
    const partnerAssignments = shiftAssignments.filter(
      (a) => a.shift_id === assignment.shift_id && a.date === assignment.date && a.staff_id !== assignment.staff_id
    );
    return partnerAssignments
      .map((a) => allStaff.find((s) => s.id === a.staff_id))
      .filter((s): s is Staff => Boolean(s));
  };

  const resetRequestForm = () => {
    setOpenRequestFormFor(null);
    setRequestType('swap');
    setTargetStaffId('');
    setReason('');
  };

  const handleSubmitRequest = (assignmentId: string) => {
    if (!reason.trim()) return;
    onSubmitShiftChangeRequest({
      shiftAssignmentId: assignmentId,
      requestType,
      targetStaffId: requestType === 'swap' ? targetStaffId || null : null,
      reason: reason.trim(),
    });
    resetRequestForm();
  };

  const myRequests = shiftChangeRequests.filter((r) => r.requested_by === currentStaff.id);
  const pendingApprovals = shiftChangeRequests.filter(
    (r) => r.status === 'pending' && r.requested_by !== currentStaff.id
  );
  const myTimeEntries = timeEntries
    .filter((t) => t.staff_id === currentStaff.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Schedule</h1>
        </div>
        <p className="text-xs text-slate-500">
          Upcoming shifts for <strong className="text-slate-700">{currentStaff.name}</strong>. Each shift shows who
          else is scheduled with you, if anyone.
        </p>
      </div>

      {/* Upcoming Shifts + Partner Visibility */}
      <div className="space-y-3">
        {myUpcomingShifts.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
            No upcoming shifts scheduled.
          </div>
        )}

        {myUpcomingShifts.map((assignment) => {
          const shiftMeta = getShiftMeta(assignment.shift_id);
          const partners = getPartners(assignment);
          const isToday = assignment.date === todayDate;

          return (
            <div key={assignment.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {shiftMeta?.shift_type || 'Scheduled Shift'}
                    </span>
                    {isToday && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    <span>
                      {assignment.date} · {shiftMeta?.starts_at}–{shiftMeta?.ends_at}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setOpenRequestFormFor(openRequestFormFor === assignment.id ? null : assignment.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition self-start"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  Request Change
                </button>
              </div>

              {/* Partner Visibility */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>Shift Partner{partners.length !== 1 ? 's' : ''}</span>
                </div>
                {partners.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No partner assigned — you’re the only staff member scheduled for this shift.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {partners.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                          {initials(p.name)}
                        </div>
                        <div className="leading-tight">
                          <div className="text-xs font-semibold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Inline Shift Change Request Form */}
              {openRequestFormFor === assignment.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value as ShiftChangeRequestType)}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1.5"
                    >
                      <option value="swap">Swap with another staff member</option>
                      <option value="cover">Request coverage</option>
                      <option value="time_off">Time off</option>
                    </select>

                    {requestType === 'swap' && (
                      <select
                        value={targetStaffId}
                        onChange={(e) => setTargetStaffId(e.target.value)}
                        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5"
                      >
                        <option value="">Select staff member…</option>
                        {allStaff
                          .filter((s) => s.id !== currentStaff.id)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.role})
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for this request…"
                    rows={2}
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSubmitRequest(assignment.id)}
                      disabled={!reason.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit Request
                    </button>
                    <button
                      onClick={resetRequestForm}
                      className="px-3 py-1.5 rounded-lg text-slate-600 text-xs font-semibold hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* My Shift Change Requests */}
      {myRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-3">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            My Shift Change Requests
          </h2>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="font-semibold text-slate-800 capitalize">{r.request_type.replace('_', ' ')}</span>
                  {r.target_staff_name && <span className="text-slate-500"> with {r.target_staff_name}</span>}
                  <div className="text-slate-500 mt-0.5">{r.reason}</div>
                  {r.review_notes && (
                    <div className="text-slate-500 mt-0.5 italic">Manager note: {r.review_notes}</div>
                  )}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full border font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manager/Owner: Pending Approvals */}
      {isManager && pendingApprovals.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs">
          <h2 className="text-xs font-bold uppercase text-amber-800 tracking-wider flex items-center gap-1.5 mb-3">
            <UserCheck className="w-3.5 h-3.5" />
            Pending Shift Change Approvals
          </h2>
          <div className="space-y-2">
            {pendingApprovals.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs space-y-2">
                <div>
                  <span className="font-semibold text-slate-800">{r.requested_by_name}</span>
                  <span className="text-slate-600"> requested a </span>
                  <span className="font-semibold capitalize">{r.request_type.replace('_', ' ')}</span>
                  {r.target_staff_name && <span className="text-slate-600"> with {r.target_staff_name}</span>}
                  <div className="text-slate-600 mt-0.5">{r.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onReviewShiftChangeRequest({ requestId: r.id, action: 'approve' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => onReviewShiftChangeRequest({ requestId: r.id, action: 'deny' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Time Entries */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5 mb-3">
          <History className="w-3.5 h-3.5 text-slate-500" />
          My Recent Time Entries
        </h2>
        {myTimeEntries.length === 0 ? (
          <p className="text-xs text-slate-500">No time entries recorded yet. Clock in from the top bar to start.</p>
        ) : (
          <div className="space-y-1.5">
            {myTimeEntries.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                <span className="font-medium text-slate-700 capitalize">{t.entry_type.replace('_', ' ')}</span>
                <span className="text-slate-500">{new Date(t.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                    t.qbo_synced ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.qbo_synced ? 'Synced to QuickBooks Time' : 'Pending payroll sync'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
