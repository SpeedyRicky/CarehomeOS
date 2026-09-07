import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  FileText,
  Building,
  HelpCircle,
  ArrowRight,
  Send,
  Loader2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const AIAssistantView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'handover' | 'compliance' | 'qa'>('handover');

  // Handover state
  const [handoverSummary, setHandoverSummary] = useState<string | null>(null);
  const [handoverSource, setHandoverSource] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [loadingHandover, setLoadingHandover] = useState(false);

  // Compliance audit state
  const [complianceAudit, setComplianceAudit] = useState<string | null>(null);
  const [auditSource, setAuditSource] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Q&A state
  const [question, setQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaSource, setQaSource] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);
  const [loadingQA, setLoadingQA] = useState(false);

  const getSourceLabel = (src: string | null, fallbackLabel: string) => {
    if (!src || src === 'system_clinical_engine') return fallbackLabel;
    if (src.includes('flash-latest')) return 'Gemini Flash';
    if (src.includes('3.8')) return 'Gemini 3.8 Flash';
    if (src.includes('lite')) return 'Gemini Flash-Lite';
    return 'Gemini AI';
  };

  // Generate Handover
  const fetchHandover = async () => {
    setLoadingHandover(true);
    setHandoverError(null);
    try {
      const res = await fetch('/api/ai/shift-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftType: 'Day Shift' }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setHandoverSummary(data.summary);
        setHandoverSource(data.source || 'gemini');
      } else {
        setHandoverError(data.error || 'Failed to generate shift handover.');
      }
    } catch (err: any) {
      console.error(err);
      setHandoverError(err?.message || 'Network error occurred while fetching brief.');
    } finally {
      setLoadingHandover(false);
    }
  };

  // Generate Compliance Audit
  const fetchComplianceAudit = async () => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const res = await fetch('/api/ai/compliance-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.audit) {
        setComplianceAudit(data.audit);
        setAuditSource(data.source || 'gemini');
      } else {
        setAuditError(data.error || 'Failed to complete compliance audit.');
      }
    } catch (err: any) {
      console.error(err);
      setAuditError(err?.message || 'Network error occurred while running audit.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Ask Audit Question
  const handleAskQuestion = async (customQ?: string) => {
    const query = customQ || question;
    if (!query.trim()) return;
    setLoadingQA(true);
    setQaError(null);
    try {
      const res = await fetch('/api/ai/ask-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setQaAnswer(data.answer);
        setQaSource(data.source || 'gemini');
      } else {
        setQaError(data.error || 'Failed to answer audit question.');
      }
      if (customQ) setQuestion(customQ);
    } catch (err: any) {
      console.error(err);
      setQaError(err?.message || 'Network error occurred while asking question.');
    } finally {
      setLoadingQA(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                AI Explainer & Summarizer Layer
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-Only Constrained
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Architecture Rule (§7): AI sits above the system as an explainer and summarizer — never as a writer of record. Zero write path to database.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('handover')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'handover'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shift Handover Brief
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'compliance'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Regulatory Audit Review
            </button>
            <button
              onClick={() => setActiveTab('qa')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === 'qa'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Natural Language Q&A
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Shift Handover Brief */}
      {activeTab === 'handover' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Clinical Shift Handover Briefing (Day &rarr; Night Shift)</span>
                </h2>
                {handoverSource && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    {getSourceLabel(handoverSource, 'Live Clinical Engine')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Synthesizes today’s completed med passes, meal intake, showers, cigarette allotments, and recent incidents.
              </p>
            </div>
            <button
              onClick={fetchHandover}
              disabled={loadingHandover}
              className="px-3.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loadingHandover ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{handoverSummary ? 'Regenerate Brief' : 'Generate Shift Handover'}</span>
                </>
              )}
            </button>
          </div>

          {handoverError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
              <span>{handoverError}</span>
              <button
                onClick={fetchHandover}
                className="underline font-semibold hover:text-rose-900 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {handoverSummary ? (
            <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs leading-relaxed space-y-3">
              <div className="markdown-body">
                <ReactMarkdown>{handoverSummary}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <Sparkles className="w-6 h-6 text-purple-400 mx-auto" />
              <div className="font-semibold text-slate-600">No shift handover generated yet.</div>
              <p className="text-slate-400 max-w-sm mx-auto">
                Click "Generate Shift Handover" to create an actionable summary for incoming staff based on today's structured documentation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Regulatory Compliance Audit */}
      {activeTab === 'compliance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>CA-NL Operational Standards & NL Auditor General Review</span>
                </h2>
                {auditSource && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles className="w-3 h-3 text-blue-500" />
                    {getSourceLabel(auditSource, 'Live Compliance Engine')}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluates facility state against provincial ruleset, med cart lock records, overdue reassessments, and credential expirations.
              </p>
            </div>
            <button
              onClick={fetchComplianceAudit}
              disabled={loadingAudit}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loadingAudit ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{complianceAudit ? 'Refresh Audit' : 'Run Compliance Scan'}</span>
                </>
              )}
            </button>
          </div>

          {auditError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
              <span>{auditError}</span>
              <button
                onClick={fetchComplianceAudit}
                className="underline font-semibold hover:text-rose-900 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {complianceAudit ? (
            <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs leading-relaxed space-y-3">
              <div className="markdown-body">
                <ReactMarkdown>{complianceAudit}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <ShieldCheck className="w-6 h-6 text-blue-400 mx-auto" />
              <div className="font-semibold text-slate-600">Compliance audit not run yet.</div>
              <p className="text-slate-400 max-w-sm mx-auto">
                Run compliance scan to identify risk areas, overdue reassessments, and prepare for provincial licensing inspection.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Natural Language Q&A */}
      {activeTab === 'qa' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-600" />
                <span>Natural Language Audit Explainer</span>
              </h2>
              {qaSource && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  <Sparkles className="w-3 h-3 text-purple-500" />
                  {getSourceLabel(qaSource, 'Live Audit Engine')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ask operational, medication, incident, or compliance questions across Hi Haven Manor's immutable records.
            </p>
          </div>

          {/* Quick prompt suggestions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold uppercase">Suggested Queries:</span>
            <button
              onClick={() => handleAskQuestion('What falls or incidents have been reported in the last 48 hours?')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition"
            >
              "Recent falls or incidents?"
            </button>
            <button
              onClick={() => handleAskQuestion('Which residents have overdue reassessments under CA-NL standards?')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition"
            >
              "Overdue reassessments?"
            </button>
            <button
              onClick={() => handleAskQuestion('Is medication cart storage verified locked on current and prior shifts?')}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition"
            >
              "Med cart lock attestation status?"
            </button>
          </div>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. When was Arthur Walsh's last incident and what care was provided?"
              className="flex-1 text-xs border border-slate-300 rounded-xl px-4 py-2.5 shadow-xs"
            />
            <button
              type="submit"
              disabled={loadingQA || !question.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {loadingQA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Query Records</span>
            </button>
          </form>

          {qaError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between">
              <span>{qaError}</span>
              <button
                onClick={() => handleAskQuestion()}
                className="underline font-semibold hover:text-rose-900 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Answer Display */}
          {qaAnswer && (
            <div className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs leading-relaxed space-y-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Audit-Safe Response:</span>
              </div>
              <div className="markdown-body">
                <ReactMarkdown>{qaAnswer}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
