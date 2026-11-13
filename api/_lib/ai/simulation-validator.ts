/**
 * NetMentor AI Scenario Generator - Pure TypeScript Simulation Scenario Validator
 *
 * Validates, normalizes, and sanitizes structured AI-generated Protocol Simulation Scenarios.
 * Guarantees schema compliance for Topology, Transmission Steps, L2/L3/L4 Headers,
 * and Bounded CLI break-fix configurations before client consumption. Zero external npm dependencies.
 */

import type {
  ProtocolSimulationScenario,
  SimulationMetadata,
  TopologyNode,
  TopologyLink,
  SimulationStep,
  ScenarioCliConfig,
  CertificationLevel,
  ProtocolFamily,
  DifficultyLevel,
  NodeType,
} from '../../../src/types/protocol-simulation.js';
import { extractJsonFromText } from './lesson-validator.js';

export interface SimulationValidationResult {
  valid: boolean;
  scenario?: ProtocolSimulationScenario;
  errors?: string[];
}

/**
 * Normalizes protocol family strings to valid union type.
 */
export function normalizeProtocolFamily(raw: unknown): ProtocolFamily {
  if (typeof raw !== 'string') return 'OSPF';
  const clean = raw.trim().toUpperCase();
  if (clean.includes('TCP')) return 'TCP';
  if (clean.includes('ARP')) return 'ARP';
  if (clean.includes('BGP')) return 'BGP';
  if (clean.includes('VLAN') || clean.includes('DOT1Q') || clean.includes('TRUNK')) return 'VLAN';
  return 'OSPF';
}

/**
 * Normalizes certification levels.
 */
export function normalizeCertificationLevel(raw: unknown): CertificationLevel {
  if (typeof raw !== 'string') return 'CCNA';
  const clean = raw.trim().toUpperCase();
  if (clean.includes('CCNP') || clean.includes('ENCOR') || clean.includes('ADVANCED')) return 'CCNP';
  if (clean.includes('FUNDAMENTAL') || clean.includes('INTRO')) return 'Fundamentals';
  return 'CCNA';
}

/**
 * Normalizes difficulty levels.
 */
export function normalizeDifficultyLevel(raw: unknown): DifficultyLevel {
  if (typeof raw !== 'string') return 'Intermediate';
  const clean = raw.trim().toLowerCase();
  if (clean.includes('begin') || clean.includes('easy')) return 'Beginner';
  if (clean.includes('adv') || clean.includes('hard')) return 'Advanced';
  return 'Intermediate';
}

/**
 * Validates raw JSON output from an AI provider into a structured ProtocolSimulationScenario.
 */
