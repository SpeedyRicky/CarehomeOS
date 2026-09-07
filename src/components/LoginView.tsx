import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, KeyRound, AlertCircle, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { Staff } from '../types';

interface LoginViewProps {
  onLoginSuccess: (staff: Staff, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoHelp, setShowDemoHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          mfaCode: mfaRequired ? mfaCode.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.mfaRequired) {
          setMfaRequired(true);
          setError(data.error || 'Enter the 6-digit verification code sent to your device.');
        } else {
          setError(data.error || 'Sign-in failed. Check your email and password and try again.');
        }
        return;
      }

      onLoginSuccess(data.staff, data.token);
    } catch (err) {
      console.error(err);
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center font-bold text-xl text-white shadow-lg mb-3">
            OS
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CareHomeOS</h1>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Hi Haven Manor Inc. · St. John’s, NL · CA-NL</span>
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Staff Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">
              Access is restricted to authorized Hi Haven Manor staff. All sign-ins are logged for CA-NL PHIA
              compliance and audit purposes.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-email">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  disabled={mfaRequired}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hihavenmanor.ca"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  disabled={mfaRequired}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            {mfaRequired && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="login-mfa">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-mfa"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in…' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Protected under the Newfoundland &amp; Labrador Personal Health Information Act (PHIA). Unauthorized
              access to resident health information is prohibited and monitored.
            </span>
          </div>
        </div>

        {/* Demo credentials helper — remove before any real deployment */}
        <div className="mt-4 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDemoHelp((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition"
          >
            <span>Demo/reviewer sign-in reference (not for production)</span>
            {showDemoHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showDemoHelp && (
            <div className="px-4 pb-3 text-[11px] text-slate-400 space-y-1">
              <p>Shared demo password for every account below: <code className="text-emerald-400">Demo@CareHome1</code></p>
              <p>MFA code for every account: <code className="text-emerald-400">123456</code></p>
              <ul className="mt-1.5 space-y-0.5 font-mono">
                <li>o.ndudim@hihavenmanor.ca — Manager</li>
                <li>derrick@hihavenmanor.ca — Owner</li>
                <li>sarah.j@hihavenmanor.ca — Care Worker</li>
                <li>d.tremblett@hihavenmanor.ca — Care Worker</li>
                <li>m.power@hihavenmanor.ca — Care Worker</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
