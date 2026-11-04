import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonPacketWalk: DetailedLesson = {
            id: 'lesson-packet-walk',
            topicId: 'topic-packet-walk',
            pathId: 'path-fundamentals',
            slug: 'anatomy-of-a-packet-walk',
            title: 'The Anatomy of a Packet Walk',
            subtitle: 'Host-to-Host Delivery Across Routers: What Changes and What Stays the Same',
            difficulty: 'Fundamentals',
            estimatedMinutes: 15,
            learningObjectives: [
              'Distinguish the operational boundaries between Layer 2 (Data Link) and Layer 3 (Network).',
              'Trace a frame across multiple router hops, verifying exact MAC and IP header modifications.',
              'Explain how default gateway ARP resolution works when the destination is off-subnet.',
              'Understand why the IP TTL field is decremented at every Layer 3 boundary.',
            ],
            sections: [
              {
                id: 'sec-problem',
                title: '1. The Problem: Direct Cable vs. Scalable Routed Networks',
                contentMarkdown:
                  'If every computer on Earth were connected via a single shared Ethernet switch, the resulting broadcast traffic (ARP requests, DHCP discovers) would overwhelm every network interface card on the planet within seconds. To scale, networks are partitioned into **subnets (broadcast domains)** connected by **routers**.\n\nWhen Host A (`192.168.1.10`) wants to send data to Web Server B (`172.16.1.50`), it cannot simply broadcast an ARP request for Server B\'s MAC address because **routers do not forward Layer 2 broadcasts**. Host A must recognize that the destination is on a remote network and direct its frame to its local default gateway.',
                callout: {
                  type: 'pro_tip',
                  title: 'Golden Rule of Packet Walks',
                  text: 'Layer 3 IP addresses represent the ultimate END-TO-END destination and stay the same across every standard hop. Layer 2 MAC addresses represent LOCAL HOP-BY-HOP transit and are stripped and rewritten at every router interface!',
                },
              },
              {
                id: 'sec-step-by-step',
                title: '2. The 5-Step Delivery Lifecycle',
                contentMarkdown:
                  'Here is the exact deterministic sequence executed for every inter-subnet packet:\n\n1. **Subnet Comparison:** Host A applies its subnet mask to `172.16.1.50`. Since the network IDs differ, Host A determines the target is **off-subnet**.\n2. **Default Gateway Resolution:** Host A consults its local routing table for the Default Gateway (`192.168.1.1`). If the gateway MAC is not in Host A\'s ARP cache, it broadcasts an ARP request: *"Who has 192.168.1.1? Tell 192.168.1.10."*\n3. **Initial Frame Assembly (Hop 1):**\n   - **Layer 3:** Source IP = `192.168.1.10`, Destination IP = `172.16.1.50`, TTL = `64`\n   - **Layer 2:** Source MAC = `Host A (AA:AA)`, Destination MAC = `Router R1 (R1-LAN)`\n4. **Router De-encapsulation & Route Lookup:** Router R1 receives the frame, verifies the Frame Check Sequence (FCS), and sees its own MAC as the destination. It **strips the Layer 2 header**.\n   - R1 inspects the Layer 3 destination `172.16.1.50` against its routing table (Longest Prefix Match).\n   - R1 decrements the TTL from `64` to `63`. If TTL reaches 0, the packet is dropped and an ICMP Time Exceeded is returned.\n5. **Hop 2 Re-encapsulation:** R1 prepares to forward out its serial or point-to-point WAN interface to Router R2.\n   - R1 creates a brand new Layer 2 header: Source MAC = `R1-WAN`, Destination MAC = `R2-WAN`.\n   - **The Source and Destination IP addresses remain 192.168.1.10 and 172.16.1.50!**',
                callout: {
                  type: 'cisco_quirk',
                  title: 'Common Exam & Interview Trap: NAT vs. Routing',
                  text: 'Candidates often state that Router R1 changes the Source IP to its own WAN IP. This is ONLY true if Network Address Translation (NAT / PAT) is actively configured! In pure IP routing, IP addresses are never altered.',
                },
              },
              {
                id: 'sec-worked-example',
                title: '3. Worked Example: Client to Server via Dual Routers',
                contentMarkdown:
                  'Consider the path: **Client (Host A) -> Switch -> Router R1 -> Router R2 -> Switch -> Server (Host B)**.\n\n```\n[Host A] ──LAN── [Router R1] ──WAN── [Router R2] ──LAN── [Server B]\n.1.10              .1.1 / .0.1         .0.2 / .1.1           .1.50\n(MAC AA)          (R1-L / R1-W)       (R2-W / R2-L)         (MAC BB)\n```\n\n- **On Link 1 (Host A to R1):** Frame Source = `AA:AA`, Destination = `R1-LAN`. Packet Source = `192.168.1.10`, Destination = `172.16.1.50`.\n- **On Link 2 (R1 to R2):** Frame Source = `R1-WAN`, Destination = `R2-WAN`. Packet Source = `192.168.1.10`, Destination = `172.16.1.50`.\n- **On Link 3 (R2 to Host B):** Frame Source = `R2-LAN`, Destination = `BB:BB`. Packet Source = `192.168.1.10`, Destination = `172.16.1.50`.',
              },
            ],
            interactiveWidget: {
              type: 'packet_walk',
              title: 'Interactive Packet Walkthrough Stepper',
              description: 'Step through packet forwarding hop-by-hop. Watch which headers change and which stay untouched.',
            },
            predictExercise: {
              id: 'ex-packet-walk-predict',
              lessonId: 'lesson-packet-walk',
              type: 'predict_output',
              title: 'Router WAN Egress Header Inspection',
              learningObjective: 'Predict header fields altered vs preserved across a router boundary.',
              prompt:
                'When Router R1 forwards the IP packet across the WAN link toward Router R2, what is the exact Source IP address stored in the Layer 3 header? (Assume standard routing without NAT).',
              scenarioContext:
                'Host A (192.168.1.10) is sending a packet to Server B (172.16.1.50). Router R1 LAN IP is 192.168.1.1, and R1 WAN IP is 10.0.0.1.',
              textAnswerPattern: '^192\\.168\\.1\\.10$',
              acceptableAnswers: ['192.168.1.10'],
              hints: [
                'Think about Layer 2 vs. Layer 3 responsibilities. Which layer provides end-to-end identity?',
                'Standard routers only strip and reconstruct the Layer 2 frame. They do not rewrite the source IP unless NAT is running.',
                'The source IP must remain intact so the destination knows where to route replies.',
              ],
              explanation:
                'The Source IP remains 192.168.1.10 across the entire transit path. Standard IP routing operates purely on Layer 3 destination lookup and Layer 2 encapsulation rewrite. The Source IP is preserved so Server B knows where to send return packets!',
              commonMistakes: [
                {
                  mistake: '10.0.0.1',
                  explanation:
                    'Confusing standard IP routing with Network Address Translation (NAT/PAT). Standard routers never modify the Source IP.',
                },
              ],
              practicalTakeaway:
                'Unless NAT is explicitly configured, routers NEVER alter the Source IP or Destination IP in the Layer 3 header.',
              difficulty: 'fundamentals',
              visualizerLink: {
                type: 'packet_walk',
                targetStep: 2,
                label: 'Inspect Hop 3 (WAN Link) in Packet Walk Visualizer',
              },
            },
            practiceChallenge: {
              id: 'ex-packet-walk-challenge',
              lessonId: 'lesson-packet-walk',
              type: 'multiple_choice',
              title: 'IP Time-To-Live (TTL) Protocol Mechanics',
              learningObjective: 'Understand loop prevention and TTL decrement behavior.',
              prompt:
                'What happens to the IP Time-To-Live (TTL) field when Router R1 forwards the packet to Router R2, and what action occurs if TTL reaches 0?',
              options: [
                {
                  id: 'opt-ttl-1',
                  label: 'TTL is incremented by 1; if it exceeds 255, the router logs an alert.',
                  isCorrect: false,
                  explanation: 'TTL is decremented, not incremented. It prevents infinite loops.',
                },
                {
                  id: 'opt-ttl-2',
                  label: 'TTL is decremented by 1; if it hits 0, the packet is discarded and an ICMP Time Exceeded message is sent back to the source.',
                  isCorrect: true,
                  explanation:
                    'Correct! Decrementing TTL ensures packets stuck in a routing loop do not circulate forever. The router sends ICMP Type 11 (Time Exceeded).',
                },
                {
                  id: 'opt-ttl-3',
                  label: 'TTL is copied into the Layer 2 frame and reset to 64 at each router.',
                  isCorrect: false,
                  explanation: 'TTL is a Layer 3 IP header field and is never reset to 64 mid-transit.',
                },
                {
                  id: 'opt-ttl-4',
                  label: 'TTL is only modified by the destination host upon final receipt.',
                  isCorrect: false,
                  explanation: 'Every Layer 3 hop (router) must decrement TTL.',
                },
              ],
              hints: [
                'Why was the TTL field created? What disaster in a routing loop does it prevent?',
                'Each router that processes the Layer 3 header reduces this counter.',
                'When the counter hits zero, forwarding terminates and an ICMP diagnostic is emitted.',
              ],
              explanation:
                'Each router decrements TTL by 1 before forwarding. If TTL reaches 0, the router drops the packet and generates an ICMP Type 11 (Time Exceeded) message to the source, preventing routing loops from saturating bandwidth.',
              practicalTakeaway:
                'Traceroute intentionally sends packets with TTL=1, TTL=2, TTL=3 to elicit ICMP Time Exceeded replies from each hop along the path.',
              difficulty: 'fundamentals',
            },
            exercises: [
              {
                id: 'ex-packet-cross-subnet',
                lessonId: 'lesson-packet-walk',
                type: 'troubleshooting',
                title: 'Cross-Subnet Destination MAC Selection',
                learningObjective: 'Determine the correct Layer 2 destination address for off-subnet traffic.',
                prompt:
                  'Host A (192.168.1.10/24) needs to transmit an HTTP request to Server B (172.16.1.50/24). Assuming both Host A and Router R1 have empty ARP caches initially, what destination MAC address must Host A place in the Ethernet frame carrying this packet?',
                scenarioContext:
                  'Topology: Host A (192.168.1.10, MAC AA:AA) -> Switch 1 -> Router R1 (LAN IP 192.168.1.1, MAC 00:11:11:11:11:11) -> WAN -> Router R2 -> Server B (172.16.1.50, MAC BB:BB).',
                options: [
                  {
                    id: 'opt-mac-server',
                    label: "Server B's MAC address (BB:BB:BB:BB:BB:BB)",
                    isCorrect: false,
                    explanation:
                      'Incorrect. Host A cannot ARP for Server B because Router R1 does not forward Layer 2 broadcast ARP requests.',
                  },
                  {
                    id: 'opt-mac-router',
                    label: "Router R1's LAN interface MAC address (00:11:11:11:11:11)",
                    isCorrect: true,
                    explanation:
                      "Correct! Host A compares destination IP (172.16.1.50) with its local subnet (/24) and identifies the target is off-subnet. It queries its default gateway (192.168.1.1) and addresses the Layer 2 frame to R1's LAN MAC.",
                  },
                  {
                    id: 'opt-mac-broadcast',
                    label: 'The Ethernet broadcast address (FF:FF:FF:FF:FF:FF)',
                    isCorrect: false,
                    explanation:
                      'Incorrect. While Host A broadcasts an ARP request to learn R1\'s MAC, the actual data frame carrying the IP packet must be unicast.',
                  },
                  {
                    id: 'opt-mac-switch',
                    label: "Switch 1's management MAC address",
                    isCorrect: false,
                    explanation:
                      'Incorrect. Layer 2 switches are transparent forwarding devices; transit frames are never addressed to the switch MAC.',
                  },
                ],
                hints: [
                  'Apply Host A\'s subnet mask (255.255.255.0) to 172.16.1.50. Does Server B share the 192.168.1.0/24 broadcast domain?',
                  'Routers terminate Layer 2 broadcast domains and drop ARP requests destined for remote networks.',
                  'When traffic is off-subnet, the frame must be delivered locally to the default gateway router.',
                ],
                explanation:
                  'When sending to an off-subnet destination, a host creates an IP packet addressed to the final destination IP, but encapsulates it in an Ethernet frame addressed to its local default gateway router\'s MAC address.',
                commonMistakes: [
                  {
                    mistake: "Server B's MAC",
                    explanation:
                      'Learners frequently assume hosts ARP for the remote server MAC. Because ARP uses Layer 2 broadcasts, and routers never forward Layer 2 broadcasts, the host must send to the gateway router.',
                  },
                ],
                practicalTakeaway:
                  'Golden Rule: Layer 3 IP is end-to-end (remains Server B); Layer 2 MAC is hop-by-hop (addressed to local gateway R1).',
                difficulty: 'fundamentals',
                visualizerLink: {
                  type: 'packet_walk',
                  targetStep: 0,
                  label: 'Inspect Hop 1 in Packet Walk Visualizer',
                },
              },
              {
                id: 'ex-packet-walk-predict',
                lessonId: 'lesson-packet-walk',
                type: 'predict_output',
                title: 'Router WAN Egress Header Inspection',
                learningObjective: 'Predict header fields altered vs preserved across a router boundary.',
                prompt:
                  'When Router R1 forwards the IP packet across the WAN link toward Router R2, what is the exact Source IP address stored in the Layer 3 header? (Assume standard routing without NAT).',
                scenarioContext:
                  'Host A (192.168.1.10) is sending a packet to Server B (172.16.1.50). Router R1 LAN IP is 192.168.1.1, and R1 WAN IP is 10.0.0.1.',
                textAnswerPattern: '^192\\.168\\.1\\.10$',
                acceptableAnswers: ['192.168.1.10'],
                hints: [
                  'Think about Layer 2 vs. Layer 3 responsibilities. Which layer provides end-to-end identity?',
                  'Standard routers only strip and reconstruct the Layer 2 frame. They do not rewrite the source IP unless NAT is running.',
                  'The source IP must remain intact so the destination knows where to route replies.',
                ],
                explanation:
                  'The Source IP remains 192.168.1.10 across the entire transit path. Standard IP routing operates purely on Layer 3 destination lookup and Layer 2 encapsulation rewrite. The Source IP is preserved so Server B knows where to send return packets!',
                commonMistakes: [
                  {
                    mistake: '10.0.0.1',
                    explanation:
                      'Confusing standard IP routing with Network Address Translation (NAT/PAT). Standard routers never modify the Source IP.',
                  },
                ],
                practicalTakeaway:
                  'Unless NAT is explicitly configured, routers NEVER alter the Source IP or Destination IP in the Layer 3 header.',
                difficulty: 'fundamentals',
                visualizerLink: {
                  type: 'packet_walk',
                  targetStep: 2,
                  label: 'Inspect Hop 3 (WAN Link) in Packet Walk Visualizer',
                },
              },
              {
                id: 'ex-packet-walk-challenge',
                lessonId: 'lesson-packet-walk',
                type: 'multiple_choice',
                title: 'IP Time-To-Live (TTL) Protocol Mechanics',
                learningObjective: 'Understand loop prevention and TTL decrement behavior.',
                prompt:
                  'What happens to the IP Time-To-Live (TTL) field when Router R1 forwards the packet to Router R2, and what action occurs if TTL reaches 0?',
                options: [
                  {
                    id: 'opt-ttl-1',
                    label: 'TTL is incremented by 1; if it exceeds 255, the router logs an alert.',
                    isCorrect: false,
                    explanation: 'TTL is decremented, not incremented. It prevents infinite loops.',
                  },
                  {
                    id: 'opt-ttl-2',
                    label: 'TTL is decremented by 1; if it hits 0, the packet is discarded and an ICMP Time Exceeded message is sent back to the source.',
                    isCorrect: true,
                    explanation:
                      'Correct! Decrementing TTL ensures packets stuck in a routing loop do not circulate forever. The router sends ICMP Type 11 (Time Exceeded).',
                  },
                  {
                    id: 'opt-ttl-3',
                    label: 'TTL is copied into the Layer 2 frame and reset to 64 at each router.',
                    isCorrect: false,
                    explanation: 'TTL is a Layer 3 IP header field and is never reset to 64 mid-transit.',
                  },
                  {
                    id: 'opt-ttl-4',
                    label: 'TTL is only modified by the destination host upon final receipt.',
                    isCorrect: false,
                    explanation: 'Every Layer 3 hop (router) must decrement TTL.',
                  },
                ],
                hints: [
                  'Why was the TTL field created? What disaster in a routing loop does it prevent?',
                  'Each router that processes the Layer 3 header reduces this counter.',
                  'When the counter hits zero, forwarding terminates and an ICMP diagnostic is emitted.',
                ],
                explanation:
                  'Each router decrements TTL by 1 before forwarding. If TTL reaches 0, the router drops the packet and generates an ICMP Type 11 (Time Exceeded) message to the source, preventing routing loops from saturating bandwidth.',
                practicalTakeaway:
                  'Traceroute intentionally sends packets with TTL=1, TTL=2, TTL=3 to elicit ICMP Time Exceeded replies from each hop along the path.',
                difficulty: 'fundamentals',
              },
              {
                id: 'ex-packet-l2-broadcast-boundary',
                lessonId: 'lesson-packet-walk',
                type: 'troubleshooting',
                title: 'Router Broadcast Domain Boundary Analysis',
                learningObjective: 'Explain why Layer 2 broadcasts do not cross routers.',
                prompt:
                  'A misconfigured testing host on LAN 1 floods the local network with Layer 2 broadcast frames (Destination MAC: FF:FF:FF:FF:FF:FF). Why do users on LAN 2 (connected to Router R2) experience zero broadcast traffic from this host?',
                options: [
                  {
                    id: 'opt-bcast-route',
                    label: 'Routers do not forward Layer 2 broadcasts; each router interface terminates a broadcast domain.',
                    isCorrect: true,
                    explanation:
                      'Correct! By definition, routers split networks into separate broadcast domains. A broadcast frame received on R1 LAN is processed by R1\'s CPU but never flooded onto other interfaces.',
                  },
                  {
                    id: 'opt-bcast-acl',
                    label: 'Routers forward broadcasts by default unless an explicit access-list blocks them.',
                    isCorrect: false,
                    explanation:
                      'Incorrect. Routers never forward Layer 2 broadcasts out other interfaces, with or without ACLs.',
                  },
                  {
                    id: 'opt-bcast-ttl',
                    label: 'Layer 2 broadcast frames have a TTL of 1, so they expire immediately.',
                    isCorrect: false,
                    explanation:
                      'Incorrect. Ethernet Layer 2 frames have no TTL field at all (which is why switching loops without Spanning Tree cause fatal broadcast storms!).',
                  },
                  {
                    id: 'opt-bcast-switch',
                    label: 'Switch 1 detects the flood and drops all broadcast frames before they reach the router.',
                    isCorrect: false,
                    explanation:
                      'Incorrect. Standard switches flood broadcast frames to all ports in the VLAN, including the router uplink.',
                  },
                ],
                hints: [
                  'What is the fundamental architectural difference between a collision domain, a broadcast domain, and a routed network?',
                  'Do Ethernet headers have a TTL field to kill circulating frames?',
                  'If routers forwarded broadcasts, every broadcast on Earth would propagate globally.',
                ],
                explanation:
                  'Switches create separate collision domains but forward Layer 2 broadcasts to all ports in the VLAN. Routers create separate broadcast domains and terminate Layer 2 broadcasts at the receiving interface.',
                practicalTakeaway:
                  'Rule of thumb: Switches propagate broadcasts; routers contain broadcasts.',
                difficulty: 'fundamentals',
              },
              {
                id: 'ex-packet-encapsulation-sequence',
                lessonId: 'lesson-packet-walk',
                type: 'sequence',
                title: 'Host Frame Preparation Sequence',
                learningObjective: 'Sequence the exact steps an IP host takes to transmit off-subnet traffic.',
                prompt:
                  'Order the chronological sequence executed by Host A when transmitting data to remote Server B:',
                sequenceItems: [
                  { id: 'seq-1', text: '1. Apply local subnet mask to destination IP (172.16.1.50).', correctIndex: 0 },
                  { id: 'seq-2', text: '2. Determine destination network ID differs from local subnet.', correctIndex: 1 },
                  { id: 'seq-3', text: '3. Query local routing table for Default Gateway IP (192.168.1.1).', correctIndex: 2 },
                  { id: 'seq-4', text: '4. Check ARP cache for Gateway MAC (or transmit ARP Request).', correctIndex: 3 },
                  { id: 'seq-5', text: '5. Encapsulate IP packet inside frame addressed to Gateway MAC.', correctIndex: 4 },
                  { id: 'seq-6', text: '6. Transmit serialized Ethernet bits onto physical medium.', correctIndex: 5 },
                ],
                hints: [
                  'A host must evaluate whether a destination is local or remote before it can choose who to ARP for.',
                  'ARP resolution occurs before final Ethernet frame encapsulation.',
                  'Physical bit transmission is always the final step.',
                ],
                explanation:
                  'Before transmitting, every IP host performs an AND operation with its mask. Finding the destination remote, it directs the frame to its default gateway via ARP and Layer 2 encapsulation.',
                practicalTakeaway:
                  'Host routing logic: Local destination -> ARP for target directly. Remote destination -> ARP for default gateway.',
                difficulty: 'fundamentals',
              },
            ],
            relatedFlashcardDecks: [
              {
                id: 'jeremy-day-01',
                title: 'Day 01 Flashcards - Network Devices',
                type: 'flashcard',
                day: 1,
                description: 'Reinforce routers, switches, endpoints, and collision/broadcast domains.',
              },
            ],
            relatedLabs: [
              {
                id: 'jeremy-lab-01',
                title: 'Day 01 Lab: Packet Tracer Introduction',
                type: 'lab',
                day: 1,
                filename: 'Day 01 Lab - Packet Tracer Introduction.pkt',
                description: 'Explore hardware interfaces and test basic ping connectivity in Packet Tracer.',
              },
            ],
            externalReferences: [
              {
                title: 'RFC 791: Internet Protocol Specification',
                url: 'https://datatracker.ietf.org/doc/html/rfc791',
                sourceType: 'rfc',
                relevantSection: 'Section 3.1: Header Format & Time to Live',
              },
              {
                title: 'Cisco Networking Academy: IP Addressing and Subnetting',
                url: 'https://www.cisco.com/c/en/us/support/docs/ip/routing-information-protocol-rip/13788-3.html',
                sourceType: 'cisco_doc',
              },
            ],
          };