export function validateGeneratedSimulation(rawText: string | any): SimulationValidationResult {
  const errors: string[] = [];

  if (!rawText) {
    return { valid: false, errors: ['Raw AI response is empty'] };
  }

  // 1. Extract and parse JSON
  let parsed: any;
  if (typeof rawText === 'string') {
    if (!rawText.trim()) {
      return { valid: false, errors: ['Raw AI response is empty'] };
    }
    const extract = extractJsonFromText(rawText);
    if (!extract.success) {
      return {
        valid: false,
        errors: [extract.error || 'No JSON object or markdown code block found in AI response.'],
      };
    }
    parsed = extract.data;
  } else if (typeof rawText === 'object') {
    parsed = rawText;
  } else {
    return { valid: false, errors: ['Invalid simulation scenario input type'] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['Expected a JSON object representing the simulation scenario.'],
    };
  }

  // 2. Validate & Normalize Metadata
  const rawMeta = parsed.metadata || parsed;
  const title = typeof rawMeta.title === 'string' && rawMeta.title.trim() ? rawMeta.title.trim() : 'AI-Generated Protocol Scenario';
  const rawId = typeof rawMeta.id === 'string' && rawMeta.id.trim()
    ? rawMeta.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    : `ai-sim-${title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30)}`;

  const metadata: SimulationMetadata = {
    id: rawId,
    title,
    certification: normalizeCertificationLevel(rawMeta.certification),
    protocol: normalizeProtocolFamily(rawMeta.protocol),
    difficulty: normalizeDifficultyLevel(rawMeta.difficulty),
    description:
      typeof rawMeta.description === 'string' && rawMeta.description.trim()
        ? rawMeta.description.trim()
        : `Interactive packet walkthrough and CLI fault-remediation scenario for ${title}.`,
    keyConcepts:
      Array.isArray(rawMeta.keyConcepts) && rawMeta.keyConcepts.length > 0
        ? rawMeta.keyConcepts.map(String).filter((s: string) => s.trim().length > 0)
        : [`${normalizeProtocolFamily(rawMeta.protocol)} Packet Encapsulation`, 'State Machine Transitions'],
  };

  // 3. Validate Topology Nodes
  const rawNodes = parsed.topology?.nodes || parsed.nodes;
  if (!Array.isArray(rawNodes) || rawNodes.length < 2) {
    errors.push('Topology must contain at least 2 nodes.');
  }

  const nodes: TopologyNode[] = [];
  const nodeIds = new Set<string>();

  if (Array.isArray(rawNodes)) {
    rawNodes.forEach((n, idx) => {
      if (!n || typeof n !== 'object') {
        errors.push(`Node at index ${idx} is not an object.`);
        return;
      }
      const id = typeof n.id === 'string' && n.id.trim() ? n.id.trim() : `node-${idx + 1}`;
      if (nodeIds.has(id)) {
        errors.push(`Duplicate node id: "${id}".`);
      }
      nodeIds.add(id);

      const name = typeof n.name === 'string' && n.name.trim() ? n.name.trim() : `Node-${id.toUpperCase()}`;
      const type: NodeType =
        n.type === 'switch' || n.type === 'router' || n.type === 'host' ? n.type : 'router';

      const interfaces = Array.isArray(n.interfaces)
        ? n.interfaces.map((intf: any, iIdx: number) => ({
            name: typeof intf.name === 'string' && intf.name ? intf.name : `eth${iIdx}`,
            ip: typeof intf.ip === 'string' ? intf.ip : undefined,
            mac: typeof intf.mac === 'string' ? intf.mac : `00:1A:2B:3C:4D:${(idx + 1).toString(16).padStart(2, '0')}`,
            subnetMask: typeof intf.subnetMask === 'string' ? intf.subnetMask : '255.255.255.0',
            vlan: typeof intf.vlan === 'number' ? intf.vlan : undefined,
          }))
        : [
            {
              name: 'Gi0/0',
              ip: `192.168.1.${idx + 1}`,
              mac: `00:1A:2B:3C:4D:${(idx + 1).toString(16).padStart(2, '0')}`,
              subnetMask: '255.255.255.0',
            },
          ];

      const tableState =
        n.tableState && typeof n.tableState === 'object' && !Array.isArray(n.tableState)
          ? n.tableState
          : {
              arpCache: [],
              routingTable: [],
              ospfNeighbors: [],
              macTable: [],
              tcpState: 'CLOSED',
            };

      nodes.push({
        id,
        name,
        type,
        interfaces,
        tableState,
        position: n.position && typeof n.position.x === 'number' && typeof n.position.y === 'number'
          ? n.position
          : { x: 80 + idx * 160, y: 150 },
      });
    });
  }

  // 4. Validate Topology Links
  const rawLinks = parsed.topology?.links || parsed.links;
  const links: TopologyLink[] = [];

  if (Array.isArray(rawLinks) && rawLinks.length > 0) {
    rawLinks.forEach((l, idx) => {
      if (!l || typeof l !== 'object') return;
      const id = typeof l.id === 'string' && l.id ? l.id : `link-${idx + 1}`;
      const sourceNodeId = typeof l.sourceNodeId === 'string' ? l.sourceNodeId : nodes[0]?.id || 'node-1';
      const targetNodeId = typeof l.targetNodeId === 'string' ? l.targetNodeId : nodes[1]?.id || 'node-2';

      links.push({
        id,
        sourceNodeId,
        targetNodeId,
        linkSpeed: typeof l.linkSpeed === 'string' ? l.linkSpeed : '1 Gbps',
        label: typeof l.label === 'string' ? l.label : `${sourceNodeId} <-> ${targetNodeId}`,
        vlan: typeof l.vlan === 'number' ? l.vlan : undefined,
      });
    });
  } else if (nodes.length >= 2) {
    // Generate default link between node 0 and node 1
    links.push({
      id: 'link-1',
      sourceNodeId: nodes[0].id,
      targetNodeId: nodes[1].id,
      linkSpeed: '1 Gbps',
      label: `${nodes[0].name} <-> ${nodes[1].name}`,
    });
  } else {
    errors.push('Topology must contain at least 1 valid link connecting nodes.');
  }

  // 5. Validate Steps
  const rawSteps = parsed.steps;
  if (!Array.isArray(rawSteps) || rawSteps.length < 2) {
    errors.push('Simulation must provide at least 2 sequential steps.');
  }

  const steps: SimulationStep[] = [];
  if (Array.isArray(rawSteps)) {
    rawSteps.forEach((s, idx) => {
      if (!s || typeof s !== 'object') {
        errors.push(`Step ${idx} is not an object.`);
        return;
      }

      const title = typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Step ${idx + 1}`;
      const explanation =
        typeof s.explanation === 'string' && s.explanation.trim()
          ? s.explanation.trim()
          : `Packet transmission during step ${idx + 1}.`;

      const activeNodeId = typeof s.activeNodeId === 'string' && s.activeNodeId ? s.activeNodeId : nodes[0]?.id || 'node-1';
      const targetNodeId = typeof s.targetNodeId === 'string' && s.targetNodeId ? s.targetNodeId : nodes[1]?.id || 'node-2';

      const rawTrans = s.transmission || {};
      const rawPacket = rawTrans.packet || {};
      const rawL2 = rawPacket.L2 || {};
      const rawL3 = rawPacket.L3 || {};
      const rawL4 = rawPacket.L4 || {};

      steps.push({
        stepIndex: idx,
        title,
        explanation,
        activeNodeId,
        targetNodeId,
        transmission: {
          fromNodeId: typeof rawTrans.fromNodeId === 'string' ? rawTrans.fromNodeId : activeNodeId,
          toNodeId: typeof rawTrans.toNodeId === 'string' ? rawTrans.toNodeId : targetNodeId,
          packet: {
            L2: {
              srcMac: typeof rawL2.srcMac === 'string' ? rawL2.srcMac : '00:1A:2B:3C:4D:01',
              dstMac: typeof rawL2.dstMac === 'string' ? rawL2.dstMac : '00:1A:2B:3C:4D:02',
              ethertype: typeof rawL2.ethertype === 'string' ? rawL2.ethertype : '0x0800 (IPv4)',
              vlanTag: rawL2.vlanTag,
            },
            L3: {
              srcIp: typeof rawL3.srcIp === 'string' ? rawL3.srcIp : '192.168.1.1',
              dstIp: typeof rawL3.dstIp === 'string' ? rawL3.dstIp : '192.168.1.2',
              protocol: typeof rawL3.protocol === 'string' ? rawL3.protocol : `${metadata.protocol}`,
              ttl: typeof rawL3.ttl === 'number' ? rawL3.ttl : 64,
              flags: rawL3.flags,
            },
            L4: {
              protocolType: rawL4.protocolType || (metadata.protocol === 'TCP' ? 'TCP' : metadata.protocol === 'OSPF' ? 'OSPF' : 'ICMP'),
              srcPort: typeof rawL4.srcPort === 'number' ? rawL4.srcPort : 1024 + idx,
              dstPort: typeof rawL4.dstPort === 'number' ? rawL4.dstPort : 80,
              flags: rawL4.flags,
              seqNumber: rawL4.seqNumber,
              ackNumber: rawL4.ackNumber,
              ospfType: rawL4.ospfType,
              icmpType: rawL4.icmpType,
            },
            payloadDescription:
              typeof rawPacket.payloadDescription === 'string' && rawPacket.payloadDescription.trim()
                ? rawPacket.payloadDescription.trim()
                : `${metadata.protocol} transmission between ${activeNodeId} and ${targetNodeId}`,
          },
        },
        nodeStateMutations: Array.isArray(s.nodeStateMutations) ? s.nodeStateMutations : undefined,
        socraticCheckpoint: s.socraticCheckpoint && typeof s.socraticCheckpoint.question === 'string'
          ? {
              question: s.socraticCheckpoint.question,
              hint: s.socraticCheckpoint.hint || 'Analyze the packet headers and protocol state transitions.',
              expectedConcept: s.socraticCheckpoint.expectedConcept || 'Protocol encapsulation and state transitions.',
            }
          : undefined,
      });
    });
  }

  // 6. Validate Bounded CLI Config (Optional but normalized if present)
  let cliConfig: ScenarioCliConfig | undefined = undefined;
  const rawCli = parsed.cliConfig;
  if (rawCli && typeof rawCli === 'object') {
    const targetNodeId =
      typeof rawCli.targetNodeId === 'string' && nodeIds.has(rawCli.targetNodeId)
        ? rawCli.targetNodeId
        : nodes[0]?.id || 'node-1';

    const promptHostname =
      typeof rawCli.promptHostname === 'string' && rawCli.promptHostname.trim()
        ? rawCli.promptHostname.trim()
        : `${targetNodeId.toUpperCase()}#`;

    const objective =
      typeof rawCli.objective === 'string' && rawCli.objective.trim()
        ? rawCli.objective.trim()
        : `Diagnose and remediate ${metadata.protocol} connectivity.`;

    const initialConfigLines = Array.isArray(rawCli.initialConfigLines)
      ? rawCli.initialConfigLines.map(String)
      : [`! Initial configuration for ${promptHostname}`, 'interface GigabitEthernet0/0'];

    const allowedCommands = Array.isArray(rawCli.allowedCommands) && rawCli.allowedCommands.length > 0
      ? rawCli.allowedCommands.map((c: any) => ({
          command: typeof c.command === 'string' ? c.command.trim() : 'show running-config',
          aliases: Array.isArray(c.aliases) ? c.aliases.map(String) : undefined,
          description: typeof c.description === 'string' ? c.description : undefined,
          output: typeof c.output === 'string' ? c.output : 'Command executed.',
          tableMutations: Array.isArray(c.tableMutations) ? c.tableMutations : undefined,
          goalAchieved: Boolean(c.goalAchieved),
        }))
      : [
          {
            command: 'show running-config',
            aliases: ['sh run'],
            description: 'Inspect current device configuration',
            output: initialConfigLines.join('\n'),
          },
        ];

    cliConfig = {
      protocolScope: normalizeProtocolFamily(rawCli.protocolScope || metadata.protocol) as any,
      targetNodeId,
      promptHostname,
      initialConfigLines,
      allowedCommands,
      objective,
    };
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const scenario: ProtocolSimulationScenario = {
    metadata,
    topology: {
      nodes,
      links,
    },
    steps,
    cliConfig,
    defaultViewport: parsed.defaultViewport || { zoom: 1, centerX: 300, centerY: 200 },
  };

  return { valid: true, scenario };
}

export const validateSimulationScenario = validateGeneratedSimulation;

