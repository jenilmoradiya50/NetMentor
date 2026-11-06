import type { ProtocolSimulationScenario } from '../../types/protocol-simulation';

/**
 * Reference Scenario: TCP 3-Way Handshake & Connection Teardown
 * Traces connection synchronization, application HTTP transit, and graceful 4-way socket teardown.
 */
export const TCP_HANDSHAKE_SCENARIO: ProtocolSimulationScenario = {
  metadata: {
    id: 'tcp-handshake-teardown',
    title: 'TCP 3-Way Handshake & Connection Teardown',
    certification: 'CCNA',
    protocol: 'TCP',
    difficulty: 'Beginner',
    description:
      'Step-by-step interactive protocol packet walk tracing TCP connection establishment (SYN, SYN-ACK, ACK), HTTP data transit, and graceful connection teardown (FIN, ACK) with socket state machine telemetry.',
    keyConcepts: [
      '3-Way Handshake (SYN -> SYN-ACK -> ACK)',
      'Sequence & Acknowledgment Number Arithmetic',
      'Socket State Machine (CLOSED, LISTEN, SYN_SENT, SYN_RCVD, ESTABLISHED, TIME_WAIT)',
      'TCP Flags (SYN, ACK, PSH, FIN)',
      'Full-Duplex Teardown & TIME_WAIT Protection',
    ],
  },
  topology: {
    nodes: [
      {
        id: 'host-client',
        name: 'PC-A (Client Host)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.1.10',
            mac: '00:1A:2B:3C:4D:01',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          arpCache: [
            {
              ip: '192.168.1.100',
              mac: '00:1A:2B:3C:4D:99',
              interface: 'eth0',
            },
          ],
          tcpState: 'CLOSED',
        },
        position: { x: 80, y: 160 },
      },
      {
        id: 'switch-1',
        name: 'SW-1 (Access Switch)',
        type: 'switch',
        interfaces: [
          {
            name: 'Fa0/1',
            mac: '00:1A:2B:3C:4D:51',
          },
          {
            name: 'Fa0/2',
            mac: '00:1A:2B:3C:4D:52',
          },
        ],
        tableState: {
          macTable: [
            {
              mac: '00:1A:2B:3C:4D:01',
              port: 'Fa0/1',
              vlan: 1,
              type: 'DYNAMIC',
            },
            {
              mac: '00:1A:2B:3C:4D:99',
              port: 'Fa0/2',
              vlan: 1,
              type: 'DYNAMIC',
            },
          ],
        },
        position: { x: 256, y: 160 },
      },
      {
        id: 'srv-web',
        name: 'SRV-Web (Apache Server)',
        type: 'host',
        interfaces: [
          {
            name: 'eth0',
            ip: '192.168.1.100',
            mac: '00:1A:2B:3C:4D:99',
            subnetMask: '255.255.255.0',
          },
        ],
        tableState: {
          arpCache: [
            {
              ip: '192.168.1.10',
              mac: '00:1A:2B:3C:4D:01',
              interface: 'eth0',
            },
          ],
          tcpState: 'LISTEN',
        },
        position: { x: 432, y: 160 },
      },
    ],
    links: [
      {
        id: 'link-client-sw',
        sourceNodeId: 'host-client',
        targetNodeId: 'switch-1',
        linkSpeed: '1 Gbps',
        label: 'FastEthernet 0/1',
      },
      {
        id: 'link-sw-srv',
        sourceNodeId: 'switch-1',
        targetNodeId: 'srv-web',
        linkSpeed: '1 Gbps',
        label: 'FastEthernet 0/2',
      },
    ],
  },
  defaultViewport: {
    zoom: 1,
    centerX: 256,
    centerY: 160,
  },
  steps: [
    {
      stepIndex: 0,
      title: '1. Client Dispatches SYN Packet',
      explanation:
        'The client process allocates an ephemeral port (49152) and generates a randomized Initial Sequence Number (ISN = 1000). It sets the SYN control flag to synchronize byte streams with the server. Notice that Ack Number is 0 because no bytes have been acknowledged from the remote socket yet.',
      activeNodeId: 'host-client',
      targetNodeId: 'srv-web',
      transmission: {
        fromNodeId: 'host-client',
        toNodeId: 'srv-web',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:01',
            dstMac: '00:1A:2B:3C:4D:99',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.100',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 41201,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 80,
            flags: { syn: true },
            seqNumber: 1000,
            ackNumber: 0,
            windowSize: 64240,
          },
          payloadDescription: 'TCP [SYN] Seq=1000 Win=64240 Len=0 MSS=1460 WS=128',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-client',
          table: 'tcp',
          action: 'update',
          data: { state: 'SYN_SENT' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why is the Initial Sequence Number (ISN) chosen pseudorandomly rather than simply starting at zero?',
        hint: 'Consider what could happen if a previous connection between the exact same IP/port tuple closed, but old duplicate packets were still delayed in transit across the Internet.',
        expectedConcept:
          'Security against TCP sequence prediction attacks and prevention of old duplicate packets from interfering with new socket sessions.',
      },
    },
    {
      stepIndex: 1,
      title: '2. Server Responds with SYN-ACK',
      explanation:
        'The web server daemon listening on port 80 accepts the synchronization request. It generates its own unique ISN (5000), sets the SYN flag to synchronize its transmit direction, and sets the ACK flag acknowledging the client\'s SYN. Notice the Acknowledgment Number is exactly Client ISN + 1 (1001), consuming one virtual sequence byte.',
      activeNodeId: 'srv-web',
      targetNodeId: 'host-client',
      transmission: {
        fromNodeId: 'srv-web',
        toNodeId: 'host-client',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:99',
            dstMac: '00:1A:2B:3C:4D:01',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.100',
            dstIp: '192.168.1.10',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 10452,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 80,
            dstPort: 49152,
            flags: { syn: true, ack: true },
            seqNumber: 5000,
            ackNumber: 1001,
            windowSize: 65160,
          },
          payloadDescription: 'TCP [SYN, ACK] Seq=5000 Ack=1001 Win=65160 Len=0 MSS=1460 WS=128',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'srv-web',
          table: 'tcp',
          action: 'update',
          data: { state: 'SYN_RCVD' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why does the ACK number equal 1001 when the client sent 0 bytes of payload in the initial SYN packet?',
        hint: 'In TCP sequence number arithmetic, certain control flags consume 1 sequence space unit so they can be reliably acknowledged.',
        expectedConcept:
          'SYN and FIN flags consume exactly 1 virtual sequence number so that connection establishment and termination are guaranteed to be acknowledged.',
      },
    },
    {
      stepIndex: 2,
      title: '3. Client Finalizes Handshake with ACK',
      explanation:
        'The client receives the server\'s SYN-ACK and sends the final ACK segment. It sets Seq=1001 and Ack=5001 (Server ISN + 1). Once this packet is dispatched, the client transitions immediately to ESTABLISHED. When the server processes this ACK, it also enters ESTABLISHED. The full-duplex socket is now ready for application data.',
      activeNodeId: 'host-client',
      targetNodeId: 'srv-web',
      transmission: {
        fromNodeId: 'host-client',
        toNodeId: 'srv-web',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:01',
            dstMac: '00:1A:2B:3C:4D:99',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.100',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 41202,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 80,
            flags: { ack: true },
            seqNumber: 1001,
            ackNumber: 5001,
            windowSize: 64240,
          },
          payloadDescription: 'TCP [ACK] Seq=1001 Ack=5001 Win=64240 Len=0 (Handshake Complete)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-client',
          table: 'tcp',
          action: 'update',
          data: { state: 'ESTABLISHED' },
        },
        {
          nodeId: 'srv-web',
          table: 'tcp',
          action: 'update',
          data: { state: 'ESTABLISHED' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Can application data (such as an HTTP GET request) be piggybacked inside this third ACK segment?',
        hint: 'Look at the TCP RFC 793 specification regarding the ESTABLISHED transition.',
        expectedConcept:
          'Yes, standard TCP allows data to accompany the final ACK, and TCP Fast Open (TFO) even allows data in the initial SYN.',
      },
    },
    {
      stepIndex: 3,
      title: '4. Client Sends HTTP GET Request',
      explanation:
        'The client browser pushes an HTTP GET /index.html request (150 bytes). It sets the PSH (Push) and ACK flags. Seq remains 1001 because no previous data bytes have been transmitted. Next expected sequence number from the client will be 1001 + 150 = 1151.',
      activeNodeId: 'host-client',
      targetNodeId: 'srv-web',
      transmission: {
        fromNodeId: 'host-client',
        toNodeId: 'srv-web',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:01',
            dstMac: '00:1A:2B:3C:4D:99',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.100',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 41203,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 80,
            flags: { psh: true, ack: true },
            seqNumber: 1001,
            ackNumber: 5001,
            windowSize: 64240,
          },
          payloadDescription:
            'HTTP/1.1 GET /index.html Host: 192.168.1.100 User-Agent: NetMentor/1.0 (150 bytes payload)',
        },
      },
      nodeStateMutations: [],
      socraticCheckpoint: {
        question: 'What purpose does the PSH (Push) flag serve in this segment?',
        hint: 'Without PSH, how does a TCP stack buffer incoming and outgoing segments before notifying the application?',
        expectedConcept:
          'PSH instructs the receiver TCP stack to immediately deliver buffered data to the application layer without waiting for the receive buffer to fill.',
      },
    },
    {
      stepIndex: 4,
      title: '5. Server Delivers HTTP 200 OK Response',
      explanation:
        'The web server delivers the requested web page (512 bytes) with HTTP 200 OK. It sets Seq=5001 and acknowledges the 150 bytes received from the client by setting Ack=1151 (1001 + 150). Next sequence for the server will be 5001 + 512 = 5513.',
      activeNodeId: 'srv-web',
      targetNodeId: 'host-client',
      transmission: {
        fromNodeId: 'srv-web',
        toNodeId: 'host-client',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:99',
            dstMac: '00:1A:2B:3C:4D:01',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.100',
            dstIp: '192.168.1.10',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 10453,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 80,
            dstPort: 49152,
            flags: { psh: true, ack: true },
            seqNumber: 5001,
            ackNumber: 1151,
            windowSize: 65160,
          },
          payloadDescription:
            'HTTP/1.1 200 OK Content-Type: text/html Content-Length: 512 (512 bytes payload)',
        },
      },
      nodeStateMutations: [],
    },
    {
      stepIndex: 5,
      title: '6. Client Initiates Graceful Teardown (FIN-ACK)',
      explanation:
        'Having received the complete HTTP response, the client closes its transmit side by sending a FIN segment (with ACK for the 512 bytes: Ack=5513). The client enters FIN_WAIT_1. When the server receives FIN, it enters CLOSE_WAIT and informs its local application.',
      activeNodeId: 'host-client',
      targetNodeId: 'srv-web',
      transmission: {
        fromNodeId: 'host-client',
        toNodeId: 'srv-web',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:01',
            dstMac: '00:1A:2B:3C:4D:99',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.10',
            dstIp: '192.168.1.100',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 41204,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 49152,
            dstPort: 80,
            flags: { fin: true, ack: true },
            seqNumber: 1151,
            ackNumber: 5513,
            windowSize: 64240,
          },
          payloadDescription: 'TCP [FIN, ACK] Seq=1151 Ack=5513 Win=64240 Len=0 (Initiate Teardown)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-client',
          table: 'tcp',
          action: 'update',
          data: { state: 'FIN_WAIT_1' },
        },
        {
          nodeId: 'srv-web',
          table: 'tcp',
          action: 'update',
          data: { state: 'CLOSE_WAIT' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why is TCP connection closure 4-way rather than 3-way like connection establishment?',
        hint: 'Remember that TCP is a full-duplex communication channel.',
        expectedConcept:
          'TCP connections are full-duplex; closing one direction (half-close) leaves the opposite direction open until the peer also finishes transmitting and sends its own FIN.',
      },
    },
    {
      stepIndex: 6,
      title: '7. Server Closes & Client Enters TIME_WAIT',
      explanation:
        'The server transmits its own FIN-ACK (Seq=5513, Ack=1152), signaling it has finished all data transmission and is entering LAST_ACK. The client acknowledges this FIN with Ack=5514 and enters the TIME_WAIT state (2 * MSL, typically 60-120s) to guarantee the final ACK is received before releasing the socket.',
      activeNodeId: 'srv-web',
      targetNodeId: 'host-client',
      transmission: {
        fromNodeId: 'srv-web',
        toNodeId: 'host-client',
        packet: {
          L2: {
            srcMac: '00:1A:2B:3C:4D:99',
            dstMac: '00:1A:2B:3C:4D:01',
            ethertype: '0x0800 (IPv4)',
          },
          L3: {
            srcIp: '192.168.1.100',
            dstIp: '192.168.1.10',
            protocol: 'TCP (6)',
            ttl: 64,
            identification: 10454,
            flags: { dontFragment: true },
          },
          L4: {
            protocolType: 'TCP',
            srcPort: 80,
            dstPort: 49152,
            flags: { fin: true, ack: true },
            seqNumber: 5513,
            ackNumber: 1152,
            windowSize: 65160,
          },
          payloadDescription: 'TCP [FIN, ACK] Seq=5513 Ack=1152 Win=65160 Len=0 (Server Closes)',
        },
      },
      nodeStateMutations: [
        {
          nodeId: 'host-client',
          table: 'tcp',
          action: 'update',
          data: { state: 'TIME_WAIT' },
        },
        {
          nodeId: 'srv-web',
          table: 'tcp',
          action: 'update',
          data: { state: 'CLOSED' },
        },
      ],
      socraticCheckpoint: {
        question:
          'Why does the client wait in TIME_WAIT for 2 * Maximum Segment Lifetime (2MSL) before terminating the connection completely?',
        hint: 'What if the final ACK from the client to the server is dropped in transit?',
        expectedConcept:
          'To allow retransmission of the final ACK if it was lost, preventing the server from remaining stuck in LAST_ACK and preventing old duplicate packets from corrupting future connections.',
      },
    },
  ],
};
