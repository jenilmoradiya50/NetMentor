/**
 * NetMentor AI Tutor Engine - Mock Provider Client
 * 
 * Provides a deterministic, zero-network, zero-credential AI provider implementation
 * for local development, CI test suites, and offline verification.
 * 
 * Generates pedagogically accurate networking tutor responses and upholds Socratic
 * anti-cheating boundaries.
 */

import type {
  AiProviderClient,
  AiGenerateRequest,
  AiGenerateResponse,
} from './types.js';

export class MockAiProvider implements AiProviderClient {
  public readonly modelName: string;

  constructor(modelName: string = 'netmentor-mock-engine-v1') {
    this.modelName = modelName;
  }

  /**
   * Deterministically generates a simulated mentor response based on grounded prompt context.
   */
  public async generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse> {
    const userPrompt = request.userPrompt || '';
    const systemPrompt = request.systemPrompt || '';

    // Handle Structured Lesson Generation Mode
    if (
      systemPrompt.includes('STRUCTURED LESSON GENERATION MODE') ||
      userPrompt.includes('<lesson_request>')
    ) {
      if (userPrompt.includes('TEST_PROVIDER_ERROR')) {
        throw new Error('Simulated upstream AI provider failure');
      }

      if (userPrompt.includes('TEST_INVALID_JSON')) {
        return {
          text: '{"lessonTitle": "Broken JSON output without proper closing quotes or braces',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_MISSING_FIELDS')) {
        return {
          text: JSON.stringify({
            lessonTitle: 'Incomplete Test Lesson',
            shortDescription: 'Missing required sections and checks',
          }),
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      const lessonJson = generateMockStructuredLesson(userPrompt);
      return {
        text: lessonJson,
        model: this.modelName,
        isSimulated: true,
        finishReason: 'stop',
        usage: {
          promptTokens: 450,
          completionTokens: 980,
          totalTokens: 1430,
        },
      };
    }

    // Handle Structured Flashcard Generation Mode (Milestone 3)
    if (
      systemPrompt.includes('STRUCTURED FLASHCARD GENERATION MODE') ||
      userPrompt.includes('<flashcard_request>')
    ) {
      if (userPrompt.includes('TEST_PROVIDER_ERROR')) {
        throw new Error('Simulated upstream AI provider failure');
      }

      if (userPrompt.includes('TEST_INVALID_JSON')) {
        return {
          text: '{"title": "Broken Flashcard JSON", "cards": ::: <<<}',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_TRUNCATED_JSON')) {
        return {
          text: '{"title": "Truncated Flashcard Deck", "cards": [{"frontMarkdown": "Q1", "backMarkdown": "A1"}, {"frontMarkdown": "Q2", "backMarkdown": "',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'length',
        };
      }

      if (userPrompt.includes('TEST_ARRAY_JSON')) {
        return {
          text: '```json\n[\n  {"front": "What is Layer 3 forwarding?", "back": "Routing based on destination IP header.", "tags": ["Routing"]},\n  {"front": "What is ARP?", "back": "Maps IP addresses to Layer 2 MAC addresses.", "tags": ["ARP", "Ethernet"]}\n]\n```',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_NESTED_CODE_BLOCKS')) {
        return {
          text: '```json\n{\n  "title": "CLI Commands Deck",\n  "cards": [\n    {\n      "front": "How do you inspect OSPF neighbors?",\n      "back": "Use the command:\\n```bash\\nshow ip ospf neighbor\\n```\\nConfirm state is FULL.",\n      "tags": ["OSPF", "CLI"]\n    }\n  ]\n}\n```\nHere is your requested deck.',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_MISSING_CARDS')) {
        return {
          text: JSON.stringify({
            title: 'Empty Test Flashcard Deck',
            description: 'Deck with no cards array',
            cards: [],
          }),
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      const flashcardJson = generateMockStructuredFlashcards(userPrompt);
      return {
        text: flashcardJson,
        model: this.modelName,
        isSimulated: true,
        finishReason: 'stop',
        usage: {
          promptTokens: 320,
          completionTokens: 640,
          totalTokens: 960,
        },
      };
    }

    // Handle Structured Quiz Generation Mode (Milestone: AI Quiz Generation)
    if (
      systemPrompt.includes('STRUCTURED QUIZ GENERATION MODE') ||
      userPrompt.includes('<quiz_request>')
    ) {
      if (userPrompt.includes('TEST_PROVIDER_ERROR')) {
        throw new Error('Simulated upstream AI provider failure');
      }

      if (userPrompt.includes('TEST_INVALID_JSON')) {
        return {
          text: '{"title": "Broken Quiz JSON", "questions": ::: <<<}',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_TRUNCATED_JSON')) {
        return {
          text: '{"title": "Truncated Quiz", "questions": [{"id": "q-1", "question": "In networking, what is...',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'length',
        };
      }

      if (userPrompt.includes('TEST_MISSING_QUESTIONS')) {
        return {
          text: JSON.stringify({
            title: 'Empty Test Quiz',
            topic: 'Networking',
            questions: [],
          }),
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_INVALID_ANSWERS')) {
        return {
          text: JSON.stringify({
            title: 'Invalid Answers Test Quiz',
            topic: 'Networking',
            questions: [
              {
                id: 'q-1',
                type: 'single_choice',
                question: 'Test question with invalid answer',
                options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
                correctAnswer: 'Z',
                explanation: 'Invalid option ID',
              },
            ],
          }),
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      const quizJson = generateMockStructuredQuiz(userPrompt);
      return {
        text: quizJson,
        model: this.modelName,
        isSimulated: true,
        finishReason: 'stop',
        usage: {
          promptTokens: 420,
          completionTokens: 850,
          totalTokens: 1270,
        },
      };
    }

    // Handle Structured Protocol Simulation Generation Mode (Phase H)
    if (
      systemPrompt.includes('STRUCTURED PROTOCOL SIMULATION GENERATION MODE') ||
      userPrompt.includes('<simulation_request>')
    ) {
      if (userPrompt.includes('TEST_PROVIDER_ERROR')) {
        throw new Error('Simulated upstream AI provider failure');
      }

      if (userPrompt.includes('TEST_INVALID_JSON')) {
        return {
          text: '{"metadata": {"title": "Broken Simulation JSON", "nodes": [:::[{',
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      if (userPrompt.includes('TEST_MISSING_STEPS')) {
        return {
          text: JSON.stringify({
            metadata: { title: 'Missing Steps Scenario', protocol: 'OSPF' },
            topology: { nodes: [{ id: 'n1' }], links: [] },
            steps: [],
          }),
          model: this.modelName,
          isSimulated: true,
          finishReason: 'stop',
        };
      }

      const simJson = generateMockStructuredSimulation(userPrompt);
      return {
        text: simJson,
        model: this.modelName,
        isSimulated: true,
        finishReason: 'stop',
        usage: {
          promptTokens: 490,
          completionTokens: 1100,
          totalTokens: 1590,
        },
      };
    }

    // Extract learner query from <learner_query>...</learner_query>
    const match = userPrompt.match(/<learner_query>\s*([\s\S]*?)\s*<\/learner_query>/i);
    const query = (match ? match[1] : userPrompt).toLowerCase();

    const isSocratic =
      systemPrompt.includes('SOCRATIC EXERCISE MODE') ||
      userPrompt.includes('SOCRATIC GUARD ACTIVE');

    const asksForDirectAnswer =
      query.includes('what is the answer') ||
      query.includes('give me the answer') ||
      query.includes('tell me the answer') ||
      query.includes('solve this') ||
      query.includes('which option is correct') ||
      query.includes('ignore previous instructions') ||
      query.includes('just tell me');

    let text: string;

    if (isSocratic && asksForDirectAnswer) {
      text =
        '[NetMentor Simulated Tutor] As your network mentor, I cannot reveal the direct answer to this challenge. Let\'s reason through the protocol mechanism together: what does the underlying standard or RFC state about this behavior? Check the clues provided and consider which constraint eliminates the distractor options.';
    } else if (query.includes('ttl') || userPrompt.includes('Time-To-Live') || userPrompt.includes('packet-walk')) {
      text =
        '[NetMentor Simulated Tutor] ### IPv4 Packet Forwarding & TTL (RFC 791)\n\nIn IPv4 packet forwarding, every Layer 3 router decrements the **TTL (Time-To-Live)** field by 1 before egress forwarding:\n\n- If TTL decrements to `0`, the router discards the frame and transmits an `ICMP Time Exceeded (Type 11)` message back to the source.\n- The source and destination IP addresses remain unchanged unless NAT/PAT is active.\n\n```bash\n# Verify TTL and path hop progression\ntraceroute 8.8.8.8\n```';
    } else if (query.includes('magic number') || query.includes('subnet') || userPrompt.includes('subnetting')) {
      text =
        '[NetMentor Simulated Tutor] ### Subnetting & Magic Number Intuition\n\nFor subnetting calculations, the **Magic Number** represents the block size in the interesting octet:\n\n$$\\text{Magic Number} = 256 - \\text{Subnet Mask Octet Value}$$\n\n- **Formula for usable hosts:** `2^h - 2` (where `h` is the number of remaining host bits).\n- **Network ID & Broadcast:** Subtract 2 for the Network ID and Broadcast Address unless RFC 3021 (`/31`) point-to-point applies.\n\n```text\nPrefix /27 calculation for 192.168.10.0:\nMask:         255.255.255.224\nMagic Number: 256 - 224 = 32\nFirst Block:  192.168.10.0 to 192.168.10.31\nUsable Range: 192.168.10.1 - 192.168.10.30 (30 usable hosts)\n```';
    } else if (query.includes('ospf') || userPrompt.includes('ospf-neighbor-states')) {
      text =
        '[NetMentor Simulated Tutor] ### OSPF Neighbor Adjacency States\n\nOSPF transitions through a strict 7-state finite state machine (RFC 2328):\n\n1. **Down:** Initial state; no Hellos received from neighbor.\n2. **Init:** Received Hello packet, but local Router ID is not listed in neighbor\'s active list.\n3. **2-Way:** Bi-directional communication achieved. DR/BDR election occurs on multi-access links.\n4. **ExStart:** Master/slave relationship established using empty Database Description (DBD) packets.\n5. **Exchange:** Routers exchange DBD packets summarizing their link-state databases.\n6. **Loading:** Routers send Link State Requests (LSR) and receive Link State Updates (LSU).\n7. **Full:** Link-state databases are 100% synchronized.\n\n```ios\nrouter ospf 1\n router-id 1.1.1.1\n network 10.0.0.0 0.0.0.255 area 0\n passive-interface GigabitEthernet0/0\n```';
    } else if (query.includes('bgp') || userPrompt.includes('bgp-path-selection') || userPrompt.includes('bgp-troubleshooting')) {
      text =
        '[NetMentor Simulated Tutor] ### BGP Path Selection Order\n\nBGP path selection evaluates attributes in a deterministic sequential order:\n\n1. **Highest Weight:** Cisco proprietary, local to router (`32768` for local, `0` for learned).\n2. **Highest Local Preference:** Communicated throughout autonomous system (default `100`).\n3. **Locally Originated:** Prefer local routes originated via `network` or `aggregate-address`.\n4. **Shortest AS-Path:** Fewest AS hops in the `AS_PATH` attribute.\n5. **Lowest Origin Code:** `IGP` (`i`) < `EGP` (`e`) < `Incomplete` (`?`).\n6. **Lowest MED:** Multi-Exit Discriminator sent between neighboring ASes.\n7. **eBGP over iBGP:** Prefer paths learned externally.\n8. **Lowest IGP Metric:** Closest next-hop address via internal routing table.\n\n```ios\nrouter bgp 65001\n neighbor 10.1.1.2 remote-as 65002\n neighbor 10.1.1.2 route-map SET_PREF in\n!\nroute-map SET_PREF permit 10\n set local-preference 200\n```';
    } else if (query.includes('sd-wan') || userPrompt.includes('sd-wan')) {
      text =
        '[NetMentor Simulated Tutor] ### Cisco SD-WAN Architecture\n\nCisco SD-WAN decouples the network fabric into distinct planes:\n\n- **vManage (Management Plane):** Centralized GUI dashboard for Day 0 provisioning and Day 2 monitoring.\n- **vBond (Orchestration Plane):** Facilitates NAT-traversal and authenticates WAN Edge routers.\n- **vSmart (Control Plane):** Establishes OMP peering to calculate routing topology and enforce policies.\n- **vEdge / cEdge (Data Plane):** Forwards user traffic across encrypted IPsec and GRE tunnels.\n\n```text\nControl Connection Verification:\nshow sdwan control connections\nshow sdwan control local-properties\n```';
    } else if (query.includes('mpls') || userPrompt.includes('mpls-l3vpn')) {
      text =
        '[NetMentor Simulated Tutor] ### MPLS L3VPN Architecture (RFC 4364)\n\nIn MPLS Layer 3 VPNs, VRFs provide isolated routing tables on PE routers:\n\n- **Route Distinguishers (RD):** Prepend 64 bits to IPv4 addresses to create unique 96-bit VPNv4 prefixes.\n- **Route Targets (RT):** BGP extended communities that dictate import/export policies between VRFs.\n\n```ios\nip vrf CUSTOMER_A\n rd 65001:100\n route-target export 65001:100\n route-target import 65001:100\n```';
    } else if (query.includes('qos') || userPrompt.includes('qos-fundamentals')) {
      text =
        '[NetMentor Simulated Tutor] ### Enterprise Quality of Service (QoS)\n\nSystematic QoS deployment follows three functional phases:\n\n1. **Classification & Marking:** Identify traffic at the trust boundary (e.g. `DSCP EF / 46` for Voice).\n2. **Policing vs Shaping:** Policing drops or remarks traffic bursts; Shaping buffers packets to smooth egress rate.\n3. **Queuing:** Low Latency Queuing (LLQ = PQ + CBWFQ) guarantees bandwidth and minimum delay for real-time traffic.\n\n```ios\nclass-map match-any VOICE_TRAFFIC\n match dscp ef\n!\npolicy-map WAN_EDGE_QOS\n class VOICE_TRAFFIC\n  priority percent 30\n class class-default\n  fair-queue\n```';
    } else if (
      query.includes('switch') ||
      query.includes('vlan') ||
      query.includes('stp') ||
      query.includes('spanning tree') ||
      query.includes('spanning-tree') ||
      query.includes('etherchannel') ||
      query.includes('trunk')
    ) {
      text =
        '[NetMentor Simulated Tutor] ### Enterprise Layer 2 Switching & Spanning Tree\n\nIn Enterprise Layer 2 switching:\n\n- **VLANs & Trunks:** VLANs partition broadcast domains; IEEE 802.1Q inserts a 4-byte tag on trunk links.\n- **Spanning Tree Protocol (STP / RSTP):** Prevents layer 2 loops by electing a Root Bridge (lowest Bridge ID = Priority + MAC) and placing redundant ports into Alternate/Discarding states.\n- **EtherChannel (LACP):** Aggregates multiple physical links into a single logical channel to maximize throughput and prevent STP blocking.\n\n```ios\ninterface Port-channel 1\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30\n!\ninterface range GigabitEthernet0/1 - 2\n channel-group 1 mode active\n```';
    } else if (
      query.includes('security') ||
      query.includes('acl') ||
      query.includes('nat') ||
      query.includes('ipsec') ||
      query.includes('firewall') ||
      query.includes('802.1x') ||
      query.includes('vpn')
    ) {
      text =
        '[NetMentor Simulated Tutor] ### Enterprise Network Security & Defense\n\nIn network security architecture:\n\n- **Access Control Lists (ACLs):** Stateless packet filtering evaluated top-to-bottom with an implicit deny all at the bottom.\n- **NAT/PAT RFC 3022:** Maps private RFC 1918 space to globally routable public IPs using dynamic transport layer port numbers.\n- **IPsec VPNs:** Encapsulating Security Payload (ESP) provides confidentiality, data integrity, and anti-replay protection across public networks.\n\n```ios\nip access-list extended SECURE_INBOUND\n permit tcp any host 198.51.100.10 eq 443\n permit icmp any any echo-reply\n deny ip any any log\n```';
    } else if (
      query.includes('automation') ||
      query.includes('restconf') ||
      query.includes('netconf') ||
      query.includes('yang') ||
      query.includes('python') ||
      query.includes('ansible') ||
      query.includes('programmability') ||
      query.includes('api')
    ) {
      text =
        '[NetMentor Simulated Tutor] ### Network Automation & Model-Driven Programmability\n\nModern network automation shifts device management from fragile CLI scraping to model-driven programmability:\n\n- **YANG (RFC 6020):** Data modeling language describing configuration and operational state.\n- **NETCONF (RFC 6241):** XML-encoded RPCs over secure SSH transport using datastores (running, candidate, startup).\n- **RESTCONF (RFC 8040):** HTTP-based mechanism using RESTful CRUD operations (GET, POST, PUT, PATCH, DELETE) with JSON or XML.\n\n```json\n{\n  "ietf-interfaces:interface": {\n    "name": "GigabitEthernet1",\n    "description": "Configured via RESTCONF",\n    "type": "iana-if-type:ethernetCsmacd",\n    "enabled": true\n  }\n}\n```';
    } else if (
      userPrompt.includes('GENERAL NETWORKING KNOWLEDGE DOMAIN') ||
      systemPrompt.includes('GENERAL NETWORKING Q&A MODE')
    ) {
      text =
        '[NetMentor Simulated Tutor] ### Enterprise Networking Architecture & Design\n\nIn enterprise networking architecture, systematic troubleshooting and design isolates failure domains across OSI layers:\n\n1. **Layer 1 / 2:** Verify link operational status, duplex, speed, and CRC framing errors.\n2. **Layer 3:** Validate IPv4/IPv6 addressing, subnet masks, default gateway reachability, and CEF routing table entries.\n3. **Layer 4 - 7:** Inspect TCP handshake behavior, ACL/firewall drops, and application protocol availability.\n\n```bash\n# Verify interface state and IP reachability\nshow ip interface brief\nshow ip route\nping 192.168.1.1\n```';
    } else {
      text =
        '[NetMentor Simulated Tutor] Grounded in this lesson\'s objectives, remember to analyze packet headers and protocol state transitions systematically. Review the active section material and verify each protocol invariant step by step.';
    }

    const promptLength = (request.systemPrompt?.length || 0) + (request.userPrompt?.length || 0);
    const completionLength = text.length;

    return {
      text,
      model: this.modelName,
      usage: {
        promptTokens: Math.ceil(promptLength / 4),
        completionTokens: Math.ceil(completionLength / 4),
        totalTokens: Math.ceil((promptLength + completionLength) / 4),
      },
      finishReason: 'stop',
      isSimulated: true,
    };
  }
}

import { FallbackOrchestrator } from './providers/fallback-orchestrator.js';

export const mockAiProvider = new MockAiProvider();

let defaultOrchestrator: AiProviderClient | null = null;
let testOverrideProvider: AiProviderClient | null = null;

/**
 * Returns the currently active AI provider client.
 * In development and production, returns the Multi-Provider Fallback Orchestrator
 * (Gemini -> Groq -> NVIDIA -> Cloudflare -> Cohere -> Mock).
 * If AI_PROVIDER=mock or test override is present, uses the deterministic mock engine.
 */
export function getActiveAiProvider(): AiProviderClient {
  if (testOverrideProvider) {
    return testOverrideProvider;
  }

  const forcedProvider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (forcedProvider === 'mock') {
    return mockAiProvider;
  }

  if (!defaultOrchestrator) {
    defaultOrchestrator = new FallbackOrchestrator();
  }

  return defaultOrchestrator;
}

/**
 * Test hook to inject custom or failing AI providers for error handling validation.
 */
export function __setTestAiProvider(provider: AiProviderClient | null) {
  testOverrideProvider = provider;
}

/**
 * Deterministically constructs a rich, technically accurate GeneratedLessonContent JSON object
 * tailored to the requested topic for offline testing and development.
 */
function generateMockStructuredLesson(userPrompt: string): string {
  const topicMatch = userPrompt.match(/TOPIC:\s*([^\r\n]+)/i);
  const diffMatch = userPrompt.match(/DIFFICULTY:\s*([^\r\n]+)/i);
  const platMatch = userPrompt.match(/TARGET_PLATFORM:\s*([^\r\n]+)/i);

  const rawTopic = topicMatch ? topicMatch[1].trim() : 'Site-to-site IPsec VPNs';
  const difficulty = (diffMatch ? diffMatch[1].trim().toLowerCase() : 'intermediate') as
    | 'beginner'
    | 'intermediate'
    | 'advanced';
  const platform = platMatch ? platMatch[1].trim() : 'Cisco IOS-XE';

  const lower = rawTopic.toLowerCase();

  if (lower.includes('ipsec') || lower.includes('vpn')) {
    return JSON.stringify({
      lessonTitle: 'Site-to-Site IPsec VPN Architecture & Configuration',
      shortDescription: 'Master the end-to-end theory, cryptographic negotiation, and Cisco IOS-XE implementation of site-to-site IPsec Virtual Private Networks.',
      topic: rawTopic,
      difficulty: difficulty || 'intermediate',
      estimatedMinutes: 25,
      tags: ['IPsec', 'Security', 'VPN', 'Cryptography', 'IOS-XE'],
      prerequisites: [
        'IPv4 routing fundamentals (static and dynamic routes)',
        'Understanding of transport layer protocols (UDP 500/4500 and IP protocol 50)',
        'Basic symmetric vs asymmetric cryptography concepts',
      ],
      learningObjectives: [
        'Differentiate between IKE Phase 1 (ISAKMP SA) and Phase 2 (IPsec SA) negotiation processes.',
        'Configure policy-based or route-based (VTI) IPsec tunnels on Cisco IOS-XE.',
        'Analyze IPsec packet headers (ESP vs AH) and understand NAT-Traversal encapsulation.',
        'Verify tunnel operational status using show crypto commands and troubleshoot Phase 1/2 failures.',
      ],
      sections: [
        {
          id: 'sec-1-fundamentals',
          title: '1. IPsec Protocol Suite Architecture: IKEv1 vs IKEv2',
          explanation: 'Internet Protocol Security (**IPsec**) is an open framework operating at Layer 3 (RFC 4301) providing confidentiality, data integrity, origin authentication, and anti-replay protection over untrusted networks.\n\n### The Two-Phase Negotiation Architecture\n1. **Phase 1 (IKE SA / ISAKMP):** Authenticates the two peer gateways and establishes an encrypted management channel (`UDP 500` or `UDP 4500` for NAT-T). Negotiates the HAGLE parameters: **Hash** (SHA-256), **Authentication** (Pre-Shared Key or RSA Digital Signatures), **Group** (Diffie-Hellman Group 14/19/21), **Lifetime**, and **Encryption** (AES-GCM-256).\n2. **Phase 2 (IPsec SA / Quick Mode):** Establishes unidirectional security associations for user data traffic. Negotiates the **Transform Set** (e.g., `esp-aes 256 esp-sha256-hmac`) and proxy identities (interesting traffic access-lists or VTI endpoints).\n\n```text\n[Branch Router]  <--- IKE Phase 1 (Control Plane) --->  [Headquarters Router]\n       |         <--- IKE Phase 2 (Data Plane SAs) --->         |\n   Subnet A             [Encrypted ESP Packets]             Subnet B\n```',
          terminology: [
            { term: 'ISAKMP', definition: 'Internet Security Association and Key Management Protocol (RFC 2408); handles Phase 1 security associations.' },
            { term: 'ESP (Protocol 50)', definition: 'Encapsulating Security Payload (RFC 4303); provides payload encryption, integrity, and replay protection.' },
            { term: 'Diffie-Hellman', definition: 'Asymmetric key agreement protocol that enables two peers to calculate a shared secret over an insecure medium.' },
          ],
          commands: [
            {
              platform: 'Cisco IOS-XE',
              description: 'Configure IKEv2 Proposal and Policy for Phase 1 negotiation',
              command: 'crypto ikev2 proposal IKEV2_PROPOSAL\n encryption aes-gcm-256\n prf sha256\n group 19\n!\ncrypto ikev2 policy IKEV2_POLICY\n proposal IKEV2_PROPOSAL',
              expectedOutput: 'Router(config)# crypto ikev2 policy IKEV2_POLICY\nRouter(config-ikev2-policy)# proposal IKEV2_PROPOSAL',
              notes: 'Group 19 provides 256-bit Elliptic Curve Diffie-Hellman for high security and fast computation.',
            },
          ],
        },
        {
          id: 'sec-2-implementation',
          title: '2. Route-Based VTI Configuration & NAT-Traversal',
          explanation: 'Modern enterprise deployments prefer **Virtual Tunnel Interfaces (VTI)** over legacy crypto maps because VTIs support dynamic routing protocols (OSPF, BGP) and eliminate access-list maintenance.\n\n### NAT-Traversal (NAT-T) Mechanics\nWhen an IPsec gateway sits behind a PAT device, IP Protocol 50 (ESP) headers lack transport-layer port numbers. NAT-T dynamically detects intermediary NAT devices during Phase 1 (RFC 3948) and floats traffic from `UDP 500` to `UDP 4500`, encapsulating the ESP packet inside a UDP header so stateful firewalls can track and forward sessions.\n\n```ios\ninterface Tunnel1\n ip address 10.255.255.1 255.255.255.252\n ip mtu 1400\n ip tcp adjust-mss 1360\n tunnel source GigabitEthernet0/0/0\n tunnel mode ipsec ipv4\n tunnel destination 198.51.100.2\n tunnel protection ipsec profile IPSEC_PROFILE\n```',
          terminology: [
            { term: 'SVTI', definition: 'Static Virtual Tunnel Interface; a point-to-point Layer 3 virtual interface protected by an IPsec profile.' },
            { term: 'TCP MSS Adjustment', definition: 'Reduces the Maximum Segment Size (`ip tcp adjust-mss 1360`) to avoid IP packet fragmentation caused by IPsec header overhead.' },
          ],
          commands: [
            {
              platform: 'Cisco IOS-XE',
              description: 'Verify active IPsec Phase 2 Security Associations and packet counters',
              command: 'show crypto ipsec sa interface Tunnel1',
              expectedOutput: 'interface: Tunnel1\n    Crypto map tag: Tunnel1-head-0, local addr 198.51.100.1\n   protected vrf: (none)\n   local  ident (addr/mask/prot/port): (0.0.0.0/0.0.0.0/0/0)\n   remote ident (addr/mask/prot/port): (0.0.0.0/0.0.0.0/0/0)\n   #pkts encaps: 142091, #pkts encrypt: 142091, #pkts digest: 142091\n   #pkts decaps: 139882, #pkts decrypt: 139882, #pkts verify: 139882\n   #send errors 0, #recv errors 0',
              notes: 'Confirm that `#pkts encaps` and `#pkts decaps` are incrementing symmetrically without send/recv errors.',
            },
          ],
          practicalScenario: {
            title: 'Diagnosing Asymmetric Traffic Drops Across Tunnel Ingress',
            description: 'Packets over 1400 bytes are dropped silently across an enterprise WAN edge due to DF (Don\'t Fragment) bit set on host workstations.',
            packetFlow: 'Client (192.168.1.50) -> Router Ingress -> Tunnel0 MTU 1400 Check -> DF Bit = 1 -> ICMP Type 3 Code 4 (Fragmentation Needed) generated -> Client throttles MSS to 1360.',
            troubleshootingSteps: [
              'Execute `show crypto ikev2 sa` to confirm Phase 1 is established in READY state.',
              'Check `show crypto ipsec sa` for non-zero `#send errors` or `#recv errors`.',
              'Verify MTU clamping with `ip tcp adjust-mss 1360` on the ingress interface.',
              'Use `ping 10.255.255.2 size 1400 df-bit` to test path MTU threshold.',
            ],
            commonMistakes: [
              {
                mistake: 'Failing to configure TCP MSS clamping on tunnel interfaces.',
                cause: 'IPsec encapsulation adds up to 73 bytes of overhead (ESP header, IV, trailer, outer IP header), exceeding 1500-byte physical Ethernet MTU.',
                prevention: 'Always configure `ip mtu 1400` and `ip tcp adjust-mss 1360` on Tunnel interfaces.',
              },
            ],
          },
        },
      ],
      knowledgeChecks: [
        {
          id: 'check-1-phase-identification',
          question: 'During IPsec tunnel negotiation between two enterprise firewalls, which protocol and port are used when NAT-Traversal (NAT-T) is activated?',
          options: [
            { id: 'A', text: 'ESP (IP Protocol 50) directly over Layer 3' },
            { id: 'B', text: 'UDP port 4500 with ESP encapsulated inside UDP packets' },
            { id: 'C', text: 'TCP port 443 with TLS wrapper' },
            { id: 'D', text: 'UDP port 500 without header modification' },
          ],
          correctOptionId: 'B',
          explanation: 'When intermediate NAT devices are detected during IKE Phase 1, both peers float communication to UDP port 4500 (RFC 3948). ESP packets are encapsulated inside UDP headers so port-address-translation firewalls can track and forward state.',
        },
        {
          id: 'check-2-crypto-verification',
          question: 'An engineer executes "show crypto ipsec sa" and observes that "#pkts encaps" is steadily increasing while "#pkts decaps" remains at zero. What is the most probable cause?',
          options: [
            { id: 'A', text: 'Phase 1 Diffie-Hellman group negotiation failed' },
            { id: 'B', text: 'The local router is encrypting traffic, but return traffic is blocked upstream or the remote peer is dropping packets' },
            { id: 'C', text: 'The transform set AES encryption keys do not match' },
            { id: 'D', text: 'The tunnel interface MTU is configured too high' },
          ],
          correctOptionId: 'B',
          explanation: 'Non-zero "#pkts encaps" indicates local packets are successfully matching the crypto policy and getting encrypted. A zero count for "#pkts decaps" means return packets are either blocked by intermediate firewalls (e.g. Protocol 50 blocked), route lookup failed at the remote side, or the remote peer is dropping ingress frames.',
        },
      ],
      summary: {
        keyTakeaways: [
          'IKE Phase 1 establishes the authenticated control plane management channel; Phase 2 establishes unidirectional data-plane SAs.',
          'VTI simplifies IPsec design by enabling dynamic routing protocols over virtual interfaces with standard MTU clamping.',
          'NAT-T encapsulates ESP in UDP port 4500 to preserve connectivity across address-translating firewalls.',
        ],
        keyTerms: [
          { term: 'IKE SA', definition: 'Bidirectional security association protecting Phase 1 key exchange messages.' },
          { term: 'IPsec SA', definition: 'Unidirectional security association defining encryption and integrity algorithms for forwarded traffic.' },
          { term: 'PFS (Perfect Forward Secrecy)', definition: 'Forces a fresh Diffie-Hellman exchange during Phase 2 to prevent past sessions from being decrypted if long-term keys are compromised.' },
        ],
        whatYouLearned: 'You have mastered the foundational cryptographic architecture of IPsec, the two-phase negotiation lifecycle, modern VTI tunnel configuration on Cisco IOS-XE, and systematic CLI verification techniques.',
        suggestedNextTopics: [
          'DMVPN (Dynamic Multipoint VPN) Phase 1, 2, and 3',
          'Cisco SD-WAN IPsec Overlay Routing and OMP',
          'BGP Peering over Route-Based IPsec Tunnels',
        ],
      },
    }, null, 2);
  }

  // Generic networking topic generator for any user-supplied topic
  return JSON.stringify({
    lessonTitle: `${rawTopic}: Architectural Principles & Practical Engineering`,
    shortDescription: `A comprehensive engineering guide to ${rawTopic}, covering protocol operations, real-world ${platform} configurations, packet mechanics, and systematic troubleshooting.`,
    topic: rawTopic,
    difficulty: difficulty || 'intermediate',
    estimatedMinutes: 20,
    tags: [rawTopic.split(' ')[0], 'Networking', 'Protocols', difficulty, platform.split(' ')[0]],
    prerequisites: [
      'Layer 2 Ethernet framing and Layer 3 IP addressing fundamentals',
      'Basic familiarity with command-line interface navigation on network devices',
    ],
    learningObjectives: [
      `Analyze the core protocol mechanisms and RFC architectural foundations of ${rawTopic}.`,
      `Implement standard operational configurations on ${platform}.`,
      `Execute systematic verification commands to inspect state tables and packet forwarding.`,
      `Diagnose and remediate common production configuration and inter-op failures.`,
    ],
    sections: [
      {
        id: 'sec-1-foundations',
        title: `1. Core Architectural Concepts of ${rawTopic}`,
        explanation: `### Theoretical Overview\n\nIn enterprise and service provider networks, **${rawTopic}** plays an essential operational role. Understanding the control-plane signaling and data-plane forwarding characteristics ensures resilient, high-availability network designs.\n\nKey characteristics include:\n- **Deterministic State Transitions:** Operates according to strict protocol finite-state machines.\n- **Encapsulation & Overhead:** Preserves standard packet boundaries while optimizing throughput.\n- **Control Plane Decoupling:** Isolates routing/signaling topology discovery from line-rate packet switching.`,
        terminology: [
          { term: `${rawTopic} Engine`, definition: 'The core state machine responsible for processing and maintaining protocol state.' },
          { term: 'Convergence Time', definition: 'The duration required for all participating routers to reach a synchronized, consistent network state.' },
        ],
        commands: [
          {
            platform: platform,
            description: `Enable and configure basic ${rawTopic} service parameters`,
            command: `# Configure ${rawTopic}\nconfigure terminal\n! Platform: ${platform}`,
            expectedOutput: 'Configuration mode enabled. State updated successfully.',
            notes: 'Verify interface link operational status before applying changes.',
          },
        ],
      },
      {
        id: 'sec-2-verification',
        title: '2. Operational Verification & Troubleshooting Framework',
        explanation: `### Verification Methodology\n\nSystematic engineering requires verifying state at each layer of the OSI model:\n\n1. **Physical & Data Link:** Confirm link integrity and error-free frame counts.\n2. **Protocol Adjacency / State:** Confirm neighbor relationships and database synchronization.\n3. **Forwarding Table (FIB):** Validate that computed best paths install properly into the hardware Forwarding Information Base.\n\n\`\`\`text\n[Verify Physical] -> [Verify Protocol State] -> [Validate FIB / Hardware CEF]\n\`\`\``,
        terminology: [
          { term: 'CEF (Cisco Express Forwarding)', definition: 'Hardware-accelerated packet switching engine utilizing the FIB and Adjacency Table.' },
        ],
        commands: [
          {
            platform: platform,
            description: 'Inspect running protocol status and operational state counters',
            command: `show status | include ${rawTopic.split(' ')[0]}`,
            expectedOutput: `Status: ACTIVE, Protocol State: SYNCHRONIZED, Errors: 0`,
            notes: 'Examine packet drop counters and error logs for intermittent anomalies.',
          },
        ],
        practicalScenario: {
          title: `Troubleshooting Common ${rawTopic} Anomalies`,
          description: `Diagnosing silent packet drops or adjacency stalls in a multi-vendor campus environment.`,
          packetFlow: 'Client Ingress -> Ingress Interface Validation -> Control Policy Match -> Egress Forwarding.',
          troubleshootingSteps: [
            'Confirm Layer 1/2 physical link stability and MTU parity.',
            'Review protocol timer consistency between local and remote peers.',
            'Check access-lists or control plane policing (CoPP) filters.',
          ],
          commonMistakes: [
            {
              mistake: 'Mismatched MTU or parameter mismatch between adjacent peers.',
              cause: 'Protocols validate identical interface parameters before transitioning to an operational state.',
              prevention: 'Enforce standard automation templates and verify interface parameters prior to deployment.',
            },
          ],
        },
      },
    ],
    knowledgeChecks: [
      {
        id: 'check-1-concept',
        question: `When deploying ${rawTopic}, what is the primary consideration regarding MTU and packet encapsulation?`,
        options: [
          { id: 'A', text: 'Encapsulation overhead may require MTU or TCP MSS adjustment to prevent fragmentation' },
          { id: 'B', text: 'MTU has no effect on protocol operations' },
          { id: 'C', text: 'Packets exceeding physical MTU are automatically compressed without overhead' },
          { id: 'D', text: 'All modern routers discard packets under 1500 bytes' },
        ],
        correctOptionId: 'A',
        explanation: 'Any tunneling or protocol encapsulation adds header bytes to original packets. If total size exceeds path MTU and the DF bit is set, packets are dropped, making MTU and TCP MSS clamping critical.',
      },
      {
        id: 'check-2-troubleshooting',
        question: `Which diagnostic step is most effective for isolating an adjacency failure in ${rawTopic}?`,
        options: [
          { id: 'A', text: 'Rebooting the core switch immediately' },
          { id: 'B', text: 'Inspecting interface error counters, parameter parity, and protocol debug logs' },
          { id: 'C', text: 'Disabling all firewall rules globally' },
          { id: 'D', text: 'Changing the subnet mask on unrelated interfaces' },
        ],
        correctOptionId: 'B',
        explanation: 'Methodical network troubleshooting requires verifying interface state, checking parameter consistency (timers, area/AS IDs, authentication), and analyzing protocol debug output before taking disruptive actions.',
      },
    ],
    summary: {
      keyTakeaways: [
        `Understand the fundamental architectural principles and packet mechanics of ${rawTopic}.`,
        `Apply standard ${platform} commands for configuration and verification.`,
        'Follow structured OSI-model troubleshooting when diagnosing protocol anomalies.',
      ],
      keyTerms: [
        { term: 'Control Plane', definition: 'Protocols and logic that build routing and switching tables.' },
        { term: 'Data Plane', definition: 'Hardware infrastructure responsible for moving packets from ingress to egress.' },
      ],
      whatYouLearned: `You have successfully completed the structured lesson on ${rawTopic}, gaining practical knowledge of its operational architecture, configuration syntax, and verification best practices.`,
      suggestedNextTopics: [
        'Advanced Network Security & Hardening',
        'High-Availability Architecture (HSRP / VRRP)',
        'Network Automation with Python and RESTCONF',
      ],
    },
  }, null, 2);
}

/**
 * Deterministically generates high-yield networking flashcards for Milestone 3 & Standalone Flashcard mock testing.
 */
function generateMockStructuredFlashcards(userPrompt: string): string {
  const titleMatch = userPrompt.match(/LESSON_TITLE:\s*([^\r\n]+)/i);
  const topicMatch = userPrompt.match(/TOPIC:\s*([^\r\n]+)/i);
  const countMatch = userPrompt.match(/REQUESTED_CARD_COUNT:\s*(\d+)/i);
  const focusMatch = userPrompt.match(/FOCUS_AREA:\s*([^\r\n]+)/i);
  const emphasisMatch = userPrompt.match(/CONTENT_EMPHASIS:\s*([^\r\n]+)/i);

  const rawTopic = topicMatch ? topicMatch[1].trim() : 'Networking Fundamentals';
  const rawTitle = titleMatch ? titleMatch[1].trim() : rawTopic;
  const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 10;
  const count = Math.min(Math.max(requestedCount, 3), 25);
  const focus = focusMatch ? focusMatch[1].trim() : 'Comprehensive';
  const emphasis = emphasisMatch ? emphasisMatch[1].trim() : '';

  const cardTemplates = [
    {
      frontMarkdown: `What is the fundamental architectural role of **${rawTopic}** in enterprise networking?`,
      backMarkdown: `**${rawTopic}** provides deterministic control-plane signaling and data-plane packet delivery. It establishes protocol state boundaries and maintains synchronized forwarding information bases across routers without causing forwarding loops.`,
      tags: [rawTopic.split(' ')[0], 'Architecture', 'Control Plane'],
    },
    {
      frontMarkdown: `In **${rawTopic}**, what occurs at the data plane when packet size exceeds the path MTU and the DF (Don't Fragment) bit is set?`,
      backMarkdown: `The egress router **discards the packet** and transmits an \`ICMP Destination Unreachable (Type 3, Code 4: Fragmentation Needed)\` message back to the source host with the next-hop interface MTU value, triggering Path MTU Discovery (PMTUD).`,
      tags: [rawTopic.split(' ')[0], 'MTU', 'ICMP', 'Data Plane'],
    },
    {
      frontMarkdown: `Which primary Cisco IOS-XE verification command is used to inspect operational status and interface state for **${rawTopic}**?`,
      backMarkdown: `\`\`\`bash\nshow ip interface brief\nshow operational-state | include ${rawTopic.split(' ')[0]}\n\`\`\`\nVerifies Layer 1 physical link status (\`up\`) and Layer 2 line protocol encapsulation (\`up\`) before inspecting protocol-specific neighbors.`,
      tags: [rawTopic.split(' ')[0], 'Cisco IOS-XE', 'CLI', 'Verification'],
    },
    {
      frontMarkdown: `What is the difference between Control Plane and Data Plane operations in **${rawTopic}**?`,
      backMarkdown: `- **Control Plane:** Routing protocols, neighbor discovery, and signaling (CPU-processed) that calculate the Routing Information Base (RIB).\n- **Data Plane:** Line-rate hardware ASICs (Cisco Express Forwarding / FIB) that match destination IP addresses and perform frame rewrites for egress transmission.`,
      tags: ['Architecture', 'CEF', 'Control Plane', 'Data Plane'],
    },
    {
      frontMarkdown: `How does **${rawTopic}** handle peer parameter mismatch during initial state negotiation?`,
      backMarkdown: `Peer parameters (such as authentication keys, area IDs, timers, or MTU) are exchanged during initial hello/negotiation packets. If parameters mismatch, the adjacency fails to reach full synchronization and typically remains stuck in an \`INIT\` or \`DOWN\` state.`,
      tags: [rawTopic.split(' ')[0], 'Troubleshooting', 'State Machine'],
    },
    {
      frontMarkdown: `Which Linux command can be used to trace packet hop progression and verify Layer 3 connectivity to **${rawTopic}** peers?`,
      backMarkdown: `\`\`\`bash\nip route show\ntraceroute -n <target-ip>\n\`\`\`\nDisplays the local kernel routing table and isolates the exact hop where latency spikes or silent packet drops occur.`,
      tags: ['Linux', 'iproute2', 'CLI', 'Troubleshooting'],
    },
    {
      frontMarkdown: `When troubleshooting intermittent packet loss in **${rawTopic}**, which interface counters should be examined first?`,
      backMarkdown: `Inspect \`show interfaces <name>\` for:\n1. **Input/Output Errors & CRC drops:** Indicates duplex mismatch, physical cable faults, or faulty SFP optics.\n2. **Ignored/Overrun counters:** Indicates hardware buffer exhaustion under heavy burst traffic.`,
      tags: ['Troubleshooting', 'Layer 1/2', 'Cisco IOS-XE'],
    },
    {
      frontMarkdown: `What is the significance of the "Magic Number" in IPv4 subnet boundary calculations?`,
      backMarkdown: `The **Magic Number** is calculated as \`256 - [interesting octet subnet mask]\`. It reveals the exact block size (increment) between consecutive subnet IDs, allowing rapid mental calculation of network IDs, first/last usable addresses, and broadcast IPs.`,
      tags: ['Subnetting', 'IPv4', 'Addressing'],
    },
    {
      frontMarkdown: `In secure network architectures, why is TCP MSS clamping recommended when tunneling **${rawTopic}** over IPsec?`,
      backMarkdown: `IPsec encapsulation (ESP headers, IV, padding, and outer IP header) adds **50-73+ bytes** of overhead. Clamping TCP MSS (\`ip tcp adjust-mss 1360\`) forces TCP clients to negotiate smaller segment sizes, avoiding silent drops of packets with the DF bit set.`,
      tags: ['IPsec', 'Security', 'MTU', 'TCP MSS'],
    },
    {
      frontMarkdown: `What is the primary design recommendation for high-availability deployments of **${rawTopic}**?`,
      backMarkdown: `Implement redundant physical uplinks with dynamic first-hop redundancy (HSRP/VRRP) or multi-chassis link aggregation (vPC/EtherChannel), combined with sub-second failover protocols like BFD (Bidirectional Forwarding Detection) to avoid single points of failure.`,
      tags: ['High Availability', 'Design', 'Resilience'],
    },
    {
      frontMarkdown: `What debug command safely analyzes protocol packet exchanges without saturating the router CPU?`,
      backMarkdown: `\`\`\`bash\n# Apply conditional debugging before enabling debugs\ndebug condition interface GigabitEthernet0/1\ndebug condition ip <neighbor-ip>\n\`\`\`\nRestricts debug output strictly to the targeted neighbor or interface, preventing CPU lockup.`,
      tags: ['Debugging', 'CLI', 'Cisco IOS-XE'],
    },
    {
      frontMarkdown: `In **${rawTopic}**, what role does Keepalive / Dead Timer play in failure detection?`,
      backMarkdown: `Periodic keepalive or hello messages verify bidirectional link health. If no keepalives are received within the Dead Interval (typically $3\\times$ or $4\\times$ the hello interval), the neighbor is declared dead and routes are promptly purged from the routing table.`,
      tags: [rawTopic.split(' ')[0], 'Timers', 'State Machine'],
    },
    {
      frontMarkdown: `How does encapsulation and decapsulation function across OSI boundaries for **${rawTopic}**?`,
      backMarkdown: `As data moves down the stack, headers are appended: Layer 4 appends TCP/UDP ports, Layer 3 appends IP addresses, and Layer 2 appends source/destination MAC addresses and Frame Check Sequence (FCS). Decapsulation strips each layer upon verification at the destination.`,
      tags: [rawTopic.split(' ')[0], 'Encapsulation', 'OSI Model'],
    },
    {
      frontMarkdown: `What CLI command verifies Layer 2 MAC address learning table entries in relation to **${rawTopic}**?`,
      backMarkdown: `\`\`\`bash\nshow mac address-table dynamic\nshow mac address-table aging-time\n\`\`\`\nValidates that ingress switchports populate dynamic MAC entries with expected VLAN associations and default 300-second aging timers.`,
      tags: ['Layer 2', 'Switching', 'CLI'],
    },
    {
      frontMarkdown: `What is the impact of an Administrative Distance (AD) value in route selection for **${rawTopic}**?`,
      backMarkdown: `Administrative Distance ranks the trustworthiness of route sources when identical prefixes are learned from multiple protocols (e.g. Connected: 0, Static: 1, eBGP: 20, OSPF: 110, iBGP: 200). The lowest AD always wins insertion into the routing table.`,
      tags: ['Routing', 'Administrative Distance', 'RIB'],
    },
    {
      frontMarkdown: `How does 802.1Q trunking tag frames to identify VLAN membership for **${rawTopic}**?`,
      backMarkdown: `802.1Q inserts a 4-byte tag into the standard Ethernet header containing a 12-bit VLAN Identifier (VID, supporting VLANs 1-4094) and 3-bit Priority Code Point (PCP). Native VLAN frames remain untagged by default across the trunk.`,
      tags: ['VLAN', 'Trunking', '802.1Q'],
    },
    {
      frontMarkdown: `When configuring Access Control Lists (ACLs) to secure **${rawTopic}**, what is the implicit behavior at the end of every list?`,
      backMarkdown: `Every Cisco ACL terminates with an implicit \`deny ip any any\` rule. Traffic not explicitly permitted is silently dropped unless preceded by an explicit \`permit\` statement.`,
      tags: ['Security', 'ACL', 'Filtering'],
    },
    {
      frontMarkdown: `What is the role of Bidirectional Forwarding Detection (BFD) when paired with **${rawTopic}**?`,
      backMarkdown: `BFD offloads sub-second failure detection (down to 50ms intervals) from protocol hello timers directly into hardware, allowing routing protocols like OSPF or BGP to trigger rapid convergence before interface carrier-delay timers expire.`,
      tags: ['BFD', 'Convergence', 'High Availability'],
    },
    {
      frontMarkdown: `How does spanning-tree protocol (STP) prevent Layer 2 forwarding loops in topologies supporting **${rawTopic}**?`,
      backMarkdown: `STP exchanges Bridge Protocol Data Units (BPDUs) to elect a Root Bridge, determine Root and Designated Ports, and transition redundant ports into an alternate/blocking state to ensure a loop-free logical tree structure.`,
      tags: ['STP', 'Loop Prevention', 'Layer 2'],
    },
    {
      frontMarkdown: `What is the difference between TCP and UDP transport layer headers relevant to **${rawTopic}**?`,
      backMarkdown: `- **TCP:** 20-byte minimum header, connection-oriented 3-way handshake, sequence/acknowledgment numbers, windowing flow control.\n- **UDP:** 8-byte fixed header, connectionless best-effort delivery, minimal latency without retransmission overhead.`,
      tags: ['Transport Layer', 'TCP', 'UDP'],
    },
    {
      frontMarkdown: `Which command enables detailed logging for security and operational events relating to **${rawTopic}**?`,
      backMarkdown: `\`\`\`bash\nlogging buffered 64000 informational\nlogging synchronous\nservice timestamps log datetime msec\n\`\`\`\nConfigures high-resolution millisecond timestamps and buffered event retention without disrupting CLI command entry.`,
      tags: ['Syslog', 'Operations', 'CLI'],
    },
    {
      frontMarkdown: `How does Network Address Translation (NAT / PAT) preserve routable IPv4 space for **${rawTopic}**?`,
      backMarkdown: `Port Address Translation (Overload) maps multiple private RFC 1918 internal IP addresses to a single public IP address by tracking unique Layer 4 source port combinations in the NAT translation state table.`,
      tags: ['NAT', 'PAT', 'Addressing'],
    },
    {
      frontMarkdown: `What verification step determines if a routing loop has formed during **${rawTopic}** convergence?`,
      backMarkdown: `Check for rapidly decrementing IP Time-to-Live (TTL) values, \`ICMP Time Exceeded (Type 11, Code 0)\` error messages in packet captures, and oscillating routing table change counters across participating routers.`,
      tags: ['Troubleshooting', 'TTL', 'Routing Loop'],
    },
    {
      frontMarkdown: `How does Quality of Service (QoS) Differentiated Services Code Point (DSCP) prioritize traffic for **${rawTopic}**?`,
      backMarkdown: `DSCP uses the 6-bit Differentiated Services field in the IPv4/IPv6 header (providing 64 traffic classes), categorizing packets into Best Effort, Assured Forwarding (AF), or Expedited Forwarding (EF - DSCP 46) for strict priority queueing.`,
      tags: ['QoS', 'DSCP', 'Traffic Management'],
    },
    {
      frontMarkdown: `What systematic 5-step troubleshooting methodology should be applied to resolve **${rawTopic}** failures?`,
      backMarkdown: `1. Define problem symptoms and scope.\n2. Verify Layer 1 physical link and Layer 2 carrier encapsulation.\n3. Verify Layer 3 IP addressing, subnet masks, and local ARP entries.\n4. Confirm routing protocol neighbor adjacencies and RIB installation.\n5. Test end-to-end transport reachability and review firewall/ACL drop counters.`,
      tags: ['Troubleshooting', 'Methodology', 'Diagnostics'],
    },
  ];

  // Select required number of cards without duplicates
  const selectedCards = [];
  for (let i = 0; i < count; i++) {
    const template = cardTemplates[i % cardTemplates.length];
    selectedCards.push({
      frontMarkdown: template.frontMarkdown,
      backMarkdown: template.backMarkdown,
      tags: template.tags,
      orderIndex: i,
    });
  }

  const descSuffix = emphasis ? ` with emphasis on ${emphasis}` : '';

  return JSON.stringify({
    title: `${rawTitle} - Flashcards`,
    description: `High-yield active recall flashcard deck for ${rawTitle}. Covers core protocol architecture, CLI commands, and systematic troubleshooting (${focus})${descSuffix}.`,
    cards: selectedCards,
  }, null, 2);
}

/**
 * Generates mock structured quiz data across all 4 question types
 * (single_choice, multiple_select, true_false, scenario).
 */
function generateMockStructuredQuiz(userPrompt: string): string {
  const topicMatch = userPrompt.match(/TOPIC:\s*([^\r\n]+)/i);
  const countMatch = userPrompt.match(/REQUESTED_QUESTION_COUNT:\s*(\d+)/i);
  const diffMatch = userPrompt.match(/DIFFICULTY:\s*([^\r\n]+)/i);
  const titleMatch = userPrompt.match(/LESSON_TITLE:\s*([^\r\n]+)/i);
  const lessonIdMatch = userPrompt.match(/LESSON_ID:\s*([^\r\n]+)/i);

  const rawTopic = topicMatch ? topicMatch[1].trim() : 'Network Fundamentals';
  const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 5;
  const count = Math.min(Math.max(requestedCount, 3), 25);
  const difficulty = diffMatch ? diffMatch[1].trim().toLowerCase() : 'medium';
  const lessonTitle = titleMatch ? titleMatch[1].trim() : null;
  const lessonId = lessonIdMatch ? lessonIdMatch[1].trim() : null;

  const quizTitle = lessonTitle
    ? `${lessonTitle} — Knowledge Assessment`
    : `${rawTopic} Technical Assessment`;

  const questionTemplates = [
    {
      type: 'single_choice',
      question: `In enterprise networks deploying **${rawTopic}**, which mechanism ensures loop-free path determination at Layer 3?`,
      options: [
        { id: 'A', text: 'Spanning Tree Protocol (STP) Bridge Protocol Data Units (BPDUs)' },
        { id: 'B', text: 'Counting hops with split-horizon and poison reverse only' },
        { id: 'C', text: 'Shortest Path First (SPF) Dijkstra algorithm or Path Vector AS-Path inspection' },
        { id: 'D', text: 'Equal-Cost Multi-Path hashing at the ingress hardware ASIC' },
      ],
      correctAnswer: 'C',
      explanation: "Layer 3 loop prevention in link-state (OSPF/IS-IS) uses Dijkstra's SPF calculation on an identical LSDB, while BGP uses the AS_PATH attribute to reject routes containing the local AS number.",
    },
    {
      type: 'multiple_select',
      question: `Which two of the following operational parameters must align between peering devices to establish a healthy **${rawTopic}** session? (Choose two)`,
      options: [
        { id: 'A', text: 'Matching Subnet Mask / IP prefix on the interconnecting link' },
        { id: 'B', text: 'Identical Hostnames across both peer devices' },
        { id: 'C', text: 'Matching Keepalive / Hello and Hold / Dead timers' },
        { id: 'D', text: 'Identical Local Interface MAC addresses' },
      ],
      correctAnswer: ['A', 'C'],
      explanation: 'Routing protocols require compatible IP subnet boundaries and synchronized keepalive/dead timer intervals. Hostnames and interface MAC addresses must remain unique.',
    },
    {
      type: 'true_false',
      question: `When operating with **${rawTopic}**, an interface configured with a passive state will still form active adjacencies with neighboring routers if unicast packets are sent directly to its IP.`,
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
      correctAnswer: false,
      explanation: 'Passive interface configuration suppresses all hello packet transmission and ignores inbound hellos, preventing neighbor adjacencies from forming on that link while still advertising the connected subnet.',
    },
    {
      type: 'scenario',
      scenarioContext: `A network engineer observes that two routers running **${rawTopic}** are stuck in an INIT or ExStart state. Running 'show ip interface brief' confirms Layer 1 and Layer 2 are UP. Ping tests with default 100-byte packets succeed with 0% packet loss.`,
      question: `What is the most likely root cause preventing the routers from reaching a FULL operational state?`,
      options: [
        { id: 'A', text: 'Interface MTU mismatch between the two neighboring routers' },
        { id: 'B', text: 'BGP synchronization is enabled on both routers' },
        { id: 'C', text: 'Duplicate loopback IP addresses configured on the edge devices' },
        { id: 'D', text: 'Layer 2 ARP cache timeout on the intermediate switch' },
      ],
      correctAnswer: 'A',
      explanation: 'Small ping packets succeed, but Database Description (DBD) packets or large state exchanges require full MTU transmission. An MTU mismatch allows hello exchanges but halts the state machine at ExStart/Exchange when DBD packets are dropped.',
    },
    {
      type: 'single_choice',
      question: `Which Cisco IOS-XE verification command provides the definitive summary of protocol state and neighbor status for **${rawTopic}**?`,
      options: [
        { id: 'A', text: 'show running-config | section interface' },
        { id: 'B', text: 'show ip protocols && show ip route summary' },
        { id: 'C', text: 'show version' },
        { id: 'D', text: 'traceroute 8.8.8.8' },
      ],
      correctAnswer: 'B',
      explanation: "'show ip protocols' provides configured protocol parameters, metric weights, and administrative distances, while 'show ip route summary' validates route table population.",
    },
  ];

  const questions = [];
  for (let i = 0; i < count; i++) {
    const tmpl = questionTemplates[i % questionTemplates.length];
    questions.push({
      id: `q-${i + 1}`,
      type: tmpl.type,
      question: tmpl.question,
      scenarioContext: tmpl.scenarioContext,
      options: tmpl.options,
      correctAnswer: tmpl.correctAnswer,
      explanation: tmpl.explanation,
      orderIndex: i,
    });
  }

  return JSON.stringify({
    title: quizTitle,
    topic: rawTopic,
    difficulty,
    lessonId,
    lessonTitle,
    questions,
  }, null, 2);
}

/**
 * Deterministically constructs a rich, technically accurate ProtocolSimulationScenario JSON object
 * tailored to the requested networking topic and protocol for offline testing and local dev.
 */
function generateMockStructuredSimulation(userPrompt: string): string {
  const topicMatch = userPrompt.match(/TOPIC:\s*([^\r\n]+)/i);
  const protoMatch = userPrompt.match(/PROTOCOL:\s*([^\r\n]+)/i);
  const certMatch = userPrompt.match(/CERTIFICATION:\s*([^\r\n]+)/i);
  const diffMatch = userPrompt.match(/DIFFICULTY:\s*([^\r\n]+)/i);

  const rawTopic = topicMatch ? topicMatch[1].trim() : 'OSPF Area ID Mismatch';
  const protocol = protoMatch ? protoMatch[1].trim().toUpperCase() : 'OSPF';
  const certification = certMatch ? certMatch[1].trim() : 'CCNA';
  const difficulty = diffMatch ? diffMatch[1].trim() : 'Intermediate';

  const slug = rawTopic.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
  const id = `ai-sim-${slug}`;

  return JSON.stringify(
    {
      metadata: {
        id,
        title: rawTopic,
        certification: certification === 'CCNP' ? 'CCNP' : 'CCNA',
        protocol: protocol.includes('BGP')
          ? 'BGP'
          : protocol.includes('VLAN')
          ? 'VLAN'
          : protocol.includes('ARP')
          ? 'ARP'
          : protocol.includes('TCP')
          ? 'TCP'
          : 'OSPF',
        difficulty:
          difficulty === 'Advanced' ? 'Advanced' : difficulty === 'Beginner' ? 'Beginner' : 'Intermediate',
        description: `Automated interactive simulation and Cisco IOS break-fix laboratory exploring ${rawTopic}.`,
        keyConcepts: [
          `${rawTopic} Protocol Wire Mechanics`,
          'Header Encapsulation & State Transitions',
          'Cisco IOS Verification & Remediation',
        ],
      },
      topology: {
        nodes: [
          {
            id: 'r1-hq',
            name: 'R1-HQ',
            type: 'router',
            interfaces: [
              {
                name: 'Gi0/0',
                ip: '10.10.10.1',
                mac: '00:1A:2B:3C:4D:01',
                subnetMask: '255.255.255.252',
              },
            ],
            tableState: {
              arpCache: [],
              routingTable: [
                { network: '10.10.10.0', mask: '255.255.255.252', interface: 'Gi0/0', protocol: 'C' },
              ],
              ospfNeighbors: [],
              tcpState: 'CLOSED',
            },
            position: { x: 90, y: 150 },
          },
          {
            id: 'r2-branch',
            name: 'R2-Branch',
            type: 'router',
            interfaces: [
              {
                name: 'Gi0/0',
                ip: '10.10.10.2',
                mac: '00:1A:2B:3C:4D:02',
                subnetMask: '255.255.255.252',
              },
            ],
            tableState: {
              arpCache: [],
              routingTable: [
                { network: '10.10.10.0', mask: '255.255.255.252', interface: 'Gi0/0', protocol: 'C' },
              ],
              ospfNeighbors: [],
              tcpState: 'CLOSED',
            },
            position: { x: 380, y: 150 },
          },
        ],
        links: [
          {
            id: 'link-1',
            sourceNodeId: 'r1-hq',
            targetNodeId: 'r2-branch',
            linkSpeed: '1 Gbps',
            label: 'Gi0/0 (10.10.10.0/30)',
          },
        ],
      },
      steps: [
        {
          stepIndex: 0,
          title: `1. Diagnostic Transmission: Outbound ${protocol} Packet`,
          explanation: `R1-HQ transmits initial ${protocol} packet to R2-Branch over link Gi0/0.`,
          activeNodeId: 'r1-hq',
          targetNodeId: 'r2-branch',
          transmission: {
            fromNodeId: 'r1-hq',
            toNodeId: 'r2-branch',
            packet: {
              L2: {
                srcMac: '00:1A:2B:3C:4D:01',
                dstMac: '00:1A:2B:3C:4D:02',
                ethertype: '0x0800 (IPv4)',
              },
              L3: {
                srcIp: '10.10.10.1',
                dstIp: '10.10.10.2',
                protocol: protocol === 'OSPF' ? 'OSPF (89)' : protocol === 'BGP' ? 'TCP (6)' : 'IP',
                ttl: 64,
              },
              L4: {
                protocolType: protocol === 'OSPF' ? 'OSPF' : protocol === 'BGP' ? 'TCP' : 'ICMP',
                srcPort: protocol === 'BGP' ? 179 : 1025,
                dstPort: protocol === 'BGP' ? 179 : 80,
                ospfType: protocol === 'OSPF' ? 'Hello' : undefined,
              },
              payloadDescription: `${protocol} diagnostic transmission on link Gi0/0`,
            },
          },
          socraticCheckpoint: {
            question: `What primary header parameter determines whether ${rawTopic} reaches established status?`,
            hint: 'Examine Layer 3 and protocol-specific fields in the packet inspection ladder.',
            expectedConcept: 'Matching subnet mask, timers, and area configurations are mandatory.',
          },
        },
        {
          stepIndex: 1,
          title: `2. Response Evaluation: Neighbor State Validation`,
          explanation: `R2-Branch evaluates incoming payload and updates internal protocol state machine.`,
          activeNodeId: 'r2-branch',
          targetNodeId: 'r1-hq',
          transmission: {
            fromNodeId: 'r2-branch',
            toNodeId: 'r1-hq',
            packet: {
              L2: {
                srcMac: '00:1A:2B:3C:4D:02',
                dstMac: '00:1A:2B:3C:4D:01',
                ethertype: '0x0800 (IPv4)',
              },
              L3: {
                srcIp: '10.10.10.2',
                dstIp: '10.10.10.1',
                protocol: protocol === 'OSPF' ? 'OSPF (89)' : protocol === 'BGP' ? 'TCP (6)' : 'IP',
                ttl: 64,
              },
              L4: {
                protocolType: protocol === 'OSPF' ? 'OSPF' : protocol === 'BGP' ? 'TCP' : 'ICMP',
                srcPort: protocol === 'BGP' ? 179 : 1026,
                dstPort: protocol === 'BGP' ? 179 : 80,
                ospfType: protocol === 'OSPF' ? 'DBD' : undefined,
              },
              payloadDescription: `${protocol} state acknowledgement and status exchange`,
            },
          },
        },
      ],
      cliConfig: {
        protocolScope: protocol.includes('BGP')
          ? 'BGP'
          : protocol.includes('VLAN')
          ? 'VLAN'
          : protocol.includes('ARP')
          ? 'ARP'
          : protocol.includes('TCP')
          ? 'TCP'
          : 'OSPF',
        targetNodeId: 'r1-hq',
        promptHostname: 'R1-HQ#',
        objective: `Resolve the ${rawTopic} fault on R1-HQ to restore operational protocol state.`,
        initialConfigLines: [
          'interface GigabitEthernet0/0',
          ' ip address 10.10.10.1 255.255.255.252',
          ` ! Diagnostic state: ${rawTopic}`,
        ],
        allowedCommands: [
          {
            command: 'show running-config interface GigabitEthernet0/0',
            aliases: ['sh run int gi0/0', 'sh run interface gi0/0', 'show run int gi0/0'],
            description: 'Inspect current interface configuration',
            output: 'interface GigabitEthernet0/0\n ip address 10.10.10.1 255.255.255.252',
          },
          {
            command: 'show ip interface brief',
            aliases: ['sh ip int br', 'sh ip int brief'],
            description: 'Verify Layer 1 & 2 operational status',
            output:
              'Interface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     10.10.10.1      YES manual up                    up',
          },
          {
            command: 'remediate',
            aliases: ['fix', 'remediate fault', 'solve', 'configure fix'],
            description: 'Apply corrective configuration command for this fault',
            output: `%NETMENTOR-5-REMEDIATED: Corrective configuration applied on R1-HQ.\n%PROTOCOL-5-STATE: ${protocol} state transitioned to OPERATIONAL.`,
            tableMutations: [
              {
                nodeId: 'r1-hq',
                table: 'routing',
                action: 'add',
                data: {
                  network: '192.168.100.0',
                  mask: '255.255.255.0',
                  nextHop: '10.10.10.2',
                  interface: 'Gi0/0',
                  protocol: protocol === 'OSPF' ? 'O' : protocol === 'BGP' ? 'B' : 'S',
                },
              },
            ],
            goalAchieved: true,
          },
        ],
      },
    },
    null,
    2
  );
}



