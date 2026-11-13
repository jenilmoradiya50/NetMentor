import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ProtocolSimulationScenario,
  SimulationStep,
  TopologyNode,
  TopologyLink,
  NodeStateMutation,
  InspectedLayer,
  InspectorTab,
} from '../types/protocol-simulation';

const BASE_INTERVAL_MS = 2500;

export interface CliLogEntry {
  id: string;
  type: 'input' | 'output' | 'system' | 'error';
  text: string;
}

export type CliMode = 'privileged' | 'config' | 'config-sub';

export function extractBaseHostname(rawPrompt: string): string {
  return rawPrompt.trim().replace(/[#>]+$/, '').trim() || 'Router';
}

export function formatCliPrompt(
  baseHostname: string,
  mode: CliMode,
  subModeLabel = 'config-if',
  isHost = false
): string {
  const hasPromptGreater = baseHostname.trim().endsWith('>');
  const cleanHost = extractBaseHostname(baseHostname);
  if (mode === 'config') {
    return `${cleanHost}(config)#`;
  }
  if (mode === 'config-sub') {
    return `${cleanHost}(${subModeLabel})#`;
  }
  const promptChar = (isHost || hasPromptGreater) ? '>' : '#';
  return `${cleanHost}${promptChar}`;
}

export interface CliTransitionResult {
  nextMode: CliMode;
  nextSubModeLabel: string;
  output: string;
  isNavigation: boolean;
}

export function evaluateCliNavigation(
  rawInput: string,
  currentMode: CliMode,
  currentSubModeLabel = 'config-if'
): CliTransitionResult | null {
  const normalized = rawInput.trim().toLowerCase().replace(/\s+/g, ' ');

  // 1.1 Global Configuration mode
  if (
    normalized === 'configure terminal' ||
    normalized === 'conf t' ||
    normalized === 'config t' ||
    normalized === 'configure'
  ) {
    if (currentMode === 'config' || currentMode === 'config-sub') {
      return {
        nextMode: currentMode,
        nextSubModeLabel: currentSubModeLabel,
        output: '% Already in configuration mode.',
        isNavigation: true,
      };
    }
    return {
      nextMode: 'config',
      nextSubModeLabel: currentSubModeLabel,
      output: 'Enter configuration commands, one per line.  End with CNTL/Z.',
      isNavigation: true,
    };
  }

  // 1.2 Interface Configuration Sub-mode
  const ifMatch = normalized.match(/^(?:interface|int)\s+([a-zA-Z0-9/._-]+)$/);
  if (ifMatch) {
    return {
      nextMode: 'config-sub',
      nextSubModeLabel: 'config-if',
      output: '',
      isNavigation: true,
    };
  }

  // 1.3 Routing Protocol Configuration Sub-mode
  const routerMatch = normalized.match(/^router\s+([a-zA-Z0-9_-]+)(?:\s+([a-zA-Z0-9._-]+))?$/);
  if (routerMatch) {
    return {
      nextMode: 'config-sub',
      nextSubModeLabel: 'config-router',
      output: '',
      isNavigation: true,
    };
  }

  // 1.4 Exit
  if (normalized === 'exit' || normalized === 'quit') {
    if (currentMode === 'config-sub') {
      return {
        nextMode: 'config',
        nextSubModeLabel: currentSubModeLabel,
        output: '',
        isNavigation: true,
      };
    }
    if (currentMode === 'config') {
      return {
        nextMode: 'privileged',
        nextSubModeLabel: currentSubModeLabel,
        output: '% SYS-5-CONFIG_I: Configured from console by console',
        isNavigation: true,
      };
    }
    return {
      nextMode: 'privileged',
      nextSubModeLabel: currentSubModeLabel,
      output: '% Cannot exit top-level privileged EXEC mode. Session remains active.',
      isNavigation: true,
    };
  }

  // 1.5 End / Disable
  if (normalized === 'end' || normalized === 'disable') {
    if (currentMode !== 'privileged') {
      return {
        nextMode: 'privileged',
        nextSubModeLabel: currentSubModeLabel,
        output: '% SYS-5-CONFIG_I: Configured from console by console',
        isNavigation: true,
      };
    }
    return {
      nextMode: 'privileged',
      nextSubModeLabel: currentSubModeLabel,
      output: '',
      isNavigation: true,
    };
  }

  return null;
}

/**
 * Synthesizes dynamic, realistic tabular Cisco IOS output for standard verification
 * commands directly from a topology node's live state machine.
 */
export function synthesizeLiveShowCommand(command: string, node: TopologyNode): string | null {
  const normalized = command.trim().toLowerCase().replace(/\s+/g, ' ');

  // 1. show ip interface brief
  if (/^(?:show|sh)\s+ip\s+int(?:erface)?\s+br(?:ief)?$/.test(normalized)) {
    const lines = [
      'Interface                  IP-Address      OK? Method Status                Protocol',
    ];
    if (!node.interfaces || node.interfaces.length === 0) {
      lines.push('(No physical or virtual interfaces configured on this device)');
    } else {
      for (const iface of node.interfaces) {
        const namePad = iface.name.padEnd(26);
        const ipPad = (iface.ip || 'unassigned').padEnd(15);
        lines.push(`${namePad} ${ipPad} YES manual up                    up      `);
      }
    }
    return lines.join('\n');
  }

  // 2. show ip route
  if (/^(?:show|sh)\s+ip\s+ro(?:ute)?$/.test(normalized)) {
    const lines = [
      'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
      '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area ',
      '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
      '       E1 - OSPF external type 1, E2 - OSPF external type 2',
      '',
      'Gateway of last resort is not set',
      '',
    ];

    const routes = node.tableState?.routingTable || [];
    if (routes.length > 0) {
      for (const r of routes) {
        const maskStr = r.mask?.startsWith('/')
          ? r.mask
          : (r.mask === '255.255.255.0' ? '/24' : r.mask ? `/${r.mask}` : '/24');
        const netStr = `${r.network}${maskStr}`;
        if (r.protocol === 'C') {
          lines.push(`C        ${netStr} is directly connected, ${r.interface}`);
        } else {
          const ad = r.adminDistance ?? (r.protocol === 'B' ? 20 : r.protocol === 'O' ? 110 : 1);
          const met = r.metric ?? (r.protocol === 'B' ? 0 : 10);
          lines.push(`${r.protocol.padEnd(8)} ${netStr} [${ad}/${met}] via ${r.nextHop || '0.0.0.0'}, ${r.interface}`);
        }
      }
    } else {
      // Synthesize directly connected routes from interfaces with IP addresses
      const ipIfaces = (node.interfaces || []).filter((i) => Boolean(i.ip));
      if (ipIfaces.length > 0) {
        for (const iface of ipIfaces) {
          const ip = iface.ip!;
          const parts = ip.split('.');
          const network = parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : `${ip}/24`;
          lines.push(`C        ${network} is directly connected, ${iface.name}`);
          lines.push(`L        ${ip}/32 is directly connected, ${iface.name}`);
        }
      } else {
        lines.push('No active routes installed in RIB.');
      }
    }
    return lines.join('\n');
  }

  // 3. show arp / show ip arp / arp -a
  if (/^(?:(?:show|sh)\s+(?:ip\s+)?arp|arp\s+-a)$/.test(normalized)) {
    const lines = [
      'Protocol  Address          Age (min)  Hardware Addr   Type   Interface',
    ];
    const arps = node.tableState?.arpCache || [];
    if (arps.length > 0) {
      for (const a of arps) {
        const protoPad = 'Internet'.padEnd(10);
        const addrPad = a.ip.padEnd(17);
        const macPad = a.mac.padEnd(16);
        const iface = a.interface || node.interfaces?.[0]?.name || 'Vlan1';
        lines.push(`${protoPad}${addrPad}-   ${macPad}ARPA   ${iface}`);
      }
    } else {
      lines.push('(ARP cache is empty)');
    }
    return lines.join('\n');
  }

  // 4. show mac address-table
  if (/^(?:show|sh)\s+mac(?:-|\s+)address(?:-table)?$/.test(normalized)) {
    const lines = [
      '          Mac Address Table',
      '-------------------------------------------',
      'Vlan    Mac Address       Type        Ports',
      '----    -----------       --------    -----',
    ];
    const macs = node.tableState?.macTable || [];
    if (macs.length > 0) {
      for (const m of macs) {
        const vlanPad = String(m.vlan || 1).padEnd(8);
        const macPad = m.mac.padEnd(18);
        const typePad = (m.type || 'DYNAMIC').padEnd(12);
        lines.push(`${vlanPad}${macPad}${typePad}${m.port}`);
      }
      lines.push(`Total Mac Addresses for this criterion: ${macs.length}`);
    } else {
      lines.push('Total Mac Addresses for this criterion: 0');
    }
    return lines.join('\n');
  }

  // 5. show ip ospf neighbor
  if (/^(?:show|sh)\s+ip\s+ospf\s+nei(?:ghbor)?$/.test(normalized)) {
    const lines = [
      'Neighbor ID     Pri   State           Dead Time   Address         Interface',
    ];
    const neighbors = node.tableState?.ospfNeighbors || [];
    if (neighbors.length > 0) {
      for (const n of neighbors) {
        const idPad = n.neighborId.padEnd(16);
        const priPad = String(n.priority ?? 1).padEnd(6);
        const statePad = n.state.padEnd(16);
        const addrPad = (n.address || n.neighborId).padEnd(16);
        lines.push(`${idPad}${priPad}${statePad}00:00:36    ${addrPad}${n.interface}`);
      }
    } else {
      lines.push('(No active OSPF neighbors discovered)');
    }
    return lines.join('\n');
  }

  // 6. show running-config / sh run
  if (/^(?:show|sh)\s+run(?:ning-config)?$/.test(normalized)) {
    const lines = [
      'Building configuration...',
      '',
      'Current configuration : 1152 bytes',
      '!',
      'version 15.4',
      'service timestamps debug datetime msec',
      'service timestamps log datetime msec',
      'no service password-encryption',
      '!',
      `hostname ${node.name}`,
      '!',
    ];
    for (const iface of node.interfaces || []) {
      lines.push(`interface ${iface.name}`);
      if (iface.ip) {
        lines.push(` ip address ${iface.ip} 255.255.255.0`);
      } else {
        lines.push(' no ip address');
      }
      lines.push(' no shutdown');
      lines.push('!');
    }
    lines.push('end');
    return lines.join('\n');
  }

  // 7. show version / sh ver
  if (/^(?:show|sh)\s+ver(?:sion)?$/.test(normalized)) {
    return [
      'Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.4(3)M2, RELEASE SOFTWARE (fc1)',
      'Technical Support: http://www.cisco.com/techsupport',
      'Copyright (c) 1986-2024 by Cisco Systems, Inc.',
      '',
      `ROM: System Bootstrap, Version 15.4(3)M2`,
      `${node.name} uptime is 4 hours, 28 minutes`,
      'System returned to ROM by reload',
      'System image file is "flash0:c2900-universalk9-mz.SPA.154-3.M2.bin"',
      '',
      'Cisco CISCO2911/K9 (revision 1.0) with 507904K/16384K bytes of memory.',
      `${node.interfaces?.length || 2} Gigabit Ethernet interfaces`,
      'DRAM configuration is 64 bits wide with parity disabled.',
      '255K bytes of non-volatile configuration memory.',
      '250880K bytes of ATA System CompactFlash 0 (Read/Write)',
      '',
      'Configuration register is 0x2102',
    ].join('\n');
  }

  return null;
}

export interface UseProtocolSimulationResult {
  // Core state
  scenario: ProtocolSimulationScenario;
  currentStepIndex: number;
  currentStep: SimulationStep | undefined;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  inspectedLayer: InspectedLayer;
  activeInspectorTab: InspectorTab;
  computedTopology: {
    nodes: TopologyNode[];
    links: TopologyLink[];
  };

  // Status flags
  isAtStart: boolean;
  isAtEnd: boolean;
  progressPercentage: number;

  // In-App Bounded CLI State & Actions
  cliHistory: CliLogEntry[];
  promptHostname: string;
  activePrompt: string;
  cliMode: CliMode;
  cliSubModeLabel: string;
  isObjectiveSolved: boolean;
  cliMutations: NodeStateMutation[];
  executeCliCommand: (rawInput: string) => { success: boolean; output: string; goalAchieved?: boolean };
  resetCli: () => void;

  // Interactive Multi-Node CLI Sessions (Phase K)
  activeCliNodeId: string;
  setActiveCliNodeId: (nodeId: string) => void;
  activeCliNode: TopologyNode;
  isTargetNode: boolean;


  // Actions
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStep: (index: number) => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setInspectedLayer: (layer: InspectedLayer) => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
  setScenario: (newScenario: ProtocolSimulationScenario) => void;
}

/**
 * Deep clones an array of topology nodes and applies table mutations up to the given step index.
 */
export function computeAccumulatedTopology(
  baseNodes: TopologyNode[],
  steps: SimulationStep[],
  targetStepIndex: number
): TopologyNode[] {
  // Deep clone base nodes
  const nodesCopy: TopologyNode[] = baseNodes.map((n) => ({
    ...n,
    interfaces: n.interfaces.map((i) => ({ ...i })),
    tableState: {
      arpCache: n.tableState.arpCache ? [...n.tableState.arpCache] : [],
      macTable: n.tableState.macTable ? [...n.tableState.macTable] : [],
      routingTable: n.tableState.routingTable ? [...n.tableState.routingTable] : [],
      ospfNeighbors: n.tableState.ospfNeighbors ? [...n.tableState.ospfNeighbors] : [],
      tcpState: n.tableState.tcpState,
      ...n.tableState,
    },
    position: n.position ? { ...n.position } : undefined,
  }));

  const nodeMap = new Map<string, TopologyNode>();
  for (const node of nodesCopy) {
    nodeMap.set(node.id, node);
  }

  // Iterate chronologically through all steps up to targetStepIndex
  const safeEndIndex = Math.min(targetStepIndex, steps.length - 1);
  for (let idx = 0; idx <= safeEndIndex; idx++) {
    const step = steps[idx];
    if (!step?.nodeStateMutations) continue;

    for (const mutation of step.nodeStateMutations) {
      const node = nodeMap.get(mutation.nodeId);
      if (!node) continue;

      applySingleMutation(node, mutation);
    }
  }

  return nodesCopy;
}

/**
 * Applies a single node mutation (ARP, MAC, Routing, OSPF, TCP socket state).
 */
export function applySingleMutation(node: TopologyNode, mutation: NodeStateMutation) {
  const { table, action, data } = mutation;

  switch (table) {
    case 'arp': {
      if (!node.tableState.arpCache) node.tableState.arpCache = [];
      const ip = data.ip;
      if (!ip) break;

      if (action === 'delete') {
        node.tableState.arpCache = node.tableState.arpCache.filter((e) => e.ip !== ip);
      } else {
        // add or update: remove existing and append
        const filtered = node.tableState.arpCache.filter((e) => e.ip !== ip);
        filtered.push({
          ip,
          mac: data.mac || '00:00:00:00:00:00',
          interface: data.interface,
        });
        node.tableState.arpCache = filtered;
      }
      break;
    }

    case 'mac': {
      if (!node.tableState.macTable) node.tableState.macTable = [];
      const mac = data.mac;
      if (!mac) break;

      if (action === 'delete') {
        node.tableState.macTable = node.tableState.macTable.filter((e) => e.mac !== mac);
      } else {
        const filtered = node.tableState.macTable.filter((e) => e.mac !== mac);
        filtered.push({
          mac,
          port: data.port || 'Fa0/1',
          vlan: data.vlan,
          type: data.type || 'DYNAMIC',
        });
        node.tableState.macTable = filtered;
      }
      break;
    }

    case 'routing': {
      if (!node.tableState.routingTable) node.tableState.routingTable = [];
      const network = data.network;
      const mask = data.mask;
      if (!network || !mask) break;

      if (action === 'delete') {
        node.tableState.routingTable = node.tableState.routingTable.filter(
          (r) => !(r.network === network && r.mask === mask)
        );
      } else {
        const filtered = node.tableState.routingTable.filter(
          (r) => !(r.network === network && r.mask === mask)
        );
        filtered.push({
          network,
          mask,
          nextHop: data.nextHop,
          interface: data.interface || 'Gi0/0',
          protocol: data.protocol || 'C',
          metric: data.metric,
          adminDistance: data.adminDistance,
        });
        node.tableState.routingTable = filtered;
      }
      break;
    }

    case 'ospf': {
      if (!node.tableState.ospfNeighbors) node.tableState.ospfNeighbors = [];
      const neighborId = data.neighborId;
      if (!neighborId) break;

      if (action === 'delete') {
        node.tableState.ospfNeighbors = node.tableState.ospfNeighbors.filter(
          (o) => o.neighborId !== neighborId
        );
      } else {
        const filtered = node.tableState.ospfNeighbors.filter(
          (o) => o.neighborId !== neighborId
        );
        filtered.push({
          neighborId,
          priority: data.priority ?? 1,
          state: data.state || 'FULL',
          address: data.address || '',
          interface: data.interface || '',
        });
        node.tableState.ospfNeighbors = filtered;
      }
      break;
    }

    case 'tcp': {
      if (action === 'delete') {
        node.tableState.tcpState = 'CLOSED';
      } else {
        node.tableState.tcpState = data.state || data.tcpState || String(data);
      }
      break;
    }

    default:
      break;
  }
}

function createInitialCliHistory(scenario: ProtocolSimulationScenario): CliLogEntry[] {
  if (!scenario.cliConfig) {
    return [
      {
        id: 'init-0',
        type: 'system',
        text: `NetMentor Interactive Console [Session: ${scenario.metadata.protocol}]\nType '?' or 'help' for available diagnostic commands.`,
      },
    ];
  }

  const { promptHostname, protocolScope, objective, initialConfigLines } = scenario.cliConfig;
  const lines: CliLogEntry[] = [
    {
      id: 'init-0',
      type: 'system',
      text: `NetMentor Industrial Telecom Console - Protocol Lab Shell\nActive Node: ${scenario.cliConfig.targetNodeId} | Protocol: ${protocolScope}\nObjective: ${objective}`,
    },
  ];

  if (initialConfigLines && initialConfigLines.length > 0) {
    lines.push({
      id: 'init-1',
      type: 'output',
      text: `--- Current Running Configuration (${promptHostname.replace(/[#>]*/g, '')}) ---\n${initialConfigLines.join('\n')}`,
    });
  }

  lines.push({
    id: 'init-2',
    type: 'system',
    text: `Type '?' or 'help' to view permitted commands for this scenario.`,
  });

  return lines;
}

/**
 * Primary step playback controller hook for the NetMentor Protocol Explorer Engine.
 */
export function useProtocolSimulation(
  initialScenario: ProtocolSimulationScenario
): UseProtocolSimulationResult {
  const [scenario, setScenarioState] = useState<ProtocolSimulationScenario>(initialScenario);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [inspectedLayer, setInspectedLayer] = useState<InspectedLayer>('L4');
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('headers');

  // In-App Bounded CLI State & Authentic Cisco IOS Modes
  const defaultTargetNodeId =
    initialScenario.cliConfig?.targetNodeId ||
    initialScenario.topology.nodes[0]?.id ||
    'router-1';
  const [activeCliNodeId, setActiveCliNodeIdState] = useState<string>(defaultTargetNodeId);
  const [promptHostname, setPromptHostname] = useState<string>(
    initialScenario.cliConfig?.promptHostname || 'Router#'
  );
  const [cliMode, setCliMode] = useState<CliMode>('privileged');
  const [cliSubModeLabel, setCliSubModeLabel] = useState<string>('config-if');
  const [cliMutations, setCliMutations] = useState<NodeStateMutation[]>([]);
  const [isObjectiveSolved, setIsObjectiveSolved] = useState<boolean>(false);
  const [cliHistory, setCliHistory] = useState<CliLogEntry[]>(() =>
    createInitialCliHistory(initialScenario)
  );

  const totalSteps = scenario.steps.length;
  const isAtStart = currentStepIndex === 0;
  const isAtEnd = currentStepIndex >= totalSteps - 1;
  const currentStep = scenario.steps[currentStepIndex];

  const progressPercentage = useMemo(() => {
    if (totalSteps <= 1) return 100;
    return Math.round((currentStepIndex / (totalSteps - 1)) * 100);
  }, [currentStepIndex, totalSteps]);

  // Compute accumulated topology state for the current step + any interactive CLI mutations
  const computedTopology = useMemo(() => {
    const nodes = computeAccumulatedTopology(
      scenario.topology.nodes,
      scenario.steps,
      currentStepIndex
    );

    // Apply any interactive mutations executed via the CLI
    if (cliMutations.length > 0) {
      const nodeMap = new Map<string, TopologyNode>();
      for (const node of nodes) {
        nodeMap.set(node.id, node);
      }
      for (const mut of cliMutations) {
        const targetNode = nodeMap.get(mut.nodeId);
        if (targetNode) {
          applySingleMutation(targetNode, mut);
        }
      }
    }

    return {
      nodes,
      links: scenario.topology.links,
    };
  }, [scenario, currentStepIndex, cliMutations]);

  // Dynamic Active CLI Node derivation
  const activeCliNode = useMemo(() => {
    return (
      computedTopology.nodes.find((n) => n.id === activeCliNodeId) ||
      computedTopology.nodes[0] || {
        id: activeCliNodeId,
        name: 'Router',
        type: 'router' as const,
        interfaces: [],
        tableState: {},
      }
    );
  }, [computedTopology.nodes, activeCliNodeId]);

  const isTargetNode = Boolean(
    scenario.cliConfig?.targetNodeId
      ? activeCliNodeId === scenario.cliConfig.targetNodeId
      : true
  );

  const baseHostname = useMemo(() => {
    if (isTargetNode && scenario.cliConfig?.promptHostname) {
      return extractBaseHostname(scenario.cliConfig.promptHostname);
    }
    return extractBaseHostname(activeCliNode.name);
  }, [isTargetNode, scenario.cliConfig?.promptHostname, activeCliNode.name]);

  const isHost = activeCliNode.type === 'host';

  const activePrompt = useMemo(
    () => formatCliPrompt(baseHostname, cliMode, cliSubModeLabel, isHost),
    [baseHostname, cliMode, cliSubModeLabel, isHost]
  );

  // Switch active CLI session to a different node
  const setActiveCliNodeId = useCallback(
    (nodeId: string) => {
      if (nodeId === activeCliNodeId) return;
      setActiveCliNodeIdState(nodeId);
      setCliMode('privileged');
      setCliSubModeLabel('config-if');
      const targetNode = computedTopology.nodes.find((n) => n.id === nodeId);
      const isTarget = nodeId === scenario.cliConfig?.targetNodeId;
      const nodeName = targetNode?.name || nodeId;
      const badge = isTarget ? 'Break-Fix Target Node' : 'Inspection Node';
      setCliHistory((prev) => [
        ...prev,
        {
          id: `cli-switch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'system',
          text: `Switched console session to ${nodeName} (${nodeId}) [${badge}]`,
        },
      ]);
    },
    [activeCliNodeId, computedTopology.nodes, scenario.cliConfig?.targetNodeId]
  );

  // Sync state if scenario changes externally
  useEffect(() => {
    setScenarioState(initialScenario);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    const initialTargetId =
      initialScenario.cliConfig?.targetNodeId ||
      initialScenario.topology.nodes[0]?.id ||
      'router-1';
    setActiveCliNodeIdState(initialTargetId);
    setPromptHostname(initialScenario.cliConfig?.promptHostname || 'Router#');
    setCliMode('privileged');
    setCliSubModeLabel('config-if');
    setCliMutations([]);
    setIsObjectiveSolved(false);
    setCliHistory(createInitialCliHistory(initialScenario));
  }, [initialScenario.metadata.id]);

  // Automated playback timer
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(400, Math.round(BASE_INTERVAL_MS / playbackSpeed));
    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalSteps]);

  // Controller Actions
  const play = useCallback(() => {
    setCurrentStepIndex((prev) => (prev >= totalSteps - 1 ? 0 : prev));
    setIsPlaying(true);
  }, [totalSteps]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.min(totalSteps - 1, prev + 1));
  }, [totalSteps]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const jumpToStep = useCallback(
    (index: number) => {
      setIsPlaying(false);
      const clamped = Math.max(0, Math.min(totalSteps - 1, index));
      setCurrentStepIndex(clamped);
    },
    [totalSteps]
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentStepIndex(0);
  }, []);

  const setSpeed = useCallback((speed: number) => {
    const clamped = Math.max(0.25, Math.min(4, speed));
    setPlaybackSpeed(clamped);
  }, []);

  const setScenario = useCallback((newScenario: ProtocolSimulationScenario) => {
    setScenarioState(newScenario);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    const newTargetId =
      newScenario.cliConfig?.targetNodeId ||
      newScenario.topology.nodes[0]?.id ||
      'router-1';
    setActiveCliNodeIdState(newTargetId);
    setPromptHostname(newScenario.cliConfig?.promptHostname || 'Router#');
    setCliMode('privileged');
    setCliSubModeLabel('config-if');
    setCliMutations([]);
    setIsObjectiveSolved(false);
    setCliHistory(createInitialCliHistory(newScenario));
  }, []);

  const resetCli = useCallback(() => {
    const defaultNodeId =
      scenario.cliConfig?.targetNodeId ||
      scenario.topology.nodes[0]?.id ||
      'router-1';
    setActiveCliNodeIdState(defaultNodeId);
    setPromptHostname(scenario.cliConfig?.promptHostname || 'Router#');
    setCliMode('privileged');
    setCliSubModeLabel('config-if');
    setCliMutations([]);
    setIsObjectiveSolved(false);
    setCliHistory(createInitialCliHistory(scenario));
  }, [scenario]);

  const executeCliCommand = useCallback(
    (rawInput: string): { success: boolean; output: string; goalAchieved?: boolean } => {
      const trimmed = rawInput.trim();
      if (!trimmed) {
        return { success: true, output: '' };
      }

      const inputEntry: CliLogEntry = {
        id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'input',
        text: `${activePrompt} ${trimmed}`,
      };

      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');

      // 1. Navigation Commands (Cisco IOS Prompt Hierarchy)
      const navResult = evaluateCliNavigation(trimmed, cliMode, cliSubModeLabel);
      if (navResult) {
        setCliMode(navResult.nextMode);
        setCliSubModeLabel(navResult.nextSubModeLabel);
        const outEntries: CliLogEntry[] = [inputEntry];
        if (navResult.output) {
          outEntries.push({
            id: `cli-out-${Date.now()}`,
            type: 'output',
            text: navResult.output,
          });
        }
        setCliHistory((prev) => [...prev, ...outEntries]);
        return { success: true, output: navResult.output };
      }

      // 2. Help / ?
      if (normalized === '?' || normalized === 'help') {
        let navGuide = '';
        if (cliMode === 'privileged') {
          navGuide = `Privileged EXEC Commands:\n  configure terminal (conf t)        - Enter global configuration mode`;
        } else if (cliMode === 'config') {
          navGuide = `Global Configuration Commands:\n  interface <name> (int <name>)      - Enter interface configuration sub-mode\n  router <ospf|bgp> <id>             - Enter router configuration sub-mode\n  exit                               - Return to privileged EXEC mode\n  end                                - Exit configuration mode to EXEC`;
        } else {
          navGuide = `Sub-Mode Configuration Commands:\n  exit                               - Return to global configuration mode\n  end                                - Return to privileged EXEC mode`;
        }

        const allowed = scenario.cliConfig?.allowedCommands || [];
        const cmdList =
          isTargetNode && allowed.length > 0
            ? allowed
                .map(
                  (c) =>
                    `  ${c.command.padEnd(35)} - ${c.description || 'Diagnostic/Action command'}`
                )
                .join('\n')
            : '  show ip interface brief             - Display IP interface status and IP addresses\n  show ip route                       - Display current IP routing table\n  show arp                            - Display ARP cache entries\n  show mac address-table              - Display MAC address forwarding table\n  show ip ospf neighbor               - Display OSPF neighbor adjacencies';

        const nodeScope = isTargetNode
          ? `Scenario Commands (${scenario.cliConfig?.protocolScope || 'Protocol'} - Break-Fix Target)`
          : `Live Node Inspection (${activeCliNode.name})`;

        const helpText = `${navGuide}\n\n${nodeScope}:\n${cmdList}\n\nNote: Cisco IOS commands are case-insensitive and support standard abbreviations.`;

        const outEntry: CliLogEntry = {
          id: `cli-out-${Date.now()}`,
          type: 'output',
          text: helpText,
        };

        setCliHistory((prev) => [...prev, inputEntry, outEntry]);
        return { success: true, output: helpText };
      }

      // 3. Match against scenario's allowedCommands (only on target node)
      let targetCmd = normalized;
      if ((cliMode === 'config' || cliMode === 'config-sub') && targetCmd.startsWith('do ')) {
        targetCmd = targetCmd.slice(3).trim();
      }

      const allowedCommands = scenario.cliConfig?.allowedCommands || [];
      const match = isTargetNode
        ? allowedCommands.find((def) => {
            const canonical = def.command.toLowerCase().trim().replace(/\s+/g, ' ');
            if (targetCmd === canonical) return true;
            if (
              def.aliases &&
              def.aliases.some((a) => a.toLowerCase().trim().replace(/\s+/g, ' ') === targetCmd)
            ) {
              return true;
            }
            return false;
          })
        : undefined;

      if (match) {
        const outEntry: CliLogEntry = {
          id: `cli-out-${Date.now()}`,
          type: 'output',
          text: match.output,
        };

        const newEntries = [inputEntry, outEntry];

        if (match.tableMutations && match.tableMutations.length > 0) {
          setCliMutations((prev) => [...prev, ...(match.tableMutations || [])]);
        }

        if (match.goalAchieved) {
          setIsObjectiveSolved(true);
          newEntries.push({
            id: `cli-sys-${Date.now()}`,
            type: 'system',
            text: `[OBJECTIVE VERIFIED] ${scenario.cliConfig?.objective || 'Scenario goal successfully accomplished!'}`,
          });
        }

        if (match.nextPromptHostname) {
          setPromptHostname(match.nextPromptHostname);
        }

        setCliHistory((prev) => [...prev, ...newEntries]);
        return { success: true, output: match.output, goalAchieved: match.goalAchieved };
      }

      // 4. Dynamic Live-State Show Command Synthesis on active node
      const liveShowOutput = synthesizeLiveShowCommand(targetCmd, activeCliNode);
      if (liveShowOutput !== null) {
        const outEntry: CliLogEntry = {
          id: `cli-out-${Date.now()}`,
          type: 'output',
          text: liveShowOutput,
        };
        setCliHistory((prev) => [...prev, inputEntry, outEntry]);
        return { success: true, output: liveShowOutput };
      }

      // 5. Command not recognized
      const errorMsg = `% Invalid input detected at '^' marker: "${trimmed}"\nType '?' or 'help' to inspect valid commands for current mode (${cliMode}) on ${activeCliNode.name}.`;
      const errEntry: CliLogEntry = {
        id: `cli-err-${Date.now()}`,
        type: 'error',
        text: errorMsg,
      };

      setCliHistory((prev) => [...prev, inputEntry, errEntry]);
      return { success: false, output: errorMsg };
    },
    [activePrompt, cliMode, cliSubModeLabel, activeCliNode, isTargetNode, scenario]
  );

  return {
    scenario,
    currentStepIndex,
    currentStep,
    totalSteps,
    isPlaying,
    playbackSpeed,
    inspectedLayer,
    activeInspectorTab,
    computedTopology,
    isAtStart,
    isAtEnd,
    progressPercentage,
    cliHistory,
    promptHostname,
    activePrompt,
    cliMode,
    cliSubModeLabel,
    isObjectiveSolved,
    cliMutations,
    activeCliNodeId,
    setActiveCliNodeId,
    activeCliNode,
    isTargetNode,
    executeCliCommand,
    resetCli,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    jumpToStep,
    reset,
    setSpeed,
    setInspectedLayer,
    setActiveInspectorTab,
    setScenario,
  };
}
