import React, { useState } from 'react';
import { LogIn, ArrowLeft, Briefcase } from 'lucide-react';

interface CaseworkerLoginViewProps {
  onLogin: (token: string) => void;
  onBackToStaffLogin: () => void;
}

// DEMO-ONLY hardcoded credentials, checked entirely client-side — same
// reasoning and pattern as LoginView.tsx's staff DEMO_ACCOUNTS: no server
// round trip to fail, and this is a demo with no real security
// requirement. The "token" is just the caseworker's id — see
// requireCaseworkerAuth in src/apiApp.ts.
const CASEWORKER_ACCOUNTS: Record<string, { password: string; caseworkerId: string }> = {
  'denise.coombs': { password: 'Coombs#2024', caseworkerId: 'cw-denise-coombs' },
};

export const CaseworkerLoginView: React.FC<CaseworkerLoginViewProps> = ({ onLogin, onBackToStaffLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const account = CASEWORKER_ACCOUNTS[username.trim().toLowerCase()];
    if (!account || account.password !== password) {
      setError('Invalid username or password.');
      return;
    }
    setError('');
    onLogin(account.caseworkerId);
  };

  const fillDemo = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword(CASEWORKER_ACCOUNTS[demoUsername].password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm mx-auto mb-3">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CareHomeOS — Caseworker Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Hi Haven Manor Inc. · St. John's, NL</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="denise.coombs"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </form>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick sign in (demo)</div>
            {Object.entries(CASEWORKER_ACCOUNTS).map(([demoUsername, account]) => (
              <button
                key={demoUsername}
                type="button"
                onClick={() => fillDemo(demoUsername)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                <span className="font-medium">Denise Coombs</span>
                <span className="text-slate-500 font-mono">{demoUsername} / {account.password}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onBackToStaffLogin}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Staff sign in instead
          </button>
        </div>
      </div>
    </div>
  );
};
