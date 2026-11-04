import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonSdWanArchitecture: DetailedLesson = {
  id: 'lesson-sd-wan-architecture',
  topicId: 'topic-sdwan',
  pathId: 'path-ccnp',
  slug: 'sd-wan-architecture-and-control-planes',
  title: 'Cisco SD-WAN Architecture & Control Planes: Underlay, Overlay & Fabric Orchestration',
  subtitle: 'Orchestration (vBond), Management (vManage), Control (vSmart via OMP), and Data (WAN Edge IPsec) Mechanics',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Contrast traditional WAN (hub-and-spoke backhauling, per-device manual CLI, rigid MPLS) with SD-WAN (centralized control, application-aware routing, automated IPsec fabric).',
    'Distinguish underlay transport reachability (physical interfaces, MPLS, broadband, 4G/5G, point-to-point IP) from the secure overlay network (IPsec tunnels, BFD probes, fabric encapsulation).',
    'Analyze the strict separation of the 4 architectural planes: Orchestration (vBond), Management (vManage), Control (vSmart), and Data (WAN Edge).',
    'Detail the operational responsibilities of each Cisco SD-WAN component and how Zero-Touch Provisioning (ZTP/PnP) authenticates devices via white lists and x.509 certificates.',
    'Trace the deterministic device onboarding and control-connection establishment workflow across VPN 0 (Transport) and VPN 512 (Management).',
    'Explain how the Overlay Management Protocol (OMP) advertises vRoutes, TLOCs (System IP, Color, Encapsulation), and service routes to steer traffic dynamically.',
    'Execute a step-by-step trace of how user packets traverse an SD-WAN fabric from branch client to data center application.',
    'Diagnose basic connectivity, control-plane DTLS/TLS drops, certificate expiration, and data-plane BFD failures using structured troubleshooting methods.',
  ],
  sections: [
    {
      id: 'sec-sdwan-problem-shift',
      title: '1. The Problem with Traditional WAN & The Architectural Shift',
      contentMarkdown:
        'In traditional enterprise WAN architectures, branches connect back to corporate data centers primarily through expensive, private **MPLS (Multiprotocol Label Switching)** circuits. While MPLS offers strict Service Level Agreements (SLAs), it introduces severe operational bottlenecks in modern enterprise environments:\n\n- **Hairpinning (Tromboning) Traffic:** All branch Internet and cloud traffic (Microsoft 365, AWS, Salesforce) is backhauled over the private MPLS circuit to a central data center for security inspection before reaching the Internet. This saturates expensive private bandwidth and introduces unacceptable latency for end-users.\n- **Per-Device Manual Configuration:** Every router requires custom, error-prone hop-by-hop CLI configuration. Provisioning a new branch, changing QoS policies, or adding a secondary provider can take weeks or months.\n- **Rigid Active/Standby Uplinks:** When an enterprise purchases a secondary broadband Internet or cellular link as backup, it often sits completely idle because traditional routing protocols (e.g., policy-based routing, IP SLA tracking) are complex to configure and slow to fail over.\n\n### The SD-WAN Solution: Transport Independence\n**Software-Defined WAN (SD-WAN)** decouples network hardware from control logic, replacing static hop-by-hop routing with an **automated, application-aware virtual overlay** spanning all available transports.\n\n| Feature | Traditional Enterprise WAN | Cisco SD-WAN (Viptela Architecture) |\n| :--- | :--- | :--- |\n| **Control Plane** | Distributed (every router runs independent IGP/BGP instances) | **Centralized** (vSmart controllers compute topology & policies) |\n| **Transport Links** | Active/Standby (MPLS primary, broadband standby) | **Active/Active** (MPLS, broadband, LTE/5G used simultaneously) |\n| **Traffic Steering** | Static routing or complex Policy-Based Routing (PBR) | **Application-Aware Routing (AAR)** based on real-time BFD metrics |\n| **Security & Tunnels** | Manual point-to-point IPsec / DMVPN with IKE negotiation | **Zero-touch IPsec fabric**; encryption keys distributed by vSmart |\n| **Management** | Individual per-box CLI, SNMP, or disparate NMS | **Single Pane of Glass (vManage)** GUI & centralized REST APIs |',
      callout: {
        type: 'pro_tip',
        title: 'Architectural Philosophy',
        text: 'SD-WAN does not replace physical IP transport; it abstracts physical connectivity into an intelligent software overlay where business intent dictates path selection rather than physical link metrics.',
      },
    },
    {
      id: 'sec-underlay-vs-overlay',
      title: '2. Underlay vs. Overlay Network: Mechanics & Encapsulation',
      contentMarkdown:
        'To understand SD-WAN packet delivery, you must clearly distinguish the **underlay network** from the **overlay fabric**:\n\n### The Underlay Network\nThe **underlay** is the underlying physical network and third-party transport infrastructure. It consists of physical routers, switches, optical links, and service provider networks (public Internet broadband, private MPLS, 4G/5G wireless).\n\n- **Responsibility:** Provide reliable point-to-point IP connectivity between the WAN Edge routers\' external transport interfaces.\n- **Addressing:** Public IP addresses (Internet/broadband) or provider-assigned private IPs (MPLS circuit).\n- **Routing:** Handled by standard underlay protocols: static default routes, DHCP, or eBGP peering with the ISP.\n- **Isolation:** The underlay knows **nothing** about enterprise internal subnets (e.g., `10.1.1.0/24` at Branch-1 or `10.2.2.0/24` at Headquarters). Underlay routers only forward packets based on the public transport IP headers.\n\n### The Overlay Fabric\nThe **overlay** is the secure virtual network built on top of the underlay. It is an encrypted mesh of **IPsec tunnels** dynamically formed between WAN Edge routers.\n\n- **Responsibility:** Transport customer service traffic (voice, data, video) securely between enterprise sites with end-to-end segmentation.\n- **Encapsulation:** Uses **IPsec ESP (Encapsulating Security Payload)** inside UDP (default ports `12346` to `13145`) or raw IPsec (IP protocol 50) to traverse NAT devices seamlessly.\n- **Telemetry:** Continuous **BFD (Bidirectional Forwarding Detection)** probes run inside every IPsec tunnel to measure real-time latency, jitter, and packet loss.\n\n### Concrete Encapsulation Example\nWhen host `10.1.1.5` at Branch 1 sends an HTTPS packet to server `10.2.2.10` at the Data Center across the Internet:\n\n```text\n+-----------------------------------------------------------------------------------------+\n|                           OUTER UNDERLAY TRANSPORT PACKET                               |\n|  +--------------------+---------------------+----------------------------------------+  |\n|  | Outer IP Header    | ESP / UDP Header    | ENCRYPTED INNER PAYLOAD                |  |\n|  | Src: 198.51.100.2  | UDP Port: 12346     | +-------------------+----------------+ |  |\n|  | Dst: 203.0.113.10  | SPI / Sequence Num  | | Inner IP Header   | HTTPS Payload  | |  |\n|  | (Branch Public IP) | (IPsec Encryption)  | | Src: 10.1.1.5     | (TCP 443 Data) | |  |\n|  |                    |                     | | Dst: 10.2.2.10    |                | |  |\n|  +--------------------+---------------------+----------------------------------------+  |\n+-----------------------------------------------------------------------------------------+\n```',
      callout: {
        type: 'rfc',
        title: 'Zero IKE Negotiation Bottlenecks',
        text: 'In traditional DMVPN or IPsec meshes, routers negotiate Diffie-Hellman keys pair-wise via IKE Phase 1 and 2, which scales at O(N^2) and strains router CPU. Cisco SD-WAN eliminates IKE between edge devices: each WAN Edge generates its own symmetric encryption key and sends it to vSmart via OMP; vSmart securely reflects keys to authorized peers, scaling at O(N).',
      },
    },
    {
      id: 'sec-four-architectural-planes',
      title: '3. The Four Architectural Planes & Component Responsibilities',
      contentMarkdown:
        'Cisco SD-WAN divides all system functions into four cleanly separated architectural planes:\n\n```text\n  +-------------------------------------------------------------------------+\n  |                      MANAGEMENT PLANE: Cisco vManage                    |\n  |        Single Pane of Glass GUI, Configuration Templates, Analytics     |\n  +-------------------------------------------------------------------------+\n                                       |\n                                       | (HTTPS / REST API)\n                                       v\n  +-------------------------------------------------------------------------+\n  |                     ORCHESTRATION PLANE: Cisco vBond                    |\n  |     Initial Rendezvous, Whitelist Authorization, NAT Traversal (STUN)   |\n  +-------------------------------------------------------------------------+\n                                       |\n                                       | (DTLS / TLS)\n                                       v\n  +-------------------------------------------------------------------------+\n  |                       CONTROL PLANE: Cisco vSmart                       |\n  |   Fabric "Brain", OMP Route Calculation, Policy & Key Distribution      |\n  +-------------------------------------------------------------------------+\n                                       |\n                                       | (OMP over DTLS/TLS)\n                                       v\n  +-------------------------------------------------------------------------+\n  |                        DATA PLANE: WAN Edge Routers                     |\n  |    Catalyst 8000 / ISR 4000 (cEdge) or vEdge, IPsec Forwarding, BFD     |\n  +-------------------------------------------------------------------------+\n```\n\n### Component Roles & Responsibilities\n\n1. **Cisco vManage (Management Plane):**\n   - Centralized Network Management System (NMS) providing a single-pane-of-glass web dashboard.\n   - Used for template-based device provisioning, policy creation, software upgrades, inventory management, and deep packet inspection (DPI) analytics.\n   - Exposes REST APIs for third-party automation and ServiceNow/ITSM integration.\n\n2. **Cisco vBond Orchestrator (Orchestration Plane):**\n   - The initial point of contact (rendezvous point) for any new device joining the fabric.\n   - **Authenticates** every WAN Edge and controller using mutual x.509 certificates and an authorized chassis/serial number whitelist.\n   - Facilitates NAT traversal using STUN (Session Traversal Utilities for NAT) to discover public mapped IPs/ports.\n   - Informs WAN Edges of the IP addresses of their assigned vSmart and vManage controllers.\n   - *Requirement:* Must have a public IPv4 address or a 1:1 static NAT to be reachable across any underlay transport.\n\n3. **Cisco vSmart Controller (Control Plane):**\n   - The "brain" of the SD-WAN solution.\n   - Establishes permanent **DTLS or TLS control connections** with WAN Edges and vManage.\n   - Runs **Overlay Management Protocol (OMP)** to receive route announcements, TLOCs, and encryption keys from WAN Edges.\n   - Computes fabric topology, calculates best paths, enforces centralized data/control policies, and distributes encryption keys.\n   - **Crucial Rule:** vSmart resides **strictly** in the control plane. It **never** receives, touches, or forwards end-user data packets!\n\n4. **Cisco WAN Edge (Data Plane):**\n   - Physical routers (Catalyst 8300, 8500, ISR 4000, ASR 1000 running IOS-XE SD-WAN / cEdge) or virtual appliances (vEdge, Catalyst 8000v) situated at branches, campuses, and data centers.\n   - Terminates physical underlay connections (MPLS circuits, broadband modems, cellular SIMs).\n   - Forms dynamic **IPsec tunnels** with peer WAN Edges to forward user payload packets.\n   - Runs **BFD probes** across every tunnel to measure jitter, loss, and latency for Application-Aware Routing (AAR).\n   - Enforces localized access policies and application QoS.',
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco SD-WAN VPN Segmentation Terminology',
        text: 'In Cisco SD-WAN, a VPN is equivalent to a VRF (Virtual Routing and Forwarding instance). There are three distinct VPN categories: VPN 0 (Transport VPN: reserved for underlay interfaces and control connections); VPN 512 (Management VPN: reserved for out-of-band management); and Service VPNs (VPN 1 to 511, 513 to 65530: user traffic isolated from control and management traffic).',
      },
    },
    {
      id: 'sec-onboarding-control-connections',
      title: '4. Device Onboarding & Control-Connection Establishment',
      contentMarkdown:
        'When a brand-new WAN Edge router is powered on at a remote branch, it automatically initiates the onboarding sequence (Zero-Touch Provisioning / Cisco Plug-and-Play):\n\n### The 6-Step Onboarding Sequence\n\n1. **Underlay IP & DNS Acquisition (VPN 0):**\n   The WAN Edge powers on and requests an IP address, default gateway, and DNS server via DHCP on its WAN interface in VPN 0 (or uses a bootstrap configuration file).\n\n2. **Contacting the vBond Orchestrator:**\n   The router resolves the DNS hostname of the enterprise vBond orchestrator (e.g., `vbond.company.com`) and initiates a transient **DTLS (Datagram Transport Layer Security)** connection over UDP port `12346`.\n\n3. **Mutual Certificate & Whitelist Validation:**\n   The WAN Edge and vBond authenticate each other using **x.509 public key certificates** signed by a trusted Enterprise or Cisco Root CA.\n   - The WAN Edge presents its cryptographic device identity (SUDI chip / TPM chip certificate containing its Chassis ID and Serial Number).\n   - vBond verifies that the router\'s Serial Number exists in the **Authorized Serial Number File (whitelist)** provided by Cisco Commerce Workspace / PnP portal.\n\n4. **Controller Distribution:**\n   Upon successful authentication, vBond inspects the router\'s public NAT-mapped IP/port (STUN) and provides the router with the IP addresses of the organization\'s **vManage** and **vSmart** controllers. vBond then notifies vSmart and vManage that the new WAN Edge is joining.\n\n5. **Establishing Permanent Control Connections:**\n   The WAN Edge terminates its temporary connection to vBond and initiates permanent **DTLS or TLS connections** to vManage and the assigned vSmart controllers in VPN 0.\n   - Mutual certificates are once again validated.\n   - vManage pushes the device configuration template (System IP, Site ID, interfaces, policies).\n\n6. **OMP Peering with vSmart:**\n   The WAN Edge establishes an **Overlay Management Protocol (OMP)** session inside the secure DTLS/TLS control connection to vSmart. The router advertises its local LAN subnets, TLOCs, and IPsec keys, and receives fabric routes from vSmart.',
      callout: {
        type: 'warning',
        title: 'NTP Clock Synchronization: The #1 Onboarding Trap',
        text: 'Certificates have strict validity start and expiration dates. If a factory-default router boots up with an un-synchronized hardware clock (e.g., set to factory year 2018), certificate validation will fail instantly with "CERT_VALIDATE_ERR: certificate expired or not yet valid". NTP must be accessible and accurate on the underlay network before control connections can establish!',
      },
    },
    {
      id: 'sec-omp-and-tlocs',
      title: '5. Overlay Management Protocol (OMP) & TLOC Mechanics',
      contentMarkdown:
        '**Overlay Management Protocol (OMP)** is the Cisco proprietary control protocol that runs inside the DTLS/TLS control connections between WAN Edges and vSmart controllers. It operates similarly to BGP EVPN / VPNv4, serving as the central route distributor for the entire fabric.\n\n### The Three Types of OMP Routes\n\n1. **OMP Routes (vRoutes):**\n   - Prefixes learned from customer LANs (connected subnets, OSPF, BGP, or static routes inside Service VPNs e.g., VPN 10).\n   - Advertised by WAN Edges to vSmart along with attributes such as VPN ID, Origin, TLOC, and Preference.\n\n2. **TLOCs (Transport Locations):**\n   - The next-hop attachment points that tie an OMP route to a physical underlay transport interface.\n   - A TLOC is uniquely identified by a **3-tuple**:\n     ```text\n     TLOC = ( System-IP, Color, Encapsulation )\n     ```\n     - **System IP:** A unique `/32` IPv4 address identifying the WAN Edge router across the fabric (analogous to a BGP Router ID).\n     - **Color:** An abstraction identifying the underlay transport type (e.g., `biz-internet`, `public-internet`, `mpls`, `metro-ethernet`, `lte`).\n     - **Encapsulation:** The tunnel encapsulation protocol, typically `IPsec` (or `GRE`).\n\n3. **Service Routes:**\n   - Advertises specialized network services available at a site (e.g., centralized firewall, intrusion prevention, cloud proxy).\n\n### Application-Aware Routing (AAR)\nWAN Edges do not rely on static routing metrics to choose between transports. Instead, **BFD probes** run continuously inside every IPsec tunnel between sites.\n\n- Cisco vManage defines centralized **AAR SLA Policies** (e.g., "VoIP SLA: Latency $\\le 100$ ms, Jitter $\\le 10$ ms, Loss $\\le 1\\%$").\n- If the primary `biz-internet` link suffers an underlay brownout (latency jumps to 180 ms), the WAN Edge automatically redirects voice traffic to the `mpls` TLOC in real time without dropping active phone calls!',
      callout: {
        type: 'pro_tip',
        title: 'TLOC Color Categories: Public vs. Private',
        text: 'Cisco SD-WAN divides colors into Public (e.g., biz-internet, public-internet) and Private (e.g., mpls, private1). By default, WAN Edges attempt to build IPsec tunnels only between matching colors, or use NAT traversal to connect across public colors. Private colors communicate using private IP addresses and assume no intermediate NAT.',
      },
    },
    {
      id: 'sec-worked-example-packet-walk',
      title: '6. End-to-End Worked Example: Tracing a Branch Packet Walk',
      contentMarkdown:
        'Let us trace a user packet traversing an active SD-WAN fabric from Branch 1 to the Corporate Data Center:\n\n### Scenario Topology\n- **Client:** `10.1.1.50` in Branch-1 LAN (Service VPN 10).\n- **Branch-1 cEdge:** System IP `10.255.0.1`, Site ID `100`, Dual-homed: `biz-internet` (Public IP `198.51.100.2`) and `mpls` (Private IP `10.100.1.2`).\n- **Data Center cEdge:** System IP `10.255.0.2`, Site ID `200`, Dual-homed: `biz-internet` (Public IP `203.0.113.10`) and `mpls` (Private IP `10.200.1.2`).\n- **Target Server:** Database server `10.2.2.10` in Data Center LAN (Service VPN 10).\n\n### Step-by-Step Packet Forwarding Lifecycle\n\n1. **Ingress at Branch-1 cEdge (Service VPN 10):**\n   The client sends a TCP packet to destination `10.2.2.10`. The packet arrives at Branch-1 cEdge on interface `GigabitEthernet0/0/2` configured in `vpn 10`.\n\n2. **FIB Lookup in Service VPN 10:**\n   Branch-1 cEdge consults its VPN 10 Forwarding Information Base (FIB). It matches an OMP route for `10.2.2.0/24` learned from vSmart. The route points to Next-Hop TLOC: `(10.255.0.2, mpls, IPsec)` and `(10.255.0.2, biz-internet, IPsec)`.\n\n3. **Application-Aware Routing SLA Selection:**\n   The router inspects the packet header (TCP port 1433 Database). The enterprise policy classifies this traffic under "Critical Data SLA" (Loss $< 1\\%$, Latency $< 50$ ms). Real-time BFD telemetry shows:\n   - `mpls` tunnel: Latency 22 ms, Loss 0% &rarr; **Meets SLA!**\n   - `biz-internet` tunnel: Latency 68 ms, Loss 0.4% &rarr; Violates Latency SLA.\n   Branch-1 cEdge selects the `mpls` TLOC.\n\n4. **IPsec Encapsulation in VPN 0 (Transport):**\n   Branch-1 cEdge wraps the inner client packet with an IPsec ESP header using the encryption key previously received from vSmart for Data Center cEdge. It prepends an outer IP header:\n   - **Outer Source IP:** `10.100.1.2` (Branch-1 MPLS interface in VPN 0)\n   - **Outer Destination IP:** `10.200.1.2` (Data Center MPLS interface)\n   - **Outer Protocol:** IPsec ESP (or UDP port 12346)\n\n5. **Underlay Transport Transit:**\n   The service provider MPLS network receives the outer packet. Underlay routers inspect **only** the outer header (`10.100.1.2` &rarr; `10.200.1.2`) and switch it across label-switched paths. The underlay provider has zero knowledge of client `10.1.1.50`, server `10.2.2.10`, or VPN 10.\n\n6. **Egress Decapsulation at Data Center cEdge:**\n   The packet arrives at Data Center cEdge on its MPLS WAN interface. The router looks up the Security Parameter Index (SPI) in its Security Association (SA) database, decrypts the ESP payload, and identifies that the inner packet belongs to **VPN 10**.\n\n7. **Delivery to Destination Server:**\n   Data Center cEdge forwards the unencrypted inner packet out its local LAN interface in VPN 10 directly to database server `10.2.2.10`.',
      callout: {
        type: 'pro_tip',
        title: 'Complete Tenant Isolation',
        text: 'Because VPN tags are carried inside the encrypted IPsec encapsulation, an enterprise can run overlapping subnets (e.g., two different partner companies both using 192.168.1.0/24 in different Service VPNs) without any routing collision or security leakage.',
      },
    },
    {
      id: 'sec-sdwan-troubleshooting-process',
      title: '7. Structured SD-WAN Troubleshooting & Diagnostics',
      contentMarkdown:
        'When diagnosing SD-WAN failures, senior engineers follow a rigorous 4-step diagnostic decision hierarchy:\n\n```text\n+--------------------------------------------------------------------------+\n| Step 1: Underlay Verification (VPN 0)                                    |\n| - Physical link status, IP address, default gateway, DNS resolution      |\n| - Ping/traceroute to vBond hostname and IP from VPN 0                    |\n+--------------------------------------------------------------------------+\n                                     |\n                                     v\n+--------------------------------------------------------------------------+\n| Step 2: Control Connections Verification                                 |\n| - CLI: "show control connections" and "show control local-properties"   |\n| - Check state: must be "up" to vBond, vManage, and vSmart                |\n| - Check certificates: "show certificate installed" & check clock (NTP)   |\n+--------------------------------------------------------------------------+\n                                     |\n                                     v\n+--------------------------------------------------------------------------+\n| Step 3: OMP Control Plane Verification                                   |\n| - CLI: "show omp peers" (must be "up" with vSmart)                       |\n| - CLI: "show omp routes" and "show omp tlocs"                            |\n| - Check route status: "C,I" (Chosen, Installed in FIB)                   |\n+--------------------------------------------------------------------------+\n                                     |\n                                     v\n+--------------------------------------------------------------------------+\n| Step 4: Data Plane & BFD Verification                                    |\n| - CLI: "show bfd sessions" (must be "up" between WAN Edges)              |\n| - CLI: "show ipsec outbound-connections" & inbound SAs                   |\n| - Check firewall drops on UDP ports 12346-13145                          |\n+--------------------------------------------------------------------------+\n```\n\n### Essential Cisco IOS-XE SD-WAN CLI Commands\n\n- `show control connections`: Displays all active DTLS/TLS control plane sessions to vBond, vManage, and vSmart, including state (`up`), SPI, and uptime.\n- `show control local-properties`: Displays local chassis ID, serial number, root CA certificate status, and system IP.\n- `show omp peers`: Displays OMP session status with vSmart controllers.\n- `show omp routes vpn <vpn-id>`: Displays prefixes advertised and received via OMP, indicating whether each route is selected as Best Path and installed in the FIB.\n- `show bfd sessions`: Displays live BFD probe status (latency, loss, uptime) between local and remote WAN Edge TLOCs.\n- `show app-route statistics`: Displays real-time latency, jitter, and loss measurements used by Application-Aware Routing policies.\n\n### Control Plane Failure vs. Data Plane Failure\n- **Control Plane Down (vSmart Disconnected):** If a WAN Edge loses its control connection to vSmart, existing IPsec data plane tunnels **do not immediately collapse**. Under the **SD-WAN Graceful Restart / OMP Hold-Down** timer (default 12 hours), the WAN Edge continues forwarding user data packets based on previously learned routes and encryption keys!\n- **Data Plane Down (BFD Down):** If `show control connections` is `up`, but `show bfd sessions` is `down` to a specific site, the issue is strictly in the data plane: an underlay firewall is blocking UDP IPsec ports (12346-13145) or the underlay transport path is severed.',
      callout: {
        type: 'warning',
        title: 'Diagnostic Golden Rule',
        text: 'Never jump into troubleshooting OMP routing policies before verifying that control connections to vSmart are in the "up" state in "show control connections". If control connections are down, OMP cannot run!',
      },
    },
    {
      id: 'sec-sdwan-recap-misconceptions',
      title: '8. Recap & Common Architectural Misconceptions',
      contentMarkdown:
        'Let us review the most prevalent misconceptions encountered on the CCNP ENCOR exam and in enterprise deployments:\n\n- **Misconception 1: "vSmart is a centralized data router."**\n  *Reality:* vSmart is strictly in the control plane. User packets never pass through vSmart. User traffic flows directly peer-to-peer between WAN Edge routers over IPsec tunnels.\n- **Misconception 2: "vBond maintains permanent control connections."**\n  *Reality:* vBond is an orchestrator and gatekeeper. The WAN Edge connects to vBond temporarily during bootup to authenticate and discover controller addresses, then tears down the connection once permanent DTLS connections to vManage and vSmart are established.\n- **Misconception 3: "WAN Edges negotiate IPsec using standard IKE Phase 1 and 2."**\n  *Reality:* Traditional pair-wise IKE negotiation does not scale to hundreds of branches. Cisco SD-WAN routers send their local public encryption keys to vSmart via OMP; vSmart securely reflects these keys to authorized peers, enabling full-mesh encryption without IKE overhead.\n- **Misconception 4: "Loss of control connections immediately drops user traffic."**\n  *Reality:* The data plane is decoupled from the control plane. If all vSmart controllers become temporarily unreachable, WAN Edges continue forwarding payload traffic across active IPsec tunnels using cached routing tables and encryption keys during the graceful restart period.',
    },
  ],
  predictExercise: {
    id: 'ex-sdwan-planes-mc',
    lessonId: 'lesson-sd-wan-architecture',
    type: 'multiple_choice',
    title: 'SD-WAN Architectural Planes: Controller Responsibilities',
    prompt:
      'In the Cisco SD-WAN architecture, which controller component resides strictly in the Control Plane, terminates Overlay Management Protocol (OMP) peering sessions with WAN Edge routers, and distributes routing policies and security keys without ever inspecting or forwarding user data packets?',
    learningObjective:
      'Distinguish the strict separation between the Orchestration, Management, Control, and Data planes in Cisco SD-WAN.',
    scenarioContext:
      'An enterprise is deploying a new SD-WAN fabric and must configure controller roles and firewall permissions between administrative planes.',
    options: [
      {
        id: 'opt-vsmart',
        label: 'Cisco vSmart Controller',
        isCorrect: true,
        explanation:
          'The Cisco vSmart Controller resides strictly in the Control Plane. It runs the Overlay Management Protocol (OMP), calculates routing paths, enforces centralized control and data policies, and distributes symmetric encryption keys to WAN Edges. It never participates in the data forwarding path.',
      },
      {
        id: 'opt-vbond',
        label: 'Cisco vBond Orchestrator',
        isCorrect: false,
        explanation:
          'Cisco vBond belongs to the Orchestration Plane, not the Control Plane. It serves as the initial rendezvous point for device authentication, whitelist verification, and NAT traversal (STUN).',
      },
      {
        id: 'opt-vmanage',
        label: 'Cisco vManage NMS',
        isCorrect: false,
        explanation:
          'Cisco vManage belongs to the Management Plane. It provides the centralized GUI dashboard, configuration templates, software upgrades, and analytics.',
      },
      {
        id: 'opt-vedge',
        label: 'Cisco WAN Edge (cEdge / vEdge)',
        isCorrect: false,
        explanation:
          'WAN Edge routers belong to the Data Plane (forwarding IPsec traffic) and provide local control plane termination for LAN routing protocols.',
      },
    ],
    hints: [
      'Think about which component is described as the "brain" of the SD-WAN fabric that exchanges OMP updates.',
      'This component never sees or forwards customer payload packets, but tells WAN Edges how to build IPsec tunnels.',
    ],
    explanation:
      'Cisco vSmart is the centralized Control Plane controller in SD-WAN. It establishes secure DTLS/TLS control connections with WAN Edges to exchange OMP routes, TLOCs, and security keys. It acts as the routing brain while remaining completely decoupled from user data forwarding.',
    commonMistakes: [
      {
        mistake: 'vManage is the control plane',
        explanation:
          'vManage is the centralized Management Plane (GUI, templates, monitoring); it does not compute routing tables or exchange OMP routes with WAN Edges.',
      },
      {
        mistake: 'vSmart forwards user packets',
        explanation:
          'vSmart never forwards data packets; user packets flow directly peer-to-peer between WAN Edge routers across IPsec tunnels.',
      },
    ],
    practicalTakeaway:
      'Remember the four planes: vManage = Management, vBond = Orchestration, vSmart = Control, WAN Edge = Data.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-sdwan-onboarding-seq',
    lessonId: 'lesson-sd-wan-architecture',
    type: 'sequence',
    title: 'WAN Edge Zero-Touch Onboarding: Workflow Ordering',
    prompt:
      'Arrange the primary stages of the Cisco SD-WAN WAN Edge device onboarding and control-connection establishment process into chronological order.',
    learningObjective:
      'Trace the complete onboarding sequence from initial physical bootup to active OMP route exchange.',
    scenarioContext:
      'A field engineer powers on a factory-default Catalyst 8300 router at a branch office connected to broadband internet.',
    sequenceItems: [
      {
        id: 'step-ip-dhcp',
        text: '1. Acquire IP address, default gateway, and DNS server via DHCP on underlay interface in VPN 0',
        correctIndex: 0,
      },
      {
        id: 'step-vbond-contact',
        text: '2. Resolve DNS for vBond Orchestrator and initiate initial transient DTLS connection on UDP 12346',
        correctIndex: 1,
      },
      {
        id: 'step-cert-auth',
        text: '3. Mutual x.509 certificate authentication and Serial Number verification against authorized whitelist',
        correctIndex: 2,
      },
      {
        id: 'step-controller-list',
        text: '4. Receive IP addresses of assigned vManage and vSmart controllers from vBond (with STUN NAT discovery)',
        correctIndex: 3,
      },
      {
        id: 'step-dtls-permanent',
        text: '5. Tear down vBond link and establish permanent DTLS/TLS control connections to vManage and vSmart',
        correctIndex: 4,
      },
      {
        id: 'step-omp-exchange',
        text: '6. Establish OMP session with vSmart to exchange vRoutes, TLOCs, encryption keys, and policies',
        correctIndex: 5,
      },
    ],
    hints: [
      'The device must first acquire an IP address and resolve DNS before it can contact any controller.',
      'vBond is always the initial point of contact for authentication before the router ever connects to vManage or vSmart.',
      'OMP routing exchange is the final step, occurring only after permanent DTLS/TLS control connections are established with vSmart.',
    ],
    explanation:
      'Onboarding begins with IP and DNS acquisition on the underlay in VPN 0. The router contacts vBond for mutual certificate and whitelist verification. vBond provides the IP addresses of vManage and vSmart. The router then establishes permanent DTLS/TLS control connections to vManage and vSmart, culminating in OMP route and key exchange.',
    practicalTakeaway:
      'vBond is a gatekeeper, not a permanent peer. Once it validates certificates and shares controller IPs, the router transitions to permanent connections with vManage and vSmart.',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-sdwan-planes-mc',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'multiple_choice',
      title: 'SD-WAN Architectural Planes: Controller Responsibilities',
      prompt:
        'In the Cisco SD-WAN architecture, which controller component resides strictly in the Control Plane, terminates Overlay Management Protocol (OMP) peering sessions with WAN Edge routers, and distributes routing policies and security keys without ever inspecting or forwarding user data packets?',
      learningObjective:
        'Distinguish the strict separation between the Orchestration, Management, Control, and Data planes in Cisco SD-WAN.',
      scenarioContext:
        'An enterprise is deploying a new SD-WAN fabric and must configure controller roles and firewall permissions between administrative planes.',
      options: [
        {
          id: 'opt-vsmart',
          label: 'Cisco vSmart Controller',
          isCorrect: true,
          explanation:
            'The Cisco vSmart Controller resides strictly in the Control Plane. It runs the Overlay Management Protocol (OMP), calculates routing paths, enforces centralized control and data policies, and distributes symmetric encryption keys to WAN Edges. It never participates in the data forwarding path.',
        },
        {
          id: 'opt-vbond',
          label: 'Cisco vBond Orchestrator',
          isCorrect: false,
          explanation:
            'Cisco vBond belongs to the Orchestration Plane, not the Control Plane. It serves as the initial rendezvous point for device authentication, whitelist verification, and NAT traversal (STUN).',
        },
        {
          id: 'opt-vmanage',
          label: 'Cisco vManage NMS',
          isCorrect: false,
          explanation:
            'Cisco vManage belongs to the Management Plane. It provides the centralized GUI dashboard, configuration templates, software upgrades, and analytics.',
        },
        {
          id: 'opt-vedge',
          label: 'Cisco WAN Edge (cEdge / vEdge)',
          isCorrect: false,
          explanation:
            'WAN Edge routers belong to the Data Plane (forwarding IPsec traffic) and provide local control plane termination for LAN routing protocols.',
        },
      ],
      hints: [
        'Think about which component is described as the "brain" of the SD-WAN fabric that exchanges OMP updates.',
        'This component never sees or forwards customer payload packets, but tells WAN Edges how to build IPsec tunnels.',
      ],
      explanation:
        'Cisco vSmart is the centralized Control Plane controller in SD-WAN. It establishes secure DTLS/TLS control connections with WAN Edges to exchange OMP routes, TLOCs, and security keys. It acts as the routing brain while remaining completely decoupled from user data forwarding.',
      commonMistakes: [
        {
          mistake: 'vManage is the control plane',
          explanation:
            'vManage is the centralized Management Plane (GUI, templates, monitoring); it does not compute routing tables or exchange OMP routes with WAN Edges.',
        },
        {
          mistake: 'vSmart forwards user packets',
          explanation:
            'vSmart never forwards data packets; user packets flow directly peer-to-peer between WAN Edge routers across IPsec tunnels.',
        },
      ],
      practicalTakeaway:
        'Remember the four planes: vManage = Management, vBond = Orchestration, vSmart = Control, WAN Edge = Data.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-onboarding-seq',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'sequence',
      title: 'WAN Edge Zero-Touch Onboarding: Workflow Ordering',
      prompt:
        'Arrange the primary stages of the Cisco SD-WAN WAN Edge device onboarding and control-connection establishment process into chronological order.',
      learningObjective:
        'Trace the complete onboarding sequence from initial physical bootup to active OMP route exchange.',
      scenarioContext:
        'A field engineer powers on a factory-default Catalyst 8300 router at a branch office connected to broadband internet.',
      sequenceItems: [
        {
          id: 'step-ip-dhcp',
          text: '1. Acquire IP address, default gateway, and DNS server via DHCP on underlay interface in VPN 0',
          correctIndex: 0,
        },
        {
          id: 'step-vbond-contact',
          text: '2. Resolve DNS for vBond Orchestrator and initiate initial transient DTLS connection on UDP 12346',
          correctIndex: 1,
        },
        {
          id: 'step-cert-auth',
          text: '3. Mutual x.509 certificate authentication and Serial Number verification against authorized whitelist',
          correctIndex: 2,
        },
        {
          id: 'step-controller-list',
          text: '4. Receive IP addresses of assigned vManage and vSmart controllers from vBond (with STUN NAT discovery)',
          correctIndex: 3,
        },
        {
          id: 'step-dtls-permanent',
          text: '5. Tear down vBond link and establish permanent DTLS/TLS control connections to vManage and vSmart',
          correctIndex: 4,
        },
        {
          id: 'step-omp-exchange',
          text: '6. Establish OMP session with vSmart to exchange vRoutes, TLOCs, encryption keys, and policies',
          correctIndex: 5,
        },
      ],
      hints: [
        'The device must first acquire an IP address and resolve DNS before it can contact any controller.',
        'vBond is always the initial point of contact for authentication before the router ever connects to vManage or vSmart.',
        'OMP routing exchange is the final step, occurring only after permanent DTLS/TLS control connections are established with vSmart.',
      ],
      explanation:
        'Onboarding begins with IP and DNS acquisition on the underlay in VPN 0. The router contacts vBond for mutual certificate and whitelist verification. vBond provides the IP addresses of vManage and vSmart. The router then establishes permanent DTLS/TLS control connections to vManage and vSmart, culminating in OMP route and key exchange.',
      practicalTakeaway:
        'vBond is a gatekeeper, not a permanent peer. Once it validates certificates and shares controller IPs, the router transitions to permanent connections with vManage and vSmart.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-tloc-components-predict',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'predict_output',
      title: 'Overlay Management Protocol: TLOC 3-Tuple Identification',
      prompt:
        'In Cisco SD-WAN, a Transport Location (TLOC) represents an attachment point where a WAN Edge connects to the underlay transport network. Name the three mandatory parameters that uniquely identify a TLOC tuple (separated by commas).',
      learningObjective:
        'Identify the three foundational components of a Cisco SD-WAN TLOC: System IP, Color, and Encapsulation.',
      scenarioContext:
        'An engineer is verifying OMP route next-hops in "show omp tlocs" and analyzing how edge routers advertise their attachment points.',
      textAnswerPattern: '^(system[ -]?ip)[,\\s]+(color)[,\\s]+(encapsulation|encap)$',
      acceptableAnswers: [
        'System IP, Color, Encapsulation',
        'System-IP, Color, Encapsulation',
        'System IP, Color, Encap',
        'system ip, color, encapsulation',
      ],
      hints: [
        'One parameter is an IP address that uniquely identifies the router across the fabric (like a router ID).',
        'Another parameter is a human-readable tag identifying the transport network (e.g., mpls, biz-internet).',
        'The third parameter specifies the tunneling protocol used for data encryption (e.g., IPsec).',
      ],
      explanation:
        'A TLOC (Transport Location) is the next-hop attribute in Cisco SD-WAN. It is strictly defined as a 3-tuple: (System IP, Color, Encapsulation). For example: (10.255.0.1, biz-internet, IPsec).',
      commonMistakes: [
        {
          mistake: 'IP, Port, Protocol',
          explanation:
            'In Cisco SD-WAN, TLOCs are formally defined by System IP, Color, and Encapsulation, not by layer 4 transport port numbers.',
        },
      ],
      practicalTakeaway:
        'Every OMP route resolves to a TLOC 3-tuple. If a WAN Edge cannot build an IPsec tunnel to a destination TLOC, routes pointing to that TLOC become unreachable.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-troubleshoot-vbond-fail',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'troubleshooting',
      title: 'Control Plane Troubleshooting: Failed vBond Validation',
      prompt:
        'A newly installed WAN Edge router at a remote site fails to join the SD-WAN fabric. Running "show control connections" displays zero active sessions. The router console logs:\n\n%VBG-3-CERT_ERR: Certificate validation failed: certificate expired or not yet valid\n\nA ping to the vBond public IP address succeeds, and DNS resolves correctly. What is the root cause of this failure, and how should it be remediated?',
      learningObjective:
        'Diagnose x.509 certificate validation failures caused by clock skew and un-synchronized NTP time during onboarding.',
      scenarioContext:
        'A brand-new router unboxed from storage is powered on with factory-default system time.',
      options: [
        {
          id: 'opt-ntp-clock-skew',
          label:
            'The router system clock is out of synchronization (NTP failure), causing the x.509 certificate validity dates to be rejected. Configure NTP or manually set the clock.',
          isCorrect: true,
          explanation:
            'Public key certificates have strict "Not Before" and "Not After" validity timestamps. If a factory-default router boots up with an un-synchronized hardware clock (e.g., year 2018 or 1970), certificate validation fails with "certificate expired or not yet valid". Establishing accurate NTP time on VPN 0 immediately resolves the issue.',
        },
        {
          id: 'opt-wrong-vpn',
          label:
            'The WAN interface was accidentally assigned to VPN 512 instead of VPN 0.',
          isCorrect: false,
          explanation:
            'If the WAN interface were in VPN 512, DNS and ping to the vBond public IP would fail entirely. The log explicitly confirms certificate date validation failure.',
        },
        {
          id: 'opt-firewall-dtls',
          label:
            'An underlay firewall is blocking DTLS UDP port 12346 to the vBond orchestrator.',
          isCorrect: false,
          explanation:
            'If UDP 12346 were blocked, packets would be silently dropped with a connection timeout error, not an explicit TLS/DTLS certificate validation alert.',
        },
        {
          id: 'opt-omp-disabled',
          label:
            'The OMP process was disabled in global configuration.',
          isCorrect: false,
          explanation:
            'OMP only runs after control connections to vSmart are established. The router is failing at the initial vBond authentication stage.',
        },
      ],
      hints: [
        'Notice the specific error string: "certificate expired or not yet valid".',
        'What system service determines whether a certificate\'s activation or expiration date is valid right now?',
      ],
      explanation:
        'Certificate validation strictly requires accurate system time. If a device has clock skew outside the certificate validity window, mutual authentication fails. Configuring NTP or setting the clock via "clock set" allows certificate validation to proceed.',
      commonMistakes: [
        {
          mistake: 'Assuming the certificate file is permanently corrupted',
          explanation:
            'In over 90% of initial onboarding cases, "not yet valid" indicates a default factory clock setting (e.g., Jan 1 2018), not a corrupted certificate.',
        },
      ],
      practicalTakeaway:
        'Always verify the system clock using "show clock" whenever encountering control connection authentication failures.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-control-vs-data-plane',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'multiple_choice',
      title: 'Plane Separation: Data Plane Behavior During Control Outage',
      prompt:
        'A regional power disruption causes all central vSmart controllers in an enterprise to become temporarily unreachable from Branch-1. Running "show control connections" on Branch-1 cEdge shows zero established control sessions. However, the physical underlay transport links between Branch-1 and the Corporate Data Center remain operational. What happens to existing user voice and data sessions between Branch-1 and the Data Center during the SD-WAN Graceful Restart period?',
      learningObjective:
        'Explain the decoupling of the Control Plane and Data Plane and how SD-WAN Graceful Restart preserves forwarding.',
      scenarioContext:
        'A network engineer is evaluating high-availability resilience during an emergency controller maintenance window.',
      options: [
        {
          id: 'opt-traffic-continues',
          label:
            'User traffic continues forwarding uninterrupted across established IPsec tunnels because data plane forwarding is decoupled from control plane reachability.',
          isCorrect: true,
          explanation:
            'In Cisco SD-WAN, the control plane is strictly separated from the data plane. WAN Edges program their local FIB with OMP routes and IPsec keys received from vSmart. If vSmart goes down, WAN Edges enter Graceful Restart (default 12 hours) and continue forwarding payload traffic over active BFD-monitored IPsec tunnels without dropping packets.',
        },
        {
          id: 'opt-traffic-drops-immediately',
          label:
            'All data traffic immediately drops because WAN Edges require per-packet forwarding approval from vSmart.',
          isCorrect: false,
          explanation:
            'vSmart is not an in-line packet gateway; WAN Edges do not query vSmart per-packet. Data plane forwarding is autonomous once programmed.',
        },
        {
          id: 'opt-reroute-vbond',
          label:
            'User traffic is automatically rerouted through the vBond Orchestrator as a backup data plane transit gateway.',
          isCorrect: false,
          explanation:
            'vBond is strictly an orchestration and authentication server. It has zero capability to forward user data plane traffic.',
        },
        {
          id: 'opt-switch-unencrypted',
          label:
            'IPsec tunnels collapse and the routers fallback to unencrypted plain-text underlay routing.',
          isCorrect: false,
          explanation:
            'WAN Edges never transmit private service VPN traffic unencrypted over public underlays. Existing IPsec SAs remain active.',
        },
      ],
      hints: [
        'Does the vSmart controller sit in the path of actual customer data packets?',
        'Recall what happens to a traditional router when its BGP peer goes down with Graceful Restart enabled.',
      ],
      explanation:
        'The primary advantage of software-defined networking is control and data plane decoupling. WAN Edges cache OMP routing tables and IPsec security keys locally. A temporary loss of vSmart control connections does not impact user payload forwarding as long as underlay connectivity and BFD sessions remain active.',
      commonMistakes: [
        {
          mistake: 'Assuming vSmart outage halts all user traffic immediately',
          explanation:
            'Because data plane tunnels terminate directly between edge routers, the data plane remains fully operational during controller outages.',
        },
      ],
      practicalTakeaway:
        'vSmart outages prevent topology updates and new policy pushes, but existing data forwarding continues uninterrupted.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-underlay-firewall-tb',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'troubleshooting',
      title: 'Data Plane Diagnostics: Control Up but BFD Sessions Down',
      prompt:
        'On Branch-1 cEdge, "show control connections" confirms that permanent DTLS connections to vManage and vSmart are in the "up" state. However, users at Branch-1 report that all connectivity to Branch-2 is down. Running "show bfd sessions" reveals that all BFD sessions to Branch-2\'s TLOCs are in the "down" state. What is the most probable root cause?',
      learningObjective:
        'Distinguish control-plane DTLS/TLS connectivity from data-plane IPsec UDP port reachability across intermediate firewalls.',
      scenarioContext:
        'A newly activated broadband circuit has a perimeter firewall between the branch edge router and the Internet service provider.',
      options: [
        {
          id: 'opt-udp-ipsec-blocked',
          label:
            'An intermediate underlay firewall or ISP is blocking the UDP ports (default UDP 12346 to 13145) used for IPsec data plane traffic between edge routers.',
          isCorrect: true,
          explanation:
            'Control connections to vSmart/vManage succeed because outbound DTLS/TLS ports to the controllers are permitted. However, SD-WAN data plane IPsec tunnels communicate peer-to-peer between WAN Edges using UDP ports 12346 (or 12366-12426). If an underlay perimeter firewall blocks these UDP ports, BFD sessions cannot establish and user data cannot pass.',
        },
        {
          id: 'opt-vsmart-policy-bad',
          label:
            'The vSmart controller has rejected Branch-1\'s OMP routes due to an invalid route-map.',
          isCorrect: false,
          explanation:
            'BFD sessions establish between TLOCs regardless of whether user routes exist. BFD measures tunnel health, not route policy acceptance.',
        },
        {
          id: 'opt-vbond-down',
          label:
            'The vBond Orchestrator has crashed and failed over to standby.',
          isCorrect: false,
          explanation:
            'vBond is not involved in data plane forwarding or active BFD session maintenance once edge devices are onboarded.',
        },
        {
          id: 'opt-management-vpn-down',
          label:
            'The out-of-band management interface in VPN 512 is shut down.',
          isCorrect: false,
          explanation:
            'VPN 512 is strictly for management access and has zero impact on user data plane IPsec tunnels or BFD probes.',
        },
      ],
      hints: [
        'Notice that control connections to the cloud controllers are healthy ("up").',
        'Which protocol and ports do WAN Edge routers use to communicate directly with each other for IPsec data traffic?',
      ],
      explanation:
        'Cisco SD-WAN data plane tunnels encapsulate IPsec ESP inside UDP ports starting at 12346. When control connections are up but BFD sessions are down between two specific edges, an intermediate underlay firewall is almost always dropping the UDP IPsec data ports.',
      commonMistakes: [
        {
          mistake: 'Confusing control plane ports with data plane ports',
          explanation:
            'Control connections use DTLS/TLS to the controllers, whereas data plane tunnels use UDP 12346-13145 peer-to-peer between WAN Edges.',
        },
      ],
      practicalTakeaway:
        'When troubleshooting SD-WAN, always check "show control connections" first (control plane), then "show bfd sessions" second (data plane).',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-sdwan-aar-sla-numerical',
      lessonId: 'lesson-sd-wan-architecture',
      type: 'numerical',
      title: 'Application-Aware Routing: SLA Latency Threshold Calculation',
      prompt:
        'An enterprise configures an Application-Aware Routing (AAR) SLA policy for real-time video conferencing requiring a maximum one-way latency of 100 ms and maximum packet loss of 1%. Currently, the primary MPLS transport path measures a baseline latency of 82 ms and 0.1% loss. What is the maximum additional latency increase (in milliseconds) the MPLS path can experience before the AAR policy declares an SLA violation and steers video traffic to an alternate transport?',
      learningObjective:
        'Calculate Application-Aware Routing SLA compliance thresholds based on real-time BFD probe telemetry.',
      scenarioContext:
        'A network engineer is tuning BFD multiplier timers and testing failover thresholds for mission-critical video streams.',
      numericAnswer: 18,
      numericTolerance: 0,
      hints: [
        'The SLA maximum threshold is 100 ms.',
        'The current measured baseline latency is 82 ms.',
        'Calculate the difference between the maximum threshold and the current baseline.',
      ],
      explanation:
        'The SLA threshold is set at 100 ms maximum latency. With the current baseline at 82 ms, the link can experience at most 100 - 82 = 18 ms of additional latency before exceeding the 100 ms threshold and triggering an AAR path failover.',
      practicalTakeaway:
        'Application-Aware Routing evaluates BFD metrics against configured SLA thresholds. Once an SLA parameter is breached, traffic is dynamically shifted to an alternate TLOC that satisfies the SLA.',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'Cisco SD-WAN Design Guide (CVD)',
      url: 'https://www.cisco.com/c/en/us/td/docs/solutions/CVD/SDWAN/cisco-sdwan-design-guide.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Cisco SD-WAN Architecture & Components',
    },
    {
      title: 'Cisco SD-WAN Controller Certificates and Onboarding',
      url: 'https://www.cisco.com/c/en/us/support/docs/routers/sd-wan/214508-cisco-sd-wan-overlay-network-bring-up.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Control Connection Bringup & Certificate Validation',
    },
  ],
};
