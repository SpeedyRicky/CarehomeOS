import React, { useState } from 'react';
import { ClipboardList, Sparkles, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { ShiftSummary } from '../types';
import { ProtectedDocumentGate } from './ProtectedDocumentGate';
import { buildShiftSummaryDocumentText } from '../lib/documentText';

interface ShiftSummaryViewProps {
  shiftSummaries: ShiftSummary[];
  onGenerate: (date: string, shiftType: ShiftSummary['shift_type']) => Promise<ShiftSummary | null>;
}

const SHIFT_TYPES: ShiftSummary['shift_type'][] = ['Day Shift (07:00 - 19:00)', 'Night Shift (19:00 - 07:00)'];

export const ShiftSummaryView: React.FC<ShiftSummaryViewProps> = ({ shiftSummaries, onGenerate }) => {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [shiftType, setShiftType] = useState<ShiftSummary['shift_type']>(SHIFT_TYPES[0]);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gateSummary, setGateSummary] = useState<ShiftSummary | null>(null);
  const [justGeneratedPassword, setJustGeneratedPassword] = useState<{ id: string; password: string } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const generated = await onGenerate(date, shiftType);
      if (generated) {
        setJustGeneratedPassword({ id: generated.id, password: generated.document_password });
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Shift Summaries</h1>
        </div>
        <p className="text-xs text-slate-500">
          A frozen, all-residents-at-once handover snapshot for the shift just ending. Generate one at the end of Day and
          Night shift — this is also what the resident's assigned Caseworker sees in their own portal.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shift</label>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value as ShiftSummary['shift_type'])}
              className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              {SHIFT_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {generating ? 'Generating…' : 'Generate Shift Summary'}
          </button>
        </div>
        {justGeneratedPassword && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Document password for this summary: <strong className="font-mono">{justGeneratedPassword.password}</strong> —
            share this with the residents' assigned Caseworker so they can print or download their own copy. It's also
            visible on their own portal.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Past Summaries ({shiftSummaries.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {shiftSummaries.length === 0 ? (
            <p className="p-6 text-xs text-slate-400 text-center">No shift summaries generated yet.</p>
          ) : (
            shiftSummaries.map((s) => {
              const isExpanded = expandedId === s.id;
              return (
                <div key={s.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {s.date} · {s.shift_type}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Generated by {s.generated_by_name} · {s.residents.length} residents
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setGateSummary(s);
                        setJustGeneratedPassword(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
                    >
                      <Lock className="w-3 h-3" />
                      Print / Download
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 pl-6">
                      {s.residents.map((r) => (
                        <div key={r.resident_id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                            {r.resident_name}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-normal">
                              {r.daily_report_status}
                            </span>
                          </div>
                          <div className="text-slate-600 mt-1">{r.meals_summary}</div>
                          <div className="text-slate-600">
                            Shower: {r.shower_taken === null ? 'N/A' : r.shower_taken ? 'Yes' : 'No'}
                            {r.cigarette_count !== null && ` · Cigarettes: ${r.cigarette_count}`}
                          </div>
                          {r.general_observations && <div className="text-slate-600 mt-1">{r.general_observations}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {gateSummary && (
        <ProtectedDocumentGate
          isOpen={!!gateSummary}
          onClose={() => setGateSummary(null)}
          documentPassword={gateSummary.document_password}
          documentTitle={`Shift Summary — ${gateSummary.date} ${gateSummary.shift_type}`}
          buildDocumentText={() => buildShiftSummaryDocumentText(gateSummary)}
        />
      )}
    </div>
  );
};
