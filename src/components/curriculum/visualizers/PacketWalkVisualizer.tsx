import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Shield,
  Laptop,
  Server,
  Router,
  CheckCircle2,
  Info,
  Activity,
} from 'lucide-react';
import { Button } from '../../ui/Button.js';
import { Badge } from '../../ui/Badge.js';
import { Card } from '../../ui/Card.js';

interface HopStep {
  stepIndex: number;
  title: string;
  shortTitle: string;
  nodeName: string;
  location: string;
  nodeType: 'host' | 'router' | 'switch' | 'server';
  description: string;
  activeSegment: 'hostA' | 'link1' | 'router1' | 'link2' | 'router2' | 'link3' | 'serverB';
  layer2: {
    srcMac: string;
    dstMac: string;
    changed: boolean;
    explanation: string;
  };
  layer3: {
    srcIp: string;
    dstIp: string;
    ttl: number;
    ttlChanged: boolean;
    explanation: string;
  };
  takeaway: string;
}

const STEPS: HopStep[] = [
  {
    stepIndex: 1,
    title: '1. Host A Prepares Frame (Origin)',
    shortTitle: 'Origin Host A',
    nodeName: 'Host A (192.168.1.10)',
    location: 'Host A — LAN 1',
    nodeType: 'host',
    description:
      'Host A compares destination 172.16.1.50 with its own subnet mask. The destination is OFF-SUBNET! Host A must forward the packet to its Default Gateway (192.168.1.1). Host A checks its ARP table for Router R1\'s LAN MAC address.',
    activeSegment: 'hostA',
    layer2: {
      srcMac: 'AA:AA:AA:AA:AA:AA (Host A)',
      dstMac: '00:11:11:11:11:11 (Router R1 LAN)',
      changed: false,
      explanation: 'Destination MAC is R1 (Default Gateway), NOT Server B!',
    },
    layer3: {
      srcIp: '192.168.1.10',
      dstIp: '172.16.1.50',
      ttl: 64,
      ttlChanged: false,
      explanation: 'End-to-End addresses set at origin.',
    },
    takeaway: 'Destination MAC is the DEFAULT GATEWAY, not Server B, because routers do not pass Layer 2 broadcasts!',
  },
  {
    stepIndex: 2,
    title: '2. Transit over LAN 1 to Router R1',
    shortTitle: 'Switch Transit',
    nodeName: 'Switch 1 / LAN 1 Cable',
    location: 'LAN 1 (Ethernet 1000BASE-T)',
    nodeType: 'switch',
    description:
      'The Ethernet frame travels over the local switch to Router R1. The switch inspects the destination MAC (R1-LAN) in its MAC address table and forwards the frame only out the port connecting to Router R1.',
    activeSegment: 'link1',
    layer2: {
      srcMac: 'AA:AA:AA:AA:AA:AA (Host A)',
      dstMac: '00:11:11:11:11:11 (Router R1 LAN)',
      changed: false,
      explanation: 'Switches do NOT modify MAC addresses.',
    },
    layer3: {
      srcIp: '192.168.1.10',
      dstIp: '172.16.1.50',
      ttl: 64,
      ttlChanged: false,
      explanation: 'Layer 3 headers pass completely untouched through switches.',
    },
    takeaway: 'Switches operate strictly at Layer 2: they forward frames based on MAC addresses and never modify IP headers.',
  },
  {
    stepIndex: 3,
    title: '3. Router R1 De-encapsulates & Looks up Route',
    shortTitle: 'Router R1 Hop',
    nodeName: 'Router R1 (Gateway)',
    location: 'Router R1 (LAN: 192.168.1.1 | WAN: 10.0.0.1)',
    nodeType: 'router',
    description:
      'Router R1 receives the frame, validates FCS, strips the Layer 2 header, decrements TTL from 64 to 63, and inspects destination 172.16.1.50 in its routing table (finding next-hop 10.0.0.2 via WAN).',
    activeSegment: 'router1',
    layer2: {
      srcMac: 'STRIPPED (De-encapsulation)',
      dstMac: 'STRIPPED (De-encapsulation)',
      changed: true,
      explanation: 'Old Layer 2 header discarded at the Layer 3 boundary!',
    },
    layer3: {
      srcIp: '192.168.1.10',
      dstIp: '172.16.1.50',
      ttl: 63,
      ttlChanged: true,
      explanation: 'TTL decremented: 64 -> 63. IPs remain constant!',
    },
    takeaway: 'Router R1 strips Layer 2 completely and decrements TTL by 1. The Source and Destination IP addresses are NOT modified!',
  },
  {
    stepIndex: 4,
    title: '4. Transit over Point-to-Point WAN to Router R2',
    shortTitle: 'WAN Transit',
    nodeName: 'WAN Link (10.0.0.0/30)',
    location: 'Serial / WAN Link (R1 -> R2)',
    nodeType: 'switch',
    description:
      'Router R1 builds a BRAND NEW Layer 2 frame for the WAN segment. Source MAC is R1\'s WAN interface; Destination MAC is R2\'s WAN interface. The packet traverses the WAN.',
    activeSegment: 'link2',
    layer2: {
      srcMac: '00:11:11:22:22:22 (R1-WAN)',
      dstMac: '00:22:22:11:11:11 (R2-WAN)',
      changed: true,
      explanation: 'New WAN Layer 2 header constructed.',
    },
    layer3: {
      srcIp: '192.168.1.10',
      dstIp: '172.16.1.50',
      ttl: 63,
      ttlChanged: false,
      explanation: 'IP addresses remain constant in transit.',
    },
    takeaway: 'Layer 2 MACs have changed completely! But notice: Source IP is STILL 192.168.1.10 and Destination IP is STILL 172.16.1.50!',
  },
  {
    stepIndex: 5,
    title: '5. Router R2 Delivery to Destination Server B',
    shortTitle: 'Delivery Server B',
    nodeName: 'Router R2 -> Server B',
    location: 'Router R2 (LAN 2: 172.16.1.1) -> Server B',
    nodeType: 'server',
    description:
      'Router R2 strips the WAN Layer 2 header, decrements TTL (63 -> 62), finds 172.16.1.50 directly connected on LAN 2, encapsulates a new frame with Server B\'s MAC, and delivers it to Server B!',
    activeSegment: 'link3',
    layer2: {
      srcMac: '00:22:22:22:22:22 (R2-LAN)',
      dstMac: 'BB:BB:BB:BB:BB:BB (Server B)',
      changed: true,
      explanation: 'Final Layer 2 rewrite targeting Server B MAC.',
    },
    layer3: {
      srcIp: '192.168.1.10',
      dstIp: '172.16.1.50',
      ttl: 62,
      ttlChanged: true,
      explanation: 'TTL decremented: 63 -> 62. Target reached!',
    },
    takeaway: 'Packet successfully delivered! Host-to-Host Layer 3 addresses remained constant end-to-end, while Layer 2 MAC addresses changed at every single hop.',
  },
];

