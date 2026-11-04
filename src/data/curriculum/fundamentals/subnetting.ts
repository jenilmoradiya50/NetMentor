import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonSubnettingMagicNumber: DetailedLesson = {
            id: 'lesson-subnetting-magic-number',
            topicId: 'topic-subnetting',
            pathId: 'path-fundamentals',
            slug: 'subnetting-from-scratch-magic-number',
            title: 'Subnetting from Scratch: Magic Number & Binary Intuition',
            subtitle: 'Calculate Network IDs, Usable Ranges, and Broadcasts Mentally in Seconds',
            difficulty: 'Fundamentals',
            estimatedMinutes: 20,
            learningObjectives: [
              'Understand how the subnet mask acts as a boundary divider between Network and Host bits.',
              'Calculate total hosts ($2^h$) and usable hosts ($2^h - 2$) for any prefix length.',
              'Use the "Magic Number" (256 - interesting octet mask) to find exact subnet boundaries instantly.',
              'Identify the Network ID and Broadcast address for any given host IP without full binary conversion.',
            ],
            sections: [
              {
                id: 'sec-subnet-model',
                title: '1. The Mental Model: The Subnet Mask is a Knife',
                contentMarkdown:
                  'An IPv4 address consists of exactly **32 binary bits**. These bits are split into two halves:\n\n1. **Network Bits ($n$):** Identify which street (subnet) the house is on.\n2. **Host Bits ($h$):** Identify the individual house number on that street.\n\nThe subnet mask (or CIDR prefix `/24`, `/27`, `/28`) is simply a knife that cuts the 32 bits into Network on the left and Host on the right. In binary, a subnet mask is ALWAYS a continuous string of `1`s followed by continuous `0`s.\n\n- Prefix `/24` $\\to$ 24 ones, 8 zeros $\\to$ Mask `255.255.255.0`\n- Prefix `/26` $\\to$ 26 ones, 6 zeros $\\to$ Mask `255.255.255.192`\n- Prefix `/27` $\\to$ 27 ones, 5 zeros $\\to$ Mask `255.255.255.224`\n- Prefix `/28` $\\to$ 28 ones, 4 zeros $\\to$ Mask `255.255.255.240`',
                callout: {
                  type: 'pro_tip',
                  title: 'Why Subtract 2 from Total Hosts?',
                  text: 'Total hosts is 2^h. Usable hosts is always 2^h - 2. The very first address (all host bits 0) is the NETWORK ID. The very last address (all host bits 1) is the BROADCAST address. Neither can be assigned to a host NIC!',
                },
              },
              {
                id: 'sec-magic-number',
                title: '2. The Magic Number Method Explained',
                contentMarkdown:
                  'Instead of converting decimal numbers to binary on exam day, find the **Magic Number (Block Size)**:\n\n1. **Find the interesting octet:** Look at which octet has a mask value other than `255` or `0`.\n   - For `/27` (`255.255.255.224`), the 4th octet is interesting (`224`).\n2. **Calculate Magic Number:** `256 - (mask value of interesting octet)`\n   - `256 - 224 = 32`! The Magic Number is **32**.\n3. **Count by the Magic Number:** Subnets start at multiples of the Magic Number:\n   - Subnet 0: `.0`\n   - Subnet 1: `.32`\n   - Subnet 2: `.64`\n   - Subnet 3: `.96`\n   - Subnet 4: `.128`\n   - Subnet 5: `.160`\n4. **Place your host IP:** If given `192.168.10.138/27`, where does `138` sit?\n   - It falls between `128` and `160`!\n   - **Network ID:** `192.168.10.128`\n   - **First Usable:** `192.168.10.129`\n   - **Next Subnet:** `192.168.10.160`\n   - **Broadcast Address:** `192.168.10.159` (one less than next subnet)\n   - **Last Usable:** `192.168.10.158` (one less than broadcast)',
              },
            ],
            interactiveWidget: {
              type: 'subnet_calculator',
              title: 'Interactive Subnet & Binary Breakdown Calculator',
              description: 'Adjust the CIDR slider from /8 to /30 to see the bitwise division, magic number, and host boundaries update live.',
            },
            predictExercise: {
              id: 'ex-subnet-predict',
              title: 'Subnet Usable Host Calculation (/26)',
              type: 'numerical',
              prompt:
                'For the subnet 172.16.50.64/26, what is the maximum number of USABLE host IP addresses that can be assigned to computers?',
              scenarioContext: 'An enterprise branch needs to assign addresses from the 172.16.50.64/26 block.',
              numericAnswer: 62,
              acceptableAnswers: ['62'],
              learningObjective: 'Calculate usable host capacity from IPv4 prefix length by applying the 2^h - 2 rule.',
              hints: [
                'An IPv4 address has 32 bits total. If the prefix is /26, how many host bits are left?',
                'Host bits h = 32 - 26 = 6. What is 2^6 minus the 2 reserved addresses?',
                '2^6 = 64. 64 - 2 = 62 usable host addresses.',
              ],
              explanation:
                'Correct! With a /26 prefix, 32 - 26 = 6 host bits remain. Total addresses = 2^6 = 64. Subtracting 2 (for Network ID .64 and Broadcast .127) yields exactly 62 usable host addresses.',
              commonMistakes: [
                {
                  mistake: '64',
                  explanation: 'You forgot to subtract 2 for the Network ID (.64) and Broadcast Address (.127).',
                },
                {
                  mistake: '30',
                  explanation: '30 is the usable host count for a /27 subnet (2^5 - 2), not /26.',
                },
              ],
              practicalTakeaway:
                'In production and Cisco exams, usable hosts always subtract 2 (network ID + broadcast) except on /31 point-to-point links (RFC 3021).',
              visualizerLink: {
                type: 'subnet_calculator',
                targetStep: 26,
                label: 'Inspect /26 in Subnet Calculator',
              },
              difficulty: 'fundamentals',
            },
            practiceChallenge: {
              id: 'ex-subnet-broadcast',
              title: 'Broadcast Address Calculation (/27)',
              type: 'multiple_choice',
              prompt: 'Which of the following is the valid Broadcast Address for the host IP 192.168.10.138/27?',
              learningObjective: 'Calculate the exact broadcast boundary by finding the start of the next subnet block.',
              options: [
                {
                  id: 'opt-bcast-1',
                  label: '192.168.10.143',
                  isCorrect: false,
                  explanation: 'Block size is 32, not 16.',
                },
                {
                  id: 'opt-bcast-2',
                  label: '192.168.10.159',
                  isCorrect: true,
                  explanation:
                    'Correct! The mask is 255.255.255.224. Magic Number is 256 - 224 = 32. Multiples: 0, 32, 64, 96, 128, 160. Host 138 belongs to network 128. The next network is 160, so the broadcast is 160 - 1 = 159.',
                },
                {
                  id: 'opt-bcast-3',
                  label: '192.168.10.160',
                  isCorrect: false,
                  explanation: '.160 is the Network ID of the next subnet, not the broadcast of this one.',
                },
                {
                  id: 'opt-bcast-4',
                  label: '192.168.10.255',
                  isCorrect: false,
                  explanation: '.255 would only be broadcast for a /24 subnet, not a /27.',
                },
              ],
              hints: [
                'Find the Magic Number: 256 - 224 = 32.',
                'Subnets are multiples of 32: .0, .32, .64, .96, .128, .160.',
                'The host 138 is in the 128 subnet. What is one less than 160?',
              ],
              explanation:
                'Host 138 falls between 128 and 160. Network ID = 192.168.10.128. Next subnet starts at 192.168.10.160. Therefore, the broadcast address is 192.168.10.159.',
              commonMistakes: [
                {
                  mistake: '192.168.10.255',
                  explanation: '.255 is the broadcast for a /24, not /27.',
                },
                {
                  mistake: '192.168.10.160',
                  explanation: '.160 is the Network ID of the NEXT subnet, not the broadcast of this one.',
                },
              ],
              practicalTakeaway:
                'The broadcast address is always 1 less than the next subnet Network ID. In /27, subnets increment by 32: 128 -> 160, so broadcast is 159.',
              visualizerLink: {
                type: 'subnet_calculator',
                targetStep: 27,
                label: 'Inspect /27 in Subnet Calculator',
              },
              difficulty: 'fundamentals',
            },
            exercises: [
              {
                id: 'ex-subnet-predict',
                title: 'Subnet Usable Host Calculation (/26)',
                type: 'numerical',
                prompt:
                  'For the subnet 172.16.50.64/26, what is the maximum number of USABLE host IP addresses that can be assigned to computers?',
                scenarioContext: 'An enterprise branch needs to assign addresses from the 172.16.50.64/26 block.',
                numericAnswer: 62,
                acceptableAnswers: ['62'],
                learningObjective: 'Calculate usable host capacity from IPv4 prefix length by applying the 2^h - 2 rule.',
                hints: [
                  'An IPv4 address has 32 bits total. If the prefix is /26, how many host bits are left?',
                  'Host bits h = 32 - 26 = 6. What is 2^6 minus the 2 reserved addresses?',
                  '2^6 = 64. 64 - 2 = 62 usable host addresses.',
                ],
                explanation:
                  'Correct! With a /26 prefix, 32 - 26 = 6 host bits remain. Total addresses = 2^6 = 64. Subtracting 2 (for Network ID .64 and Broadcast .127) yields exactly 62 usable host addresses.',
                commonMistakes: [
                  {
                    mistake: '64',
                    explanation: 'You forgot to subtract 2 for the Network ID (.64) and Broadcast Address (.127).',
                  },
                  {
                    mistake: '30',
                    explanation: '30 is the usable host count for a /27 subnet (2^5 - 2), not /26.',
                  },
                ],
                practicalTakeaway:
                  'In production and Cisco exams, usable hosts always subtract 2 (network ID + broadcast) except on /31 point-to-point links (RFC 3021).',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 26,
                  label: 'Inspect /26 in Subnet Calculator',
                },
                difficulty: 'fundamentals',
              },
              {
                id: 'ex-subnet-usable-hosts-28',
                title: 'Subnet Usable Host Calculation (/28)',
                type: 'numerical',
                prompt: 'How many USABLE host IP addresses are available in a /28 subnet?',
                scenarioContext: 'A security engineer is provisioning a DMZ server subnet with a /28 mask.',
                numericAnswer: 14,
                acceptableAnswers: ['14'],
                learningObjective: 'Derive host space for small subnets (/28) commonly used in DMZs and server clusters.',
                hints: [
                  'Calculate host bits: 32 - 28 = 4 host bits.',
                  'Compute 2^4, then subtract the 2 reserved addresses (network ID and broadcast).',
                  '2^4 = 16. Subtract 2 to find usable host addresses.',
                ],
                explanation:
                  'A /28 subnet leaves 32 - 28 = 4 host bits. Total IP addresses = 2^4 = 16. Subtracting 2 for the Network ID and Broadcast address leaves 14 usable host IPs.',
                commonMistakes: [
                  {
                    mistake: '16',
                    explanation: '16 is the total number of addresses (block size), not usable host addresses.',
                  },
                ],
                practicalTakeaway:
                  'A /28 subnet provides 14 usable hosts and is standard for small VLANs, DMZs, or management networks.',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 28,
                  label: 'Inspect /28 in Subnet Calculator',
                },
                difficulty: 'fundamentals',
              },
              {
                id: 'ex-subnet-same-subnet-check',
                title: 'Troubleshooting: The Same-Switch Ping Failure',
                type: 'troubleshooting',
                prompt:
                  'Host A (192.168.1.66/26) and Host B (192.168.1.130/26) are connected to the same unmanaged Layer 2 switch with default VLAN 1. Host A tries to ping Host B, but the ping fails completely with 0% success. Why did this communication fail?',
                scenarioContext:
                  'Physical topology: Host A (192.168.1.66/26) <---> Unmanaged Switch <---> Host B (192.168.1.130/26). No default gateway router is connected to the switch.',
                options: [
                  {
                    id: 'opt-sub-tr-1',
                    label:
                      'Host A and Host B are in different subnets (/26 block size is 64). Host A realizes 192.168.1.130 is off-subnet, so it attempts to send the packet to its default gateway, but no gateway is configured or reachable.',
                    isCorrect: true,
                    explanation:
                      'Correct! 192.168.1.66/26 is in subnet 192.168.1.64-127. 192.168.1.130/26 is in subnet 192.168.1.128-191. Host A determines the target is remote and cannot communicate without a Layer 3 router.',
                  },
                  {
                    id: 'opt-sub-tr-2',
                    label:
                      'Unmanaged Layer 2 switches cannot forward frames between devices unless an 802.1Q trunk port is configured.',
                    isCorrect: false,
                    explanation: 'Trunk ports are between switches, not end hosts on an unmanaged switch.',
                  },
                  {
                    id: 'opt-sub-tr-3',
                    label:
                      'Host A sends a broadcast ARP request, but Layer 2 switches always block ARP broadcasts across different IP octet boundaries.',
                    isCorrect: false,
                    explanation:
                      'Layer 2 switches flood all broadcast frames to all ports in the broadcast domain regardless of IP addresses.',
                  },
                  {
                    id: 'opt-sub-tr-4',
                    label: 'Host B drops the frame because its ARP table size limit is reached.',
                    isCorrect: false,
                    explanation: 'No ARP frame ever reaches Host B because Host A never ARPs for Host B directly.',
                  },
                ],
                learningObjective:
                  'Understand that routing decisions happen on the sender before packet generation, regardless of physical switch proximity.',
                hints: [
                  'What is the block size of /26? (256 - 192 = 64).',
                  'Determine which subnet 192.168.1.66 belongs to, and which subnet 192.168.1.130 belongs to.',
                  'Host A is in 192.168.1.64/26. Host B is in 192.168.1.128/26. They are in different subnets!',
                ],
                explanation:
                  'For a /26 prefix, subnets increment in blocks of 64: Subnet 1 is 192.168.1.64 to .127. Subnet 2 is 192.168.1.128 to .191. Because Host A sees the destination IP is on a remote subnet, it does NOT ARP for Host B directly; it attempts to ARP for its default gateway, which is absent.',
                commonMistakes: [
                  {
                    mistake: 'Assuming Layer 2 switch proximity enables communication',
                    explanation:
                      'Two hosts plugged into the same switch cannot communicate across different subnets without a Layer 3 default gateway.',
                  },
                ],
                practicalTakeaway:
                  'The sending host always applies its own subnet mask to compare source and destination network IDs before transmitting. If they differ, the frame MUST be addressed to a Layer 3 router MAC.',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 26,
                  label: 'Inspect /26 Subnet Ranges',
                },
                difficulty: 'ccna',
              },
              {
                id: 'ex-subnet-magic-number-network-id',
                title: 'Deriving Network ID Across Arbitrary Octets (/22)',
                type: 'predict_output',
                prompt:
                  'Determine the exact Network ID for the host address 172.16.45.100/22. Enter the Network ID in standard dotted-decimal notation (e.g. 172.16.X.X):',
                scenarioContext: 'An enterprise campus assigns 172.16.45.100/22 to a core distribution switch.',
                acceptableAnswers: ['172.16.44.0', '172.16.44.0/22'],
                learningObjective: 'Master calculating the Magic Number and subnet boundaries in the 3rd octet (/17 through /23).',
                hints: [
                  'For /22, which octet is the "interesting" octet? (Octet 1: 8, Octet 2: 16, Octet 3: 24, so octet 3 has 22 bits).',
                  'The mask for /22 is 255.255.252.0. In the 3rd octet, the magic number is 256 - 252 = 4.',
                  'Count multiples of 4 in the 3rd octet: 0, 4, 8, ..., 40, 44, 48. Where does 45 fall?',
                ],
                explanation:
                  'With /22 (255.255.252.0), the 3rd octet is interesting. Magic number = 256 - 252 = 4. Multiples in the 3rd octet: 0, 4, ..., 40, 44, 48. 45 falls between 44 and 48, so the Network ID is 172.16.44.0, and the broadcast is 172.16.47.255.',
                commonMistakes: [
                  {
                    mistake: '172.16.45.0',
                    explanation: 'You treated it as a /24 mask. In /22, the 3rd octet increments in multiples of 4.',
                  },
                  {
                    mistake: '172.16.40.0',
                    explanation: '40 is a multiple of 4, but 44 is the highest multiple less than or equal to 45.',
                  },
                ],
                practicalTakeaway:
                  'For any prefix between /17 and /23, apply the Magic Number to the 3rd octet and keep the 4th octet as .0 for the Network ID.',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 22,
                  label: 'Inspect /22 in Subnet Calculator',
                },
                difficulty: 'ccna',
              },
              {
                id: 'ex-subnet-broadcast',
                title: 'Broadcast Address Calculation (/27)',
                type: 'multiple_choice',
                prompt: 'Which of the following is the valid Broadcast Address for the host IP 192.168.10.138/27?',
                learningObjective: 'Calculate the exact broadcast boundary by finding the start of the next subnet block.',
                options: [
                  {
                    id: 'opt-bcast-1',
                    label: '192.168.10.143',
                    isCorrect: false,
                    explanation: 'Block size is 32, not 16.',
                  },
                  {
                    id: 'opt-bcast-2',
                    label: '192.168.10.159',
                    isCorrect: true,
                    explanation:
                      'Correct! The mask is 255.255.255.224. Magic Number is 256 - 224 = 32. Multiples: 0, 32, 64, 96, 128, 160. Host 138 belongs to network 128. The next network is 160, so the broadcast is 160 - 1 = 159.',
                  },
                  {
                    id: 'opt-bcast-3',
                    label: '192.168.10.160',
                    isCorrect: false,
                    explanation: '.160 is the Network ID of the next subnet, not the broadcast of this one.',
                  },
                  {
                    id: 'opt-bcast-4',
                    label: '192.168.10.255',
                    isCorrect: false,
                    explanation: '.255 would only be broadcast for a /24 subnet, not a /27.',
                  },
                ],
                hints: [
                  'Find the Magic Number: 256 - 224 = 32.',
                  'Subnets are multiples of 32: .0, .32, .64, .96, .128, .160.',
                  'The host 138 is in the 128 subnet. What is one less than 160?',
                ],
                explanation:
                  'Host 138 falls between 128 and 160. Network ID = 192.168.10.128. Next subnet starts at 192.168.10.160. Therefore, the broadcast address is 192.168.10.159.',
                commonMistakes: [
                  {
                    mistake: '192.168.10.255',
                    explanation: '.255 is the broadcast for a /24, not /27.',
                  },
                  {
                    mistake: '192.168.10.160',
                    explanation: '.160 is the Network ID of the NEXT subnet, not the broadcast of this one.',
                  },
                ],
                practicalTakeaway:
                  'The broadcast address is always 1 less than the next subnet Network ID. In /27, subnets increment by 32: 128 -> 160, so broadcast is 159.',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 27,
                  label: 'Inspect /27 in Subnet Calculator',
                },
                difficulty: 'fundamentals',
              },
              {
                id: 'ex-subnet-edge-case-31-32',
                title: 'Point-to-Point Links & RFC 3021 (/31)',
                type: 'multiple_choice',
                prompt:
                  'A network engineer configures an IPv4 point-to-point link between two core routers using a /31 prefix (e.g. 10.0.0.0/31). According to RFC 3021, how many usable host addresses does this subnet provide?',
                scenarioContext: 'Two Cisco Catalyst 9500 switches are connected back-to-back via 100G interfaces.',
                options: [
                  {
                    id: 'opt-rfc31-1',
                    label:
                      '2 usable host IP addresses (10.0.0.0 and 10.0.0.1); the traditional Network ID and Broadcast address requirements are waived on point-to-point links.',
                    isCorrect: true,
                    explanation:
                      'Correct! RFC 3021 officially defines using 31-bit prefixes on point-to-point links, allowing both addresses to be assigned to router interfaces with zero wasted addresses.',
                  },
                  {
                    id: 'opt-rfc31-2',
                    label: '0 usable host IP addresses because the 2^h - 2 formula results in 2^1 - 2 = 0.',
                    isCorrect: false,
                    explanation: 'The 2^h - 2 formula does not apply to /31 under RFC 3021 on point-to-point links.',
                  },
                  {
                    id: 'opt-rfc31-3',
                    label: '1 usable host IP address, with the other acting as broadcast.',
                    isCorrect: false,
                    explanation:
                      'Point-to-point links do not require a broadcast address because packets can only reach the single neighbor.',
                  },
                  {
                    id: 'opt-rfc31-4',
                    label: '4 IP addresses because /31 borrows bits from the 3rd octet.',
                    isCorrect: false,
                    explanation: '/31 leaves exactly 1 host bit (2^1 = 2 addresses).',
                  },
                ],
                learningObjective: 'Recognize RFC 3021 modern enterprise and ISP point-to-point subnetting rules.',
                hints: [
                  'On a dedicated point-to-point link between two routers, is broadcast capability or a dedicated network address needed?',
                  'Read RFC 3021: "Using 31-Bit Prefixes on IPv4 Point-to-Point Links".',
                  'Both the even and odd addresses (e.g. .0 and .1) are assigned to the two router interfaces.',
                ],
                explanation:
                  'RFC 3021 permits /31 subnets exclusively on point-to-point links. Because there are only two endpoints and no need for directed broadcast, both addresses (e.g. 10.0.0.0 and 10.0.0.1) are usable, saving billions of IPv4 addresses compared to /30.',
                commonMistakes: [
                  {
                    mistake: 'Calculating 2^1 - 2 = 0',
                    explanation:
                      'Under standard legacy subnetting, 2^1 - 2 = 0, but RFC 3021 creates a specific exception for point-to-point links.',
                  },
                ],
                practicalTakeaway:
                  'Modern CCNA/CCNP exams and enterprise data centers use /31 for router-to-router point-to-point links instead of wasteful /30.',
                visualizerLink: {
                  type: 'subnet_calculator',
                  targetStep: 30,
                  label: 'Compare /30 vs /31 Subnets',
                },
                difficulty: 'ccna',
              },
            ],
            relatedFlashcardDecks: [
              {
                id: 'jeremy-day-13',
                title: 'Day 13 Flashcards - IPv4 Subnetting Part 1',
                type: 'flashcard',
                day: 13,
                description: 'Review prefix lengths, octet values, and power-of-two calculations.',
              },
            ],
            externalReferences: [
              {
                title: 'RFC 1878: Variable Length Subnet Table For IPv4',
                url: 'https://datatracker.ietf.org/doc/html/rfc1878',
                sourceType: 'rfc',
              },
            ],
          };
