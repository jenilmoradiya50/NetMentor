import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { DatabaseStatusBadge } from './components/common/DatabaseStatusBadge';
import { FlashcardsHub } from './components/flashcards/FlashcardsHub';
import { PacketTracerLabsView } from './components/labs/PacketTracerLabsView';
import { authApi } from './lib/api';
import type { LearningPath } from './types';
import {
  BookOpen,
  ShieldCheck,
  Cpu,
  Terminal,
  Compass,
  CheckCircle2,
  LogOut,
  Loader2,
  Clock,
  RefreshCw,
  Sparkles,
  Layers,
  Network,
} from 'lucide-react';

const SYNTHETIC_PATHS: LearningPath[] = [
  {
    id: 'demo-fund',
    slug: 'network-fundamentals',
    title: 'Network Fundamentals (Demo)',
    description: 'OSI & TCP/IP models, IPv4/IPv6 addressing, subnetting, and switching fundamentals.',
    targetCert: 'Fundamentals',
    orderIndex: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-ccna',
    slug: 'ccna-200-301',
    title: 'CCNA: Routing, Switching & Security (Demo)',
    description: 'VLANs, Trunking, STP, EtherChannel, OSPFv2, NAT, ACLs, and wireless LAN architecture.',
    targetCert: 'CCNA',
    orderIndex: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-encor',
    slug: 'ccnp-encor',
    title: 'CCNP: Enterprise Core & Architecture (Demo)',
    description: 'BGP path vector routing, SD-WAN overlay fabrics, QoS, and Python network automation.',
    targetCert: 'CCNP Enterprise',
    orderIndex: 3,
    createdAt: new Date().toISOString(),
  },
];

