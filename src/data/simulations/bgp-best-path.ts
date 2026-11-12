import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';

/**
 * Scenario: CCNP ENCOR BGP eBGP Peering Session & Best-Path Selection
 * Demonstrates:
 * 1. TCP port 179 transport session initiation and BGP FSM state transitions (Idle -> Connect -> OpenSent).
 * 2. BGP OPEN message exchange, hold time negotiation (180s), and capability negotiation.
 * 3. BGP KEEPALIVE exchange and transition to Established peering state.
 * 4. BGP UPDATE advertisement from ISP-A for prefix 203.0.113.0/24 (AS_PATH: 65100 65900, MED: 100).
 * 5. Competing BGP UPDATE from ISP-B for prefix 203.0.113.0/24 (AS_PATH: 65200, MED: 200).
 * 6. Deterministic BGP Best-Path Selection algorithm: Shorter AS-Path (1 hop vs 2 hops) wins
 *    before MED is ever evaluated, converging R1-Edge routing table to ISP-B.
 */
export const BGP_BEST_PATH_SCENARIO: ProtocolSimulationScenario = {
  metadata: {
    id: 'bgp-best-path-selection',
    title: 'BGP eBGP Peering & Best-Path Selection (Shortest AS-Path)',
    certification: 'CCNP',
    protocol: 'BGP',
    difficulty: 'Advanced',
    description:
      'Step-by-step interactive protocol packet walk analyzing eBGP peering session establishment over TCP port 179, BGP Finite State Machine transitions, attribute exchange, and deterministic BGP best-path decision tie-breaking based on shortest AS-Path.',
    keyConcepts: [
      'BGP Finite State Machine (FSM): Idle -> Connect -> OpenSent -> OpenConfirm -> Established',
      'TCP Port 179 Transport Peering & Single-Hop eBGP (TTL=1)',
      'BGP Path Attributes: ORIGIN, AS_PATH, NEXT_HOP, LOCAL_PREF, MED',
      'Deterministic Best-Path Selection Hierarchy (Weight -> LocalPref -> AS_PATH -> Origin -> MED)',
      'Autonomous System Path Loop Prevention & Length Comparison',
      'External eBGP Peering vs Internal iBGP Attribute Propagation',
    ],
  },
  topology: {
    nodes: [
      {
        id: 'r1-edge',
        name: 'R1-Edge (AS 65001)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/1',
            ip: '172.16.1.1',
            mac: '00:1A:2B:3C:4D:R1',
            subnetMask: '255.255.255.252',
          },
          {
            name: 'Gi0/2',
            ip: '172.16.2.1',
            mac: '00:1A:2B:3C:4D:R2',
            subnetMask: '255.255.255.252',
          },
          {
            name: 'Lo0',
            ip: '10.1.1.1',
            mac: '00:1A:2B:3C:4D:L0',
            subnetMask: '255.255.255.255',
          },
        ],
        tableState: {
          tcpState: 'IDLE',
          routingTable: [
            {
              network: '172.16.1.0',
              mask: '255.255.255.252',
              interface: 'Gi0/1',
              protocol: 'C',
            },
            {
              network: '172.16.2.0',
              mask: '255.255.255.252',
              interface: 'Gi0/2',
              protocol: 'C',
            },
            {
              network: '10.1.1.1',
              mask: '255.255.255.255',
              interface: 'Lo0',
              protocol: 'C',
            },
          ],
          arpCache: [
            {
              ip: '172.16.1.2',
              mac: '00:1A:2B:3C:4D:IA',
              interface: 'Gi0/1',
            },
            {
              ip: '172.16.2.2',
              mac: '00:1A:2B:3C:4D:IB',
              interface: 'Gi0/2',
            },
          ],
        },
        position: { x: 240, y: 150 },
      },
      {
        id: 'isp-a',
        name: 'ISP-A (AS 65100)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/0',
            ip: '172.16.1.2',
            mac: '00:1A:2B:3C:4D:IA',
            subnetMask: '255.255.255.252',
          },
          {
            name: 'Gi0/1',
            ip: '203.0.113.1',
            mac: '00:1A:2B:3C:4D:I1',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          tcpState: 'LISTEN',
          routingTable: [
            {
              network: '172.16.1.0',
              mask: '255.255.255.252',
              interface: 'Gi0/0',
              protocol: 'C',
            },
            {
              network: '203.0.113.0',
              mask: '255.255.255.0',
              interface: 'Gi0/1',
              protocol: 'S',
            },
          ],
          arpCache: [
            {
              ip: '172.16.1.1',
              mac: '00:1A:2B:3C:4D:R1',
              interface: 'Gi0/0',
            },
          ],
        },
        position: { x: 60, y: 150 },
      },
      {
        id: 'isp-b',
        name: 'ISP-B (AS 65200)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/0',
            ip: '172.16.2.2',
            mac: '00:1A:2B:3C:4D:IB',
            subnetMask: '255.255.255.252',
          },
          {
            name: 'Gi0/1',
            ip: '203.0.113.2',
            mac: '00:1A:2B:3C:4D:I2',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          tcpState: 'LISTEN',
          routingTable: [
            {
              network: '172.16.2.0',
              mask: '255.255.255.252',
              interface: 'Gi0/0',
              protocol: 'C',
            },
            {
              network: '203.0.113.0',
              mask: '255.255.255.0',
              interface: 'Gi0/1',
              protocol: 'S',
            },
          ],
          arpCache: [
            {
              ip: '172.16.2.1',
              mac: '00:1A:2B:3C:4D:R2',
              interface: 'Gi0/0',
            },
          ],
        },
        position: { x: 420, y: 150 },
      },
    ],
    links: [
      {
        id: 'link-r1-ispa',
        sourceNodeId: 'r1-edge',
        targetNodeId: 'isp-a',
        linkSpeed: '1 Gbps',
        label: 'Gi0/1 <-> Gi0/0 (172.16.1.0/30 eBGP)',
      },
      {
        id: 'link-r1-ispb',
        sourceNodeId: 'r1-edge',
        targetNodeId: 'isp-b',
        linkSpeed: '1 Gbps',
        label: 'Gi0/2 <-> Gi0/0 (172.16.2.0/30 eBGP)',
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
      title: 'Step 1: TCP Port 179 Transport Initiation (Idle -> Connect -> OpenSent)',
      explanation:
        'R1-Edge (AS 65001) initiates an eBGP transport peering session to upstream transit provider ISP-A (AS 65100) at 172.16.1.2. Because BGP lacks its own reliable transport protocol, it utilizes TCP port 179. R1-Edge dispatches a TCP SYN segment from ephemeral port 49152 to well-known destination port 179 with IP TTL=1 (standard single-hop eBGP). The BGP Finite State Machine on R1-Edge progresses from Idle through Connect into OpenSent.',
      activeNodeId: 'r1-edge',
      targetNodeId: 'isp-a',
      transmission: {
        fromNodeId: 'r1-edge',
        toNodeId: 'isp-a',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R1',
            dstMac: '00:1A:2B:3C:4D:IA',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.1.1',
            dstIp: '172.16.1.2',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 179,
            flags: { syn: true },
            seqNumber: 1000,
            ackNumber: 0,
            windowSize: 65535,
          },
          payloadDescription: 'TCP SYN: Transport Session Initiation for BGP Peering (dstPort: 179, IP TTL: 1)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'r1-edge',
          table: 'tcp',
          action: 'update',
          data: { state: 'OPENSENT' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why does BGP rely on TCP port 179 as its underlying transport layer, unlike OSPF (protocol 89) or EIGRP (protocol 88)?',
        hint:
          'Consider BGP\'s role as an inter-domain exterior gateway protocol across heterogeneous WAN networks and AS boundaries where packet fragmentation, retransmission, windowing, and sequence ordering cannot rely on link-local multicast.',
        expectedConcept:
          'BGP relies on TCP (port 179) for reliable connection-oriented transport, eliminating the need to implement proprietary retransmission, sequencing, and error-recovery mechanisms over multi-hop autonomous system paths.',
      },
    },
    {
      stepIndex: 1,
      title: 'Step 2: BGP OPEN & Capability Negotiation (OpenConfirm State)',
      explanation:
        'ISP-A (AS 65100) accepts the TCP connection and responds with a BGP OPEN message containing its BGP Version (4), Autonomous System Number (65100), negotiated Hold Time (180s), and BGP Router Identifier (198.51.100.1). ISP-A also negotiates Optional Capabilities including Multiprotocol Extensions (RFC 4760 for IPv4 Unicast) and 4-Byte ASN support (RFC 6793). Upon processing valid parameters, R1-Edge transitions its FSM to OpenConfirm.',
      activeNodeId: 'isp-a',
      targetNodeId: 'r1-edge',
      transmission: {
        fromNodeId: 'isp-a',
        toNodeId: 'r1-edge',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:IA',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.1.2',
            dstIp: '172.16.1.1',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 179,
            dstPort: 49152,
            flags: { ack: true, psh: true },
            seqNumber: 2000,
            ackNumber: 1001,
            windowSize: 65535,
          },
          payloadDescription:
            'BGP OPEN: Version 4, AS 65100, HoldTime 180s, BGP-ID 198.51.100.1, Capabilities (MP-BGP IPv4, 4-Byte ASN)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'r1-edge',
          table: 'tcp',
          action: 'update',
          data: { state: 'OPENCONFIRM' },
        },
        {
          nodeId: 'isp-a',
          table: 'tcp',
          action: 'update',
          data: { state: 'OPENCONFIRM' },
        },
      ],
      socraticCheckpoint: {
        question:
          'What is the relationship between the BGP Hold Timer (typically 180 seconds) and the BGP Keepalive interval (typically 60 seconds), and how do peers agree on the timer value?',
        hint:
          'Review RFC 4271: Each peer proposes a Hold Time in its OPEN message. The two routers negotiate by choosing the smaller value, and Keepalives are dispatched at one-third of that agreed interval.',
        expectedConcept:
          'BGP peers negotiate the Hold Timer by adopting the smaller of the two proposed values, and Keepalive messages are periodically transmitted at 1/3 of the negotiated Hold Time (default 60s/180s) to maintain session liveness.',
      },
    },
    {
      stepIndex: 2,
      title: 'Step 3: BGP KEEPALIVE & Peering Established State',
      explanation:
        'Having validated ISP-A\'s OPEN parameters, R1-Edge dispatches a BGP KEEPALIVE message consisting of a minimal 19-byte header (16-byte 0xFF marker, 2-byte length of 19, and 1-byte message type 4). The receipt and exchange of KEEPALIVE messages acknowledge the negotiated session parameters, completing the BGP Finite State Machine transition to the Established state. The eBGP peers can now exchange Network Layer Reachability Information (NLRI).',
      activeNodeId: 'r1-edge',
      targetNodeId: 'isp-a',
      transmission: {
        fromNodeId: 'r1-edge',
        toNodeId: 'isp-a',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R1',
            dstMac: '00:1A:2B:3C:4D:IA',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.1.1',
            dstIp: '172.16.1.2',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 179,
            flags: { ack: true },
            seqNumber: 1030,
            ackNumber: 2035,
            windowSize: 65535,
          },
          payloadDescription: 'BGP KEEPALIVE: 19-Byte Header (Marker 16-Bytes [0xFF*16] + Length 19 + Type 4 [Keepalive])',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'r1-edge',
          table: 'tcp',
          action: 'update',
          data: { state: 'ESTABLISHED' },
        },
        {
          nodeId: 'isp-a',
          table: 'tcp',
          action: 'update',
          data: { state: 'ESTABLISHED' },
        },
      ],
    },
    {
      stepIndex: 3,
      title: 'Step 4: BGP UPDATE from ISP-A (NLRI 203.0.113.0/24 with AS-Path 65100 65900)',
      explanation:
        'ISP-A transmits a BGP UPDATE message advertising destination prefix 203.0.113.0/24. The update includes mandatory path attributes: ORIGIN (IGP), AS_PATH (65100 65900 — length 2), NEXT_HOP (172.16.1.2), and Multi-Exit Discriminator (MED 100). As this is the first and only route received for 203.0.113.0/24, R1-Edge installs it into its BGP Routing Information Base (Adj-RIB-In -> Loc-RIB) and activates it in the global IPv4 Routing Table with protocol "B" (eBGP Administrative Distance 20).',
      activeNodeId: 'isp-a',
      targetNodeId: 'r1-edge',
      transmission: {
        fromNodeId: 'isp-a',
        toNodeId: 'r1-edge',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:IA',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.1.2',
            dstIp: '172.16.1.1',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 179,
            dstPort: 49152,
            flags: { ack: true, psh: true },
            seqNumber: 2035,
            ackNumber: 1049,
            windowSize: 65535,
          },
          payloadDescription:
            'BGP UPDATE: NLRI 203.0.113.0/24 | ORIGIN: IGP | AS_PATH: [65100, 65900] | NEXT_HOP: 172.16.1.2 | MED: 100',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'r1-edge',
          table: 'routing',
          action: 'add',
          data: {
            network: '203.0.113.0',
            mask: '255.255.255.0',
            nextHop: '172.16.1.2',
            interface: 'Gi0/1',
            protocol: 'B',
            metric: 100,
            adminDistance: 20,
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why is the LOCAL_PREF attribute stripped or omitted when advertising BGP routes to external eBGP peers, even though it is evaluated before AS_PATH in best-path selection?',
        hint:
          'Local Preference is a well-known discretionary attribute defined strictly for internal Autonomous System scope. Consider what would happen to AS sovereignty if upstream transit providers could dictate internal routing preferences.',
        expectedConcept:
          'LOCAL_PREF is an AS-internal attribute used to influence outbound traffic within a single AS. Transmitting it across eBGP boundaries would violate autonomous administrative domain sovereignty.',
      },
    },
    {
      stepIndex: 4,
      title: 'Step 5: Competing BGP UPDATE from ISP-B (Shorter AS-Path 65200)',
      explanation:
        'Secondary upstream provider ISP-B (AS 65200) dispatches a competing BGP UPDATE advertising the identical destination prefix 203.0.113.0/24 over peering link 172.16.2.0/30. Path attributes in ISP-B\'s advertisement: ORIGIN (IGP), AS_PATH (65200 — length 1), NEXT_HOP (172.16.2.2), and MED (200). R1-Edge stores this candidate path into its BGP Loc-RIB alongside ISP-A\'s advertisement, triggering the BGP Best-Path decision algorithm to select the active forwarding path.',
      activeNodeId: 'isp-b',
      targetNodeId: 'r1-edge',
      transmission: {
        fromNodeId: 'isp-b',
        toNodeId: 'r1-edge',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:IB',
            dstMac: '00:1A:2B:3C:4D:R2',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.2.2',
            dstIp: '172.16.2.1',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 179,
            dstPort: 49153,
            flags: { ack: true, psh: true },
            seqNumber: 3000,
            ackNumber: 1001,
            windowSize: 65535,
          },
          payloadDescription:
            'BGP UPDATE: NLRI 203.0.113.0/24 | ORIGIN: IGP | AS_PATH: [65200] | NEXT_HOP: 172.16.2.2 | MED: 200',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'isp-b',
          table: 'tcp',
          action: 'update',
          data: { state: 'ESTABLISHED' },
        },
      ],
    },
    {
      stepIndex: 5,
      title: 'Step 6: BGP Best-Path Decision (Shortest AS-Path: 1 vs 2 Hops Beats Lower MED)',
      explanation:
        'R1-Edge executes the deterministic BGP Best-Path Selection algorithm: 1) Weight is equal (0); 2) Local Preference is equal (default 100); 3) Neither route was locally generated via network or aggregate-address command; 4) AS_PATH comparison: ISP-B path [65200] has length 1, while ISP-A path [65100, 65900] has length 2. Because shorter AS_PATH strictly takes precedence over subsequent tie-breakers, ISP-B wins immediately — ISP-A\'s lower MED (100 vs 200) is never evaluated! R1-Edge updates its active IPv4 Routing Table next-hop to 172.16.2.2 via Gi0/2.',
      activeNodeId: 'r1-edge',
      targetNodeId: 'isp-b',
      transmission: {
        fromNodeId: 'r1-edge',
        toNodeId: 'isp-b',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R2',
            dstMac: '00:1A:2B:3C:4D:IB',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '172.16.2.1',
            dstIp: '172.16.2.2',
            protocol: 'TCP (6)',
            ttl: 1,
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49153,
            dstPort: 179,
            flags: { ack: true },
            seqNumber: 1001,
            ackNumber: 3050,
            windowSize: 65535,
          },
          payloadDescription:
            'BGP Best-Path Selection: Route to 203.0.113.0/24 Converged via ISP-B (Shorter AS-Path [65200])',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'r1-edge',
          table: 'routing',
          action: 'update',
          data: {
            network: '203.0.113.0',
            mask: '255.255.255.0',
            nextHop: '172.16.2.2',
            interface: 'Gi0/2',
            protocol: 'B',
            metric: 200,
            adminDistance: 20,
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What is the exact deterministic hierarchy of the BGP Best-Path Selection algorithm, and why did ISP-B win over ISP-A despite ISP-A having a lower MED (100 vs 200)?',
        hint:
          'Recall the Cisco mnemonic "We Love Oranges AS-path OR DIE" (Weight -> Local Pref -> Locally Originated -> AS-Path -> Origin -> MED -> eBGP over iBGP -> IGP Metric -> Router ID). MED is evaluated only AFTER AS-Path.',
        expectedConcept:
          'The BGP best-path algorithm evaluates AS_PATH length before MED; because ISP-B has a shorter AS_PATH ([65200] length 1 vs [65100, 65900] length 2), it is chosen unconditionally before MED (100 vs 200) is ever compared.',
      },
    },
  ],
  cliConfig: {
    protocolScope: 'BGP',
    targetNodeId: 'r1-edge',
    promptHostname: 'R1-Edge#',
    objective:
      'Evaluate BGP best-path criteria on R1-Edge for prefix 203.0.113.0/24 and verify ISP-B is selected via shortest AS-Path length.',
    initialConfigLines: [
      'router bgp 65001',
      ' bgp router-id 10.1.1.1',
      ' neighbor 172.16.1.2 remote-as 65100',
      ' neighbor 172.16.1.2 description Upstream-ISP-A',
      ' neighbor 172.16.2.2 remote-as 65200',
      ' neighbor 172.16.2.2 description Secondary-ISP-B',
    ],
    allowedCommands: [
      {
        command: 'show ip bgp summary',
        aliases: ['sh ip bgp summary', 'sh ip bgp sum', 'show ip bgp sum'],
        description: 'Display BGP neighbor states, AS numbers, and prefix counters',
        output:
          'BGP router identifier 10.1.1.1, local AS number 65001\nBGP table version is 3, main routing table version 3\n\nNeighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n172.16.1.2      4        65100       8       8        3    0    0 00:04:12        1\n172.16.2.2      4        65200       8       8        3    0    0 00:04:15        1',
      },
      {
        command: 'show ip bgp',
        aliases: ['sh ip bgp', 'show ip bgp 203.0.113.0/24', 'sh ip bgp 203.0.113.0'],
        description: 'Display the BGP routing table and best-path selection (*>)',
        output:
          'BGP table version is 3, local router ID is 10.1.1.1\nStatus codes: s suppressed, d damped, h history, * valid, > best, i - internal\n\n     Network          Next Hop            Metric LocPrf Weight Path\n *   203.0.113.0/24   172.16.1.2             100             0 65100 65900 i\n *>                   172.16.2.2             200             0 65200 i\n\n%BGP-5-BESTPATH: 203.0.113.0/24 best path selected via 172.16.2.2 (AS-Path length: 1 vs 2)',
      },
      {
        command: 'show ip route bgp',
        aliases: ['sh ip route bgp', 'sh ip ro bgp', 'show ip ro bgp'],
        description: 'Verify which BGP route is installed in the IPv4 FIB',
        output:
          'Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP\n       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n\nGateway of last resort is not set\n\nB        203.0.113.0/24 [20/200] via 172.16.2.2, 00:03:45, GigabitEthernet0/2',
      },
      {
        command: 'show ip bgp 203.0.113.0',
        aliases: [
          'sh ip bgp 203.0.113.0/24',
          'show ip bgp 203.0.113.0 255.255.255.0',
          'verify bestpath',
        ],
        description: 'Inspect detailed BGP attribute comparison and tie-breaker decision',
        output:
          'BGP routing table entry for 203.0.113.0/24, version 3\nPaths: (2 available, best #2, table default)\n  Advertised to non-peer-group peers:\n    172.16.1.2 172.16.2.2\n  65100 65900\n    172.16.1.2 from 172.16.1.2 (198.51.100.1)\n      Origin IGP, metric 100, localpref 100, valid, external\n  65200\n    172.16.2.2 from 172.16.2.2 (198.51.100.2)\n      Origin IGP, metric 200, localpref 100, valid, external, best\n      Selection reason: Shorter AS-Path length (1 vs 2)',
        goalAchieved: true,
      },
    ],
  },
};
