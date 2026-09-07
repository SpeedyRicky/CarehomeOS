import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  Lock,
  Thermometer,
  CheckCircle2,
  AlertTriangle,
  Pill,
} from 'lucide-react';
import { ShiftChecklist, Staff } from '../types';

interface ShiftChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStaff: Staff;
  onSaveChecklist: (checklist: ShiftChecklist) => void;
}

export const ShiftChecklistModal: React.FC<ShiftChecklistModalProps> = ({
  isOpen,
  onClose,
  currentStaff,
  onSaveChecklist,
}) => {
  if (!isOpen) return null;

  const [medStorageSecured, setMedStorageSecured] = useState(true);
  const [medCountVerified, setMedCountVerified] = useState(true);
  const [fridgeTemp, setFridgeTemp] = useState('3.8');
  const [safetyRoundsCompleted, setSafetyRoundsCompleted] = useState(true);
  const [emergencyExitsClear, setEmergencyExitsClear] = useState(true);
  const [notes, setNotes] = useState('All narcotic counts matched physical stock and blister cards. Med room and cart double-locked.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const checklist: ShiftChecklist = {
      id: `checklist-${Date.now()}`,
      shift_id: 'shift-day-today',
      date: new Date().toISOString().split('T')[0],
      completed_by: currentStaff.id,
      completed_by_name: currentStaff.name,
      completed_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      medication_storage_secured: medStorageSecured,
      medication_count_verified: medCountVerified,
      fridge_temp_celsius: parseFloat(fridgeTemp) || 4.0,
      safety_rounds_completed: safetyRoundsCompleted,
      emergency_exits_clear: emergencyExitsClear,
      notes,
    };

    onSaveChecklist(checklist);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                End-of-Shift Safety & Medication Attestation
              </h3>
              <p className="text-[11px] text-slate-500">
                NL Auditor General Finding & CA-NL Standards Verification
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* NL AG finding callout */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong>Mandatory Compliance Check:</strong> By signing below, you attest under provincial operational standards that the medication cart and medication storage cabinets are physically locked and keys secured.
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Medication Storage Locked & Secured *</span>
                <span className="text-[11px] text-slate-500">Cart and narcotics cupboard double-locked</span>
              </div>
              <button
                type="button"
                onClick={() => setMedStorageSecured(!medStorageSecured)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  medStorageSecured
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{medStorageSecured ? 'Verified Locked' : 'Unlocked / Flag'}</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 block">Narcotic & Controlled Substance Count *</span>
                <span className="text-[11px] text-slate-500">Physical count reconciled with shift count book</span>
              </div>
              <button
                type="button"
                onClick={() => setMedCountVerified(!medCountVerified)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  medCountVerified
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{medCountVerified ? 'Reconciled' : 'Discrepancy'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Med Fridge Temp (°C) *
                </label>
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-blue-500" />
                  <input
                    type="number"
                    step="0.1"
                    value={fridgeTemp}
                    onChange={(e) => setFridgeTemp(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                  <span className="text-slate-500 text-[11px]">°C</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">Safe range: 2.0°C – 8.0°C</span>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={safetyRoundsCompleted}
                    onChange={(e) => setSafetyRoundsCompleted(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Safety Rounds Complete</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyExitsClear}
                    onChange={(e) => setEmergencyExitsClear(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Fire Exits Unobstructed</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Handover Notes / Verification Details
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            Attested by <strong>{currentStaff.name}</strong> ({currentStaff.role}) on{' '}
            {new Date().toLocaleDateString()} · Permanent audit trail entry.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Attest & Submit Checklist</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
