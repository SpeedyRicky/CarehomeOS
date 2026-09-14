import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Resident, DailyReportBaseline } from '../types';

interface ResidentBaselineModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: Resident | null;
  onSave: (residentId: string, baseline: DailyReportBaseline) => void;
}

const MEAL_OPTIONS: DailyReportBaseline['breakfast_typical'][] = ['All', 'Most', 'Half', 'Little', 'Refused'];

const DEFAULT_BASELINE: DailyReportBaseline = {
  breakfast_typical: 'All',
  lunch_typical: 'All',
  dinner_typical: 'All',
  shower_typical: true,
  cigarette_count_typical: 0,
  general_observations_typical: 'No behavioral or clinical concerns observed this shift.',
};

// Manager/Owner-only control for what this resident's Daily Shift Log
// "Great Day" quick-fill button pre-fills — see DailyReportModal. Kept
// per-resident and separate from the log itself so a value that's normal
// for one person (e.g. a cigarette count) never gets applied to someone
// it doesn't fit.
export const ResidentBaselineModal: React.FC<ResidentBaselineModalProps> = ({ isOpen, onClose, resident, onSave }) => {
  if (!isOpen || !resident) return null;

  const existing = resident.daily_report_baseline;
  const [breakfast, setBreakfast] = useState(existing?.breakfast_typical || DEFAULT_BASELINE.breakfast_typical);
  const [lunch, setLunch] = useState(existing?.lunch_typical || DEFAULT_BASELINE.lunch_typical);
  const [dinner, setDinner] = useState(existing?.dinner_typical || DEFAULT_BASELINE.dinner_typical);
  const [showerTypical, setShowerTypical] = useState(existing?.shower_typical ?? DEFAULT_BASELINE.shower_typical);
  const [cigaretteCount, setCigaretteCount] = useState(existing?.cigarette_count_typical ?? DEFAULT_BASELINE.cigarette_count_typical);
  const [observations, setObservations] = useState(existing?.general_observations_typical || DEFAULT_BASELINE.general_observations_typical);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(resident.id, {
      breakfast_typical: breakfast,
      lunch_typical: lunch,
      dinner_typical: dinner,
      shower_typical: showerTypical,
      cigarette_count_typical: resident.on_cigarette_program ? cigaretteCount : 0,
      general_observations_typical: observations.trim() || DEFAULT_BASELINE.general_observations_typical,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daily Log Baseline: {resident.full_name}</h3>
              <p className="text-[11px] text-slate-500">
                What "Great Day" pre-fills on this resident's Daily Shift Log — still a draft staff must review and submit themselves.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['Breakfast', breakfast, setBreakfast],
                ['Lunch', lunch, setLunch],
                ['Dinner', dinner, setDinner],
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value as DailyReportBaseline['breakfast_typical'])}
                  className="w-full text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                >
                  {MEAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200">
            <span className="text-xs font-semibold text-slate-700">Shower typically completed</span>
            <input
              type="checkbox"
              checked={showerTypical}
              onChange={(e) => setShowerTypical(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
          </label>

          {resident.on_cigarette_program ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Typical cigarette count</label>
              <input
                type="number"
                min={0}
                value={cigaretteCount}
                onChange={(e) => setCigaretteCount(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 px-1">
              {resident.full_name} isn't enrolled in the cigarette program, so this field doesn't apply.
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Typical general observations</label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
            >
              Save Baseline
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
