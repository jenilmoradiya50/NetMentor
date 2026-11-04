import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonSdWanRoutingPolicy: DetailedLesson = {
  id: 'lesson-sd-wan-routing-policy',
  topicId: 'topic-sdwan',
  pathId: 'path-ccnp',
  slug: 'cisco-sd-wan-routing-policies-and-troubleshooting',
  title: 'Cisco SD-WAN Routing, Policies & Troubleshooting: OMP, Policy Enforcement & Forwarding Diagnostics',
  subtitle: 'OMP Route Propagation, TLOC Health, BFD Telemetry, Centralized vs. Localized Policies, and Data-Plane Incident Resolution',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Explain how the Overlay Management Protocol (OMP) distributes vRoutes, TLOCs, and service routes between WAN Edge routers and vSmart controllers.',
    'Interpret the critical relationship between service routes, TLOC 3-tuples, and physical underlay transport reachability.',
    'Distinguish control-plane route availability in the OMP table from active data-plane reachability over BFD-monitored IPsec tunnels.',
    'Differentiate the 4 policy quadrants: Centralized Control, Centralized Data, Localized Control, and Localized Data policies, detailing their operational locations and scopes.',
    'Analyze Application-Aware Routing (AAR) mechanics, calculating SLA threshold metrics (latency, loss, jitter) and evaluating dynamic path failover behavior.',
    'Diagnose complex multi-tier SD-WAN routing and forwarding anomalies using simulated CLI evidence, BFD telemetry, and policy configurations.',
    'Execute a structured 7-stage SD-WAN troubleshooting workflow from underlay verification to forwarding-plane validation.',
  ],
  sections: [
    {
      id: 'sec-omp-route-propagation',
      title: '1. OMP Route Propagation: Control Plane vs. Forwarding Ability',
      contentMarkdown:
        'The **Overlay Management Protocol (OMP)** is the central nervous system of the Cisco SD-WAN control plane. Operating exclusively over secure DTLS or TLS control connections established between WAN Edge routers and **vSmart controllers**, OMP coordinates all routing, transport attachment points, and encryption keys across the fabric.\n\n### How Edge Devices Advertise Routes to vSmart\nWAN Edge routers do not peer with each other to exchange routes. Instead, all routing information is exchanged through a **hub-and-spoke control model** with vSmart:\n\n1. **Local LAN Route Ingestion:** Inside each Service VPN (e.g., VPN 10), the WAN Edge learns customer routes from the local site LAN via connected interfaces, static routes, OSPF, or BGP.\n2. **OMP Route Generation (vRoutes):** The WAN Edge redistributes these LAN prefixes into OMP. Each OMP route is packaged with mandatory attributes:\n   - **Prefix & Mask:** e.g., `10.1.10.0/24`.\n   - **VPN ID:** The Service VPN (VRF) where the route originated (e.g., VPN 10).\n   - **TLOC Next-Hop:** The Transport Location 3-tuple identifying the exit interface (e.g., `(10.255.0.1, mpls, ipsec)`).\n   - **Originator & Origin:** System IP of the router and routing protocol source (OSPF, BGP, Connected).\n   - **Preference & Tag:** Administrative metrics used by policies to influence best-path selection.\n3. **TLOC Advertising:** Concurrently, the WAN Edge advertises its own TLOC routes to vSmart, informing the fabric of its public and private transport IPs, colors, and IPsec Security Association (SA) encryption keys.\n\n### How vSmart Distributes Routes to Relevant Edges\nUpon receiving OMP advertisements, vSmart acts as a route reflector and policy engine:\n\n- It runs the **OMP Best Path Algorithm** (preferring higher OMP Preference, higher TLOC Preference, lower Origin Type, lower System IP).\n- It applies **Centralized Control Policies** to filter, modify, or steer routes (e.g., hiding branch routes from other branches to enforce a hub-and-spoke topology).\n- It advertises the filtered and validated vRoutes to authorized peer WAN Edges.\n\n```text\n+-----------------------------------------------------------------------------+\n|                          CISCO vSMART CONTROLLER                            |\n|   - Receives vRoutes & TLOCs from cEdge-1 & cEdge-2                         |\n|   - Executes Centralized Control Policies (filters / topology / VPN leaking)|\n|   - Reflects Best Paths to authorized WAN Edges                             |\n+-----------------------------------------------------------------------------+\n           ^                                                      ^\n           | (OMP over DTLS)                                      | (OMP over DTLS)\n           v                                                      v\n+-----------------------+                            +-----------------------+\n| Branch 1 (cEdge-1)    |   ====== IPsec ======      | Branch 2 (cEdge-2)    |\n| LAN: 10.1.10.0/24     |<==========================>| LAN: 10.2.20.0/24     |\n| VPN 10                |     (Data Plane Tunnel)    | VPN 10                |\n+-----------------------+                            +-----------------------+\n```\n\n### The Crucial Principle: Route Availability &ne; Forwarding Ability\nA frequent trap for engineers new to SD-WAN is assuming that seeing a route in `show omp routes` guarantees connectivity. **It does not!**\n- **Route Availability:** Indicates solely that the vSmart controller successfully processed the OMP advertisement and shared it with the local edge.\n- **Forwarding Ability:** Requires that the route\'s next-hop TLOC is reachable on the physical underlay, the data-plane IPsec tunnel has successfully formed, and the **BFD session** on that tunnel is in the `up` state.',
      callout: {
        type: 'pro_tip',
        title: 'OMP ECMP Scaling',
        text: 'By default, Cisco SD-WAN supports up to 4 equal-cost multipath (ECMP) TLOCs per prefix (configurable up to 16 using "max-omp-paths"). If a site has both MPLS and Business Internet uplinks, vSmart advertises the prefix with both TLOCs, enabling active/active transport utilization.',
      },
    },
    {
      id: 'sec-tlocs-transport-reachability',
      title: '2. TLOCs, Transport Reachability & The Role of BFD',
      contentMarkdown:
        'To route packets across the overlay, every OMP route must resolve to an active **Transport Location (TLOC)**. A TLOC is the attachment point where a WAN Edge connects to the underlay transport network.\n\n### The Anatomy of a TLOC\nA TLOC is uniquely identified by a **3-tuple**:\n```text\nTLOC = ( System-IP, Color, Encapsulation )\n```\n- **System IP:** A unique `/32` IPv4 address identifying the router across the entire SD-WAN fabric.\n- **Color:** An abstraction identifying the underlay transport medium (e.g., `mpls`, `biz-internet`, `public-internet`, `lte`).\n- **Encapsulation:** The tunnel encapsulation protocol (`ipsec` or `gre`).\n\nIn addition to the 3-tuple, each TLOC advertisement carries vital transport attributes:\n- **Private IP & Private Port:** The local interface IP assigned to the WAN port in VPN 0.\n- **Public IP & Public Port:** The post-NAT external IP and port discovered dynamically via STUN from the vBond Orchestrator.\n- **Site ID & Weight:** Used for localized traffic distribution.\n- **Encap Key (SPI & Key Hash):** The symmetric AES encryption key used to encrypt data packets sent to this TLOC.\n\n### The Role of BFD (Bidirectional Forwarding Detection)\nOnce a WAN Edge resolves a remote TLOC from vSmart, it attempts to establish a direct, peer-to-peer **IPsec tunnel** to that remote TLOC\'s public/private IP address over the underlay. To monitor the health of this tunnel, **BFD runs inside every IPsec tunnel**:\n\n```text\n+-----------------------------------------------------------------------------+\n|                          IPsec DATA PLANE TUNNEL                            |\n|  +-----------------------------------------------------------------------+  |\n|  | Outer IP Header: 198.51.100.2 -> 203.0.113.10 (UDP Port 12346)        |  |\n|  | +-------------------------------------------------------------------+ |  |\n|  | | ESP Header: SPI 256 (AES-256-GCM Encryption)                      | |  |\n|  | | +---------------------------------------------------------------+ | |  |\n|  | | | BFD Echo / Control Probes (Hello every 1000ms, Multiplier 7)  | | |  |\n|  | | | - Measures real-time: Loss, Latency, Jitter                   | | |  |\n|  | | +---------------------------------------------------------------+ | |  |\n|  | +-------------------------------------------------------------------+ |  |\n|  +-----------------------------------------------------------------------+  |\n+-----------------------------------------------------------------------------+\n```\n\n### What BFD Accomplishes\n1. **Data-Plane Liveliness:** If BFD echoes stop arriving (default timeout: 7 intervals &times; 1000ms = 7 seconds), the tunnel is declared **`down`**.\n2. **Path Removal from FIB:** If all TLOCs for an OMP route lose their BFD sessions, the route is immediately removed from the forwarding table (FIB), even if vSmart still shows the route in OMP!\n3. **Continuous Performance Telemetry:** BFD measures round-trip latency, packet loss percentage, and jitter every second, feeding this real-time telemetry directly into the Application-Aware Routing (AAR) engine.',
      callout: {
        type: 'warning',
        title: 'Diagnostic Trap: Control Up &ne; Data Up',
        text: 'A WAN Edge can have healthy DTLS control connections to vSmart and vManage over the Internet, while all BFD data plane sessions over MPLS are completely down! Never rely solely on "show control connections" to determine network health; always verify "show bfd sessions".',
      },
    },
    {
      id: 'sec-vpn-segmentation-routing',
      title: '3. VPN Segmentation & Route Reachability',
      contentMarkdown:
        'Cisco SD-WAN achieves multi-tenant isolation and security segmentation through **Virtual Private Networks (VPNs)**. In SD-WAN terminology, a VPN is functionally identical to a traditional **VRF (Virtual Routing and Forwarding)** instance.\n\n### The Three VPN Categories\n\n| VPN Range | Functional Name | Operational Role |\n| :--- | :--- | :--- |\n| **VPN 0** | **Transport VPN** | Reserved exclusively for underlay WAN physical interfaces, default gateways, DNS, and secure DTLS/TLS control connections to controllers. **Never carries customer user data.** |\n| **VPN 512** | **Management VPN** | Dedicated to out-of-band management interfaces (e.g., `GigabitEthernet0` on IOS-XE, `eth0` on vEdge). Isolated from the overlay fabric. |\n| **VPN 1–511, 513–65530** | **Service VPNs** | Customer user payload traffic (e.g., VPN 10 = Corporate Users, VPN 20 = Guest Wi-Fi, VPN 30 = PCI-DSS POS Systems). Completely isolated from each other. |\n\n### Inter-Site VPN Route Isolation\nBy default, route propagation in Cisco SD-WAN strictly preserves VPN boundaries:\n- An OMP route originated in **VPN 10** at Site 1 is advertised with tag `VPN 10`.\n- When vSmart reflects the route to Site 2, it is installed **only** into Site 2\'s VPN 10 routing table.\n- **Zero Inter-VPN Leaking by Default:** A client in VPN 10 at Site 1 **cannot communicate** with a server in VPN 20 at Site 2, even if physical connectivity, control connections, and BFD tunnels are 100% operational!\n\n### Platform Configuration Syntax Comparison\nWhile architectural principles are identical, command-line syntax differs between original Viptela OS (vEdge) and Cisco IOS XE SD-WAN (cEdge):\n\n```cisco\n! --- Cisco IOS XE SD-WAN (cEdge) Syntax ---\nvrf definition 10\n description Corporate_Users\n address-family ipv4\n exit-address-family\n!\ninterface GigabitEthernet0/0/2\n description LAN_Interface_VPN10\n vrf forwarding 10\n ip address 10.1.10.1 255.255.255.0\n no shutdown\n\n! --- Cisco Viptela OS (vEdge) Legacy Syntax ---\nvpn 10\n name Corporate_Users\n interface ge0/2\n  ip address 10.1.10.1/24\n  no shutdown\n exit\nexit\n```',
      callout: {
        type: 'rfc',
        title: 'Inter-VPN Route Leaking',
        text: 'To permit communication between different Service VPNs (e.g., shared services in VPN 10 accessed by users in VPN 20), an administrator must configure centralized control policies on vSmart or route leaking in localized configuration. Routes are never leaked automatically.',
      },
    },
    {
      id: 'sec-centralized-vs-localized-policies',
      title: '4. Centralized vs. Localized Policies: The 4-Quadrant Framework',
      contentMarkdown:
        'Policies are the primary mechanism by which network architects customize traffic flow, manipulate routing paths, enforce security, and guarantee application SLAs in Cisco SD-WAN. Policies are strictly classified into a **4-quadrant framework** based on where they are provisioned and where they execute:\n\n```text\n+-----------------------------------------------------------------------------+\n|                        THE 4-QUADRANT POLICY MATRIX                         |\n|                                                                             |\n|                      CONTROL PLANE                DATA PLANE                |\n|               +---------------------------+---------------------------+     |\n|               | 1. Centralized Control    | 2. Centralized Data       |     |\n|   CENTRALIZED | - Configured: vManage     | - Configured: vManage     |     |\n|   (vManage)   | - Executed: vSmart        | - Executed: WAN Edges     |     |\n|               | - Scope: OMP Routes,      | - Scope: Deep Packet      |     |\n|               |   TLOCs, Fabric Topology  |   Inspection, DIA, AAR    |     |\n|               +---------------------------+---------------------------+     |\n|               | 3. Localized Control      | 4. Localized Data         |     |\n|     LOCAL     | - Configured: Device/CLI  | - Configured: Device/CLI  |     |\n|   (WAN Edge)  | - Executed: Local Edge    | - Executed: Local Edge    |     |\n|               | - Scope: BGP/OSPF Route   | - Scope: Interface ACLs,  |     |\n|               |   Maps, Prefix-Lists      |   QoS Queuing, Shaping    |     |\n|               +---------------------------+---------------------------+     |\n+-----------------------------------------------------------------------------+\n```\n\n### Detailed Quadrant Breakdown\n\n1. **Centralized Control Policy:**\n   - **Where it executes:** On the **vSmart controller**.\n   - **What it influences:** Fabric overlay topology and route distribution. By altering TLOCs or filtering OMP routes, it transforms a default full-mesh into **Hub-and-Spoke**, creates regional extranets, or leaks routes between VPNs.\n   - **Diagnostic command on vSmart:** `show policy from-vsmart`.\n\n2. **Centralized Data Policy:**\n   - **Where it executes:** On **WAN Edge routers** (pushed down by vSmart).\n   - **What it influences:** Data-plane packet forwarding based on Layer 3/4 headers or Layer 7 application signatures. Used for **Direct Internet Access (DIA)** breakout, service node chaining (firewall redirection), and **Application-Aware Routing (AAR)**.\n   - **Diagnostic command on WAN Edge:** `show policy data-policy-filter`.\n\n3. **Localized Control Policy:**\n   - **Where it executes:** On the **local WAN Edge**.\n   - **What it influences:** Traditional routing protocols running on the LAN or underlay side (e.g., BGP route-maps, OSPF summarization, redistribution filters between LAN and OMP).\n\n4. **Localized Data Policy:**\n   - **Where it executes:** On the **local WAN Edge**.\n   - **What it influences:** Physical interface traffic shaping, policers, egress priority queuing, and access control lists (ACLs).',
      callout: {
        type: 'pro_tip',
        title: 'Where Does Application-Aware Routing (AAR) Live?',
        text: 'Application-Aware Routing is a specialized sub-type of Centralized Data Policy. While configured in vManage and pushed by vSmart, AAR evaluates and executes entirely in the data plane on the WAN Edge router using real-time BFD probe measurements.',
      },
    },
    {
      id: 'sec-application-aware-routing',
      title: '5. Application-Aware Routing (AAR) & SLA Path Selection',
      contentMarkdown:
        'Traditional routing protocols forward traffic based on static hop counts (RIP), interface bandwidth (OSPF), or composite administrative metrics (EIGRP). None of these protocols know whether an ISP link is experiencing micro-burst congestion, excessive jitter, or 5% packet loss.\n\n**Application-Aware Routing (AAR)** transforms path selection by dynamically matching application traffic against **real-time network performance SLAs** measured by BFD probes.\n\n### The Three Core Components of AAR\n\n1. **Application Identification:** Uses **Cisco NBAR2 (Network Based Application Recognition)** to inspect packet payloads up to Layer 7 (e.g., differentiating Microsoft Teams Voice from YouTube or bulk file downloads).\n2. **SLA Profiles:** Defines acceptable performance boundaries for an application class:\n   ```cisco\n   policy\n    sla-class VOIP_SLA\n     latency 100\n     jitter 15\n     loss 1\n    !\n   ```\n3. **AAR Policy Mapping:** Binds the application to a preferred transport list and SLA profile:\n   ```cisco\n   policy\n    app-route-policy ENTERPRISE_AAR\n     vpn-list CORPORATE_VPNS\n      sequence 10\n       match\n        app-list VOICE_APPS\n       action\n        sla-class VOIP_SLA preferred-color mpls\n        backup-sla-preferred-color biz-internet\n   ```\n\n### SLA Violation vs. Complete Tunnel Failure\nIt is critical to distinguish an SLA brownout from a link blackout:\n- **SLA Violation (Brownout):** BFD sessions are **`up`** and passing traffic, but the rolling average telemetry exceeds configured thresholds (e.g., latency jumps from 40ms to 135ms, exceeding the 100ms threshold). AAR dynamically shifts new and existing flows to the secondary transport (`biz-internet`) without tearing down tunnels or dropping TCP sessions!\n- **Tunnel Failure (Blackout):** BFD probes stop receiving replies. The tunnel transitions to **`down`**. The router immediately flushes the tunnel from the forwarding table regardless of SLA policies.\n\n### Fallback Action Modes\nWhen no available transport link satisfies the SLA profile:\n- **`preferred-color` / `backup-sla-preferred-color`:** The router selects the transport that comes closest to meeting the SLA (best-effort forwarding).\n- **`strict`:** The router drops matching application traffic rather than delivering voice or video across an impaired, degraded circuit.',
      callout: {
        type: 'warning',
        title: 'BFD Multiplier & Smoothing Window',
        text: 'AAR calculates performance using an exponential decaying average over a default multiplier window (default 6 intervals of 10 seconds = 60-second sliding window). This dampens temporary jitter spikes and prevents route flaps (flapping traffic back and forth between circuits).',
      },
    },
    {
      id: 'sec-troubleshooting-methodology',
      title: '6. The 7-Stage SD-WAN Troubleshooting Methodology',
      contentMarkdown:
        'When application connectivity fails across an SD-WAN fabric, troubleshooting haphazardly across multiple dashboards causes wasted time and misdiagnosis. Senior network engineers execute a structured **7-stage diagnostic sequence**:\n\n```text\nStage 1: Define Traffic Scope (Src IP, Dst IP, Service VPN ID, Port)\n   |\n   v\nStage 2: Verify Underlay Transport in VPN 0 (Physical Link, IP, Ping Gateway, DNS)\n   |\n   v\nStage 3: Verify Control Plane Connections (show control connections -> up)\n   |\n   v\nStage 4: Verify OMP Route Availability (show omp routes vpn <vpn> -> C,I status)\n   |\n   v\nStage 5: Verify TLOC Health & BFD Sessions (show bfd sessions -> up, loss/latency)\n   |\n   v\nStage 6: Inspect Centralized & Localized Policies (vSmart control / AAR data policies)\n   |\n   v\nStage 7: Validate Forwarding Plane (show ip route vrf <vpn>, show app-route stats)\n```\n\n### Diagnostic Command Reference & Proof Boundaries\n\n| Stage | Key Verification Command | What This Proves | What This DOES NOT Prove |\n| :--- | :--- | :--- | :--- |\n| **1. Scope** | Customer incident details | Identifies the exact Service VPN and endpoints under test. | Does not verify whether routes or links exist. |\n| **2. Underlay** | `ping <gateway>` in VPN 0 | Proves local physical circuit and IP connectivity to the ISP. | Does not prove controllers or remote sites are reachable. |\n| **3. Control** | `show control connections` | Proves secure DTLS/TLS sessions are established to vSmart/vManage. | Does not prove data plane IPsec tunnels or BFD are working. |\n| **4. OMP** | `show omp routes vpn <vpn>` | Proves vSmart received and shared the prefix in the control plane. | Does not prove the route can be used for forwarding (TLOC might be down). |\n| **5. BFD** | `show bfd sessions` | Proves peer-to-peer IPsec data plane tunnels are alive and measuring metrics. | Does not prove application policies or ACLs allow traffic. |\n| **6. Policy** | `show policy from-vsmart` | Confirms whether topology or AAR policies are attached and active. | Does not prove whether individual packets match rules. |\n| **7. Forwarding** | `show ip route vrf <vpn>` | Confirms prefix is installed in the hardware Forwarding Information Base (FIB). | Does not rule out end-host OS firewall or server service drops. |',
      callout: {
        type: 'pro_tip',
        title: 'Status Code Interpretation: "C,I"',
        text: 'In "show omp routes", look at the status column: "C" means Chosen by the OMP best path algorithm. "I" means Installed into the router\'s local Forwarding Information Base (FIB). If a route has "C" but lacks "I", its TLOC is unreachable or BFD is down!',
      },
    },
    {
      id: 'sec-worked-case-study',
      title: '7. End-to-End Worked Case Study: The Silent Voice Outage',
      contentMarkdown:
        'Let us analyze a real-world enterprise incident step-by-step using simulated CLI evidence:\n\n### The Incident Report\nBranch-101 users report that critical VoIP phone calls to the Headquarters Call Center (`10.200.50.25` in **Service VPN 10**) are completely dropping or failing to connect. Branch-101 has dual uplinks: `mpls` (Interface GigabitEthernet0/0/1) and `biz-internet` (Interface GigabitEthernet0/0/2).\n\n### Step 1: Verify Control Connections on Branch-101 cEdge\n```text\nBranch-101# show control connections\nPEER    PEER    PEER            SITE        PEER            PRIV  PRIV  PUB   PUB\nTYPE    PROT    SYSTEM IP       ID   STATE  PRIVATE IP      PORT  PORT  PORT  PORT\n------------------------------------------------------------------------------------\nvsmart  dtls    10.255.0.254    1    up     198.51.100.254  12346 12346 12346 12346\nvmanage dtls    10.255.0.253    1    up     198.51.100.253  12346 12346 12346 12346\n```\n→ **Finding:** Control connections to both vSmart and vManage are **`up`**. The control plane is fully operational.\n\n### Step 2: Inspect OMP Route Availability for Call Center Subnet\n```text\nBranch-101# show omp routes vpn 10 10.200.50.0/24\n---------------------------------------------------vpn 10-10.200.50.0/24-\nFROM PEER       TLOC                PATH-ID  LABEL  STATUS\n------------------------------------------------------------------------\n10.255.0.254    10.255.0.200, mpls, ipsec        0   1002   C\n10.255.0.254    10.255.0.200, biz-internet, ipsec 0   1002   C,I\n```\n→ **Finding:** Crucial observation! The route has two TLOCs. Look at the `STATUS` column:\n- TLOC `(10.255.0.200, biz-internet)` is marked **`C,I`** (Chosen and Installed).\n- TLOC `(10.255.0.200, mpls)` is marked **`C`** (Chosen by OMP, but **NOT Installed** in FIB).\n\n### Step 3: Inspect BFD Telemetry & Tunnel Status\n```text\nBranch-101# show bfd sessions\nSYSTEM IP     SITE ID  LOCAL COLOR   COLOR         STATE  UPTIME      RX PKTS  TX PKTS\n----------------------------------------------------------------------------------------\n10.255.0.200  200      biz-internet  biz-internet  up     4d:12:30:14 125400   125402\n10.255.0.200  200      mpls          mpls          down   0:00:00:00  0        4210\n```\n→ **Finding:** The BFD session on the `mpls` transport tunnel to Headquarters is **`down`**! However, the `biz-internet` tunnel is healthy and **`up`**. \n\n*Question:* Since `biz-internet` is `up` and installed (`C,I`), why are VoIP calls still failing?\n\n### Step 4: Inspect Application-Aware Routing Policy\n```text\nBranch-101# show policy data-policy-filter\nPolicy Name: CENTRALIZED_DATA_POL\n Sequence: 10 (VOIP_TRAFFIC)\n  Match:\n   dscp 46 (EF - Voice)\n  Action:\n   sla-class VOIP_SLA preferred-color mpls strict\n```\n→ **Root Cause Discovered:** Look at the keyword **`strict`**! \nBecause the policy specifies `preferred-color mpls strict`, the router is configured to **strictly drop voice packets** if the MPLS transport does not meet the SLA, rather than falling back to the healthy `biz-internet` tunnel!\n\n### Step 5: Remediation\n1. Temporarily modify the centralized AAR policy in vManage to use `backup-sla-preferred-color biz-internet` instead of `strict`, immediately restoring voice connectivity over the healthy Internet circuit.\n2. Dispatch provider engineers to resolve the underlay fiber cut on the MPLS physical circuit.',
    },
    {
      id: 'sec-summary-common-misconceptions',
      title: '8. Summary, Diagnostic Checklist & Common Traps',
      contentMarkdown:
        'Let us review the essential rules and common traps encountered when managing SD-WAN fabrics:\n\n### The Senior Engineer\'s Diagnostic Checklist\n1. **Always Verify VPN:** Ensure you are testing within the correct Service VPN (`show ip route vrf <vpn>`, `ping vrf <vpn> <ip>`).\n2. **Verify Control Before OMP:** If `show control connections` has 0 active sessions, check underlay IP, DNS, and system clock (NTP).\n3. **Inspect OMP Status Code "C,I":** If a route has "C" but lacks "I", its TLOC is unreachable or BFD is down.\n4. **Check BFD Tunnel Liveliness:** Run `show bfd sessions` to confirm data plane tunnels are `up` before troubleshooting application latency.\n5. **Check AAR Action Keywords:** Beware of `strict` in AAR policies, which forces traffic drops during transport brownouts instead of falling back to alternate operational transports.\n\n### Common SD-WAN Misconceptions\n- **Misconception 1: "OMP routes install into the global routing table."**\n  *Reality:* OMP routes install into specific Service VRFs (VPNs). They are never visible in the global routing table unless explicitly leaked.\n- **Misconception 2: "BFD only tests if a cable is plugged in."**\n  *Reality:* BFD tests the entire encrypted overlay tunnel path end-to-end through service providers, calculating loss, jitter, and latency continuously.\n- **Misconception 3: "Centralized control policies execute on edge routers."**\n  *Reality:* Centralized Control Policies execute **only on vSmart** to manipulate OMP routing updates. Centralized Data Policies execute on WAN Edges to manipulate packet forwarding.',
    },
  ],
  predictExercise: {
    id: 'ex-sdwan-rt-omp-vroute-mc',
    lessonId: 'lesson-sd-wan-routing-policy',
    type: 'multiple_choice',
    title: 'OMP Architecture: Next-Hop Resolution Mechanics',
    prompt:
      'In Cisco SD-WAN, when an edge router advertises an internal LAN prefix to the vSmart controller using the Overlay Management Protocol (OMP), what specific attribute carried inside the OMP route advertisement serves as the next-hop pointer directing peer routers to the egress transport interface?',
    learningObjective:
      'Explain how OMP routes resolve next-hops through TLOC (Transport Location) attributes.',
    scenarioContext:
      'An engineer is analyzing OMP update attributes in "show omp routes" to understand how prefixes tie to underlay circuits.',
    options: [
      {
        id: 'opt-tloc-tuple',
        label:
          'The TLOC (Transport Location) tuple, consisting of System IP, Color, and Encapsulation.',
        isCorrect: true,
        explanation:
          'In Cisco SD-WAN, OMP vRoutes do not use traditional IP next-hop addresses. Instead, each OMP route points to a TLOC (Transport Location) tuple defined by (System IP, Color, Encapsulation). Receiving routers resolve this TLOC against their underlay routing table to establish IPsec data tunnels.',
      },
      {
        id: 'opt-bgp-as-path',
        label:
          'The AS_PATH attribute prepended by the local edge router.',
        isCorrect: false,
        explanation:
          'OMP is not BGP; while it shares design concepts with BGP, next-hops in SD-WAN are represented by TLOCs, not AS_PATH attributes.',
      },
      {
        id: 'opt-vbond-ip',
        label:
          'The public IP address of the vBond Orchestrator.',
        isCorrect: false,
        explanation:
          'vBond is strictly an orchestration and authentication server and is never a next-hop for customer data traffic.',
      },
      {
        id: 'opt-mpls-label-only',
        label:
          'A static MPLS top label without IP header encapsulation.',
        isCorrect: false,
        explanation:
          'SD-WAN overlay tunnels use IPsec (or GRE) encapsulation; TLOCs define the endpoint, not bare MPLS labels.',
      },
    ],
    hints: [
      'Think about what 3-tuple represents an attachment point to an underlay transport network.',
      'This attribute combines a System IP, a transport Color tag, and an Encapsulation type.',
    ],
    explanation:
      'Every OMP route is bound to one or more TLOCs. The TLOC 3-tuple (System IP, Color, Encapsulation) specifies exactly which router, transport circuit, and tunnel protocol must be used to deliver traffic to that destination subnet.',
    commonMistakes: [
      {
        mistake: 'Assuming standard IP addresses act as next-hops',
        explanation:
          'Traditional routing uses IP next-hops, but SD-WAN decouples routing from transport using TLOC abstractions.',
      },
    ],
    practicalTakeaway:
      'If an OMP route lacks an active, reachable TLOC, the router cannot forward traffic to that prefix regardless of whether the route appears in the OMP table.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-sdwan-rt-tloc-bfd-tb',
    lessonId: 'lesson-sd-wan-routing-policy',
    type: 'troubleshooting',
    title: 'Data Plane Failure: OMP Route Present but BFD Tunnel Down',
    prompt:
      'On Branch-1 cEdge, an administrator inspects a remote branch subnet in VPN 10:\n\nBranch-1# show omp routes vpn 10 10.5.0.0/24\nFROM PEER: 10.255.0.254 (vSmart)\nTLOC: 10.255.0.5, mpls, ipsec\nSTATUS: C (Chosen)\n\nHowever, users report 100% packet loss to 10.5.0.0/24. Running "show bfd sessions" reveals:\n\nSYSTEM IP: 10.255.0.5\nLOCAL COLOR: mpls\nREMOTE COLOR: mpls\nSTATE: down\nLOSS: 100%\n\nWhy are packets destined for 10.5.0.0/24 failing to forward, and what does this evidence prove?',
    learningObjective:
      'Distinguish control-plane OMP route availability from data-plane BFD forwarding readiness.',
    scenarioContext:
      'A network administrator is troubleshooting an outage where the control plane is operational but application traffic fails.',
    options: [
      {
        id: 'opt-bfd-down-drops-traffic',
        label:
          'The route is chosen in OMP ("C"), but because the BFD session on the MPLS tunnel is down, the router cannot install the path into the forwarding table (FIB) and drops matching traffic.',
        isCorrect: true,
        explanation:
          'A healthy BFD session is a mandatory prerequisite for data plane forwarding in Cisco SD-WAN. Even though vSmart advertised the route and OMP marked it as Chosen ("C"), the route cannot be marked Installed ("I") in the FIB because the BFD session to the underlying TLOC is down. Without a valid BFD session or an alternate transport, all packets to 10.5.0.0/24 are dropped.',
      },
      {
        id: 'opt-vsmart-policy-rejected',
        label:
          'The vSmart controller rejected the route because the router is missing a localized control policy.',
        isCorrect: false,
        explanation:
          'The output explicitly proves that vSmart accepted and advertised the route (STATUS: C from peer 10.255.0.254). The failure is in the physical underlay data plane, not vSmart.',
      },
      {
        id: 'opt-vpn-mismatch',
        label:
          'The remote router is advertising the prefix in VPN 0 instead of VPN 10.',
        isCorrect: false,
        explanation:
          'The command "show omp routes vpn 10" specifically returned the route inside VPN 10, proving VPN tagging is correct.',
      },
      {
        id: 'opt-wrong-encap',
        label:
          'The remote edge router requires GRE encapsulation instead of IPsec.',
        isCorrect: false,
        explanation:
          'The TLOC explicitly specifies "ipsec", which is the standard default encapsulation across Cisco SD-WAN.',
      },
    ],
    hints: [
      'Look closely at the OMP status: notice it has "C" (Chosen) but is missing "I" (Installed).',
      'What must be in the "up" state in the data plane before a router will install a tunnel into hardware forwarding?',
    ],
    explanation:
      'In Cisco SD-WAN, the control plane (OMP) and data plane (BFD/IPsec) are decoupled. OMP advertises what paths are theoretically available. BFD verifies whether the physical path is actually passing traffic right now. If BFD is down, the router refuses to install the route into the forwarding table (FIB), resulting in packet drops.',
    commonMistakes: [
      {
        mistake: 'Assuming route presence in OMP means packets can flow',
        explanation:
          'OMP is purely control-plane signaling. Data packets require an active BFD session on the IPsec tunnel.',
      },
    ],
    practicalTakeaway:
      'Always look for "C,I" in "show omp routes". If "I" is missing, check "show bfd sessions" immediately.',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-sdwan-rt-omp-vroute-mc',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'multiple_choice',
      title: 'OMP Architecture: Next-Hop Resolution Mechanics',
      prompt:
        'In Cisco SD-WAN, when an edge router advertises an internal LAN prefix to the vSmart controller using the Overlay Management Protocol (OMP), what specific attribute carried inside the OMP route advertisement serves as the next-hop pointer directing peer routers to the egress transport interface?',
      learningObjective:
        'Explain how OMP routes resolve next-hops through TLOC (Transport Location) attributes.',
      scenarioContext:
        'An engineer is analyzing OMP update attributes in "show omp routes" to understand how prefixes tie to underlay circuits.',
      options: [
        {
          id: 'opt-tloc-tuple',
          label:
            'The TLOC (Transport Location) tuple, consisting of System IP, Color, and Encapsulation.',
          isCorrect: true,
          explanation:
            'In Cisco SD-WAN, OMP vRoutes do not use traditional IP next-hop addresses. Instead, each OMP route points to a TLOC (Transport Location) tuple defined by (System IP, Color, Encapsulation). Receiving routers resolve this TLOC against their underlay routing table to establish IPsec data tunnels.',
        },
        {
          id: 'opt-bgp-as-path',
          label:
            'The AS_PATH attribute prepended by the local edge router.',
          isCorrect: false,
          explanation:
            'OMP is not BGP; while it shares design concepts with BGP, next-hops in SD-WAN are represented by TLOCs, not AS_PATH attributes.',
        },
        {
          id: 'opt-vbond-ip',
          label:
            'The public IP address of the vBond Orchestrator.',
          isCorrect: false,
          explanation:
            'vBond is strictly an orchestration and authentication server and is never a next-hop for customer data traffic.',
        },
        {
          id: 'opt-mpls-label-only',
          label:
            'A static MPLS top label without IP header encapsulation.',
          isCorrect: false,
          explanation:
            'SD-WAN overlay tunnels use IPsec (or GRE) encapsulation; TLOCs define the endpoint, not bare MPLS labels.',
        },
      ],
      hints: [
        'Think about what 3-tuple represents an attachment point to an underlay transport network.',
        'This attribute combines a System IP, a transport Color tag, and an Encapsulation type.',
      ],
      explanation:
        'Every OMP route is bound to one or more TLOCs. The TLOC 3-tuple (System IP, Color, Encapsulation) specifies exactly which router, transport circuit, and tunnel protocol must be used to deliver traffic to that destination subnet.',
      commonMistakes: [
        {
          mistake: 'Assuming standard IP addresses act as next-hops',
          explanation:
            'Traditional routing uses IP next-hops, but SD-WAN decouples routing from transport using TLOC abstractions.',
        },
      ],
      practicalTakeaway:
        'If an OMP route lacks an active, reachable TLOC, the router cannot forward traffic to that prefix regardless of whether the route appears in the OMP table.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-tloc-bfd-tb',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'troubleshooting',
      title: 'Data Plane Failure: OMP Route Present but BFD Tunnel Down',
      prompt:
        'On Branch-1 cEdge, an administrator inspects a remote branch subnet in VPN 10:\n\nBranch-1# show omp routes vpn 10 10.5.0.0/24\nFROM PEER: 10.255.0.254 (vSmart)\nTLOC: 10.255.0.5, mpls, ipsec\nSTATUS: C (Chosen)\n\nHowever, users report 100% packet loss to 10.5.0.0/24. Running "show bfd sessions" reveals:\n\nSYSTEM IP: 10.255.0.5\nLOCAL COLOR: mpls\nREMOTE COLOR: mpls\nSTATE: down\nLOSS: 100%\n\nWhy are packets destined for 10.5.0.0/24 failing to forward, and what does this evidence prove?',
      learningObjective:
        'Distinguish control-plane OMP route availability from data-plane BFD forwarding readiness.',
      scenarioContext:
        'A network administrator is troubleshooting an outage where the control plane is operational but application traffic fails.',
      options: [
        {
          id: 'opt-bfd-down-drops-traffic',
          label:
            'The route is chosen in OMP ("C"), but because the BFD session on the MPLS tunnel is down, the router cannot install the path into the forwarding table (FIB) and drops matching traffic.',
          isCorrect: true,
          explanation:
            'A healthy BFD session is a mandatory prerequisite for data plane forwarding in Cisco SD-WAN. Even though vSmart advertised the route and OMP marked it as Chosen ("C"), the route cannot be marked Installed ("I") in the FIB because the BFD session to the underlying TLOC is down. Without a valid BFD session or an alternate transport, all packets to 10.5.0.0/24 are dropped.',
        },
        {
          id: 'opt-vsmart-policy-rejected',
          label:
            'The vSmart controller rejected the route because the router is missing a localized control policy.',
          isCorrect: false,
          explanation:
            'The output explicitly proves that vSmart accepted and advertised the route (STATUS: C from peer 10.255.0.254). The failure is in the physical underlay data plane, not vSmart.',
      },
        {
          id: 'opt-vpn-mismatch',
          label:
            'The remote router is advertising the prefix in VPN 0 instead of VPN 10.',
          isCorrect: false,
          explanation:
            'The command "show omp routes vpn 10" specifically returned the route inside VPN 10, proving VPN tagging is correct.',
        },
        {
          id: 'opt-wrong-encap',
          label:
            'The remote edge router requires GRE encapsulation instead of IPsec.',
          isCorrect: false,
          explanation:
            'The TLOC explicitly specifies "ipsec", which is the standard default encapsulation across Cisco SD-WAN.',
        },
      ],
      hints: [
        'Look closely at the OMP status: notice it has "C" (Chosen) but is missing "I" (Installed).',
        'What must be in the "up" state in the data plane before a router will install a tunnel into hardware forwarding?',
      ],
      explanation:
        'In Cisco SD-WAN, the control plane (OMP) and data plane (BFD/IPsec) are decoupled. OMP advertises what paths are theoretically available. BFD verifies whether the physical path is actually passing traffic right now. If BFD is down, the router refuses to install the route into the forwarding table (FIB), resulting in packet drops.',
      commonMistakes: [
        {
          mistake: 'Assuming route presence in OMP means packets can flow',
          explanation:
            'OMP is purely control-plane signaling. Data packets require an active BFD session on the IPsec tunnel.',
        },
      ],
      practicalTakeaway:
        'Always look for "C,I" in "show omp routes". If "I" is missing, check "show bfd sessions" immediately.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-policy-types-mc',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'multiple_choice',
      title: 'Policy Framework: Execution Point for Topology Control',
      prompt:
        'An enterprise architecture team wants to enforce a strict Hub-and-Spoke topology across the SD-WAN fabric by filtering OMP route advertisements so that branch routers receive only data center prefixes and never receive routes belonging to other branches. Which policy type and execution point must be utilized to implement this requirement?',
      learningObjective:
        'Differentiate the operational scopes and execution points of the 4 SD-WAN policy quadrants.',
      scenarioContext:
        'An enterprise is transitioning from a full-mesh overlay to a hub-and-spoke model for centralized security inspection.',
      options: [
        {
          id: 'opt-centralized-control',
          label:
            'A Centralized Control Policy configured in vManage and executed on the Cisco vSmart Controller.',
          isCorrect: true,
          explanation:
            'Centralized Control Policies execute on the vSmart controller to influence the distribution of OMP routes and TLOCs before updates are sent to edge devices. By filtering routes on vSmart, administrators can alter the overlay topology to Hub-and-Spoke, regional mesh, or custom extranets without touching edge configurations.',
        },
        {
          id: 'opt-localized-data',
          label:
            'A Localized Data Policy configured on each branch router using access-lists.',
          isCorrect: false,
          explanation:
            'Localized Data Policies execute on edge routers to enforce interface-level ACLs or QoS; they cannot manipulate global OMP route distribution across the fabric.',
        },
        {
          id: 'opt-centralized-data',
          label:
            'A Centralized Data Policy pushed to WAN Edges to drop packets in hardware.',
          isCorrect: false,
          explanation:
            'While a Centralized Data Policy can drop packets in the data plane, topology restriction at the routing level is properly and efficiently achieved via Centralized Control Policies on vSmart.',
        },
        {
          id: 'opt-localized-control',
          label:
            'A Localized Control Policy configured under BGP on the underlay interfaces in VPN 0.',
          isCorrect: false,
          explanation:
            'Localized Control Policies manipulate traditional routing protocols (BGP/OSPF) between local edge routers and local LAN/WAN devices, not the global OMP overlay.',
        },
      ],
      hints: [
        'Which controller acts as the central routing brain for the entire overlay fabric?',
        'Which policy quadrant operates on OMP routes before they are ever transmitted to edge devices?',
      ],
      explanation:
        'Centralized Control Policies run directly on vSmart controllers. They inspect incoming OMP updates from edge routers and apply policies that determine which routes and TLOCs are reflected to peer sites, making them the standard tool for creating Hub-and-Spoke topologies.',
      commonMistakes: [
        {
          mistake: 'Using edge data policies to block topology routing',
          explanation:
            'Dropping packets at the edge wastes router memory and bandwidth. Centralized control policies prevent the routes from being advertised in the first place.',
        },
      ],
      practicalTakeaway:
        'To change overlay topology or route distribution, use Centralized Control Policies on vSmart. To steer or filter actual payload packets, use Centralized Data Policies on WAN Edges.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-aar-numerical',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'numerical',
      title: 'Application-Aware Routing: SLA Jitter Metric Calculation',
      prompt:
        'An enterprise configures an Application-Aware Routing (AAR) policy for an interactive medical imaging application requiring strict performance thresholds: Maximum Latency = 120 ms, Maximum Jitter = 15 ms, and Maximum Packet Loss = 1%. Currently, Transport Path 1 ("biz-internet") measures Latency = 92 ms, Jitter = 11 ms, and Loss = 0.2%. During an ISP routing event, the jitter on Path 1 increases by 7 ms while latency and loss remain unchanged. What is the newly measured Jitter (in milliseconds) on Path 1?',
      learningObjective:
        'Calculate Application-Aware Routing telemetry metrics and identify when SLA performance thresholds are breached.',
      scenarioContext:
        'An engineer is reviewing real-time BFD probe statistics in "show app-route statistics" during a network incident.',
      numericAnswer: 18,
      numericTolerance: 0,
      hints: [
        'The baseline jitter on Path 1 before the event was 11 ms.',
        'The prompt states that jitter increases by 7 ms.',
        'Perform the addition: 11 + 7.',
      ],
      explanation:
        'The baseline jitter was 11 ms. An increase of 7 ms yields 11 + 7 = 18 ms. Because 18 ms exceeds the configured maximum SLA threshold of 15 ms, Path 1 is marked out-of-SLA, triggering an AAR path failover to a compliant alternative transport.',
      practicalTakeaway:
        'BFD continuously tracks latency, jitter, and loss. Once any single parameter exceeds the configured SLA profile threshold, the transport is declared non-compliant.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-aar-behavior-mc',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'multiple_choice',
      title: 'AAR Dynamic Steering: Multi-Transport SLA Evaluation',
      prompt:
        'Following the jitter increase to 18 ms on Transport Path 1 ("biz-internet") (violating the 15 ms SLA), the WAN Edge router evaluates available paths for medical imaging traffic. The AAR policy is configured with "preferred-color biz-internet" and "backup-sla-preferred-color mpls". Transport Path 2 ("mpls") currently reports Latency = 105 ms, Jitter = 8 ms, and Loss = 0.1%. How does the router handle active and new application sessions?',
      learningObjective:
        'Evaluate multi-transport Application-Aware Routing failover behavior when the primary path violates configured SLA criteria.',
      scenarioContext:
        'An automated traffic shift occurs during production hours without administrative intervention.',
      options: [
        {
          id: 'opt-shift-to-mpls',
          label:
            'The router dynamically steers application traffic to Path 2 ("mpls") because Path 2 satisfies all SLA requirements (105ms <= 120ms, 8ms <= 15ms, 0.1% <= 1%).',
          isCorrect: true,
          explanation:
            'When the preferred color ("biz-internet") violates the SLA class (18ms jitter > 15ms threshold), the AAR engine evaluates secondary transports. Because Path 2 ("mpls") satisfies all three SLA metrics (latency, jitter, loss), the router seamlessly steers application flows to the MPLS tunnel.',
        },
        {
          id: 'opt-drop-traffic-strict',
          label:
            'The router immediately drops all medical imaging traffic because Path 1 is the primary preferred transport.',
          isCorrect: false,
          explanation:
            'The policy specifies "backup-sla-preferred-color mpls", which explicitly directs the router to use MPLS when primary fails SLA. It would only drop traffic if the "strict" keyword were configured and no link met SLA.',
        },
        {
          id: 'opt-load-balance-50-50',
          label:
            'The router splits traffic 50/50 across both links to balance the jitter load.',
          isCorrect: false,
          explanation:
            'AAR does not load balance across out-of-SLA links; it strictly steers traffic to compliant paths to protect application experience.',
        },
        {
          id: 'opt-tear-down-bfd',
          label:
            'The router tears down the BFD session on Path 1 to force a hard interface flap.',
          isCorrect: false,
          explanation:
            'An SLA violation is a soft brownout, not a hard link failure. BFD remains up to continue monitoring Path 1 so traffic can return once jitter recovers.',
        },
      ],
      hints: [
        'Does Transport Path 2 ("mpls") meet all three SLA criteria (120ms latency, 15ms jitter, 1% loss)?',
        'What does the "backup-sla-preferred-color" directive instruct the router to do when the primary link violates SLA?',
      ],
      explanation:
        'Cisco SD-WAN Application-Aware Routing provides non-disruptive brownout protection. When the primary link breaches an SLA parameter, the router checks secondary candidate links. Because Path 2 satisfies the SLA profile, traffic is redirected seamlessly without dropping TCP sessions or tearing down tunnels.',
      commonMistakes: [
        {
          mistake: 'Assuming the router drops traffic during an SLA breach',
          explanation:
            'Unless the "strict" keyword is configured and no link meets SLA, AAR always steers traffic to an alternate compliant transport.',
        },
      ],
      practicalTakeaway:
        'AAR enables active/active WAN utilization by dynamically routing mission-critical traffic over whichever circuit currently meets performance SLAs.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-vpn-isolation-predict',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'predict_output',
      title: 'Service Segmentation: VRF Execution Context Diagnosis',
      prompt:
        'A network engineer logs into Branch-1 cEdge to verify reachability to an application server at Headquarters (IP: 10.200.1.50) situated in Service VPN 10. The engineer issues a standard CLI ping:\n\nBranch-1# ping 10.200.1.50\nSending 5, 100-byte ICMP Echos to 10.200.1.50, timeout is 2 seconds:\n.....\nSuccess rate is 0 percent (0/5)\n\nHowever, the application server is fully operational and reachable by users at the site! What exact Cisco IOS-XE SD-WAN ping command must the engineer execute to test reachability within the correct routing table context?',
      learningObjective:
        'Apply Service VPN VRF execution context when testing reachability using diagnostic CLI commands.',
      scenarioContext:
        'An engineer receives a false-positive alarm from an automated script running pings in the global routing table.',
      textAnswerPattern: '^ping\\s+vrf\\s+10\\s+10\\.200\\.1\\.50$',
      acceptableAnswers: [
        'ping vrf 10 10.200.1.50',
        'ping vrf 10 10.200.1.50',
      ],
      hints: [
        'Standard "ping" executes in the global default routing table (VPN 0).',
        'The server resides inside Service VPN 10.',
        'Use the "vrf <vrf-name>" option in the ping command.',
      ],
      explanation:
        'In Cisco IOS-XE SD-WAN, issuing "ping <ip>" executes in the default global routing table (VPN 0), which contains only underlay and control connections. Because customer prefixes reside strictly in isolated Service VRFs (VPNs), the command must explicitly include the VRF context: "ping vrf 10 10.200.1.50".',
      commonMistakes: [
        {
          mistake: 'Assuming ping automatically searches all VPN tables',
          explanation:
            'VRFs are strictly isolated routing tables; the router will never leak pings from VPN 0 into Service VPN 10 automatically.',
        },
      ],
      practicalTakeaway:
        'Always specify the VRF context ("ping vrf <name>", "show ip route vrf <name>") when verifying customer service reachability.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-troubleshoot-flow-seq',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'sequence',
      title: 'Diagnostic Methodology: Systematic Stage Sequencing',
      prompt:
        'Arrange the six primary stages of the systematic SD-WAN routing and forwarding diagnostic methodology into the correct logical order.',
      learningObjective:
        'Execute a structured multi-tier troubleshooting workflow from scope definition to forwarding verification.',
      scenarioContext:
        'A support engineer receives a ticket stating that remote users cannot access an enterprise database over the SD-WAN overlay.',
      sequenceItems: [
        {
          id: 'step-scope-traffic',
          text: '1. Define scope: Confirm affected source IP, destination IP, Service VPN ID, and application port',
          correctIndex: 0,
        },
        {
          id: 'step-underlay-test',
          text: '2. Verify physical underlay connectivity and DNS resolution in VPN 0 (ping default gateway and vBond)',
          correctIndex: 1,
        },
        {
          id: 'step-ctrl-conn-chk',
          text: '3. Verify control plane connections in "show control connections" (state "up" with vSmart and vManage)',
          correctIndex: 2,
        },
        {
          id: 'step-omp-route-chk',
          text: '4. Verify OMP route availability and best-path status in "show omp routes vpn <vpn>" (check for "C,I")',
          correctIndex: 3,
        },
        {
          id: 'step-bfd-tloc-chk',
          text: '5. Inspect TLOC reachability and BFD session state in "show bfd sessions" (verify tunnel liveliness)',
          correctIndex: 4,
        },
        {
          id: 'step-fib-aar-eval',
          text: '6. Validate FIB installation in "show ip route vrf <vpn>" and inspect AAR telemetry in "show app-route statistics"',
          correctIndex: 5,
        },
      ],
      hints: [
        'Always begin by confirming the traffic scope and Service VPN before logging into devices.',
        'Verify physical underlay and control connections before investigating specific OMP routes.',
        'Verify BFD data plane tunnels before checking application SLA statistics.',
      ],
      explanation:
        'Systematic troubleshooting follows an evidence-based progression: (1) Confirm scope and VPN, (2) Validate underlay connectivity in VPN 0, (3) Confirm DTLS/TLS control connections, (4) Check OMP route availability, (5) Inspect BFD data plane tunnels, and (6) Verify hardware FIB installation and AAR SLA compliance.',
      practicalTakeaway:
        'Do not troubleshoot AAR policies if BFD is down, and do not troubleshoot BFD if control connections are down. Follow the layers sequentially.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-case-study-diagnose',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'troubleshooting',
      title: 'Multi-Tier Case Study: Diagnosing Missing Route in VPN 20',
      prompt:
        'Branch-1 users report total inability to reach a shared portal at Headquarters (10.100.1.10 in Service VPN 20). Diagnostic evidence reveals:\n\n1. Branch-1 "show control connections" → State is "up" with vSmart and vManage.\n2. Branch-1 "show bfd sessions" → BFD sessions to Headquarters are "up" on all transports.\n3. Branch-1 "show omp routes vpn 20" → Returns empty (0 routes received).\n4. Headquarters cEdge "show omp routes vpn 20" → 10.100.1.0/24 is present and advertised to vSmart.\n5. vSmart "show policy from-vsmart" reveals an active Centralized Control Policy containing:\n\nsequence 10\n match route vpn 20 site-list BRANCH_SPOKES\n action reject\n\nWhat is the definitive root cause of this connectivity failure?',
      learningObjective:
        'Synthesize evidence across control connections, BFD sessions, OMP tables, and centralized control policies to identify route filtering.',
      scenarioContext:
        'An enterprise security policy was updated recently to isolate corporate zones, resulting in unexpected portal reachability failures.',
      options: [
        {
          id: 'opt-vsmart-policy-filtering',
          label:
            'A Centralized Control Policy executing on the vSmart controller has an "action reject" matching VPN 20 routes for the BRANCH_SPOKES site-list, actively blocking the route from being advertised to Branch-1.',
          isCorrect: true,
          explanation:
            'All evidence points directly to centralized route filtering: control connections are up, BFD data plane tunnels are up, and Headquarters successfully originated the route to vSmart. However, the Centralized Control Policy on vSmart explicitly matches VPN 20 routes destined for the BRANCH_SPOKES site-list and executes "action reject", causing vSmart to drop the advertisement before it reaches Branch-1.',
        },
        {
          id: 'opt-bfd-underlay-down',
          label:
            'The BFD session between Branch-1 and Headquarters is down due to an underlay firewall blocking UDP port 12346.',
          isCorrect: false,
          explanation:
            'Clue 2 explicitly confirms that "show bfd sessions" is "up" on all transports between Branch-1 and Headquarters.',
        },
        {
          id: 'opt-ntp-clock-skew-error',
          label:
            'Branch-1 has clock skew causing x.509 certificate validation to fail on vSmart.',
          isCorrect: false,
          explanation:
            'Clue 1 proves control connections are healthy and "up". If certificate validation failed, control connections would be down.',
        },
        {
          id: 'opt-aar-strict-drop',
          label:
            'An Application-Aware Routing policy configured with "strict" is dropping packets because the MPLS link exceeded latency thresholds.',
          isCorrect: false,
          explanation:
            'AAR policies operate on packets during forwarding. Clue 3 proves that the route does not even exist in Branch-1\'s OMP table, which is a routing control-plane issue, not an AAR threshold issue.',
        },
      ],
      hints: [
        'Notice that Headquarters successfully sent the route to vSmart, but Branch-1 never received it.',
        'Inspect Clue 5: what does "action reject" on vSmart do to matching routes?',
      ],
      explanation:
        'Centralized Control Policies execute on vSmart. When an "action reject" policy rule matches a prefix and destination site-list, vSmart filters the route out of its outgoing OMP advertisements. As a result, Branch-1 never receives the prefix in its OMP table.',
      commonMistakes: [
        {
          mistake: 'Blaming BFD or underlay circuits',
          explanation:
            'When a prefix is completely absent from "show omp routes" while the remote peer advertises it, the cause is routing policy filtering on vSmart, not data-plane BFD failure.',
        },
      ],
      practicalTakeaway:
        'If a route exists on the originating router but is missing on peer routers despite healthy control connections, check Centralized Control Policies on vSmart.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-rt-omp-holddown-mc',
      lessonId: 'lesson-sd-wan-routing-policy',
      type: 'multiple_choice',
      title: 'High Availability: OMP Graceful Restart Hold-Down Timer',
      prompt:
        'A catastrophic fiber cut isolates an enterprise WAN Edge router from all vSmart controllers (all DTLS control connections terminate). However, the physical underlay circuits between this WAN Edge and regional branches remain operational. By default, how long will the WAN Edge maintain its cached OMP routes and continue forwarding data plane traffic over active IPsec tunnels before flushing routes (OMP Graceful Restart timer)?',
      learningObjective:
        'Explain the OMP Graceful Restart / Hold-Down timer and its role in network resilience.',
      scenarioContext:
        'A network resiliency review requires documenting failover timers during catastrophic controller isolation.',
      options: [
        {
          id: 'opt-12-hours',
          label:
            '12 hours (43,200 seconds)',
          isCorrect: true,
          explanation:
            'By default, Cisco SD-WAN implements an OMP Graceful Restart timer of 12 hours (43,200 seconds). If all vSmart controllers become unreachable, edge routers preserve their existing OMP routing table and cached IPsec security keys, continuing to forward data plane traffic across operational BFD tunnels for up to 12 hours.',
        },
        {
          id: 'opt-60-seconds',
          label:
            '60 seconds',
          isCorrect: false,
          explanation:
            '60 seconds is typical for BGP hold time or BFD timers, but the OMP Graceful Restart timer is designed to span prolonged controller outages.',
        },
        {
          id: 'opt-3-minutes',
          label:
            '3 minutes (180 seconds)',
          isCorrect: false,
          explanation:
            '180 seconds is the standard BGP hold-down default, not the SD-WAN OMP Graceful Restart timer.',
        },
        {
          id: 'opt-immediate-flush',
          label:
            'Routes are immediately flushed (0 seconds) to prevent routing black holes.',
          isCorrect: false,
          explanation:
            'Flushing routes immediately would completely defeat the resilience provided by control and data plane separation.',
        },
      ],
      hints: [
        'Think in terms of hours rather than seconds.',
        'Cisco SD-WAN is designed so that a controller outage during the night does not interrupt corporate operations before business hours resume.',
      ],
      explanation:
        'Cisco SD-WAN decouples control from forwarding. The default OMP Graceful Restart timer is 12 hours (43,200 seconds). During this window, WAN Edges continue forwarding payload traffic across healthy BFD data tunnels without interruption while controllers recover.',
      commonMistakes: [
        {
          mistake: 'Confusing BFD timeout with OMP Graceful Restart',
          explanation:
            'BFD detects tunnel loss in seconds, but OMP Graceful Restart preserves route tables during controller outages for hours.',
        },
      ],
      practicalTakeaway:
        'A temporary vSmart outage does not cause an immediate network outage thanks to the 12-hour OMP Graceful Restart timer.',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'Cisco SD-WAN Routing Configuration Guide',
      url: 'https://www.cisco.com/c/en/us/td/docs/routers/sdwan/configuration/routing/ios-xe-17/routing-book-xe.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Overlay Management Protocol (OMP) & Path Selection',
    },
    {
      title: 'Cisco SD-WAN Policies Configuration Guide',
      url: 'https://www.cisco.com/c/en/us/td/docs/routers/sdwan/configuration/policies/ios-xe-17/policies-book-xe.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Centralized and Localized Policy Architecture & Application-Aware Routing',
    },
    {
      title: 'Cisco Support: Troubleshooting SD-WAN OMP and BFD Failures',
      url: 'https://www.cisco.com/c/en/us/support/docs/routers/sd-wan/214508-cisco-sd-wan-overlay-network-bring-up.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Data Plane BFD Diagnostics & Policy Verification',
    },
  ],
};
