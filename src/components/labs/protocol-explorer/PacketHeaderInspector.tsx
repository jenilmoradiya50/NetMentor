import React, { useState } from 'react';
import type {
  PacketHeader,
  InspectedLayer,
} from '../../../types/protocol-simulation';
import { Card, Badge } from '../../ui';
import { Layers, CheckCircle2, ArrowRight, Binary, Copy, Check } from 'lucide-react';
import { encodePacketToHexDump } from '../../../utils/packetHexEncoder';

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
  const [viewMode, setViewMode] = useState<'decoded' | 'hex'>('decoded');
  const [copied, setCopied] = useState<boolean>(false);

  const { L2, L3, L4, payloadDescription } = packet;

  const encoded = encodePacketToHexDump(packet);

  const handleCopyHex = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(encoded.rawHex);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = encoded.rawHex;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[PacketHeaderInspector] Clipboard copy failed:', err);
    }
  };

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
      {/* Header with Segmented Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Packet Header & Encapsulation Inspector
          </h3>
        </div>

        {/* Segmented Inspector View Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center bg-[#111317] p-1 rounded-xl border border-[#232730] gap-1">
            <button
              type="button"
              onClick={() => setViewMode('decoded')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all touch-target-44 min-h-[44px] flex items-center justify-center gap-1.5 select-none ${
                viewMode === 'decoded'
                  ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Decoded Layers</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hex')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all touch-target-44 min-h-[44px] flex items-center justify-center gap-1.5 select-none ${
                viewMode === 'hex'
                  ? 'bg-accent/20 text-accent border border-accent/40 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Hex Wire Dump</span>
            </button>
          </div>
          <Badge variant="blue" size="sm" className="hidden sm:inline-flex">
            {L4.protocolType} In-Transit
          </Badge>
        </div>
      </div>

      {viewMode === 'decoded' ? (
        <>
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
        </>
      ) : (
        /* Wire-Level Hex & ASCII Frame Dump View */
        <div className="space-y-3.5">
          {/* Layer Byte-Range Badges and 1-Tap Copy Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-surface border border-border-hairline">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">Frames:</span>
              <Badge variant="blue" size="sm" className="font-mono text-[10px]">
                {encoded.layerRanges.l2.hexBadge}
              </Badge>
              <Badge variant="amber" size="sm" className="font-mono text-[10px]">
                {encoded.layerRanges.l3.hexBadge}
              </Badge>
              <Badge variant="green" size="sm" className="font-mono text-[10px]">
                {encoded.layerRanges.l4.hexBadge}
              </Badge>
              {encoded.layerRanges.payload && (
                <Badge variant="purple" size="sm" className="font-mono text-[10px]">
                  {encoded.layerRanges.payload.hexBadge}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[11px] font-mono text-slate-400">
                {encoded.byteCount} Bytes Frame
              </span>
              <button
                type="button"
                onClick={handleCopyHex}
                className="px-3 py-1.5 rounded-lg border border-[#232730] bg-[#111317] hover:bg-surface-elevated text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all touch-target-44 min-h-[44px]"
                title="Copy raw hex bytes to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Hex</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Wireshark-Style Monospace Frame Dump */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#090A0C] border border-[#232730] overflow-x-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-[#232730] pb-2">
              <span className="hidden sm:inline">Offset  Hex Byte Values (16 Bytes / Row)                    ASCII Decoded</span>
              <span className="sm:hidden">Offset  Hex Bytes (16 B/Row)       ASCII</span>
              <span className="text-accent font-semibold">{encoded.byteCount} B</span>
            </div>
            <pre className="font-mono text-[11px] sm:text-xs text-slate-200 leading-relaxed whitespace-pre select-all overflow-x-auto">
              {encoded.hexDump}
            </pre>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">
            Canonical wire-level encapsulation with authentic L2 MAC/802.1Q headers, L3 IP/ARP datagrams, L4 transport segments, and raw payload octets.
          </p>
        </div>
      )}

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
