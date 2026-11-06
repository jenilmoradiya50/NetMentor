import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';

/**
 * Scenario: Address Resolution Protocol (ARP) & Layer 2 Switch CAM Learning
 * Demonstrates ARP broadcast discovery, switch dynamic MAC table learning,
 * unicast reply forwarding, and ARP cache population.
 */
export const ARP_MAC_LEARNING_SCENARIO: ProtocolSimulationScenario = {
  metadata: {
    id: 'arp-mac-learning',
    title: 'ARP Resolution & Switch Dynamic MAC Learning',
    certification: 'CCNA',
    protocol: 'ARP',
    difficulty: 'Beginner',
    description:
      'Step-by-step trace of how hosts resolve unknown Layer 2 MAC addresses via ARP broadcast requests, how switches learn source MACs and flood unknown frames, and how unicast ARP replies eliminate broadcast radiation.',
    keyConcepts: [
      'Address Resolution Protocol (ARP)',
      'Layer 2 Broadcasts (FF:FF:FF:FF:FF:FF)',
      'Switch CAM / MAC Address Table Learning',
      'Frame Flooding vs. Filtering vs. Forwarding',
      'ARP Cache Population & Poisoning Defense',
    ],
  },
  topology: {
    nodes: [
      {
        id: 'host-a',
        name: 'PC-A (Source Host)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.1.10',
            mac: '00:1A:2B:3C:4D:0A',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          arpCache: [],
          tcpState: 'CLOSED',
        },
        position: { x: 50, y: 150 },
      },
      {
        id: 'switch-1',
        name: 'SW-1 (Access Switch)',
        type: 'switch',
        interfaces: [
          { name: 'Fa0/1', mac: '00:1A:2B:3C:4D:51' },
          { name: 'Fa0/2', mac: '00:1A:2B:3C:4D:52' },
          { name: 'Fa0/3', mac: '00:1A:2B:3C:4D:53' },
        ],
        tableState: {
          macTable: [],
        },
        position: { x: 200, y: 150 },
      },
      {
        id: 'host-b',
        name: 'PC-B (Target Host)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.1.20',
            mac: '00:1A:2B:3C:4D:0B',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          arpCache: [],
          tcpState: 'CLOSED',
        },
        position: { x: 350, y: 100 },
      },
      {
        id: 'host-c',
        name: 'PC-C (Observer Host)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.1.30',
            mac: '00:1A:2B:3C:4D:0C',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          arpCache: [],
          tcpState: 'CLOSED',
        },
        position: { x: 350, y: 220 },
      },
    ],
    links: [
      {
        id: 'link-a-sw',
        sourceNodeId: 'host-a',
        targetNodeId: 'switch-1',
        linkSpeed: '1 Gbps',
        label: 'FastEthernet 0/1',
      },
      {
        id: 'link-sw-b',
        sourceNodeId: 'switch-1',
        targetNodeId: 'host-b',
        linkSpeed: '1 Gbps',
        label: 'FastEthernet 0/2',
      },
      {
        id: 'link-sw-c',
        sourceNodeId: 'switch-1',
        targetNodeId: 'host-c',
        linkSpeed: '1 Gbps',
        label: 'FastEthernet 0/3',
      },
    ],
  },
  defaultViewport: {
    zoom: 1,
    centerX: 200,
    centerY: 150,
  },
  steps: [
    {
      stepIndex: 0,
      title: '1. Host A Identifies ARP Cache Miss',
      explanation:
        'Host A prepares to send an ICMP Echo Request to 192.168.1.20 (Host B). It checks its local ARP cache table. Because no Layer 2 hardware address exists for 192.168.1.20, Host A halts packet transmission and prepares an ARP Request frame.',
      activeNodeId: 'host-a',
      targetNodeId: 'switch-1',
      transmission: {
        fromNodeId: 'host-a',
        toNodeId: 'switch-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0A',
            dstMac: 'FF:FF:FF:FF:FF:FF',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.20',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Request (Opcode 1)',
          },
          payloadDescription:
            'ARP Request: Who has 192.168.1.20? Tell 192.168.1.10 (Hardware: 00:1A:2B:3C:4D:0A)',
        },
      },
      nodeStateMutations: [],
      socraticCheckpoint: {
        question:
          'Why does Host A use the broadcast address FF:FF:FF:FF:FF:FF as the destination MAC rather than a unicast MAC?',
        hint: 'Host A knows the target IPv4 address but lacks the corresponding Layer 2 physical address.',
        expectedConcept:
          'Because Host A does not yet know which physical NIC owns 192.168.1.20, it must broadcast the query to every device in the local broadcast domain.',
      },
    },
    {
      stepIndex: 1,
      title: '2. Host A Transmits Broadcast Frame to SW1 (Fa0/1)',
      explanation:
        'Host A transmits the ARP Request onto the wire connected to SW1 port Fa0/1. Notice EtherType is 0x0806, identifying the payload as Address Resolution Protocol.',
      activeNodeId: 'host-a',
      targetNodeId: 'switch-1',
      transmission: {
        fromNodeId: 'host-a',
        toNodeId: 'switch-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0A',
            dstMac: 'FF:FF:FF:FF:FF:FF',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.20',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Request (Opcode 1)',
          },
          payloadDescription:
            'ARP Request [Opcode 1] Source: 192.168.1.10 (00:1A:2B:3C:4D:0A) -> Target: 192.168.1.20',
        },
      },
      nodeStateMutations: [],
    },
    {
      stepIndex: 2,
      title: '3. SW1 Learns Host A MAC & Floods Frame',
      explanation:
        'SW1 receives the frame on Fa0/1. It examines the SOURCE MAC (00:1A:2B:3C:4D:0A) and records { Fa0/1 -> 00:1A:2B:3C:4D:0A } in its MAC address table. Next, it examines the DESTINATION MAC (FF:FF:FF:FF:FF:FF). Recognizing a broadcast, SW1 floods the frame out all active interfaces in VLAN 1 except the ingress port (Fa0/2 and Fa0/3).',
      activeNodeId: 'switch-1',
      targetNodeId: 'host-b',
      transmission: {
        fromNodeId: 'switch-1',
        toNodeId: 'host-b',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0A',
            dstMac: 'FF:FF:FF:FF:FF:FF',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.20',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Request (Opcode 1)',
          },
          payloadDescription:
            'Flooded ARP Request sent to all ports on VLAN 1 (Fa0/2 toward Host B, Fa0/3 toward Host C)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'switch-1',
          table: 'mac',
          action: 'add',
          data: {
            mac: '00:1A:2B:3C:4D:0A',
            port: 'Fa0/1',
            vlan: 1,
            type: 'DYNAMIC',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What is the difference between a switch flooding a broadcast frame versus flooding an unknown unicast frame?',
        hint: 'Both egress all ports except the source port, but think about why the switch decides to flood each.',
        expectedConcept:
          'Broadcast frames are intentionally flooded by design to reach all hosts; unknown unicast frames are flooded only because the switch lacks an entry for the specific destination MAC in its CAM table.',
      },
    },
    {
      stepIndex: 3,
      title: '4. Host C Inspects Target IP & Discards Frame',
      explanation:
        'Host C receives the broadcast frame on Fa0/3 and examines the ARP payload Target IP (192.168.1.20). Because 192.168.1.20 does not match Host C\'s IP address (192.168.1.30), Host C drops the packet and takes no action.',
      activeNodeId: 'host-c',
      targetNodeId: 'host-c',
      transmission: {
        fromNodeId: 'switch-1',
        toNodeId: 'host-c',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0A',
            dstMac: 'FF:FF:FF:FF:FF:FF',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.20',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Discard',
          },
          payloadDescription:
            'Host C: Target IP 192.168.1.20 != 192.168.1.30 -> Frame silently dropped.',
        },
      },
      nodeStateMutations: [],
    },
    {
      stepIndex: 4,
      title: '5. Host B Matches Target IP, Learns Host A & Crafts ARP Reply',
      explanation:
        'Host B receives the ARP request on Fa0/2. It verifies that 192.168.1.20 matches its own IP. Host B populates its own ARP cache with Host A\'s mapping { 192.168.1.10 -> 00:1A:2B:3C:4D:0A }, then creates a unicast ARP Reply (Opcode 2) addressed directly to Host A.',
      activeNodeId: 'host-b',
      targetNodeId: 'switch-1',
      transmission: {
        fromNodeId: 'host-b',
        toNodeId: 'switch-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0B',
            dstMac: '00:1A:2B:3C:4D:0A',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.20',
            dstIp: '192.168.1.10',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Reply (Opcode 2)',
          },
          payloadDescription:
            'ARP Reply [Opcode 2]: 192.168.1.20 is at 00:1A:2B:3C:4D:0B (Unicast to 00:1A:2B:3C:4D:0A)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-b',
          table: 'arp',
          action: 'add',
          data: {
            ip: '192.168.1.10',
            mac: '00:1A:2B:3C:4D:0A',
            interface: 'eth0',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why is the ARP Reply sent as a Layer 2 unicast frame rather than another broadcast?',
        hint: 'Examine what information was learned from the initial ARP Request.',
        expectedConcept:
          'Host B already learned Host A\'s exact physical MAC address from the request header, so a unicast reply avoids unnecessary network-wide broadcast traffic.',
      },
    },
    {
      stepIndex: 5,
      title: '6. SW1 Learns Host B MAC & Unicasts Directly to Host A',
      explanation:
        'SW1 receives the ARP reply on Fa0/2. It learns Host B\'s MAC (00:1A:2B:3C:4D:0B) on port Fa0/2 and updates its CAM table. It then inspects the destination MAC (00:1A:2B:3C:4D:0A). Because Host A is already recorded in its CAM table on Fa0/1, SW1 forwards the frame ONLY out Fa0/1. Host C does not receive this packet.',
      activeNodeId: 'switch-1',
      targetNodeId: 'host-a',
      transmission: {
        fromNodeId: 'switch-1',
        toNodeId: 'host-a',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0B',
            dstMac: '00:1A:2B:3C:4D:0A',
            ethertype: '0x0806 (ARP)',
          },
          L3: {
            srcIp: '192.168.1.20',
            dstIp: '192.168.1.10',
            protocol: 'ARP (2054)',
            ttl: 1,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'ARP Reply (Opcode 2)',
          },
          payloadDescription:
            'Filtered unicast forwarding: SW1 sends frame directly out Fa0/1 to Host A.',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'switch-1',
          table: 'mac',
          action: 'add',
          data: {
            mac: '00:1A:2B:3C:4D:0B',
            port: 'Fa0/2',
            vlan: 1,
            type: 'DYNAMIC',
          },
        },
      ],
    },
    {
      stepIndex: 6,
      title: '7. Host A Populates ARP Cache & Unlocks ICMP Echo Request',
      explanation:
        'Host A receives the ARP reply. It updates its ARP cache with { 192.168.1.20 -> 00:1A:2B:3C:4D:0B }. Now that the destination MAC is known, Host A can immediately encapsulate and dispatch the queued ICMP Echo Request (Ping).',
      activeNodeId: 'host-a',
      targetNodeId: 'host-b',
      transmission: {
        fromNodeId: 'host-a',
        toNodeId: 'host-b',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:0A',
            dstMac: '00:1A:2B:3C:4D:0B',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.20',
            protocol: 'ICMP (1)',
            ttl: 64,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8)',
          },
          payloadDescription:
            'ICMP Echo Request: 192.168.1.10 -> 192.168.1.20 (L2 Unicast via resolved ARP cache)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-a',
          table: 'arp',
          action: 'add',
          data: {
            ip: '192.168.1.20',
            mac: '00:1A:2B:3C:4D:0B',
            interface: 'eth0',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What would happen if an attacker on Host C continuously sent gratuitous ARP replies claiming that 192.168.1.20 is at Host C\'s MAC address?',
        hint: 'Consider how hosts update their ARP tables when receiving unsolicited ARP replies.',
        expectedConcept:
          'ARP Cache Poisoning / Spoofing: Host A would update its cache and mistakenly send traffic meant for Host B to Host C, enabling Man-in-the-Middle (MitM) inspection or disruption.',
      },
    },
  ],
};