function Dashboard() {
  const { logout, isDemoMode, exitDemoMode, user, sessionExpiresAt } = useAuth();
  const [mainTab, setMainTab] = useState<'flashcards' | 'curriculum' | 'labs'>('flashcards');
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loadingPaths, setLoadingPaths] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadProtectedData = async () => {
    setLoadingPaths(true);
    setFetchError(null);

    if (isDemoMode) {
      setPaths(SYNTHETIC_PATHS);
      if (!selectedPath) {
        setSelectedPath(SYNTHETIC_PATHS[0].id);
      }
      setLoadingPaths(false);
      return;
    }

    const res = await authApi.getPaths();
    if (res.data?.paths) {
      setPaths(res.data.paths);
      if (res.data.paths.length > 0 && !selectedPath) {
        setSelectedPath(res.data.paths[0].id);
      }
    } else {
      setFetchError(res.message || 'Failed to fetch protected curriculum tracks');
    }
    setLoadingPaths(false);
  };

  useEffect(() => {
    loadProtectedData();
  }, [isDemoMode]);

  const formatExpiresAt = (expSeconds: number | null) => {
    if (!expSeconds) return 'Active';
    const date = new Date(expSeconds * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Demo Mode Alert Banner */}
      {isDemoMode && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-center text-xs text-amber-200 flex flex-wrap items-center justify-center gap-2 shadow-inner">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span>
            <strong>DEMO MODE ACTIVE:</strong> Exploring synthetic curriculum data for UI evaluation. Real database authentication is bypassed. Administrative controls are disabled.
          </span>
          <button
            onClick={exitDemoMode}
            className="ml-2 px-2.5 py-0.5 rounded-md bg-amber-900 hover:bg-amber-800 text-amber-100 border border-amber-700 text-[11px] font-semibold transition-colors shadow-sm"
          >
            Exit Demo Mode
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-20 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                NetMentor
                {isDemoMode ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/80">
                    Demo Mode (Synthetic Data)
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60">
                    Protected Session
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                AI-Powered Networking Mastery & Interview Preparation
              </p>
            </div>
          </div>

          {/* Database status, Session info & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <DatabaseStatusBadge showLatency={true} />
            </div>

            {isDemoMode ? (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/50">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium">Demo Mode</span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 text-xs px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>User: <strong className="font-semibold text-slate-100">{user || 'jenilmoradiya50'}</strong></span>
                {sessionExpiresAt && (
                  <span className="text-slate-400 border-l border-emerald-800/60 pl-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Exp: {formatExpiresAt(sessionExpiresAt)}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => (isDemoMode ? exitDemoMode() : logout())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-800/50 border border-slate-700 text-slate-200 transition-all shadow-sm"
              title={isDemoMode ? 'Exit Demo Mode' : 'Sign Out of NetMentor'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isDemoMode ? 'Exit Demo' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Platform Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/40 sticky top-[57px] z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setMainTab('flashcards')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              mainTab === 'flashcards'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>CCNA Flashcards</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60 hidden sm:inline-block">
              Jeremy's IT Lab
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('labs')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              mainTab === 'labs'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Packet Tracer Labs</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              48 Labs
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('curriculum')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              mainTab === 'curriculum'
                ? 'border-brand-500 text-brand-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Guarded Curriculum</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {mainTab === 'flashcards' ? (
          <FlashcardsHub />
        ) : mainTab === 'labs' ? (
          <PacketTracerLabsView />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Learning Paths from Server */}
            <section className="lg:col-span-1 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-brand-400" />
                    Guarded Curriculum
                  </h2>
                  <button
                    onClick={loadProtectedData}
                    disabled={loadingPaths}
                    className="text-slate-400 hover:text-slate-200 p-1"
                    title="Refresh curriculum from server"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPaths ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingPaths ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
                    <Loader2 className="w-5 h-5 text-brand-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-400">Loading protected paths...</p>
                  </div>
                ) : fetchError ? (
                  <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                    {fetchError}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paths.map((path) => (
                      <button
                        key={path.id}
                        onClick={() => setSelectedPath(path.id)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          selectedPath === path.id
                            ? 'bg-slate-800/90 border-brand-500/60 shadow-md shadow-brand-500/5 ring-1 ring-brand-500/30'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                            {path.targetCert}
                          </span>
                          {selectedPath === path.id && (
                            <CheckCircle2 className="w-4 h-4 text-brand-400" />
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-100 text-sm">{path.title}</h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{path.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Security Status Box */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-brand-400" />
                  Runtime Security Status
                </h3>
                <ul className="text-xs space-y-2 text-slate-300">
                  {isDemoMode ? (
                    <>
                      <li className="flex items-center gap-2 text-amber-400">
                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                        Demo Mode Active (Synthetic Curriculum)
                      </li>
                      <li className="flex items-center gap-2 text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                        No real database queries performed
                      </li>
                      <li className="flex items-center gap-2 text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                        Administrative APIs restricted
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        HttpOnly signed session cookie
                      </li>
                      <li className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        Server-side API route guard active
                      </li>
                      <li className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        Argon2id live database auth
                      </li>
                      <li className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        Anti-CSRF custom header validation
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </section>

            {/* Right Column: Active Track Outline */}
            <section className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
                {paths.filter((p) => p.id === selectedPath).length > 0 ? (
                  paths
                    .filter((p) => p.id === selectedPath)
                    .map((path) => (
                      <div key={path.id} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-950 text-brand-300 border border-brand-800/50">
                            Track: {path.targetCert}
                          </span>
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Guarded Server Response
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-white">{path.title}</h2>
                        <p className="text-sm text-slate-300 leading-relaxed">{path.description}</p>

                        <div className="pt-4 border-t border-slate-800/80">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-brand-400" />
                            Target Modules for Seed Curriculum
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                              <p className="font-semibold text-slate-200">1. Packet Walkthrough & ARP</p>
                              <p className="text-slate-400 mt-1">
                                Host-to-host delivery, frame rewriting, default gateways.
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                              <p className="font-semibold text-slate-200">2. OSPF Neighbor States</p>
                              <p className="text-slate-400 mt-1">
                                Down, Init, 2-Way, ExStart, Exchange, Loading, Full.
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                              <p className="font-semibold text-slate-200">3. Troubleshooting Scenarios</p>
                              <p className="text-slate-400 mt-1">
                                MTU mismatch, subnet mask errors, passive interface bugs.
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                              <p className="font-semibold text-slate-200">4. Interview Concept Drills</p>
                              <p className="text-slate-400 mt-1">
                                TCP 3-way handshake teardown, BGP loop prevention.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    Select a learning path to inspect its modules.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500 safe-bottom">
        NetMentor &bull; Personal AI Networking Tutor &bull; Protected Session
      </footer>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Full-screen loading screen while checking existing HttpOnly session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="h-12 w-12 rounded-2xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400 mb-4 animate-pulse">
          <Terminal className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          Verifying security session...
        </p>
      </div>
    );
  }

  // Unauthenticated visitors must log in
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated user gets full application
  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
