/**
 * NetMentor Protocol Explorer Engine Domain Types
 * Strict type definitions for packet headers, interactive network topologies,
 * step-by-step transmission simulations, node state machines, and Socratic checkpoints.
 */

export type CertificationLevel = 'Fundamentals' | 'CCNA' | 'CCNP';
export type ProtocolFamily = 'TCP' | 'ARP' | 'OSPF' | 'BGP' | 'VLAN';
export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface SimulationMetadata {
  id: string;
  title: string;
  certification: CertificationLevel;
  protocol: ProtocolFamily;
  difficulty: DifficultyLevel;
  description: string;
  keyConcepts: string[];
}

export type NodeType = 'host' | 'switch' | 'router';

export interface NodeInterface {
  name: string;
  ip?: string;
  mac: string;
  subnetMask?: string;
  vlan?: number;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  interface?: string;
}

export interface MacTableEntry {
  vlan?: number;
  mac: string;
  type?: 'DYNAMIC' | 'STATIC';
  port: string;
}

export interface RouteEntry {
  network: string;
  mask: string;
  nextHop?: string;
  interface: string;
  protocol: string; // 'C' (Connected), 'S' (Static), 'O' (OSPF), 'B' (BGP), etc.
  metric?: number;
  adminDistance?: number;
}

export interface OspfNeighborEntry {
  neighborId: string;
  priority: number;
  state: 'DOWN' | 'ATTEMPT' | 'INIT' | '2-WAY' | 'EXSTART' | 'EXCHANGE' | 'LOADING' | 'FULL';
  address: string;
  interface: string;
}

export type TcpSocketState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSE_WAIT'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'TIME_WAIT';

export interface NodeTableState {
  arpCache?: ArpEntry[];
  macTable?: MacTableEntry[];
  routingTable?: RouteEntry[];
  ospfNeighbors?: OspfNeighborEntry[];
  tcpState?: TcpSocketState | string;
  [key: string]: any;
}

export interface TopologyNode {
  id: string;
  name: string;
  type: NodeType;
  interfaces: NodeInterface[];
  tableState: NodeTableState;
  position?: { x: number; y: number };
}

export interface TopologyLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  linkSpeed: string;
  label: string;
  vlan?: number;
}

export interface L2Header {
  srcMac: string;
  dstMac: string;
  ethertype: string; // e.g. '0x0800 (IPv4)', '0x0806 (ARP)'
  vlanTag?: {
    vlanId: number;
    pcp?: number; // Priority Code Point (0-7)
    dei?: boolean; // Drop Eligible Indicator
  };
}

export interface L3Header {
  srcIp: string;
  dstIp: string;
  protocol: string; // e.g. 'TCP (6)', 'UDP (17)', 'ICMP (1)', 'OSPF (89)'
  ttl: number;
  identification?: number;
  flags?: {
    dontFragment?: boolean;
    moreFragments?: boolean;
  };
}

export interface L4Header {
  protocolType: 'TCP' | 'UDP' | 'ICMP' | 'OSPF';
  srcPort?: number;
  dstPort?: number;
  flags?: {
    syn?: boolean;
    ack?: boolean;
    fin?: boolean;
    rst?: boolean;
    psh?: boolean;
    urg?: boolean;
  };
  seqNumber?: number;
  ackNumber?: number;
  windowSize?: number;
  ospfType?: string; // 'Hello', 'DBD', 'LSR', 'LSU', 'LSAck'
  icmpType?: string; // 'Echo Request (8)', 'Echo Reply (0)'
}

export interface PacketHeader {
  L2: L2Header;
  L3: L3Header;
  L4: L4Header;
  payloadDescription: string;
}

export type TableType = 'arp' | 'mac' | 'routing' | 'ospf' | 'tcp';
export type MutationAction = 'add' | 'update' | 'delete';

export interface NodeStateMutation {
  nodeId: string;
  table: TableType;
  action: MutationAction;
  data: Record<string, any>;
}

export interface SocraticCheckpoint {
  question: string;
  hint: string;
  expectedConcept: string;
}

export interface PacketTransmission {
  fromNodeId: string;
  toNodeId: string;
  packet: PacketHeader;
}

export interface SimulationStep {
  stepIndex: number;
  title: string;
  explanation: string;
  activeNodeId: string;
  targetNodeId: string;
  transmission: PacketTransmission;
  nodeStateMutations?: NodeStateMutation[];
  socraticCheckpoint?: SocraticCheckpoint;
}

export interface DefaultViewport {
  zoom: number;
  centerX: number;
  centerY: number;
}

export type CliProtocolScope = 'OSPF' | 'BGP' | 'VLAN' | 'ARP' | 'TCP' | 'GENERAL';

export interface CliCommandDefinition {
  command: string;
  aliases?: string[];
  description?: string;
  output: string;
  tableMutations?: NodeStateMutation[];
  goalAchieved?: boolean;
  nextPromptHostname?: string;
}

export interface ScenarioCliConfig {
  protocolScope: CliProtocolScope;
  targetNodeId: string;
  promptHostname: string;
  initialConfigLines: string[];
  allowedCommands: CliCommandDefinition[];
  objective: string;
}

export interface ProtocolSimulationScenario {
  metadata: SimulationMetadata;
  topology: {
    nodes: TopologyNode[];
    links: TopologyLink[];
  };
  steps: SimulationStep[];
  defaultViewport?: DefaultViewport;
  cliConfig?: ScenarioCliConfig;
}

export type InspectedLayer = 'L2' | 'L3' | 'L4' | 'Payload';
export type InspectorTab = 'headers' | 'nodeTables' | 'socratic';

export interface SavedSimulationRecord {
  id: string;
  userId: string;
  scenarioId: string;
  title: string;
  protocol: ProtocolFamily;
  certification: CertificationLevel;
  difficulty: DifficultyLevel;
  scenario: ProtocolSimulationScenario;
  createdAt: string;
  updatedAt?: string;
}
