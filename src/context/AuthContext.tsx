import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: string | null;
  error: string | null;
  retryAfter: number | null;
  sessionExpiresAt: number | null;
  login: (username: string, passphrase: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<string | null>(null);
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
        setSessionExpiresAt(res.data.expiresAt || null);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setSessionExpiresAt(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const login = async (username: string, passphrase: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setRetryAfter(null);

    const res = await authApi.login({ username, passphrase });

    if (res.data?.success) {
      setIsAuthenticated(true);
      setUser(res.data.user || username);
      setError(null);
      setIsLoading(false);
      await checkExistingSession();
      return true;
    }

    setIsAuthenticated(false);
    setUser(null);
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
      await authApi.logout();
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setSessionExpiresAt(null);
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
    setRetryAfter(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        error,
        retryAfter,
        sessionExpiresAt,
        login,
        logout,
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
