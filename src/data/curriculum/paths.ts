import type { DetailedPath } from '../../types/curriculum.js';
import { lessonPacketWalk } from './fundamentals/packet-walk.js';
import { lessonSubnettingMagicNumber } from './fundamentals/subnetting.js';
import { lessonOspfNeighborStates } from './ccna/ospf-neighbor-states.js';
import { lessonBgpPathSelection } from './ccnp/bgp-path-selection.js';
import { lessonBgpTroubleshooting } from './ccnp/bgp-troubleshooting.js';
import { lessonSdWanArchitecture } from './ccnp/sd-wan-architecture.js';
import { lessonSdWanRoutingPolicy } from './ccnp/sd-wan-routing-policy.js';
import { lessonMplsL3Vpn } from './ccnp/mpls-l3vpn.js';
import { lessonQosFundamentals } from './ccnp/qos-fundamentals.js';

export const CURRICULUM_PATHS: DetailedPath[] = [
  {
    id: 'path-fundamentals',
    slug: 'network-fundamentals',
    title: 'Network Fundamentals & Architecture',
    description:
      'Master first-principles packet delivery, OSI and TCP/IP protocol stacks, IPv4 binary math, and Ethernet switching.',
    targetCert: 'Fundamentals',
    orderIndex: 1,
    topics: [
      {
        id: 'topic-packet-walk',
        pathId: 'path-fundamentals',
        slug: 'packet-delivery-encapsulation',
        title: 'Packet Delivery & Encapsulation',
        description:
          'Understand how data traverses networks from client to server, stripping and rewriting headers at each hop.',
        orderIndex: 1,
        estimatedMinutes: 20,
        lessons: [lessonPacketWalk],
      },
      {
        id: 'topic-subnetting',
        pathId: 'path-fundamentals',
        slug: 'ipv4-addressing-and-subnetting',
        title: 'IPv4 Addressing & Subnetting Mechanics',
        description:
          'Master binary prefixing, block sizing, and the Magic Number method for rapid mental subnetting.',
        orderIndex: 2,
        estimatedMinutes: 25,
        lessons: [lessonSubnettingMagicNumber],
      },
    ],
  },
  {
    id: 'path-ccna',
    slug: 'ccna-200-301',
    title: 'Cisco CCNA (200-301)',
    description:
      'Comprehensive associate-level routing, switching, security, and IP services engineering.',
    targetCert: 'CCNA',
    orderIndex: 2,
    topics: [
      {
        id: 'topic-ospf',
        pathId: 'path-ccna',
        slug: 'ospf-routing-protocol',
        title: 'OSPFv2 Routing Protocol',
        description:
          'Open Shortest Path First link-state routing, LSAs, metric calculation, and neighbor formation.',
        orderIndex: 1,
        estimatedMinutes: 30,
        lessons: [lessonOspfNeighborStates],
      },
    ],
  },
  {
    id: 'path-ccnp',
    slug: 'ccnp-encor-350-401',
    title: 'Cisco CCNP Enterprise (ENCOR)',
    description:
      'Advanced enterprise architecture, scalable BGP routing, MPLS L3VPNs, VRF segmentation, SD-WAN, and enterprise QoS.',
    targetCert: 'CCNP Enterprise',
    orderIndex: 3,
    topics: [
      {
        id: 'topic-bgp',
        pathId: 'path-ccnp',
        slug: 'bgp-path-selection',
        title: 'Border Gateway Protocol (BGP) & Path Selection',
        description:
          'Autonomous Systems, eBGP/iBGP peering, and the deterministic 13-step best path algorithm.',
        orderIndex: 1,
        estimatedMinutes: 90,
        lessons: [lessonBgpPathSelection, lessonBgpTroubleshooting],
      },
      {
        id: 'topic-sdwan',
        pathId: 'path-ccnp',
        slug: 'cisco-sd-wan-architecture',
        title: 'Cisco SD-WAN Architecture & Planes',
        description:
          'Orchestration (vBond), Management (vManage), Control (vSmart via OMP), and Data (vEdge IPsec).',
        orderIndex: 2,
        estimatedMinutes: 90,
        lessons: [lessonSdWanArchitecture, lessonSdWanRoutingPolicy],
      },
      {
        id: 'topic-mpls-vpn',
        pathId: 'path-ccnp',
        slug: 'mpls-l3vpn-vrf',
        title: 'MPLS Layer 3 VPNs & VRF Architecture',
        description:
          'Provider edge routing, VRFs, Route Distinguishers, Route Targets, MP-BGP VPNv4, and inter-VRF route leaking.',
        orderIndex: 3,
        estimatedMinutes: 45,
        lessons: [lessonMplsL3Vpn],
      },
      {
        id: 'topic-qos',
        pathId: 'path-ccnp',
        slug: 'qos-traffic-conditioning',
        title: 'Quality of Service (QoS) & Traffic Conditioning',
        description:
          'Classification, marking, policing, shaping, queuing (LLQ/CBWFQ), and congestion avoidance (WRED).',
        orderIndex: 4,
        estimatedMinutes: 45,
        lessons: [lessonQosFundamentals],
      },
    ],
  },
];
