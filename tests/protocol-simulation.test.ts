import {
  PROTOCOL_SIMULATION_CATALOG,
  TCP_HANDSHAKE_SCENARIO,
  ARP_MAC_LEARNING_SCENARIO,
  OSPF_ADJACENCY_SCENARIO,
  VLAN_TRUNKING_ROAS_SCENARIO,
  BGP_BEST_PATH_SCENARIO,
} from '../src/data/simulations/index.ts';
import {
  computeAccumulatedTopology,
  applySingleMutation,
  extractBaseHostname,
  formatCliPrompt,
  evaluateCliNavigation,
  synthesizeLiveShowCommand,
} from '../src/hooks/useProtocolSimulation.ts';
import {
  parseAppRoute,
  buildAppUrl,
} from '../src/App.tsx';
import type {
  ProtocolSimulationScenario,
  TopologyNode,
  NodeStateMutation,
  CertificationLevel,
  ProtocolFamily,
  DifficultyLevel,
  ActiveLabContext,
} from '../src/types/protocol-simulation.ts';
import {
  validateGeneratedSimulation,
  normalizeProtocolFamily,
  normalizeCertificationLevel,
  normalizeDifficultyLevel,
} from '../api/_lib/ai/simulation-validator.js';
import { getActiveAiProvider, MockAiProvider, __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';
import {
  buildSimulationGenerationPrompt,
  formatLabTelemetryContext,
  buildTutorPrompt,
  buildUserPrompt,
} from '../api/_lib/ai/prompt-builder.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import tutorHandler from '../api/_routes/ai/tutor.js';
import {
  saveCustomSimulation,
  listSavedSimulations,
  getSavedSimulationById,
  deleteSavedSimulation,
  markSimulationCompleted,
  listSimulationCompletions,
  __setTestMockStore,
} from '../api/_lib/db/client.js';
import simulationsHandler from '../api/_routes/simulations.js';
import {
  simulationsApi,
  getLocalSavedSimulations,
  setLocalSavedSimulations,
  getCompletedSimulationIds,
  setCompletedSimulationIds,
  addCompletedSimulationId,
} from '../src/lib/api.ts';


/**
 * NetMentor Protocol Explorer Engine Automated Test Suite
 * Test Suite 19: Validates scenario integrity, packet encapsulation,
 * state machine accumulator logic, and Socratic educational checkpoints.
 */

async function runProtocolSimulationTests() {
  console.log('=== STARTING NETMENTOR PROTOCOL EXPLORER ENGINE TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`   ✓ ${msg}`);
    passed++;
  }

  // =========================================================================
  // 1. Scenario Catalog Integrity & Structural Completeness
  // =========================================================================
  console.log('1. Testing Scenario Catalog Completeness & Metadata:');

  assert(
    PROTOCOL_SIMULATION_CATALOG.length === 5,
    `Expected exactly 5 simulation scenarios in catalog, found ${PROTOCOL_SIMULATION_CATALOG.length}`
  );

  const scenarioIds = PROTOCOL_SIMULATION_CATALOG.map((s) => s.metadata.id);
  assert(
    scenarioIds.includes('tcp-handshake-teardown'),
    'Catalog includes TCP 3-Way Handshake & Teardown scenario'
  );
  assert(
    scenarioIds.includes('arp-mac-learning'),
    'Catalog includes ARP & Transparent Switch MAC Learning scenario'
  );
  assert(
    scenarioIds.includes('ospf-adjacency-mtu'),
    'Catalog includes OSPF Adjacency & MTU Mismatch scenario'
  );
  assert(
    scenarioIds.includes('vlan-trunking-roas'),
    'Catalog includes 802.1Q VLAN Trunking & Router-on-a-Stick scenario'
  );
  assert(
    scenarioIds.includes('bgp-best-path-selection'),
    'Catalog includes CCNP ENCOR BGP Peering & Best-Path Selection scenario'
  );

  // Validate metadata fields for every scenario
  for (const scenario of PROTOCOL_SIMULATION_CATALOG) {
    const meta = scenario.metadata;
    assert(Boolean(meta.id && meta.id.trim().length > 0), `Scenario ${meta.id} has non-empty ID`);
    assert(Boolean(meta.title && meta.title.trim().length > 0), `Scenario ${meta.id} has valid title`);
    assert(
      ['Fundamentals', 'CCNA', 'CCNP'].includes(meta.certification),
      `Scenario ${meta.id} has valid certification level (${meta.certification})`
    );
    assert(
      ['TCP', 'ARP', 'OSPF', 'BGP', 'VLAN'].includes(meta.protocol),
      `Scenario ${meta.id} has valid protocol family (${meta.protocol})`
    );
    assert(
      ['Beginner', 'Intermediate', 'Advanced'].includes(meta.difficulty),
      `Scenario ${meta.id} has valid difficulty tier (${meta.difficulty})`
    );
    assert(
      Boolean(meta.description && meta.description.length > 20),
      `Scenario ${meta.id} has descriptive synopsis (${meta.description.length} chars)`
    );
    assert(
      Array.isArray(meta.keyConcepts) && meta.keyConcepts.length >= 3,
      `Scenario ${meta.id} has at least 3 key pedagogical concepts`
    );
  }

  // Topology node uniqueness and interface validation
  console.log('\n2. Testing Topology Graphs, Node Isolation & Interface Addressing:');
  for (const scenario of PROTOCOL_SIMULATION_CATALOG) {
    const { nodes, links } = scenario.topology;
    assert(nodes.length >= 2, `Scenario ${scenario.metadata.id} topology has at least 2 nodes`);
    assert(links.length >= 1, `Scenario ${scenario.metadata.id} topology has at least 1 link`);

    const nodeIds = new Set<string>();
    for (const node of nodes) {
      assert(!nodeIds.has(node.id), `Node ID "${node.id}" is strictly unique in scenario ${scenario.metadata.id}`);
      nodeIds.add(node.id);

      assert(Boolean(node.name && node.name.length > 0), `Node ${node.id} has a human-readable display name`);
      assert(['host', 'switch', 'router'].includes(node.type), `Node ${node.id} has a valid hardware type: ${node.type}`);
      assert(Array.isArray(node.interfaces) && node.interfaces.length > 0, `Node ${node.id} has at least one interface`);

      for (const iface of node.interfaces) {
        assert(Boolean(iface.name && iface.name.length > 0), `Interface on node ${node.id} has valid name`);
        assert(
          Boolean(iface.mac && iface.mac.length >= 14),
          `Interface ${iface.name} on ${node.id} has valid MAC address (${iface.mac})`
        );
        if (iface.ip) {
          const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
          assert(ipRegex.test(iface.ip), `Interface ${iface.name} on ${node.id} has valid IPv4 format (${iface.ip})`);
        }
      }
    }

    // Verify all links connect existing nodes
    for (const link of links) {
      assert(nodeIds.has(link.sourceNodeId), `Link ${link.id} source node "${link.sourceNodeId}" exists in topology`);
      assert(nodeIds.has(link.targetNodeId), `Link ${link.id} target node "${link.targetNodeId}" exists in topology`);
      assert(Boolean(link.linkSpeed), `Link ${link.id} specifies link speed`);
    }

    // Verify step sequence
    const steps = scenario.steps;
    assert(steps.length >= 4, `Scenario ${scenario.metadata.id} contains >= 4 step transitions`);

    steps.forEach((step, idx) => {
      assert(step.stepIndex === idx, `Scenario ${scenario.metadata.id} step at offset ${idx} has sequential stepIndex ${step.stepIndex}`);
      assert(Boolean(step.title && step.title.length > 0), `Step ${idx} has a descriptive title`);
      assert(Boolean(step.explanation && step.explanation.length > 20), `Step ${idx} has thorough technical explanation`);
      assert(nodeIds.has(step.activeNodeId), `Step ${idx} activeNodeId "${step.activeNodeId}" exists in topology`);
      assert(nodeIds.has(step.targetNodeId), `Step ${idx} targetNodeId "${step.targetNodeId}" exists in topology`);
      assert(nodeIds.has(step.transmission.fromNodeId), `Step ${idx} transmission source node exists`);
      assert(nodeIds.has(step.transmission.toNodeId), `Step ${idx} transmission destination node exists`);
    });
  }

  // =========================================================================
  // 2. Multi-Layer Packet Encapsulation Ladder Validation
  // =========================================================================
  console.log('\n3. Testing L2/L3/L4 Packet Encapsulation & Protocol Invariants:');

  const ipv4OrMulticastRegex = /^(?:(?:[0-9]{1,3}\.){3}[0-9]{1,3}|224\.0\.0\.[0-9]{1,3})$/;

  for (const scenario of PROTOCOL_SIMULATION_CATALOG) {
    for (const step of scenario.steps) {
      const pkt = step.transmission.packet;
      assert(Boolean(pkt.payloadDescription && pkt.payloadDescription.length > 0), `Step ${step.stepIndex} has non-empty payload description`);

      // L2 Validation
      assert(Boolean(pkt.L2.srcMac && pkt.L2.dstMac), `Step ${step.stepIndex} has source and destination MACs`);
      assert(Boolean(pkt.L2.ethertype), `Step ${step.stepIndex} has EtherType specified`);

      if (pkt.L3.protocol.includes('ARP') || pkt.L2.ethertype.includes('0x0806')) {
        assert(
          pkt.L2.ethertype.includes('0x0806') || pkt.L2.ethertype.includes('ARP'),
          `ARP packet step ${step.stepIndex} in ${scenario.metadata.id} has 0x0806 (ARP) EtherType`
        );
      } else {
        assert(
          pkt.L2.ethertype.includes('0x0800') || pkt.L2.ethertype.includes('IPv4'),
          `IP packet step ${step.stepIndex} in ${scenario.metadata.id} has 0x0800 (IPv4) EtherType`
        );
      }

      // L3 Validation
      assert(ipv4OrMulticastRegex.test(pkt.L3.srcIp), `Step ${step.stepIndex} has valid IPv4 src: ${pkt.L3.srcIp}`);
      assert(ipv4OrMulticastRegex.test(pkt.L3.dstIp), `Step ${step.stepIndex} has valid IPv4 dst: ${pkt.L3.dstIp}`);
      assert(pkt.L3.ttl >= 1 && pkt.L3.ttl <= 255, `Step ${step.stepIndex} has RFC-compliant TTL (${pkt.L3.ttl})`);

      // L4 Protocol-specific validation
      if (pkt.L4.protocolType === 'TCP') {
        assert(pkt.L3.protocol.includes('6') || pkt.L3.protocol.includes('TCP'), `TCP packet has protocol number 6 in L3`);
        assert(
          typeof pkt.L4.srcPort === 'number' && pkt.L4.srcPort >= 1 && pkt.L4.srcPort <= 65535,
          `TCP src port ${pkt.L4.srcPort} is in valid range 1-65535`
        );
        assert(
          typeof pkt.L4.dstPort === 'number' && pkt.L4.dstPort >= 1 && pkt.L4.dstPort <= 65535,
          `TCP dst port ${pkt.L4.dstPort} is in valid range 1-65535`
        );
        assert(typeof pkt.L4.seqNumber === 'number', `TCP packet includes numeric sequence number`);
        assert(typeof pkt.L4.ackNumber === 'number', `TCP packet includes numeric acknowledgment number`);
        assert(Boolean(pkt.L4.flags), `TCP packet includes control flags object`);
      } else if (pkt.L4.protocolType === 'OSPF') {
        assert(pkt.L3.protocol.includes('89') || pkt.L3.protocol.includes('OSPF'), `OSPF packet has protocol number 89 in L3`);
        assert(Boolean(pkt.L4.ospfType), `OSPF packet specifies ospfType (e.g. Hello, DBD)`);
      }
    }
  }
  assert(true, 'All packet encapsulation headers conform strictly to RFC standards');

  // =========================================================================
  // 3. State Mutation Accumulator Engine Tests
  // =========================================================================
  console.log('\n4. Testing State Mutation Accumulator Engine (Chronological Step Traversal):');

  // A. ARP & Transparent Switch MAC Learning Scenario Accumulation
  {
    console.log('   Testing ARP Resolution & Switch CAM Learning Accumulation:');
    const arpSteps = ARP_MAC_LEARNING_SCENARIO.steps;
    const baseNodes = ARP_MAC_LEARNING_SCENARIO.topology.nodes;

    // Step 0: Initial state - switch CAM table should be empty, Host A ARP cache empty
    const topoAtStep0 = computeAccumulatedTopology(baseNodes, arpSteps, 0);
    const swAt0 = topoAtStep0.find((n) => n.id === 'switch-1');
    const hostAAt0 = topoAtStep0.find((n) => n.id === 'host-a');
    assert(swAt0?.tableState.macTable?.length === 0, 'Switch MAC table is initially empty at Step 0');
    assert(hostAAt0?.tableState.arpCache?.length === 0, 'Host A ARP cache is empty at Step 0');

    // Step 2: Switch receives Host A broadcast frame on Fa0/1 and learns Host A MAC
    const topoAtStep2 = computeAccumulatedTopology(baseNodes, arpSteps, 2);
    const swAt2 = topoAtStep2.find((n) => n.id === 'switch-1');
    const macAEntry = swAt2?.tableState.macTable?.find((m) => m.mac === '00:1A:2B:3C:4D:0A');
    assert(Boolean(macAEntry && macAEntry.port === 'Fa0/1'), 'Switch correctly learns Host A MAC on Fa0/1 by Step 2');

    // Step 5: Host B sends unicast reply; switch learns Host B MAC on Fa0/2
    const topoAtStep5 = computeAccumulatedTopology(baseNodes, arpSteps, 5);
    const swAt5 = topoAtStep5.find((n) => n.id === 'switch-1');
    const macBEntry = swAt5?.tableState.macTable?.find((m) => m.mac === '00:1A:2B:3C:4D:0B');
    assert(Boolean(macBEntry && macBEntry.port === 'Fa0/2'), 'Switch correctly learns Host B MAC on Fa0/2 by Step 5');
    assert(swAt5?.tableState.macTable?.length === 2, 'Switch CAM table now holds both Host A and Host B records');

    // Final Step: Host A ARP cache is populated with Host B IP -> MAC mapping
    const topoAtFinal = computeAccumulatedTopology(baseNodes, arpSteps, arpSteps.length - 1);
    const hostAAtFinal = topoAtFinal.find((n) => n.id === 'host-a');
    const hostAArp = hostAAtFinal?.tableState.arpCache?.find((e) => e.ip === '192.168.1.20');
    assert(Boolean(hostAArp && hostAArp.mac === '00:1A:2B:3C:4D:0B'), 'Host A ARP cache successfully resolved 192.168.1.20 to Host B MAC');

    const hostBAtFinal = topoAtFinal.find((n) => n.id === 'host-b');
    const hostBArp = hostBAtFinal?.tableState.arpCache?.find((e) => e.ip === '192.168.1.10');
    assert(Boolean(hostBArp && hostBArp.mac === '00:1A:2B:3C:4D:0A'), 'Host B ARP cache populated from incoming request');
  }

  // B. OSPF 7-State Formation & MTU Mismatch Accumulation
  {
    console.log('   Testing OSPF Neighbor FSM Transitions & MTU Discard Accumulation:');
    const ospfSteps = OSPF_ADJACENCY_SCENARIO.steps;
    const baseNodes = OSPF_ADJACENCY_SCENARIO.topology.nodes;

    // Step 0: Initial state - No neighbors
    const topoAt0 = computeAccumulatedTopology(baseNodes, ospfSteps, 0);
    const r2At0 = topoAt0.find((n) => n.id === 'router-2');
    assert(r2At0?.tableState.ospfNeighbors?.length === 0, 'R2 has 0 OSPF neighbors at Step 0');

    // Step 1: R1 Hello arrives -> R2 enters INIT state
    const topoAt1 = computeAccumulatedTopology(baseNodes, ospfSteps, 1);
    const r2At1 = topoAt1.find((n) => n.id === 'router-2');
    const nbrAt1 = r2At1?.tableState.ospfNeighbors?.find((n) => n.neighborId === '1.1.1.1');
    assert(Boolean(nbrAt1 && nbrAt1.state === 'INIT'), 'R2 registers R1 neighbor state as "INIT"');

    // Step 2: R2 replies with Hello containing R1 ID -> both enter 2-WAY state
    const topoAt2 = computeAccumulatedTopology(baseNodes, ospfSteps, 2);
    const r1At2 = topoAt2.find((n) => n.id === 'router-1');
    const r2At2 = topoAt2.find((n) => n.id === 'router-2');
    const nbr1At2 = r1At2?.tableState.ospfNeighbors?.find((n) => n.neighborId === '2.2.2.2');
    const nbr2At2 = r2At2?.tableState.ospfNeighbors?.find((n) => n.neighborId === '1.1.1.1');
    assert(Boolean(nbr1At2 && nbr1At2.state === '2-WAY'), 'R1 registers R2 neighbor state as "2-WAY"');
    assert(Boolean(nbr2At2 && nbr2At2.state === '2-WAY'), 'R2 registers R1 neighbor state as "2-WAY"');

    // Step 3: ExStart phase - DBD Master/Slave negotiation begins
    const topoAt3 = computeAccumulatedTopology(baseNodes, ospfSteps, 3);
    const r1At3 = topoAt3.find((n) => n.id === 'router-1');
    const r2At3 = topoAt3.find((n) => n.id === 'router-2');
    const nbr1At3 = r1At3?.tableState.ospfNeighbors?.find((n) => n.neighborId === '2.2.2.2');
    const nbr2At3 = r2At3?.tableState.ospfNeighbors?.find((n) => n.neighborId === '1.1.1.1');
    assert(Boolean(nbr1At3 && nbr1At3.state === 'EXSTART'), 'R1 enters "EXSTART" state for master/slave DBD exchange');
    assert(Boolean(nbr2At3 && nbr2At3.state === 'EXSTART'), 'R2 enters "EXSTART" state for master/slave DBD exchange');

    // Step 4 (Final Step): Mismatched MTU causes discard - neighbor remains in EXSTART (stalled)
    const topoAtFinal = computeAccumulatedTopology(baseNodes, ospfSteps, ospfSteps.length - 1);
    const r2AtFinal = topoAtFinal.find((n) => n.id === 'router-2');
    const finalNbr = r2AtFinal?.tableState.ospfNeighbors?.find((n) => n.neighborId === '1.1.1.1');
    assert(Boolean(finalNbr && finalNbr.state.includes('EXSTART')), 'Adjacency correctly remains stuck at EXSTART due to MTU 1500 vs 1400 divergence');
  }

  // C. TCP 3-Way Handshake & Teardown Socket State Machine Accumulation
  {
    console.log('   Testing TCP Socket FSM Transitions (Handshake through Teardown):');
    const tcpSteps = TCP_HANDSHAKE_SCENARIO.steps;
    const baseNodes = TCP_HANDSHAKE_SCENARIO.topology.nodes;

    // Step 0: Client dispatches SYN -> enters SYN_SENT
    const topoAt0 = computeAccumulatedTopology(baseNodes, tcpSteps, 0);
    const clientAt0 = topoAt0.find((n) => n.id === 'host-client');
    assert(clientAt0?.tableState.tcpState === 'SYN_SENT', 'Client transitions to SYN_SENT on dispatching initial SYN');

    // Step 1: Server receives SYN & dispatches SYN-ACK -> enters SYN_RCVD
    const topoAt1 = computeAccumulatedTopology(baseNodes, tcpSteps, 1);
    const srvAt1 = topoAt1.find((n) => n.id === 'srv-web');
    assert(srvAt1?.tableState.tcpState === 'SYN_RCVD', 'Server transitions to SYN_RCVD on replying with SYN-ACK');

    // Step 2: Client sends final ACK -> both enter ESTABLISHED
    const topoAt2 = computeAccumulatedTopology(baseNodes, tcpSteps, 2);
    const clientAt2 = topoAt2.find((n) => n.id === 'host-client');
    const srvAt2 = topoAt2.find((n) => n.id === 'srv-web');
    assert(clientAt2?.tableState.tcpState === 'ESTABLISHED', 'Client reaches ESTABLISHED state');
    assert(srvAt2?.tableState.tcpState === 'ESTABLISHED', 'Server reaches ESTABLISHED state');

    // Teardown steps: Find steps mutating tcpState
    const finStepIdx = tcpSteps.findIndex((s) => s.nodeStateMutations?.some((m) => m.data.state === 'FIN_WAIT_1'));
    assert(finStepIdx !== -1, 'Scenario contains FIN_WAIT_1 transition step');

    const topoAtFin = computeAccumulatedTopology(baseNodes, tcpSteps, finStepIdx);
    const clientAtFin = topoAtFin.find((n) => n.id === 'host-client');
    assert(clientAtFin?.tableState.tcpState === 'FIN_WAIT_1', 'Client enters FIN_WAIT_1 when transmitting FIN');

    // Final Step: Socket teardown complete
    const topoAtFinal = computeAccumulatedTopology(baseNodes, tcpSteps, tcpSteps.length - 1);
    const clientAtFinal = topoAtFinal.find((n) => n.id === 'host-client');
    assert(
      clientAtFinal?.tableState.tcpState === 'TIME_WAIT' || clientAtFinal?.tableState.tcpState === 'CLOSED',
      `Client terminates in safe closed/wait state: ${clientAtFinal?.tableState.tcpState}`
    );
  }

  // D. 802.1Q VLAN Trunking & Router-on-a-Stick (ROAS) Accumulation
  {
    console.log('   Testing 802.1Q VLAN Trunking & Router-on-a-Stick (ROAS) Accumulation:');
    const vlanSteps = VLAN_TRUNKING_ROAS_SCENARIO.steps;
    const baseNodes = VLAN_TRUNKING_ROAS_SCENARIO.topology.nodes;

    // Step 0: PC-Sales transmits untagged frame
    const step0Packet = vlanSteps[0].transmission.packet;
    assert(!step0Packet.L2.vlanTag, 'Step 0 frame from PC-Sales is untagged (no 802.1Q header)');
    assert(step0Packet.L2.dstMac === '00:1A:2B:3C:4D:R1', 'Step 0 frame destination MAC is Default Gateway R1 Gi0/0.10');

    // Step 1: Switch SW-1 inserts 802.1Q tag (VID 10) and learns PC-Sales MAC in VLAN 10
    const topoAt1 = computeAccumulatedTopology(baseNodes, vlanSteps, 1);
    const swAt1 = topoAt1.find((n) => n.id === 'switch-1');
    const vlan10MacEntry = swAt1?.tableState.macTable?.find(
      (m) => m.mac === '00:1A:2B:3C:4D:10' && m.vlan === 10
    );
    assert(Boolean(vlan10MacEntry && vlan10MacEntry.port === 'Fa0/1'), 'Switch SW-1 learns PC-Sales MAC strictly scoped to VLAN 10 on Fa0/1');

    const step1Packet = vlanSteps[1].transmission.packet;
    assert(Boolean(step1Packet.L2.vlanTag), 'Step 1 frame across trunk link Gi0/1 carries 802.1Q tag header');
    assert(step1Packet.L2.vlanTag?.vlanId === 10, 'Step 1 frame tag VID is exactly 10');
    assert(step1Packet.L2.vlanTag?.pcp === 0, 'Step 1 frame Priority Code Point (PCP) is 0 (Best Effort)');

    // Step 2: Router R1 receives VID 10 on Gi0/0.10, de-encapsulates, routes to Gi0/0.20, and decrements TTL
    const step2Packet = vlanSteps[2].transmission.packet;
    assert(!step2Packet.L2.vlanTag, 'Step 2 router internal routing strips 802.1Q header');
    assert(step2Packet.L3.ttl === 127, 'Router R1 decrements IP TTL from 128 to 127 during inter-VLAN forwarding');

    const topoAt2 = computeAccumulatedTopology(baseNodes, vlanSteps, 2);
    const r1At2 = topoAt2.find((n) => n.id === 'router-1');
    const r1Arp = r1At2?.tableState.arpCache?.find((a) => a.ip === '192.168.10.10');
    assert(Boolean(r1Arp && r1Arp.mac === '00:1A:2B:3C:4D:10'), 'Router R1 records PC-Sales ARP entry on sub-interface Gi0/0.10');

    // Step 3: Router R1 re-encapsulates with VID 20 tag on trunk port toward SW-1
    const step3Packet = vlanSteps[3].transmission.packet;
    assert(Boolean(step3Packet.L2.vlanTag && step3Packet.L2.vlanTag.vlanId === 20), 'Step 3 routed packet is re-encapsulated with 802.1Q VID 20');
    assert(step3Packet.L2.srcMac === '00:1A:2B:3C:4D:R2', 'Step 3 frame source MAC is Router sub-interface Gi0/0.20');
    assert(step3Packet.L2.dstMac === '00:1A:2B:3C:4D:20', 'Step 3 frame destination MAC is PC-Eng');

    // Step 4: Switch SW-1 forwards out access port Fa0/2 with tag stripped and learns PC-Eng in VLAN 20
    const step4Packet = vlanSteps[4].transmission.packet;
    assert(!step4Packet.L2.vlanTag, 'Step 4 access egress port Fa0/2 strips 802.1Q tag header');

    const topoAt4 = computeAccumulatedTopology(baseNodes, vlanSteps, 4);
    const swAt4 = topoAt4.find((n) => n.id === 'switch-1');
    const vlan20MacEntry = swAt4?.tableState.macTable?.find(
      (m) => m.mac === '00:1A:2B:3C:4D:20' && m.vlan === 20
    );
    assert(Boolean(vlan20MacEntry && vlan20MacEntry.port === 'Fa0/2'), 'Switch SW-1 learns PC-Eng MAC strictly scoped to VLAN 20 on Fa0/2');
    assert(swAt4?.tableState.macTable?.length === 2, 'Switch CAM table maintains both VLAN 10 and VLAN 20 isolated entries');

    // Step 5: PC-Eng receives frame, populates ARP cache, and prepares ICMP Echo Reply
    const topoAtFinal = computeAccumulatedTopology(baseNodes, vlanSteps, vlanSteps.length - 1);
    const pcEngAtFinal = topoAtFinal.find((n) => n.id === 'pc-eng');
    const pcEngArp = pcEngAtFinal?.tableState.arpCache?.find((a) => a.ip === '192.168.20.1');
    assert(Boolean(pcEngArp && pcEngArp.mac === '00:1A:2B:3C:4D:R2'), 'PC-Eng records default gateway R1 Gi0/0.20 in its ARP cache');
  }

  // E. CCNP ENCOR BGP eBGP Peering Session & Best-Path Selection Accumulation
  {
    console.log('   Testing BGP eBGP Session Establishment & Best-Path Tie-Breaker Accumulation:');
    const bgpSteps = BGP_BEST_PATH_SCENARIO.steps;
    const baseNodes = BGP_BEST_PATH_SCENARIO.topology.nodes;

    // Step 0: R1-Edge sends TCP SYN to ISP-A:179 and transitions to OPENSENT
    const topoAt0 = computeAccumulatedTopology(baseNodes, bgpSteps, 0);
    const r1At0 = topoAt0.find((n) => n.id === 'r1-edge');
    assert(r1At0?.tableState.tcpState === 'OPENSENT', 'R1-Edge transitions to OPENSENT upon dispatching TCP/179 SYN');
    const step0Packet = bgpSteps[0].transmission.packet;
    assert(step0Packet.L4.protocolType === 'TCP' && step0Packet.L4.dstPort === 179, 'Step 0 packet targets TCP port 179');
    assert(step0Packet.L3.ttl === 1, 'Step 0 packet enforces eBGP single-hop TTL=1');

    // Step 1: ISP-A replies with BGP OPEN; both R1-Edge and ISP-A transition to OPENCONFIRM
    const topoAt1 = computeAccumulatedTopology(baseNodes, bgpSteps, 1);
    const r1At1 = topoAt1.find((n) => n.id === 'r1-edge');
    const ispAAt1 = topoAt1.find((n) => n.id === 'isp-a');
    assert(r1At1?.tableState.tcpState === 'OPENCONFIRM', 'R1-Edge transitions to OPENCONFIRM upon receiving valid BGP OPEN');
    assert(ispAAt1?.tableState.tcpState === 'OPENCONFIRM', 'ISP-A transitions to OPENCONFIRM');

    // Step 2: KEEPALIVE exchange brings peers to ESTABLISHED state
    const topoAt2 = computeAccumulatedTopology(baseNodes, bgpSteps, 2);
    const r1At2 = topoAt2.find((n) => n.id === 'r1-edge');
    const ispAAt2 = topoAt2.find((n) => n.id === 'isp-a');
    assert(r1At2?.tableState.tcpState === 'ESTABLISHED', 'R1-Edge reaches ESTABLISHED peering state');
    assert(ispAAt2?.tableState.tcpState === 'ESTABLISHED', 'ISP-A reaches ESTABLISHED peering state');
    assert(bgpSteps[2].transmission.packet.payloadDescription.includes('KEEPALIVE'), 'Step 2 payload confirms 19-byte BGP KEEPALIVE');

    // Step 3: ISP-A advertises 203.0.113.0/24 with AS-Path [65100, 65900]
    const topoAt3 = computeAccumulatedTopology(baseNodes, bgpSteps, 3);
    const r1At3 = topoAt3.find((n) => n.id === 'r1-edge');
    const routeAt3 = r1At3?.tableState.routingTable?.find((r) => r.network === '203.0.113.0');
    assert(Boolean(routeAt3), 'R1-Edge installs route for 203.0.113.0/24 from ISP-A into routing table');
    assert(routeAt3?.nextHop === '172.16.1.2', 'Initial BGP route next-hop is ISP-A (172.16.1.2)');
    assert(routeAt3?.protocol === 'B', 'BGP route has protocol flag B');
    assert(routeAt3?.adminDistance === 20, 'eBGP route has Administrative Distance 20');

    // Step 4: ISP-B advertises competing prefix 203.0.113.0/24 with shorter AS-Path [65200]
    const step4Packet = bgpSteps[4].transmission.packet;
    assert(step4Packet.payloadDescription.includes('65200'), 'Step 4 packet advertises shorter AS-Path [65200] from ISP-B');
    assert(step4Packet.payloadDescription.includes('MED: 200'), 'Step 4 packet indicates higher MED of 200');

    // Step 5: BGP Best-Path algorithm selects ISP-B due to shorter AS-Path (1 hop vs 2 hops), ignoring higher MED
    const topoAtFinal = computeAccumulatedTopology(baseNodes, bgpSteps, bgpSteps.length - 1);
    const r1AtFinal = topoAtFinal.find((n) => n.id === 'r1-edge');
    const routeAtFinal = r1AtFinal?.tableState.routingTable?.find((r) => r.network === '203.0.113.0');
    assert(Boolean(routeAtFinal), 'R1-Edge maintains active route for 203.0.113.0/24');
    assert(routeAtFinal?.nextHop === '172.16.2.2', 'Best-path selection converges active next-hop to ISP-B (172.16.2.2)');
    assert(routeAtFinal?.interface === 'Gi0/2', 'Active egress interface switches to Gi0/2 toward ISP-B');
    assert(routeAtFinal?.metric === 200, 'Route reflects ISP-B metric (200), proving shorter AS-Path beat lower MED (100)');
  }

  // F. Unit Verification of applySingleMutation Helper
  {
    console.log('   Testing applySingleMutation Primitive Resiliency:');
    const dummyNode: TopologyNode = {
      id: 'test-node',
      name: 'Test Router',
      type: 'router',
      interfaces: [{ name: 'Gi0/0', mac: '00:00:00:11:22:33', ip: '10.0.0.1' }],
      tableState: {},
    };

    // Test ARP add & delete
    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'arp',
      action: 'add',
      data: { ip: '10.0.0.2', mac: '00:00:00:AA:BB:CC', interface: 'Gi0/0' },
    });
    assert(dummyNode.tableState.arpCache?.length === 1, 'ARP mutation added entry to empty cache');
    assert(dummyNode.tableState.arpCache?.[0].mac === '00:00:00:AA:BB:CC', 'ARP entry MAC recorded properly');

    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'arp',
      action: 'delete',
      data: { ip: '10.0.0.2' },
    });
    assert(dummyNode.tableState.arpCache?.length === 0, 'ARP mutation successfully deleted entry by IP');

    // Test MAC add & delete
    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'mac',
      action: 'add',
      data: { mac: 'AA:BB:CC:DD:EE:FF', port: 'Fa0/24', vlan: 10 },
    });
    assert(dummyNode.tableState.macTable?.length === 1, 'MAC mutation added entry');
    assert(dummyNode.tableState.macTable?.[0].port === 'Fa0/24', 'MAC port recorded correctly');

    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'mac',
      action: 'delete',
      data: { mac: 'AA:BB:CC:DD:EE:FF' },
    });
    assert(dummyNode.tableState.macTable?.length === 0, 'MAC mutation deleted entry');

    // Test Routing add & delete
    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'routing',
      action: 'add',
      data: { network: '172.16.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2', interface: 'Gi0/0', protocol: 'O' },
    });
    assert(dummyNode.tableState.routingTable?.length === 1, 'Routing mutation added route');
    assert(dummyNode.tableState.routingTable?.[0].protocol === 'O', 'Routing protocol OSPF flag recorded');

    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'routing',
      action: 'delete',
      data: { network: '172.16.0.0', mask: '255.255.0.0' },
    });
    assert(dummyNode.tableState.routingTable?.length === 0, 'Routing mutation deleted route');

    // Test TCP socket state update
    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'tcp',
      action: 'update',
      data: { state: 'ESTABLISHED' },
    });
    assert(dummyNode.tableState.tcpState === 'ESTABLISHED', 'TCP state successfully updated to ESTABLISHED');

    applySingleMutation(dummyNode, {
      nodeId: 'test-node',
      table: 'tcp',
      action: 'delete',
      data: {},
    });
    assert(dummyNode.tableState.tcpState === 'CLOSED', 'TCP state delete resets to CLOSED');
  }

  // =========================================================================
  // 4. Socratic Checkpoint Pedagogical Invariants
  // =========================================================================
  console.log('\n5. Testing Socratic Checkpoints & Pedagogical Prompts:');

  let totalCheckpoints = 0;
  for (const scenario of PROTOCOL_SIMULATION_CATALOG) {
    const checkpoints = scenario.steps.filter((s) => s.socraticCheckpoint);
    assert(checkpoints.length >= 1, `Scenario ${scenario.metadata.id} provides at least 1 Socratic learning checkpoint`);

    for (const step of checkpoints) {
      const cp = step.socraticCheckpoint!;
      totalCheckpoints++;
      assert(
        Boolean(cp.question && cp.question.length >= 15 && cp.question.includes('?')),
        `Step ${step.stepIndex} checkpoint has well-formed question ending with '?' (${cp.question.slice(0, 35)}...)`
      );
      assert(
        Boolean(cp.hint && cp.hint.length >= 20),
        `Step ${step.stepIndex} checkpoint provides an actionable didactic hint`
      );
      assert(
        Boolean(cp.expectedConcept && cp.expectedConcept.length >= 20),
        `Step ${step.stepIndex} checkpoint specifies deep concept string for evaluation`
      );
    }
  }

  assert(totalCheckpoints >= 5, `Verified ${totalCheckpoints} total Socratic checkpoints across all simulation scenarios`);

  // =========================================================================
  // 6. Bounded In-App CLI Configuration & Command Execution
  // =========================================================================
  console.log('\n6. Testing Bounded CLI Configuration & In-App Execution Engine:');

  const cliScenarios = [
    OSPF_ADJACENCY_SCENARIO,
    VLAN_TRUNKING_ROAS_SCENARIO,
    BGP_BEST_PATH_SCENARIO,
    ARP_MAC_LEARNING_SCENARIO,
  ];

  for (const sc of cliScenarios) {
    const cli = sc.cliConfig;
    assert(Boolean(cli), `Scenario ${sc.metadata.id} has defined cliConfig`);
    if (!cli) continue;

    assert(
      ['OSPF', 'VLAN', 'BGP', 'ARP', 'TCP', 'GENERAL'].includes(cli.protocolScope),
      `Scenario ${sc.metadata.id} has valid protocolScope: ${cli.protocolScope}`
    );

    const targetNode = sc.topology.nodes.find((n) => n.id === cli.targetNodeId);
    assert(Boolean(targetNode), `Target node "${cli.targetNodeId}" exists in topology nodes`);

    assert(Boolean(cli.promptHostname && cli.promptHostname.length >= 2), `Prompt hostname is defined: "${cli.promptHostname}"`);
    assert(Boolean(cli.objective && cli.objective.length >= 20), `Objective is clearly defined: "${cli.objective.slice(0, 40)}..."`);
    assert(Array.isArray(cli.initialConfigLines) && cli.initialConfigLines.length >= 2, `Initial config snippet has at least 2 lines`);
    assert(Array.isArray(cli.allowedCommands) && cli.allowedCommands.length >= 3, `Allowed commands has at least 3 bounded commands`);

    const hasGoalTrigger = cli.allowedCommands.some((c) => c.goalAchieved === true);
    assert(hasGoalTrigger, `Scenario ${sc.metadata.id} provides at least 1 command with goalAchieved=true`);

    for (const cmd of cli.allowedCommands) {
      assert(Boolean(cmd.command && cmd.command.length >= 2), `Command definition "${cmd.command}" is non-empty`);
      assert(Boolean(cmd.output && cmd.output.length >= 5), `Command "${cmd.command}" has deterministic output`);
    }
  }

  // Test CLI execution logic on OSPF scenario
  console.log('\n   6.1 CLI Interactive Execution Simulation (OSPF Adjacency):');
  const ospfCli = OSPF_ADJACENCY_SCENARIO.cliConfig!;

  function simulateCliExec(rawInput: string) {
    const trimmed = rawInput.trim();
    const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ');

    if (normalized === '?' || normalized === 'help') {
      return { success: true, isHelp: true, output: 'Available Commands' };
    }

    const match = ospfCli.allowedCommands.find((c) => {
      if (c.command.toLowerCase().trim().replace(/\s+/g, ' ') === normalized) return true;
      if (c.aliases && c.aliases.some((a) => a.toLowerCase().trim().replace(/\s+/g, ' ') === normalized)) return true;
      return false;
    });

    if (match) {
      return {
        success: true,
        output: match.output,
        goalAchieved: Boolean(match.goalAchieved),
        tableMutations: match.tableMutations,
      };
    }

    return {
      success: false,
      output: `% Invalid input detected: "${trimmed}"`,
    };
  }

  const helpRes = simulateCliExec('?');
  assert(helpRes.success && helpRes.isHelp, 'Executing "?" returns help output');

  const invalidRes = simulateCliExec('shutdown everything now');
  assert(!invalidRes.success && invalidRes.output.includes('% Invalid input'), 'Executing unpermitted command is safely rejected');

  const diagRes = simulateCliExec('show ip ospf neighbor');
  assert(diagRes.success && diagRes.output.includes('EXSTART'), 'Executing exact diagnostic command returns EXSTART output');

  const aliasRes = simulateCliExec('sh ip ospf nei');
  assert(aliasRes.success && aliasRes.output.includes('EXSTART'), 'Executing command alias (sh ip ospf nei) returns valid output');

  const fixRes = simulateCliExec('ip mtu 1500');
  assert(fixRes.success && fixRes.goalAchieved === true, 'Executing remediation command sets goalAchieved: true');
  assert(Array.isArray(fixRes.tableMutations) && fixRes.tableMutations.length >= 2, 'Remediation command specifies tableMutations');

  // Apply remediation mutation to test node
  const testRouterNode: TopologyNode = {
    id: 'router-2',
    name: 'R2',
    type: 'router',
    interfaces: [],
    tableState: {
      ospfNeighbors: [{ neighborId: '1.1.1.1', priority: 1, state: 'EXSTART', address: '10.0.0.1', interface: 'Gi0/0' }],
      routingTable: [],
    },
  };

  for (const mut of fixRes.tableMutations!) {
    if (mut.nodeId === 'router-2') {
      applySingleMutation(testRouterNode, mut);
    }
  }

  assert(testRouterNode.tableState.ospfNeighbors![0].state === 'FULL', 'OSPF neighbor state successfully transitioned to FULL via CLI mutation');

  // =========================================================================
  // 7. Multi-Provider AI Scenario Generation & Validator Invariants
  // =========================================================================
  console.log('\n7. Testing Multi-Provider AI Scenario Generator & Schema Validation:');

  // 7.1 Schema validator reject paths
  const emptyRes = validateGeneratedSimulation('');
  assert(!emptyRes.valid && emptyRes.errors!.length > 0, 'Empty AI response is rejected by validator');

  const junkRes = validateGeneratedSimulation('Random conversational LLM greeting without JSON');
  assert(!junkRes.valid && junkRes.errors!.some((e) => e.includes('Malformed JSON') || e.includes('No valid JSON object')), 'Conversational non-JSON output is safely rejected');

  const brokenJsonRes = validateGeneratedSimulation('{"metadata": {"title": "incomplete", "bad": true');
  assert(!brokenJsonRes.valid && brokenJsonRes.errors!.some((e) => e.includes('Malformed JSON')), 'Malformed JSON syntax is safely caught');

  const missingNodesRes = validateGeneratedSimulation(JSON.stringify({
    metadata: { title: 'Test Scenario', protocol: 'OSPF' },
    topology: { nodes: [{ id: 'n1', name: 'N1' }], links: [] },
    steps: [{ stepIndex: 0, title: 'Step 1' }, { stepIndex: 1, title: 'Step 2' }],
  }));
  assert(!missingNodesRes.valid && missingNodesRes.errors!.some((e) => e.includes('at least 2 nodes')), 'Scenario with < 2 nodes rejected');

  const missingStepsRes = validateGeneratedSimulation(JSON.stringify({
    metadata: { title: 'Test Scenario', protocol: 'OSPF' },
    topology: {
      nodes: [{ id: 'n1', name: 'N1' }, { id: 'n2', name: 'N2' }],
      links: [{ id: 'l1', sourceNodeId: 'n1', targetNodeId: 'n2' }],
    },
    steps: [],
  }));
  assert(!missingStepsRes.valid && missingStepsRes.errors!.some((e) => e.includes('at least 2 sequential steps')), 'Scenario with 0 steps rejected');

  // 7.2 Prompt construction
  const prompt = buildSimulationGenerationPrompt({
    topic: 'BGP Local-Preference Traffic Engineering',
    protocol: 'BGP',
    certification: 'CCNP',
    difficulty: 'Advanced',
    faultScenario: 'Primary ISP peer lacks local-pref override',
  });
  assert(prompt.systemPrompt.includes('STRUCTURED PROTOCOL SIMULATION GENERATION MODE'), 'System prompt enforces structured simulation generation');
  assert(prompt.userPrompt.includes('<simulation_request>'), 'User prompt contains simulation_request envelope');
  assert(prompt.userPrompt.includes('BGP Local-Preference Traffic Engineering'), 'User prompt contains requested topic');

  // 7.3 Multi-Provider mock execution & full scenario validation
  __setTestAiProvider(new MockAiProvider());
  const aiProvider = getActiveAiProvider();
  const simResponse = await aiProvider.generateResponse({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
  });

  assert(Boolean(simResponse.text && simResponse.text.length > 200), 'Active AI provider generated substantial response text');
  assert(Boolean(simResponse.isSimulated), 'Response flagged as deterministic simulated generation in test harness');

  const validRes = validateGeneratedSimulation(simResponse.text);
  assert(validRes.valid === true && Boolean(validRes.scenario), 'Generated scenario passes full validation schema with 0 errors');

  const genScenario = validRes.scenario!;
  assert(genScenario.metadata.title.includes('BGP Local-Preference'), 'Generated scenario title matches requested topic');
  assert(genScenario.metadata.protocol === 'BGP', 'Generated scenario protocol is BGP');
  assert(genScenario.metadata.certification === 'CCNP', 'Generated scenario certification is CCNP');
  assert(genScenario.topology.nodes.length >= 2, 'Generated scenario has at least 2 topology nodes');
  assert(genScenario.topology.links.length >= 1, 'Generated scenario has at least 1 topology link');
  assert(genScenario.steps.length >= 2, 'Generated scenario has at least 2 transmission steps');
  assert(Boolean(genScenario.steps[0].transmission.packet.L2.srcMac), 'Step 0 packet has valid L2 srcMac');
  assert(Boolean(genScenario.steps[0].transmission.packet.L3.srcIp), 'Step 0 packet has valid L3 srcIp');
  assert(Boolean(genScenario.steps[0].transmission.packet.L4.protocolType), 'Step 0 packet has valid L4 protocolType');
  assert(Boolean(genScenario.cliConfig), 'Generated scenario provides bounded CLI config');
  assert(genScenario.cliConfig?.allowedCommands.some((c) => c.goalAchieved === true), 'Generated CLI config provides remediation command with goalAchieved=true');

  // 7.4 Simulated error flags
  try {
    await aiProvider.generateResponse({
      systemPrompt: 'STRUCTURED PROTOCOL SIMULATION GENERATION MODE',
      userPrompt: 'TEST_PROVIDER_ERROR',
    });
    assert(false, 'TEST_PROVIDER_ERROR should have thrown');
  } catch (err: any) {
    assert(err?.message.includes('Simulated upstream AI provider failure'), 'TEST_PROVIDER_ERROR threw expected provider failure');
  }

  const badJsonSim = await aiProvider.generateResponse({
    systemPrompt: 'STRUCTURED PROTOCOL SIMULATION GENERATION MODE',
    userPrompt: 'TEST_INVALID_JSON',
  });
  const badJsonSimVal = validateGeneratedSimulation(badJsonSim.text);
  assert(!badJsonSimVal.valid, 'TEST_INVALID_JSON simulation response safely caught as invalid');

  const missingStepsSim = await aiProvider.generateResponse({
    systemPrompt: 'STRUCTURED PROTOCOL SIMULATION GENERATION MODE',
    userPrompt: 'TEST_MISSING_STEPS',
  });
  const missingStepsSimVal = validateGeneratedSimulation(missingStepsSim.text);
  assert(!missingStepsSimVal.valid, 'TEST_MISSING_STEPS simulation response safely caught as invalid');

  __setTestAiProvider(null);

  // =========================================================================
  // 8. Protocol Simulation Persistence & Route Handlers (Phase I)
  // =========================================================================
  console.log('\n8. Testing Protocol Simulation Persistence & Route Handlers:');

  // 8.1 Schema & Client Mock Store
  const mockSavedStore: any[] = [];
  __setTestMockStore({
    saveCustomSimulation: async (userId: string, scenario: any) => {
      const existingIdx = mockSavedStore.findIndex((s) => s.userId === userId && s.scenarioId === scenario.metadata.id);
      const record = {
        id: `mock-uuid-${mockSavedStore.length + 1}`,
        userId,
        scenarioId: scenario.metadata.id,
        title: scenario.metadata.title,
        protocol: scenario.metadata.protocol,
        certification: scenario.metadata.certification,
        difficulty: scenario.metadata.difficulty,
        scenario,
        createdAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        mockSavedStore[existingIdx] = record;
      } else {
        mockSavedStore.push(record);
      }
      return record;
    },
    listSavedSimulations: async (userId: string) => {
      return mockSavedStore.filter((s) => s.userId === userId);
    },
    getSavedSimulationById: async (userId: string, id: string) => {
      return mockSavedStore.find((s) => s.userId === userId && (s.id === id || s.scenarioId === id)) || null;
    },
    deleteSavedSimulation: async (userId: string, id: string) => {
      const idx = mockSavedStore.findIndex((s) => s.userId === userId && (s.id === id || s.scenarioId === id));
      if (idx >= 0) {
        mockSavedStore.splice(idx, 1);
        return true;
      }
      return false;
    },
  });

  // Test saving custom scenario
  const testScenario = BGP_BEST_PATH_SCENARIO;
  const savedRec = await saveCustomSimulation('user-test-1', testScenario);
  assert(savedRec.userId === 'user-test-1', 'Simulation persisted with correct userId');
  assert(savedRec.scenarioId === testScenario.metadata.id, 'Simulation persisted with correct scenarioId');
  assert(savedRec.scenario.metadata.protocol === 'BGP', 'Simulation JSON payload preserved');

  // Test listing
  const user1List = await listSavedSimulations('user-test-1');
  assert(user1List.length === 1, 'listSavedSimulations returned 1 scenario for user-test-1');
  assert(user1List[0].scenarioId === testScenario.metadata.id, 'Listed scenario matches saved scenario');

  // Test user isolation
  const user2List = await listSavedSimulations('user-test-2');
  assert(user2List.length === 0, 'User isolation verified: user-test-2 has 0 saved scenarios');

  // Test getSavedSimulationById
  const fetchedByScenarioId = await getSavedSimulationById('user-test-1', testScenario.metadata.id);
  assert(Boolean(fetchedByScenarioId), 'getSavedSimulationById retrieved record by scenarioId');
  const fetchedByUuid = await getSavedSimulationById('user-test-1', savedRec.id);
  assert(Boolean(fetchedByUuid), 'getSavedSimulationById retrieved record by database UUID');
  const fetchedWrongUser = await getSavedSimulationById('user-test-2', testScenario.metadata.id);
  assert(fetchedWrongUser === null, 'getSavedSimulationById enforces user isolation');

  // Test delete
  const deleteWrongUser = await deleteSavedSimulation('user-test-2', testScenario.metadata.id);
  assert(deleteWrongUser === false, 'deleteSavedSimulation returns false when user does not own scenario');
  const deleteSuccess = await deleteSavedSimulation('user-test-1', testScenario.metadata.id);
  assert(deleteSuccess === true, 'deleteSavedSimulation succeeds for owner');
  const user1ListAfterDel = await listSavedSimulations('user-test-1');
  assert(user1ListAfterDel.length === 0, 'Scenario removed from database after deletion');

  __setTestMockStore(null);

  // 8.2 API Route Dispatch & Handlers (/api/simulations)
  function createMockReqRes(options: {
    method: string;
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: any;
    query?: Record<string, any>;
  }) {
    let statusCode = 200;
    let responseData: any = null;
    const responseHeaders: Record<string, string> = {};

    const req: any = {
      method: options.method,
      url: options.url || '/api/simulations',
      headers: options.headers || {},
      cookies: options.cookies,
      body: options.body,
      query: options.query || {},
    };

    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
        return res;
      },
      json(data: any) {
        responseData = data;
        return res;
      },
      getStatus: () => statusCode,
      getData: () => responseData,
      getHeaders: () => responseHeaders,
    };

    return { req, res };
  }

  // Demo mode GET
  const { req: demoGetReq, res: demoGetRes } = createMockReqRes({
    method: 'GET',
    headers: { 'x-netmentor-demo': 'true' },
  });
  await simulationsHandler(demoGetReq, demoGetRes);
  assert(demoGetRes.getStatus() === 200, 'Demo GET /api/simulations returned HTTP 200');
  assert(demoGetRes.getData()?.isDemoMode === true, 'Demo response flags isDemoMode: true');

  // Demo mode POST with CSRF
  const { req: demoPostReq, res: demoPostRes } = createMockReqRes({
    method: 'POST',
    headers: { 'x-netmentor-demo': 'true', 'x-netmentor-request': '1' },
    body: { scenario: OSPF_ADJACENCY_SCENARIO },
  });
  await simulationsHandler(demoPostReq, demoPostRes);
  assert(demoPostRes.getStatus() === 201, 'Demo POST /api/simulations returned HTTP 201 Created');
  assert(demoPostRes.getData()?.simulation?.protocol === 'OSPF', 'Demo POST preserved scenario protocol');

  // Unauthenticated without demo mode returns 401
  const { req: unauthReq, res: unauthRes } = createMockReqRes({
    method: 'GET',
  });
  await simulationsHandler(unauthReq, unauthRes);
  assert(unauthRes.getStatus() === 401, 'Unauthenticated GET /api/simulations rejected with HTTP 401');

  // POST without CSRF header rejected with 403
  const { req: noCsrfReq, res: noCsrfRes } = createMockReqRes({
    method: 'POST',
    headers: { 'x-netmentor-demo': 'true' }, // missing x-netmentor-request
    body: { scenario: TCP_HANDSHAKE_SCENARIO },
  });
  await simulationsHandler(noCsrfReq, noCsrfRes);
  assert(noCsrfRes.getStatus() === 403, 'POST /api/simulations without CSRF rejected with HTTP 403');

  // Unsupported HTTP Method (PUT) rejected with 405
  const { req: putReq, res: putRes } = createMockReqRes({
    method: 'PUT',
    headers: { 'x-netmentor-demo': 'true' },
  });
  await simulationsHandler(putReq, putRes);
  assert(putRes.getStatus() === 405, 'PUT /api/simulations rejected with HTTP 405 Method Not Allowed');

  // 8.3 In-Memory LocalStorage Fallback Verification
  // In Node environment, mock localStorage if needed
  if (typeof globalThis.localStorage === 'undefined') {
    const memStore: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => memStore[key] ?? null,
      setItem: (key: string, val: string) => { memStore[key] = String(val); },
      removeItem: (key: string) => { delete memStore[key]; },
      clear: () => { Object.keys(memStore).forEach((k) => delete memStore[k]); },
    };
  }

  setLocalSavedSimulations([]);
  assert(getLocalSavedSimulations().length === 0, 'Local storage initialized empty');
  await simulationsApi.saveCustomSimulation(VLAN_TRUNKING_ROAS_SCENARIO, { isDemoMode: true });
  const localList = getLocalSavedSimulations();
  assert(localList.length === 1, 'Custom simulation saved to local storage fallback');
  assert(localList[0].scenarioId === 'vlan-trunking-roas', 'Local scenarioId matches saved scenario');

  await simulationsApi.deleteSavedSimulation('vlan-trunking-roas', { isDemoMode: true });
  assert(getLocalSavedSimulations().length === 0, 'Custom simulation removed from local storage fallback');

  // =========================================================================
  // SECTION 9: Phase J — Authentic Cisco IOS Mode Hierarchy & Path-Based SPA Routing
  // =========================================================================
  console.log('\n--- Section 9: Authentic Cisco IOS Mode Hierarchy & Path-Based SPA Routing ---');

  // 9.1 Base Hostname Extraction
  console.log('   Testing Base Hostname Extraction from Scenarios:');
  assert(extractBaseHostname('R1-Edge#') === 'R1-Edge', 'extractBaseHostname removes trailing #');
  assert(extractBaseHostname('SW-1#') === 'SW-1', 'extractBaseHostname handles switch hostnames');
  assert(extractBaseHostname('Router>') === 'Router', 'extractBaseHostname strips > prompt char');
  assert(extractBaseHostname('') === 'Router', 'extractBaseHostname defaults empty string to Router');
  assert(extractBaseHostname('Host-A# ') === 'Host-A', 'extractBaseHostname trims surrounding whitespace');

  // 9.2 Dynamic Cisco Prompt Formatting
  console.log('   Testing Dynamic Cisco Prompt Formatting:');
  assert(formatCliPrompt('R1-Edge#', 'privileged') === 'R1-Edge#', 'formatCliPrompt privileged EXEC prompt');
  assert(formatCliPrompt('R1-Edge#', 'config') === 'R1-Edge(config)#', 'formatCliPrompt global config prompt');
  assert(
    formatCliPrompt('R1-Edge#', 'config-sub', 'config-if') === 'R1-Edge(config-if)#',
    'formatCliPrompt interface sub-mode prompt'
  );
  assert(
    formatCliPrompt('R1-Edge#', 'config-sub', 'config-router') === 'R1-Edge(config-router)#',
    'formatCliPrompt router sub-mode prompt'
  );

  // 9.3 Cisco IOS Mode Navigation Transitions
  console.log('   Testing Cisco IOS Mode Hierarchy Navigation Transitions:');
  
  // Privileged -> configure terminal -> Global Config
  const toConfig = evaluateCliNavigation('configure terminal', 'privileged');
  assert(toConfig !== null && toConfig.nextMode === 'config', 'configure terminal transitions to config mode');
  assert(Boolean(toConfig?.output.includes('CNTL/Z')), 'conf t outputs standard Cisco configuration banner');

  // conf t abbreviation
  const confTAbbr = evaluateCliNavigation('conf t', 'privileged');
  assert(confTAbbr !== null && confTAbbr.nextMode === 'config', 'conf t abbreviation transitions to config mode');

  // Already in config mode warning
  const confTInConfig = evaluateCliNavigation('conf t', 'config');
  assert(
    confTInConfig !== null && confTInConfig.output.includes('Already in configuration mode'),
    'conf t while in config warns user already in configuration mode'
  );

  // Global Config -> interface Gi0/0 -> Interface Sub-Mode
  const toIfMode = evaluateCliNavigation('interface GigabitEthernet0/0', 'config');
  assert(toIfMode !== null && toIfMode.nextMode === 'config-sub', 'interface command enters config-sub mode');
  assert(toIfMode?.nextSubModeLabel === 'config-if', 'interface command sets sub-mode label to config-if');

  const toIfAbbr = evaluateCliNavigation('int Gi0/1', 'config');
  assert(toIfAbbr !== null && toIfAbbr.nextSubModeLabel === 'config-if', 'int shorthand enters config-if');

  // Global Config -> router ospf 1 -> Router Sub-Mode
  const toRouterMode = evaluateCliNavigation('router ospf 1', 'config');
  assert(toRouterMode !== null && toRouterMode.nextMode === 'config-sub', 'router ospf command enters config-sub mode');
  assert(toRouterMode?.nextSubModeLabel === 'config-router', 'router command sets sub-mode label to config-router');

  const toBgpMode = evaluateCliNavigation('router bgp 65000', 'config');
  assert(toBgpMode !== null && toBgpMode.nextSubModeLabel === 'config-router', 'router bgp enters config-router');

  // Sub-mode -> exit -> Global Config
  const exitFromSub = evaluateCliNavigation('exit', 'config-sub', 'config-if');
  assert(exitFromSub !== null && exitFromSub.nextMode === 'config', 'exit from sub-mode steps back to global config');

  // Global Config -> exit -> Privileged EXEC
  const exitFromConfig = evaluateCliNavigation('exit', 'config');
  assert(
    exitFromConfig !== null && exitFromConfig.nextMode === 'privileged',
    'exit from config steps back to privileged EXEC'
  );
  assert(Boolean(exitFromConfig?.output.includes('SYS-5-CONFIG_I')), 'exit from config prints SYS-5 syslog message');

  // Privileged EXEC -> exit -> stay in Privileged EXEC
  const exitFromPriv = evaluateCliNavigation('exit', 'privileged');
  assert(
    exitFromPriv !== null && exitFromPriv.nextMode === 'privileged',
    'exit from privileged EXEC prevents session drop'
  );
  assert(Boolean(exitFromPriv?.output.includes('Cannot exit top-level')), 'exit at top-level outputs warning');

  // Sub-mode -> end -> Privileged EXEC (Direct drop)
  const endFromSub = evaluateCliNavigation('end', 'config-sub', 'config-router');
  assert(endFromSub !== null && endFromSub.nextMode === 'privileged', 'end from sub-mode drops directly to privileged EXEC');
  assert(Boolean(endFromSub?.output.includes('SYS-5-CONFIG_I')), 'end prints configuration syslog confirmation');

  // Non-navigation command returns null
  assert(evaluateCliNavigation('show ip route', 'privileged') === null, 'Diagnostic show commands return null for navigation');
  assert(evaluateCliNavigation('do show ip route', 'config') === null, 'do commands return null for navigation');

  // 9.4 Clean Path-Based SPA Route Parsing
  console.log('   Testing Clean Path-Based SPA Route Parsing:');
  const dashRoute = parseAppRoute('/', '');
  assert(dashRoute.tab === 'dashboard' && dashRoute.scenarioId === null, 'Root path / maps to dashboard');
  assert(!dashRoute.isLegacyRedirect, 'Root path is not flagged as legacy redirect');

  const dashExplicitRoute = parseAppRoute('/dashboard', '');
  assert(dashExplicitRoute.tab === 'dashboard', '/dashboard maps to dashboard tab');

  const currRoute = parseAppRoute('/curriculum', '');
  assert(currRoute.tab === 'curriculum', '/curriculum maps to curriculum tab');

  const labsRoute = parseAppRoute('/labs', '');
  assert(labsRoute.tab === 'labs' && labsRoute.scenarioId === null, '/labs maps to labs tab without scenarioId');

  const labsScenarioRoute = parseAppRoute('/labs/bgp-best-path-selection', '');
  assert(
    labsScenarioRoute.tab === 'labs' && labsScenarioRoute.scenarioId === 'bgp-best-path-selection',
    '/labs/:scenarioId maps to labs with parsed scenarioId'
  );

  const libraryRoute = parseAppRoute('/library', '');
  assert(libraryRoute.tab === 'library', '/library maps to library tab');

  const flashcardsRoute = parseAppRoute('/flashcards', '');
  assert(flashcardsRoute.tab === 'flashcards', '/flashcards maps to flashcards tab');

  const quizzesRoute = parseAppRoute('/quizzes', '');
  assert(quizzesRoute.tab === 'quizzes', '/quizzes maps to quizzes tab');

  // Trailing slash tolerance
  const trailingSlashRoute = parseAppRoute('/curriculum/', '');
  assert(trailingSlashRoute.tab === 'curriculum', 'Trailing slashes are tolerated cleanly');

  // 9.5 Legacy Query String URL Normalization
  console.log('   Testing Legacy Query URL Normalization:');
  const legacyLabsRoute = parseAppRoute('/', '?tab=labs&scenario=ospf-adjacency-mtu');
  assert(legacyLabsRoute.tab === 'labs', 'Legacy ?tab=labs parsed correctly');
  assert(legacyLabsRoute.scenarioId === 'ospf-adjacency-mtu', 'Legacy ?scenario= parsed correctly');
  assert(legacyLabsRoute.isLegacyRedirect === true, 'Legacy URL flagged with isLegacyRedirect: true');

  const legacyLessonRoute = parseAppRoute('/', '?tab=curriculum&lesson=bgp-intro');
  assert(legacyLessonRoute.tab === 'curriculum', 'Legacy ?tab=curriculum parsed correctly');
  assert(legacyLessonRoute.lessonId === 'bgp-intro', 'Legacy ?lesson= parsed correctly');
  assert(legacyLessonRoute.isLegacyRedirect === true, 'Legacy lesson URL flagged with isLegacyRedirect: true');

  // 9.6 Path-Based SPA URL Builder
  console.log('   Testing Path-Based SPA URL Builder:');
  assert(buildAppUrl({ tab: 'dashboard' }) === '/', 'buildAppUrl dashboard returns /');
  assert(buildAppUrl({ tab: 'curriculum' }) === '/curriculum', 'buildAppUrl curriculum returns /curriculum');
  assert(buildAppUrl({ tab: 'labs' }) === '/labs', 'buildAppUrl labs without scenario returns /labs');
  assert(
    buildAppUrl({ tab: 'labs', scenarioId: 'bgp-best-path-selection' }) === '/labs/bgp-best-path-selection',
    'buildAppUrl labs with scenario returns /labs/:scenarioId'
  );
  assert(buildAppUrl({ tab: 'library' }) === '/library', 'buildAppUrl library returns /library');
  assert(buildAppUrl({ tab: 'quizzes' }) === '/quizzes', 'buildAppUrl quizzes returns /quizzes');
  assert(
    buildAppUrl({ tab: 'flashcards', deckId: 'ccna-deck-1' }) === '/flashcards?deckId=ccna-deck-1',
    'buildAppUrl preserves query params like deckId'
  );
  assert(
    buildAppUrl({ tab: 'curriculum', lessonId: 'bgp-overview' }) === '/curriculum?lesson=bgp-overview',
    'buildAppUrl preserves lessonId in query params'
  );

  // =========================================================================
  // SECTION 10: Phase K — Interactive Multi-Node CLI & Live Show Verification
  // =========================================================================
  console.log('\n--- Section 10: Interactive Multi-Node CLI & Live Show Verification ---');

  // 10.1 Multi-Node Hostname & Prompt Derivation
  console.log('   Testing Multi-Node Prompt Derivation across Device Types:');
  assert(formatCliPrompt('R1', 'privileged', 'config-if', false) === 'R1#', 'Router node derives privileged # prompt');
  assert(formatCliPrompt('R2', 'privileged', 'config-if', false) === 'R2#', 'Neighbor router derives privileged # prompt');
  assert(formatCliPrompt('SW-1', 'privileged', 'config-if', false) === 'SW-1#', 'Switch node derives privileged # prompt');
  assert(formatCliPrompt('PC-Sales', 'privileged', 'config-if', true) === 'PC-Sales>', 'Host node derives user > prompt');
  assert(formatCliPrompt('PC-Sales', 'config', 'config-if', true) === 'PC-Sales(config)#', 'Host node in config mode uses config prompt');

  // 10.2 Dynamic Show IP Interface Brief Synthesis
  console.log('   Testing Dynamic "show ip interface brief" Synthesis:');
  const mockRouterNode: TopologyNode = {
    id: 'r1-edge',
    name: 'R1-Edge',
    type: 'router',
    interfaces: [
      { name: 'GigabitEthernet0/0', ip: '192.168.1.1', mac: '00:1A:2B:3C:4D:01' },
      { name: 'GigabitEthernet0/1', mac: '00:1A:2B:3C:4D:02' },
    ],
    tableState: {},
  };

  const shIntBr = synthesizeLiveShowCommand('show ip interface brief', mockRouterNode);
  assert(shIntBr !== null, 'show ip interface brief returns formatted output');
  assert(Boolean(shIntBr?.includes('Interface                  IP-Address')), 'Output contains standard Cisco header');
  assert(Boolean(shIntBr?.includes('GigabitEthernet0/0         192.168.1.1')), 'Lists assigned IP address on Gi0/0');
  assert(Boolean(shIntBr?.includes('GigabitEthernet0/1         unassigned')), 'Lists unassigned status on Gi0/1');

  // Alias verification
  const shIntBrAlias = synthesizeLiveShowCommand('sh ip int br', mockRouterNode);
  assert(shIntBrAlias !== null && shIntBrAlias === shIntBr, 'sh ip int br alias produces identical output');

  // Node with no interfaces
  const noIfNode: TopologyNode = { id: 'empty-1', name: 'Empty', type: 'router', interfaces: [], tableState: {} };
  const emptyIfOut = synthesizeLiveShowCommand('show ip int brief', noIfNode);
  assert(Boolean(emptyIfOut?.includes('No physical or virtual interfaces')), 'Empty interface list handled gracefully');

  // 10.3 Dynamic Show IP Route Synthesis
  console.log('   Testing Dynamic "show ip route" Synthesis:');
  const routedNode: TopologyNode = {
    id: 'r1-core',
    name: 'R1-Core',
    type: 'router',
    interfaces: [{ name: 'Gi0/0', ip: '10.0.0.1', mac: '00:11:22:33:44:55' }],
    tableState: {
      routingTable: [
        { network: '10.0.0.0', mask: '255.255.255.252', interface: 'Gi0/0', protocol: 'C' },
        { network: '192.168.1.0', mask: '255.255.255.0', nextHop: '10.0.0.2', interface: 'Gi0/0', protocol: 'O', metric: 11, adminDistance: 110 },
        { network: '203.0.113.0', mask: '255.255.255.0', nextHop: '172.16.2.2', interface: 'Gi0/2', protocol: 'B', metric: 200, adminDistance: 20 },
      ],
    },
  };

  const routeOut = synthesizeLiveShowCommand('show ip route', routedNode);
  assert(routeOut !== null, 'show ip route returns table output');
  assert(Boolean(routeOut?.includes('Gateway of last resort is not set')), 'Includes gateway notice');
  assert(Boolean(routeOut?.includes('10.0.0.0')), 'Includes connected route');
  assert(Boolean(routeOut?.includes('O        192.168.1.0/24 [110/11] via 10.0.0.2, Gi0/0')), 'Includes OSPF route with AD/metric');
  assert(Boolean(routeOut?.includes('B        203.0.113.0/24 [20/200] via 172.16.2.2, Gi0/2')), 'Includes BGP route with AD/metric');

  // Alias verification
  const routeAlias = synthesizeLiveShowCommand('sh ip ro', routedNode);
  assert(routeAlias !== null && routeAlias === routeOut, 'sh ip ro alias produces identical output');

  // Node with empty routing table synthesizes connected routes from interfaces
  const defaultRouteNode: TopologyNode = {
    id: 'r-conn',
    name: 'R-Conn',
    type: 'router',
    interfaces: [{ name: 'Gi0/0', ip: '172.16.1.1', mac: 'AA:BB:CC:DD:EE:01' }],
    tableState: { routingTable: [] },
  };
  const synthesizedConn = synthesizeLiveShowCommand('show ip route', defaultRouteNode);
  assert(Boolean(synthesizedConn?.includes('C        172.16.1.0/24 is directly connected, Gi0/0')), 'Synthesizes connected subnet from interface IP');

  // 10.4 Dynamic Show ARP Synthesis
  console.log('   Testing Dynamic "show arp" Synthesis:');
  const arpNode: TopologyNode = {
    id: 'sw-core',
    name: 'SW-Core',
    type: 'switch',
    interfaces: [{ name: 'Vlan1', ip: '192.168.1.2', mac: '00:AA:BB:CC:DD:02' }],
    tableState: {
      arpCache: [
        { ip: '192.168.1.1', mac: '00:1A:2B:3C:4D:01', interface: 'Vlan1' },
        { ip: '192.168.1.100', mac: '00:1A:2B:3C:4D:99', interface: 'Vlan1' },
      ],
    },
  };
  const arpOut = synthesizeLiveShowCommand('show arp', arpNode);
  assert(arpOut !== null, 'show arp returns formatted table');
  assert(Boolean(arpOut?.includes('Protocol  Address          Age (min)  Hardware Addr   Type   Interface')), 'ARP table has standard Cisco columns');
  assert(Boolean(arpOut?.includes('192.168.1.1')), 'Lists target IP 192.168.1.1');
  assert(Boolean(arpOut?.includes('00:1A:2B:3C:4D:01')), 'Lists MAC for target IP');

  // arp -a alias
  const arpAlias = synthesizeLiveShowCommand('arp -a', arpNode);
  assert(arpAlias !== null && arpAlias === arpOut, 'arp -a alias produces identical output');

  // Empty ARP cache
  const emptyArpNode: TopologyNode = { id: 'empty-arp', name: 'EA', type: 'router', interfaces: [], tableState: {} };
  const emptyArpOut = synthesizeLiveShowCommand('show arp', emptyArpNode);
  assert(Boolean(emptyArpOut?.includes('(ARP cache is empty)')), 'Empty ARP cache outputs explicit notice');

  // 10.5 Dynamic Show MAC Address-Table Synthesis
  console.log('   Testing Dynamic "show mac address-table" Synthesis:');
  const macNode: TopologyNode = {
    id: 'sw-1',
    name: 'SW-1',
    type: 'switch',
    interfaces: [],
    tableState: {
      macTable: [
        { vlan: 10, mac: '00:1A:2B:3C:4D:10', port: 'Fa0/1', type: 'DYNAMIC' },
        { vlan: 20, mac: '00:1A:2B:3C:4D:20', port: 'Fa0/2', type: 'DYNAMIC' },
      ],
    },
  };
  const macOut = synthesizeLiveShowCommand('show mac address-table', macNode);
  assert(macOut !== null, 'show mac address-table returns CAM table');
  assert(Boolean(macOut?.includes('Mac Address Table')), 'Has standard header');
  assert(Boolean(macOut?.includes('10      00:1A:2B:3C:4D:10 DYNAMIC     Fa0/1')), 'Renders VLAN 10 entry');
  assert(Boolean(macOut?.includes('20      00:1A:2B:3C:4D:20 DYNAMIC     Fa0/2')), 'Renders VLAN 20 entry');
  assert(Boolean(macOut?.includes('Total Mac Addresses for this criterion: 2')), 'Renders total count of 2 entries');

  // Alias
  const macAlias = synthesizeLiveShowCommand('sh mac-address-table', macNode);
  assert(macAlias !== null && macAlias === macOut, 'sh mac-address-table alias produces identical output');

  // Empty CAM table
  const emptyMacNode: TopologyNode = { id: 'empty-mac', name: 'EM', type: 'switch', interfaces: [], tableState: {} };
  const emptyMacOut = synthesizeLiveShowCommand('show mac address-table', emptyMacNode);
  assert(Boolean(emptyMacOut?.includes('Total Mac Addresses for this criterion: 0')), 'Empty CAM table reports total 0');

  // 10.6 Dynamic Show IP OSPF Neighbor Synthesis
  console.log('   Testing Dynamic "show ip ospf neighbor" Synthesis:');
  const ospfNode: TopologyNode = {
    id: 'router-1',
    name: 'R1',
    type: 'router',
    interfaces: [],
    tableState: {
      ospfNeighbors: [
        { neighborId: '2.2.2.2', priority: 1, state: 'FULL', address: '10.0.0.2', interface: 'Gi0/0' },
      ],
    },
  };
  const ospfOut = synthesizeLiveShowCommand('show ip ospf neighbor', ospfNode);
  assert(ospfOut !== null, 'show ip ospf neighbor returns neighbor table');
  assert(Boolean(ospfOut?.includes('Neighbor ID     Pri   State           Dead Time   Address         Interface')), 'OSPF neighbor table header present');
  assert(Boolean(ospfOut?.includes('2.2.2.2')), 'Lists neighbor RID 2.2.2.2');
  assert(Boolean(ospfOut?.includes('FULL')), 'Lists FULL adjacency state');

  const ospfAlias = synthesizeLiveShowCommand('sh ip ospf nei', ospfNode);
  assert(ospfAlias !== null && ospfAlias === ospfOut, 'sh ip ospf nei alias produces identical output');

  const emptyOspfNode: TopologyNode = { id: 'empty-ospf', name: 'EO', type: 'router', interfaces: [], tableState: {} };
  const emptyOspfOut = synthesizeLiveShowCommand('show ip ospf neighbor', emptyOspfNode);
  assert(Boolean(emptyOspfOut?.includes('(No active OSPF neighbors discovered)')), 'Empty OSPF table reports notice');

  // 10.7 Dynamic Show Running-Config & Show Version
  console.log('   Testing Dynamic "show running-config" & "show version" Synthesis:');
  const runCfgOut = synthesizeLiveShowCommand('show running-config', mockRouterNode);
  assert(Boolean(runCfgOut?.includes('hostname R1-Edge')), 'Running config includes node hostname');
  assert(Boolean(runCfgOut?.includes('interface GigabitEthernet0/0')), 'Running config includes interface Gi0/0');
  assert(Boolean(runCfgOut?.includes('ip address 192.168.1.1 255.255.255.0')), 'Running config includes IP address');

  const verOut = synthesizeLiveShowCommand('show version', mockRouterNode);
  assert(Boolean(verOut?.includes('Cisco IOS Software')), 'Show version includes Cisco IOS header');
  assert(Boolean(verOut?.includes('R1-Edge uptime is')), 'Show version references device name');

  // Unknown command returns null
  assert(synthesizeLiveShowCommand('reload', mockRouterNode) === null, 'Unsupported action command returns null');
  assert(synthesizeLiveShowCommand('ping 8.8.8.8', mockRouterNode) === null, 'Ping returns null to allow fallback');

  // =========================================================================
  // SECTION 11: Phase L — Solved CLI Lab Persistence & Dashboard Telemetry
  // =========================================================================
  console.log('\n--- Section 11: Solved CLI Lab Persistence & Dashboard Telemetry ---');

  // 11.1 Database Client & Mock Store for Lab Completions
  console.log('   Testing Database Client & User Isolation:');
  const mockCompletionsStore: any[] = [];
  __setTestMockStore({
    markSimulationCompleted: async (userId: string, scenarioId: string, protocol: string, certification: string) => {
      const existingIdx = mockCompletionsStore.findIndex((c) => c.userId === userId && c.scenarioId === scenarioId);
      const record = {
        id: existingIdx >= 0 ? mockCompletionsStore[existingIdx].id : `compl-${mockCompletionsStore.length + 1}`,
        userId,
        scenarioId,
        protocol,
        certification,
        completedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        mockCompletionsStore[existingIdx] = record;
      } else {
        mockCompletionsStore.push(record);
      }
      return record;
    },
    listSimulationCompletions: async (userId: string) => {
      return mockCompletionsStore.filter((c) => c.userId === userId);
    },
  });

  const compl1 = await markSimulationCompleted('user-sim-1', 'ospf-adjacency-mtu', 'OSPF', 'CCNA');
  assert(compl1.userId === 'user-sim-1', 'Completion marked with correct userId');
  assert(compl1.scenarioId === 'ospf-adjacency-mtu', 'Completion marked with correct scenarioId');
  assert(compl1.protocol === 'OSPF', 'Completion preserved protocol');

  const user1ComplList = await listSimulationCompletions('user-sim-1');
  assert(user1ComplList.length === 1, 'listSimulationCompletions returns 1 record for user-sim-1');

  // User isolation
  const user2ComplList = await listSimulationCompletions('user-sim-2');
  assert(user2ComplList.length === 0, 'User isolation verified: user-sim-2 has 0 completions');

  // Idempotent re-marking
  const compl1Re = await markSimulationCompleted('user-sim-1', 'ospf-adjacency-mtu', 'OSPF', 'CCNA');
  assert(compl1Re.id === compl1.id, 'Re-marking completion is idempotent (same record ID)');
  const user1ComplListAfter = await listSimulationCompletions('user-sim-1');
  assert(user1ComplListAfter.length === 1, 'Idempotent re-marking does not create duplicate records');

  __setTestMockStore(null);

  // 11.2 API Route Handlers (/api/simulations resource=completions & action=complete)
  console.log('   Testing API Route Handlers for Lab Completions:');
  // Demo mode GET completions
  const { req: demoGetComplReq, res: demoGetComplRes } = createMockReqRes({
    method: 'GET',
    url: '/api/simulations?resource=completions',
    headers: { 'x-netmentor-demo': 'true' },
    query: { resource: 'completions' },
  });
  await simulationsHandler(demoGetComplReq, demoGetComplRes);
  assert(demoGetComplRes.getStatus() === 200, 'Demo GET /api/simulations?resource=completions returned HTTP 200');
  assert(demoGetComplRes.getData()?.isDemoMode === true, 'Demo completions GET flags isDemoMode: true');
  assert(Array.isArray(demoGetComplRes.getData()?.completions), 'Demo completions returns array');

  // Demo mode POST complete
  const { req: demoPostComplReq, res: demoPostComplRes } = createMockReqRes({
    method: 'POST',
    url: '/api/simulations',
    headers: { 'x-netmentor-demo': 'true', 'x-netmentor-request': '1' },
    body: {
      action: 'complete',
      scenarioId: 'tcp-handshake-teardown',
      protocol: 'TCP',
      certification: 'Network+',
    },
  });
  await simulationsHandler(demoPostComplReq, demoPostComplRes);
  assert(demoPostComplRes.getStatus() === 201, 'Demo POST action: complete returned HTTP 201 Created');
  assert(demoPostComplRes.getData()?.completion?.scenarioId === 'tcp-handshake-teardown', 'Demo completion record returned');
  assert(demoPostComplRes.getData()?.isDemoMode === true, 'Demo POST complete flags isDemoMode: true');

  // POST complete without scenarioId returns 400
  const { req: badPostComplReq, res: badPostComplRes } = createMockReqRes({
    method: 'POST',
    url: '/api/simulations',
    headers: { 'x-netmentor-demo': 'true', 'x-netmentor-request': '1' },
    body: {
      action: 'complete',
      // missing scenarioId
    },
  });
  await simulationsHandler(badPostComplReq, badPostComplRes);
  assert(badPostComplRes.getStatus() === 400, 'POST action: complete without scenarioId returns HTTP 400');

  // POST complete without CSRF header returns 403
  const { req: noCsrfComplReq, res: noCsrfComplRes } = createMockReqRes({
    method: 'POST',
    url: '/api/simulations',
    headers: { 'x-netmentor-demo': 'true' },
    body: {
      action: 'complete',
      scenarioId: 'tcp-handshake-teardown',
    },
  });
  await simulationsHandler(noCsrfComplReq, noCsrfComplRes);
  assert(noCsrfComplRes.getStatus() === 403, 'POST action: complete without CSRF returns HTTP 403');

  // 11.3 Frontend Client & LocalStorage Fallback
  console.log('   Testing Frontend Client & LocalStorage Persistence:');
  setCompletedSimulationIds([]);
  assert(getCompletedSimulationIds().length === 0, 'Completed simulation IDs initialized empty');

  addCompletedSimulationId('vlan-trunking-roas');
  assert(getCompletedSimulationIds().includes('vlan-trunking-roas'), 'addCompletedSimulationId records scenario');

  // Duplicate add should be deduplicated
  addCompletedSimulationId('vlan-trunking-roas');
  assert(getCompletedSimulationIds().filter((id) => id === 'vlan-trunking-roas').length === 1, 'addCompletedSimulationId deduplicates IDs');

  // Test simulationsApi.fetchCompletedSimulations in demo mode
  const demoFetchRes = await simulationsApi.fetchCompletedSimulations({ isDemoMode: true });
  assert(Array.isArray(demoFetchRes), 'fetchCompletedSimulations returns array of scenario IDs');
  assert(demoFetchRes.includes('vlan-trunking-roas'), 'fetchCompletedSimulations includes saved local IDs');

  // Test simulationsApi.markSimulationCompleted in demo mode
  const markRes = await simulationsApi.markSimulationCompleted({
    scenarioId: 'bgp-best-path-selection',
    protocol: 'BGP',
    certification: 'CCNP Enterprise',
  }, { isDemoMode: true });
  assert(markRes.success === true, 'markSimulationCompleted succeeded');
  assert(markRes.scenarioId === 'bgp-best-path-selection', 'markSimulationCompleted returns scenarioId');
  assert(getCompletedSimulationIds().includes('bgp-best-path-selection'), 'markSimulationCompleted synced ID to localStorage');

  // =========================================================================
  // SECTION 12: Phase M — Live Lab Telemetry Injection into AI Tutor
  // =========================================================================
  console.log('\n--- Section 12: Live Lab Telemetry Injection into AI Tutor ---');

  // 12.1 Format ActiveLabContext Telemetry
  console.log('   Testing formatLabTelemetryContext Serialization & Truncation:');
  const mockLabContext: ActiveLabContext = {
    scenarioId: 'ospf-adjacency-mtu',
    title: 'OSPF Adjacency & MTU Mismatch',
    protocol: 'OSPF',
    certification: 'CCNA',
    difficulty: 'Intermediate',
    objective: 'Diagnose MTU mismatch causing OSPF stuck in ExStart state.',
    currentStepIndex: 1,
    totalSteps: 4,
    currentStepTitle: 'Verify MTU configuration on router interfaces',
    activeCliNodeId: 'r1-edge',
    activeCliNodeName: 'R1-Edge',
    activePrompt: 'R1-Edge#',
    isObjectiveSolved: false,
    recentCliCommands: [
      { prompt: 'R1-Edge#', command: 'show ip ospf neighbor', outputSummary: 'Neighbor 2.2.2.2 in EXSTART' },
      { prompt: 'R1-Edge#', command: 'show ip interface GigabitEthernet0/0', outputSummary: 'MTU 1500 bytes, BW 1000000 Kbit' },
    ],
    activeNodeTablesSummary: {
      ospfNeighbors: '1 neighbors (2.2.2.2:EXSTART)',
      routingTable: '3 routes',
      arpCache: '2 entries',
      macTable: '4 dynamic entries',
      tcpState: 'ESTABLISHED',
    },
  };

  const formattedTelemetry = formatLabTelemetryContext(mockLabContext);
  assert(formattedTelemetry.includes('=== [ACTIVE PROTOCOL LAB TELEMETRY] ==='), 'Telemetry header present');
  assert(formattedTelemetry.includes('OSPF Adjacency & MTU Mismatch'), 'Telemetry includes scenario title');
  assert(formattedTelemetry.includes('OSPF | CCNA | Intermediate'), 'Telemetry includes protocol, cert, and difficulty');
  assert(formattedTelemetry.includes('Lab Objective: Diagnose MTU mismatch'), 'Telemetry includes objective');
  assert(formattedTelemetry.includes('Investigation Step: Step 2 of 4 - Verify MTU configuration'), 'Telemetry includes current step');
  assert(formattedTelemetry.includes('Objective Status: IN_PROGRESS (Fault unresolved)'), 'Telemetry flags in-progress status');
  assert(formattedTelemetry.includes('Active Inspection Node: R1-Edge (CLI Prompt: "R1-Edge#")'), 'Telemetry includes node and prompt');
  assert(formattedTelemetry.includes('R1-Edge# show ip ospf neighbor'), 'Telemetry renders recent CLI command');
  assert(formattedTelemetry.includes('[Output]: Neighbor 2.2.2.2 in EXSTART'), 'Telemetry renders CLI command output');
  assert(formattedTelemetry.includes('OSPF Neighbors: 1 neighbors (2.2.2.2:EXSTART)'), 'Telemetry renders OSPF table summary');
  assert(formattedTelemetry.includes('Routing Table: 3 routes'), 'Telemetry renders routing table summary');
  assert(formattedTelemetry.includes('CRITICAL MENTOR GUIDELINE'), 'Telemetry contains critical Socratic mentor instructions');

  // Solved state formatting
  const solvedLabContext: ActiveLabContext = {
    ...mockLabContext,
    isObjectiveSolved: true,
  };
  const solvedFormatted = formatLabTelemetryContext(solvedLabContext);
  assert(solvedFormatted.includes('Objective Status: SOLVED (Target achieved)'), 'Solved state formats correctly');

  // Output truncation test (>250 characters truncated with ...)
  const longOutputLabContext: ActiveLabContext = {
    ...mockLabContext,
    recentCliCommands: [
      {
        prompt: 'R1#',
        command: 'show tech-support',
        outputSummary: 'X'.repeat(400),
      },
    ],
  };
  const truncatedFormatted = formatLabTelemetryContext(longOutputLabContext);
  assert(truncatedFormatted.includes('...'), 'Overly long command outputs are safely truncated with ellipsis');
  assert(!truncatedFormatted.includes('X'.repeat(260)), 'Excess characters beyond boundary are pruned');

  // Empty commands handled gracefully
  const emptyCmdLabContext: ActiveLabContext = {
    ...mockLabContext,
    recentCliCommands: [],
    activeNodeTablesSummary: undefined,
  };
  const emptyFormatted = formatLabTelemetryContext(emptyCmdLabContext);
  assert(emptyFormatted.includes('(No CLI commands executed yet)'), 'Empty CLI command history handled cleanly');

  // 12.2 User Prompt & Tutor Prompt Assembly
  console.log('   Testing buildUserPrompt & buildTutorPrompt with Lab Telemetry:');
  const userPromptWithLab = buildUserPrompt({
    query: 'Analyze my last CLI output',
    labContext: mockLabContext,
  });
  assert(userPromptWithLab.includes('=== [ACTIVE PROTOCOL LAB TELEMETRY] ==='), 'User prompt integrates lab telemetry block');
  assert(userPromptWithLab.includes('<learner_query>'), 'User prompt wraps query in learner_query boundary');
  assert(userPromptWithLab.includes('Analyze my last CLI output'), 'User prompt includes raw query');

  const tutorPromptPackage = buildTutorPrompt({
    query: 'What is causing this protocol fault?',
    labContext: mockLabContext,
  });
  assert(tutorPromptPackage.systemPrompt.includes('SOCRATIC EXERCISE MODE'), 'buildTutorPrompt enables Socratic mode when lab is in-progress');
  assert(tutorPromptPackage.userPrompt.includes('=== [ACTIVE PROTOCOL LAB TELEMETRY] ==='), 'Tutor prompt package embeds telemetry in userPrompt');

  // 12.3 AI Tutor Route with labContext Telemetry
  console.log('   Testing /api/ai/tutor Integration with Lab Telemetry:');
  const { token: testTutorToken, payload: testTutorPayload } = createSignedSessionToken('user-sim-student', 'user');
  __setTestMockStore({
    validateDbSession: async (sessionId: string) => {
      if (sessionId === testTutorPayload.jti) {
        return {
          valid: true,
          userId: 'user-sim-student',
          currentRole: 'user',
          userStatus: 'active',
        };
      }
      return { valid: false };
    },
  });

  const { req: labTutorReq, res: labTutorRes } = createMockReqRes({
    method: 'POST',
    url: '/api/ai/tutor',
    headers: {
      cookie: `netmentor_session=${testTutorToken}`,
      'x-netmentor-request': '1',
    },
    body: {
      query: 'Analyze my last CLI output',
      labContext: mockLabContext,
    },
  });
  await tutorHandler(labTutorReq, labTutorRes);
  assert(labTutorRes.getStatus() === 200, 'POST /api/ai/tutor with labContext returned HTTP 200 OK');
  const tutorData = labTutorRes.getData();
  assert(tutorData?.success === true, 'Tutor response success is true');
  assert(tutorData?.labContext?.scenarioId === 'ospf-adjacency-mtu', 'Response echoes back labContext scenarioId');
  assert(tutorData?.labContext?.isObjectiveSolved === false, 'Response echoes back isObjectiveSolved');
  assert(
    Boolean(
      tutorData?.answer &&
        (tutorData.answer.includes('EXSTART') ||
         tutorData.answer.includes('Live CLI Telemetry Analysis') ||
         tutorData.answer.includes('show ip ospf neighbor'))
    ),
    'Tutor returns CLI-grounded telemetry analysis'
  );

  // Test Socratic prompt chip
  const { req: socraticChipReq, res: socraticChipRes } = createMockReqRes({
    method: 'POST',
    url: '/api/ai/tutor',
    headers: {
      cookie: `netmentor_session=${testTutorToken}`,
      'x-netmentor-request': '1',
    },
    body: {
      query: 'Give me a Socratic hint (no spoilers)',
      mode: 'socratic_hint',
      labContext: mockLabContext,
    },
  });
  await tutorHandler(socraticChipReq, socraticChipRes);
  assert(socraticChipRes.getStatus() === 200, 'Socratic hint request with labContext returns HTTP 200');
  assert(
    Boolean(
      socraticChipRes.getData()?.answer &&
        (socraticChipRes.getData().answer.includes('Socratic') ||
         socraticChipRes.getData().answer.includes('MTU') ||
         socraticChipRes.getData().answer.includes('EXSTART') ||
         socraticChipRes.getData().answer.includes('neighbor') ||
         socraticChipRes.getData().answer.includes('discrepanc'))
    ),
    'Socratic hint returns guided inquiry response'
  );

  // Test malformed labContext (missing scenarioId) returns 400
  const { req: badLabReq, res: badLabRes } = createMockReqRes({
    method: 'POST',
    url: '/api/ai/tutor',
    headers: {
      cookie: `netmentor_session=${testTutorToken}`,
      'x-netmentor-request': '1',
    },
    body: {
      query: 'What is this?',
      labContext: {
        title: 'Broken Context',
      },
    },
  });
  await tutorHandler(badLabReq, badLabRes);
  assert(badLabRes.getStatus() === 400, 'POST /api/ai/tutor with malformed labContext returns HTTP 400');

  __setTestMockStore(null);


  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} PROTOCOL SIMULATION CHECKS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================');
}

runProtocolSimulationTests().catch((err) => {
  console.error('\n❌ Protocol simulation test suite failed:', err);
  process.exit(1);
});
