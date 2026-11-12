import React from 'react';
import { Card, Badge, Button } from '../ui';
import { PROTOCOL_SIMULATION_CATALOG } from '../../data/simulations';
import {
  Activity,
  Compass,
  Network,
  Layers,
  FileQuestion,
  BookOpen,
  Bot,
  ArrowRight,
  Terminal,
  ShieldCheck,
  Cpu,
  Play,
} from 'lucide-react';

export interface CommandCenterDashboardProps {
  onNavigateToCurriculum: () => void;
  onNavigateToLabs: (scenarioId?: string) => void;
  onNavigateToFlashcards: () => void;
  onNavigateToQuizzes: () => void;
  onNavigateToLibrary: () => void;
  onOpenAiTutor: () => void;
}

export const CommandCenterDashboard: React.FC<CommandCenterDashboardProps> = ({
  onNavigateToCurriculum,
  onNavigateToLabs,
  onNavigateToFlashcards,
  onNavigateToQuizzes,
  onNavigateToLibrary,
  onOpenAiTutor,
}) => {
  // Protocol color mapping for badges
  const getProtocolBadgeVariant = (protocol: string): 'blue' | 'green' | 'amber' | 'purple' | 'slate' => {
    switch (protocol) {
      case 'TCP':
        return 'blue';
      case 'BGP':
        return 'green';
      case 'OSPF':
        return 'amber';
      case 'VLAN':
        return 'purple';
      case 'ARP':
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in-50 duration-200">
      {/* 1. System Telemetry & Welcome Header */}
      <Card variant="elevated" className="p-5 sm:p-7 border-border-hairline bg-gradient-to-br from-surface to-surface-elevated/90 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-60 h-60 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          {/* Status strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border-hairline/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono font-semibold tracking-wider text-emerald-400 uppercase">
                Console Live
              </span>
              <span className="text-slate-600 font-mono text-[11px]">•</span>
              <span className="text-[11px] font-mono text-slate-300">
                CCNA 200-301 &amp; CCNP ENCOR 350-401
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">PostgreSQL Synced</span>
            </div>
          </div>

          {/* Welcome Title & Mission */}
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                <Activity className="w-5 h-5 text-accent" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight heading-title">
                NetMentor Command Center
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Unified telecommunications engineering portal for enterprise networking mastery. Trace packet flows down to the wire, evaluate protocol state machines, practice with spaced-repetition, and accelerate certification readiness.
            </p>
          </div>

          {/* Quick-Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={onNavigateToCurriculum}
              icon={<Compass className="w-4 h-4" />}
              className="touch-target-44 min-h-[44px]"
            >
              Resume Curriculum
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => onNavigateToLabs()}
              icon={<Network className="w-4 h-4 text-accent" />}
              className="touch-target-44 min-h-[44px]"
            >
              Launch Protocol Simulator
            </Button>
            <button
              type="button"
              onClick={onOpenAiTutor}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-slate-700/80 hover:border-accent/40 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-all press-scale min-h-[44px] touch-target-44 shadow-sm"
            >
              <Bot className="w-4 h-4 text-accent" />
              <span>Ask AI Network Architect</span>
            </button>
          </div>
        </div>
      </Card>

      {/* 2. Primary Section Launchpad Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Engineering Modules
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            Select a module to begin
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 1: Curriculum Hub */}
          <Card
            variant="interactive"
            onClick={onNavigateToCurriculum}
            className="p-5 flex flex-col justify-between group h-full space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-950/70 border border-blue-800/60 flex items-center justify-center text-blue-400 group-hover:text-blue-300 transition-colors">
                  <Compass className="w-5 h-5" />
                </div>
                <Badge variant="blue" size="sm">
                  Core Path
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>Curriculum Hub</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Hierarchical study tracks covering Network Fundamentals, Routing &amp; Switching, IP Services, Security, and Programmability.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>3 Paths</span>
              <span className="text-slate-300 font-semibold">48 In-Depth Lessons</span>
            </div>
          </Card>

          {/* Card 2: Protocol Explorer Labs */}
          <Card
            variant="interactive"
            onClick={() => onNavigateToLabs()}
            className="p-5 flex flex-col justify-between group h-full space-y-4 border-accent/30"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-accent group-hover:text-amber-300 transition-colors">
                  <Network className="w-5 h-5" />
                </div>
                <Badge variant="amber" size="sm">
                  5 Live Sims
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>Protocol Explorer Labs</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Interactive packet-walk simulator tracing multi-layer L2/L3/L4 wire headers, hardware CAM tables, routing RIBs, and Socratic hints.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="text-accent font-semibold">5 Hardware Topologies</span>
              <span>Wire Inspection</span>
            </div>
          </Card>

          {/* Card 3: Diagnostic Quizzes */}
          <Card
            variant="interactive"
            onClick={onNavigateToQuizzes}
            className="p-5 flex flex-col justify-between group h-full space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  <FileQuestion className="w-5 h-5" />
                </div>
                <Badge variant="green" size="sm">
                  AI Exam Engine
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>Practice Quizzes</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Timed scenario-based certification practice tests with instant automated grading, detailed answer rationales, and gap analysis.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Exam Mode</span>
              <span className="text-emerald-400 font-semibold">Instant Grading</span>
            </div>
          </Card>

          {/* Card 4: Spaced-Repetition Flashcards */}
          <Card
            variant="interactive"
            onClick={onNavigateToFlashcards}
            className="p-5 flex flex-col justify-between group h-full space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-800/60 flex items-center justify-center text-purple-400 group-hover:text-purple-300 transition-colors">
                  <Layers className="w-5 h-5" />
                </div>
                <Badge variant="purple" size="sm">
                  Active Recall
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>Flashcard Decks</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Optimized Leitner spaced-repetition card decks covering networking terminology, port numbers, binary subnetting, and protocol standards.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Confidence Ratings</span>
              <span className="text-purple-300 font-semibold">Spaced Recall</span>
            </div>
          </Card>

          {/* Card 5: Personal Learning Library */}
          <Card
            variant="interactive"
            onClick={onNavigateToLibrary}
            className="p-5 flex flex-col justify-between group h-full space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-surface-elevated border border-slate-700/80 flex items-center justify-center text-amber-400 group-hover:text-amber-300 transition-colors">
                  <BookOpen className="w-5 h-5" />
                </div>
                <Badge variant="slate" size="sm">
                  Generative AI
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>Personal Library</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Generate custom tailored lessons on any technical networking topic, save key takeaways, and maintain a private knowledge repository.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Custom Notes</span>
              <span className="text-slate-300 font-semibold">AI Generated</span>
            </div>
          </Card>

          {/* Card 6: AI Telecom Tutor */}
          <Card
            variant="interactive"
            onClick={onOpenAiTutor}
            className="p-5 flex flex-col justify-between group h-full space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:text-white transition-colors">
                  <Bot className="w-5 h-5" />
                </div>
                <Badge variant="amber" size="sm">
                  Always-On AI
                </Badge>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span>AI Tutor &amp; Architect</span>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Context-aware AI tutor trained on Cisco enterprise architectures, RFC specifications, and systematic troubleshooting methodologies.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="text-accent font-semibold">Socratic Guidance</span>
              <span>24/7 Available</span>
            </div>
          </Card>
        </div>
      </section>

      {/* 3. Featured Protocol Simulations Strip */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border-hairline pb-2.5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Featured Protocol Simulations
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            5 Live Interactive Wire Laboratories
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {PROTOCOL_SIMULATION_CATALOG.map((scenario) => {
            const meta = scenario.metadata;
            return (
              <Card
                key={meta.id}
                variant="elevated"
                className="p-4 sm:p-5 flex flex-col justify-between space-y-4 hover:border-accent/40 transition-all border-border-hairline"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={getProtocolBadgeVariant(meta.protocol)} size="sm">
                        {meta.protocol}
                      </Badge>
                      <Badge variant={meta.certification === 'CCNP' ? 'amber' : 'blue'} size="sm">
                        {meta.certification}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      {meta.difficulty}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-accent transition-colors leading-snug">
                      {meta.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </div>

                  {/* Key Concepts Pills */}
                  <div className="flex flex-wrap gap-1">
                    {meta.keyConcepts.slice(0, 2).map((concept, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border-hairline text-slate-400 truncate max-w-full"
                      >
                        {concept.split(':')[0]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border-hairline/60">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-between touch-target-44 min-h-[44px]"
                    onClick={() => onNavigateToLabs(meta.id)}
                    icon={<Play className="w-3.5 h-3.5 text-accent" />}
                  >
                    <span>Launch Interactive Lab</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};
