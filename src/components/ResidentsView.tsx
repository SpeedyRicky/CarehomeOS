import React, { useState } from 'react';
import {
  User,
  HeartPulse,
  AlertCircle,
  FileText,
  Pill,
  Calendar,
  ShieldAlert,
  Cigarette,
  ChevronRight,
  Phone,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Resident, CarePlan, Reassessment, Staff } from '../types';

interface ResidentsViewProps {
  residents: Resident[];
  carePlans: CarePlan[];
  reassessments: Reassessment[];
  currentStaff: Staff;
  onOpenDailyReport: (resident: Resident) => void;
  onOpenNewIncident: (residentId: string) => void;
  onNavigateToReassessments: () => void;
}

export const ResidentsView: React.FC<ResidentsViewProps> = ({
  residents,
  carePlans,
  reassessments,
  currentStaff,
  onOpenDailyReport,
  onOpenNewIncident,
  onNavigateToReassessments,
}) => {
  const [selectedResidentId, setSelectedResidentId] = useState<string>(residents[0]?.id || '');
  const [filterQuery, setFilterQuery] = useState('');

  const selectedResident = residents.find((r) => r.id === selectedResidentId) || residents[0];
  const activeCarePlan = carePlans.find(
    (cp) => cp.resident_id === selectedResident?.id && (cp.status === 'active' || cp.is_active)
  );
  const residentReassessments = reassessments.filter(
    (re) => re.resident_id === selectedResident?.id
  );
  const overdueReassessment = residentReassessments.find((r) => r.status === 'overdue');

  const filteredResidents = residents.filter(
    (r) =>
      r.full_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      r.room_number.includes(filterQuery) ||
      r.level_of_care.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Resident Directory & Comprehensive Care Plans
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Hi Haven Manor (18 Beds)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active ADL protocols, behavioral triggers, mobility needs, and physician care orders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name, room, level..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white w-64"
            />
          </div>
        </div>
      </div>

      {/* Grid: Master / Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Residents List */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span>Roster ({filteredResidents.length} Residents)</span>
            <span className="text-[10px] text-slate-400">Select to inspect care plan</span>
          </div>

          <div className="space-y-2">
            {filteredResidents.map((r) => {
              const isSelected = r.id === selectedResident?.id;
              const hasOverdue = reassessments.some(
                (re) => re.resident_id === r.id && re.status === 'overdue'
              );

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedResidentId(r.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <span>{r.full_name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 text-[11px] font-mono">
                          Rm {r.room_number}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {r.level_of_care} · Age {r.age} · Funding: {r.funding_status}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {hasOverdue && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold block mb-1">
                          Overdue Reassessment
                        </span>
                      )}
                      {r.on_cigarette_program && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                          🚬 Cigarettes
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Detailed Care Plan Profile */}
        <div className="lg:col-span-8">
          {selectedResident ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">{selectedResident.full_name}</h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold">
                      Room {selectedResident.room_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                      {selectedResident.level_of_care}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">DOB / Age</span>
                      <span>{selectedResident.dob} ({selectedResident.age} y/o)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Physician</span>
                      <span>{selectedResident.primary_physician}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission Date</span>
                      <span>{selectedResident.admission_date}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Emergency Contact</span>
                      <span>{selectedResident.emergency_contact.name} ({selectedResident.emergency_contact.relationship}) · {selectedResident.emergency_contact.phone}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Allergies</span>
                      <span className="text-rose-700 font-semibold">{selectedResident.allergies.join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Care Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => onOpenDailyReport(selectedResident)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Daily Shift Log</span>
                  </button>
                  <button
                    onClick={() => onOpenNewIncident(selectedResident.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Report Incident</span>
                  </button>
                </div>
              </div>

              {/* Overdue Reassessment Warning Callout */}
              {overdueReassessment && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 text-rose-900">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <strong className="font-bold">CA-NL Reassessment Overdue:</strong> Due date was{' '}
                      <strong>{overdueReassessment.due_date}</strong>. NL Auditor General cited overdue reassessments as a pervasive inspection finding in small homes.
                    </div>
                  </div>
                  {currentStaff.role !== 'Care Worker' ? (
                    <button
                      onClick={onNavigateToReassessments}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 shrink-0 shadow-xs"
                    >
                      Complete Reassessment &rarr;
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold shrink-0 border border-rose-200">
                      Manager Action Required
                    </span>
                  )}
                </div>
              )}

              {/* Active Care Plan Details */}
              {activeCarePlan ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-emerald-600" />
                      <span>Active Care Plan (v{activeCarePlan.version}) — Signed: {activeCarePlan.signed_at || activeCarePlan.created_at}</span>
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Signed by {activeCarePlan.signed_by_manager || 'Manager'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* ADL & Goals */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900">ADL Goals & Support Level</div>
                      <div className="text-slate-700">
                        {Array.isArray(activeCarePlan.adl_goals)
                          ? activeCarePlan.adl_goals.join(', ')
                          : activeCarePlan.adl_goals}
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobility & Transfers</span>
                        <span className="text-slate-800">{activeCarePlan.mobility_needs || activeCarePlan.mobility_transfer_notes}</span>
                      </div>
                    </div>

                    {/* Dietary & Behavioral */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="font-bold text-slate-900">Dietary & Behavioral Triggers</div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Diet Needs & Texture</span>
                        <span className="text-slate-800">{activeCarePlan.dietary_needs || activeCarePlan.dietary_notes}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Behavioral Management / Triggers</span>
                        <span className="text-slate-800">{activeCarePlan.behavioral_triggers}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                  No active care plan on file for this resident.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select a resident to inspect care plan and clinical profile.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
