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

export function formatCliPrompt(baseHostname: string, mode: CliMode, subModeLabel = 'config-if'): string {
  const cleanHost = extractBaseHostname(baseHostname);
  if (mode === 'config') {
    return `${cleanHost}(config)#`;
  }
  if (mode === 'config-sub') {
    return `${cleanHost}(${subModeLabel})#`;
  }
  return `${cleanHost}#`;
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

  const baseHostname = useMemo(() => extractBaseHostname(promptHostname), [promptHostname]);

  const activePrompt = useMemo(
    () => formatCliPrompt(baseHostname, cliMode, cliSubModeLabel),
    [baseHostname, cliMode, cliSubModeLabel]
  );

  // Sync state if scenario changes externally
  useEffect(() => {
    setScenarioState(initialScenario);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setPromptHostname(initialScenario.cliConfig?.promptHostname || 'Router#');
    setCliMode('privileged');
    setCliSubModeLabel('config-if');
    setCliMutations([]);
    setIsObjectiveSolved(false);
    setCliHistory(createInitialCliHistory(initialScenario));
  }, [initialScenario.metadata.id]);

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
    setPromptHostname(newScenario.cliConfig?.promptHostname || 'Router#');
    setCliMutations([]);
    setIsObjectiveSolved(false);
    setCliHistory(createInitialCliHistory(newScenario));
  }, []);

  const resetCli = useCallback(() => {
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
          allowed.length > 0
            ? allowed
                .map(
                  (c) =>
                    `  ${c.command.padEnd(35)} - ${c.description || 'Diagnostic/Action command'}`
                )
                .join('\n')
            : '  (No bounded commands registered for this scenario)';

        const helpText = `${navGuide}\n\nScenario Commands (${scenario.cliConfig?.protocolScope || 'Protocol'}):\n${cmdList}\n\nNote: Cisco IOS commands are case-insensitive and support standard abbreviations.`;

        const outEntry: CliLogEntry = {
          id: `cli-out-${Date.now()}`,
          type: 'output',
          text: helpText,
        };

        setCliHistory((prev) => [...prev, inputEntry, outEntry]);
        return { success: true, output: helpText };
      }

      // 3. Match against scenario's allowedCommands (support direct or 'do <cmd>')
      let targetCmd = normalized;
      if ((cliMode === 'config' || cliMode === 'config-sub') && targetCmd.startsWith('do ')) {
        targetCmd = targetCmd.slice(3).trim();
      }

      const allowedCommands = scenario.cliConfig?.allowedCommands || [];
      const match = allowedCommands.find((def) => {
        const canonical = def.command.toLowerCase().trim().replace(/\s+/g, ' ');
        if (targetCmd === canonical) return true;
        if (
          def.aliases &&
          def.aliases.some((a) => a.toLowerCase().trim().replace(/\s+/g, ' ') === targetCmd)
        ) {
          return true;
        }
        return false;
      });

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

      // 4. Command not recognized
      const errorMsg = `% Invalid input detected at '^' marker: "${trimmed}"\nType '?' or 'help' to inspect valid commands for current mode (${cliMode}).`;
      const errEntry: CliLogEntry = {
        id: `cli-err-${Date.now()}`,
        type: 'error',
        text: errorMsg,
      };

      setCliHistory((prev) => [...prev, inputEntry, errEntry]);
      return { success: false, output: errorMsg };
    },
    [activePrompt, cliMode, scenario]
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
