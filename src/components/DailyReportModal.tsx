import React, { useState } from 'react';
import {
  FileText,
  X,
  Utensils,
  Bath,
  Cigarette,
  Eye,
  CheckCircle2,
  Lock,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { DailyReport, Resident, Staff } from '../types';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  currentStaff: Staff;
  existingReport?: DailyReport;
  onSaveReport: (report: DailyReport) => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({
  isOpen,
  onClose,
  resident,
  currentStaff,
  existingReport,
  onSaveReport,
}) => {
  if (!isOpen || !resident) return null;

  const todayDate = new Date().toISOString().split('T')[0];
  const isLocked = existingReport?.status === 'submitted';

  const normalizeMealEaten = (val?: string): 'All' | 'Most' | 'Half' | 'Little' | 'Refused' => {
    if (!val) return 'All';
    const lower = val.toLowerCase();
    if (lower === 'all') return 'All';
    if (lower === 'most') return 'Most';
    if (lower === 'half') return 'Half';
    if (lower === 'little' || lower === 'bites') return 'Little';
    if (lower === 'refused') return 'Refused';
    return 'All';
  };

  // Form states
  const [breakfastEaten, setBreakfastEaten] = useState<'All' | 'Most' | 'Half' | 'Little' | 'Refused'>(
    normalizeMealEaten(existingReport?.meals.breakfast.eaten)
  );
  const [lunchEaten, setLunchEaten] = useState<'All' | 'Most' | 'Half' | 'Little' | 'Refused'>(
    normalizeMealEaten(existingReport?.meals.lunch.eaten)
  );
  const [dinnerEaten, setDinnerEaten] = useState<'All' | 'Most' | 'Half' | 'Little' | 'Refused'>(
    normalizeMealEaten(existingReport?.meals.dinner.eaten)
  );

  const [showerTaken, setShowerTaken] = useState<boolean>(
    existingReport?.shower_taken ?? false
  );
  const [skinObservations, setSkinObservations] = useState<string>(
    existingReport?.skin_observations || ''
  );

  const [cigaretteCount, setCigaretteCount] = useState<number>(
    existingReport?.cigarette_count ?? 0
  );
  const [cigaretteTimes, setCigaretteTimes] = useState<string[]>(
    existingReport?.cigarette_times || []
  );

  const [generalObservations, setGeneralObservations] = useState<string>(
    existingReport?.general_observations || ''
  );

  const handleAddCigaretteTime = () => {
    if (isLocked) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setCigaretteTimes([...cigaretteTimes, now]);
    setCigaretteCount(cigaretteCount + 1);
  };

  const handleSave = (status: 'draft' | 'submitted') => {
    const report: DailyReport = {
      id: existingReport?.id || `dr-${resident.id}-${todayDate}`,
      resident_id: resident.id,
      date: todayDate,
      shift_id: 'shift-day-today',
      authored_by: currentStaff.id,
      authored_by_name: currentStaff.name,
      status,
      meals: {
        breakfast: { offered: true, eaten: breakfastEaten },
        lunch: { offered: true, eaten: lunchEaten },
        dinner: { offered: true, eaten: dinnerEaten },
      },
      shower_taken: showerTaken,
      skin_observations: skinObservations,
      cigarette_count: cigaretteCount,
      cigarette_times: cigaretteTimes,
      general_observations: generalObservations,
      created_at: existingReport?.created_at || new Date().toISOString(),
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    };

    onSaveReport(report);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Daily Shift Documentation: {resident.full_name}
                </h3>
                {isLocked && (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Locked Record
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Room {resident.room_number} · {resident.level_of_care} · Date: {todayDate}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Meals Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-amber-600" />
              <span>Meals Offered & Consumed</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Breakfast</label>
                <select
                  disabled={isLocked}
                  value={breakfastEaten}
                  onChange={(e: any) => setBreakfastEaten(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white disabled:bg-slate-100"
                >
                  <option value="All">All (100%)</option>
                  <option value="Most">Most (75%)</option>
                  <option value="Half">Half (50%)</option>
                  <option value="Little">Little (25%)</option>
                  <option value="Refused">Refused</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lunch</label>
                <select
                  disabled={isLocked}
                  value={lunchEaten}
                  onChange={(e: any) => setLunchEaten(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white disabled:bg-slate-100"
                >
                  <option value="All">All (100%)</option>
                  <option value="Most">Most (75%)</option>
                  <option value="Half">Half (50%)</option>
                  <option value="Little">Little (25%)</option>
                  <option value="Refused">Refused</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dinner</label>
                <select
                  disabled={isLocked}
                  value={dinnerEaten}
                  onChange={(e: any) => setDinnerEaten(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white disabled:bg-slate-100"
                >
                  <option value="All">All (100%)</option>
                  <option value="Most">Most (75%)</option>
                  <option value="Half">Half (50%)</option>
                  <option value="Little">Little (25%)</option>
                  <option value="Refused">Refused</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shower & Skin Observation Section */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Bath className="w-4 h-4 text-blue-600" />
                <span>Personal Care & Skin Check</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-700">Shower Completed:</label>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => setShowerTaken(!showerTaken)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                    showerTaken ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {showerTaken ? 'Yes (Completed)' : 'No / Scheduled'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Skin Integrity / Pressure Injury Observations
              </label>
              <textarea
                disabled={isLocked}
                rows={2}
                value={skinObservations}
                onChange={(e) => setSkinObservations(e.target.value)}
                placeholder="e.g. Skin warm and dry. Intact, no redness over bony prominences."
                className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Cigarette Program (If Resident enrolled) */}
          {resident.on_cigarette_program && (
            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Cigarette className="w-4 h-4 text-amber-700" />
                  <span>Controlled Cigarette Allotment Program</span>
                </div>
                <span className="text-[11px] font-bold text-amber-800">
                  {cigaretteCount} Dispensed Today
                </span>
              </div>

              <div className="text-[11px] text-amber-950 leading-relaxed">
                Resident has locked cigarette allotment managed by staff per physician care plan.
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-600">
                  Dispensed Timestamps: {cigaretteTimes.length > 0 ? cigaretteTimes.join(', ') : 'None yet'}
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddCigaretteTime}
                    className="px-2.5 py-1 rounded-md bg-amber-700 text-white font-semibold text-xs hover:bg-amber-800"
                  >
                    + Dispense 1 Cigarette
                  </button>
                )}
              </div>
            </div>
          )}

          {/* General Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              General Behavioral & Clinical Observations
            </label>
            <textarea
              disabled={isLocked}
              rows={3}
              value={generalObservations}
              onChange={(e) => setGeneralObservations(e.target.value)}
              placeholder="e.g. In good spirits, participated in afternoon musical social. Cooperative with evening transfers."
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white disabled:bg-slate-100"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Author: <strong>{currentStaff.name}</strong> ({currentStaff.role}). Submitting locks the report and writes an append-only event into Postgres.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          {!isLocked && (
            <>
              <button
                type="button"
                onClick={() => handleSave('draft')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave('submitted')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submit & Lock Report</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
