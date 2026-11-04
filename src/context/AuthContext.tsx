import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  user: string | null;
  role: 'admin' | 'user' | 'demo' | null;
  error: string | null;
  retryAfter: number | null;
  sessionExpiresAt: number | null;
  login: (username: string, passphrase: string) => Promise<boolean>;
  logout: () => Promise<void>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoUrl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1';

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isDemoUrl);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => isDemoUrl);
  const [isLoading, setIsLoading] = useState<boolean>(() => !isDemoUrl);
  const [user, setUser] = useState<string | null>(() => (isDemoUrl ? 'demo_student' : null));
  const [role, setRole] = useState<'admin' | 'user' | 'demo' | null>(() => (isDemoUrl ? 'demo' : null));
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);

  const checkExistingSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.checkSession();
      if (res.data?.authenticated) {
        setIsAuthenticated(true);
        setUser(res.data.user || 'admin');
        setRole((res.data.role as 'admin' | 'user') || null);
        setSessionExpiresAt(res.data.expiresAt || null);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setRole(null);
        setSessionExpiresAt(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isDemoUrl) {
      return;
    }
    checkExistingSession();
  }, [checkExistingSession, isDemoUrl]);

  const login = async (username: string, passphrase: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setRetryAfter(null);

    const res = await authApi.login({ username, passphrase });

    if (res.data?.success) {
      setIsAuthenticated(true);
      setUser(res.data.user || username);
      setRole((res.data.role as 'admin' | 'user') || null);
      setError(null);
      setIsLoading(false);
      await checkExistingSession();
      return true;
    }

    setIsAuthenticated(false);
    setUser(null);
    setRole(null);
    setIsLoading(false);
    setError(res.message || 'Login failed');

    if (res.retryAfterSeconds) {
      setRetryAfter(res.retryAfterSeconds);
    }

    return false;
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (!isDemoMode) {
        await authApi.logout();
      }
    } finally {
      setIsAuthenticated(false);
      setIsDemoMode(false);
      setUser(null);
      setRole(null);
      setSessionExpiresAt(null);
      setIsLoading(false);
    }
  };

  const enterDemoMode = () => {
    setIsAuthenticated(true);
    setIsDemoMode(true);
    setUser('Demo Student');
    setRole('demo');
    setError(null);
    setSessionExpiresAt(null);
  };

  const exitDemoMode = () => {
    setIsAuthenticated(false);
    setIsDemoMode(false);
    setUser(null);
    setRole(null);
    setError(null);
    setSessionExpiresAt(null);
  };

  const clearError = () => {
    setError(null);
    setRetryAfter(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isDemoMode,
        isLoading,
        user,
        role,
        error,
        retryAfter,
        sessionExpiresAt,
        login,
        logout,
        enterDemoMode,
        exitDemoMode,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
