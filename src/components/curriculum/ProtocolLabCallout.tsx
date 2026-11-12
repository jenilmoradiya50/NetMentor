import React from 'react';
import { Card, Badge } from '../ui';
import { PROTOCOL_SIMULATION_CATALOG } from '../../data/simulations';
import type { DetailedLesson } from '../../types/curriculum';
import { Activity, ArrowRight } from 'lucide-react';

export interface ProtocolLabCalloutProps {
  scenarioId: string;
  onLaunchLab: (scenarioId: string) => void;
  className?: string;
}

/**
 * Determines which interactive protocol simulation scenario matches a curriculum lesson.
 * Supports explicit ID mapping, keyword analysis across slug/title/topic, and widget types.
 */
export function getMatchingSimulationScenarioId(lesson: DetailedLesson): string | null {
  // 1. Explicit ID mapping
  if (lesson.id === 'lesson-ospf-neighbor-states') return 'ospf-adjacency-mtu';
  if (lesson.id === 'lesson-packet-walk') return 'arp-mac-learning';
  if (lesson.id.includes('tcp') || lesson.id.includes('handshake')) return 'tcp-handshake-teardown';
  if (lesson.id.includes('vlan') || lesson.id.includes('trunk') || lesson.id.includes('roas')) return 'vlan-trunking-roas';

  // 2. Keyword matching across metadata
  const searchText = `${lesson.id} ${lesson.slug} ${lesson.title} ${lesson.topicId} ${
    lesson.learningObjectives?.join(' ') || ''
  }`.toLowerCase();

  if (
    searchText.includes('vlan') ||
    searchText.includes('trunk') ||
    searchText.includes('802.1q') ||
    searchText.includes('router-on-a-stick') ||
    searchText.includes('inter-vlan')
  ) {
    return 'vlan-trunking-roas';
  }

  if (searchText.includes('ospf') || lesson.interactiveWidget?.type === 'ospf_state_machine') {
    return 'ospf-adjacency-mtu';
  }

  if (
    searchText.includes('arp') ||
    searchText.includes('mac learning') ||
    searchText.includes('packet-walk') ||
    lesson.interactiveWidget?.type === 'packet_walk'
  ) {
    return 'arp-mac-learning';
  }

  if (
    searchText.includes('tcp') ||
    searchText.includes('handshake') ||
    searchText.includes('syn-ack') ||
    searchText.includes('socket')
  ) {
    return 'tcp-handshake-teardown';
  }

  return null;
}

export const ProtocolLabCallout: React.FC<ProtocolLabCalloutProps> = ({
  scenarioId,
  onLaunchLab,
  className = '',
}) => {
  const scenario = PROTOCOL_SIMULATION_CATALOG.find((s) => s.metadata.id === scenarioId);
  if (!scenario) return null;

  return (
    <Card
      variant="elevated"
      className={`border-l-4 border-l-accent p-4 sm:p-6 space-y-4 shadow-xl bg-surface-elevated/95 border-border-hairline relative overflow-hidden group ${className}`}
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Telemetry Header & Status Beacon */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border-hairline pb-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
            Interactive Telecom Lab Simulation Ready
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="amber" size="sm">
            {scenario.metadata.protocol}
          </Badge>
          <Badge variant="blue" size="sm">
            {scenario.metadata.certification}
          </Badge>
          <Badge variant="green" size="sm">
            {scenario.metadata.difficulty}
          </Badge>
          <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 ml-1">
            {scenario.steps.length} Steps
          </span>
        </div>
      </div>

      {/* Main Callout Body */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight heading-title">
              {scenario.metadata.title}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {scenario.metadata.description}
          </p>

          {/* Key Concepts Pills */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {scenario.metadata.keyConcepts.map((concept) => (
              <span
                key={concept}
                className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#090A0C] border border-border-hairline text-slate-300 flex items-center gap-1"
              >
                <span className="text-accent">#</span>
                {concept}
              </span>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 md:pt-0 flex-shrink-0">
          <button
            type="button"
            onClick={() => onLaunchLab(scenario.metadata.id)}
            className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-accent/20 hover:bg-accent/30 text-amber-300 hover:text-white border border-accent/40 hover:border-accent font-semibold text-xs sm:text-sm shadow-lg shadow-accent/10 transition-all press-scale touch-target-44 min-h-[44px] group w-full sm:w-auto"
          >
            <Activity className="w-4 h-4 text-accent flex-shrink-0" />
            <span>Launch Interactive Protocol Walk</span>
            <ArrowRight className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
          </button>
        </div>
      </div>
    </Card>
  );
};
