import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DatabaseStatusBadge } from '../common/DatabaseStatusBadge';
import { Button } from '../ui/Button';
import { User, KeyRound, Eye, EyeOff, AlertCircle, Sparkles } from 'lucide-react';

export function LoginPage() {
  const { login, enterDemoMode, isLoading, error, retryAfter, clearError } = useAuth();
  const [username, setUsername] = useState('');
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
    <div className="min-h-screen bg-canvas text-slate-100 flex flex-col justify-center items-center px-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-surface-elevated border border-border-hairline items-center justify-center p-2 mb-4 shadow-xl shadow-accent/10">
            <img src="/icon.svg" alt="NetMentor" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white heading-display">NetMentor</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Personal AI Networking Learning Application
          </p>
          <div className="mt-3 flex justify-center">
            <DatabaseStatusBadge />
          </div>
        </div>

        {/* Login Card */}
        <div className="glass-card-elevated rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/[0.08]">
            <KeyRound className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Sign In
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-danger/15 border border-danger/30 flex items-start gap-3 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
                {isLocked && (
                  <p className="mt-1 text-red-300">
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
                Username
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
                  className="w-full px-3.5 py-2.5 bg-surface-subtle/80 border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50 pr-10"
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
                  className="w-full px-3.5 py-2.5 bg-surface-subtle/80 border border-white/[0.08] rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isLoading}
              disabled={isLocked || !username.trim() || !passphrase.trim()}
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Mode Bypass for Evaluation */}
          <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
            <button
              type="button"
              onClick={enterDemoMode}
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors press-scale"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Synthetic Demo Mode (Bypasses Auth)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
