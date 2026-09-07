import React, { useState } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileCheck,
  PlusCircle,
  X,
  User,
} from 'lucide-react';
import { Reassessment, Resident, Staff } from '../types';

interface ReassessmentsViewProps {
  reassessments: Reassessment[];
  residents: Resident[];
  currentStaff: Staff;
  onCompleteReassessment: (data: {
    reassessmentId: string;
    completedBy: string;
    outcomeNotes: string;
    newCarePlanCreated: boolean;
  }) => void;
}

export const ReassessmentsView: React.FC<ReassessmentsViewProps> = ({
  reassessments,
  residents,
  currentStaff,
  onCompleteReassessment,
}) => {
  const [activeModalReassessment, setActiveModalReassessment] = useState<Reassessment | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [createNewCarePlan, setCreateNewCarePlan] = useState(true);

  const handleOpenCompleteModal = (reassessment: Reassessment) => {
    setActiveModalReassessment(reassessment);
    setOutcomeNotes(
      reassessment.outcome_notes ||
        'Comprehensive 6-month reassessment completed per CA-NL Operational Standards. ADL function, cognition, skin integrity, and medication regimen evaluated.'
    );
    setCreateNewCarePlan(true);
  };

  const handleConfirmCompletion = () => {
    if (!activeModalReassessment) return;
    onCompleteReassessment({
      reassessmentId: activeModalReassessment.id,
      completedBy: currentStaff.name,
      outcomeNotes,
      newCarePlanCreated: createNewCarePlan,
    });
    setActiveModalReassessment(null);
  };

  const overdueList = reassessments.filter((r) => r.status === 'overdue');
  const scheduledList = reassessments.filter((r) => r.status === 'scheduled');
  const completedList = reassessments.filter((r) => r.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Resident Reassessment Tracker
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                CA-NL Operational Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Provincial mandate requires comprehensive reassessment every 6 months for Level 1/2 residents. Tracks deadlines and clears audit backlog.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold">
              {overdueList.length} Overdue Backlog
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-700 font-medium">
              {scheduledList.length} Scheduled
            </div>
          </div>
        </div>

        {/* NL AG Priority Alert Box */}
        {overdueList.length > 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950">
              <strong className="font-bold">NL Auditor General Compliance Finding:</strong> The provincial Auditor General highlighted a recurring finding across Newfoundland care homes regarding overdue resident reassessments. Complete pending reassessments immediately to maintain licensing compliance.
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {/* Overdue Section */}
        {overdueList.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>Priority Action: Overdue Reassessments ({overdueList.length})</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overdueList.map((item) => {
                const resident = residents.find((r) => r.id === item.resident_id);

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-rose-300 bg-rose-50/40 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {resident?.full_name}
                          </div>
                          <div className="text-xs text-slate-600">
                            Room {resident?.room_number} · {resident?.level_of_care} · Funding: {resident?.funding_status}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold">
                          OVERDUE
                        </span>
                      </div>

                      <div className="mt-3 text-xs text-rose-900 bg-rose-100/70 p-2.5 rounded-lg">
                        <strong>Target Due Date:</strong> {item.due_date}
                        <div className="mt-0.5 text-[11px] text-rose-800">
                          {item.outcome_notes}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-rose-200 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Primary: {resident?.primary_physician}
                      </span>
                      <button
                        onClick={() => handleOpenCompleteModal(item)}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Perform Reassessment</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheduled Upcoming Section */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Scheduled Upcoming Reassessments ({scheduledList.length})</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduledList.map((item) => {
              const resident = residents.find((r) => r.id === item.resident_id);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {resident?.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Room {resident?.room_number} · {resident?.level_of_care}
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        Scheduled
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-600">
                      <strong>Due Date:</strong> {item.due_date}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => handleOpenCompleteModal(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 flex items-center gap-1"
                    >
                      <span>Complete Early</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completed History */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Completed Reassessments ({completedList.length})</span>
          </h2>

          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {completedList.map((item) => {
              const resident = residents.find((r) => r.id === item.resident_id);

              return (
                <div key={item.id} className="p-3.5 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{resident?.full_name}</span>
                    <span className="text-slate-500 ml-2">
                      Completed on {item.completed_date} by {item.completed_by}
                    </span>
                    <p className="text-slate-600 text-[11px] mt-0.5">{item.outcome_notes}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                    Verified
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Complete Reassessment Modal */}
      {activeModalReassessment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Perform 6-Month Reassessment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    CA-NL Operational Standards Documentation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModalReassessment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-semibold text-slate-800">
                  Resident:{' '}
                  {residents.find((r) => r.id === activeModalReassessment.resident_id)?.full_name}
                </div>
                <div className="text-slate-500 mt-0.5">
                  Scheduled Due Date: {activeModalReassessment.due_date}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Reassessment Notes & Findings *
                </label>
                <textarea
                  rows={4}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  id="careplan-update"
                  checked={createNewCarePlan}
                  onChange={(e) => setCreateNewCarePlan(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <label htmlFor="careplan-update" className="text-xs text-blue-900 font-medium">
                  Update active care plan version with reassessment outcomes (Auto-generates version bump)
                </label>
              </div>

              <div className="text-[11px] text-slate-500">
                Logged by <strong>{currentStaff.name}</strong> ({currentStaff.role}). Record will be permanently recorded in immutable audit events.
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveModalReassessment(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCompletion}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Sign & Finalize Reassessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
