import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, LogIn, ArrowLeft } from 'lucide-react';
import { Staff } from '../types';

interface LoginViewProps {
  onLogin: (token: string, staff: Staff) => void;
}

type Step = 'login' | 'forgot-username' | 'forgot-password' | 'forgot-sent' | 'contact' | 'code';

async function api(path: string, body: any, token?: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [step, setStep] = useState<Step>('login');

  // Layer one
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot username/password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');

  // Between layers
  const [pendingToken, setPendingToken] = useState('');
  const [staffPreview, setStaffPreview] = useState<{ name: string; role: string } | null>(null);
  const [contact, setContact] = useState<{ maskedPhone: string; maskedEmail: string } | null>(null);

  // Layer two
  const [contactMode, setContactMode] = useState<'sms' | 'email'>('sms');
  const [contactErr, setContactErr] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [codeErr, setCodeErr] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoading(true);
    const { ok, data } = await api('/api/auth/login', { username: username.trim(), password });
    setLoading(false);
    if (!ok) {
      setLoginErr(data.error || 'Invalid username or password.');
      return;
    }
    setPendingToken(data.pendingToken);
    setStaffPreview(data.staff);
    setContact(data.contact);
    setStep('contact');
    setContactMode('sms');
  };

  const handleForgotSubmit = async (kind: 'username' | 'password') => {
    if (!forgotEmail.trim()) return;
    await api(kind === 'username' ? '/api/auth/forgot-username' : '/api/auth/forgot-password', { email: forgotEmail.trim() });
    setForgotMessage(
      kind === 'username'
        ? "If that email matches an account, we've sent a username reminder."
        : "If that email matches an account, we've sent password reset instructions."
    );
    setStep('forgot-sent');
  };

  const sendCode = async () => {
    setContactErr('');
    const { ok, data } = await api('/api/auth/otp/send', { channel: contactMode }, pendingToken);
    if (!ok) {
      setContactErr(data.error || 'Could not send the code.');
      return;
    }
    setDevCode(data.devCode || null);
    setCode(['', '', '', '', '', '']);
    setStep('code');
    setResendCooldown(20);
    setTimeout(() => codeRefs.current[0]?.focus(), 0);
  };

  const verifyCode = async () => {
    const entered = code.join('');
    if (entered.length < 6) {
      setCodeErr('Enter all 6 digits.');
      return;
    }
    setCodeErr('');
    const { ok, data } = await api('/api/auth/otp/verify', { code: entered }, pendingToken);
    if (!ok) {
      setCodeErr(data.error || 'Incorrect code.');
      return;
    }
    onLogin(data.token, data.staff);
  };

  const handleCodeInput = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[idx] = val.slice(-1);
    setCode(next);
    if (val && idx < 5) codeRefs.current[idx + 1]?.focus();
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) codeRefs.current[idx - 1]?.focus();
  };

  const BackButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back to sign in' }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-xs font-semibold transition"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      {label}
    </button>
  );

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

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Username</label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="sarah.jenkins"
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

              {loginErr && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{loginErr}</p>
              )}

              <button
                id="login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold transition"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={() => { setForgotMessage(''); setForgotEmail(''); setStep('forgot-username'); }} className="text-emerald-400 hover:text-emerald-300">
                  Forgot username?
                </button>
                <button type="button" onClick={() => { setForgotMessage(''); setForgotEmail(''); setStep('forgot-password'); }} className="text-emerald-400 hover:text-emerald-300">
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {(step === 'forgot-username' || step === 'forgot-password') && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">{step === 'forgot-username' ? 'Forgot username' : 'Forgot password'}</h2>
              <p className="text-xs text-slate-400">Enter the email on your staff profile.</p>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="sarah.j@hihavenmanor.ca"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => handleForgotSubmit(step === 'forgot-username' ? 'username' : 'password')}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
              >
                {step === 'forgot-username' ? 'Send reminder' : 'Send reset instructions'}
              </button>
              <BackButton onClick={() => setStep('login')} />
            </div>
          )}

          {step === 'forgot-sent' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">Check that inbox</h2>
              <p className="text-xs text-slate-300 bg-slate-800/60 border border-dashed border-slate-700 rounded-lg px-3 py-2.5">{forgotMessage}</p>
              <p className="text-[11px] text-slate-500">This wording never confirms or denies an account exists.</p>
              <BackButton onClick={() => setStep('login')} />
            </div>
          )}

          {step === 'contact' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">Verify it's you</h2>
              <p className="text-xs text-slate-400">
                Signed in as <strong className="text-slate-200">{staffPreview?.name}</strong>. Where should we send your code?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContactMode('sms')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${contactMode === 'sms' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  Text me
                </button>
                <button
                  type="button"
                  onClick={() => setContactMode('email')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition ${contactMode === 'email' ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  Email me
                </button>
              </div>
              <p className="text-xs text-slate-400 font-mono bg-slate-800/60 rounded-lg px-3 py-2">
                {contactMode === 'sms' ? contact?.maskedPhone : contact?.maskedEmail}
              </p>
              {contactErr && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{contactErr}</p>}
              <button
                type="button"
                onClick={sendCode}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
              >
                Send code
              </button>
              <BackButton onClick={() => setStep('login')} />
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-white">Enter your code</h2>
              <p className="text-xs text-slate-400">
                We sent a 6-digit code to {contactMode === 'sms' ? contact?.maskedPhone : contact?.maskedEmail}.
              </p>
              <div className="flex gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { codeRefs.current[i] = el; }}
                    value={digit}
                    onChange={(e) => handleCodeInput(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    maxLength={1}
                    inputMode="numeric"
                    className="w-full text-center py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-lg font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                ))}
              </div>
              {codeErr && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{codeErr}</p>}
              {devCode && (
                <p className="text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-center">
                  Dev mode — your code is <strong>{devCode}</strong> (no SMS/email provider configured)
                </p>
              )}
              <button
                type="button"
                onClick={verifyCode}
                className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition"
              >
                Verify &amp; sign in
              </button>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Didn't get it?</span>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={sendCode}
                  className="text-emerald-400 hover:text-emerald-300 disabled:text-slate-600"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
              <BackButton onClick={() => setStep('contact')} label="Back" />
            </div>
          )}

        </div>

        {step === 'login' && (
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500 justify-center">
            <ShieldCheck className="w-3.5 h-3.5" />
            Two-factor sign-in: username &amp; password, then a code to your phone or email.
          </div>
        )}
      </div>
    </div>
  );
};
