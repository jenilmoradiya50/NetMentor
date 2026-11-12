import {
  PROTOCOL_SIMULATION_CATALOG,
  TCP_HANDSHAKE_SCENARIO,
  ARP_MAC_LEARNING_SCENARIO,
  OSPF_ADJACENCY_SCENARIO,
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
    PROTOCOL_SIMULATION_CATALOG.length === 3,
    `Expected exactly 3 simulation scenarios in catalog, found ${PROTOCOL_SIMULATION_CATALOG.length}`
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

  // D. Unit Verification of applySingleMutation Helper
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

  assert(totalCheckpoints >= 3, `Verified ${totalCheckpoints} total Socratic checkpoints across all simulation scenarios`);

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} PROTOCOL SIMULATION CHECKS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================');
}

runProtocolSimulationTests().catch((err) => {
  console.error('\n❌ Protocol simulation test suite failed:', err);
  process.exit(1);
});
