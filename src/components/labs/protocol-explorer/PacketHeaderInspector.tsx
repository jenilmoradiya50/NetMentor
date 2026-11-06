import React from 'react';
import type {
  PacketHeader,
  InspectedLayer,
} from '../../../types/protocol-simulation';
import { Card, Badge } from '../../ui';
import { Layers, CheckCircle2, ArrowRight } from 'lucide-react';

interface PacketHeaderInspectorProps {
  packet: PacketHeader;
  inspectedLayer: InspectedLayer;
  onSelectLayer: (layer: InspectedLayer) => void;
  stepIndex?: number;
}

export const PacketHeaderInspector: React.FC<PacketHeaderInspectorProps> = ({
  packet,
  inspectedLayer,
  onSelectLayer,
}) => {
  const { L2, L3, L4, payloadDescription } = packet;

  const layers: Array<{ id: InspectedLayer; label: string; sub: string; protocol: string }> = [
    {
      id: 'L2',
      label: 'Layer 2: Data Link',
      sub: 'Ethernet II',
      protocol: L2.vlanTag ? `VLAN ${L2.vlanTag.vlanId}` : '802.3',
    },
    {
      id: 'L3',
      label: 'Layer 3: Network',
      sub: 'IPv4',
      protocol: `TTL ${L3.ttl}`,
    },
    {
      id: 'L4',
      label: 'Layer 4: Transport',
      sub: L4.protocolType,
      protocol: `:${L4.srcPort} -> :${L4.dstPort}`,
    },
    {
      id: 'Payload',
      label: 'Layer 7: Payload',
      sub: 'Application Data',
      protocol: `${payloadDescription.length} B`,
    },
  ];

  return (
    <Card variant="elevated" className="p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Packet Header & Encapsulation Inspector
          </h3>
        </div>
        <Badge variant="blue" size="sm">
          {L4.protocolType} In-Transit
        </Badge>
      </div>

      {/* Multi-Layer Encapsulation Ladder Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {layers.map((layer) => {
          const isSelected = inspectedLayer === layer.id;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden select-none touch-target-44 ${
                isSelected
                  ? 'bg-surface-elevated border-accent shadow-md shadow-accent/10'
                  : 'bg-surface/60 border-border-hairline hover:border-slate-700 hover:bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                    isSelected ? 'text-accent' : 'text-slate-400'
                  }`}
                >
                  {layer.id}
                </span>
                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[60px]">
                  {layer.protocol}
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-1 truncate">{layer.sub}</p>
              {isSelected && (
                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Detailed Layer Fields View */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-canvas border border-border-hairline space-y-4 min-h-[190px]">
        {/* Layer 2: Data Link Fields */}
        {inspectedLayer === 'L2' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2">
              <span className="text-xs font-semibold text-slate-300">
                Ethernet II Frame Header
              </span>
              <span className="text-[11px] font-mono text-accent">14 Bytes Header</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Source MAC</span>
                <span className="text-slate-200 font-semibold">{L2.srcMac}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Destination MAC</span>
                <span className="text-slate-200 font-semibold">{L2.dstMac}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">EtherType</span>
                <span className="text-emerald-400 font-semibold">{L2.ethertype}</span>
              </div>
              {L2.vlanTag ? (
                <div className="p-2.5 rounded-lg bg-surface border border-accent/40 space-y-1">
                  <span className="text-[10px] uppercase text-accent block">802.1Q VLAN Tag</span>
                  <span className="text-accent font-semibold">
                    VID: {L2.vlanTag.vlanId} | PCP: {L2.vlanTag.pcp ?? 0}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 block">802.1Q Encapsulation</span>
                  <span className="text-slate-400">Untagged Native Frame</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Layer 3: Network Fields */}
        {inspectedLayer === 'L3' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2">
              <span className="text-xs font-semibold text-slate-300">
                IPv4 Datagram Header
              </span>
              <span className="text-[11px] font-mono text-accent">20 Bytes Header</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Source IPv4</span>
                <span className="text-amber-300 font-semibold">{L3.srcIp}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Destination IPv4</span>
                <span className="text-emerald-400 font-semibold">{L3.dstIp}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Protocol</span>
                <span className="text-slate-200 font-semibold">{L3.protocol}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Time to Live (TTL)</span>
                <span className="text-slate-200 font-semibold">{L3.ttl} Hops</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Identification</span>
                <span className="text-slate-300">0x{(L3.identification || 0).toString(16).toUpperCase()} ({L3.identification})</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">IP Flags</span>
                <span className="text-slate-300">
                  {L3.flags?.dontFragment ? 'DF (Don\'t Fragment)' : 'None'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Layer 4: Transport Fields */}
        {inspectedLayer === 'L4' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2">
              <span className="text-xs font-semibold text-slate-300">
                {L4.protocolType} Transport Segment Header
              </span>
              <span className="text-[11px] font-mono text-accent">20–32 Bytes Header</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Source Port</span>
                <span className="text-amber-300 font-bold">{L4.srcPort}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Destination Port</span>
                <span className="text-emerald-400 font-bold">{L4.dstPort}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface border border-border-hairline space-y-1">
                <span className="text-[10px] uppercase text-slate-500 block">Window Size</span>
                <span className="text-slate-200">{L4.windowSize ?? '64240'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border space-y-1 sm:col-span-1.5 ${
                L4.flags?.syn ? 'bg-accent/10 border-accent' : 'bg-surface border-border-hairline'
              }`}>
                <span className="text-[10px] uppercase text-slate-400 block">Sequence Number</span>
                <span className={`font-bold ${L4.flags?.syn ? 'text-accent' : 'text-slate-200'}`}>
                  {L4.seqNumber}
                </span>
              </div>
              <div className={`p-2.5 rounded-lg border space-y-1 sm:col-span-1.5 ${
                L4.flags?.ack ? 'bg-status-converged/10 border-status-converged' : 'bg-surface border-border-hairline'
              }`}>
                <span className="text-[10px] uppercase text-slate-400 block">Acknowledgment Number</span>
                <span className={`font-bold ${L4.flags?.ack ? 'text-status-converged' : 'text-slate-200'}`}>
                  {L4.ackNumber}
                </span>
              </div>
            </div>

            {/* TCP Control Flag Bit Matrix */}
            <div className="pt-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono block mb-2">
                TCP Control Flags (6-Bit Word)
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { name: 'SYN', active: !!L4.flags?.syn, desc: 'Synchronize Sequence' },
                  { name: 'ACK', active: !!L4.flags?.ack, desc: 'Acknowledgment Valid' },
                  { name: 'FIN', active: !!L4.flags?.fin, desc: 'Finish Connection' },
                  { name: 'PSH', active: !!L4.flags?.psh, desc: 'Push to Application' },
                  { name: 'RST', active: !!L4.flags?.rst, desc: 'Reset Socket' },
                  { name: 'URG', active: !!L4.flags?.urg, desc: 'Urgent Pointer Valid' },
                ].map((flag) => (
                  <div
                    key={flag.name}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      flag.active
                        ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm shadow-accent/20 ring-1 ring-accent/30'
                        : 'bg-surface/50 border-border-hairline text-slate-500 font-medium opacity-60'
                    }`}
                    title={flag.desc}
                  >
                    <span className="text-xs font-mono">{flag.name}</span>
                    <span className="block text-[9px] font-mono mt-0.5">
                      {flag.active ? '1' : '0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Layer 7: Payload Fields */}
        {inspectedLayer === 'Payload' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border-hairline pb-2">
              <span className="text-xs font-semibold text-slate-300">
                Application Data Payload
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid Framing
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border-hairline font-mono text-xs text-slate-200 whitespace-pre-wrap break-all leading-relaxed">
              {payloadDescription}
            </div>
            <p className="text-[11px] text-slate-500">
              Payload decoding reflects protocol data units (PDU) passed from socket buffers to the upper application layer.
            </p>
          </div>
        )}
      </div>

      {/* Summary Path Breadcrumb */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-mono px-1">
        <span className="text-amber-400 truncate max-w-[140px] sm:max-w-none">
          {L3.srcIp}:{L4.srcPort}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0 mx-2" />
        <span className="text-emerald-400 truncate max-w-[140px] sm:max-w-none">
          {L3.dstIp}:{L4.dstPort}
        </span>
      </div>
    </Card>
  );
};
