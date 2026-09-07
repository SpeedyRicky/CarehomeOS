import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Phone,
  Building,
  DollarSign,
  Heart,
  Sparkles,
  X,
} from 'lucide-react';
import { Prospect, PipelineStage, Staff } from '../types';

interface CRMViewProps {
  prospects: Prospect[];
  currentStaff: Staff;
  onConvertProspect: (data: {
    prospectId: string;
    roomNumber: string;
    levelOfCare: string;
    actorId: string;
    actorName: string;
  }) => void;
}

const PIPELINE_STAGES: PipelineStage[] = [
  'Referral',
  'Assessment',
  'Tour',
  'Application',
  'Accepted',
  'Move-in',
];

export const CRMView: React.FC<CRMViewProps> = ({
  prospects,
  currentStaff,
  onConvertProspect,
}) => {
  const [activeConvertModal, setActiveConvertModal] = useState<Prospect | null>(null);
  const [roomNumber, setRoomNumber] = useState('114');
  const [levelOfCare, setLevelOfCare] = useState('Level 2');

  const handleConfirmConvert = () => {
    if (!activeConvertModal) return;
    onConvertProspect({
      prospectId: activeConvertModal.id,
      roomNumber,
      levelOfCare,
      actorId: currentStaff.id,
      actorName: currentStaff.name,
    });
    setActiveConvertModal(null);
  };

  return (
    <div className="space-y-6">
      {/* CRM Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Resident Intake & CRM Pipeline
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Lifecycle Spine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              The prospect record doesn't die on move-in; it anchors the resident record. Converting an accepted prospect automatically instantiates a resident record, room assignment, and schedules initial compliance reassessments.
            </p>
          </div>

          <div className="text-xs text-slate-600 font-medium">
            Active Capacity: <strong className="text-slate-900">5 / 18 Beds Occupied (27.7%)</strong>
          </div>
        </div>
      </div>

      {/* Kanban Stages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageProspects = prospects.filter((p) => p.pipeline_stage === stage);

          return (
            <div
              key={stage}
              className="bg-slate-50 rounded-xl border border-slate-200 p-3 min-w-[200px] flex flex-col"
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 tracking-wide">{stage}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white font-mono font-bold text-slate-600 border border-slate-200">
                  {stageProspects.length}
                </span>
              </div>

              <div className="space-y-2 flex-1">
                {stageProspects.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-4 italic">No prospects</p>
                ) : (
                  stageProspects.map((prospect) => (
                    <div
                      key={prospect.id}
                      className="bg-white rounded-lg border border-slate-200 p-3 text-xs shadow-xs space-y-2 hover:border-slate-300 transition"
                    >
                      <div className="font-bold text-slate-900">{prospect.full_name}</div>
                      <div className="text-slate-500 text-[11px]">
                        Age {prospect.age} · Funding: {prospect.funding_status}
                      </div>
                      <div className="text-slate-600 text-[11px] flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{prospect.contact_phone}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                        "{prospect.notes}"
                      </p>

                      {stage === 'Accepted' && (
                        <button
                          onClick={() => setActiveConvertModal(prospect)}
                          className="w-full mt-2 py-1.5 px-2 rounded-md bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-700 transition flex items-center justify-center gap-1 shadow-xs"
                        >
                          <span>Convert to Resident</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {stage === 'Move-in' && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded w-full justify-center">
                          <CheckCircle2 className="w-3 h-3" /> Moved In
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Convert Prospect to Resident Modal */}
      {activeConvertModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Convert Prospect to Resident
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Fires immutable PROSPECT_CONVERTED event
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveConvertModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">
                  {activeConvertModal.full_name}
                </div>
                <div className="text-slate-600 mt-0.5">
                  Age {activeConvertModal.age} · Funding: {activeConvertModal.funding_status}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Bed / Room Number *
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Level of Care *
                </label>
                <select
                  value={levelOfCare}
                  onChange={(e) => setLevelOfCare(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium"
                >
                  <option value="Level 1">Level 1 (Supervised Living)</option>
                  <option value="Level 2">Level 2 (Personal Care Assistance)</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-emerald-900">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Automated Life-Cycle Actions:</span>
                </div>
                <ul className="list-disc pl-4 text-[11px] space-y-0.5 text-emerald-800">
                  <li>Creates permanent Resident document linked to Prospect ID</li>
                  <li>Initializes 6-month CA-NL compliance reassessment schedule</li>
                  <li>Updates pipeline stage to 'Move-in'</li>
                  <li>Generates tamper-evident audit trail event in PostgreSQL</li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveConvertModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmConvert}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Execute Conversion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
