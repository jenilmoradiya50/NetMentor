import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonMplsL3Vpn: DetailedLesson = {
  id: 'lesson-mpls-l3vpn',
  topicId: 'topic-mpls-vpn',
  pathId: 'path-ccnp',
  slug: 'mpls-l3vpn-vrf-route-leaking',
  title: 'MPLS L3VPN and VRF Route Leaking: RD, RT, MP-BGP and Inter-VRF Connectivity',
  subtitle:
    'Architectural Isolation, VRFs, Route Distinguishers, Route Targets, MP-BGP VPNv4 Exchange, and Controlled Route Leaking.',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Explain the purpose of MPLS Layer 3 VPNs in providing secure multi-tenant isolation over shared provider IP/MPLS infrastructure.',
    'Distinguish the provider core (P routers) from customer-facing edge routing contexts (PE and CE routers), explaining why core routers remain BGP-free.',
    'Differentiate Virtual Routing and Forwarding (VRF) instances, Route Distinguishers (RDs), and Route Targets (RTs), detailing their independent functions.',
    'Describe how customer IPv4 prefixes travel between PE routers as 96-bit VPNv4 routes using Multiprotocol BGP (MP-BGP address-family vpnv4).',
    'Explain the functional division of labor among Customer Edge (CE), Provider Edge (PE), and Provider Core (P) routers.',
    'Analyze Route Target (RT) export and import mechanics using BGP extended communities to construct arbitrary VPN topologies.',
    'Explain the two-tier MPLS label stack (top IGP/LDP transport label vs. bottom VPN/service label), label swapping, and Penultimate Hop Popping (PHP).',
    'Execute systematic troubleshooting procedures to diagnose VRF route import failures, RD/RT misconfigurations, and LSP forwarding drops.',
    'Design and evaluate controlled inter-VRF route leaking for shared enterprise services (e.g. DNS, Active Directory) while mitigating asymmetric routing and loop risks.',
  ],
  sections: [
    {
      id: 'sec-mpls-why-l3vpn-exists',
      title: '1. Why MPLS Layer 3 VPNs Exist: The Multi-Tenant Core Dilemma',
      contentMarkdown: `### The Enterprise Connectivity Problem

Service providers and large enterprise backbones face a fundamental architectural challenge: **How can a single shared physical network securely interconnect hundreds of distinct customer sites while guaranteeing complete routing isolation, privacy, and support for overlapping private IP addresses?**

In traditional routed networks, every router maintains a single **Global Routing Table**. If Customer Red and Customer Blue both utilize the standard private subnet \`10.10.10.0/24\` (RFC 1918), a single shared router cannot determine which customer destination traffic belongs to. Historically, service providers solved this by deploying dedicated physical circuits, Frame Relay PVCs, or ATM virtual circuits. However, these Layer 2 solutions lacked Layer 3 scalability and were expensive to provision and manage.

**MPLS Layer 3 VPN (RFC 4364)** solves this dilemma by virtualizing the router's routing and forwarding engines and utilizing **Multiprotocol Label Switching (MPLS)** in the provider core.

---

### The Three Fundamental Network Roles

An MPLS L3VPN architecture divides network devices into three distinct operational tiers:

\`\`\`text
+-------------+      +-------------------+      +-------------+      +-------------------+      +-------------+
| Customer CE | <--> |   Provider PE-1   | <--> |   P-Core    | <--> |   Provider PE-2   | <--> | Customer CE |
| Customer_A  |      |  (Dual Context)   |      | (BGP-Free)  |      |  (Dual Context)   |      | Customer_A  |
+-------------+      +-------------------+      +-------------+      +-------------------+      +-------------+
\`\`\`

1. **Customer Edge (CE) Router:**
   - Resides on customer premises or demarcation point.
   - Operates as a standard IPv4 router with **zero awareness** of MPLS, VRFs, or other customers.
   - Peers directly with its local PE router using standard protocols (eBGP, OSPF, EIGRP, or static routing).
   - Only sees its own enterprise routes.

2. **Provider Edge (PE) Router:**
   - The architectural linchpin connecting customers to the provider backbone.
   - Maintains a **dual personality**: customer-facing interfaces are assigned to isolated **Virtual Routing and Forwarding (VRF)** instances, while core-facing interfaces run in the global provider routing table.
   - Runs an Interior Gateway Protocol (IGP such as OSPF or IS-IS) and **LDP (Label Distribution Protocol)** towards the provider core.
   - Converts customer IPv4 routes into **VPNv4 routes** and exchanges them with remote PE routers via **Multiprotocol BGP (MP-BGP)**.
   - Pushes two MPLS labels on ingress and disposes of labels on egress.

3. **Provider (P) Core Router:**
   - High-speed transit router in the backbone core.
   - Connects PE routers to other P routers.
   - **BGP-Free Core Invariant:** P routers **never run BGP** and have zero knowledge of customer routes, VRFs, or customer IP addresses!
   - Runs only core IGP and LDP. P routers switch packets purely based on the **outer MPLS transport label**, achieving unprecedented core scalability.`,
      callout: {
        type: 'rfc',
        title: 'IETF RFC 4364: BGP/MPLS IP Virtual Private Networks (VPNs)',
        text: 'RFC 4364 defines the standard architecture for peer-to-peer MPLS VPNs, replacing overlay tunneling (such as GRE or IPSec meshes) with BGP control-plane extensions and two-tier MPLS label forwarding.',
      },
    },
    {
      id: 'sec-mpls-vrfs-routing-isolation',
      title: '2. VRFs and Routing Isolation: Virtualizing the Routing Table',
      contentMarkdown: `### What is a Virtual Routing and Forwarding (VRF) Instance?

A **VRF (Virtual Routing and Forwarding)** instance virtualizes a router at Layer 3, exactly as a **VLAN** virtualizes a switch at Layer 2. Within a single physical PE router, each VRF operates with its own:
- Independent IP routing table (RIB).
- Independent Forwarding Information Base (FIB) programmed into hardware.
- Dedicated set of customer-facing physical or logical (sub-)interfaces.

Because routing tables are completely isolated in memory, Customer Red and Customer Blue can both run \`10.10.10.0/24\` simultaneously on the same PE router without any collision or route leakage.

---

### VRF vs. VLAN: Clarifying the Abstraction

| Architectural Characteristic | VLAN (Virtual LAN) | VRF (Virtual Routing & Forwarding) |
| :--- | :--- | :--- |
| **OSI Layer** | Layer 2 (Data Link) | Layer 3 (Network) |
| **Primary Isolation Unit** | MAC address table & Broadcast domain | IP Routing Table (RIB) & Forwarding Base (FIB) |
| **Forwarding Decision** | Ethernet Frame Destination MAC | IP Packet Destination IP Address |
| **Standard Scope** | Switch / 802.1Q trunk | Router / L3 Switch |
| **Default Communication** | Frames cannot cross VLANs without a router | Packets cannot cross VRFs without route leaking |

---

### Cisco IOS-XE VRF Configuration: Legacy vs. Modern Syntax

Cisco routers support two VRF configuration models. Modern network engineering standardizes on **Multi-AF VRF syntax** (\`vrf definition\`):

\`\`\`cisco
! ====================================================================
! Modern Cisco IOS-XE Multi-Protocol VRF Syntax (Recommended)
! ====================================================================
vrf definition Customer_Red
 rd 65000:101
 !
 address-family ipv4
  route-target export 65000:101
  route-target import 65000:101
 exit-address-family

interface GigabitEthernet0/0/1
 description Trunk to Customer Red CE-1
 vrf forwarding Customer_Red
 ip address 192.168.1.1 255.255.255.252
\`\`\`

When inspecting the routing table, network engineers must explicitly specify the VRF context:
\`\`\`cisco
PE-1# show ip route vrf Customer_Red
Routing Table: Customer_Red
Gateway of last resort is not set

      10.0.0.0/24 is subnetted, 1 subnets
B        10.10.10.0 [200/0] via 10.255.0.2 (Customer_Red), 01:14:22
C     192.168.1.0/30 is directly connected, GigabitEthernet0/0/1
\`\`\``,
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco Quirk: Applying VRF Forwarding Deletes Configured IP Addresses',
        text: 'In Cisco IOS and IOS-XE, committing "vrf forwarding <name>" or "ip vrf forwarding <name>" on an interface immediately wipes any previously configured IP address! Cisco does this deliberately as a security safeguard to prevent accidental route leaks. Always configure or re-apply the IP address after binding the VRF.',
      },
    },
    {
      id: 'sec-mpls-route-distinguishers',
      title: '3. Route Distinguishers (RDs): Making Duplicate IPv4 Prefixes Unique',
      contentMarkdown: `### The Overlapping Prefix Dilemma in BGP

While VRFs maintain separation inside the local PE router, what happens when PE-1 advertises Customer Red's \`10.10.10.0/24\` and Customer Blue's \`10.10.10.0/24\` to remote PE-2 using BGP?

Standard BGP only understands standard 32-bit IPv4 prefixes. If PE-1 transmits two updates for \`10.10.10.0/24\`, BGP path selection will assume they are alternative paths to the **same destination** and discard one of them!

To solve this, MPLS L3VPN introduces the **Route Distinguisher (RD)**.

---

### Structure of a VPNv4 Address

An RD is an **8-byte (64-bit)** value prepended to a standard 4-byte (32-bit) IPv4 address. The combination creates a globally unique **12-byte (96-bit) VPNv4 address**:

\`\`\`text
+------------------------------+-------------------------------+
|   Route Distinguisher (RD)   |         IPv4 Prefix           |
|      8 Bytes (64 Bits)       |       4 Bytes (32 Bits)       |
+------------------------------+-------------------------------+
\               96-Bit VPNv4 Address NLRI                     /
\`\`\`

#### Common RD Formats:
1. **Type 0 (\`ASN:nn\`):** 2-byte ASN, 4-byte number (e.g. \`65000:101\`).
2. **Type 1 (\`IP-address:nn\`):** 4-byte IPv4 address, 2-byte number (e.g. \`10.255.0.1:1\`).
3. **Type 2 (\`4-byte-ASN:nn\`):** 4-byte ASN, 2-byte number (e.g. \`65536:101\`).

---

### How RDs Differentiate Customer Prefixes

Consider Customer Red and Customer Blue, both advertising \`10.10.10.0/24\`:

\`\`\`text
Customer Red  (RD 65000:100) + 10.10.10.0/24  -->  VPNv4: 65000:100:10.10.10.0/24
Customer Blue (RD 65000:200) + 10.10.10.0/24  -->  VPNv4: 65000:200:10.10.10.0/24
\`\`\`

Because BGP evaluates the entire 96-bit string as the NLRI key, \`65000:100:10.10.10.0/24\` and \`65000:200:10.10.10.0/24\` are treated as completely unrelated, distinct routes. Both are stored and advertised across the provider core simultaneously without collision.`,
      callout: {
        type: 'warning',
        title: 'Crucial Architecture Rule: The RD Never Dictates Route Import Policy',
        text: 'The Route Distinguisher has exactly ONE job: making IPv4 prefixes unique within BGP memory. The RD does NOT control which VRFs accept or install the route on receiving PE routers! Changing an RD never acts as a substitute for Route Target configuration.',
      },
    },
    {
      id: 'sec-mpls-route-targets',
      title: '4. Route Targets (RTs): The Policy Distribution Mechanism',
      contentMarkdown: `### Route Targets as BGP Extended Communities

If the Route Distinguisher (RD) only makes routes unique, what mechanism determines which VRF routing tables receive and install a given route?

That mechanism is the **Route Target (RT)**.

A Route Target is an **8-byte BGP Extended Community** (RFC 4360) attached to VPNv4 routes during BGP export. It acts as an address tag defining membership in specific VPN routing domains.

---

### The Export and Import Workflow

Every VRF on a PE router defines an **Export Policy** and an **Import Policy**:

\`\`\`text
[PE-1 VRF Cust_Red]                                             [PE-2 VRF Cust_Red]
  IPv4 Route: 10.1.1.0/24                                         Receives VPNv4 update
        |                                                               |
  Export Policy attaches:                                         Import Policy checks:
  RT:65000:100 -----------------> MP-BGP Update ---------------> Matches RT:65000:100?
                                (Carries RT:65000:100)                  |
                                                                  YES: Strip RD, install
                                                                       10.1.1.0/24 in VRF!
\`\`\`

1. **Export Route Target:**
   - When PE-1 redistributes a local VRF route into MP-BGP, it tags the VPNv4 route with the VRF's configured \`route-target export\` communities.
2. **Import Route Target:**
   - When PE-2 receives VPNv4 advertisements from remote PEs, it inspects the attached RT communities.
   - If any attached RT matches an entry in PE-2's local \`route-target import\` list for a given VRF, PE-2 strips the RD, extracts the IPv4 prefix, and installs it into that VRF's routing table.
   - If no RT matches, the route is completely ignored by that VRF.

---

### Constructing Arbitrary Topologies via RTs

Because export and import RTs operate independently, engineers can build non-standard topologies without changing physical cabling:

1. **Full-Mesh Topology (Standard):**
   - Every site exports \`RT:65000:100\` and imports \`RT:65000:100\`.
2. **Hub-and-Spoke Topology (Centralized Security Inspection):**
   - **Hub VRF:** Exports \`RT:65000:1\` (Hub RT); Imports \`RT:65000:2\` (Spoke RT).
   - **Spoke VRFs:** Export \`RT:65000:2\` (Spoke RT); Import \`RT:65000:1\` (Hub RT).
   - Result: Spokes learn routes only to the Hub, preventing direct spoke-to-spoke communication and forcing all inter-branch traffic through the central firewall!`,
      callout: {
        type: 'pro_tip',
        title: 'Pro-Tip: Decoupling RD and RT Values in Real Networks',
        text: 'In basic configurations, engineers often use identical numbers for RD and RT (e.g. rd 65000:100 and route-target 65000:100). While convenient, remember they are fundamentally independent: RD is an address prefix extension, while RT is a BGP path attribute.',
      },
    },
    {
      id: 'sec-mpls-mpbgp-vpnv4-exchange',
      title: '5. MP-BGP VPNv4 Route Exchange: Peering, Next-Hops & VPN Labels',
      contentMarkdown: `### Multiprotocol BGP (MP-BGP) Architecture

Standard BGP-4 was designed solely for IPv4 Unicast routing (AFI=1, SAFI=1). RFC 4760 extended BGP with Multiprotocol capabilities using two new BGP attributes:
- **MP_REACH_NLRI:** Advertises reachable multiprotocol destinations and next-hops.
- **MP_UNREACH_NLRI:** Withdraws multiprotocol destinations.

For MPLS L3VPN, PE routers activate the **VPNv4 Address Family** (\`AFI=1, SAFI=128\`):

\`\`\`cisco
router bgp 65000
 bgp log-neighbor-changes
 no bgp default ipv4-unicast
 neighbor 10.255.0.2 remote-as 65000
 neighbor 10.255.0.2 update-source Loopback0
 !
 address-family vpnv4
  neighbor 10.255.0.2 activate
  neighbor 10.255.0.2 send-community extended
 exit-address-family
 !
 address-family ipv4 vrf Customer_Red
  redistribute connected
  redistribute ospf 100
 exit-address-family
\`\`\`

---

### What MP-BGP Carries in a VPNv4 Advertisement

A single VPNv4 BGP update contains four critical pieces of routing metadata:

\`\`\`text
+--------------------------------------------------------------------------+
| 1. 96-Bit VPNv4 Prefix   : 65000:101:10.10.10.0/24                       |
| 2. BGP Next-Hop          : 10.255.0.1 (Ingress PE-1 Loopback0)           |
| 3. Extended Community    : RT:65000:101                                  |
| 4. Bottom MPLS VPN Label : 24018 (Allocated by PE-1 for this VRF/prefix) |
+--------------------------------------------------------------------------+
\`\`\`

---

### Deep-Dive: Interpreting \`show bgp vpnv4 unicast\` Output

\`\`\`text
PE-2# show bgp vpnv4 unicast all 10.10.10.0/24
BGP routing table entry for 65000:101:10.10.10.0/24, version 18
Paths: (1 available, best #1, table Customer_Red)
  Not advertised to any peer
  Refresh Epoch 1
  Local
    10.255.0.1 (metric 20) (via default) from 10.255.0.1 (10.255.0.1)
      Origin IGP, metric 0, localpref 100, valid, internal, best
      Extended Community: RT:65000:101
      mpls labels: (in/out) 1025/24018
\`\`\`

#### Field Analysis:
- **\`65000:101:10.10.10.0/24\`**: The full 96-bit VPNv4 prefix (RD \`65000:101\` + IPv4 prefix).
- **\`table Customer_Red\`**: Confirms that PE-2 matched the attached RT (\`65000:101\`) and installed the route into the local \`Customer_Red\` VRF table.
- **\`10.255.0.1 (via default)\`**: The BGP Next-Hop. Crucially, this is PE-1's Loopback0 address, reachable through the global IGP in the provider core.
- **\`mpls labels: (in/out) 1025/24018\`**:
  - \`in: 1025\`: The local VPN label PE-2 allocated if it re-advertises this route.
  - \`out: 24018\`: The **VPN Service Label** allocated by PE-1. When PE-2 transmits packets to this subnet, it must encapsulate them with inner label \`24018\`.`,
      callout: {
        type: 'warning',
        title: 'Mandatory Requirement: Extended Communities Must Be Enabled',
        text: 'In Cisco IOS/IOS-XE, under "address-family vpnv4", the command "neighbor <ip> send-community extended" (or "send-community both") is mandatory. If omitted, BGP strips Route Targets before sending updates, and the receiving PE will drop all VPNv4 routes because it cannot match any import RT!',
      },
    },
    {
      id: 'sec-mpls-forwarding-label-stack',
      title: '6. MPLS Forwarding and the Two-Tier Label Stack',
      contentMarkdown: `### The Two-Tier MPLS Label Architecture

How does a packet travel from CE-1 to CE-2 across an intermediate provider core whose routers maintain zero customer routes?

MPLS solves this by encapsulating data packets in a **Two-Tier Label Stack**:

\`\`\`text
+-------------+-------------------------+---------------------+-------------------+
| L2 Header   | Top: Transport Label    | Bottom: VPN Label   | IP Header + Data  |
| (Ethernet)  | (Outer, e.g. LDP 16020) | (Inner, BGP 24018)  | (Customer Packet) |
+-------------+-------------------------+---------------------+-------------------+
\`\`\`

1. **Top Label (Transport / Tunnel Label):**
   - Allocated by **LDP (or RSVP-TE / Segment Routing)**.
   - Purpose: Directs the packet across P-core routers to the egress PE's Loopback IP address.
   - P-core routers inspect, swap, and forward based **strictly on this outer label**.
2. **Bottom Label (VPN / Service Label):**
   - Allocated by **MP-BGP** on the egress PE.
   - Purpose: Informs the egress PE which specific VRF or customer egress sub-interface must receive the packet.
   - P-core routers **never inspect or modify** this inner label.

---

### Step-by-Step Data Plane Packet Walk

\`\`\`text
[CE-1]                  [PE-1]                     [P-Router]                   [PE-2]                  [CE-2]
  |                       |                            |                          |                       |
  |-- 1. Plain IPv4 ----->|                            |                          |                       |
  |   Dst: 10.10.10.50    |-- 2. Pushes 2 Labels ----->|                          |                       |
  |                       |      Top: 16020 (LDP)      |-- 3. Swaps/Pops (PHP) -->|                       |
  |                       |      Btm: 24018 (VPN)      |      Btm: 24018 (VPN)    |-- 4. Strips VPN Label |
  |                       |                            |                          |      Plain IPv4 ----->|
\`\`\`

1. **CE-1 Transmits Native IPv4 Packet:**
   - Source: \`10.20.20.10\`, Destination: \`10.10.10.50\`. Packet arrives at PE-1's VRF interface.
2. **Ingress PE-1 Encapsulation:**
   - PE-1 performs a lookup in VRF \`Customer_Red\` FIB.
   - Finds destination via BGP next-hop \`10.255.0.2\` with VPN label \`24018\`.
   - Resolves next-hop \`10.255.0.2\` in the global routing table; LDP indicates outgoing transport label \`16020\`.
   - PE-1 prepends **Label Stack [Outer: 16020, Inner: 24018]** and forwards out the core interface.
3. **Core Transit & Penultimate Hop Popping (PHP):**
   - Intermediate P routers swap the outer transport label (e.g. \`16020 -> 16045\`).
   - The P router immediately upstream of PE-2 performs **Penultimate Hop Popping (PHP)**: because PE-2 advertised an Implicit Null label (Label 3) for its Loopback0, the P router pops the outer transport label and forwards the packet with **only the inner VPN label (24018)**.
4. **Egress PE-2 Demultiplexing:**
   - PE-2 receives the packet with label \`24018\`.
   - Looking up \`24018\` in its MPLS forwarding table (LFIB), PE-2 determines the label maps directly to VRF \`Customer_Red\`.
   - PE-2 strips label \`24018\` and forwards the native IPv4 packet out GigabitEthernet0/0/2 directly to CE-2.`,
      callout: {
        type: 'pro_tip',
        title: 'Why Penultimate Hop Popping (PHP) Matters',
        text: 'Without PHP, the egress PE router would have to perform a double lookup: first popping the transport label, then doing a second lookup on the inner VPN label. PHP offloads the transport label pop to the penultimate core router, so the egress PE performs only one label lookup.',
      },
    },
    {
      id: 'sec-mpls-vrf-route-leaking',
      title: '7. VRF Route Leaking and Shared Services Architecture',
      contentMarkdown: `### What is VRF Route Leaking?

By default, VRF segmentation is absolute: packets inside VRF \`Red\` cannot communicate with VRF \`Blue\` or the global routing table. 

However, real-world enterprise architectures frequently require **Shared Services**:
- Centralized Corporate Services: DNS, Active Directory, NTP, RADIUS/TACACS+.
- Centralized Internet Breakout: Single proxy firewall cluster in a DMZ VRF.
- Mergers and Extranets: Allowing selective partner access to database clusters.

**VRF Route Leaking** is the controlled exchange of routing prefixes between isolated VRFs without bridging the entire routing tables.

---

### Route Target Leaking Mechanics: The Shared DNS Scenario

Consider an enterprise hosting central DNS servers (\`192.168.100.0/24\`) in VRF \`Shared_Services\`. Both \`Customer_A\` and \`Customer_B\` need DNS resolution, but Customer A and B must remain strictly isolated from one another.

\`\`\`text
                  +----------------------------------+
                  |      VRF Shared_Services         |
                  |  Export: 65000:999               |
                  |  Import: 65000:999, 100, 200     |
                  +----------------------------------+
                       ^                        ^
       Imports 65000:999\                      /Imports 65000:999
       Exports 65000:100 \                    / Exports 65000:200
                          v                  v
                 +-----------------+   +-----------------+
                 |  VRF Cust_A     |   |  VRF Cust_B     |
                 |  (RD 65000:100) |   |  (RD 65000:200) |
                 +-----------------+   +-----------------+
                 [No direct leak between Cust_A & Cust_B!]
\`\`\`

#### Configuration on PE:
\`\`\`cisco
vrf definition Shared_Services
 rd 65000:999
 address-family ipv4
  route-target export 65000:999
  route-target import 65000:999
  route-target import 65000:100      !<-- Imports Customer A routes
  route-target import 65000:200      !<-- Imports Customer B routes
 exit-address-family

vrf definition Customer_A
 rd 65000:100
 address-family ipv4
  route-target export 65000:100
  route-target import 65000:100
  route-target import 65000:999      !<-- Imports Shared Services route
 exit-address-family

vrf definition Customer_B
 rd 65000:200
 address-family ipv4
  route-target export 65000:200
  route-target import 65000:200
  route-target import 65000:999      !<-- Imports Shared Services route
 exit-address-family
\`\`\`

---

### The Return Path Requirement (The #1 Architecture Trap!)

Routing is inherently asymmetric. If Customer A imports the DNS route \`192.168.100.0/24\`, a client in Customer A (\`10.1.1.50\`) can transmit a DNS query to \`192.168.100.10\`.

However, when the DNS server replies, it consults VRF \`Shared_Services\` for \`10.1.1.50\`. **If VRF \`Shared_Services\` does not import Customer A's RT (\`65000:100\`), the server drops the reply packet!**

> **Golden Rule of Route Leaking:** Route leaking must be bidirectional. Both the forward route and the reverse return route must be leaked into the respective VRF tables.`,
      callout: {
        type: 'warning',
        title: 'Major Security Risk: Overlapping Subnets in Shared VRFs',
        text: 'If Customer A and Customer B both use 10.10.10.0/24, you CANNOT leak both customer routes into the Shared Services VRF simultaneously! Doing so causes an IP routing collision inside the shared VRF. Overlapping customers requiring shared services must use NAT before leaking.',
      },
    },
    {
      id: 'sec-mpls-troubleshooting-case-study',
      title: '8. End-to-End Troubleshooting Case Study: The Disconnected PACS Server',
      contentMarkdown: `### The Incident Scenario

An enterprise healthcare provider operates two regional hospital campuses connected over an MPLS L3VPN provider network. Users at Hospital Branch-2 (VRF \`Clinical\`) report that medical imaging workstations cannot connect to the Radiology PACS server at Headquarters (\`10.50.20.100\` in VRF \`Clinical\`).

Follow the systematic 7-stage diagnostic procedure:

---

### Step 1: Verify CE-PE Adjacency and Local Prefix on Ingress PE-1
Check if the PACS server's subnet is present in PE-1's local VRF routing table:
\`\`\`text
PE-1# show ip route vrf Clinical 10.50.20.0 255.255.255.0
Routing Table: Clinical
Routing entry for 10.50.20.0/24
  Known via "bgp 65000", distance 20, metric 0
  Tag 65100, type external
  Last update from 192.168.10.2 02:41:15 ago
  Routing Descriptor Blocks:
  * 192.168.10.2, from 192.168.10.2, 02:41:15 ago
      Route metric is 0, traffic share count is 1
\`\`\`
→ **Finding:** Subnet \`10.50.20.0/24\` is received from CE-1 and properly installed in PE-1's local VRF \`Clinical\` table.

---

### Step 2: Verify Ingress PE-1 VPNv4 Export Configuration
Inspect the VRF export settings on PE-1:
\`\`\`text
PE-1# show vrf detail Clinical
VRF Clinical (VRF Id = 1); default RD 65000:20; default VPNID = <not set>
  Address family ipv4:
    Export VPN route-target community:
      RT:65000:200
    Import VPN route-target community:
      RT:65000:200
\`\`\`
→ **Finding:** PE-1 exports VRF \`Clinical\` with Route Target \`65000:200\` and RD \`65000:20\`.

---

### Step 3: Verify VPNv4 Advertisement on Ingress PE-1
Confirm the route is converted to VPNv4 and has a local VPN label:
\`\`\`text
PE-1# show bgp vpnv4 unicast all 10.50.20.0/24
BGP routing table entry for 65000:20:10.50.20.0/24, version 14
Paths: (1 available, best #1, table Clinical)
  Advertised to update-groups:
     1
  Refresh Epoch 1
  65100
    192.168.10.2 from 192.168.10.2 (192.168.10.2)
      Origin IGP, metric 0, localpref 100, valid, external, best
      Extended Community: RT:65000:200
      mpls labels: (in/out) 24050/nolabel
\`\`\`
→ **Finding:** Prefix is active in BGP VPNv4, carries RT \`65000:200\`, and PE-1 allocated local VPN label \`24050\`.

---

### Step 4: Verify VPNv4 Receipt on Egress PE-2
Connect to remote PE-2 and inspect its global BGP VPNv4 database:
\`\`\`text
PE-2# show bgp vpnv4 unicast all 10.50.20.0/24
BGP routing table entry for 65000:20:10.50.20.0/24, version 89
Paths: (1 available, best #1)
  Not advertised to any peer
  Refresh Epoch 1
  65100
    10.255.0.1 (metric 15) from 10.255.0.1 (10.255.0.1)
      Origin IGP, metric 0, localpref 100, valid, internal, best
      Extended Community: RT:65000:200
      mpls labels: (in/out) nolabel/24050
\`\`\`
→ **Crucial Finding:** PE-2 **successfully received** the VPNv4 route from PE-1 via MP-BGP! Next-hop \`10.255.0.1\` is valid, and outgoing VPN label \`24050\` is present.

---

### Step 5: Check Local VRF Routing Table on Egress PE-2
Verify if the route is installed in PE-2's local VRF \`Clinical\`:
\`\`\`text
PE-2# show ip route vrf Clinical 10.50.20.0 255.255.255.0
% Network not in table
\`\`\`
→ **Root Cause Clue:** The route exists in PE-2's BGP VPNv4 table, but is **NOT installed** into VRF \`Clinical\`!

---

### Step 6: Identify Root Cause via VRF Import Policy
Inspect PE-2's VRF definition:
\`\`\`text
PE-2# show vrf detail Clinical
VRF Clinical (VRF Id = 2); default RD 65000:21; default VPNID = <not set>
  Address family ipv4:
    Export VPN route-target community:
      RT:65000:200
    Import VPN route-target community:
      RT:65000:201
\`\`\`
→ **DEFECT IDENTIFIED:** Look closely at the Import RT: \`RT:65000:201\`!
PE-1 tagged the route with \`RT:65000:200\`. Due to a typo during provisioning, PE-2 was configured with \`route-target import 65000:201\`. Because the import policy did not match, PE-2 refused to import the prefix into the \`Clinical\` VRF table!

---

### Step 7: Remediation & Final Verification
Correct the import RT under VRF \`Clinical\` on PE-2:
\`\`\`cisco
PE-2(config)# vrf definition Clinical
PE-2(config-vrf)# address-family ipv4
PE-2(config-vrf-af)# route-target import 65000:200
PE-2(config-vrf-af)# end
\`\`\`
Re-check PE-2's VRF routing table:
\`\`\`text
PE-2# show ip route vrf Clinical 10.50.20.0
Routing Table: Clinical
Routing entry for 10.50.20.0/24
  Known via "bgp 65000", distance 200, metric 0, type internal
  Last update from 10.255.0.1 00:00:12 ago
  Routing Descriptor Blocks:
  * 10.255.0.1 (default), from 10.255.0.1, 00:00:12 ago
      Route metric is 0, traffic share count is 1
      AS Hops 1
      MPLS label: 24050
\`\`\`
Workstations at Branch-2 immediately regain full connectivity to the PACS server!`,
    },
    {
      id: 'sec-mpls-summary-checklist',
      title: '9. Summary, Diagnostic Checklist & Common Misconceptions',
      contentMarkdown: `### Architectural Concepts Quick Reference

| Feature | Primary Purpose | Scope | Key Configuration Syntax |
| :--- | :--- | :--- | :--- |
| **VRF** | Virtualizes L3 routing & forwarding tables | Local to PE router | \`vrf definition <name>\` |
| **Route Distinguisher (RD)** | Prepend 64 bits to make IPv4 prefix 96-bit unique in BGP | BGP VPNv4 NLRI | \`rd <asn:nn>\` |
| **Route Target (RT)** | Extended community controlling import/export across VRFs | Global BGP attributes | \`route-target export/import <asn:nn>\` |
| **MP-BGP VPNv4** | Exchanges 96-bit routes & VPN labels between PEs | Control Plane (PE to PE) | \`address-family vpnv4\` |
| **Transport Label** | Swapped by P-core routers to reach egress PE Loopback | Data Plane (Core LSP) | LDP / Segment Routing |
| **VPN Service Label** | Identifies destination VRF on egress PE | Data Plane (Egress Demux) | Allocated by MP-BGP |

---

### The Field Diagnostic Checklist

When troubleshooting MPLS L3VPN connectivity issues, follow this strict chronological sequence:

1. **Verify CE-PE Peering:** Is the CE route present in the local ingress PE's VRF routing table? (\`show ip route vrf <name>\`).
2. **Verify Ingress PE Export Policy:** Does the VRF have a valid RD and export RT configured? (\`show vrf detail <name>\`).
3. **Verify MP-BGP VPNv4 Generation:** Does the route appear in the ingress PE's BGP VPNv4 table with a valid local VPN label? (\`show bgp vpnv4 unicast all\`).
4. **Verify Provider Core LSP:** Can the ingress PE reach the egress PE's Loopback with an active LDP transport label? (\`show mpls forwarding-table\`, \`traceroute mpls\`).
5. **Verify Egress PE VPNv4 Receipt:** Does the remote PE receive the VPNv4 route with the correct BGP Next-Hop and attached RT?
6. **Verify Egress PE Import Policy:** Does the egress VRF configure \`route-target import\` matching the advertised RT?
7. **Verify Return-Path Symmetry:** If traffic is crossing between VRFs (route leaking), does the destination VRF have a return route to the source?

---

### Top 4 Common Traps to Avoid

1. **Confusing RD with RT:** Assuming changing the RD alters route leaking or acceptance. RD only makes routes unique; RT controls import/export policy.
2. **Forgetting Extended Communities:** Forgetting \`neighbor <ip> send-community extended\` under BGP VPNv4 address family. Without it, RTs are stripped and remote PEs drop all routes.
3. **Asymmetric Route Leaking:** Leaking a forward route to a shared service without leaking the return path back to the client.
4. **Overlapping IP Collisions in Shared VRFs:** Attempting to leak two customer VRFs with identical RFC 1918 subnets into a single shared VRF without NAT.`,
      callout: {
        type: 'pro_tip',
        title: 'Core Troubleshooting Command',
        text: 'Always use "show bgp vpnv4 unicast all <prefix>" to inspect both the RD and the attached Extended Community RTs in a single diagnostic output.',
      },
    },
  ],
  predictExercise: {
    id: 'ex-mpls-rd-vs-rt-concept-mc',
    lessonId: 'lesson-mpls-l3vpn',
    type: 'multiple_choice',
    title: 'Core Distinction: Route Distinguisher (RD) vs. Route Target (RT)',
    prompt:
      'A network engineer is configuring an MPLS Layer 3 VPN for two enterprise customers with overlapping IP address space. What is the fundamental operational distinction between a Route Distinguisher (RD) and a Route Target (RT)?',
    learningObjective:
      'Differentiate Virtual Routing and Forwarding (VRF) instances, Route Distinguishers (RDs), and Route Targets (RTs), detailing their independent functions.',
    scenarioContext:
      'An enterprise onboarding engineer is configuring VRF definitions on a Cisco IOS-XE PE router connecting two customer sites.',
    options: [
      {
        id: 'opt-rd-uniqueness-rt-policy',
        label:
          'The RD prepends an 8-byte value to an IPv4 prefix to create a globally unique 96-bit VPNv4 prefix in MP-BGP, whereas the RT is an extended community attribute that dictates which VRF routing tables import and export the route.',
        isCorrect: true,
        explanation:
          'In MPLS L3VPN, RDs and RTs have orthogonal responsibilities: the RD makes overlapping IPv4 prefixes distinct within BGP memory by expanding them into 96-bit VPNv4 routes, while the RT is an 8-byte BGP Extended Community that controls route distribution and determines which VRFs install the prefix.',
      },
      {
        id: 'opt-rd-imports-rt-distinguishes',
        label:
          'The RD dictates which VRF routing tables import the route, while the RT only distinguishes overlapping IPv4 subnets.',
        isCorrect: false,
        explanation:
          'This completely inverts their roles. RDs provide prefix uniqueness; RTs control import/export policy.',
      },
      {
        id: 'opt-rd-outer-label-rt-inner',
        label:
          'The RD generates the outer MPLS transport label, while the RT generates the inner VPN service label.',
        isCorrect: false,
        explanation:
          'RDs and RTs are BGP control-plane attributes and do not directly generate MPLS data-plane labels. Transport labels are generated by LDP/RSVP, and VPN labels are allocated by MP-BGP.',
      },
      {
        id: 'opt-rd-swaps-core-rt-pe',
        label:
          'The RD is used by P-core routers to switch packets, while the RT is used only by CE customer routers.',
        isCorrect: false,
        explanation:
          'P routers never run BGP and are unaware of RDs or RTs. CE routers run standard IPv4 and do not inspect RDs or RTs either.',
      },
    ],
    hints: [
      'Think about which attribute expands a 32-bit IPv4 address into a 96-bit VPNv4 address.',
      'Think about which attribute acts as a BGP Extended Community tag controlling import and export filtering.',
    ],
    explanation:
      'The Route Distinguisher (RD) exists solely to ensure that identical customer IPv4 prefixes can coexist in BGP memory without collision. The Route Target (RT) is a BGP Extended Community that implements the policy logic of which VRF tables import and export the route.',
    commonMistakes: [
      {
        mistake: 'Assuming changing an RD affects route import behavior',
        explanation:
          'A receiving PE inspects only the Route Target community when deciding whether to import a route. Modifying the RD does not change which VRFs accept the route.',
      },
    ],
    practicalTakeaway:
      'RD = Uniqueness in BGP memory. RT = Policy for VRF import and export.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-mpls-packet-walk-sequence',
    lessonId: 'lesson-mpls-l3vpn',
    type: 'sequence',
    title: 'MPLS L3VPN Packet Traversal: Control and Data Plane Lifecycle',
    prompt:
      'Arrange the six stages of an MPLS Layer 3 VPN packet delivery lifecycle into the correct chronological order, from route advertisement to customer packet reception.',
    learningObjective:
      'Trace the end-to-end control-plane and data-plane packet traversal across CE, PE, and P routers in an MPLS L3VPN fabric.',
    scenarioContext:
      'An architect is presenting the lifecycle of an enterprise packet flowing across an MPLS provider core to engineering leadership.',
    sequenceItems: [
      {
        id: 'step-ce-pe-route-learn',
        text: '1. CE-1 advertises local IPv4 prefix to ingress PE-1 via CE-PE routing protocol (eBGP/OSPF/static).',
        correctIndex: 0,
      },
      {
        id: 'step-pe-vpnv4-export',
        text: '2. PE-1 converts prefix to 96-bit VPNv4 route (attaching RD, RT, and VPN label) and advertises via MP-BGP.',
        correctIndex: 1,
      },
      {
        id: 'step-pe2-rt-import',
        text: '3. Egress PE-2 receives VPNv4 update, matches attached RT against local VRF import policy, and installs IPv4 prefix into VRF FIB.',
        correctIndex: 2,
      },
      {
        id: 'step-data-push-labels',
        text: '4. Ingress PE-1 receives customer data packet, imposes inner VPN label and outer LDP transport label, and forwards to core.',
        correctIndex: 3,
      },
      {
        id: 'step-core-php-swap',
        text: '5. P routers swap outer transport label; penultimate hop router pops outer label (PHP), delivering packet with inner VPN label to PE-2.',
        correctIndex: 4,
      },
      {
        id: 'step-pe2-vrf-forward',
        text: '6. Egress PE-2 inspects inner VPN label, identifies destination VRF, strips label, and forwards raw IPv4 packet to CE-2.',
        correctIndex: 5,
      },
    ],
    hints: [
      'Control-plane route advertisement and installation must occur before data packets can flow.',
      'Ingress PE-1 must push two labels: the inner VPN label and the outer transport label.',
      'Penultimate Hop Popping (PHP) strips the outer label right before the packet reaches the egress PE.',
    ],
    explanation:
      'The MPLS L3VPN lifecycle cleanly separates control plane and data plane: (1) CE advertises IPv4 prefix to PE-1, (2) PE-1 exports VPNv4 with RD, RT, and VPN label via MP-BGP, (3) PE-2 matches RT and installs route in VRF FIB, (4) Ingress PE-1 pushes two labels onto customer data packets, (5) P routers switch transport label and penultimate hop pops outer label (PHP), and (6) Egress PE-2 demultiplexes inner VPN label to forward native IPv4 to CE-2.',
    practicalTakeaway:
      'Control plane distributes routes and assigns labels; data plane uses the two-tier label stack to bypass core routing tables.',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-mpls-rd-vs-rt-concept-mc',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'multiple_choice',
      title: 'Core Distinction: Route Distinguisher (RD) vs. Route Target (RT)',
      prompt:
        'A network engineer is configuring an MPLS Layer 3 VPN for two enterprise customers with overlapping IP address space. What is the fundamental operational distinction between a Route Distinguisher (RD) and a Route Target (RT)?',
      learningObjective:
        'Differentiate Virtual Routing and Forwarding (VRF) instances, Route Distinguishers (RDs), and Route Targets (RTs), detailing their independent functions.',
      scenarioContext:
        'An enterprise onboarding engineer is configuring VRF definitions on a Cisco IOS-XE PE router connecting two customer sites.',
      options: [
        {
          id: 'opt-rd-uniqueness-rt-policy',
          label:
            'The RD prepends an 8-byte value to an IPv4 prefix to create a globally unique 96-bit VPNv4 prefix in MP-BGP, whereas the RT is an extended community attribute that dictates which VRF routing tables import and export the route.',
          isCorrect: true,
          explanation:
            'In MPLS L3VPN, RDs and RTs have orthogonal responsibilities: the RD makes overlapping IPv4 prefixes distinct within BGP memory by expanding them into 96-bit VPNv4 routes, while the RT is an 8-byte BGP Extended Community that controls route distribution and determines which VRFs install the prefix.',
        },
        {
          id: 'opt-rd-imports-rt-distinguishes',
          label:
            'The RD dictates which VRF routing tables import the route, while the RT only distinguishes overlapping IPv4 subnets.',
          isCorrect: false,
          explanation:
            'This completely inverts their roles. RDs provide prefix uniqueness; RTs control import/export policy.',
        },
        {
          id: 'opt-rd-outer-label-rt-inner',
          label:
            'The RD generates the outer MPLS transport label, while the RT generates the inner VPN service label.',
          isCorrect: false,
          explanation:
            'RDs and RTs are BGP control-plane attributes and do not directly generate MPLS data-plane labels. Transport labels are generated by LDP/RSVP, and VPN labels are allocated by MP-BGP.',
        },
        {
          id: 'opt-rd-swaps-core-rt-pe',
          label:
            'The RD is used by P-core routers to switch packets, while the RT is used only by CE customer routers.',
          isCorrect: false,
          explanation:
            'P routers never run BGP and are unaware of RDs or RTs. CE routers run standard IPv4 and do not inspect RDs or RTs either.',
        },
      ],
      hints: [
        'Think about which attribute expands a 32-bit IPv4 address into a 96-bit VPNv4 address.',
        'Think about which attribute acts as a BGP Extended Community tag controlling import and export filtering.',
      ],
      explanation:
        'The Route Distinguisher (RD) exists solely to ensure that identical customer IPv4 prefixes can coexist in BGP memory without collision. The Route Target (RT) is a BGP Extended Community that implements the policy logic of which VRF tables import and export the route.',
      commonMistakes: [
        {
          mistake: 'Assuming changing an RD affects route import behavior',
          explanation:
            'A receiving PE inspects only the Route Target community when deciding whether to import a route. Modifying the RD does not change which VRFs accept the route.',
        },
      ],
      practicalTakeaway:
        'RD = Uniqueness in BGP memory. RT = Policy for VRF import and export.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-vpnv4-prefix-length-num',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'numerical',
      title: 'Multiprotocol BGP: VPNv4 Prefix Total Bit Length',
      prompt:
        'In an MPLS Layer 3 VPN network, a PE router converts a standard Customer IPv4 network prefix (such as 192.168.10.0/24) into a VPNv4 route by prepending a 64-bit Route Distinguisher (RD). What is the total length in bits of the resulting VPNv4 address (excluding the prefix mask length)?',
      learningObjective:
        'Calculate the total bit length of a VPNv4 address generated by combining a 64-bit Route Distinguisher with a 32-bit IPv4 prefix.',
      scenarioContext:
        'A network engineer is configuring an access-list and prefix-list to match VPNv4 NLRIs in MP-BGP.',
      numericAnswer: 96,
      numericTolerance: 0,
      hints: [
        'How many bits are in a standard IPv4 address?',
        'An RD is 8 bytes. Convert 8 bytes to bits: 8 * 8 = 64 bits.',
        'Perform the addition: 64 (RD) + 32 (IPv4).',
      ],
      explanation:
        'A standard IPv4 address is 32 bits (4 bytes). An MPLS Route Distinguisher is 64 bits (8 bytes). When combined in MP-BGP (RFC 4364), the resulting VPNv4 address is 64 + 32 = 96 bits (12 bytes).',
      practicalTakeaway:
        'VPNv4 addresses are always 96 bits (12 bytes) long, consisting of an 8-byte RD and a 4-byte IPv4 address.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-rt-import-predict-mc',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'multiple_choice',
      title: 'Route Target Import Evaluation: Multi-VRF Filtering',
      prompt:
        'Ingress PE-1 advertises a VPNv4 prefix originating from Customer_Alpha with attached BGP Extended Community "RT:65000:101". Egress PE-2 receives this advertisement. PE-2 has three configured VRFs:\n\n1. VRF Alpha_West: route-target import 65000:101, route-target export 65000:101\n2. VRF Beta_West: route-target import 65000:202, route-target export 65000:202\n3. VRF Shared_DNS: route-target import 65000:303, route-target export 65000:303\n\nInto which VRF routing table(s) on PE-2 will this prefix be installed?',
      learningObjective:
        'Evaluate Route Target import matching logic across multiple concurrent VRF instances on a PE router.',
      scenarioContext:
        'An engineer is verifying VPN route isolation on a newly provisioned regional PE router.',
      options: [
        {
          id: 'opt-vrf-alpha-only',
          label:
            'VRF Alpha_West only, because its configured import route-target (65000:101) exactly matches the route\'s attached extended community.',
          isCorrect: true,
          explanation:
            'PE routers inspect the extended communities carried by incoming VPNv4 updates against the "route-target import" lists of all locally configured VRFs. Only VRF Alpha_West configures "route-target import 65000:101", so only Alpha_West installs the prefix.',
        },
        {
          id: 'opt-all-vrfs-same-pe',
          label:
            'All three VRFs on PE-2, because PE-2 automatically shares received VPNv4 routes across all local VRF instances.',
          isCorrect: false,
          explanation:
            'VRFs are strictly isolated. A VRF will never install a route unless one of its configured import RTs matches the route\'s attached RT.',
        },
        {
          id: 'opt-alpha-and-shared',
          label:
            'VRF Alpha_West and VRF Shared_DNS, because Shared_DNS automatically accepts all customer traffic.',
          isCorrect: false,
          explanation:
            'Shared_DNS only imports RT 65000:303. Without an explicit import of 65000:101, Shared_DNS ignores the route.',
        },
        {
          id: 'opt-none-requires-rd-match',
          label:
            'None of the VRFs, because PE-2 must also configure a matching Route Distinguisher before importing the route.',
          isCorrect: false,
          explanation:
            'The Route Distinguisher (RD) is completely ignored during route import. Only the Route Target (RT) extended community is evaluated.',
        },
      ],
      hints: [
        'Check the "route-target import" statement for each VRF on PE-2.',
        'Which VRF specifies an import value matching RT:65000:101?',
      ],
      explanation:
        'A PE router evaluates incoming VPNv4 routes against the "route-target import" statements of each local VRF. Only VRFs that explicitly include the matching RT community will extract and install the IPv4 route into their forwarding table.',
      commonMistakes: [
        {
          mistake: 'Assuming RDs must match between PE routers',
          explanation:
            'PE-1 and PE-2 can use different RDs for the same customer without issue. Import/export is governed solely by RTs.',
        },
      ],
      practicalTakeaway:
        'A VRF imports a route if and only if at least one attached RT community matches that VRF\'s import RT list.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-bgp-vpnv4-cli-interpret',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'troubleshooting',
      title: 'MP-BGP VPNv4 Output Diagnostics: Identifying Missing Import',
      prompt:
        'On PE-2, an engineer checks for prefix 10.200.5.0/24 using "show bgp vpnv4 unicast all 10.200.5.0/24":\n\nBGP routing table entry for 65000:10:10.200.5.0/24, version 42\nPaths: (1 available, best #1, table default)\n  Not advertised to any peer\n  Refresh Epoch 1\n  65100\n    10.255.0.1 (metric 20) (via default) from 10.255.0.1 (10.255.0.1)\n      Origin IGP, metric 0, localpref 100, valid, internal, best\n      Extended Community: RT:65000:500\n      mpls labels: (in/out) 1024/24018\n\nHowever, running "show ip route vrf Operations 10.200.5.0" on PE-2 returns "% Network not in table".\nRunning "show vrf detail Operations" reveals:\n  Export VPN route-target community: RT:65000:500\n  Import VPN route-target community: RT:65000:501\n\nWhy is the route missing from the Operations VRF routing table?',
      learningObjective:
        'Diagnose why a route present in the MP-BGP VPNv4 table fails to install into a destination VRF by identifying Route Target mismatches.',
      scenarioContext:
        'A Tier-3 support engineer is troubleshooting a routing discrepancy where BGP shows the prefix as valid and best, but the VRF cannot route to it.',
      options: [
        {
          id: 'opt-rt-mismatch-import-501',
          label:
            'There is an import Route Target mismatch: the received VPNv4 route carries RT:65000:500, but VRF Operations is configured to import only RT:65000:501.',
          isCorrect: true,
          explanation:
            'The CLI output explicitly proves the route is valid and best in BGP VPNv4 with Extended Community "RT:65000:500". However, "show vrf detail Operations" reveals that VRF Operations only imports "RT:65000:501". Because 65000:500 does not match 65000:501, BGP refuses to install the prefix into the Operations VRF routing table.',
        },
        {
          id: 'opt-inaccessible-nexthop',
          label:
            'The next-hop 10.255.0.1 is inaccessible in the global routing table, preventing route installation.',
          isCorrect: false,
          explanation:
            'The BGP output states "10.255.0.1 (metric 20) (via default)... valid, internal, best", proving the next-hop is fully reachable and resolved via IGP.',
        },
        {
          id: 'opt-rd-mismatch-65000-10',
          label:
            'The Route Distinguisher (65000:10) on the route does not match the local VRF RD, causing PE-2 to drop the advertisement.',
          isCorrect: false,
          explanation:
            'RDs do not need to match between PE routers. Import decisions are strictly based on Route Targets.',
        },
        {
          id: 'opt-missing-vpn-label',
          label:
            'The route is missing an outbound VPN label in the MPLS forwarding table.',
          isCorrect: false,
          explanation:
            'The output shows "mpls labels: (in/out) 1024/24018", proving outbound VPN label 24018 is present and valid.',
        },
      ],
      hints: [
        'Compare the Extended Community value in the BGP output with the Import VPN route-target community in the VRF detail.',
        'Notice the difference between 65000:500 and 65000:501.',
      ],
      explanation:
        'When a VPNv4 route exists in the BGP table as valid and best but is missing from the VRF routing table, the most common root cause is an import Route Target mismatch. The route carries RT:65000:500, but the VRF only imports RT:65000:501.',
      commonMistakes: [
        {
          mistake: 'Assuming a BGP failure when BGP actually has the route',
          explanation:
            'The BGP session is healthy and the route is valid. The failure is purely in the VRF import policy configuration.',
        },
      ],
      practicalTakeaway:
        'If "show bgp vpnv4 unicast all" has the prefix but "show ip route vrf <name>" does not, check "route-target import".',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-label-roles-mc',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'multiple_choice',
      title: 'MPLS Two-Tier Label Stack: Transport vs. Service Labels',
      prompt:
        'A packet leaves ingress PE-1 towards egress PE-2 across a provider MPLS core with a two-label stack: Outer Label = 16020, Inner Label = 24018. What are the specific respective functions of these two labels during transit across the core and upon arrival at PE-2?',
      learningObjective:
        'Differentiate the operational roles of the outer MPLS transport label and the inner VPN service label in a two-tier label stack.',
      scenarioContext:
        'An engineer is capturing packets on a core link between two P routers and analyzing the MPLS header stack.',
      options: [
        {
          id: 'opt-outer-transport-inner-vpn',
          label:
            'The outer label (16020) is the transport label used by P routers to switch the packet across the core to PE-2\'s Loopback; the inner label (24018) is the VPN service label used by PE-2 to identify the destination VRF.',
          isCorrect: true,
          explanation:
            'MPLS L3VPN employs a two-tier label stack: the outer transport label (allocated by LDP/IGP) directs the packet across P routers to the egress PE\'s Loopback address, while the inner VPN label (allocated by MP-BGP) is read only by the egress PE to demultiplex the packet into the correct customer VRF.',
        },
        {
          id: 'opt-outer-vpn-inner-transport',
          label:
            'The outer label (16020) identifies the customer VRF, while the inner label (24018) is swapped by P routers to reach the next hop.',
          isCorrect: false,
          explanation:
            'This inverts the stack. P routers only inspect the outermost label; if the VRF label were outer, P routers would need to know all customer VRFs.',
        },
        {
          id: 'opt-both-swapped-p-routers',
          label:
            'Both labels are simultaneously inspected and swapped by every P router in the core to ensure multi-path load balancing.',
          isCorrect: false,
          explanation:
            'P routers never inspect or swap the inner VPN label. They operate strictly on the top transport label.',
        },
        {
          id: 'opt-outer-qos-inner-ip',
          label:
            'The outer label enforces QoS traffic prioritization, while the inner label contains an encrypted hash of the customer IP header.',
          isCorrect: false,
          explanation:
            'MPLS labels contain a 20-bit label value, 3-bit TC/EXP (QoS), 1-bit Bottom-of-Stack, and 8-bit TTL; neither label is an encrypted IP hash.',
        },
      ],
      hints: [
        'Which label is used to navigate the physical provider backbone to reach the egress router?',
        'Which label tells the egress router which customer routing table to forward the packet into?',
      ],
      explanation:
        'In MPLS L3VPN, the outer transport label enables P routers to switch traffic across the core without knowing customer routes (BGP-free core). The inner VPN label is read exclusively by the destination PE router to demultiplex the payload into the appropriate customer VRF.',
      commonMistakes: [
        {
          mistake: 'Thinking P routers read the inner VPN label',
          explanation:
            'P routers only look at the top label. They have no knowledge of the inner VPN label or the customer IP payload.',
        },
      ],
      practicalTakeaway:
        'Top label gets the packet to the egress PE; bottom label gets the packet to the customer VRF.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-packet-walk-sequence',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'sequence',
      title: 'MPLS L3VPN Packet Traversal: Control and Data Plane Lifecycle',
      prompt:
        'Arrange the six stages of an MPLS Layer 3 VPN packet delivery lifecycle into the correct chronological order, from route advertisement to customer packet reception.',
      learningObjective:
        'Trace the end-to-end control-plane and data-plane packet traversal across CE, PE, and P routers in an MPLS L3VPN fabric.',
      scenarioContext:
        'An architect is presenting the lifecycle of an enterprise packet flowing across an MPLS provider core to engineering leadership.',
      sequenceItems: [
        {
          id: 'step-ce-pe-route-learn',
          text: '1. CE-1 advertises local IPv4 prefix to ingress PE-1 via CE-PE routing protocol (eBGP/OSPF/static).',
          correctIndex: 0,
        },
        {
          id: 'step-pe-vpnv4-export',
          text: '2. PE-1 converts prefix to 96-bit VPNv4 route (attaching RD, RT, and VPN label) and advertises via MP-BGP.',
          correctIndex: 1,
        },
        {
          id: 'step-pe2-rt-import',
          text: '3. Egress PE-2 receives VPNv4 update, matches attached RT against local VRF import policy, and installs IPv4 prefix into VRF FIB.',
          correctIndex: 2,
        },
        {
          id: 'step-data-push-labels',
          text: '4. Ingress PE-1 receives customer data packet, imposes inner VPN label and outer LDP transport label, and forwards to core.',
          correctIndex: 3,
        },
        {
          id: 'step-core-php-swap',
          text: '5. P routers swap outer transport label; penultimate hop router pops outer label (PHP), delivering packet with inner VPN label to PE-2.',
          correctIndex: 4,
        },
        {
          id: 'step-pe2-vrf-forward',
          text: '6. Egress PE-2 inspects inner VPN label, identifies destination VRF, strips label, and forwards raw IPv4 packet to CE-2.',
          correctIndex: 5,
        },
      ],
      hints: [
        'Control-plane route advertisement and installation must occur before data packets can flow.',
        'Ingress PE-1 must push two labels: the inner VPN label and the outer transport label.',
        'Penultimate Hop Popping (PHP) strips the outer label right before the packet reaches the egress PE.',
      ],
      explanation:
        'The MPLS L3VPN lifecycle cleanly separates control plane and data plane: (1) CE advertises IPv4 prefix to PE-1, (2) PE-1 exports VPNv4 with RD, RT, and VPN label via MP-BGP, (3) PE-2 matches RT and installs route in VRF FIB, (4) Ingress PE-1 pushes two labels onto customer data packets, (5) P routers switch transport label and penultimate hop pops outer label (PHP), and (6) Egress PE-2 demultiplexes inner VPN label to forward native IPv4 to CE-2.',
      practicalTakeaway:
        'Control plane distributes routes and assigns labels; data plane uses the two-tier label stack to bypass core routing tables.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-vrf-route-leaking-mc',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'multiple_choice',
      title: 'Controlled Inter-VRF Route Leaking: Shared Services Configuration',
      prompt:
        'A service provider hosts a shared DNS & Authentication cluster in VRF Shared_Services (exporting RT 65000:999). Customer VRF Corp_A (exporting RT 65000:100) must access these servers. The network administrator configures "route-target import 65000:999" under VRF Corp_A. Users in Corp_A can now see the DNS route in their VRF routing table, but DNS queries still time out with 100% loss. What mandatory configuration step was omitted?',
      learningObjective:
        'Design and troubleshoot bidirectional Route Target leaking for shared services, ensuring return path symmetry.',
      scenarioContext:
        'An enterprise network administrator is troubleshooting a shared services rollout where client requests reach the server but responses are never received.',
      options: [
        {
          id: 'opt-symmetric-import-corp-into-shared',
          label:
            'VRF Shared_Services must also configure "route-target import 65000:100" so return packets from the DNS servers have a routing path back to Corp_A\'s client addresses.',
          isCorrect: true,
          explanation:
            'Routing requires bidirectional symmetry. While Corp_A imported the route to the DNS server, the Shared_Services VRF had no route back to Corp_A\'s client subnet. When the DNS server replied, the PE dropped the return packet because the client\'s destination IP was absent from the Shared_Services VRF routing table.',
        },
        {
          id: 'opt-change-corp-rd-to-shared',
          label:
            'VRF Corp_A must change its Route Distinguisher (RD) to 65000:999 so both VRFs share the same BGP table.',
          isCorrect: false,
          explanation:
            'RDs do not control route leaking. Changing the RD would break Corp_A\'s private VPN route isolation.',
        },
        {
          id: 'opt-disable-php-on-core',
          label:
            'Penultimate Hop Popping (PHP) must be disabled on the core routers to prevent transport label stripping.',
          isCorrect: false,
          explanation:
            'PHP is an underlay transport optimization and has nothing to do with inter-VRF return routing.',
        },
        {
          id: 'opt-enable-multicast-bgp',
          label:
            'MP-BGP must be reconfigured to enable the multicast address-family for DNS UDP traffic.',
          isCorrect: false,
          explanation:
            'Standard DNS queries and unicast UDP traffic utilize standard unicast routing tables, not multicast BGP.',
        },
      ],
      hints: [
        'Think about return traffic: when the DNS server generates a response packet, what routing table does it consult?',
        'Does VRF Shared_Services know how to reach the source IP address of Corp_A\'s users?',
      ],
      explanation:
        'Inter-VRF route leaking must always be bidirectional. If VRF A leaks routes from Shared Services, Shared Services must also leak routes from VRF A. Without the return route, forward packets arrive at the server but response packets are dropped by the PE.',
      commonMistakes: [
        {
          mistake: 'Assuming route leaking is automatically bidirectional',
          explanation:
            'Importing a route target is strictly unidirectional. It pulls routes into the local VRF, but provides zero routing visibility in the reverse direction.',
        },
      ],
      practicalTakeaway:
        'Always verify return-path symmetry: if VRF 1 imports from VRF 2, VRF 2 must import from VRF 1.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-cisco-vrf-cli-predict',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'predict_output',
      title: 'Cisco IOS-XE VRF Interface Binding: Configuration Safeguard',
      prompt:
        'A network engineer is configuring a customer interface on Cisco IOS-XE router PE-1. The interface already has IPv4 address 192.168.10.1/30 configured. The engineer enters interface configuration mode and issues the command:\n\nPE-1(config-if)# vrf forwarding Enterprise_Cust\n\nWhat critical action does Cisco IOS-XE execute automatically on this interface immediately after this command is entered?',
      learningObjective:
        'Identify Cisco IOS-XE operational behavior when binding an interface to a VRF, specifically the automatic deletion of configured IP addresses.',
      scenarioContext:
        'An engineer accidentally causes an interface outage while migrating an existing interface into a new VRF.',
      textAnswerPattern: '^(ip address removed|removes? (the )?ip address|deletes? (the )?ip address|all ip addresses are removed|ip removed)$',
      acceptableAnswers: [
        'IP address is removed',
        'removes the ip address',
        'deletes the ip address',
        'IP address removed',
        'removes ip address',
      ],
      hints: [
        'Think about what Cisco IOS does to the existing Layer 3 addressing on the interface.',
        'Cisco does this to prevent existing IP addresses from leaking into the new VRF without confirmation.',
        'The command unconfigures or removes the IP address.',
      ],
      explanation:
        'In Cisco IOS and IOS-XE, assigning an interface to a VRF using "vrf forwarding <name>" (or legacy "ip vrf forwarding <name>") automatically removes any configured IP address from that interface. Cisco enforces this behavior as a safety safeguard. The engineer must explicitly re-enter the "ip address <ip> <mask>" command after the VRF binding is complete.',
      commonMistakes: [
        {
          mistake: 'Assuming the IP address automatically transfers into the VRF',
          explanation:
            'Cisco IOS-XE always unconfigures the IP address upon VRF association to prevent inadvertent cross-VRF address leakage.',
        },
      ],
      practicalTakeaway:
        'Always re-apply the IP address after binding an interface to a VRF in Cisco IOS/IOS-XE.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-mpls-p-router-bgp-free-tb',
      lessonId: 'lesson-mpls-l3vpn',
      type: 'troubleshooting',
      title: 'Provider Core Troubleshooting: The BGP-Free Core Architectural Invariant',
      prompt:
        'A junior engineer troubleshooting an MPLS L3VPN packet drop observes that provider core router "P-Core-3" has no knowledge of customer subnet 10.40.0.0/24 in its routing table ("show ip route 10.40.0.0" returns "% Network not in table"). The junior engineer proposes configuring BGP on P-Core-3 to import customer routes. Why is this proposal fundamentally flawed?',
      learningObjective:
        'Explain why provider core (P) routers remain BGP-free and switch traffic strictly based on MPLS transport labels.',
      scenarioContext:
        'A design review for a core router upgrade addresses misconceptions regarding routing table requirements in the provider backbone.',
      options: [
        {
          id: 'opt-p-routers-switch-labels-only',
          label:
            'P routers in an MPLS L3VPN core are intentionally BGP-free; they switch packets purely based on the top LDP/IGP transport label and never need customer routing information.',
          isCorrect: true,
          explanation:
            'One of the greatest architectural benefits of MPLS L3VPN is the "BGP-Free Core". P routers only participate in the core IGP and LDP. They switch packets across the core based strictly on the outer transport label pointing to the egress PE. Loading customer routes into P routers would destroy core scalability and violate the architecture.',
        },
        {
          id: 'opt-p-routers-need-static-routes',
          label:
            'P routers do not need BGP, but they must maintain static routes pointing to each customer edge interface.',
          isCorrect: false,
          explanation:
            'P routers never hold static routes to customer subnets. They only route to PE Loopback addresses via the core IGP.',
        },
        {
          id: 'opt-p-routers-run-ospf-areas',
          label:
            'P routers only store customer routes if all routers reside in OSPF Area 0.',
          isCorrect: false,
          explanation:
            'Customer routes are never injected into the provider IGP (OSPF/IS-IS) regardless of the area hierarchy.',
        },
        {
          id: 'opt-p-routers-only-store-vpn-labels',
          label:
            'P routers store inner VPN labels instead of BGP routes.',
          isCorrect: false,
          explanation:
            'P routers never store or inspect inner VPN labels. Only the egress PE reads the VPN label.',
        },
      ],
      hints: [
        'Do core routers need to know about customer IP addresses in an MPLS network?',
        'What label do P routers use to forward transit packets across the core?',
      ],
      explanation:
        'The MPLS L3VPN architecture maintains a BGP-free core. P routers only maintain transport labels to PE Loopbacks using LDP. They do not run BGP, do not have VRFs, and do not store customer subnets.',
      commonMistakes: [
        {
          mistake: 'Assuming every router along the path must have a route to the destination IP',
          explanation:
            'In an MPLS network, core routers switch based on labels, completely decoupling packet transit from destination IP table lookups.',
        },
      ],
      practicalTakeaway:
        'P routers are BGP-free. If a P router cannot ping a customer IP, that is normal and expected.',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'Cisco IOS-XE MPLS Layer 3 VPNs Configuration Guide',
      url: 'https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/mpls/b-mpls-xe-17-book/configuring-mpls-layer-3-vpns.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Multiprotocol BGP, VRF Definitions, and Route Target Import/Export Policies',
    },
    {
      title: 'RFC 4364: BGP/MPLS IP Virtual Private Networks (VPNs)',
      url: 'https://datatracker.ietf.org/doc/html/rfc4364',
      sourceType: 'rfc',
      relevantSection: 'Section 4: VPN-IPv4 Address Family & Route Distinguishers',
    },
    {
      title: 'Cisco Support: Understanding MPLS Layer 3 VPN Forwarding & Label Stacks',
      url: 'https://www.cisco.com/c/en/us/support/docs/multiprotocol-label-switching-mpls/mpls/13733-mpls-vpn-basic.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Two-Tier Label Forwarding, Penultimate Hop Popping (PHP), and LFIB Mechanics',
    },
  ],
};