export const PacketWalkVisualizer: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const step = STEPS[currentStepIndex];

  // Auto-play timer management with strict cleanup
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= STEPS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3500);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((p) => p - 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  };

  const getNodeIcon = (type: HopStep['nodeType']) => {
    switch (type) {
      case 'host':
        return <Laptop className="w-5 h-5 text-accent" />;
      case 'router':
        return <Router className="w-5 h-5 text-warning" />;
      case 'switch':
        return <Activity className="w-5 h-5 text-brand-400" />;
      case 'server':
        return <Server className="w-5 h-5 text-success" />;
    }
  };

  return (
    <Card variant="elevated" padding="md" className="space-y-4 sm:space-y-5">
      {/* Simulation Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-white heading-title">
              {step.title}
            </h4>
            <Badge variant="blue" size="sm">
              Hop {step.stepIndex} of 5
            </Badge>
          </div>
          <span className="text-xs text-slate-400 font-mono block mt-0.5">
            Active Segment: {step.location}
          </span>
        </div>

        {/* Global Animation Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant={isPlaying ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            icon={isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            aria-label={isPlaying ? 'Pause simulation' : 'Auto play packet simulation'}
            className="min-h-[40px] px-3.5"
          >
            <span>{isPlaying ? 'Pause' : 'Auto Play'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            title="Reset to beginning"
            aria-label="Reset simulation"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            className="min-h-[40px]"
          >
            <span className="hidden sm:inline">Reset</span>
          </Button>

          {/* Step Stepper Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-800/80 pl-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              aria-label="Previous hop"
              className="p-2 rounded-xl bg-surface-subtle border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none press-scale min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentStepIndex === STEPS.length - 1}
              aria-label="Next hop"
              className="p-2 rounded-xl bg-surface-subtle border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none press-scale min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE-FIRST HOP TRACKER (Replaces wide horizontal diagram on mobile) */}
      <div className="block md:hidden space-y-2">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-1">
          Network Path Progression
        </span>

        {/* 5-Step Tap Bar for Quick Navigation */}
        <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-surface-subtle border border-slate-800">
          {STEPS.map((s, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPast = idx < currentStepIndex;

            return (
              <button
                key={s.stepIndex}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex(idx);
                }}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition-all select-none press-scale min-h-[44px] ${
                  isCurrent
                    ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-500/30'
                    : isPast
                    ? 'bg-surface-elevated text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-label={`Jump to Hop ${s.stepIndex}: ${s.shortTitle}`}
              >
                <span className="text-[10px] font-mono">Hop {s.stepIndex}</span>
                <span className="text-[9px] truncate max-w-full leading-tight mt-0.5">
                  {s.shortTitle.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP TOPOLOGY DIAGRAM (Shown on md+ screens) */}
      <div className="hidden md:block relative py-4 px-3 bg-canvas border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar shadow-inner">
        <div className="flex items-center justify-between relative px-6 py-2 min-w-[620px]">
          {/* Node 1: Host A */}
          <div
            className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              step.activeSegment === 'hostA'
                ? 'bg-accent/20 border-brand-500 ring-2 ring-brand-500/30 scale-105 shadow-lg shadow-brand-500/15'
                : 'bg-surface-elevated/80 border-slate-800'
            }`}
            onClick={() => setCurrentStepIndex(0)}
          >
            <Laptop className="w-7 h-7 text-brand-400 mb-1" />
            <span className="text-xs font-bold text-white">Host A</span>
            <span className="text-[10px] text-slate-400 font-mono">192.168.1.10</span>
            <span className="text-[9px] text-slate-500 font-mono">MAC: AA:AA</span>
          </div>

          {/* Link 1 */}
          <div className="flex-1 flex flex-col items-center px-2">
            <span className="text-[10px] text-slate-400 font-mono mb-1">LAN 1 (Ethernet)</span>
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-200 ${
                step.activeSegment === 'link1' ? 'bg-warning animate-pulse' : 'bg-surface-elevated'
              }`}
            />
          </div>

          {/* Node 2: Router R1 */}
          <div
            className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              step.activeSegment === 'router1'
                ? 'bg-warning/20 border-warning ring-2 ring-warning/30 scale-105 shadow-lg shadow-warning/15'
                : 'bg-surface-elevated/80 border-slate-800'
            }`}
            onClick={() => setCurrentStepIndex(2)}
          >
            <Router className="w-7 h-7 text-warning mb-1" />
            <span className="text-xs font-bold text-white">Router R1</span>
            <span className="text-[10px] text-slate-400 font-mono">GW: 192.168.1.1</span>
            <span className="text-[9px] text-slate-500 font-mono">WAN: 10.0.0.1</span>
          </div>

          {/* Link 2 */}
          <div className="flex-1 flex flex-col items-center px-2">
            <span className="text-[10px] text-slate-400 font-mono mb-1">WAN Link</span>
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-200 ${
                step.activeSegment === 'link2' ? 'bg-warning animate-pulse' : 'bg-surface-elevated'
              }`}
            />
          </div>

          {/* Node 3: Router R2 */}
          <div
            className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              step.activeSegment === 'router2'
                ? 'bg-warning/20 border-warning ring-2 ring-warning/30 scale-105 shadow-lg shadow-warning/15'
                : 'bg-surface-elevated/80 border-slate-800'
            }`}
            onClick={() => setCurrentStepIndex(4)}
          >
            <Router className="w-7 h-7 text-warning mb-1" />
            <span className="text-xs font-bold text-white">Router R2</span>
            <span className="text-[10px] text-slate-400 font-mono">WAN: 10.0.0.2</span>
            <span className="text-[9px] text-slate-500 font-mono">LAN: 172.16.1.1</span>
          </div>

          {/* Link 3 */}
          <div className="flex-1 flex flex-col items-center px-2">
            <span className="text-[10px] text-slate-400 font-mono mb-1">LAN 2 (Ethernet)</span>
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-200 ${
                step.activeSegment === 'link3' ? 'bg-success animate-pulse' : 'bg-surface-elevated'
              }`}
            />
          </div>

          {/* Node 4: Server B */}
          <div
            className={`flex flex-col items-center p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
              step.activeSegment === 'serverB'
                ? 'bg-success/20 border-success ring-2 ring-success/30 scale-105 shadow-lg shadow-success/15'
                : 'bg-surface-elevated/80 border-slate-800'
            }`}
            onClick={() => setCurrentStepIndex(4)}
          >
            <Server className="w-7 h-7 text-success mb-1" />
            <span className="text-xs font-bold text-white">Server B</span>
            <span className="text-[10px] text-slate-400 font-mono">172.16.1.50</span>
            <span className="text-[9px] text-slate-500 font-mono">MAC: BB:BB</span>
          </div>
        </div>
      </div>

      {/* PROMINENT ACTIVE-HOP DETAIL CARD */}
      <div
        className="p-4 rounded-xl border border-brand-500/40 bg-surface-subtle/95 space-y-3.5 shadow-md shadow-brand-500/5 transition-all"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              {getNodeIcon(step.nodeType)}
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                {step.nodeName}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {step.location}
              </span>
            </div>
          </div>

          <Badge variant={step.layer2.changed ? 'amber' : 'green'} size="sm">
            {step.layer2.changed ? 'L2 Header Rewritten' : 'Initial L2 Frame'}
          </Badge>
        </div>

        {/* Narrative Description */}
        <p className="text-xs text-slate-300 leading-relaxed">
          {step.description}
        </p>

        {/* Live Packet Headers Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Layer 2 Frame Details */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-elevated/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-300">
                <Shield className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                Layer 2 Frame (Changes Hop-by-Hop)
              </span>
              {step.layer2.changed ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                  REWRITTEN
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-300">
                  ORIGIN
                </span>
              )}
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="p-2 rounded-lg bg-canvas/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Source MAC:</span>
                <span className="text-amber-300 font-bold break-all">{step.layer2.srcMac}</span>
              </div>
              <div className="p-2 rounded-lg bg-canvas/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Destination MAC:</span>
                <span className="text-amber-300 font-bold break-all">{step.layer2.dstMac}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic pt-0.5">{step.layer2.explanation}</p>
          </div>

          {/* Layer 3 Packet Details */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-surface-elevated/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-sky-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                Layer 3 Packet (End-to-End)
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-brand-950 text-brand-300 border border-brand-800/60">
                TTL: {step.layer3.ttl}
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="p-2 rounded-lg bg-canvas/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">
                  Source IP <span className="text-emerald-400 font-semibold">(Constant)</span>:
                </span>
                <span className="text-accent font-bold">{step.layer3.srcIp}</span>
              </div>
              <div className="p-2 rounded-lg bg-canvas/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">
                  Destination IP <span className="text-emerald-400 font-semibold">(Constant)</span>:
                </span>
                <span className="text-accent font-bold">{step.layer3.dstIp}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic pt-0.5">{step.layer3.explanation}</p>
          </div>
        </div>

        {/* Hop Takeaway Rule */}
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-xs text-emerald-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
          <span className="leading-relaxed font-medium">{step.takeaway}</span>
        </div>
      </div>
    </Card>
  );
};
