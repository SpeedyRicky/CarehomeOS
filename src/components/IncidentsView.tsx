import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  User,
  XCircle,
  RotateCcw,
  Plus,
  FileText,
  Calendar,
  Eye,
} from 'lucide-react';
import { IncidentReport, Resident, Staff } from '../types';
import { isReviewTier } from '../roleAccess';

interface IncidentsViewProps {
  incidents: IncidentReport[];
  residents: Resident[];
  currentStaff: Staff;
  onOpenNewIncident: () => void;
  onReviewIncident: (data: {
    incidentId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerRole: string;
    action: 'approve' | 'reject' | 'return_to_draft';
    rejectionReason?: string;
  }) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  residents,
  currentStaff,
  onOpenNewIncident,
  onReviewIncident,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<IncidentReport | null>(incidents[0] || null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const calculateAge = (reportedAt: string) => {
    const diffMs = Date.now() - new Date(reportedAt).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMins}m`;
  };

  const isReviewerAuthorized = isReviewTier(currentStaff.role);
  const isAuthor = selectedIncident ? selectedIncident.reported_by === currentStaff.id : false;
  const isSegregationViolation = isAuthor && isReviewerAuthorized;

  const handleApprove = () => {
    if (!selectedIncident) return;
    onReviewIncident({
      incidentId: selectedIncident.id,
      reviewerId: currentStaff.id,
      reviewerName: currentStaff.name,
      reviewerRole: currentStaff.role,
      action: 'approve',
    });
  };

  const handleReject = () => {
    if (!selectedIncident || !rejectionReasonInput.trim()) return;
    onReviewIncident({
      incidentId: selectedIncident.id,
      reviewerId: currentStaff.id,
      reviewerName: currentStaff.name,
      reviewerRole: currentStaff.role,
      action: 'reject',
      rejectionReason: rejectionReasonInput,
    });
    setShowRejectBox(false);
    setRejectionReasonInput('');
  };

  const handleReturnToDraft = () => {
    if (!selectedIncident) return;
    onReviewIncident({
      incidentId: selectedIncident.id,
      reviewerId: currentStaff.id,
      reviewerName: currentStaff.name,
      reviewerRole: currentStaff.role,
      action: 'return_to_draft',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Incident Management & State Machine
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                §4a Taxonomy & §4b Guarded
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              State transitions: Draft &rarr; Submitted &rarr; Approved / Rejected. Segregation of duties strictly prevents authors from reviewing their own incident reports.
            </p>
          </div>

          <button
            onClick={onOpenNewIncident}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Incident Report</span>
          </button>
        </div>
      </div>

      {/* Main Content: Split Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Reported Incidents ({incidents.length})
            </h2>
            <span className="text-[11px] text-slate-400">Select to review state & details</span>
          </div>

          <div className="space-y-2.5">
            {incidents.map((inc) => {
              const res = residents.find((r) => r.id === inc.resident_id);
              const isSelected = selectedIncident?.id === inc.id;
              const isPending = inc.status === 'submitted';

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-xs ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {inc.incident_type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          inc.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : inc.severity === 'High'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        inc.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inc.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-900 animate-pulse'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <p className="text-slate-600 line-clamp-2 leading-relaxed">{inc.description}</p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Resident: <strong>{res?.full_name}</strong> (Room {res?.room_number})
                    </span>
                    {isPending && (
                      <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                        Age: {calculateAge(inc.reported_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Incident Inspection & State Machine Actions */}
        <div className="lg:col-span-7">
          {selectedIncident ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5 sticky top-24">
              {/* Header Info */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      Incident #{selectedIncident.id}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                        selectedIncident.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedIncident.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      Status: {selectedIncident.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Reported by <strong>{selectedIncident.reported_by_name}</strong> on{' '}
                    {new Date(selectedIncident.reported_at).toLocaleString()}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] uppercase font-bold text-slate-400">Severity</span>
                  <div className="text-sm font-bold text-rose-600">{selectedIncident.severity}</div>
                </div>
              </div>

              {/* State Machine Status Visualizer */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                  §4b Lifecycle State
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div
                    className={`flex items-center gap-1.5 font-semibold ${
                      selectedIncident.status === 'draft' ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">1</span>
                    <span>Draft</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-300" />
                  <div
                    className={`flex items-center gap-1.5 font-semibold ${
                      selectedIncident.status === 'submitted' ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">2</span>
                    <span>Submitted (Locked)</span>
                  </div>
                  <div className="w-8 h-0.5 bg-slate-300" />
                  <div
                    className={`flex items-center gap-1.5 font-semibold ${
                      selectedIncident.status === 'approved'
                        ? 'text-emerald-700'
                        : selectedIncident.status === 'rejected'
                        ? 'text-rose-700'
                        : 'text-slate-400'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">3</span>
                    <span>Reviewed (Approved / Rejected)</span>
                  </div>
                </div>
              </div>

              {/* Incident Narrative */}
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">
                  Narrative Description
                </h3>
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-800 leading-relaxed border border-slate-100">
                  {selectedIncident.description}
                </div>
              </div>

              {/* Typed Taxonomy Details */}
              <div>
                <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                  Structured §4a Taxonomy Attributes
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(selectedIncident.type_details).map(([k, v]) => (
                    <div key={k} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-800 font-medium">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejection / Reviewer Trail */}
              {selectedIncident.reviewed_by_name && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Reviewed by {selectedIncident.reviewed_by_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Reviewed on {new Date(selectedIncident.reviewed_at!).toLocaleString()}
                  </div>
                  {selectedIncident.rejection_reason && (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-900">
                      <strong className="font-semibold">Rejection Reason:</strong>{' '}
                      {selectedIncident.rejection_reason}
                    </div>
                  )}
                </div>
              )}

              {/* Segregation of Duties Guarded Action Bar */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-800">Review & Governance Actions</div>
                  <span className="text-[11px] text-slate-400">
                    Active User: <strong>{currentStaff.name}</strong> ({currentStaff.role})
                  </span>
                </div>

                {selectedIncident.status === 'submitted' && (
                  <div className="space-y-3">
                    {/* Check if reviewer is authorized */}
                    {!isReviewerAuthorized ? (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Role Restriction:</strong> Only <strong>Manager</strong> or <strong>Owner</strong> roles can approve or reject incident reports. Switch role to Olatundun Ndudim (Manager) or Derrick Pike (Owner) via the top bar to review.
                        </div>
                      </div>
                    ) : isSegregationViolation ? (
                      <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        <div>
                          <strong>Segregation of Duties Enforced (§4b):</strong> You are the author ({currentStaff.name}) who reported this incident. You are strictly forbidden from approving your own report. A second manager or owner must sign off.
                        </div>
                      </div>
                    ) : (
                      <div>
                        {!showRejectBox ? (
                          <div className="flex items-center gap-3">
                            <button
                              id="approve-incident-btn"
                              onClick={handleApprove}
                              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-xs"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Approve Incident Report</span>
                            </button>

                            <button
                              id="reject-incident-btn"
                              onClick={() => setShowRejectBox(true)}
                              className="px-4 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition flex items-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject Report (Requires Reason)</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                            <label className="block text-xs font-semibold text-rose-900">
                              Mandatory Rejection Reason (§4b)
                            </label>
                            <textarea
                              rows={2}
                              value={rejectionReasonInput}
                              onChange={(e) => setRejectionReasonInput(e.target.value)}
                              placeholder="State explicitly what details are missing, inconsistent, or require correction..."
                              className="w-full text-xs border border-rose-300 rounded-lg p-2 bg-white"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setShowRejectBox(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleReject}
                                disabled={!rejectionReasonInput.trim()}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                Confirm Rejection
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedIncident.status === 'rejected' && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-rose-700">
                      Report is rejected. Author can reopen for revision.
                    </span>
                    <button
                      onClick={handleReturnToDraft}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen in Draft for Revision</span>
                    </button>
                  </div>
                )}

                {selectedIncident.status === 'approved' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Incident fully approved and archived in compliance records. All changes logged to immutable audit trail.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select an incident from the list to view its full details and governance history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
