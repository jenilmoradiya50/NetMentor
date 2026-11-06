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
function computeAccumulatedTopology(
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
function applySingleMutation(node: TopologyNode, mutation: NodeStateMutation) {
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

  // Sync state if scenario changes externally
  useEffect(() => {
    setScenarioState(initialScenario);
    setCurrentStepIndex(0);
    setIsPlaying(false);
  }, [initialScenario.metadata.id]);

  const totalSteps = scenario.steps.length;
  const isAtStart = currentStepIndex === 0;
  const isAtEnd = currentStepIndex >= totalSteps - 1;
  const currentStep = scenario.steps[currentStepIndex];

  const progressPercentage = useMemo(() => {
    if (totalSteps <= 1) return 100;
    return Math.round((currentStepIndex / (totalSteps - 1)) * 100);
  }, [currentStepIndex, totalSteps]);

  // Compute accumulated topology state for the current step
  const computedTopology = useMemo(() => {
    const nodes = computeAccumulatedTopology(
      scenario.topology.nodes,
      scenario.steps,
      currentStepIndex
    );
    return {
      nodes,
      links: scenario.topology.links,
    };
  }, [scenario, currentStepIndex]);

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
  }, []);

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
