import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonBgpPathSelection: DetailedLesson = {
  id: 'lesson-bgp-path-selection',
  topicId: 'topic-bgp',
  pathId: 'path-ccnp',
  slug: 'bgp-path-selection-architecture',
  title: 'Border Gateway Protocol (BGP) & Path Selection: Architecture, Peering & Decision Mechanics',
  subtitle: 'Autonomous Systems, eBGP vs. iBGP Rules, TCP 179 Adjacencies, and the 13-Step Best Path Algorithm',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Explain the path-vector architecture of BGP and how Autonomous System Numbers (2-byte vs. 4-byte) prevent inter-domain loops.',
    'Differentiate eBGP and iBGP operational mechanics, including Administrative Distance (20 vs. 200), default TTL (1 vs. 255), and the iBGP split-horizon rule.',
    'Trace the 6 BGP finite state machine states (Idle, Connect, Active, OpenSent, OpenConfirm, Established) and diagnose transport/configuration failures.',
    'Execute the Cisco BGP Best Path Selection algorithm step-by-step to predict which route is installed in the Routing Information Base (RIB).',
    'Configure standard Cisco IOS BGP peering commands, including "neighbor update-source" and "neighbor next-hop-self".',
  ],
  sections: [
    {
      id: 'sec-bgp-purpose-architecture',
      title: '1. The Purpose of BGP & Path-Vector Architecture',
      contentMarkdown:
        'Interior Gateway Protocols (IGPs) like OSPF and EIGRP are designed for speed and rapid convergence within a single administrative domain. However, IGPs cannot scale to the global Internet routing table (over 950,000 IPv4 prefixes) because every router would require massive CPU and memory to maintain full link-state topologies.\n\n**Border Gateway Protocol version 4 (BGP-4, RFC 4271)** is an exterior gateway protocol based on **path-vector routing**. Instead of measuring raw physical link speeds, BGP makes routing decisions based on **business relationships, administrative policies, and path attributes**.\n\n### Autonomous Systems and ASNs\nAn **Autonomous System (AS)** is a collection of connected IP routing prefixes under the control of one or more network operators that presents a single, clearly defined routing policy to the Internet.\n\n- **2-Byte (16-bit) ASNs:** Range from `1` to `65,535`.\n  - Public ASNs: `1` to `64,511` (assigned by IANA and RIRs like ARIN, RIPE, APNIC).\n  - Private ASNs: `64,512` to `65,534` (RFC 6996, used within private enterprise networks).\n  - Reserved: `65,535`.\n- **4-Byte (32-bit) ASNs:** Range from `1` to `4,294,967,295` (RFC 6793). Private 4-byte ASNs span `4,200,000,000` to `4,294,967,294`.\n\n### Loop Prevention via AS_PATH\nThe primary loop-prevention mechanism in inter-domain routing is the **AS_PATH** attribute (Type Code 2). Whenever a BGP router advertises a route to an external peer, it prepends its own ASN to the AS_PATH list. When a router receives a BGP UPDATE from an eBGP peer, it scans the AS_PATH: **if its own ASN is already present anywhere in the list, the router silently drops the prefix**, preventing routing loops across the Internet.',
      callout: {
        type: 'rfc',
        title: 'RFC 4271 (BGP-4 Specification) & Loop Prevention',
        text: 'RFC 4271 Section 9.1.2 mandates that if the first AS number in the AS_PATH is the ASN of the receiving speaker (or appears anywhere in the AS_SEQUENCE), the receiving system MUST discard the update. This guarantees loop-free path-vector propagation without requiring SPF calculations.',
      },
    },
    {
      id: 'sec-ebgp-vs-ibgp',
      title: '2. eBGP vs. iBGP: Operational Boundaries & The Split-Horizon Trap',
      contentMarkdown:
        'BGP behaves differently depending on whether peering occurs between different Autonomous Systems or inside the same Autonomous System:\n\n| Attribute / Parameter | External BGP (eBGP) | Internal BGP (iBGP) |\n| :--- | :--- | :--- |\n| **Peering Relationship** | Different ASNs (`remote-as != local-as`) | Same ASN (`remote-as == local-as`) |\n| **Cisco Administrative Distance** | **20** (highly preferred over IGPs) | **200** (less preferred than IGPs) |\n| **Default IP TTL** | **1** (assumes direct physical link) | **255** (multi-hop transit within AS) |\n| **Loop Prevention Mechanism** | Inspects **AS_PATH** attribute | **iBGP Split-Horizon Rule** |\n| **NEXT_HOP Modification** | Rewrites NEXT_HOP to local interface IP | **Preserves external NEXT_HOP unchanged** |\n\n### The iBGP Split-Horizon Rule\nBecause iBGP peers do not prepend their ASN when advertising routes to each other (which would corrupt the AS_PATH length), the AS_PATH cannot prevent loops inside an AS. Therefore, BGP enforces the **iBGP Split-Horizon Rule**:\n\n> **A router that learns a prefix via iBGP will NEVER advertise that prefix to another iBGP peer!**\n\nTo ensure all internal routers learn all routes, traditional iBGP requires a **full mesh of iBGP peerings** between all BGP speakers in the AS (which requires $N(N-1)/2$ sessions), or the deployment of **Route Reflectors (RFC 4456)** or **BGP Confederations (RFC 5065)**.\n\n### The "Next-Hop Unchanged" Trap\nWhen an edge router (e.g., R1) receives an eBGP route from an ISP with NEXT_HOP `203.0.113.1` and reflects it into iBGP to internal router R2, **R1 does not change the NEXT_HOP by default!** R2 receives the route with NEXT_HOP `203.0.113.1`. If R2 does not have an IGP route to `203.0.113.1`, the route is marked **inaccessible (invalid)** in R2\'s BGP table (indicated by missing `>` in `show ip bgp`).\n\nTo fix this, the edge router must be configured with `neighbor <ibgp-peer-ip> next-hop-self`.',
      callout: {
        type: 'warning',
        title: 'Cisco Production & CCNP Exam Trap: next-hop-self',
        text: 'Forgetting "neighbor <ip> next-hop-self" on border routers is the #1 cause of valid-looking BGP routes failing to install into the routing table. Always verify whether the NEXT_HOP is reachable via the local IGP before troubleshooting BGP policies!',
      },
    },
    {
      id: 'sec-bgp-fsm-states',
      title: '3. BGP Finite State Machine & Neighbor Adjacencies',
      contentMarkdown:
        'BGP does not discover neighbors dynamically using multicast like OSPF or EIGRP. All neighbors must be statically configured with explicit IP addresses. BGP establishes a point-to-point **TCP session on port 179** before exchanging routes.\n\nThe BGP Finite State Machine (FSM) progresses through 6 deterministic states:\n\n1. **Idle:** The initial state. BGP refuses incoming connections and allocates resources. After a Start event (e.g., configuring `neighbor`), BGP initializes the ConnectRetry timer and transitions to **Connect**.\n2. **Connect:** The router initiates a TCP 3-way handshake on port 179. If the TCP handshake succeeds, BGP sends an **OPEN** message and transitions to **OpenSent**. If TCP fails (e.g., connection refused or timeout), BGP transitions to **Active**.\n3. **Active:** The router is **actively trying to establish a TCP connection** to the peer. If the ConnectRetry timer expires, BGP resets the timer and tries another TCP SYN.\n4. **OpenSent:** TCP is established. The router has sent its OPEN message (containing BGP version 4, local ASN, Hold Time, and BGP Router ID). It is now waiting to receive the peer\'s OPEN message.\n5. **OpenConfirm:** The router has received the peer\'s OPEN message and sent a **KEEPALIVE**. It is now waiting for a KEEPALIVE from the peer.\n6. **Established:** Both peers have exchanged valid OPEN and KEEPALIVE messages. The neighbor adjacency is fully formed! Peers can now exchange **UPDATE** (routing information), **NOTIFICATION** (errors), and periodic **KEEPALIVE** messages (default 60s with a 180s Hold Time).\n\n```\n+------+   Start    +---------+  TCP Fail   +--------+\n| Idle | ---------> | Connect | ----------> | Active |\n+------+            +---------+             +--------+\n                         |                      |\n                         | TCP Success          | TCP Success\n                         v                      |\n                    +----------+ <--------------+\n                    | OpenSent |\n                    +----------+\n                         |\n                         | Recv OPEN, Send KEEPALIVE\n                         v\n                   +-------------+\n                   | OpenConfirm |\n                   +-------------+\n                         |\n                         | Recv KEEPALIVE\n                         v\n                    +-------------+\n                    | Established | (Prefix Exchange Active!)\n                    +-------------+\n```',
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco Trap: State "Active" is NOT Good News!',
        text: 'In Cisco CLI output (show ip bgp summary), seeing state "Active" means the router is actively failing to complete the TCP port 179 handshake! Common culprits: access-list blocking TCP 179, wrong neighbor IP, unroutable IP, or missing "update-source Loopback0". In "Established" state, Cisco routers display a number (the prefix count, e.g. 0 or 45), NOT the word Established!',
      },
    },
    {
      id: 'sec-best-path-algorithm',
      title: '4. The Deterministic Cisco BGP Best Path Selection Algorithm',
      contentMarkdown:
        'When a BGP router receives multiple paths to the exact same prefix, it does not load-balance by default. Instead, it evaluates path attributes sequentially through a deterministic 13-step decision tree until a single best path is selected.\n\n### Mandatory Pre-Conditions\nBefore a route can be evaluated by the Best Path Algorithm:\n- The NEXT_HOP IP address **must be reachable** in the router\'s IP routing table (RIB).\n- The route must **not be synchronized** with an IGP (unless synchronization is disabled, which is default since Cisco IOS 12.2(8)T).\n- The AS_PATH must **not contain the local ASN** (loop prevention).\n\n### The Cisco Best Path Hierarchy (Memory Aid: W-L-A-A-O-M-E-I-R)\n\n1. **Weight (Highest wins):** Cisco-proprietary attribute. Local to the router only (never sent to any neighbor). Range: `0` to `65,535`. Default: `32,768` for locally generated routes (`network` or `redistribute`), and `0` for learned routes.\n2. **Local Preference (Highest wins):** Well-known discretionary attribute. Advertised to all iBGP peers across the entire AS (never sent to eBGP peers). Default: `100`.\n3. **Locally Originated:** Prefer routes originated locally on this router (`network` command or `aggregate-address`) over routes learned from peers or redistributed.\n4. **AS_PATH (Shortest length wins):** Prefer the path with the fewest ASNs in its AS_PATH attribute. (Note: AS_SET counts as 1; AS_CONFED_SEQUENCE does not count).\n5. **Origin Code (Lowest wins):** Prefer **IGP (`i`)** over **EGP (`e`)**, and prefer EGP over **Incomplete (`?`)**. (`i` > `e` > `?`). Routes injected via the `network` command have origin `i`; routes injected via `redistribute` have origin `?`.\n6. **Multi-Exit Discriminator (MED / Metric) (Lowest wins):** Optional non-transitive attribute advertised to external peers to influence how they enter your AS. *Important Cisco condition:* By default, MED is only compared if the neighboring AS is the **same** for both paths. (To compare across different ASNs, `bgp always-compare-med` must be enabled).\n7. **eBGP over iBGP:** Prefer external eBGP paths over internal iBGP paths.\n8. **Lowest IGP Metric to NEXT_HOP:** Prefer the path with the lowest interior routing cost (OSPF cost, EIGRP metric) to reach the NEXT_HOP IP.\n9. **Multipath Check:** If `maximum-paths` is configured, install up to $N$ equal-cost parallel routes for ECMP if attributes 1 through 8 match.\n10. **Oldest Path (Stability):** Prefer the path that was received first (oldest, most stable) to prevent route flaps on eBGP. (Ignored if `bgp bestpath compare-routerid` is enabled).\n11. **Lowest Neighbor BGP Router ID:** Prefer the path received from the BGP neighbor with the lowest Router ID (IPv4 format).\n12. **Lowest Neighbor IP Address:** Final tie-breaker for multiple sessions between the same neighbor router.',
      callout: {
        type: 'pro_tip',
        title: 'Memorization Rule for CCNP Enterprise',
        text: 'Remember the acronym: "We Love A Awesome Orange Mango Every Interstellar Rover": Weight, Local Pref, Autonomous origination, AS_PATH, Origin, MED, eBGP/iBGP, IGP metric, Router ID.',
      },
    },
    {
      id: 'sec-cisco-configuration-cli',
      title: '5. Practical Cisco IOS Configuration & Verification',
      contentMarkdown:
        '### Basic eBGP Configuration Example\n```cisco\n! Router R1 (Enterprise Edge - AS 65001)\nrouter bgp 65001\n bgp router-id 1.1.1.1\n neighbor 203.0.113.2 remote-as 65002\n neighbor 203.0.113.2 description Peer to ISP-A\n !\n address-family ipv4\n  network 198.51.100.0 mask 255.255.255.0\n  neighbor 203.0.113.2 activate\n exit-address-family\n```\n\n### Enterprise iBGP Peering via Loopback Interfaces\n```cisco\n! Router R2 (AS 65001 Internal Hub)\nrouter bgp 65001\n bgp router-id 2.2.2.2\n neighbor 3.3.3.3 remote-as 65001\n neighbor 3.3.3.3 update-source Loopback0\n neighbor 3.3.3.3 next-hop-self\n !\n address-family ipv4\n  neighbor 3.3.3.3 activate\n exit-address-family\n```\n\n### Essential Verification Commands\n- `show ip bgp summary`: Displays neighbor IP, ASN, state, and prefix count (`PfxRcd`).\n- `show ip bgp`: Displays the BGP table. Look for `*` (valid route) and `>` (best path chosen for RIB).\n- `show ip bgp neighbors <ip>`: Detailed peer statistics, negotiated capabilities, and hold timers.\n- `show ip bgp <prefix>`: Displays all received paths for a prefix with detailed attributes (Weight, LocalPref, AS_PATH, MED, origin).',
      callout: {
        type: 'warning',
        title: 'The "network" Command Exact Match Rule',
        text: 'In Cisco IOS BGP, the "network" command does NOT enable BGP on an interface like OSPF does! Instead, it tells BGP to inject a route into the BGP table ONLY IF an exact match (both prefix and subnet mask) already exists in the router\'s local routing table (RIB)!',
      },
    },
  ],
  predictExercise: {
    id: 'ex-bgp-bestpath-sequence',
    lessonId: 'lesson-bgp-path-selection',
    type: 'sequence',
    title: 'BGP Best Path Algorithm: Decision Hierarchy Ordering',
    prompt:
      'Arrange the core Cisco BGP Best Path Selection criteria in the exact sequence in which a Cisco IOS router evaluates them to determine the winning route.',
    learningObjective:
      'Memorize and apply the deterministic Cisco BGP 13-step path selection tie-breaker hierarchy.',
    scenarioContext:
      'A router has received two paths to 10.100.0.0/16 with reachable next-hops. It must evaluate attributes sequentially until a tie is broken.',
    sequenceItems: [
      { id: 'step-weight', text: '1. Weight (Highest — Cisco proprietary, local only)', correctIndex: 0 },
      { id: 'step-localpref', text: '2. Local Preference (Highest — AS-wide iBGP)', correctIndex: 1 },
      { id: 'step-originate', text: '3. Locally Originated (network/aggregate over redistribute)', correctIndex: 2 },
      { id: 'step-aspath', text: '4. AS_PATH (Shortest length)', correctIndex: 3 },
      { id: 'step-origin', text: '5. Origin Code (IGP "i" over Incomplete "?")', correctIndex: 4 },
      { id: 'step-med', text: '6. MED / Metric (Lowest — same neighbor AS by default)', correctIndex: 5 },
      { id: 'step-ebgp-ibgp', text: '7. eBGP path over iBGP path', correctIndex: 6 },
      { id: 'step-igp-metric', text: '8. Lowest IGP metric to Next-Hop IP', correctIndex: 7 },
    ],
    hints: [
      'Remember that Weight is evaluated first because it is local to the router and overrides all BGP protocol attributes.',
      'Local Preference is evaluated before AS_PATH, allowing an enterprise AS to steer outbound traffic independently of path length.',
      'MED is evaluated after AS_PATH and Origin code, but before eBGP vs. iBGP selection.',
    ],
    explanation:
      'Correct! Cisco BGP evaluates paths in this exact deterministic order: 1. Weight (Highest), 2. Local Preference (Highest), 3. Locally Originated, 4. AS_PATH (Shortest), 5. Origin Code (IGP > Incomplete), 6. MED (Lowest), 7. eBGP over iBGP, and 8. Lowest IGP metric to BGP Next-Hop.',
    practicalTakeaway:
      'Always remember: Weight (Step 1) is router-local; Local Preference (Step 2) is AS-local; MED (Step 6) is inter-AS. An engineer can override a shorter AS_PATH by setting a higher Local Preference or Weight.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-bgp-troubleshoot-nexthop',
    lessonId: 'lesson-bgp-path-selection',
    type: 'troubleshooting',
    title: 'Troubleshooting: Route Missing from Routing Table (Next-Hop Unreachable)',
    prompt:
      'An enterprise edge router R1 (AS 65001) learns prefix 198.51.100.0/24 from ISP-A with NEXT_HOP 203.0.113.1. R1 advertises this route to internal router R2 via iBGP. On R2, "show ip bgp" shows "*   198.51.100.0/24  203.0.113.1" (valid, but missing ">"), and "show ip route bgp" is completely empty. What is the root cause, and what command must be configured?',
    scenarioContext:
      'Enterprise edge R1 peers with ISP-A via eBGP and with R2 via iBGP. R2 has no direct interface in 203.0.113.0/30.',
    options: [
      {
        id: 'opt-next-hop-self',
        label: 'Configure "neighbor 10.0.0.2 next-hop-self" on R1, because iBGP preserves the external next-hop by default.',
        isCorrect: true,
        explanation:
          'When eBGP routes are forwarded into iBGP, the border router preserves the external next-hop IP (203.0.113.1). If internal routers have no IGP route to that subnet, the route is marked inaccessible and cannot be installed in the RIB. "next-hop-self" forces R1 to set itself as next-hop.',
      },
      {
        id: 'opt-r2-next-hop-self',
        label: 'Configure "neighbor 10.0.0.1 next-hop-self" on R2 to update its own routing table.',
        isCorrect: false,
        explanation:
          'next-hop-self must be configured on the advertising router (R1) when sending routes to its iBGP peer, not on the receiving router (R2).',
      },
      {
        id: 'opt-ad-distance',
        label: 'Change the administrative distance of iBGP from 200 to 20 so it beats OSPF.',
        isCorrect: false,
        explanation:
          'Administrative distance is not the issue. The route is marked invalid (missing ">") because its NEXT_HOP attribute is unresolvable in the IGP.',
      },
      {
        id: 'opt-ebgp-multihop',
        label: 'Configure "ebgp-multihop 2" on R1 toward ISP-A.',
        isCorrect: false,
        explanation:
          'ebgp-multihop is used when eBGP peers are not directly connected. The eBGP session is already established and functioning.',
      },
    ],
    hints: [
      'Look closely at the show ip bgp output: it has "*" (valid syntax) but is missing ">" (best path). What mandatory pre-condition is failing?',
      'Check what NEXT_HOP address R2 is seeing for the route, and think about whether R2 has an IGP route to that ISP IP.',
      'Remember the default behavior of eBGP border routers when re-advertising routes into iBGP.',
    ],
    explanation:
      'In BGP, when an eBGP-learned route is advertised to an iBGP neighbor, the advertising router preserves the external peer\'s IP address as the NEXT_HOP by default. If the receiving iBGP router has no IGP path to that external subnet, the route fails the next-hop reachability check. Configuring "neighbor <ibgp-peer-ip> next-hop-self" on border router R1 rewrites the NEXT_HOP to R1\'s own reachable IP.',
    commonMistakes: [
      {
        mistake: 'Configure "neighbor 10.0.0.1 next-hop-self" on R2',
        explanation: 'next-hop-self must be configured on the border router advertising the route, not the receiving peer.',
      },
    ],
    practicalTakeaway:
      'Always configure "neighbor <peer> next-hop-self" on edge routers whenever advertising eBGP routes to iBGP peers.',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-bgp-bestpath-sequence',
      lessonId: 'lesson-bgp-path-selection',
      type: 'sequence',
      title: 'BGP Best Path Algorithm: Decision Hierarchy Ordering',
      prompt:
        'Arrange the core Cisco BGP Best Path Selection criteria in the exact sequence in which a Cisco IOS router evaluates them to determine the winning route.',
      learningObjective:
        'Memorize and apply the deterministic Cisco BGP 13-step path selection tie-breaker hierarchy.',
      scenarioContext:
        'A router has received two paths to 10.100.0.0/16 with reachable next-hops. It must evaluate attributes sequentially until a tie is broken.',
      sequenceItems: [
        { id: 'step-weight', text: '1. Weight (Highest — Cisco proprietary, local only)', correctIndex: 0 },
        { id: 'step-localpref', text: '2. Local Preference (Highest — AS-wide iBGP)', correctIndex: 1 },
        { id: 'step-originate', text: '3. Locally Originated (network/aggregate over redistribute)', correctIndex: 2 },
        { id: 'step-aspath', text: '4. AS_PATH (Shortest length)', correctIndex: 3 },
        { id: 'step-origin', text: '5. Origin Code (IGP "i" over Incomplete "?")', correctIndex: 4 },
        { id: 'step-med', text: '6. MED / Metric (Lowest — same neighbor AS by default)', correctIndex: 5 },
        { id: 'step-ebgp-ibgp', text: '7. eBGP path over iBGP path', correctIndex: 6 },
        { id: 'step-igp-metric', text: '8. Lowest IGP metric to Next-Hop IP', correctIndex: 7 },
      ],
      hints: [
        'Remember that Weight is evaluated first because it is local to the router and overrides all BGP protocol attributes.',
        'Local Preference is evaluated before AS_PATH, allowing an enterprise AS to steer outbound traffic independently of path length.',
        'MED is evaluated after AS_PATH and Origin code, but before eBGP vs. iBGP selection.',
      ],
      explanation:
        'Correct! Cisco BGP evaluates paths in this exact deterministic order: 1. Weight (Highest), 2. Local Preference (Highest), 3. Locally Originated, 4. AS_PATH (Shortest), 5. Origin Code (IGP > Incomplete), 6. MED (Lowest), 7. eBGP over iBGP, and 8. Lowest IGP metric to BGP Next-Hop.',
      practicalTakeaway:
        'Always remember: Weight (Step 1) is router-local; Local Preference (Step 2) is AS-local; MED (Step 6) is inter-AS. An engineer can override a shorter AS_PATH by setting a higher Local Preference or Weight.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-troubleshoot-nexthop',
      lessonId: 'lesson-bgp-path-selection',
      type: 'troubleshooting',
      title: 'Troubleshooting: Route Missing from Routing Table (Next-Hop Unreachable)',
      prompt:
        'An enterprise edge router R1 (AS 65001) learns prefix 198.51.100.0/24 from ISP-A with NEXT_HOP 203.0.113.1. R1 advertises this route to internal router R2 via iBGP. On R2, "show ip bgp" shows "*   198.51.100.0/24  203.0.113.1" (valid, but missing ">"), and "show ip route bgp" is completely empty. What is the root cause, and what command must be configured?',
      scenarioContext:
        'Enterprise edge R1 peers with ISP-A via eBGP and with R2 via iBGP. R2 has no direct interface in 203.0.113.0/30.',
      options: [
        {
          id: 'opt-next-hop-self',
          label: 'Configure "neighbor 10.0.0.2 next-hop-self" on R1, because iBGP preserves the external next-hop by default.',
          isCorrect: true,
          explanation:
            'When eBGP routes are forwarded into iBGP, the border router preserves the external next-hop IP (203.0.113.1). If internal routers have no IGP route to that subnet, the route is marked inaccessible and cannot be installed in the RIB. "next-hop-self" forces R1 to set itself as next-hop.',
        },
        {
          id: 'opt-r2-next-hop-self',
          label: 'Configure "neighbor 10.0.0.1 next-hop-self" on R2 to update its own routing table.',
          isCorrect: false,
          explanation:
            'next-hop-self must be configured on the advertising router (R1) when sending routes to its iBGP peer, not on the receiving router (R2).',
        },
        {
          id: 'opt-ad-distance',
          label: 'Change the administrative distance of iBGP from 200 to 20 so it beats OSPF.',
          isCorrect: false,
          explanation:
            'Administrative distance is not the issue. The route is marked invalid (missing ">") because its NEXT_HOP attribute is unresolvable in the IGP.',
        },
        {
          id: 'opt-ebgp-multihop',
          label: 'Configure "ebgp-multihop 2" on R1 toward ISP-A.',
          isCorrect: false,
          explanation:
            'ebgp-multihop is used when eBGP peers are not directly connected. The eBGP session is already established and functioning.',
        },
      ],
      hints: [
        'Look closely at the show ip bgp output: it has "*" (valid syntax) but is missing ">" (best path). What mandatory pre-condition is failing?',
        'Check what NEXT_HOP address R2 is seeing for the route, and think about whether R2 has an IGP route to that ISP IP.',
        'Remember the default behavior of eBGP border routers when re-advertising routes into iBGP.',
      ],
      explanation:
        'In BGP, when an eBGP-learned route is advertised to an iBGP neighbor, the advertising router preserves the external peer\'s IP address as the NEXT_HOP by default. If the receiving iBGP router has no IGP path to that external subnet, the route fails the next-hop reachability check. Configuring "neighbor <ibgp-peer-ip> next-hop-self" on border router R1 rewrites the NEXT_HOP to R1\'s own reachable IP.',
      commonMistakes: [
        {
          mistake: 'Configure "neighbor 10.0.0.1 next-hop-self" on R2',
          explanation: 'next-hop-self must be configured on the border router advertising the route, not the receiving peer.',
        },
      ],
      practicalTakeaway:
        'Always configure "neighbor <peer> next-hop-self" on edge routers whenever advertising eBGP routes to iBGP peers.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-active-state-diagnosis',
      lessonId: 'lesson-bgp-path-selection',
      type: 'predict_output',
      title: 'Finite State Machine: Diagnosing BGP State "Active"',
      prompt:
        'An engineer executes "show ip bgp summary" on a Cisco router and notices that the neighbor session state is listed as "Active". What underlying transport layer condition does state "Active" indicate?',
      learningObjective:
        'Distinguish FSM state "Active" as an active TCP connection retry rather than established data exchange.',
      scenarioContext:
        'A newly provisioned BGP peering between two enterprise data centers fails to form an adjacency. The CLI shows State/PfxRcd: Active.',
      textAnswerPattern: '(tcp|port 179|handshake|connection failure|transport)',
      acceptableAnswers: [
        'TCP connection failure (port 179)',
        'Attempting TCP connection',
        'TCP connection failure',
        'TCP 179 failure',
        'TCP handshake failure',
      ],
      hints: [
        'Do not be misled by the word "Active". In BGP, it does NOT mean active routing or active communication.',
        'Which layer 4 protocol and port does BGP rely on for neighbor peering?',
        'State "Active" means the router is actively trying (and failing) to complete the TCP port 179 3-way handshake.',
      ],
      explanation:
        'In the BGP Finite State Machine, "Active" indicates that the router is actively trying to establish a TCP connection on port 179 to the neighbor, but the TCP 3-way handshake has failed or timed out. Common root causes include: firewall/ACL blocking TCP port 179, an incorrect neighbor IP address, missing route to peer, or mismatched "update-source".',
      commonMistakes: [
        {
          mistake: 'Routes are actively being exchanged',
          explanation:
            'A common Cisco exam trap. Active route exchange only occurs in the "Established" state, which Cisco displays as a prefix count.',
        },
      ],
      practicalTakeaway:
        'When you see state "Active", immediately verify TCP 179 reachability: ping the peer IP and check if an ACL is filtering TCP 179.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-aspath-loop-prevention',
      lessonId: 'lesson-bgp-path-selection',
      type: 'multiple_choice',
      title: 'Inter-Domain Loop Prevention: The AS_PATH Attribute',
      prompt:
        'How does an eBGP router deterministically detect and prevent inter-domain routing loops when receiving routing updates from an external peer?',
      learningObjective: 'Analyze how AS_PATH provides loop-free inter-domain routing.',
      scenarioContext: 'An enterprise is multihomed to two different ISPs in AS 65001 and AS 65002.',
      options: [
        {
          id: 'opt-aspath-drop',
          label: 'The router inspects the AS_PATH; if its own local ASN is found in the list, the UPDATE is silently dropped.',
          isCorrect: true,
          explanation:
            'RFC 4271 mandates that when an eBGP speaker receives a prefix with its own ASN already present anywhere in the AS_PATH attribute, it detects an AS-level loop and discards the route.',
        },
        {
          id: 'opt-split-horizon-drop',
          label: 'The router drops the update based on Layer 2 MAC split-horizon rules.',
          isCorrect: false,
          explanation: 'Layer 2 MAC split-horizon applies to Ethernet switches, not inter-domain BGP routing.',
        },
        {
          id: 'opt-hop-count-drop',
          label: 'The router checks if the AS_PATH length exceeds 255 and increments the hop count.',
          isCorrect: false,
          explanation: 'BGP does not use a RIP-style 15/255 hop count limit for loop detection; it inspects ASN membership in AS_PATH.',
        },
        {
          id: 'opt-igp-poison',
          label: 'The router floods an infinite metric LSA back to the originating neighbor.',
          isCorrect: false,
          explanation: 'LSA flooding with poison reverse is an IGP mechanism (OSPF/RIP), not BGP.',
        },
      ],
      hints: [
        'Think about what attribute eBGP prepends every time an update leaves an autonomous system.',
        'If an AS receives an update that already has its own number in the path history, what does that signify?',
      ],
      explanation:
        'In eBGP, loop prevention is achieved through the AS_PATH attribute. Each router prepends its own ASN before sending an UPDATE to an external peer. If a router receives an UPDATE containing its own ASN, it knows the route has already traversed its AS and discards it to prevent a loop.',
      practicalTakeaway:
        'AS_PATH prepending is frequently used to make a path artificially longer to steer inbound traffic to an alternative link.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-weight-vs-localpref',
      lessonId: 'lesson-bgp-path-selection',
      type: 'multiple_choice',
      title: 'Path Policy: Cisco Weight vs. Local Preference Precedence',
      prompt:
        'A Cisco border router receives two paths to prefix 172.16.0.0/16. Path A has Weight 40,000 and Local Preference 100. Path B has Weight 0 and Local Preference 500. Which path does the router select as the Best Path, and why?',
      learningObjective:
        'Apply the exact precedence of Weight (Step 1) over Local Preference (Step 2) in the Cisco BGP Best Path Algorithm.',
      scenarioContext: 'An enterprise edge router has two uplinks configured with custom BGP route-maps.',
      options: [
        {
          id: 'opt-weight-wins',
          label: 'Path A is selected, because Cisco Weight is evaluated at Step 1 before Local Preference is evaluated at Step 2.',
          isCorrect: true,
          explanation:
            'In Cisco IOS, Weight is Step 1 of the Best Path selection algorithm. Since Path A has Weight 40,000 (higher than Path B\'s 0), Path A wins immediately. Local Preference (Step 2) is never evaluated.',
        },
        {
          id: 'opt-localpref-wins',
          label: 'Path B is selected, because Local Preference is a standard IETF attribute that overrides proprietary Weight.',
          isCorrect: false,
          explanation:
            'On Cisco routers, Weight always takes precedence over Local Preference. Standard attributes do not override Weight.',
        },
        {
          id: 'opt-ecmp-loadbalance',
          label: 'Both paths are installed into the routing table for equal-cost multipath (ECMP).',
          isCorrect: false,
          explanation: 'Multipath ECMP requires all attributes from Weight down through IGP metric to match.',
        },
        {
          id: 'opt-aspath-tiebreak',
          label: 'Neither path wins until AS_PATH length is compared.',
          isCorrect: false,
          explanation: 'Weight breaks the tie at Step 1, so subsequent steps (LocalPref, AS_PATH) are never reached.',
        },
      ],
      hints: [
        'Recall the mnemonic: "Weight Local-Pref AS-Path Origin MED". Which of the two appears first?',
        'Does the higher Local Preference on Path B get evaluated if Path A has a higher Weight?',
      ],
      explanation:
        'On Cisco routers, Weight is evaluated at Step 1 of the Best Path Algorithm before any standard BGP attribute. Because Path A has a higher Weight (40,000 > 0), the selection process terminates at Step 1 and chooses Path A as the Best Path. Path B\'s higher Local Preference (500 > 100) is never compared.',
      commonMistakes: [
        {
          mistake: 'Path B is selected because Local Preference is standard',
          explanation: 'Cisco Weight always takes absolute priority over Local Preference on the local router.',
        },
      ],
      practicalTakeaway:
        'Weight is strictly local to the router. Use Local Preference when you want to influence the exit path for the entire AS, and Weight when you only want to influence a single router.',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'RFC 4271: A Border Gateway Protocol 4 (BGP-4)',
      url: 'https://datatracker.ietf.org/doc/html/rfc4271',
      sourceType: 'rfc',
      relevantSection: 'Section 9.1: Decision Process',
    },
    {
      title: 'Cisco Documentation: BGP Best Path Selection Algorithm',
      url: 'https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/13753-25.html',
      sourceType: 'cisco_doc',
      relevantSection: 'BGP Best Path Algorithm Tie-Breakers',
    },
  ],
};
