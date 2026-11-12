import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';

/**
 * Scenario: IEEE 802.1Q VLAN Trunking & Router-on-a-Stick (ROAS) Inter-VLAN Routing
 * Demonstrates access port ingestion, 802.1Q tag insertion (TPID 0x8100 / VID 10),
 * sub-interface routing on R1 (Gi0/0.10 -> Gi0/0.20), egress re-tagging (VID 20),
 * switch CAM table VLAN scoping, and access port tag stripping.
 */
export const VLAN_TRUNKING_ROAS_SCENARIO: ProtocolSimulationScenario = {
  metadata: {
    id: 'vlan-trunking-roas',
    title: '802.1Q VLAN Trunking & Router-on-a-Stick (ROAS)',
    certification: 'CCNA',
    protocol: 'VLAN',
    difficulty: 'Intermediate',
    description:
      'Step-by-step interactive protocol packet walk tracing IEEE 802.1Q trunk tagging, per-VLAN CAM table isolation, and sub-interface Layer 3 routing via Router-on-a-Stick (ROAS).',
    keyConcepts: [
      'IEEE 802.1Q Tagged Trunking (TPID 0x8100)',
      'Virtual LAN Segmentation (VLAN 10 vs 20)',
      'Router-on-a-Stick (ROAS) Sub-Interfaces',
      'Per-VLAN CAM Table Forwarding',
      'Access Port Tag Stripping & Egress',
      'Native VLAN & Broadcast Isolation',
    ],
  },
  topology: {
    nodes: [
      {
        id: 'pc-sales',
        name: 'PC-Sales (VLAN 10)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.10.10',
            mac: '00:1A:2B:3C:4D:10',
            subnetMask: '255.255.255.0',
            vlan: 10,
          },
        ],
        tableState: {
          arpCache: [
            {
              ip: '192.168.10.1',
              mac: '00:1A:2B:3C:4D:R1',
              interface: 'eth0',
            },
          ],
          tcpState: 'CLOSED',
        },
        position: { x: 60, y: 150 },
      },
      {
        id: 'switch-1',
        name: 'SW-1 (Access / Trunk)',
        type: 'switch',
        interfaces: [
          {
            name: 'Fa0/1',
            mac: '00:1A:2B:3C:4D:S1',
            vlan: 10,
          },
          {
            name: 'Fa0/2',
            mac: '00:1A:2B:3C:4D:S2',
            vlan: 20,
          },
          {
            name: 'Gi0/1',
            mac: '00:1A:2B:3C:4D:ST',
          },
        ],
        tableState: {
          macTable: [],
        },
        position: { x: 200, y: 150 },
      },
      {
        id: 'router-1',
        name: 'R1-ROAS (Inter-VLAN Gateway)',
        type: 'router',
        interfaces: [
          {
            name: 'Gi0/0.10',
            ip: '192.168.10.1',
            mac: '00:1A:2B:3C:4D:R1',
            subnetMask: '255.255.255.0',
            vlan: 10,
          },
          {
            name: 'Gi0/0.20',
            ip: '192.168.20.1',
            mac: '00:1A:2B:3C:4D:R2',
            subnetMask: '255.255.255.0',
            vlan: 20,
          },
        ],
        tableState: {
          routingTable: [
            {
              network: '192.168.10.0',
              mask: '255.255.255.0',
              interface: 'Gi0/0.10',
              protocol: 'C',
            },
            {
              network: '192.168.20.0',
              mask: '255.255.255.0',
              interface: 'Gi0/0.20',
              protocol: 'C',
            },
          ],
          arpCache: [
            {
              ip: '192.168.20.20',
              mac: '00:1A:2B:3C:4D:20',
              interface: 'Gi0/0.20',
            },
          ],
        },
        position: { x: 340, y: 80 },
      },
      {
        id: 'pc-eng',
        name: 'PC-Eng (VLAN 20)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.20.20',
            mac: '00:1A:2B:3C:4D:20',
            subnetMask: '255.255.255.0',
            vlan: 20,
          },
        ],
        tableState: {
          arpCache: [
            {
              ip: '192.168.20.1',
              mac: '00:1A:2B:3C:4D:R2',
              interface: 'eth0',
            },
          ],
          tcpState: 'CLOSED',
        },
        position: { x: 480, y: 150 },
      },
    ],
    links: [
      {
        id: 'link-sales-sw',
        sourceNodeId: 'pc-sales',
        targetNodeId: 'switch-1',
        linkSpeed: '100 Mbps',
        label: 'Fa0/1 (Access VLAN 10)',
        vlan: 10,
      },
      {
        id: 'link-sw-roas',
        sourceNodeId: 'switch-1',
        targetNodeId: 'router-1',
        linkSpeed: '1 Gbps',
        label: 'Gi0/1 <-> Gi0/0 (802.1Q Trunk)',
      },
      {
        id: 'link-sw-eng',
        sourceNodeId: 'switch-1',
        targetNodeId: 'pc-eng',
        linkSpeed: '100 Mbps',
        label: 'Fa0/2 (Access VLAN 20)',
        vlan: 20,
      },
    ],
  },
  defaultViewport: {
    zoom: 1,
    centerX: 270,
    centerY: 130,
  },
  steps: [
    {
      stepIndex: 0,
      title: '1. PC-Sales Dispatches Untagged Frame to Default Gateway',
      explanation:
        'PC-Sales (192.168.10.10) wants to ping PC-Eng (192.168.20.20). Because 192.168.20.20 resides on a different IP subnet, PC-Sales determines the destination is off-subnet. It consults its local routing table and addresses the Layer 2 Ethernet frame to its default gateway R1 Gi0/0.10 (00:1A:2B:3C:4D:R1). As an end host on an access port, PC-Sales has no knowledge of 802.1Q tags and transmits a standard untagged Ethernet II frame onto Fa0/1.',
      activeNodeId: 'pc-sales',
      targetNodeId: 'switch-1',
      transmission: {
        fromNodeId: 'pc-sales',
        toNodeId: 'switch-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:10',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.10.10',
            dstIp: '192.168.20.20',
            protocol: 'ICMP (1)',
            ttl: 128,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8, Code 0)',
          },
          payloadDescription:
            'Untagged Ethernet II: ICMP Echo Request Seq=1 (destined for off-subnet 192.168.20.20)',
        },
      },
      nodeStateMutations: [],
      socraticCheckpoint: {
        question:
          'Why does an access-layer endpoint like PC-Sales transmit untagged Ethernet frames rather than inserting 802.1Q VLAN headers itself?',
        hint: 'Consider standard NIC hardware capabilities and how network security boundaries are enforced at switch access ports.',
        expectedConcept:
          'VLAN membership is strictly enforced by the switch access port configuration to prevent unauthorized endpoint VLAN hopping and maintain standard NIC compatibility.',
      },
    },
    {
      stepIndex: 1,
      title: '2. Switch SW-1 Ingress Ingestion & 802.1Q Tag Insertion',
      explanation:
        'SW-1 ingests the frame on Fa0/1, which is assigned to VLAN 10. SW-1 learns PC-Sales MAC (00:1A:2B:3C:4D:10) in its VLAN 10 CAM table on port Fa0/1. To forward the frame over trunk link Gi0/1 toward Router R1, SW-1 inserts a 4-byte IEEE 802.1Q header (TPID 0x8100, VID=10, PCP=0, DEI=0) immediately after the Source MAC field, preserving VLAN identity across the shared trunk.',
      activeNodeId: 'switch-1',
      targetNodeId: 'router-1',
      transmission: {
        fromNodeId: 'switch-1',
        toNodeId: 'router-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:10',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
            vlanTag: {
              vlanId: 10,
              pcp: 0,
              dei: false,
            },
          },
          L3: {
            srcIp: '192.168.10.10',
            dstIp: '192.168.20.20',
            protocol: 'ICMP (1)',
            ttl: 128,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8, Code 0)',
          },
          payloadDescription:
            '802.1Q Tagged Frame [VID 10 | PCP 0]: ICMP Echo Request in transit across Gi0/1 trunk',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'switch-1',
          table: 'mac',
          action: 'add',
          data: {
            mac: '00:1A:2B:3C:4D:10',
            port: 'Fa0/1',
            vlan: 10,
            type: 'DYNAMIC',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What is the standard 16-bit Tag Protocol Identifier (TPID) value that identifies an IEEE 802.1Q tagged Ethernet frame?',
        hint: 'It is a reserved EtherType placed immediately before the 2-byte TCI (Tag Control Information) containing the 12-bit VLAN ID.',
        expectedConcept:
          '0x8100 indicates an IEEE 802.1Q tagged frame with a 12-bit VLAN identifier and 3-bit Priority Code Point.',
      },
    },
    {
      stepIndex: 2,
      title: '3. Router R1 De-encapsulation & Inter-VLAN Route Lookup',
      explanation:
        'Router R1 receives the tagged frame on physical interface Gi0/0. Seeing VID 10, it directs the frame to sub-interface Gi0/0.10. R1 strips the 802.1Q Layer 2 header and inspects the Layer 3 destination 192.168.20.20 against its routing table. It finds a directly connected match on sub-interface Gi0/0.20 (192.168.20.0/24). R1 decrements the TTL from 128 to 127 and prepares re-encapsulation.',
      activeNodeId: 'router-1',
      targetNodeId: 'router-1',
      transmission: {
        fromNodeId: 'router-1',
        toNodeId: 'router-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:10',
            dstMac: '00:1A:2B:3C:4D:R1',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.10.10',
            dstIp: '192.168.20.20',
            protocol: 'ICMP (1)',
            ttl: 127,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8, Code 0)',
          },
          payloadDescription:
            'Router R1 Internal De-encapsulation & L3 Routing: Gi0/0.10 -> Gi0/0.20 (TTL 128 -> 127)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'router-1',
          table: 'arp',
          action: 'add',
          data: {
            ip: '192.168.10.10',
            mac: '00:1A:2B:3C:4D:10',
            interface: 'Gi0/0.10',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why can two hosts in different VLANs on the same physical switch never communicate without a Layer 3 routing entity?',
        hint: 'Recall that each VLAN represents an independent Layer 2 broadcast domain with isolated forwarding tables.',
        expectedConcept:
          'VLANs create completely isolated broadcast domains at Layer 2; crossing broadcast domain boundaries requires Layer 3 packet routing.',
      },
    },
    {
      stepIndex: 3,
      title: '4. Router R1 Re-encapsulation & VLAN 20 Egress Tagging',
      explanation:
        'R1 encapsulates the packet in a new Layer 2 Ethernet header: Source MAC = R1 Gi0/0.20 (00:1A:2B:3C:4D:R2), Destination MAC = PC-Eng (00:1A:2B:3C:4D:20). Because Gi0/0.20 is configured for 802.1Q encapsulation in VLAN 20, R1 inserts an 802.1Q tag header with VID=20 before transmitting the frame back out physical interface Gi0/0 onto the trunk link toward SW-1.',
      activeNodeId: 'router-1',
      targetNodeId: 'switch-1',
      transmission: {
        fromNodeId: 'router-1',
        toNodeId: 'switch-1',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R2',
            dstMac: '00:1A:2B:3C:4D:20',
            ethertype: '0x0800 (IPv4)',
            vlanTag: {
              vlanId: 20,
              pcp: 0,
              dei: false,
            },
          },
          L3: {
            srcIp: '192.168.10.10',
            dstIp: '192.168.20.20',
            protocol: 'ICMP (1)',
            ttl: 127,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8, Code 0)',
          },
          payloadDescription:
            '802.1Q Tagged Frame [VID 20 | PCP 0]: Routed packet returning across trunk Gi0/0 <-> Gi0/1',
        },
      },
      nodeStateMutations: [],
    },
    {
      stepIndex: 4,
      title: '5. Switch SW-1 VLAN 20 CAM Lookup & Tag Stripping',
      explanation:
        'SW-1 receives the VLAN 20 tagged frame on trunk port Gi0/1. It consults its CAM table specifically for VLAN 20 and finds PC-Eng (00:1A:2B:3C:4D:20) mapped to access port Fa0/2. Because Fa0/2 is configured as an access port in VLAN 20, SW-1 strips the 4-byte 802.1Q header before transmitting the frame out Fa0/2, restoring standard untagged Ethernet framing.',
      activeNodeId: 'switch-1',
      targetNodeId: 'pc-eng',
      transmission: {
        fromNodeId: 'switch-1',
        toNodeId: 'pc-eng',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:R2',
            dstMac: '00:1A:2B:3C:4D:20',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.10.10',
            dstIp: '192.168.20.20',
            protocol: 'ICMP (1)',
            ttl: 127,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Request (Type 8, Code 0)',
          },
          payloadDescription:
            'Untagged Ethernet II (Tag Stripped at Access Egress): Frame directed to PC-Eng Fa0/2',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'switch-1',
          table: 'mac',
          action: 'add',
          data: {
            mac: '00:1A:2B:3C:4D:20',
            port: 'Fa0/2',
            vlan: 20,
            type: 'DYNAMIC',
          },
        },
      ],
      socraticCheckpoint: {
        question:
          'What occurs when an 802.1Q trunk port receives an untagged frame with no VLAN header?',
        hint: 'Every 802.1Q trunk port possesses a default VLAN assignment for untagged traffic.',
        expectedConcept:
          'Untagged frames arriving on an 802.1Q trunk are automatically assigned to the configured Native VLAN (default VLAN 1).',
      },
    },
    {
      stepIndex: 5,
      title: '6. PC-Eng Delivery & ICMP Echo Processing',
      explanation:
        'PC-Eng receives the standard untagged Ethernet II frame on interface eth0. Recognizing its own MAC address as the destination, it de-encapsulates the frame and verifies the Layer 3 destination IP 192.168.20.20. PC-Eng passes the ICMP Echo Request payload up to its IP stack and prepares an ICMP Echo Reply, completing the inter-VLAN transit.',
      activeNodeId: 'pc-eng',
      targetNodeId: 'pc-sales',
      transmission: {
        fromNodeId: 'pc-eng',
        toNodeId: 'pc-sales',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:20',
            dstMac: '00:1A:2B:3C:4D:R2',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.20.20',
            dstIp: '192.168.10.10',
            protocol: 'ICMP (1)',
            ttl: 64,
          },
          L4: {
            protocolType: 'ICMP',
            icmpType: 'Echo Reply (Type 0, Code 0)',
          },
          payloadDescription:
            'ICMP Echo Reply (Type 0) prepared by PC-Eng to return via Default Gateway Gi0/0.20',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'pc-eng',
          table: 'arp',
          action: 'add',
          data: {
            ip: '192.168.20.1',
            mac: '00:1A:2B:3C:4D:R2',
            interface: 'eth0',
          },
        },
      ],
    },
  ],
  cliConfig: {
    protocolScope: 'VLAN',
    targetNodeId: 'switch-1',
    promptHostname: 'SW-1#',
    objective:
      'Verify 802.1Q trunking on Gi0/1 and test inter-VLAN forwarding connectivity from PC-Sales to PC-Eng.',
    initialConfigLines: [
      'interface GigabitEthernet0/1',
      ' switchport trunk encapsulation dot1q',
      ' switchport mode trunk',
      ' switchport trunk allowed vlan 10,20',
      'interface FastEthernet0/1',
      ' switchport access vlan 10',
      ' switchport mode access',
      'interface FastEthernet0/2',
      ' switchport access vlan 20',
      ' switchport mode access',
    ],
    allowedCommands: [
      {
        command: 'show interfaces trunk',
        aliases: ['sh int trunk', 'sh interfaces trunk', 'show int trunk'],
        description: 'Display 802.1Q trunk status and allowed VLANs',
        output:
          'Port        Mode             Encapsulation  Status        Native vlan\nGi0/1       on               802.1q         trunking      1\n\nPort        Vlans allowed on trunk\nGi0/1       10,20\n\nPort        Vlans allowed and active in management domain\nGi0/1       10,20\n\nPort        Vlans in spanning tree forwarding state and not pruned\nGi0/1       10,20',
      },
      {
        command: 'show vlan brief',
        aliases: ['sh vlan brief', 'sh vlan br', 'show vlan br'],
        description: 'Display configured VLANs and access port assignments',
        output:
          'VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active    Fa0/3, Fa0/4\n10   Sales                            active    Fa0/1\n20   Engineering                      active    Fa0/2',
      },
      {
        command: 'show mac address-table',
        aliases: ['sh mac address-table', 'sh mac add', 'show mac add'],
        description: 'Display switch CAM table with learned MACs and VLAN tags',
        output:
          '          Mac Address Table\n-------------------------------------------\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n  10    001a.2b3c.4d10    DYNAMIC     Fa0/1\n  20    001a.2b3c.4d20    DYNAMIC     Fa0/2\n  10    001a.2b3c.4dr1    DYNAMIC     Gi0/1\n  20    001a.2b3c.4dr2    DYNAMIC     Gi0/1\nTotal Mac Addresses for this criterion: 4',
      },
      {
        command: 'ping 192.168.20.20',
        aliases: [
          'ping 192.168.20.20 source 192.168.10.10',
          'ping 192.168.10.1',
          'test inter-vlan',
        ],
        description: 'Execute end-to-end ICMP ping across Router-on-a-Stick sub-interfaces',
        output:
          'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to 192.168.20.20, timeout is 2 seconds:\n.!!!!\nSuccess rate is 80 percent (4/5), round-trip min/avg/max = 1/2/4 ms\n%NETMENTOR-6-ROAS_VERIFIED: Inter-VLAN frame tagged dot1q VLAN 10 -> R1 -> retagged dot1q VLAN 20 -> delivered.',
        tableMutations: [
          {
            nodeId: 'switch-1',
            table: 'mac',
            action: 'add',
            data: {
              mac: '00:1A:2B:3C:4D:20',
              port: 'Fa0/2',
              vlan: 20,
              type: 'DYNAMIC',
            },
          },
        ],
        goalAchieved: true,
      },
    ],
  },
};
