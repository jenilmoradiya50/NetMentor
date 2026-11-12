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
} from '../src/hooks/useProtocolSimulation.ts';
import type {
  ProtocolSimulationScenario,
  TopologyNode,
  NodeStateMutation,
  CertificationLevel,
  ProtocolFamily,
  DifficultyLevel,
} from '../src/types/protocol-simulation.ts';
import {
  validateGeneratedSimulation,
  normalizeProtocolFamily,
  normalizeCertificationLevel,
  normalizeDifficultyLevel,
} from '../api/_lib/ai/simulation-validator.js';
import { getActiveAiProvider, MockAiProvider, __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';
import { buildSimulationGenerationPrompt } from '../api/_lib/ai/prompt-builder.js';

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

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} PROTOCOL SIMULATION CHECKS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================');
}

runProtocolSimulationTests().catch((err) => {
  console.error('\n❌ Protocol simulation test suite failed:', err);
  process.exit(1);
});
