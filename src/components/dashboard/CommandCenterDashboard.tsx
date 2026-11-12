import React from 'react';
import { Card, Badge } from '../ui';
import { PROTOCOL_SIMULATION_CATALOG } from '../../data/simulations';
import {
  Activity,
  Compass,
  Network,
  Layers,
  FileQuestion,
  BookOpen,
  ArrowRight,
  Terminal,
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

  const primaryModules = [
    {
      id: 'curriculum',
      title: 'Curriculum Hub',
      subtitle: '48 CCNA & CCNP Modules',
      icon: <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400" />,
      badge: 'Core',
      badgeVariant: 'blue' as const,
      onClick: onNavigateToCurriculum,
    },
    {
      id: 'labs',
      title: 'Protocol Labs',
      subtitle: '5 Live Wire Simulators',
      icon: <Network className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />,
      badge: '5 Sims',
      badgeVariant: 'amber' as const,
      onClick: () => onNavigateToLabs(),
    },
    {
      id: 'quizzes',
      title: 'Practice Quizzes',
      subtitle: 'AI Exam Assessments',
      icon: <FileQuestion className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />,
      badge: 'Exam',
      badgeVariant: 'green' as const,
      onClick: onNavigateToQuizzes,
    },
    {
      id: 'flashcards',
      title: 'Flashcards',
      subtitle: 'Active Recall Decks',
      icon: <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />,
      badge: 'Recall',
      badgeVariant: 'purple' as const,
      onClick: onNavigateToFlashcards,
    },
    {
      id: 'library',
      title: 'Personal Library',
      subtitle: 'AI Custom Lessons & Notes',
      icon: <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />,
      badge: 'Library',
      badgeVariant: 'slate' as const,
      onClick: onNavigateToLibrary,
      colSpan: 'col-span-2 sm:col-span-1',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Sleek Compact 1-Row Console Header */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl bg-surface/90 border border-border-hairline shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight heading-title truncate">
              NetMentor Command Center
            </h1>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-400 truncate">
              CCNA 200-301 &amp; CCNP ENCOR 350-401
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/40 text-[10px] sm:text-[11px] font-mono text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-semibold">Console Live</span>
        </div>
      </div>

      {/* 2. Compact 2-Column Mobile Module Grid (All 5 modules visible above the fold) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            Engineering Modules
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden xs:inline">
            Tap any module to launch
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {primaryModules.map((m) => (
            <Card
              key={m.id}
              variant="interactive"
              onClick={m.onClick}
              className={`p-3 sm:p-3.5 flex flex-col justify-between group touch-target-44 min-h-[88px] sm:min-h-[100px] border-border-hairline hover:border-accent/40 ${
                m.colSpan || ''
              }`}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <div className="p-1 rounded-lg bg-surface-elevated border border-border-hairline group-hover:border-accent/30 transition-colors flex-shrink-0">
                  {m.icon}
                </div>
                <Badge variant={m.badgeVariant} size="sm">
                  {m.badge}
                </Badge>
              </div>

              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-accent transition-colors flex items-center justify-between">
                  <span className="truncate">{m.title}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-1 opacity-70 group-hover:opacity-100" />
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                  {m.subtitle}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 3. Featured Protocol Simulations Strip (Compact Single-Row Cards) */}
      <section className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between border-b border-border-hairline/80 pb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-accent" />
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              Featured Protocol Simulations
            </h2>
          </div>
          <span className="text-[10px] font-mono text-accent">
            5 Live Scenarios
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {PROTOCOL_SIMULATION_CATALOG.map((scenario) => {
            const meta = scenario.metadata;
            return (
              <Card
                key={meta.id}
                variant="interactive"
                onClick={() => onNavigateToLabs(meta.id)}
                className="p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 hover:border-accent/40 transition-all border-border-hairline group touch-target-44"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <Badge variant={getProtocolBadgeVariant(meta.protocol)} size="sm">
                        {meta.protocol}
                      </Badge>
                      <Badge variant={meta.certification === 'CCNP' ? 'amber' : 'blue'} size="sm">
                        {meta.certification}
                      </Badge>
                    </div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">
                      {meta.difficulty}
                    </span>
                  </div>

                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-accent transition-colors leading-snug">
                    {meta.title}
                  </h3>

                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-border-hairline/60 flex items-center justify-between text-xs font-medium text-slate-300 group-hover:text-white">
                  <span className="flex items-center gap-1.5 text-accent font-mono text-[11px]">
                    <Play className="w-3 h-3 fill-accent" />
                    Launch Interactive Lab
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};
