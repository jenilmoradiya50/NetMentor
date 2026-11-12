import React from 'react';
import type {
  TopologyNode,
  TopologyLink,
  SimulationStep,
} from '../../../types/protocol-simulation';
import { Card, Badge } from '../../ui';
import {
  Laptop,
  Server,
  Network,
  Compass,
  ArrowRight,
  Radio,
  Activity,
  Layers,
} from 'lucide-react';

interface TopologyVisualizerProps {
  topology: {
    nodes: TopologyNode[];
    links: TopologyLink[];
  };
  activeStep: SimulationStep;
  isPlaying: boolean;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const TopologyVisualizer: React.FC<TopologyVisualizerProps> = ({
  topology,
  activeStep,
  isPlaying,
  selectedNodeId,
  onSelectNode,
}) => {
  const { transmission } = activeStep;
  const fromNodeId = transmission.fromNodeId;
  const toNodeId = transmission.toNodeId;

  // Format packet summary badge
  const packet = transmission.packet;
  const flags = packet.L4.flags;
  const activeFlags: string[] = [];
  if (flags?.syn) activeFlags.push('SYN');
  if (flags?.ack) activeFlags.push('ACK');
  if (flags?.fin) activeFlags.push('FIN');
  if (flags?.psh) activeFlags.push('PSH');

  const flagSummary = activeFlags.length > 0 ? activeFlags.join('+') : packet.L4.protocolType;
  const packetPillText = `${packet.L4.protocolType} [${flagSummary}]`;

  // Helper to render appropriate hardware node icon
  const getNodeIcon = (node: TopologyNode) => {
    if (node.type === 'switch') {
      return <Network className="w-5 h-5 text-accent" />;
    }
    if (node.type === 'router') {
      return <Compass className="w-5 h-5 text-emerald-400" />;
    }
    if (node.id.toLowerCase().includes('server') || node.name.toLowerCase().includes('server')) {
      return <Server className="w-5 h-5 text-emerald-400" />;
    }
    return <Laptop className="w-5 h-5 text-amber-400" />;
  };

  // Helper for TCP socket state colors
  const getSocketStateBadge = (state?: string) => {
    if (!state) return null;
    switch (state) {
      case 'ESTABLISHED':
        return <Badge variant="green" size="sm">{state}</Badge>;
      case 'SYN_SENT':
      case 'SYN_RCVD':
        return <Badge variant="amber" size="sm">{state}</Badge>;
      case 'LISTEN':
        return <Badge variant="blue" size="sm">{state}</Badge>;
      case 'FIN_WAIT_1':
      case 'FIN_WAIT_2':
      case 'TIME_WAIT':
      case 'CLOSE_WAIT':
        return <Badge variant="purple" size="sm">{state}</Badge>;
      default:
        return <Badge variant="slate" size="sm">{state}</Badge>;
    }
  };

  return (
    <Card variant="elevated" className="p-4 sm:p-5 space-y-4">
      {/* Topology Stage Header */}
      <div className="flex items-center justify-between border-b border-border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Interactive Network Topology Stage
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 hidden xs:inline">
            Active Segment:
          </span>
          <Badge variant="amber" size="sm">
            {fromNodeId} <ArrowRight className="w-2.5 h-2.5 inline mx-0.5" /> {toNodeId}
          </Badge>
        </div>
      </div>

      {/* Main Interactive Topology Visual Canvas */}
      <div className="relative rounded-2xl bg-canvas border border-border-hairline p-4 sm:p-6 overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1f232b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Nodes Cluster: Dynamic Topology Stage (2-node Point-to-Point, 3-node, or 4-node Switched LAN) */}
        <div
          className={`relative z-10 grid gap-4 items-center ${
            topology.nodes.length <= 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : topology.nodes.length === 3
              ? 'grid-cols-1 md:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {topology.nodes.map((node) => {
            const isTransmitting = node.id === fromNodeId;
            const isReceiving = node.id === toNodeId;
            const isSelected = node.id === selectedNodeId;
            const primaryInterface = node.interfaces[0];

            let borderStyle = 'border-border-hairline bg-surface/90';
            let roleBadge = <Badge variant="slate" size="sm">Idle</Badge>;

            if (isTransmitting) {
              borderStyle =
                'border-accent bg-surface-elevated shadow-lg shadow-accent/20 ring-2 ring-accent/40';
              roleBadge = (
                <Badge variant="amber" size="sm" icon={<Radio className="w-3 h-3 animate-ping" />}>
                  TX Node
                </Badge>
              );
            } else if (isReceiving) {
              borderStyle =
                'border-status-converged bg-surface-elevated shadow-lg shadow-status-converged/20 ring-2 ring-status-converged/40';
              roleBadge = (
                <Badge variant="green" size="sm" icon={<Radio className="w-3 h-3 animate-pulse" />}>
                  RX Node
                </Badge>
              );
            } else if (node.type === 'switch') {
              borderStyle = 'border-slate-700 bg-surface/95 shadow-md';
              roleBadge = <Badge variant="blue" size="sm">L2 Transit</Badge>;
            }

            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer select-none relative ${borderStyle} ${
                  isSelected ? 'ring-2 ring-white/30' : ''
                } hover:border-slate-500`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="h-9 w-9 rounded-xl bg-canvas border border-border-hairline flex items-center justify-center shadow-inner">
                    {getNodeIcon(node)}
                  </div>
                  <div className="flex items-center gap-1.5">{roleBadge}</div>
                </div>

                {/* Node Details */}
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={node.name}>
                    {node.name}
                  </h4>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{primaryInterface?.ip || 'Unrouted L2'}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{node.type}</span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 truncate" title={primaryInterface?.mac}>
                    MAC: {primaryInterface?.mac}
                  </p>
                </div>

                {/* Dynamic Protocol State Footer */}
                {node.tableState?.tcpState ? (
                  <div className="mt-3 pt-2.5 border-t border-border-hairline flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">TCP State</span>
                    {getSocketStateBadge(node.tableState.tcpState)}
                  </div>
                ) : node.tableState?.ospfNeighbors?.[0] ? (
                  <div className="mt-3 pt-2.5 border-t border-border-hairline flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">OSPF State</span>
                    <Badge
                      variant={
                        node.tableState.ospfNeighbors[0].state.includes('FULL')
                          ? 'green'
                          : node.tableState.ospfNeighbors[0].state.includes('STALLED') ||
                            node.tableState.ospfNeighbors[0].state.includes('MISMATCH')
                          ? 'red'
                          : 'amber'
                      }
                      size="sm"
                    >
                      {node.tableState.ospfNeighbors[0].state}
                    </Badge>
                  </div>
                ) : node.type === 'switch' ? (
                  <div className="mt-3 pt-2.5 border-t border-border-hairline flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">CAM Table</span>
                    <Badge variant="blue" size="sm">
                      {node.tableState?.macTable?.length || 0} Learned
                    </Badge>
                  </div>
                ) : (
                  <div className="mt-3 pt-2.5 border-t border-border-hairline flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">ARP Entries</span>
                    <Badge variant="slate" size="sm">
                      {node.tableState?.arpCache?.length || 0} Cached
                    </Badge>
                  </div>
                )}

                {/* Click to inspect prompt */}
                <div className="mt-2 text-right">
                  <span className="text-[9px] font-mono text-accent/80 hover:text-accent underline">
                    {isSelected ? '● Inspecting Tables' : 'Inspect Node Tables'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* In-Flight Packet Transit Indicator Bar */}
        <div className="mt-6 pt-4 border-t border-border-hairline relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-elevated/70 p-3 rounded-xl border border-border-hairline">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center flex-shrink-0 text-accent">
              <Layers className="w-4 h-4 animate-bounce" />
            </div>
            <div className="truncate">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
                In-Flight Frame on Wire
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-accent truncate">
                  {packetPillText}
                </span>
                {packet.L2.vlanTag && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    802.1Q VID: {packet.L2.vlanTag.vlanId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Transit telemetry */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[11px] text-slate-400">
              Seq={packet.L4.seqNumber} | Ack={packet.L4.ackNumber}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              isPlaying
                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 animate-pulse'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
            }`}>
              {isPlaying ? 'TRAVERSING' : 'CAPTURED'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
