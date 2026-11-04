import React, { useState } from 'react';
import { Network, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button.js';
import { Badge } from '../../ui/Badge.js';
import { Card } from '../../ui/Card.js';

interface OspfStateNode {
  id: string;
  name: string;
  milestone: string;
  packetTrigger: string;
  details: string;
}

const OSPF_STATES: OspfStateNode[] = [
  {
    id: 'DOWN',
    name: '1. DOWN',
    milestone: 'No Hellos received',
    packetTrigger: 'None yet',
    details: 'Initial state. No OSPF Hello packets have been received from this neighbor interface yet.',
  },
  {
    id: 'INIT',
    name: '2. INIT',
    milestone: 'Hello received, 1-way',
    packetTrigger: 'Hello Packet',
    details: 'A Hello packet was received from the neighbor, but the local router\'s RID is NOT listed in the neighbor\'s active neighbor list.',
  },
  {
    id: '2-WAY',
    name: '3. 2-WAY',
    milestone: 'Bi-directional established',
    packetTrigger: 'Hello containing my RID',
    details: 'Bi-directional communication confirmed! The local router sees its own RID listed inside the neighbor\'s Hello. DR/BDR election occurs here on broadcast segments.',
  },
  {
    id: 'EXSTART',
    name: '4. EXSTART',
    milestone: 'Master/Slave negotiation',
    packetTrigger: 'Empty DBD Packets',
    details: 'Routers negotiate who will lead the database exchange (Master = highest Router ID) and pick an initial Sequence Number.',
  },
  {
    id: 'EXCHANGE',
    name: '5. EXCHANGE',
    milestone: 'LSA summaries sent',
    packetTrigger: 'DBD Packets (with LSA headers)',
    details: 'Routers exchange Database Description (DBD) packets containing summary headers for every LSA in their Link-State Database (LSDB).',
  },
  {
    id: 'LOADING',
    name: '6. LOADING',
    milestone: 'Requesting missing LSAs',
    packetTrigger: 'LSR & LSU Packets',
    details: 'Routers send Link-State Requests (LSR) for missing or newer LSAs discovered in the DBDs. The neighbor responds with Link-State Updates (LSU).',
  },
  {
    id: 'FULL',
    name: '7. FULL',
    milestone: 'LSDBs fully synchronized',
    packetTrigger: 'LSAck Packets',
    details: 'Adjacency complete! All updates acknowledged via LSAck. Both routers possess 100% identical topological LSDBs for this area.',
  },
];

type ScenarioMode = 'normal' | 'mtu_mismatch' | 'drother' | 'timer_mismatch';

export const OspfStateMachineVisualizer: React.FC = () => {
  const [scenario, setScenario] = useState<ScenarioMode>('normal');
  const [activeStateIndex, setActiveStateIndex] = useState(0);
  const stateButtonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const stripContainerRef = React.useRef<HTMLDivElement>(null);
  const isInitialMount = React.useRef(true);

  // Keep active state centered in the horizontal strip on mobile on step change (local container scroll only)
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const container = stripContainerRef.current;
    const el = stateButtonRefs.current[activeStateIndex];
    if (container && el) {
      const targetLeft = el.offsetLeft - (container.clientWidth / 2) + (el.clientWidth / 2);
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  }, [activeStateIndex]);

  // Maximum reachable state depending on the simulated scenario
  const maxReachableIndex =
    scenario === 'normal'
      ? 6 // FULL
      : scenario === 'mtu_mismatch'
      ? 3 // Stuck in EXSTART
      : scenario === 'drother'
      ? 2 // Stuck in 2-WAY
      : 0; // Stuck in DOWN

  const handleScenarioChange = (sc: ScenarioMode) => {
    setScenario(sc);
    setActiveStateIndex(0);
  };

  const currentState = OSPF_STATES[activeStateIndex];

  const scenarioOptions = [
    { id: 'normal' as ScenarioMode, label: 'Standard Adjacency (FULL)' },
    { id: 'mtu_mismatch' as ScenarioMode, label: 'MTU Mismatch (Stuck EXSTART)' },
    { id: 'drother' as ScenarioMode, label: 'DROTHER (Normal 2-WAY)' },
    { id: 'timer_mismatch' as ScenarioMode, label: 'Timer Mismatch (Stuck DOWN)' },
  ];

  return (
    <Card variant="elevated" padding="md" className="space-y-5 text-slate-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2 heading-title">
            <Network className="w-4 h-4 text-accent" />
            OSPF 7-State Adjacency Machine
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Trace packet transitions or simulate common network misconfigurations.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setScenario('normal');
            setActiveStateIndex(0);
          }}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          <span>Reset</span>
        </Button>
      </div>

      {/* Scenario Mode Switcher Pills */}
      <div className="space-y-1.5">
        <span className="text-xs text-slate-400 font-medium block">Simulate Adjacency Condition:</span>
        <div className="flex flex-wrap items-center gap-2">
          {scenarioOptions.map((opt) => {
            const isSelected = scenario === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleScenarioChange(opt.id)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 press-scale select-none min-h-[40px] flex items-center ${
                  isSelected
                    ? 'bg-accent/20 text-sky-200 border-accent/50 shadow-sm'
                    : 'bg-surface-subtle/80 text-slate-400 border-white/[0.06] hover:text-slate-200 hover:border-white/20'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* State Machine Flow Diagram (Horizontal snap-scroll on phones, clean grid on tablet/desktop) */}
      <div ref={stripContainerRef} className="overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        <div className="flex sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-2 snap-x snap-mandatory">
          {OSPF_STATES.map((st, idx) => {
            const isCurrent = idx === activeStateIndex;
            const isBlocked = idx > maxReachableIndex;
            const isPast = idx < activeStateIndex;

            return (
              <button
                key={st.id}
                ref={(el) => { stateButtonRefs.current[idx] = el; }}
                type="button"
                disabled={isBlocked}
                onClick={() => setActiveStateIndex(idx)}
                className={`w-[120px] shrink-0 sm:w-auto snap-center p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-150 select-none press-scale min-h-[76px] ${
                  isCurrent
                    ? 'bg-warning/20 border-warning/60 ring-2 ring-warning/30 shadow-lg shadow-warning/10 z-10'
                    : isBlocked
                    ? 'bg-surface-subtle/40 border-white/[0.04] opacity-35 cursor-not-allowed'
                    : isPast
                    ? 'bg-success/15 border-success/30 text-emerald-300'
                    : 'bg-surface-subtle/80 border-white/[0.08] hover:border-white/20 text-slate-400'
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block font-medium">Phase {idx + 1}</span>
                  <span
                    className={`text-xs font-bold block ${
                      isCurrent ? 'text-amber-300' : isPast ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    {st.id}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 line-clamp-1">{st.milestone}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active State Detail Banner */}
      <div className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.08] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-2">
            <Badge variant="amber" size="sm">
              State: {currentState.name}
            </Badge>
            <span className="text-xs font-medium text-slate-300">
              Milestone: <strong className="text-white">{currentState.milestone}</strong>
            </span>
          </div>

          <div className="text-xs text-sky-300 font-mono">
            Packet Trigger: <span className="font-semibold text-white">{currentState.packetTrigger}</span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{currentState.details}</p>

        {/* Diagnostic Alert if Scenario is blocked */}
        {scenario === 'mtu_mismatch' && activeStateIndex === 3 && (
          <div className="p-3.5 rounded-xl bg-warning/15 border border-warning/30 text-xs flex items-start gap-2.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-semibold">Diagnostic: Frozen in EXSTART</strong>
              <span className="leading-relaxed">
                Both routers are stuck in EXSTART because the Master router sends a Database Description (DBD) packet
                matching its interface MTU. The receiving router sees an MTU mismatch and discards the DBD packet. Adjacency
                never progresses to EXCHANGE or FULL!
              </span>
            </div>
          </div>
        )}

        {scenario === 'drother' && activeStateIndex === 2 && (
          <div className="p-3.5 rounded-xl bg-accent/15 border border-accent/30 text-xs flex items-start gap-2.5 text-sky-200">
            <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-semibold">Normal Architecture: 2-WAY on Broadcast Segments</strong>
              <span className="leading-relaxed">
                DROTHER routers only form FULL adjacencies with the Designated Router (DR) and Backup DR (BDR). DROTHER
                routers stay in 2-WAY with each other to eliminate $N \times (N-1) / 2$ full mesh adjacency overhead!
              </span>
            </div>
          </div>
        )}

        {scenario === 'timer_mismatch' && activeStateIndex === 0 && (
          <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/30 text-xs flex items-start gap-2.5 text-red-200">
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-semibold">Diagnostic: Frozen in DOWN</strong>
              <span className="leading-relaxed">
                Hello packets carry the configured Hello and Dead intervals. If Router A uses 10s/40s and Router B uses
                5s/20s, the Hello packet is discarded upon receipt and the neighbor relationship never reaches INIT!
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stepping Navigation Controls */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={activeStateIndex === 0}
          onClick={() => setActiveStateIndex((prev) => Math.max(0, prev - 1))}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          <span>Previous State</span>
        </Button>

        <span className="text-xs text-slate-400 font-mono">
          State {activeStateIndex + 1} of {OSPF_STATES.length}
        </span>

        <Button
          variant="primary"
          size="sm"
          disabled={activeStateIndex >= maxReachableIndex}
          onClick={() => setActiveStateIndex((prev) => Math.min(maxReachableIndex, prev + 1))}
        >
          <span>Next State</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </Card>
  );
};
