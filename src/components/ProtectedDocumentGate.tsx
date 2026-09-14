import React, { useState } from 'react';
import { Lock, Printer, Download, X } from 'lucide-react';

interface ProtectedDocumentGateProps {
  isOpen: boolean;
  onClose: () => void;
  documentPassword: string;
  documentTitle: string;
  // Plain-text body to print / download once the password checks out —
  // callers build this from the incident report or shift summary they're
  // exporting.
  buildDocumentText: () => string;
}

// Gates producing a printed or downloaded copy of an approved incident
// report or shift summary behind that document's password (see
// IncidentReport.document_password / ShiftSummary.document_password). A
// printed page can't itself be encrypted — there's no such thing as a
// password-protected sheet of paper — so what this actually protects is
// the ACT of producing a copy: whoever holds the password (staff, and the
// resident's assigned Caseworker) can generate one, no one else can.
export const ProtectedDocumentGate: React.FC<ProtectedDocumentGateProps> = ({
  isOpen,
  onClose,
  documentPassword,
  documentTitle,
  buildDocumentText,
}) => {
  const [entered, setEntered] = useState('');
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (entered !== documentPassword) {
      setError('Incorrect password.');
      return;
    }
    setError('');
    setUnlocked(true);
  };

  const handlePrint = () => {
    const text = buildDocumentText();
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(
      `<html><head><title>${documentTitle}</title><style>body{font-family:ui-monospace,monospace;white-space:pre-wrap;padding:2rem;font-size:13px;line-height:1.5;}</style></head><body>${text.replace(/</g, '&lt;')}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const handleDownload = () => {
    const text = buildDocumentText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setEntered('');
    setError('');
    setUnlocked(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{documentTitle}</h3>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">
              This document is password-protected. The password was shared with the resident's assigned Caseworker.
            </p>
            <input
              type="password"
              autoFocus
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              placeholder="Document password"
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2"
            />
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <button
              type="submit"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
            >
              Unlock
            </button>
          </form>
        ) : (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Unlocked. Choose an option below.
            </p>
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
