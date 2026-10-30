import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Lock, User, KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export function LoginPage() {
  const { login, isLoading, error, retryAfter, clearError } = useAuth();
  const [username, setUsername] = useState('jenilmoradiya50');
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      setCountdown(retryAfter);
    }
  }, [retryAfter]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          clearError();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !passphrase.trim() || countdown !== null) return;
    await login(username.trim(), passphrase.trim());
  };

  const isLocked = countdown !== null && countdown > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-600/20 border border-brand-500/40 items-center justify-center text-brand-400 mb-4 shadow-xl shadow-brand-500/10">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">NetMentor</h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal AI Networking Learning Application
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
            <KeyRound className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Admin Authentication
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
                {isLocked && (
                  <p className="mt-1 text-rose-400">
                    Rate limiting active: Retry available in {countdown}s.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Admin Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error && !isLocked) clearError();
                  }}
                  disabled={isLoading || isLocked}
                  placeholder="Username"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all disabled:opacity-50 pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="passphrase"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="passphrase"
                  type={showPassword ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                    if (error && !isLocked) clearError();
                  }}
                  disabled={isLoading || isLocked}
                  placeholder="Enter administrator password..."
                  autoComplete="current-password"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isLocked || !username.trim() || !passphrase.trim()}
              className="w-full mt-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : isLocked ? (
                <span>Rate-Limited ({countdown}s)</span>
              ) : (
                <span>Authenticate & Unlock</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400/90">
              <ShieldCheck className="w-3.5 h-3.5" />
              HttpOnly Guard Active
            </span>
            <span>Single-User</span>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          NetMentor &bull; Protected Personal Study Environment
        </p>
      </div>
    </div>
  );
}
export default LoginPage;
