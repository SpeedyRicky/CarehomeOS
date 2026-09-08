import React, { useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { Staff } from '../types';

interface LoginViewProps {
  allStaff: Staff[];
  onLogin: (staff: Staff) => void;
}

// Hardcoded demo accounts, one per role. This is a prototype login screen:
// credentials are checked client-side against this fixed list, matching how
// the rest of this app has no real backend to authenticate against. Swap
// this out for a real auth flow before handling real resident data.
const DEMO_ACCOUNTS = [
  { username: 'careworker', password: 'care123', staffId: 'staff-sarah', role: 'Care Worker' as const },
  { username: 'manager', password: 'manager123', staffId: 'staff-olatundun', role: 'Manager' as const },
  { username: 'owner', password: 'owner123', staffId: 'staff-derrick', role: 'Owner' as const },
];

export const LoginView: React.FC<LoginViewProps> = ({ allStaff, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const match = DEMO_ACCOUNTS.find(
      (a) => a.username.toLowerCase() === username.trim().toLowerCase() && a.password === password
    );
    if (!match) {
      setError('Invalid username or password.');
      return;
    }
    const staff = allStaff.find((s) => s.id === match.staffId);
    if (!staff) {
      setError('Demo account is not seeded. Contact an administrator.');
      return;
    }
    setError('');
    onLogin(staff);
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-lg tracking-wider shadow-sm mx-auto mb-3">
            OS
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CareHomeOS</h1>
          <p className="text-xs text-slate-400 mt-1">Hi Haven Manor Inc. · St. John's, NL</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Username</label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. careworker"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </form>

        <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Demo Accounts
          </div>
          <div className="space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => fillDemo(account)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                <span className="font-medium">{account.role}</span>
                <span className="text-slate-500 font-mono">{account.username} / {account.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
