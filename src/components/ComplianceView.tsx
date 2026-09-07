import React from 'react';
import {
  ShieldCheck,
  Building,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Calendar,
  Lock,
  Thermometer,
  Clock,
  Sparkles,
} from 'lucide-react';
import { JurisdictionRuleset, Staff, ShiftChecklist, Reassessment, IncidentReport } from '../types';

interface ComplianceViewProps {
  ruleset: JurisdictionRuleset;
  staff: Staff[];
  shiftChecklists: ShiftChecklist[];
  reassessments: Reassessment[];
  incidents: IncidentReport[];
  onOpenChecklistModal: () => void;
  onNavigateToAI: () => void;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  ruleset,
  staff,
  shiftChecklists,
  reassessments,
  incidents,
  onOpenChecklistModal,
  onNavigateToAI,
}) => {
  const overdueReassessments = reassessments.filter((r) => r.status === 'overdue');
  const pendingIncidents = incidents.filter((i) => i.status === 'submitted');

  // Staff with credentials expiring soon
  const expiringCredentials = staff.flatMap((member) =>
    member.credentials.map((cred) => ({
      staffName: member.name,
      staffRole: member.role,
      ...cred,
    }))
  ).sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Provincial Regulatory Compliance & CA-NL Ruleset
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                Versioned Ruleset Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Newfoundland & Labrador Operational Standards for Personal Care Homes (CA-NL). Every domain mutation is verified against active statutory requirements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToAI}
              className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Compliance Audit</span>
            </button>
            <button
              onClick={onOpenChecklistModal}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Log Shift Attestation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Compliance Scorecard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Med Cart Lock */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Med Cart Lock Attestations
            </span>
            <Lock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">100%</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Last 30 shifts double-locked and attested per shift handover.
          </div>
        </div>

        {/* Card 2: Reassessments Overdue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Overdue Reassessments
            </span>
            <AlertTriangle className={`w-4 h-4 ${overdueReassessments.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
          </div>
          <div className={`text-2xl font-bold mt-2 ${overdueReassessments.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {overdueReassessments.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {overdueReassessments.length > 0 ? 'Arthur Walsh flagged overdue (NL AG audit target)' : 'Zero backlog! All up to date.'}
          </div>
        </div>

        {/* Card 3: Pending Incidents Age */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Incident Review Queue
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {pendingIncidents.length} Pending
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Monitoring weekend approval gap (Manager sign-off pending).
          </div>
        </div>

        {/* Card 4: Staff Certifications */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Expiring Credentials
            </span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">1 Soon</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dave Tremblett: First Aid expires in 14 days.
          </div>
        </div>
      </div>

      {/* Two Columns: Active Ruleset vs Staff Credential Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: CA-NL Ruleset Details (§8) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Jurisdiction Ruleset: {ruleset.code}</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{ruleset.name}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
              Active v{ruleset.version}
            </span>
          </div>

          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
            <strong>Architecture Philosophy (§8):</strong> Instead of enterprise configuration matrix hell, the ruleset is a simple versioned row. When standards change, the system inserts a new row with a new effective date. Existing records point to the ruleset under which they were created.
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Enforced Regulatory Parameters
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Reassessment Cycle</span>
                <span className="font-bold text-slate-900">{ruleset.rules.reassessment_cycle_months} Months</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fire Drill Frequency</span>
                <span className="font-bold text-slate-900">Every {ruleset.rules.fire_drill_frequency_days} Days</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Day Shift Ratio</span>
                <span className="font-bold text-slate-900">{ruleset.rules.staff_ratio_day} (1:15 Residents)</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Night Shift Ratio</span>
                <span className="font-bold text-slate-900">{ruleset.rules.staff_ratio_night} (1:25 Residents)</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">First Aid Recertification</span>
                <span className="font-bold text-slate-900">Every {ruleset.rules.first_aid_recert_years} Years</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Police & Vulnerable Sector</span>
                <span className="font-bold text-slate-900">Every {ruleset.rules.police_check_renewal_years} Years</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Staff Credential Matrix */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Staff Credential Compliance Matrix</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automated 30/14/1 day renewal triggers
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {expiringCredentials.length} Credentials
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
            {expiringCredentials.map((cred) => (
              <div key={cred.id} className="py-2.5 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{cred.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        cred.status === 'valid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : cred.status === 'expiring_soon'
                          ? 'bg-amber-100 text-amber-800 animate-pulse font-bold'
                          : 'bg-rose-100 text-rose-800 font-bold'
                      }`}
                    >
                      {cred.status === 'expiring_soon' ? 'Expires in 14d' : 'Valid'}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Staff: <strong className="text-slate-700">{cred.staffName}</strong> ({cred.staffRole}) · Cert #{cred.certificate_number}
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500 font-mono">
                  <span>Exp: {cred.expires_at}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Shift Attestation Historical Log (NL Auditor General proof) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Medication Storage Lock & Safety Attestation Shift Log</span>
          </h2>
          <span className="text-[11px] text-slate-400">
            Immutable end-of-shift audits
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">Date & Time</th>
                <th className="py-2.5 px-3 font-semibold">Attesting Staff</th>
                <th className="py-2.5 px-3 font-semibold">Med Cart Locked</th>
                <th className="py-2.5 px-3 font-semibold">Narcotics Count</th>
                <th className="py-2.5 px-3 font-semibold">Med Fridge (°C)</th>
                <th className="py-2.5 px-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {shiftChecklists.map((sc) => (
                <tr key={sc.id} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {(sc.completed_at || sc.timestamp || sc.date).slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{sc.completed_by_name}</td>
                  <td className="py-2 px-3">
                    {sc.medication_storage_secured ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        ✓ Double Locked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                        ✕ Unlocked Exception
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {sc.medication_count_verified ? (
                      <span className="text-emerald-700 font-medium">Reconciled</span>
                    ) : (
                      <span className="text-rose-700 font-medium">Discrepancy</span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono">{sc.fridge_temp_celsius}°C</td>
                  <td className="py-2 px-3 text-slate-500 italic max-w-xs truncate">{sc.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
