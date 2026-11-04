import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonBgpTroubleshooting: DetailedLesson = {
  id: 'lesson-bgp-troubleshooting',
  topicId: 'topic-bgp',
  pathId: 'path-ccnp',
  slug: 'bgp-troubleshooting-and-route-advertisement',
  title: 'BGP Troubleshooting & Route Advertisement: Adjacencies, Policy Filtering & RIB Installation',
  subtitle: 'Diagnosing Stuck Neighbor States, Route Injection Failures, Inaccessible Next-Hops, and Routing Table Discrepancies',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Distinguish the 3 distinct operational phases of BGP: Neighbor Adjacency Formation, BGP Route Injection/Advertisement, and Routing Table (RIB) Installation.',
    'Accurately interpret "show ip bgp summary" CLI output, recognizing that a numeric value indicates an Established session while state names indicate ongoing or failed negotiation.',
    'Troubleshoot eBGP and iBGP neighbor adjacency failures across Layer 1-3 reachability, TCP port 179 ACL blocks, ASN configuration mismatches, and eBGP multihop TTL restrictions.',
    'Diagnose prefix injection failures under the Cisco BGP "network" command, explaining why missing exact-match routes in the local RIB prevent prefix origination.',
    'Identify and resolve inaccessible NEXT_HOP attributes in iBGP topologies using "neighbor next-hop-self" and IGP route verification.',
    'Differentiate between a route\'s presence in the BGP table ("show ip bgp") and its installation into the IP routing table ("show ip route"), diagnosing BGP RIB-failures caused by Administrative Distance conflicts.',
    'Troubleshoot prefix filtering caused by prefix-lists, route-maps, and the iBGP split-horizon rule.',
    'Execute a systematic, step-by-step diagnostic workflow to isolate and remediate enterprise BGP routing anomalies.',
  ],
  sections: [
    {
      id: 'sec-bgp-three-phases',
      title: '1. The 3-Phase BGP Operational Mental Model',
      contentMarkdown:
        'When network engineers encounter a BGP issue, they often jump directly into complex route-maps or path attributes without determining which layer of the protocol is failing. To troubleshoot BGP efficiently, you must categorize the problem into one of **three distinct operational phases**:\n\n```text\n+--------------------------------------------------------------------------+\n| PHASE 1: TRANSPORT & ADJACENCY FORMATION                                 |\n| - Physical & IP reachability (ping)                                      |\n| - TCP 3-way handshake on port 179                                        |\n| - BGP OPEN message negotiation (ASNs, BGP Router IDs, Hold Timers)       |\n| - Target State: "Established" (PfxRcd displays a number e.g., 0, 50)     |\n+--------------------------------------------------------------------------+\n                                     |\n                                     v\n+--------------------------------------------------------------------------+\n| PHASE 2: ROUTE INJECTION & POLICY FILTERING                              |\n| - Route origination (BGP "network" command exact-match check in local RIB|\n| - Outbound policy filtering (prefix-lists, route-maps, AS_PATH filters)  |\n| - iBGP split-horizon rule & Route Reflection                             |\n| - Target State: Prefix appears in local & peer\'s BGP Table ("show ip bgp")\n+--------------------------------------------------------------------------+\n                                     |\n                                     v\n+--------------------------------------------------------------------------+\n| PHASE 3: BEST PATH SELECTION & RIB INSTALLATION                          |\n| - NEXT_HOP reachability validation in the IGP                            |\n| - Deterministic 13-step best path tie-breaking (Weight, LocalPref, etc.) |\n| - Comparison against Administrative Distance of other protocols in RIB   |\n| - Target State: Prefix marked with "*>" and installed in "show ip route" |\n+--------------------------------------------------------------------------+\n```',
      callout: {
        type: 'pro_tip',
        title: 'The Troubleshooting Mental Model',
        text: 'An Established neighbor session does NOT mean routes are being exchanged. And a route present in the BGP table does NOT mean traffic can be routed! Always ask yourself: Is the session down? Is the route missing from BGP? Or is the route in BGP but missing from the IP routing table (RIB)?',
      },
    },
    {
      id: 'sec-reading-bgp-summary',
      title: '2. Interpreting "show ip bgp summary" Like a Senior Engineer',
      contentMarkdown:
        'The command `show ip bgp summary` provides the highest-level operational snapshot of all configured BGP neighbors. Understanding every column is essential for rapid diagnosis:\n\n```text\nRouter# show ip bgp summary\nBGP router identifier 10.0.0.1, local AS number 65001\nBGP table version is 28, main routing table version 28\n5 network entries using 1240 bytes of memory\n\nNeighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n198.51.100.2    4 65002    1450    1448       28    0    0 01:14:22        0\n203.0.113.5     4 65003       0       0        0    0    0 never    Active\n10.255.0.2      4 65001     512     510       28    0    0 04:02:18       14\n10.255.0.3      4 65001       0       0        0    0    0 never    Idle (Admin)\n```\n\n### The "State/PfxRcd" Column Quirk\nThis is the single most commonly misunderstood field in Cisco networking:\n- **When the session is NOT Established:** The column displays the current BGP Finite State Machine state name (e.g., `Idle`, `Connect`, `Active`, `OpenSent`, `OpenConfirm`).\n- **When the session IS Established:** The column **never displays the word "Established"**! Instead, it displays a **number**, representing the total count of valid prefixes received (`PfxRcd`) from that peer!\n\n### Analyzing the Sample Output\n- **Neighbor `198.51.100.2`:** The session is **healthy and fully Established** (Up for 1 hour 14 minutes), but has received exactly **0 prefixes**! Common reasons: the remote peer has no `network` statements configured, or local inbound route-maps are filtering all incoming prefixes.\n- **Neighbor `203.0.113.5`:** The session is in **Active** state. It has received 0 messages. The router is actively failing to establish the TCP port 179 handshake.\n- **Neighbor `10.255.0.2`:** Fully Established iBGP peer with **14 prefixes received**.\n- **Neighbor `10.255.0.3`:** In **Idle (Admin)** state because the administrator issued `neighbor 10.255.0.3 shutdown`.',
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco Trap: State "Active" is NOT Active Traffic!',
        text: 'In Cisco IOS, seeing state "Active" does NOT mean active routing! It means the router is actively trying—and failing—to complete the TCP port 179 three-way handshake with the peer. If you see state "0", the session is actually up and running; if you see "Active", transport connectivity is broken!',
      },
    },
    {
      id: 'sec-troubleshooting-adjacencies',
      title: '3. Troubleshooting Neighbor Adjacency Failures: Idle and Active',
      contentMarkdown:
        'When a BGP neighbor will not reach the Established state, it typically gets stuck in either **Idle** or **Active**.\n\n### Why a Neighbor is Stuck in "Idle"\n1. **Administratively Shutdown:** Check for `neighbor <ip> shutdown`. In `show ip bgp summary`, this appears as `Idle (Admin)`. Fix with `no neighbor <ip> shutdown`.\n2. **No Route to Neighbor IP:** The router cannot find any route in its local RIB to reach the neighbor IP address. BGP will not attempt a TCP connection without a valid route.\n3. **BGP Router ID Missing:** If the router has no active IPv4 addresses on any interface and no manual `bgp router-id` configured, the BGP process cannot initialize.\n\n### Why a Neighbor is Stuck in "Active"\nState "Active" means the router initiated a TCP SYN to the peer on port 179, but never received a valid SYN-ACK.\n\n- **Cause 1: Access List / Firewall Drop on TCP Port 179:**\n  An ACL on the local interface, intermediate firewall, or peer router is dropping TCP port 179. Verify with: `telnet <neighbor-ip> 179`.\n- **Cause 2: Peering on Loopback Without "update-source":**\n  When peering between loopbacks, the router sourcing the TCP SYN defaults to using the egress physical interface IP as its source IP. When the peer router receives a TCP SYN from `192.168.1.1`, but its configuration specifies `neighbor 1.1.1.1 remote-as ...`, it silently rejects or resets the TCP handshake! Fix: `neighbor <ip> update-source Loopback0`.\n- **Cause 3: eBGP Multihop TTL Expiration:**\n  By default, eBGP packets have an IP Time-to-Live (TTL) of **1**. If peering between loopbacks across directly connected routers, the packet must cross the internal interface to reach the loopback, which drops the TTL to 0! Fix: `neighbor <ip> ebgp-multihop 2`.\n- **Cause 4: Autonomous System Number Mismatch:**\n  If Router A configures `neighbor 10.0.0.2 remote-as 65002`, but Router B is actually configured as `router bgp 65003`, the OPEN message negotiation fails with a BGP NOTIFICATION: "Bad Peer AS".\n- **Cause 5: MD5 Password Mismatch:**\n  If `neighbor <ip> password <secret>` does not match on both sides, TCP segments fail MD5 digest validation. Cisco IOS logs: `%TCP-6-BADAUTH: Invalid MD5 digest from <ip>`.',
      callout: {
        type: 'warning',
        title: 'Diagnostic Command for TCP 179',
        text: 'Always test transport reachability before checking BGP parameters: run "ping <peer-ip> source <source-interface>" and "telnet <peer-ip> 179 /source-interface <source-interface>". If telnet cannot open port 179, the BGP FSM can never reach Established.',
      },
    },
    {
      id: 'sec-route-advertisement-rules',
      title: '4. Why Isn\'t My Prefix Advertised? The "Exact Match" Rule & Policies',
      contentMarkdown:
        'Once a neighbor session is Established, an engineer may find that expected prefixes are not appearing in the peer\'s BGP table. This stems from route injection rules or outbound filtering:\n\n### The Strict Cisco BGP "network" Command Rule\nIn interior gateway protocols (OSPF, EIGRP), the `network` command enables the protocol on matching interfaces. **BGP DOES NOT DO THIS!**\n\nIn BGP, the `network` command tells the router:\n> *"Scan the local IP routing table (RIB). If and only if an EXACT MATCH for this prefix and subnet mask is already present, inject this route into the BGP table!"*\n\n```cisco\n! Configuration:\nrouter bgp 65001\n network 10.50.0.0 mask 255.255.0.0\n\n! What show ip route displays:\nRouter# show ip route\nC        10.50.1.0/24 is directly connected, GigabitEthernet0/1\nC        10.50.2.0/24 is directly connected, GigabitEthernet0/2\n```\n\nIn this scenario, BGP **refuses to originate `10.50.0.0/16`**! The routing table has `/24` subnets, but **no exact `/16` route exists in the RIB**. \n\n**The Fix:** Create a discard static route pointing to `Null0`:\n```cisco\nip route 10.50.0.0 255.255.0.0 Null0\n```\nNow `10.50.0.0/16` exists in the local routing table, and BGP immediately originates the route into the BGP table with Origin code `i` (IGP)!\n\n### Outbound Route Policy & Prefix-Lists\nBGP provides granular filtering tools. A common mistake is a prefix-list with strict `ge` and `le` qualifiers:\n\n```cisco\nip prefix-list OUT_FILTER seq 10 permit 172.16.0.0/16 ge 24 le 24\n```\n- This permits any subnet within `172.16.0.0/16` whose mask is **exactly `/24`**.\n- If the engineer tries to advertise `172.16.10.0/26` or the aggregate `172.16.0.0/16`, the prefix is filtered by the **implicit deny** at the end of the prefix-list!\n\n### The iBGP Split-Horizon Rule\nIf Router B learns a prefix from iBGP peer Router A, Router B **will never re-advertise that prefix to iBGP peer Router C**. \n- To fix this without configuring a full-mesh of iBGP sessions, Router B must be configured as a **Route Reflector**:\n```cisco\nrouter bgp 65001\n neighbor <Router-C-IP> route-reflector-client\n```',
      callout: {
        type: 'pro_tip',
        title: 'Verification Command for Advertised Routes',
        text: 'To see exactly what prefixes a local router is sending to a specific peer after outbound policies are applied, use: "show ip bgp neighbors <ip> advertised-routes". If a prefix appears in "show ip bgp" but not in "advertised-routes", outbound policy or iBGP split-horizon is blocking it.',
      },
    },
    {
      id: 'sec-next-hop-reachability',
      title: '5. Inaccessible Next-Hop: The BGP Table vs. The Routing Table',
      contentMarkdown:
        'A prefix may successfully arrive in a router\'s BGP table, yet completely fail to appear in the global IP routing table (`show ip route`). The most common cause in enterprise networks is an **inaccessible NEXT_HOP**.\n\n### The BGP Table Symbols: `*` and `>`\nWhen inspecting `show ip bgp`, look closely at the status codes in the first two columns:\n\n```text\nRouter# show ip bgp\n   Network          Next Hop            Metric LocPrf Weight Path\n*  192.0.2.0/24     198.51.100.1             0             0 65002 i\n*> 10.100.0.0/16    10.0.12.1                0    100      0 i\n```\n\n- `*` (Valid): The router can resolve the `Next Hop` IP address through an existing route in its local IP routing table (RIB).\n- `>` (Best Path): The router evaluated all valid paths through the 13-step best path algorithm and selected this route as the winner. **Only paths with both `*` and `>` are submitted to the RIB for installation!**\n\n### The iBGP "Next-Hop Unchanged" Problem\nWhen an edge router (R1) receives an eBGP prefix from ISP-A with NEXT_HOP `198.51.100.1` and reflects it via iBGP to internal router R2:\n- By default, **R1 does not rewrite the NEXT_HOP!**\n- R2 receives the route with NEXT_HOP `198.51.100.1`.\n- Because `198.51.100.1` is an external peering IP subnet that is **not advertised into the internal IGP (OSPF/EIGRP)**, R2 cannot resolve `198.51.100.1` in its routing table!\n- Result: R2 displays `*` missing (inaccessible next-hop) or displays `*` without `>`. The route is marked invalid and is **never installed in the RIB**!\n\n**The Fix on Edge Router R1:**\n```cisco\nrouter bgp 65001\n neighbor <R2-IP> next-hop-self\n```\nR1 now rewrites the NEXT_HOP to its own internal Loopback IP address, which R2 can easily resolve via OSPF.',
      callout: {
        type: 'warning',
        title: 'Deep Diagnostic Check',
        text: 'Run "show ip bgp <prefix>" (e.g., show ip bgp 192.0.2.0). If the output displays "inaccessible" next hop, the route cannot be selected as best path. Always verify whether the NEXT_HOP is reachable via your IGP before troubleshooting BGP path attributes.',
      },
    },
    {
      id: 'sec-rib-failures-and-ad',
      title: '6. Diagnosing RIB Failures: Lower Administrative Distance Conflict',
      contentMarkdown:
        'Sometimes a route in `show ip bgp` has both `*` (valid) and `>` (best path), but also displays a lowercase **`r`**:\n\n```text\nRouter# show ip bgp\n   Network          Next Hop            Metric LocPrf Weight Path\n*>r 172.16.1.0/24   10.0.12.2                0    100      0 65002 i\n```\n\n### What Does `r` (RIB-Failure) Mean?\nThe lowercase **`r`** indicates a **RIB-Failure**. This means:\n1. BGP successfully evaluated the route and selected it as the **Best Path** (`*>`).\n2. BGP passed the route to the router\'s global Routing Information Base (RIB) process.\n3. The RIB process **rejected** the BGP route because a route for the exact same prefix already exists in the routing table with a **lower Administrative Distance (AD)**!\n\n### Administrative Distance Reference Hierarchy\n\n| Routing Source | Administrative Distance (Cisco Default) |\n| :--- | :--- |\n| **Directly Connected** | 0 |\n| **Static Route** | 1 |\n| **External BGP (eBGP)** | 20 |\n| **EIGRP (Internal)** | 90 |\n| **OSPF** | 110 |\n| **IS-IS** | 115 |\n| **RIP** | 120 |\n| **Internal BGP (iBGP)** | **200** |\n\n### Concrete Example: iBGP vs. OSPF or Static\n- An engineer creates a static route: `ip route 172.16.1.0 255.255.255.0 Null0` (AD = 1).\n- Simultaneously, the router learns `172.16.1.0/24` from an iBGP peer (AD = 200).\n- BGP selects the iBGP route as best path, but the RIB refuses to overwrite the static route because $1 < 200$!\n\n### Verifying the Cause of RIB Failure\nCisco IOS provides a dedicated diagnostic command to inspect the exact reason for any RIB failure:\n```text\nRouter# show ip bgp rib-failure\nNetwork            Next Hop                      LPrf  Med Path   Failure reason\n172.16.1.0/24      10.0.12.2                      100    0 65002  Higher admin distance\n```',
      callout: {
        type: 'pro_tip',
        title: 'RIB Failure Does NOT Mean BGP Failed!',
        text: 'A route with "r" in the BGP table is still considered a valid BGP best path! The router WILL continue to advertise this best path to its other BGP peers; it simply cannot use the BGP path for its own local forwarding because a more trusted local route exists.',
      },
    },
    {
      id: 'sec-worked-troubleshooting-case',
      title: '7. End-to-End Troubleshooting Walkthrough: Simulated Incident',
      contentMarkdown:
        'Let us walk through a complete enterprise incident diagnosis step-by-step:\n\n### The Incident Report\nInternal users at Branch Router R2 (AS 65001) cannot reach the partner web portal at `198.51.100.50` (hosted behind upstream ISP-A, AS 65002). Edge Router R1 connects to ISP-A.\n\n### Step 1: Verify Adjacency Status on R2\nOn R2, we check the iBGP session to edge router R1 (`10.0.12.1`):\n```text\nR2# show ip bgp summary\nNeighbor        V    AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd\n10.0.12.1       4 65001    2104    2100       12    0    0 03:12:44        1\n```\n&rarr; **Finding:** The iBGP session is Established and R2 has received 1 prefix.\n\n### Step 2: Inspect Prefix in R2\'s BGP Table\nWe inspect the specific partner prefix `198.51.100.0/24` on R2:\n```text\nR2# show ip bgp 198.51.100.0/24\nBGP routing table entry for 198.51.100.0/24, version 12\nPaths: (1 available, no best path)\n  Not advertised to any peer\n  65002\n    203.0.113.1 (inaccessible) from 10.0.12.1 (1.1.1.1)\n      Origin IGP, metric 0, localpref 100, valid, internal\n```\n&rarr; **Finding:** Look at `203.0.113.1 (inaccessible)` and `no best path`! R1 received the route from ISP-A with next-hop `203.0.113.1` and reflected it to R2 without rewriting the NEXT_HOP.\n\n### Step 3: Verify IGP Route to Next-Hop on R2\n```text\nR2# show ip route 203.0.113.1\n% Network not in table\n```\n&rarr; **Diagnosis Confirmed:** R2 has no route to the ISP peering subnet `203.0.113.0/30`. Because the next-hop is unreachable, the route cannot be selected as Best Path and cannot be installed in R2\'s RIB.\n\n### Step 4: Apply the Remediation on Edge Router R1\nWe configure `next-hop-self` on R1 for its peering with R2:\n```cisco\nR1(config)# router bgp 65001\nR1(config-router)# address-family ipv4\nR1(config-router-af)# neighbor 10.0.12.2 next-hop-self\n```\n\n### Step 5: Verification on R2\nWe re-examine the prefix on R2:\n```text\nR2# show ip bgp 198.51.100.0/24\nBGP routing table entry for 198.51.100.0/24, version 15\nPaths: (1 available, best #1, table default)\n  Advertised to non peer-group peers:\n    10.0.23.3\n  65002\n    10.0.12.1 (metric 1) from 10.0.12.1 (1.1.1.1)\n      Origin IGP, metric 0, localpref 100, valid, internal, best\n\nR2# show ip route 198.51.100.0\nRouting entry for 198.51.100.0/24\n  Known via "bgp 65001", distance 200, metric 0\n  Routing Descriptor Blocks:\n  * 10.0.12.1, from 10.0.12.1, 00:00:14 ago\n      Route metric is 0, share count 1\n```\n&rarr; **Result:** The route is now marked `valid, internal, best` and cleanly installed in R2\'s routing table via BGP (distance 200). Traffic to `198.51.100.50` succeeds!',
    },
    {
      id: 'sec-bgp-troubleshooting-checklist',
      title: '8. The 7-Step BGP Troubleshooting Checklist & Summary',
      contentMarkdown:
        'Whenever you troubleshoot BGP in production or in certification exams, follow this checklist in order:\n\n1. **Ping Peer IP:** Test underlay IP reachability. If you cannot ping, BGP cannot connect.\n2. **Verify TCP Port 179:** Ensure firewalls and interface ACLs permit TCP port 179 in both directions.\n3. **Verify Local & Remote ASNs:** Check `show ip bgp summary` and verify that `remote-as` matches the peer\'s actual AS number.\n4. **Check Update-Source & Multihop:** For loopback peering, verify `neighbor update-source Loopback0`. For eBGP loopback peering, verify `neighbor ebgp-multihop <ttl>`.\n5. **Check Exact Match for Network Commands:** Verify that the prefix and mask configured under `network` exist identically in `show ip route`.\n6. **Check Policy Filtering:** Run `show ip bgp neighbors <ip> advertised-routes` and `routes` to verify route-maps and prefix-lists are not filtering prefixes.\n7. **Verify Next-Hop & RIB Installation:** Run `show ip bgp <prefix>` to verify next-hop reachability (`*>` vs `*`), check for missing `next-hop-self`, and run `show ip bgp rib-failure` to detect Administrative Distance collisions.',
    },
  ],
  predictExercise: {
    id: 'ex-bgp-tb-summary-interpret',
    lessonId: 'lesson-bgp-troubleshooting',
    type: 'multiple_choice',
    title: 'BGP State Interpretation: Decoding "show ip bgp summary"',
    prompt:
      'An administrator issues "show ip bgp summary" on a Cisco IOS-XE enterprise router and observes the following output line:\n\nNeighbor: 198.51.100.2, V: 4, AS: 65002, Up/Down: 02:45:12, State/PfxRcd: 0\n\nHow should the administrator interpret the operational state of this BGP session?',
    learningObjective:
      'Accurately interpret the State/PfxRcd column in "show ip bgp summary" output, distinguishing numeric prefix counts from FSM state names.',
    scenarioContext:
      'An engineer is verifying peering with a newly provisioned secondary internet service provider.',
    options: [
      {
        id: 'opt-session-established-zero-pfx',
        label:
          'The BGP session is fully Established (up for 2h 45m), but the peer has advertised 0 prefixes or all incoming prefixes were rejected by local inbound policy.',
        isCorrect: true,
        explanation:
          'In Cisco IOS, when a BGP session is in the Established state, the State/PfxRcd column displays an integer representing the number of prefixes received. The value "0" indicates that the session is healthy and established, but exactly zero prefixes have been accepted into the BGP table.',
      },
      {
        id: 'opt-session-down-zero',
        label:
          'The BGP session is down because 0 total messages were exchanged between peers.',
        isCorrect: false,
        explanation:
          'If the session were down, the State/PfxRcd column would display the name of the FSM state (e.g., Idle, Active, Connect), not an integer.',
      },
      {
        id: 'opt-session-negotiating',
        label:
          'The session is currently negotiating TCP parameters at stage 0 of the handshake.',
        isCorrect: false,
        explanation:
          'There is no "stage 0" in BGP negotiation; FSM states are named (Idle, Connect, Active, OpenSent, OpenConfirm).',
      },
      {
        id: 'opt-session-idle',
        label:
          'The neighbor is in Idle state and waiting for the ConnectRetry timer to expire.',
        isCorrect: false,
        explanation:
          'If the neighbor were in Idle state, the column would explicitly display the word "Idle", not the number 0.',
      },
    ],
    hints: [
      'Look at the Up/Down column: the connection has been up for over 2 hours.',
      'Remember the Cisco quirk: does Cisco CLI display the word "Established" when a BGP session is up?',
    ],
    explanation:
      'In Cisco IOS, the "State/PfxRcd" column displays the state name (Idle, Active, Connect) ONLY when the session is NOT Established. Once the session reaches Established, Cisco displays the numeric count of prefixes received. Seeing "0" proves the session is fully Established, but the peer has announced 0 prefixes.',
    commonMistakes: [
      {
        mistake: 'Assuming 0 means the session is down',
        explanation:
          'Seeing a number (even 0) indicates an Established session. If the session were down, it would display a text state like "Active" or "Idle".',
      },
    ],
    practicalTakeaway:
      'A numeric value in State/PfxRcd means the BGP session is Established. A text string means the session is down or negotiating.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-bgp-tb-active-diagnose',
    lessonId: 'lesson-bgp-troubleshooting',
    type: 'troubleshooting',
    title: 'Adjacency Failure: Diagnosing Persistent "Active" State',
    prompt:
      'A border router is configured to peer with an external ISP router at 203.0.113.2 over a directly connected physical link. Running "show ip bgp summary" reveals that the neighbor persistently oscillates between "Connect" and "Active". A standard "ping 203.0.113.2" succeeds with 0% packet loss. What is the most probable root cause of this failure?',
    learningObjective:
      'Diagnose BGP neighbor failures stuck in Active state due to transport layer (TCP port 179) filtering.',
    scenarioContext:
      'A new eBGP peering circuit was activated, but the BGP session will not come up despite successful ICMP echo reachability.',
    options: [
      {
        id: 'opt-acl-tcp-179',
        label:
          'An access control list (ACL) or firewall along the path or on the peer router is blocking TCP port 179 traffic.',
        isCorrect: true,
        explanation:
          'State "Active" means the router is actively attempting to establish a TCP connection on port 179, but its TCP SYNs are timed out or rejected. Because ICMP ping succeeds (proving Layer 1-3 IP connectivity), the most likely failure is an access list or firewall dropping TCP port 179.',
      },
      {
        id: 'opt-ebgp-multihop',
        label:
          'The router is missing "neighbor 203.0.113.2 ebgp-multihop 2" on directly connected physical interfaces.',
        isCorrect: false,
        explanation:
          'Directly connected physical interface peering uses default TTL=1, which is fully sufficient. ebgp-multihop is only required when peering across multiple hops or loopback interfaces.',
      },
      {
        id: 'opt-as-path-loop',
        label:
          'The peer router\'s Autonomous System Number is already present in the AS_PATH.',
        isCorrect: false,
        explanation:
          'AS_PATH loop prevention operates during route exchange (Phase 2), well after the BGP session is already Established.',
      },
      {
        id: 'opt-bgp-sync',
        label:
          'BGP synchronization is enabled and failing to match an IGP route.',
        isCorrect: false,
        explanation:
          'BGP synchronization affects route installation into the routing table, not TCP transport session establishment.',
      },
    ],
    hints: [
      'Ping uses ICMP (IP protocol 1). BGP uses TCP port 179.',
      'What happens when ICMP is allowed through a firewall but TCP port 179 is blocked?',
    ],
    explanation:
      'Successful ping confirms physical link and IP routing health. However, BGP relies on a reliable TCP session on port 179. When an ACL or firewall blocks port 179, TCP SYN packets are discarded, causing the BGP Finite State Machine to transition from Connect to Active as it repeatedly retries.',
    commonMistakes: [
      {
        mistake: 'Assuming ping success means BGP should work',
        explanation:
          'Ping only tests ICMP. Firewalls frequently permit ICMP while blocking TCP port 179.',
      },
    ],
    practicalTakeaway:
      'When ping works but BGP is in Active state, use "telnet <ip> 179" to directly test TCP port 179 reachability.',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-bgp-tb-summary-interpret',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'multiple_choice',
      title: 'BGP State Interpretation: Decoding "show ip bgp summary"',
      prompt:
        'An administrator issues "show ip bgp summary" on a Cisco IOS-XE enterprise router and observes the following output line:\n\nNeighbor: 198.51.100.2, V: 4, AS: 65002, Up/Down: 02:45:12, State/PfxRcd: 0\n\nHow should the administrator interpret the operational state of this BGP session?',
      learningObjective:
        'Accurately interpret the State/PfxRcd column in "show ip bgp summary" output, distinguishing numeric prefix counts from FSM state names.',
      scenarioContext:
        'An engineer is verifying peering with a newly provisioned secondary internet service provider.',
      options: [
        {
          id: 'opt-session-established-zero-pfx',
          label:
            'The BGP session is fully Established (up for 2h 45m), but the peer has advertised 0 prefixes or all incoming prefixes were rejected by local inbound policy.',
          isCorrect: true,
          explanation:
            'In Cisco IOS, when a BGP session is in the Established state, the State/PfxRcd column displays an integer representing the number of prefixes received. The value "0" indicates that the session is healthy and established, but exactly zero prefixes have been accepted into the BGP table.',
        },
        {
          id: 'opt-session-down-zero',
          label:
            'The BGP session is down because 0 total messages were exchanged between peers.',
          isCorrect: false,
          explanation:
            'If the session were down, the State/PfxRcd column would display the name of the FSM state (e.g., Idle, Active, Connect), not an integer.',
        },
        {
          id: 'opt-session-negotiating',
          label:
            'The session is currently negotiating TCP parameters at stage 0 of the handshake.',
          isCorrect: false,
          explanation:
            'There is no "stage 0" in BGP negotiation; FSM states are named (Idle, Connect, Active, OpenSent, OpenConfirm).',
        },
        {
          id: 'opt-session-idle',
          label:
            'The neighbor is in Idle state and waiting for the ConnectRetry timer to expire.',
          isCorrect: false,
          explanation:
            'If the neighbor were in Idle state, the column would explicitly display the word "Idle", not the number 0.',
        },
      ],
      hints: [
        'Look at the Up/Down column: the connection has been up for over 2 hours.',
        'Remember the Cisco quirk: does Cisco CLI display the word "Established" when a BGP session is up?',
      ],
      explanation:
        'In Cisco IOS, the "State/PfxRcd" column displays the state name (Idle, Active, Connect) ONLY when the session is NOT Established. Once the session reaches Established, Cisco displays the numeric count of prefixes received. Seeing "0" proves the session is fully Established, but the peer has announced 0 prefixes.',
      commonMistakes: [
        {
          mistake: 'Assuming 0 means the session is down',
          explanation:
            'Seeing a number (even 0) indicates an Established session. If the session were down, it would display a text state like "Active" or "Idle".',
        },
      ],
      practicalTakeaway:
        'A numeric value in State/PfxRcd means the BGP session is Established. A text string means the session is down or negotiating.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-active-diagnose',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'troubleshooting',
      title: 'Adjacency Failure: Diagnosing Persistent "Active" State',
      prompt:
        'A border router is configured to peer with an external ISP router at 203.0.113.2 over a directly connected physical link. Running "show ip bgp summary" reveals that the neighbor persistently oscillates between "Connect" and "Active". A standard "ping 203.0.113.2" succeeds with 0% packet loss. What is the most probable root cause of this failure?',
      learningObjective:
        'Diagnose BGP neighbor failures stuck in Active state due to transport layer (TCP port 179) filtering.',
      scenarioContext:
        'A new eBGP peering circuit was activated, but the BGP session will not come up despite successful ICMP echo reachability.',
      options: [
        {
          id: 'opt-acl-tcp-179',
          label:
            'An access control list (ACL) or firewall along the path or on the peer router is blocking TCP port 179 traffic.',
          isCorrect: true,
          explanation:
            'State "Active" means the router is actively attempting to establish a TCP connection on port 179, but its TCP SYNs are timed out or rejected. Because ICMP ping succeeds (proving Layer 1-3 IP connectivity), the most likely failure is an access list or firewall dropping TCP port 179.',
        },
        {
          id: 'opt-ebgp-multihop',
          label:
            'The router is missing "neighbor 203.0.113.2 ebgp-multihop 2" on directly connected physical interfaces.',
          isCorrect: false,
          explanation:
            'Directly connected physical interface peering uses default TTL=1, which is fully sufficient. ebgp-multihop is only required when peering across multiple hops or loopback interfaces.',
        },
        {
          id: 'opt-as-path-loop',
          label:
            'The peer router\'s Autonomous System Number is already present in the AS_PATH.',
          isCorrect: false,
          explanation:
            'AS_PATH loop prevention operates during route exchange (Phase 2), well after the BGP session is already Established.',
        },
        {
          id: 'opt-bgp-sync',
          label:
            'BGP synchronization is enabled and failing to match an IGP route.',
          isCorrect: false,
          explanation:
            'BGP synchronization affects route installation into the routing table, not TCP transport session establishment.',
        },
      ],
      hints: [
        'Ping uses ICMP (IP protocol 1). BGP uses TCP port 179.',
        'What happens when ICMP is allowed through a firewall but TCP port 179 is blocked?',
      ],
      explanation:
        'Successful ping confirms physical link and IP routing health. However, BGP relies on a reliable TCP session on port 179. When an ACL or firewall blocks port 179, TCP SYN packets are discarded, causing the BGP Finite State Machine to transition from Connect to Active as it repeatedly retries.',
      commonMistakes: [
        {
          mistake: 'Assuming ping success means BGP should work',
          explanation:
            'Ping only tests ICMP. Firewalls frequently permit ICMP while blocking TCP port 179.',
      },
      ],
      practicalTakeaway:
        'When ping works but BGP is in Active state, use "telnet <ip> 179" to directly test TCP port 179 reachability.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-ebgp-multihop',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'troubleshooting',
      title: 'eBGP Peering: Loopback Peering TTL Expiration',
      prompt:
        'Routers R1 (AS 65001) and R2 (AS 65002) are configured to peer using their Loopback0 interfaces (1.1.1.1 and 2.2.2.2). Both loopbacks are reachable via static routes. On R1, "neighbor 2.2.2.2 update-source Loopback0" is configured. However, the session never leaves "Active" state. Packet captures show TCP SYNs with TTL=1 arriving at R2\'s physical interface and being dropped before reaching Loopback0. What configuration command is required on both routers to resolve this issue?',
      learningObjective:
        'Explain why eBGP sessions between loopback interfaces require the ebgp-multihop command to prevent TTL expiration.',
      scenarioContext:
        'An enterprise edge router has dual physical links to an ISP and attempts to peer over loopbacks for link redundancy.',
      options: [
        {
          id: 'opt-ebgp-multihop-cmd',
          label:
            'neighbor <ip> ebgp-multihop 2',
          isCorrect: true,
          explanation:
            'By default, eBGP packets are generated with an IP TTL of 1 because BGP assumes peers are directly connected. When peering between loopbacks, the incoming packet decrements its TTL from 1 to 0 as it crosses from the physical ingress interface to the internal loopback, causing the packet to be dropped. Configuring "neighbor <ip> ebgp-multihop 2" (or higher) increases the TTL so it can reach the loopback.',
        },
        {
          id: 'opt-next-hop-self-cmd',
          label:
            'neighbor <ip> next-hop-self',
          isCorrect: false,
          explanation:
            '"next-hop-self" modifies the NEXT_HOP attribute when advertising routes to iBGP peers; it does not affect IP packet TTL or transport connection establishment.',
        },
        {
          id: 'opt-allowas-in-cmd',
          label:
            'neighbor <ip> allowas-in',
          isCorrect: false,
          explanation:
            '"allowas-in" overrides the AS_PATH loop prevention check on receiving routers; it does not affect TCP transport session establishment.',
        },
        {
          id: 'opt-route-reflector-cmd',
          label:
            'neighbor <ip> route-reflector-client',
          isCorrect: false,
          explanation:
            'Route reflection is strictly an iBGP feature used to circumvent iBGP split-horizon within the same AS.',
        },
      ],
      hints: [
        'What is the default IP TTL of eBGP packets compared to iBGP packets (1 vs 255)?',
        'How many hops does an IP packet take to travel from a physical interface to an internal loopback interface on the same router?',
      ],
      explanation:
        'eBGP defaults to TTL=1. When peering with a loopback address, the packet arrives at the physical interface and must make an internal forwarding hop to the loopback interface, exhausting the TTL (1 - 1 = 0). The "neighbor <ip> ebgp-multihop <ttl>" command raises the TTL, allowing the TCP handshake to succeed.',
      commonMistakes: [
        {
          mistake: 'Assuming update-source is the only command needed for loopbacks',
          explanation:
            'While "update-source" fixes the source IP address in the TCP header, "ebgp-multihop" is also required for eBGP to prevent TTL expiration.',
        },
      ],
      practicalTakeaway:
        'For eBGP loopback peering, you ALWAYS need two commands: "neighbor <ip> update-source Loopback0" AND "neighbor <ip> ebgp-multihop <ttl>".',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-network-cmd-predict',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'predict_output',
      title: 'Route Origination: Cisco BGP "network" Exact-Match Rule',
      prompt:
        'Under "router bgp 65001", an administrator configures: "network 10.50.0.0 mask 255.255.0.0". However, "show ip bgp" does not list 10.50.0.0/16. Looking at "show ip route", the routing table contains only 10.50.1.0/24 and 10.50.2.0/24 (no /16 route exists in the RIB). What exact Cisco IOS static route command should be added to satisfy BGP\'s exact-match injection requirement without forwarding traffic to a physical interface?',
      learningObjective:
        'Apply the Cisco BGP exact-match rule and use a static route to Null0 to originate prefix aggregates.',
      scenarioContext:
        'An enterprise is advertising an aggregate prefix to an upstream ISP while its local network consists of smaller subnets.',
      textAnswerPattern: '^ip\\s+route\\s+10\\.50\\.0\\.0\\s+255\\.255\\.0\\.0\\s+null\\s*0$',
      acceptableAnswers: [
        'ip route 10.50.0.0 255.255.0.0 Null0',
        'ip route 10.50.0.0 255.255.0.0 null0',
        'ip route 10.50.0.0 255.255.0.0 Null 0',
        'ip route 10.50.0.0 255.255.0.0 null 0',
      ],
      hints: [
        'The command begins with standard static route syntax: "ip route <prefix> <mask>".',
        'The route should point to a virtual discard interface so packets without more-specific routes are dropped safely.',
        'The interface is "Null0".',
      ],
      explanation:
        'In Cisco IOS BGP, the "network" command will only inject a route into the BGP table if an exact match for both the network ID and subnet mask is already present in the IP routing table (RIB). Adding "ip route 10.50.0.0 255.255.0.0 Null0" places the exact /16 prefix into the RIB, allowing BGP to advertise it immediately.',
      commonMistakes: [
        {
          mistake: 'Entering an interface IP as the next hop',
          explanation:
            'Pointing the aggregate to Null0 is the standard best practice; more specific routes in the RIB still take precedence for actual forwarding.',
        },
      ],
      practicalTakeaway:
        'No exact match in "show ip route" means no route in "show ip bgp". Use a static route to Null0 to create summary prefixes for BGP.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-nexthop-inaccessible',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'troubleshooting',
      title: 'BGP Table Validation: Resolving Inaccessible Next-Hop',
      prompt:
        'In AS 65001, internal router R2 learns external prefix 203.0.113.0/24 from border router R1 via iBGP. In "show ip bgp" on R2, the route appears as:\n\n*  203.0.113.0/24   198.51.100.1   0   100   0 65002 i\n\nNotice the absence of the ">" (best path) marker. Running "show ip route 198.51.100.1" on R2 yields "% Subnet not in table". Why is R2 refusing to install this route into its routing table, and how should it be fixed?',
      learningObjective:
        'Diagnose inaccessible NEXT_HOP attributes in iBGP and resolve them using "neighbor next-hop-self".',
      scenarioContext:
        'An enterprise border router has an eBGP session with an ISP and reflects internet routes to internal core routers over iBGP.',
      options: [
        {
          id: 'opt-nexthop-unreachable',
          label:
            'The NEXT_HOP (198.51.100.1) is unreachable in R2\'s IGP routing table because R1 preserved the external next-hop. Configure "neighbor <R2-IP> next-hop-self" on border router R1.',
          isCorrect: true,
          explanation:
            'By default, when an edge router forwards eBGP routes to an iBGP peer, it preserves the external NEXT_HOP unchanged. Because internal routers do not run the external peering subnet in their IGP (OSPF/EIGRP), R2 cannot resolve 198.51.100.1. Without a valid next-hop, the route cannot be selected as Best Path (missing ">"). Configuring "next-hop-self" on R1 causes R1 to replace the NEXT_HOP with its own internal address.',
        },
        {
          id: 'opt-weight-zero',
          label:
            'The route has a Weight of 0, which causes R2 to invalidate it.',
          isCorrect: false,
          explanation:
            'Weight defaults to 0 for learned routes; a Weight of 0 is completely normal and valid.',
        },
        {
          id: 'opt-aspath-too-long',
          label:
            'The AS_PATH attribute is invalid for iBGP propagation.',
          isCorrect: false,
          explanation:
            'The AS_PATH contains 65002, which is completely valid. It has not looped back to 65001.',
        },
        {
          id: 'opt-local-pref-low',
          label:
            'Local Preference is 100, which is below the minimum threshold for internal routing.',
          isCorrect: false,
          explanation:
            'Local Preference 100 is the default value across all Cisco iBGP implementations.',
        },
      ],
      hints: [
        'Notice that R2 has no route to 198.51.100.1 in "show ip route 198.51.100.1".',
        'What command on the border router forces it to advertise its own IP address as the next-hop to iBGP peers?',
      ],
      explanation:
        'For a BGP route to be considered for Best Path selection, its NEXT_HOP must be resolvable in the local routing table. When border routers send eBGP routes into iBGP without "neighbor <ip> next-hop-self", the external next hop is preserved, which internal routers cannot reach. Configuring "next-hop-self" solves this universally.',
      commonMistakes: [
        {
          mistake: 'Redistributing the external subnet into OSPF',
          explanation:
            'While redistributing the external ISP subnet into the IGP technically makes the next-hop reachable, it violates enterprise security and route hygiene. The proper, robust fix is always "next-hop-self".',
        },
      ],
      practicalTakeaway:
        'Missing ">" with an external next-hop on an iBGP peer almost always means you forgot "neighbor <ip> next-hop-self" on the border router.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-rib-failure',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'multiple_choice',
      title: 'Routing Table Discrepancy: Identifying BGP RIB-Failures',
      prompt:
        'When inspecting "show ip bgp", an engineer observes the status code prefix: "*>r 172.16.1.0/24 10.0.12.2". What does the lowercase "r" character specifically indicate?',
      learningObjective:
        'Identify BGP RIB-failures and explain how Administrative Distance precedence causes routing table discrepancies.',
      scenarioContext:
        'A network engineer is auditing route tables and notices routes marked with "r" in the BGP table.',
      options: [
        {
          id: 'opt-rib-failure-ad',
          label:
            'The route is selected as the BGP Best Path (*>), but failed installation into the global routing table (RIB) because another protocol with a lower Administrative Distance already installed the prefix.',
          isCorrect: true,
          explanation:
            'The code "r" stands for RIB-failure. BGP evaluated the route and picked it as Best Path (*>), but when it submitted the route to the router\'s global routing table, the RIB rejected it because a route for the exact same prefix already exists with a lower Administrative Distance (e.g., an OSPF route with AD 110 or a static route with AD 1 vs iBGP AD 200).',
        },
        {
          id: 'opt-route-reflector',
          label:
            'The route was reflected by a BGP Route Reflector and has the ORIGINATOR_ID attribute attached.',
          isCorrect: false,
          explanation:
            'Reflected routes are not designated by "r"; "r" strictly indicates a RIB-failure.',
        },
        {
          id: 'opt-restarted',
          label:
            'The route is undergoing BGP Graceful Restart after a peer flap.',
          isCorrect: false,
          explanation:
            'Graceful restart routes are not marked with "r"; "r" is the RIB-failure indicator.',
        },
        {
          id: 'opt-redistributed',
          label:
            'The route was redistributed into BGP from an interior gateway protocol.',
          isCorrect: false,
          explanation:
            'Redistributed routes are indicated by Origin code "?" (Incomplete), not by the prefix flag "r".',
        },
      ],
      hints: [
        'Think about what happens when two different routing protocols (e.g., OSPF AD 110 and iBGP AD 200) both want to install the same prefix.',
        'Which routing source wins in the global routing table?',
      ],
      explanation:
        'A RIB-failure ("r") occurs when BGP selects a route as best path, but cannot install it into the IP routing table because another routing source with a lower Administrative Distance already owns that prefix. You can view the exact failure reason using "show ip bgp rib-failure".',
      commonMistakes: [
        {
          mistake: 'Thinking the route is broken and cannot be advertised',
          explanation:
            'Even with a RIB-failure, the router will still advertise the route to its BGP peers as its Best Path; it simply does not use the BGP path for its own local forwarding.',
        },
      ],
      practicalTakeaway:
        'When you see "*>r", check "show ip bgp rib-failure" and "show ip route <prefix>" to see which protocol with lower AD is preempting BGP.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-prefixlist-filtering',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'troubleshooting',
      title: 'Policy Filtering: Prefix-List "ge" and "le" Boundary Enforcement',
      prompt:
        'An enterprise configures an outbound prefix-list to permit only /24 subnets belonging to the 172.16.0.0/16 summary block:\n\nip prefix-list OUT_FILTER seq 10 permit 172.16.0.0/16 ge 24 le 24\n\nThe administrator attempts to advertise subnet 172.16.10.0/26 to an upstream provider, but the provider reports the route is missing. Why did this prefix-list filter out 172.16.10.0/26?',
      learningObjective:
        'Diagnose prefix filtering caused by prefix-list "ge" (greater than or equal) and "le" (less than or equal) subnet mask boundaries.',
      scenarioContext:
        'An engineer is verifying an outbound BGP policy applied with "neighbor <ip> prefix-list OUT_FILTER out".',
      options: [
        {
          id: 'opt-prefix-mask-too-long',
          label:
            'The "le 24" parameter restricts the maximum prefix length to 24 bits. A /26 subnet has 26 bits, violating the constraint and hitting the implicit deny.',
          isCorrect: true,
          explanation:
            'The syntax "172.16.0.0/16 ge 24 le 24" strictly matches prefixes within the 172.16.0.0/16 network that have an exact mask length of /24 (greater than or equal to 24 AND less than or equal to 24). Subnet 172.16.10.0/26 has a mask length of 26, which is greater than 24, so it is denied by the implicit "deny all" at the end of the prefix-list.',
        },
        {
          id: 'opt-ge-clause-error',
          label:
            'The "ge 24" clause requires the prefix length to be shorter than 24 bits.',
          isCorrect: false,
          explanation:
            '"ge" stands for "greater than or equal to"; it requires the mask length to be 24 or longer.',
        },
        {
          id: 'opt-private-ip-blocked',
          label:
            'BGP prefix-lists automatically reject RFC 1918 private address ranges.',
          isCorrect: false,
          explanation:
            'Prefix-lists do not automatically drop private IPs; they evaluate purely based on the specified binary mask rules.',
        },
        {
          id: 'opt-seq-number',
          label:
            'The sequence number 10 is reserved for default route filtering.',
          isCorrect: false,
          explanation:
            'Sequence numbers in Cisco IOS prefix-lists are user-defined ordering identifiers and have no reserved functional meanings.',
        },
      ],
      hints: [
        'Break down "ge 24" and "le 24": what range of prefix lengths does this match?',
        'Does a /26 prefix length fall within the range [24, 24]?',
      ],
      explanation:
        'In Cisco IOS prefix-lists, "ge A le B" specifies the allowed range of prefix lengths: A <= length <= B. Here, "ge 24 le 24" specifies that the prefix length must be exactly 24. Since /26 is outside this range, the prefix is blocked by the implicit deny.',
      commonMistakes: [
        {
          mistake: 'Assuming /16 ge 24 permits all subnets /24 and longer',
          explanation:
            'If "le" is omitted, it defaults to 32. But when "le 24" is explicitly specified, it caps the maximum prefix length at /24.',
        },
      ],
      practicalTakeaway:
        'To allow /24 through /26 subnets, the command must be written as: "permit 172.16.0.0/16 ge 24 le 26".',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-workflow-sequence',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'sequence',
      title: 'BGP Troubleshooting Methodology: Systematic Stage Ordering',
      prompt:
        'Arrange the six standard stages of the systematic BGP troubleshooting workflow in the correct sequence from initial transport validation to final routing table installation.',
      learningObjective:
        'Execute a structured, multi-tier diagnostic sequence for isolating BGP failures.',
      scenarioContext:
        'A network operations center engineer receives an alert that customer prefixes are not reachable across an enterprise BGP peering boundary.',
      sequenceItems: [
        {
          id: 'step-layer3-ping',
          text: '1. Verify Layer 1-3 underlay IP reachability by pinging the neighbor IP address',
          correctIndex: 0,
        },
        {
          id: 'step-tcp-179-test',
          text: '2. Test TCP port 179 transport connectivity and inspect interface ACLs / firewalls',
          correctIndex: 1,
        },
        {
          id: 'step-fsm-summary',
          text: '3. Inspect "show ip bgp summary" for FSM state (Idle, Active, Established) and ASN match',
          correctIndex: 2,
        },
        {
          id: 'step-rib-exact-match',
          text: '4. Verify local prefix existence in the IP routing table (RIB) for exact-match "network" commands',
          correctIndex: 3,
        },
        {
          id: 'step-policy-advertised',
          text: '5. Inspect outbound advertised routes ("show ip bgp neighbors <ip> advertised-routes") for policy filters',
          correctIndex: 4,
        },
        {
          id: 'step-nexthop-rib-eval',
          text: '6. Verify NEXT_HOP reachability in BGP table and check "show ip bgp rib-failure" for AD conflicts',
          correctIndex: 5,
        },
      ],
      hints: [
        'Always start with bottom-up transport verification: Layer 3 ping and Layer 4 TCP port 179.',
        'Next, check the neighbor summary state before investigating whether prefixes are advertised.',
        'Finally, check next-hop reachability and RIB installation for routes that have been exchanged.',
      ],
      explanation:
        'Systematic BGP troubleshooting proceeds from bottom to top: (1) Ping for IP reachability, (2) Test TCP port 179, (3) Check "show ip bgp summary" FSM state, (4) Verify exact-match routes in RIB for "network" injection, (5) Check advertised routes for policy filtering, and (6) Verify next-hop reachability and RIB failures in the BGP table.',
      practicalTakeaway:
        'Never troubleshoot route-maps or path selection if the neighbor is stuck in Active state. Always follow the 3-phase sequence: Transport -> Exchange -> Installation.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-bgp-tb-ibgp-splithorizon',
      lessonId: 'lesson-bgp-troubleshooting',
      type: 'multiple_choice',
      title: 'iBGP Route Propagation: The Split-Horizon Prevention Rule',
      prompt:
        'In Autonomous System 65100, Routers A, B, and C are configured with iBGP. Router A peers with Router B, and Router B peers with Router C (there is no direct iBGP session configured between A and C). Router A advertises route 10.99.0.0/24 to Router B. Router B installs the route into its BGP table. However, Router C never receives the route. What is the fundamental protocol reason Router B refuses to advertise this route to Router C?',
      learningObjective:
        'Explain the iBGP split-horizon loop-prevention rule and how Route Reflectors solve it.',
      scenarioContext:
        'An enterprise is scaling its internal iBGP network without having established a full mesh of peering sessions.',
      options: [
        {
          id: 'opt-ibgp-split-horizon',
          label:
            'Under the iBGP split-horizon rule, a router will never advertise a route learned from one iBGP peer to another iBGP peer unless it is configured as a BGP Route Reflector.',
          isCorrect: true,
          explanation:
            'Because iBGP does not modify the AS_PATH attribute, AS_PATH cannot prevent routing loops within an AS. Therefore, BGP enforces the iBGP Split-Horizon rule: any route learned via iBGP will never be advertised to another iBGP peer. To propagate routes between iBGP peers without a full mesh, Router B must be configured as a Route Reflector ("neighbor <C-IP> route-reflector-client").',
        },
        {
          id: 'opt-ttl-expired',
          label:
            'The iBGP packet TTL expired when hopping across Router B.',
          isCorrect: false,
          explanation:
            'iBGP packets have a default TTL of 255 and do not expire across internal router hops.',
        },
        {
          id: 'opt-as-path-loop-ibgp',
          label:
            'Router C detects its own ASN in the AS_PATH and silently drops the update.',
          isCorrect: false,
          explanation:
            'iBGP does not prepend ASNs to the AS_PATH; the AS_PATH remains unchanged in iBGP.',
        },
        {
          id: 'opt-next-hop-missing',
          label:
            'Router B drops the update because it lacks an IGP route to Router C.',
          isCorrect: false,
          explanation:
            'Router B and C already have an active iBGP session; next-hop reachability does not prevent route advertisement in the control plane.',
        },
      ],
      hints: [
        'Does iBGP add AS numbers to the AS_PATH when sharing routes internally?',
        'How does iBGP prevent internal routing loops without a full mesh?',
      ],
      explanation:
        'The iBGP split-horizon rule is a foundational protocol constraint: a route learned from an iBGP peer will NEVER be passed along to another iBGP peer. To break this limitation, you must configure a full mesh of iBGP sessions between all routers or deploy Route Reflectors.',
      commonMistakes: [
        {
          mistake: 'Assuming BGP automatically floods routes like OSPF LSAs',
          explanation:
            'OSPF floods link-state advertisements across an area, but iBGP strictly adheres to split-horizon and never forwards iBGP-learned routes to other iBGP peers.',
        },
      ],
      practicalTakeaway:
        'If an internal router is not learning routes from an iBGP neighbor, check if the neighbor learned those routes via iBGP without Route Reflection.',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'Cisco Support: Troubleshooting BGP Neighbor Adjacency and Flapping',
      url: 'https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/22144-bgp-trouble-main.html',
      sourceType: 'cisco_doc',
      relevantSection: 'BGP Neighbor States & Transport Troubleshooting',
    },
    {
      title: 'Cisco Support: BGP Inaccessible Next Hop and RIB Failures',
      url: 'https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/13753-25.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Next-Hop Reachability & RIB Failure Resolution',
    },
    {
      title: 'RFC 4271: A Border Gateway Protocol 4 (BGP-4)',
      url: 'https://datatracker.ietf.org/doc/html/rfc4271',
      sourceType: 'rfc',
      relevantSection: 'Section 8: BGP Finite State Machine',
    },
  ],
};
