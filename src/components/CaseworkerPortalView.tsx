import React, { useEffect, useState } from 'react';
import { Briefcase, LogOut, ClipboardList, AlertCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Caseworker, IncidentReport, ShiftSummary } from '../types';
import { ProtectedDocumentGate } from './ProtectedDocumentGate';
import { buildIncidentDocumentText, buildShiftSummaryDocumentText } from '../lib/documentText';

interface CaseworkerPortalViewProps {
  token: string;
  onLogout: () => void;
}

interface CaseworkerResidentSummary {
  id: string;
  full_name: string;
  room_number: string;
  level_of_care: string;
}

async function caseworkerFetch(path: string, token: string) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

// Read-only portal for an external NL Government / funding-agency
// caseworker — a wholly separate shell from the staff app, not just a
// restricted view of it, backed by its own /api/caseworker/* routes that
// are scoped server-side to this caseworker's assigned residents (see
// requireCaseworkerAuth in src/apiApp.ts). Never fetches /api/state or
// anything else the staff app uses.
export const CaseworkerPortalView: React.FC<CaseworkerPortalViewProps> = ({ token, onLogout }) => {
  const [caseworker, setCaseworker] = useState<Caseworker | null>(null);
  const [residents, setResidents] = useState<CaseworkerResidentSummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [shiftSummaries, setShiftSummaries] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [gateDoc, setGateDoc] = useState<{ password: string; title: string; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const me = await caseworkerFetch('/api/caseworker/me', token);
      if (!me) {
        onLogout();
        return;
      }
      setCaseworker(me.caseworker);
      setResidents(me.residents);
      const [incidentsData, summariesData] = await Promise.all([
        caseworkerFetch('/api/caseworker/incidents', token),
        caseworkerFetch('/api/caseworker/shift-summaries', token),
      ]);
      if (incidentsData) setIncidents(incidentsData.incidents);
      if (summariesData) setShiftSummaries(summariesData.shiftSummaries);
      setLoading(false);
    })();
  }, [token]);

  const residentName = (id: string) => residents.find((r) => r.id === id)?.full_name || id;

  if (loading || !caseworker) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">{caseworker.full_name}</div>
            <div className="text-[11px] text-slate-500">{caseworker.organization} · Caseworker Portal</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h1 className="text-lg font-bold text-slate-900">Your Case Load at Hi Haven Manor</h1>
          <p className="text-xs text-slate-500 mt-1">
            {residents.map((r) => `${r.full_name} (Room ${r.room_number})`).join(' · ') || 'No residents currently assigned.'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Shift Summaries</h2>
            <p className="text-[11px] text-slate-500 mt-1">Only the entries for your assigned resident(s) are shown.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {shiftSummaries.length === 0 ? (
              <p className="p-6 text-xs text-slate-400 text-center">No shift summaries available yet.</p>
            ) : (
              shiftSummaries.map((s) => {
                const isExpanded = expandedSummaryId === s.id;
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <button onClick={() => setExpandedSummaryId(isExpanded ? null : s.id)} className="flex items-center gap-2 text-left">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-xs font-bold text-slate-900">{s.date} · {s.shift_type}</span>
                      </button>
                      <button
                        onClick={() =>
                          setGateDoc({
                            password: s.document_password,
                            title: `Shift Summary — ${s.date} ${s.shift_type}`,
                            text: buildShiftSummaryDocumentText(s),
                          })
                        }
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
                            </div>
                            <div className="text-slate-600 mt-1">{r.meals_summary}</div>
                            <div className="text-slate-600">
                              Shower: {r.shower_taken === null ? 'N/A' : r.shower_taken ? 'Yes' : 'No'}
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Approved Incident Reports</h2>
            <p className="text-[11px] text-slate-500 mt-1">Draft, submitted, and rejected reports are never shown here — approved only.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {incidents.length === 0 ? (
              <p className="p-6 text-xs text-slate-400 text-center">No approved incident reports for your residents.</p>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {inc.incident_type} · {residentName(inc.resident_id)}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {inc.occurred_at} · Approved by {inc.reviewed_by_name}
                      </div>
                      <p className="text-xs text-slate-700 mt-1">{inc.description}</p>
                    </div>
                  </div>
                  {inc.document_password && (
                    <button
                      onClick={() =>
                        setGateDoc({
                          password: inc.document_password!,
                          title: `Incident Report — ${residentName(inc.resident_id)}`,
                          text: buildIncidentDocumentText(inc, residentName(inc.resident_id)),
                        })
                      }
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition"
                    >
                      <Lock className="w-3 h-3" />
                      Print / Download
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {gateDoc && (
        <ProtectedDocumentGate
          isOpen={!!gateDoc}
          onClose={() => setGateDoc(null)}
          documentPassword={gateDoc.password}
          documentTitle={gateDoc.title}
          buildDocumentText={() => gateDoc.text}
        />
      )}
    </div>
  );
};
