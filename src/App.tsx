import { useState } from 'react';
import { BookOpen, ShieldCheck, Cpu, Terminal, Compass, CheckCircle2 } from 'lucide-react';
import type { LearningPath } from '@/types';

const INITIAL_PATHS: LearningPath[] = [
  {
    id: 'path-fund',
    slug: 'network-fundamentals',
    title: 'Network Fundamentals',
    description: 'OSI & TCP/IP models, IPv4/IPv6 addressing, subnetting, and switching fundamentals.',
    targetCert: 'Fundamentals',
    orderIndex: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'path-ccna',
    slug: 'ccna-200-301',
    title: 'Cisco CCNA (200-301)',
    description: 'Routing protocols, OSPFv2/v3, VLANs, STP, EtherChannel, ACLs, NAT, and network security.',
    targetCert: 'CCNA',
    orderIndex: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'path-ccnp',
    slug: 'ccnp-encor-350-401',
    title: 'Cisco CCNP Enterprise (ENCOR)',
    description: 'Enterprise architecture, advanced BGP, path selection, dual-stack routing, and SD-WAN.',
    targetCert: 'CCNP Enterprise',
    orderIndex: 3,
    createdAt: new Date().toISOString(),
  },
];

export function App() {
  const [selectedPath, setSelectedPath] = useState<string>(INITIAL_PATHS[0].id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
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
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60">
                  Foundation v0.1
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                AI-Powered Networking Mastery & Interview Preparation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <ShieldCheck className="w-3.5 h-3.5" />
              Auth Guard Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Learning Paths & Status */}
        <section className="lg:col-span-1 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-400" />
              Curriculum Tracks
            </h2>
            <div className="space-y-3">
              {INITIAL_PATHS.map((path) => (
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
          </div>

          {/* Phase 2 Verification Checklist Box */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              Phase 2 Foundation Status
            </h3>
            <ul className="text-xs space-y-2 text-slate-300">
              <li className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Vite + React 18 + TypeScript strict setup
              </li>
              <li className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Tailwind CSS styling & safe-area classes
              </li>
              <li className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                Domain entity contracts & constraints defined
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block flex-shrink-0" />
                Neon DB & Drizzle schema (Phase 3)
              </li>
              <li className="flex items-center gap-2 text-slate-400">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block flex-shrink-0" />
                Gemini AI integration (Phase 4)
              </li>
            </ul>
          </div>
        </section>

        {/* Right Column: Selected Track Preview & Lesson Outline */}
        <section className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
            {INITIAL_PATHS.filter((p) => p.id === selectedPath).map((path) => (
              <div key={path.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-brand-950 text-brand-300 border border-brand-800/50">
                    Track: {path.targetCert}
                  </span>
                  <span className="text-xs text-slate-400">Foundation Ready</span>
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
                      <p className="text-slate-400 mt-1">Host-to-host delivery, frame rewriting, default gateways.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                      <p className="font-semibold text-slate-200">2. OSPF Neighbor States</p>
                      <p className="text-slate-400 mt-1">Down, Init, 2-Way, ExStart, Exchange, Loading, Full.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                      <p className="font-semibold text-slate-200">3. Troubleshooting Scenarios</p>
                      <p className="text-slate-400 mt-1">MTU mismatch, subnet mask errors, passive interface bugs.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
                      <p className="font-semibold text-slate-200">4. Interview Concept Drills</p>
                      <p className="text-slate-400 mt-1">TCP 3-way handshake teardown, BGP loop prevention.</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-4 text-center text-xs text-slate-500 safe-bottom">
        NetMentor &bull; Personal AI Networking Tutor &bull; Built with React, TypeScript & Tailwind CSS
      </footer>
    </div>
  );
}
export default App;
