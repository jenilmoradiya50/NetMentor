import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonOspfNeighborStates: DetailedLesson = {
            id: 'lesson-ospf-neighbor-states',
            topicId: 'topic-ospf',
            pathId: 'path-ccna',
            slug: 'ospf-neighbor-adjacencies',
            title: 'OSPF Neighbor Adjacencies: The 7-State Formation Machine',
            subtitle: 'From First Hello to Full LSDB Synchronization — and Where Engineers Get Stuck',
            difficulty: 'CCNA',
            estimatedMinutes: 20,
            learningObjectives: [
              'Trace an OSPF adjacency through all 7 states (Down, Init, 2-Way, ExStart, Exchange, Loading, Full).',
              'Distinguish between a neighbor relationship (2-Way) and a full adjacency (Full).',
              'Understand the role of Hello, DBD, LSR, LSU, and LSAck packets at each transition.',
              'Diagnose why neighbors get stuck in DOWN, 2-WAY, or EXSTART.',
            ],
            sections: [
              {
                id: 'sec-ospf-states',
                title: '1. Why Link-State Protocols Require Rigid Neighbor States',
                contentMarkdown:
                  'Distance Vector protocols like RIP periodically transmit their entire routing table to directly connected neighbors. In contrast, **OSPF is a Link-State protocol**: every router builds a complete topological map (**Link-State Database / LSDB**) of the entire area.\n\nBecause all routers in an area must possess an **identical LSDB**, forming an adjacency requires a rigid, multi-phase handshake to negotiate capabilities, elect designated routers, exchange summary databases, and synchronize link states.',
              },
              {
                id: 'sec-7-states-breakdown',
                title: '2. The 7 States Step-by-Step',
                contentMarkdown:
                  '1. **DOWN:** No Hello packets received yet from the neighbor.\n2. **INIT:** A Hello packet has been received from the neighbor, but the local router\'s own Router ID (RID) is not yet listed in the neighbor\'s Hello.\n3. **2-WAY:** Bi-directional communication is established! The router sees its own RID listed inside the neighbor\'s Hello packet.\n   - *Milestone:* On Broadcast and Non-Broadcast networks, the **DR (Designated Router)** and **BDR (Backup DR)** election occurs here.\n   - *Note:* DROTHER routers on a broadcast segment stay in **2-WAY** with each other permanently. This is normal and prevents full mesh overhead!\n4. **EXSTART:** The routers prepare to exchange LSDB summaries. They negotiate a **Master/Slave** relationship and an initial Sequence Number using empty Database Description (DBD) packets. The router with the **higher Router ID becomes the Master**.\n5. **EXCHANGE:** Routers send DBD packets containing summary lists of all LSAs in their LSDB.\n6. **LOADING:** Routers send **Link-State Requests (LSR)** for any missing or newer LSAs discovered during Exchange. The neighbor replies with **Link-State Updates (LSU)** containing the full LSA payloads.\n7. **FULL:** Adjacency complete! The neighbor acknowledges all updates with **Link-State Acknowledgments (LSAck)**. The LSDBs are 100% identical and synchronized.',
                callout: {
                  type: 'warning',
                  title: 'The #1 CCNA & CCNP Troubleshooting Trap: Stuck in EXSTART',
                  text: 'If show ip ospf neighbor displays EXSTART/EXCHANGE indefinitely, 95% of the time it is caused by an INTERFACE MTU MISMATCH! The Master router sends a DBD packet matching its MTU; if the receiving router has a smaller MTU, it discards the packet or refuses to progress.',
                },
              },
            ],
            interactiveWidget: {
              type: 'ospf_state_machine',
              title: 'OSPF 7-State Adjacency Machine Animator',
              description: 'Step through packet exchanges (Hello -> DBD -> LSR -> LSU -> LSAck) and simulate common misconfigurations.',
            },
            predictExercise: {
              id: 'ex-ospf-predict',
              title: 'Troubleshooting: Stuck in EXSTART / EXCHANGE',
              type: 'multiple_choice',
              prompt:
                'Two Cisco routers are connected via GigabitEthernet. OSPF is active on both sides in Area 0 with matching timers and authentication. However, "show ip ospf neighbor" displays the state stuck in EXSTART. What is the most probable configuration issue?',
              options: [
                {
                  id: 'opt-ospf-1',
                  label: 'The OSPF Hello and Dead timers do not match between the two routers.',
                  isCorrect: false,
                  explanation: 'Timer mismatches prevent routers from ever leaving the DOWN state.',
                },
                {
                  id: 'opt-ospf-2',
                  label: 'The interface Maximum Transmission Unit (MTU) differs between the two router interfaces.',
                  isCorrect: true,
                  explanation:
                    'Correct! In EXSTART, routers begin exchanging DBD packets which list interface MTU. If MTUs do not match, the routers cannot complete the Master/Slave negotiation and remain stuck in EXSTART.',
                },
                {
                  id: 'opt-ospf-3',
                  label: 'The routers have different OSPF Process IDs configured.',
                  isCorrect: false,
                  explanation: 'Process IDs are purely local to the router and do NOT need to match between neighbors.',
                },
                {
                  id: 'opt-ospf-4',
                  label: 'The routers have mismatched OSPF Area IDs.',
                  isCorrect: false,
                  explanation: 'Mismatched Area IDs cause Hello packets to be rejected, so neighbors never leave the DOWN state.',
                },
              ],
              learningObjective: 'Diagnose why OSPF neighbors fail to progress beyond Master/Slave negotiation.',
              hints: [
                'The routers have already reached 2-WAY, which proves Hello packets were accepted and bi-directional communication succeeded.',
                'What packet type is exchanged in EXSTART, and what interface parameter is validated inside that packet?',
                'DBD packets carry the interface MTU value.',
              ],
              explanation:
                'DBD packets exchanged during EXSTART carry the interface MTU in the OSPF header. By default, Cisco IOS rejects DBD packets from a neighbor with a mismatched MTU, freezing the adjacency in EXSTART. (Fixed via "ip ospf mtu-ignore" or matching MTUs).',
              commonMistakes: [
                {
                  mistake: 'Timer mismatch',
                  explanation: 'Timer mismatches prevent neighbors from ever leaving the DOWN state.',
                },
                {
                  mistake: 'Process ID mismatch',
                  explanation: 'Process IDs are locally significant to each router and do not need to match.',
                },
              ],
              practicalTakeaway:
                'Whenever an OSPF neighbor is stuck in EXSTART/EXCHANGE, immediately verify interface MTU with "show ip ospf interface" or use "ip ospf mtu-ignore" if intentionally asymmetrical.',
              visualizerLink: {
                type: 'ospf_state_machine',
                targetStep: 3,
                label: 'Inspect EXSTART in OSPF Machine',
              },
              difficulty: 'ccna',
            },
            practiceChallenge: {
              id: 'ex-ospf-sequence',
              title: 'OSPF 7-State Chronological Handshake',
              type: 'sequence',
              prompt:
                'Place the OSPF neighbor formation states in the correct chronological order as observed from Router A:',
              sequenceItems: [
                { id: 'st-down', text: 'DOWN (No Hellos received)', correctIndex: 0 },
                { id: 'st-init', text: 'INIT (Received Hello, my RID not listed yet)', correctIndex: 1 },
                { id: 'st-2way', text: '2-WAY (Bi-directional Hello, DR/BDR elected)', correctIndex: 2 },
                { id: 'st-exstart', text: 'EXSTART (Master/Slave and initial Seq negotiated)', correctIndex: 3 },
                { id: 'st-exchange', text: 'EXCHANGE (LSA summary headers exchanged via DBD)', correctIndex: 4 },
                { id: 'st-loading', text: 'LOADING (LSR requests and LSU updates exchanged)', correctIndex: 5 },
                { id: 'st-full', text: 'FULL (LSDBs 100% synchronized and acknowledged)', correctIndex: 6 },
              ],
              learningObjective: 'Commit the strict 7-state OSPF link-state synchronization pipeline to memory.',
              hints: [
                'Remember the acronym: D-I-2-E-E-L-F',
                'ExStart always comes before Exchange.',
                'Loading is when missing LSA payloads are fetched with LSR/LSU.',
              ],
              explanation:
                'The standard 7 states flow from DOWN -> INIT -> 2-WAY -> EXSTART -> EXCHANGE -> LOADING -> FULL. Once in FULL, the routers are fully adjacent.',
              commonMistakes: [
                {
                  mistake: 'Swapping EXSTART and EXCHANGE',
                  explanation:
                    'EXSTART (negotiating Master/Slave) must happen before EXCHANGE (sending summary LSA headers).',
                },
              ],
              practicalTakeaway:
                'The acronym D-I-2-E-E-L-F is essential for CCNA and CCNP troubleshooting: Down, Init, 2-Way, ExStart, Exchange, Loading, Full.',
              visualizerLink: {
                type: 'ospf_state_machine',
                targetStep: 6,
                label: 'Run Full State Machine',
              },
              difficulty: 'ccna',
            },
            exercises: [
              {
                id: 'ex-ospf-predict',
                title: 'Troubleshooting: Stuck in EXSTART / EXCHANGE',
                type: 'troubleshooting',
                prompt:
                  'Two Cisco routers are connected via GigabitEthernet. OSPF is active on both sides in Area 0 with matching timers and authentication. However, "show ip ospf neighbor" displays the state stuck in EXSTART. What is the most probable configuration issue?',
                options: [
                  {
                    id: 'opt-ospf-1',
                    label: 'The OSPF Hello and Dead timers do not match between the two routers.',
                    isCorrect: false,
                    explanation: 'Timer mismatches prevent routers from ever leaving the DOWN state.',
                  },
                  {
                    id: 'opt-ospf-2',
                    label: 'The interface Maximum Transmission Unit (MTU) differs between the two router interfaces.',
                    isCorrect: true,
                    explanation:
                      'Correct! In EXSTART, routers begin exchanging DBD packets which list interface MTU. If MTUs do not match, the routers cannot complete the Master/Slave negotiation and remain stuck in EXSTART.',
                  },
                  {
                    id: 'opt-ospf-3',
                    label: 'The routers have different OSPF Process IDs configured.',
                    isCorrect: false,
                    explanation: 'Process IDs are purely local to the router and do NOT need to match between neighbors.',
                  },
                  {
                    id: 'opt-ospf-4',
                    label: 'The routers have mismatched OSPF Area IDs.',
                    isCorrect: false,
                    explanation: 'Mismatched Area IDs cause Hello packets to be rejected, so neighbors never leave the DOWN state.',
                  },
                ],
                learningObjective: 'Diagnose why OSPF neighbors fail to progress beyond Master/Slave negotiation.',
                hints: [
                  'The routers have already reached 2-WAY, which proves Hello packets were accepted and bi-directional communication succeeded.',
                  'What packet type is exchanged in EXSTART, and what interface parameter is validated inside that packet?',
                  'DBD packets carry the interface MTU value.',
                ],
                explanation:
                  'DBD packets exchanged during EXSTART carry the interface MTU in the OSPF header. By default, Cisco IOS rejects DBD packets from a neighbor with a mismatched MTU, freezing the adjacency in EXSTART. (Fixed via "ip ospf mtu-ignore" or matching MTUs).',
                commonMistakes: [
                  {
                    mistake: 'Timer mismatch',
                    explanation: 'Timer mismatches prevent neighbors from ever leaving the DOWN state.',
                  },
                  {
                    mistake: 'Process ID mismatch',
                    explanation: 'Process IDs are locally significant to each router and do not need to match.',
                  },
                ],
                practicalTakeaway:
                  'Whenever an OSPF neighbor is stuck in EXSTART/EXCHANGE, immediately verify interface MTU with "show ip ospf interface" or use "ip ospf mtu-ignore" if intentionally asymmetrical.',
                visualizerLink: {
                  type: 'ospf_state_machine',
                  targetStep: 3,
                  label: 'Inspect EXSTART in OSPF Machine',
                },
                difficulty: 'ccna',
              },
              {
                id: 'ex-ospf-timer-mismatch',
                title: 'Predicting State on Hello Parameter Mismatch',
                type: 'predict_output',
                prompt:
                  'Router R1 has "ip ospf hello-interval 10" and R2 has "ip ospf hello-interval 5" on their connecting link. What neighbor state will R1 display for R2 in "show ip ospf neighbor"?',
                scenarioContext: 'An administrator changed the Hello timer on R2 without matching R1.',
                acceptableAnswers: ['DOWN', 'Down', 'down'],
                learningObjective: 'Identify which parameters must match in OSPF Hello packets to form an adjacency.',
                hints: [
                  'For Hello packets to be accepted, Hello/Dead intervals, Area ID, Subnet Mask, and Authentication must match.',
                  'If the Hello packet is rejected upon arrival, does the router enter INIT or stay in DOWN?',
                  'The neighbor will never progress past DOWN.',
                ],
                explanation:
                  'OSPF requires matching Hello interval, Dead interval, Area ID, Subnet mask (on broadcast links), and Authentication. If Hello intervals differ (10 vs 5), the Hello packet is dropped and the adjacency remains DOWN.',
                commonMistakes: [
                  {
                    mistake: 'INIT',
                    explanation:
                      'INIT requires receiving a VALID Hello packet. If timers mismatch, the Hello is discarded before INIT.',
                  },
                  {
                    mistake: '2-WAY',
                    explanation: '2-WAY requires mutual Hello acceptance.',
                  },
                ],
                practicalTakeaway:
                  'Always verify "show ip ospf interface" when neighbors stay in DOWN; Hello and Dead timers must match exactly on both sides.',
                visualizerLink: {
                  type: 'ospf_state_machine',
                  targetStep: 0,
                  label: 'Inspect DOWN / INIT State',
                },
                difficulty: 'ccna',
              },
              {
                id: 'ex-ospf-2way-drother',
                title: 'DROTHER Steady-State Relationship',
                type: 'multiple_choice',
                prompt:
                  'On a broadcast multi-access Ethernet network with five OSPF routers (one DR, one BDR, and three DROTHERs), what is the expected steady-state OSPF neighbor relationship between two DROTHER routers?',
                scenarioContext: 'A 24-port switch connects 5 enterprise routers running OSPF in Area 0.',
                options: [
                  {
                    id: 'opt-drother-1',
                    label:
                      '2-WAY (They establish bi-directional communication but do not synchronize LSDBs directly with each other).',
                    isCorrect: true,
                    explanation:
                      'Correct! DROTHER routers only form FULL adjacencies with the DR and BDR. Between themselves, they remain permanently in 2-WAY, which scales OSPF by avoiding full mesh flooding.',
                  },
                  {
                    id: 'opt-drother-2',
                    label: 'FULL (All routers on a LAN must synchronize LSDBs in a full mesh).',
                    isCorrect: false,
                    explanation:
                      'Full mesh synchronization only happens on point-to-point links or between DR/BDR and DROTHERs.',
                  },
                  {
                    id: 'opt-drother-3',
                    label: 'EXSTART (They exchange DBDs but do not request LSUs).',
                    isCorrect: false,
                    explanation: 'DROTHERs never negotiate Master/Slave or exchange DBDs with each other.',
                  },
                  {
                    id: 'opt-drother-4',
                    label: 'DOWN (DROTHERs ignore each other\'s multicast Hellos).',
                    isCorrect: false,
                    explanation: 'DROTHERs process each other\'s Hellos to verify bi-directional reachability (2-WAY).',
                  },
                ],
                learningObjective:
                  'Understand the DR/BDR flooding optimization and why 2-WAY is the desired state between DROTHERs.',
                hints: [
                  'Do all routers on a broadcast Ethernet segment synchronize LSDBs with every single other router?',
                  'DROTHERs send LSUs to 224.0.0.6 (AllDRouters). The DR then refloods to 224.0.0.5 (AllSPFRouters).',
                  'Between two DROTHERs, they only verify bi-directional communication (2-WAY).',
                ],
                explanation:
                  'On broadcast segments, DROTHERs only form FULL adjacencies with the DR and BDR. Between DROTHERs, the neighbor state remains in 2-WAY. This design reduces required adjacencies from n*(n-1)/2 to 2n-3.',
                commonMistakes: [
                  {
                    mistake: 'Assuming 2-WAY is an error condition',
                    explanation:
                      'Many junior engineers mistake 2-WAY between DROTHERs for a malfunction; it is the correct, intended design.',
                  },
                ],
                practicalTakeaway:
                  'In "show ip ospf neighbor", seeing "2-WAY/DROTHER" is healthy and normal. Only "FULL/DR", "FULL/BDR", or "FULL/DROTHER" indicate full LSDB synchronization.',
                visualizerLink: {
                  type: 'ospf_state_machine',
                  targetStep: 2,
                  label: 'Inspect 2-WAY State in Animator',
                },
                difficulty: 'ccna',
              },
              {
                id: 'ex-ospf-sequence',
                title: 'OSPF 7-State Chronological Handshake',
                type: 'sequence',
                prompt:
                  'Place the OSPF neighbor formation states in the correct chronological order as observed from Router A:',
                sequenceItems: [
                  { id: 'st-down', text: 'DOWN (No Hellos received)', correctIndex: 0 },
                  { id: 'st-init', text: 'INIT (Received Hello, my RID not listed yet)', correctIndex: 1 },
                  { id: 'st-2way', text: '2-WAY (Bi-directional Hello, DR/BDR elected)', correctIndex: 2 },
                  { id: 'st-exstart', text: 'EXSTART (Master/Slave and initial Seq negotiated)', correctIndex: 3 },
                  { id: 'st-exchange', text: 'EXCHANGE (LSA summary headers exchanged via DBD)', correctIndex: 4 },
                  { id: 'st-loading', text: 'LOADING (LSR requests and LSU updates exchanged)', correctIndex: 5 },
                  { id: 'st-full', text: 'FULL (LSDBs 100% synchronized and acknowledged)', correctIndex: 6 },
                ],
                learningObjective: 'Commit the strict 7-state OSPF link-state synchronization pipeline to memory.',
                hints: [
                  'Remember the acronym: D-I-2-E-E-L-F',
                  'ExStart always comes before Exchange.',
                  'Loading is when missing LSA payloads are fetched with LSR/LSU.',
                ],
                explanation:
                  'The standard 7 states flow from DOWN -> INIT -> 2-WAY -> EXSTART -> EXCHANGE -> LOADING -> FULL. Once in FULL, the routers are fully adjacent.',
                commonMistakes: [
                  {
                    mistake: 'Swapping EXSTART and EXCHANGE',
                    explanation:
                      'EXSTART (negotiating Master/Slave) must happen before EXCHANGE (sending summary LSA headers).',
                  },
                ],
                practicalTakeaway:
                  'The acronym D-I-2-E-E-L-F is essential for CCNA and CCNP troubleshooting: Down, Init, 2-Way, ExStart, Exchange, Loading, Full.',
                visualizerLink: {
                  type: 'ospf_state_machine',
                  targetStep: 6,
                  label: 'Run Full State Machine',
                },
                difficulty: 'ccna',
              },
            ],
            relatedFlashcardDecks: [
              {
                id: 'jeremy-day-16',
                title: 'Day 16 Flashcards - OSPF Part 1',
                type: 'flashcard',
                day: 16,
                description: 'Review router IDs, metric formula, link-state advertisements, and area rules.',
              },
            ],
            relatedLabs: [
              {
                id: 'jeremy-lab-16',
                title: 'Day 16 Lab: OSPF Configuration',
                type: 'lab',
                day: 16,
                filename: 'Day 16 Lab - OSPF Part 1.pkt',
                description: 'Configure single-area OSPFv2 on three Cisco routers and verify neighbor adjacencies.',
              },
            ],
            externalReferences: [
              {
                title: 'RFC 2328: OSPF Version 2 Specification',
                url: 'https://datatracker.ietf.org/doc/html/rfc2328',
                sourceType: 'rfc',
                relevantSection: 'Section 10.1: Neighbor States',
              },
            ],
          };
