import { useState, useEffect, useRef, useCallback } from 'react';
import { Database, RefreshCw, AlertCircle, WifiOff } from 'lucide-react';

export type DbStatusState = 'initial' | 'connected' | 'database_unavailable' | 'unreachable';

interface HealthData {
  status?: string;
  connected?: boolean;
  engine?: string;
  latencyMs?: number;
}

interface DatabaseStatusBadgeProps {
  className?: string;
  showLatency?: boolean;
}

export function DatabaseStatusBadge({ className = '', showLatency = true }: DatabaseStatusBadgeProps) {
  const [status, setStatus] = useState<DbStatusState>('initial');
  const [latency, setLatency] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const checkHealth = useCallback(async (manual = false) => {
    // Abort previous in-flight request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (manual) {
      setIsRefreshing(true);
    }

    // 8-second request timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 8000);

    try {
      const startTime = performance.now();
      const res = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'X-NetMentor-Request': '1',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: HealthData | null = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response
      }

      if (!isMountedRef.current) return;

      if (res.ok && data?.connected === true) {
        setStatus('connected');
        setLatency(data.latencyMs ?? Math.round(performance.now() - startTime));
      } else if (res.status === 503 || data?.connected === false) {
        setStatus('database_unavailable');
        setLatency(null);
      } else {
        // HTTP 500, 502, 404, or non-JSON failure
        setStatus('unreachable');
        setLatency(null);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;

      // Aborted or network failed
      setStatus('unreachable');
      setLatency(null);
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // Initial check on mount
    checkHealth();

    // 30-second polling interval
    const intervalId = setInterval(() => {
      // Avoid unnecessary requests when the browser tab is hidden/backgrounded
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      checkHealth();
    }, 30000);

    // Refresh immediately when tab returns to foreground if last check is older
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkHealth();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkHealth]);

  // Render badge content based on the 4 required states
  const renderBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/70 shadow-sm"
            title={`Connected to Cloud PostgreSQL${latency ? ` (Latency: ${latency}ms)` : ''}`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Database className="w-3.5 h-3.5 flex-shrink-0" />
            <span>PostgreSQL Cloud DB Active</span>
            {showLatency && latency !== null && (
              <span className="text-[10px] text-emerald-500 font-mono ml-0.5 opacity-80">
                {latency}ms
              </span>
            )}
          </div>
        );

      case 'database_unavailable':
        return (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/70 shadow-sm"
            title="Database service is offline or unconfigured"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
            <span>PostgreSQL Cloud DB Offline</span>
          </div>
        );

      case 'initial':
        return (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/70 shadow-sm"
            title="Checking PostgreSQL database connection..."
          >
            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-amber-400" />
            <span>Checking Database...</span>
          </div>
        );

      case 'unreachable':
      default:
        return (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-400 border border-rose-800/70 shadow-sm"
            title="Health endpoint unreachable or network failed"
          >
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
            <span>Database Status Unknown / Unreachable</span>
          </div>
        );
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {renderBadge()}
      <button
        type="button"
        onClick={() => checkHealth(true)}
        disabled={isRefreshing}
        className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors disabled:opacity-40"
        title="Refresh database connection status"
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
      </button>
    </div>
  );
}

export default DatabaseStatusBadge;
