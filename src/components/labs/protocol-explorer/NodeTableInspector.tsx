import React, { useState } from 'react';
import type {
  TopologyNode,
  SocraticCheckpoint,
} from '../../../types/protocol-simulation';
import { Card, Badge } from '../../ui';
import { useAiTutor } from '../../../context/AiTutorContext';
import {
  Database,
  Bot,
  HelpCircle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';

interface NodeTableInspectorProps {
  nodes: TopologyNode[];
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  socraticCheckpoint?: SocraticCheckpoint;
  stepTitle: string;
  stepIndex: number;
}

type DeviceTableTab = 'socket' | 'arp' | 'mac' | 'routing';

export const NodeTableInspector: React.FC<NodeTableInspectorProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  socraticCheckpoint,
  stepTitle,
  stepIndex,
}) => {
  const [activeTableTab, setActiveTableTab] = useState<DeviceTableTab>('socket');
  const [showHint, setShowHint] = useState<boolean>(false);
  const { openTutor } = useAiTutor();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const tableState = selectedNode?.tableState || {};

  const handleDiscussWithTutor = () => {
    if (!socraticCheckpoint) return;
    openTutor({
      mode: 'socratic_hint',
      lessonId: 'protocol-sim',
      lessonTitle: `Protocol Explorer: ${stepTitle}`,
      sectionId: `Step ${stepIndex + 1}`,
      exerciseId: `checkpoint-${stepIndex}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Node State Inspector Card */}
      <Card variant="elevated" className="p-4 sm:p-5 space-y-4">
        {/* Node & Table Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Device Internal State Inspector
            </h3>
          </div>

          {/* Node Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {nodes.map((node) => {
              const isSelected = node.id === selectedNode.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-all touch-target-44 min-h-[36px] ${
                    isSelected
                      ? 'bg-accent text-canvas font-bold shadow-sm'
                      : 'bg-surface border border-border-hairline text-slate-400 hover:text-white'
                  }`}
                >
                  {node.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Device Table Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border-hairline pb-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'socket', label: 'Socket State', count: tableState.tcpState ? 1 : 0 },
            { id: 'arp', label: 'ARP Cache', count: tableState.arpCache?.length || 0 },
            { id: 'mac', label: 'MAC Table', count: tableState.macTable?.length || 0 },
            { id: 'routing', label: 'Routing Table', count: tableState.routingTable?.length || 0 },
          ].map((tab) => {
            const isTabActive = activeTableTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTableTab(tab.id as DeviceTableTab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all touch-target-44 min-h-[36px] flex items-center gap-1.5 whitespace-nowrap ${
                  isTabActive
                    ? 'bg-surface-elevated text-white border border-accent/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isTabActive ? 'bg-accent/20 text-accent' : 'bg-surface text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Tables */}
        <div className="p-3.5 rounded-xl bg-canvas border border-border-hairline min-h-[160px]">
          {/* Socket State */}
          {activeTableTab === 'socket' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  TCP Transmission Control Block (TCB)
                </span>
                <Badge variant={tableState.tcpState === 'ESTABLISHED' ? 'green' : 'amber'} size="sm">
                  {tableState.tcpState || 'CLOSED'}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border-hairline text-xs font-mono space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Host Identity:</span>
                  <span className="text-slate-200 font-bold">{selectedNode.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Socket Bound Address:</span>
                  <span className="text-amber-300">
                    {selectedNode.interfaces[0]?.ip || '0.0.0.0'}:
                    {selectedNode.type === 'host' && selectedNode.id.includes('server') ? '80' : '49152'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Current FSM State:</span>
                  <span className="text-emerald-400 font-bold">{tableState.tcpState || 'CLOSED'}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Socket state machine transitions dynamically as packets (SYN, SYN-ACK, ACK, FIN) are dispatched and acknowledged across the wire.
              </p>
            </div>
          )}

          {/* ARP Cache */}
          {activeTableTab === 'arp' && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                ARP Resolution Cache ({selectedNode.name})
              </span>
              {!tableState.arpCache || tableState.arpCache.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 text-center py-6">
                  No ARP mappings recorded on this node.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border-hairline text-slate-500 text-[10px] uppercase">
                        <th className="py-1.5 px-2">IPv4 Address</th>
                        <th className="py-1.5 px-2">Hardware MAC Address</th>
                        <th className="py-1.5 px-2">Interface</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline/60">
                      {tableState.arpCache.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-surface/50 text-slate-200">
                          <td className="py-2 px-2 text-amber-300">{entry.ip}</td>
                          <td className="py-2 px-2 text-slate-300">{entry.mac}</td>
                          <td className="py-2 px-2 text-slate-400">{entry.interface || 'eth0'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MAC Table (Switches) */}
          {activeTableTab === 'mac' && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                Layer 2 Forwarding / CAM Table ({selectedNode.name})
              </span>
              {!tableState.macTable || tableState.macTable.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 text-center py-6">
                  No dynamically learned MAC entries on this node.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border-hairline text-slate-500 text-[10px] uppercase">
                        <th className="py-1.5 px-2">VLAN</th>
                        <th className="py-1.5 px-2">MAC Address</th>
                        <th className="py-1.5 px-2">Port</th>
                        <th className="py-1.5 px-2">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline/60">
                      {tableState.macTable.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-surface/50 text-slate-200">
                          <td className="py-2 px-2 text-slate-400">{entry.vlan || 1}</td>
                          <td className="py-2 px-2 text-amber-300">{entry.mac}</td>
                          <td className="py-2 px-2 text-emerald-400">{entry.port}</td>
                          <td className="py-2 px-2 text-slate-400">{entry.type || 'DYNAMIC'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Routing Table */}
          {activeTableTab === 'routing' && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block mb-2">
                IPv4 Routing Information Base (RIB) ({selectedNode.name})
              </span>
              {!tableState.routingTable || tableState.routingTable.length === 0 ? (
                <p className="text-xs font-mono text-slate-500 text-center py-6">
                  Direct host route or empty routing table.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border-hairline text-slate-500 text-[10px] uppercase">
                        <th className="py-1.5 px-2">Proto</th>
                        <th className="py-1.5 px-2">Network</th>
                        <th className="py-1.5 px-2">Next-Hop</th>
                        <th className="py-1.5 px-2">Interface</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-hairline/60">
                      {tableState.routingTable.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-surface/50 text-slate-200">
                          <td className="py-2 px-2 text-accent font-bold">{entry.protocol}</td>
                          <td className="py-2 px-2 text-slate-200">{entry.network}/{entry.mask}</td>
                          <td className="py-2 px-2 text-slate-400">{entry.nextHop || 'Direct'}</td>
                          <td className="py-2 px-2 text-slate-400">{entry.interface}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Socratic Checkpoint Card */}
      {socraticCheckpoint && (
        <Card variant="interactive" className="p-4 sm:p-5 border-accent/40 bg-surface-elevated/90 space-y-3">
          <div className="flex items-center justify-between border-b border-border-hairline pb-2.5">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Socratic Checkpoint: Step {stepIndex + 1}
              </h4>
            </div>
            <Badge variant="amber" size="sm">
              Pedagogical Probing
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-relaxed">
              {socraticCheckpoint.question}
            </p>

            {/* Hint Accordion */}
            {showHint ? (
              <div className="p-3 rounded-lg bg-canvas border border-border-hairline text-xs text-amber-200/90 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{socraticCheckpoint.hint}</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-xs font-mono text-accent/90 hover:text-accent flex items-center gap-1.5 touch-target-44"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Show Pedagogical Hint</span>
              </button>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
              Aligned with CCNA 200-301 Exam Objectives
            </span>
            <button
              type="button"
              onClick={handleDiscussWithTutor}
              className="w-full sm:w-auto touch-target-44 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-vivid text-canvas font-bold text-xs shadow-md shadow-accent/20 border border-amber-400 transition-all flex items-center justify-center gap-1.5 press-scale"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discuss with AI Tutor</span>
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};
