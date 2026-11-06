import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';

/**
 * Scenario: OSPF 7-State Formation & MTU Mismatch Failure Branch
 * Demonstrates OSPF Hello neighbor discovery, 2-Way bidirectional confirmation,
 * Master/Slave Database Description (DBD) negotiation, and the classic EXSTART stall caused by an MTU mismatch.
 */
export const OSPF_ADJACENCY_SCENARIO: ProtocolSimulationScenario = {
  metadata: {
    id: 'ospf-adjacency-mtu',
    title: 'OSPF 7-State Formation & MTU Mismatch Stalled Adjacency',
    certification: 'CCNA',
    protocol: 'OSPF',
    difficulty: 'Intermediate',
    description:
      'Trace OSPF neighbor state machine progression from Down -> Init -> 2-Way -> ExStart, and diagnose why neighbor adjacencies hang at EXSTART when interface Maximum Transmission Units (MTUs) diverge.',
    keyConcepts: [
      'OSPF 7-State Finite State Machine (FSM)',
      'AllSPFRouters Multicast (224.0.0.5)',
      'Router ID (RID) & 2-Way Communication',
      'Database Description (DBD) Master/Slave Election',
      'Interface MTU Verification & EXSTART Hangs',
      'Cisco IOS "ip ospf mtu-ignore" Troubleshooting',
    ],
  },
  topology: {
    nodes: [
      {
        id: 'router-1',
        name: 'R1-HQ (Core Router)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/0',
            ip: '10.0.0.1',
            mac: '00:1A:2B:3C:4D:R1',
            subnetMask: '255.255.255.252',
          },
        ],
        tableState: {
          ospfNeighbors: [],
          routingTable: [
            {
              network: '10.0.0.0',
              mask: '255.255.255.252',
              interface: 'Gi0/0',
              protocol: 'C',
            },
          ],
          routerId: '1.1.1.1',
          mtu: 1500,
        },
        position: { x: 100, y: 150 },
      },
      {
        id: 'router-2',
        name: 'R2-Branch (Mismatched MTU)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/0',
            ip: '10.0.0.2',
            mac: '00:1A:2B:3C:4D:R2',
            subnetMask: '255.255.255.252',
          },
        ],
        tableState: {
          ospfNeighbors: [],
          routingTable: [
            {
              network: '10.0.0.0',
              mask: '255.255.255.252',
              interface: 'Gi0/0',
              protocol: 'C',
            },
          ],
          routerId: '2.2.2.2',
          mtu: 1400,
        },
        position: { x: 380, y: 150 },
      },
    ],
    links: [
      {
        id: 'link-r1-r2',
        sourceNodeId: 'router-1',
        targetNodeId: 'router-2',
        linkSpeed: '1 Gbps',
        label: 'Gi0/0 <-> Gi0/0 (Point-to-Point)',
      },
    ],
  },
  defaultViewport: {
    zoom: 1,
    centerX: 240,
    centerY: 150,
  },
  steps: [
    {
      stepIndex: 0,
      title: '1. Down State -> R1 Transmits OSPF Hello Multicast',
      explanation:
        'Both routers begin in DOWN state. When OSPF is enabled on Gi0/0, R1 sends an initial OSPF Hello packet to the AllSPFRouters multicast address (224.0.0.5, MAC 01:00:5E:00:00:05). The Hello advertises R1\'s Router ID (1.1.1.1), Area 0, Hello Interval (10s), Dead Interval (40s), and an empty neighbor list.',
      activeNodeId: 'router-1',
      targetNodeId: 'router-2',
      transmission: {
        fromNodeId: 'router-1',
        toNodeId: 'router-2',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R1',
            dstMac: '01:00:5E:00:00:05',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '10.0.0.1',
            dstIp: '224.0.0.5',
            protocol: 'OSPF (89)',
            ttl: 1,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'OSPF',
            ospfType: 'Hello (Type 1)',
            srcPort: 89,
            dstPort: 89,
          },
          payloadDescription:
            'OSPFv2 Hello: RID=1.1.1.1 Area=0 Mask=255.255.255.252 Hello=10 Dead=40 Neighbors=[]',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-1',
          table: 'ospf',
          action: 'add',
          data: {
            neighborId: '2.2.2.2',
            priority: 1,
            state: 'DOWN',
            address: '10.0.0.2',
            interface: 'Gi0/0',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What parameters inside an OSPF Hello packet must match exactly between two routers for an adjacency to form?',
        hint: 'Think about timers, subnet boundaries, and structural areas.',
        expectedConcept:
          'Primary subnet mask, Area ID, Hello and Dead intervals, authentication, and stub area flags must match identically.',
      },
    },
    {
      stepIndex: 1,
      title: '2. Init State -> R2 Processes Hello & Replies with R1 Listed',
      explanation:
        'R2 receives R1\'s Hello. Because R2\'s own RID (2.2.2.2) is NOT listed in the neighbor field of the packet, R2 transitions the relationship to INIT state. R2 then transmits its own Hello packet to 224.0.0.5, explicitly listing R1 (1.1.1.1) in its Active Neighbors list.',
      activeNodeId: 'router-2',
      targetNodeId: 'router-1',
      transmission: {
        fromNodeId: 'router-2',
        toNodeId: 'router-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R2',
            dstMac: '01:00:5E:00:00:05',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '10.0.0.2',
            dstIp: '224.0.0.5',
            protocol: 'OSPF (89)',
            ttl: 1,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'OSPF',
            ospfType: 'Hello (Type 1)',
            srcPort: 89,
            dstPort: 89,
          },
          payloadDescription:
            'OSPFv2 Hello: RID=2.2.2.2 Area=0 Mask=255.255.255.252 Hello=10 Dead=40 ActiveNeighbors=[1.1.1.1]',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-2',
          table: 'ospf',
          action: 'add',
          data: {
            neighborId: '1.1.1.1',
            priority: 1,
            state: 'INIT',
            address: '10.0.0.1',
            interface: 'Gi0/0',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why does R2 transition to INIT upon seeing R1\'s Hello, rather than immediately going to 2-WAY?',
        hint: 'How does R2 know whether R1 has actually seen R2\'s packets?',
        expectedConcept:
          'INIT means one-way communication is confirmed; 2-WAY requires bidirectional confirmation (seeing your own RID listed in the peer\'s Hello).',
      },
    },
    {
      stepIndex: 2,
      title: '3. 2-Way State -> Bidirectional Adjacency Confirmed',
      explanation:
        'R1 receives R2\'s Hello and spots its own RID (1.1.1.1) in the Active Neighbors list. Bidirectional communication is now proven: both routers transition the adjacency to 2-WAY. On this point-to-point network link, Designated Router (DR/BDR) election is bypassed, and both routers prepare for database synchronization.',
      activeNodeId: 'router-1',
      targetNodeId: 'router-2',
      transmission: {
        fromNodeId: 'router-1',
        toNodeId: 'router-2',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R1',
            dstMac: '01:00:5E:00:00:05',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '10.0.0.1',
            dstIp: '224.0.0.5',
            protocol: 'OSPF (89)',
            ttl: 1,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'OSPF',
            ospfType: 'Hello (Type 1)',
            srcPort: 89,
            dstPort: 89,
          },
          payloadDescription:
            'OSPFv2 Hello: RID=1.1.1.1 Area=0 Neighbors=[2.2.2.2] (2-Way Confirmed)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-1',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '2.2.2.2', state: '2-WAY' },
        },
        {
          nodeId: 'router-2',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '1.1.1.1', state: '2-WAY' },
        },
      ],
      socraticCheckpoint: {
        question:
          'On a multi-access broadcast network (e.g. Ethernet switch), which routers reach FULL state versus remaining in 2-WAY?',
        hint: 'Consider the role of DROTHERs.',
        expectedConcept:
          'Routers form FULL adjacencies only with the DR and BDR; adjacencies between two DROTHER routers stay in 2-WAY permanently to conserve link-state flooding overhead.',
      },
    },
    {
      stepIndex: 3,
      title: '4. ExStart State -> Master/Slave Negotiation & MTU Exchange',
      explanation:
        'Both routers transition to EXSTART to negotiate who will be Master during Link State Database (LSDB) synchronization. R1 transmits an empty Database Description (DBD) with flags Init (I), More (M), and Master (MS) set, claiming Master with sequence 7001. Crucially, R1 inserts its interface MTU (1500 bytes) into the DBD header.',
      activeNodeId: 'router-1',
      targetNodeId: 'router-2',
      transmission: {
        fromNodeId: 'router-1',
        toNodeId: 'router-2',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R1',
            dstMac: '00:1A:2B:3C:4D:R2',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '10.0.0.1',
            dstIp: '10.0.0.2',
            protocol: 'OSPF (89)',
            ttl: 1,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'OSPF',
            ospfType: 'DBD (Type 2)',
            srcPort: 89,
            dstPort: 89,
            seqNumber: 7001,
          },
          payloadDescription:
            'OSPFv2 DBD: Flags [I, M, MS] Interface MTU=1500 Seq=7001 (R1 claiming Master)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-1',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '2.2.2.2', state: 'EXSTART' },
        },
        {
          nodeId: 'router-2',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '1.1.1.1', state: 'EXSTART' },
        },
      ],
    },
    {
      stepIndex: 4,
      title: '5. MTU Mismatch Drop -> Adjacency Stalls in EXSTART',
      explanation:
        'R2 receives R1\'s DBD advertising MTU 1500. R2 compares this to its local interface MTU (1400). According to RFC 2328 section 10.6, because the neighbor\'s MTU exceeds the local interface MTU, R2 drops the DBD packet! R2 cannot acknowledge R1\'s DBD, and Master/Slave negotiation cannot complete. The neighbor adjacency is permanently stalled in EXSTART.',
      activeNodeId: 'router-2',
      targetNodeId: 'router-1',
      transmission: {
        fromNodeId: 'router-2',
        toNodeId: 'router-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R2',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '10.0.0.2',
            dstIp: '10.0.0.1',
            protocol: 'OSPF (89)',
            ttl: 1,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'OSPF',
            ospfType: 'DBD (Type 2)',
            srcPort: 89,
            dstPort: 89,
            seqNumber: 9001,
          },
          payloadDescription:
            'OSPFv2 DBD: Flags [I, M, MS] Interface MTU=1400 (R2 Drops R1 DBD: MTU 1500 > 1400)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-1',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '2.2.2.2', state: 'EXSTART (STALLED)' },
        },
        {
          nodeId: 'router-2',
          table: 'ospf',
          action: 'update',
          data: { neighborId: '1.1.1.1', state: 'EXSTART (MTU MISMATCH)' },
        },
      ],
      socraticCheckpoint: {
        question:
          'When troubleshooting an OSPF neighbor relationship stuck in EXSTART, why does this occur, and what Cisco IOS interface command can resolve it without changing the physical MTU?',
        hint: 'Look at the MTU value in the DBD packet header and think about OSPF interface commands.',
        expectedConcept:
          'An MTU mismatch causes the router with the lower MTU to drop incoming DBDs from the router with the higher MTU. The command "ip ospf mtu-ignore" under the interface disables this check.',
      },
    },
  ],
};
