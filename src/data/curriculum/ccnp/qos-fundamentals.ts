import type { DetailedLesson } from '../../../types/curriculum.js';

export const lessonQosFundamentals: DetailedLesson = {
  id: 'lesson-qos-fundamentals',
  topicId: 'topic-qos',
  pathId: 'path-ccnp',
  slug: 'qos-fundamentals-and-troubleshooting',
  title: 'QoS Fundamentals & Troubleshooting: Classification, Marking, Conditioning & Queueing',
  subtitle:
    'Bandwidth, Delay, Jitter, Packet Loss, CoS/DSCP Mapping, Trust Boundaries, Token-Bucket Conditioning, LLQ/CBWFQ, and WRED Diagnostics.',
  difficulty: 'CCNP Enterprise',
  estimatedMinutes: 45,
  learningObjectives: [
    'Analyze the four primary network degradation factors—bandwidth, delay, jitter, and packet loss—and evaluate their impact against ITU-T G.114 real-time application SLAs.',
    'Differentiate Layer 2 Class of Service (802.1p CoS), Layer 3 IP Precedence (IPP), and Differentiated Services Code Point (DSCP, RFC 2474), including Class Selector (CS) and Assured Forwarding (AFxy) mathematical and binary mappings.',
    'Establish enterprise trust boundaries, contrasting access-layer ingress classification and marking against core transit forwarding based on DSCP.',
    'Differentiate traffic policing from traffic shaping, calculating Single-Rate Two-Color and Dual-Rate Three-Color token-bucket parameters (Bc, Be, Tc, CIR, PIR) and assessing queuing delay impacts.',
    'Compare hardware transmit rings (Tx-ring) against software queuing algorithms (FIFO, PQ, WFQ, CBWFQ, and Low Latency Queuing / LLQ).',
    'Explain why the strict priority queue in LLQ incorporates an automatic admission-control policer during interface congestion to prevent fair-queue starvation.',
    'Diagnose congestion avoidance failure modes, including TCP global synchronization and tail drop, and configure Weighted Random Early Detection (WRED) profiles across DSCP drop precedences.',
    'Architect and implement end-to-end Cisco Modular QoS CLI (MQC) policies across class maps (match-any vs. match-all), policy maps, and interface service policies.',
    'Execute systematic CLI troubleshooting using show policy-map interface to isolate priority queue drops, classification misses, and token-bucket exhaustion during link congestion.',
  ],
  sections: [
    {
      id: 'sec-qos-why-needed-four-degradations',
      title: '1. Why QoS is Needed: The Four Network Degradations & Real-Time SLAs',
      contentMarkdown: `### The Fundamental Premise of Quality of Service

Quality of Service (QoS) does **not** create physical bandwidth. A congested 10 Mbps serial or sub-rate Ethernet circuit will never magically forward 15 Mbps of payload. Instead, QoS is the systematic **allocation, scheduling, and conditioning of finite network resources during contention**. When traffic demand exceeds available link capacity, QoS determines which packets are forwarded immediately, which packets are temporarily delayed in buffers, and which packets are discarded.

In an unmanaged best-effort network, routers treat every packet identically using First-In, First-Out (FIFO) queueing. High-volume bulk TCP transfers (such as operating system updates or file synchronization) naturally flood interface buffers, inflicting high latency, jitter, and dropped frames on time-sensitive enterprise traffic.

---

### The Four Network Degradation Factors

Network performance degradation manifests in four distinct physical and queuing phenomena:

\`\`\`text
+-------------------+-------------------------------------------------------------+---------------------------------------+
| Degradation       | Physical Root Cause                                         | Primary Impacted Applications         |
+-------------------+-------------------------------------------------------------+---------------------------------------+
| 1. Bandwidth      | Insufficient raw throughput (bps) across the slowest hop    | Large file transfers, backups, images |
| 2. Delay (Latency)| End-to-end transit duration between sender and receiver     | Real-time voice, video conferencing   |
| 3. Jitter         | Statistical variance in packet arrival intervals            | Voice de-jitter buffers, live stream  |
| 4. Packet Loss    | Buffer overflow (tail drop) or active queue management drops| Voice intelligibility, TCP goodput    |
+-------------------+-------------------------------------------------------------+---------------------------------------+
\`\`\`

#### Deconstructing End-to-End Delay (Latency)
Total one-way latency is the aggregate sum of four discrete components:

\`\`\`text
Total Delay = Propagation Delay + Serialization Delay + Processing Delay + Queuing Delay
\`\`\`

1. **Propagation Delay:** The time required for electromagnetic signals to travel through the physical transmission medium (copper cable or optical fiber). Light travels through silica fiber at approximately 200,000 km/s (roughly 5 microseconds per kilometer). This delay is bound by physics and **cannot be altered by QoS configuration**.
2. **Serialization Delay:** The time required to clock an entire frame onto the physical wire, calculated as:

\`\`\`text
Serialization Delay = Frame Size (bits) / Link Clock Rate (bps)
\`\`\`

   A 1,500-byte (12,000 bits) data frame on a 1.544 Mbps (T1) circuit requires 7.77 ms just to clock onto the line. On a 1 Gbps interface, serialization takes only 0.012 ms.
3. **Processing Delay:** The time required by a router's ASIC, network processor, or CPU to examine packet headers, perform routing table lookups, evaluate ACLs, and rewrite Layer 2 headers. In modern hardware platforms, this is deterministic and typically sub-millisecond.
4. **Queuing Delay:** The time a packet waits inside hardware rings or Layer 3 software queues before reaching the head-of-line position for transmission. **Queuing delay is completely dynamic and represents the primary variable targeted and managed by QoS scheduling engines.**

---

### Jitter and the De-Jitter Buffer

**Jitter** is the mathematical variance in one-way packet arrival intervals. When a voice codec emits audio packets at fixed 20 ms intervals, variable queuing delay across intermediate transit routers causes those packets to arrive at intervals such as 14 ms, 28 ms, or 45 ms.

Real-time media endpoints utilize an internal **De-Jitter Buffer** to restore an even playback cadence. Arriving packets are held briefly before playout:
- If jitter is low, the buffer smoothly empties at a constant rate.
- If jitter exceeds the maximum de-jitter buffer window, late packets arrive **after** their scheduled playout timestamp and are discarded as completely lost, creating audible audio clicks and robotic speech.

---

### Real-Time Application Tolerances (ITU-T G.114)

The International Telecommunication Union (ITU-T G.114) and enterprise engineering baselines establish strict parameters for toll-quality voice and video:

| Performance Metric | Toll-Quality Voice (VoIP) | Interactive Video | Critical Business Data |
| :--- | :--- | :--- | :--- |
| **One-Way Latency** | ≤ 150 ms | ≤ 200 ms | ≤ 1,000 ms |
| **Jitter (Variation)** | ≤ 30 ms | ≤ 30 ms | Not sensitive |
| **Packet Loss** | ≤ 1% (ideal < 0.25%) | ≤ 0.5% - 1% | 0% (handled by TCP) |
| **Bandwidth** | 64 kbps (G.711) + L2/L3/RTP headers ≈ 87.2 kbps | 384 kbps - 20 Mbps | Bursty / elastic |`,
      callout: {
        type: 'rfc',
        title: 'ITU-T Recommendation G.114: One-Way Transmission Time',
        text: 'ITU-T G.114 defines 150 ms one-way end-to-end latency as the international limit for high-quality conversational speech. Beyond 150 ms, speakers begin involuntarily talking over one another, while beyond 400 ms communication becomes severely impaired.',
      },
    },
    {
      id: 'sec-qos-classification-marking-dscp-cos',
      title: '2. Classification and Marking: CoS, IP Precedence, and DSCP',
      contentMarkdown: `### The Two Foundations of QoS: Identification & Encoding

Before any router can apply specialized queuing or conditioning, it must complete two distinct actions:
1. **Classification:** Inspecting arriving frames to determine which traffic class they belong to (e.g. voice payload, call control, SAP database, or bulk web browsing).
2. **Marking:** Writing a standardized QoS priority value directly into the packet header so that downstream network hops do not need to re-evaluate expensive classification logic.

Marking occurs at different layers of the OSI model depending on the physical medium.

---

### Layer 2 Marking: IEEE 802.1Q Class of Service (CoS)

In Ethernet networks, Layer 2 frames only carry QoS markings when an **IEEE 802.1Q VLAN tag** is present (such as on 802.1Q trunk links or tagged access ports connecting IP phones).

\`\`\`text
IEEE 802.1Q Ethernet Frame Tag:
+-------------------+-------------------+-------------------+-------------------+
| EtherType 0x8100  | Priority Code (3b)| DEI / CFI (1b)    | VLAN ID (12 bits) |
| (16 bits)         | (802.1p CoS 0-7)  | (1 bit)           | (1-4094)          |
+-------------------+-------------------+-------------------+-------------------+
\`\`\`

- The 3-bit **Priority Code Point (PCP)** field provides $2^3 = 8$ distinct priority values ($0$ through $7$).
- **Architectural Limitation:** When a frame traverses a Layer 3 routed boundary, the router terminates the incoming Layer 2 Ethernet frame, strips the 802.1Q tag, and builds a new Layer 2 frame on the outgoing interface. **Layer 2 CoS markings are destroyed at every routed hop unless explicitly mapped into Layer 3 IP headers.**

---

### Layer 3 Marking: The Evolution from IP Precedence to DSCP

Layer 3 markings reside inside the IP header, guaranteeing that QoS metadata survives across all intermediate routers from end to end.

\`\`\`text
Legacy IPv4 ToS Byte (RFC 791):
+-------------------------------+-------------------------------+---+
| IP Precedence (Bits 0-2)      | Type of Service (Bits 3-6)    | 7 |
| (0-7, 3 bits)                 | Delay, Throughput, Reliability|MBZ|
+-------------------------------+-------------------------------+---+

Modern Differentiated Services Field (RFC 2474 / RFC 3168):
+-------------------------------------------------------+-----------+
| Differentiated Services Code Point (DSCP)             | ECN       |
| (Bits 0 - 5: 6 bits -> 64 code points, 0 - 63)        | (Bits 6-7)|
+-------------------------------------------------------+-----------+
\`\`\`

1. **Legacy IP Precedence (IPP):** Uses the 3 most significant bits of the IPv4 Type of Service (ToS) byte, providing 8 priority levels (0 through 7).
2. **Modern DSCP (RFC 2474):** Repurposes the first 6 bits of the IPv4 ToS byte (or IPv6 Traffic Class byte), expanding the priority spectrum to $2^6 = 64$ unique code points (decimal $0$ through $63$).
3. **Explicit Congestion Notification (ECN, RFC 3168):** Uses the last 2 bits of the byte to signal congestion without dropping packets.

---

### DiffServ Per-Hop Behaviors (PHBs)

The IETF DiffServ working group defined standard code points and corresponding router forwarding treatments called **Per-Hop Behaviors (PHBs)**:

#### 1. Default Forwarding (DF)
- Binary \`000000\` = Decimal **0** (\`CS0\`). Best-effort delivery with no guarantees.

#### 2. Class Selector (CS) Codepoints
- For full backward compatibility with legacy IP Precedence, DiffServ defines 8 Class Selector code points where the last 3 bits are \`000\` (Binary \`xxx000\`):
  **DSCP Decimal = 8 × IP Precedence**
- Examples: \`CS1\` = 8, \`CS3\` = 24 (Call Signaling), \`CS5\` = 40 (Broadcast Video), \`CS6\` = 48 (Network Control / Routing Protocols).

#### 3. Assured Forwarding (AFxy, RFC 2597)
The AF standard defines 4 independent classes (x = 1, 2, 3, 4) and 3 drop precedences within each class (y = 1, 2, 3):

\`\`\`text
DSCP Decimal = 8x + 2y
\`\`\`

\`\`\`text
                    Class 1         Class 2         Class 3         Class 4
                 (Bulk / Best)   (Transactional)  (Call Signal)   (Interactive)
Low Drop   (y=1)  AF11 (10)       AF21 (18)       AF31 (26)       AF41 (34)
Med Drop   (y=2)  AF12 (12)       AF22 (20)       AF32 (28)       AF42 (36)
High Drop  (y=3)  AF13 (14)       AF23 (22)       AF33 (30)       AF43 (38)
\`\`\`

> **Crucial Operational Invariant:** Within any class $x$, **AFx1 packets are dropped LAST**, while **AFx3 packets are dropped FIRST** when buffer congestion occurs!

#### 4. Expedited Forwarding (EF, RFC 3246)
- Binary \`101110\` = Decimal **46**.
- Designed for low-loss, low-latency, low-jitter real-time voice bearer traffic (VoIP RTP audio). Routers forward EF traffic at a rate at least as high as configured, independent of other traffic.`,
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco IOS-XE Internal DSCP-to-CoS Mutation',
        text: 'When packets traverse internal switch fabrics, Cisco switches map DSCP to an internal QoS label. If an egress interface is an 802.1Q trunk, the switch must synthesize an 802.1p CoS value. By default, Cisco IOS-XE divides the DSCP value by 8 (taking the 3 most significant bits), which maps EF (46) to CoS 5, AF31 (26) to CoS 3, and AF11 (10) to CoS 1.',
      },
    },
    {
      id: 'sec-qos-trust-boundaries-classification',
      title: '3. Trust Boundaries, Classification Strategies & Marking Policy',
      contentMarkdown: `### The Enterprise Trust Boundary

A fundamental tenet of network security and QoS architecture is the **Trust Boundary**. The trust boundary is the physical or logical perimeter edge where the network infrastructure decides whether to accept and trust existing QoS markings on incoming frames, or overwrite (remark) them to zero (Best Effort).

If an enterprise trusts all ingress traffic unconditionally, any user or malicious application on a desktop PC could mark bulk BitTorrent or YouTube streams as DSCP 46 (EF). Transit routers would then schedule those bulk downloads into the strict priority voice queue, completely obliterating real VoIP telephone calls across the enterprise!

\`\`\`text
                  [ Untrusted Domain ]               [ Trusted Domain ]
+------------+       Untrusted Data
| Desktop PC | -------------------------\\
+------------+                          \\
                                         +------------------+      +-------------------+
                                         | Cisco IP Phone   | ---> | Catalyst Access SW|
+---------------------+   Trusted VoIP   | (802.1Q Tagged)  |      | (Trust Boundary)  |
| VoIP Phone Core     | -----------------+------------------+      +-------------------+
+---------------------+
\`\`\`

---

### Trust Boundary Models

Enterprise architectures deploy three primary trust configurations at the access layer:

1. **Untrusted Access Port:**
   - Standard switchports connected to unmanaged user PCs, printers, or guest devices.
   - Any incoming 802.1p CoS or IP DSCP marking is unconditionally remarked to DSCP 0 (\`CS0\` Best Effort).
2. **Trusted Endpoint Port:**
   - Ports connected to trusted enterprise servers (e.g. VMware ESXi hosts, Microsoft Exchange, or database clusters) that enforce strict internal QoS tagging policies via Active Directory Group Policy (GPO).
   - Switchport command: \`trust dscp\` (or legacy \`mls qos trust dscp\`).
3. **Conditionally Trusted Port (Cisco IP Phone with PC Daisy-Chain):**
   - The switch detects an authenticated Cisco IP Phone via Cisco Discovery Protocol (CDP) or LLDP-MED.
   - The switch trusts CoS/DSCP markings originating from the telephone itself (CoS 5 / DSCP 46 for voice RTP; CoS 3 / DSCP 24 for call signaling).
   - Concurrently, the switch instructs the phone to strip or remark any markings originating from the PC attached to the phone's auxiliary PC data port.

---

### Cisco Access Switch Trust Configuration

In Cisco IOS-XE Modular QoS CLI (MQC), trust can be configured directly or dynamically via service policies:

\`\`\`cisco
! Modern Cisco IOS-XE interface-level trust:
interface GigabitEthernet1/0/5
 description Access Port with Cisco IP Phone & Workstation
 switchport mode access
 switchport access vlan 10
 switchport voice vlan 20
 trust device cisco-phone
 service-policy input ACCESS-IN-POLICY
!
! The access policy enforces trust on voice while remarking untrusted PC traffic:
policy-map ACCESS-IN-POLICY
 class VOICE-RTP
  set dscp ef
 class VOICE-SIGNALING
  set dscp cs3
 class class-default
  set dscp default
\`\`\`

---

### Ingress Classification Strategies: Access vs. Core

To maintain high forwarding performance across the network, QoS engineering follows the rule of **Ingress Classification**:

- **Access Layer (Mark Once at Ingress):** Perform comprehensive, granular classification as close to the source as possible. Access switches examine Layer 2 CoS, Layer 3 IP source/destination addresses, Layer 4 UDP/TCP port numbers, or Layer 7 deep packet payloads via **NBAR2 (Network-Based Application Recognition)**. Once classified, the packet is marked with the appropriate DSCP value.
- **Distribution and Core Layers (Forward on DSCP):** Core transit routers and high-speed backbones must never evaluate complex ACLs or run deep packet inspection! Instead, core routers inspect **only the 6-bit DSCP field** to immediately assign packets to their respective queuing classes.`,
      callout: {
        type: 'pro_tip',
        title: 'Pro Tip: Never Trust Client Operating Systems by Default',
        text: 'Operating systems such as Windows 11 and macOS allow user-space applications to request DSCP markings via socket APIs. Always enforce conditional trust or ingress ACL remarking at the access switchport. Only trust endpoints managed via enterprise MDM or Active Directory Group Policies that enforce verified DSCP policies.',
      },
    },
    {
      id: 'sec-qos-policing-vs-shaping-token-bucket',
      title: '4. Traffic Conditioning: Policing vs. Shaping & Token-Bucket Mechanics',
      contentMarkdown: `### The Core Dilemma: Mismatched Ingress and Egress Speeds

When a high-speed Gigabit Ethernet LAN interface feeds traffic into a lower-speed WAN circuit (e.g. a 50 Mbps sub-rate fiber link), traffic bursts will saturate the outbound link. **Traffic Conditioning** controls the rate of traffic entering or leaving a network device.

Traffic conditioning employs two fundamentally distinct operational tools: **Policing** and **Shaping**.

\`\`\`text
TRAFFIC POLICING (Drops or Remarks Peaks):
Input Rate:   |\\    /\\    /\\    /|
              | \\  /  \\  /  \\  / |
CIR Limit: ---+---/----+----+---/+--- [Traffic above CIR is DROPPED or REMARKED]
Output Rate:  |  /      \\  /     |     (NO buffering -> NO added delay/jitter)

TRAFFIC SHAPING (Buffers and Delays Peaks):
Input Rate:   |\\    /\\    /\\    /|
              | \\  /  \\  /  \\  / |
CIR Limit: ---+---/----+----+---/+--- [Traffic above CIR is STORED IN QUEUE]
Output Rate:  |------------------|     (Buffering smooths rate -> Introduces DELAY)
\`\`\`

---

### Policing vs. Shaping: Direct Comparison

| Feature | Traffic Policing | Traffic Shaping |
| :--- | :--- | :--- |
| **Primary Action** | **Drops** or **remarks** traffic exceeding rate limit | **Buffers** excess packets in software queues |
| **Delay & Jitter** | Introduces **zero** queuing delay or jitter | Introduces **variable delay and jitter** due to buffering |
| **Directionality** | Inbound (\`input\`) and Outbound (\`output\`) | **Outbound only** (\`output\`) |
| **Burst Smoothing** | Does not smooth traffic (creates rate cliffs) | Smooths traffic bursts into a continuous, uniform flow |
| **Mechanism** | Token Bucket (Single-Rate or Dual-Rate) | Token Bucket + Layer 3 Software Queues |
| **Typical Use Case**| ISP ingress enforcement; customer rate limiting | Enterprise WAN egress to prevent ISP policer drops |

---

### Token Bucket Fundamentals

Both policers and shapers utilize the mathematical abstraction of a **Token Bucket** to measure traffic rates.

Imagine a bucket with a fixed capacity of **Committed Burst (Bc)** tokens.
- Tokens are added into the bucket at a steady, continuous rate called the **Committed Information Rate (CIR)** in bits per second (bps).
- The bucket has a maximum capacity (Bc). Any tokens added when the bucket is full simply spill over and are lost.
- Each token represents permission to transmit a specific number of bits (or bytes).

#### The Timing Interval (Tc) Formula
In traffic shaping, the timing interval Tc is the frequency at which the token bucket is replenished with Bc tokens:

\`\`\`text
CIR = Bc / Tc   <===>   Tc = Bc / CIR
\`\`\`

*Example:* If a WAN shaper is configured for CIR = 10,000,000 bps (10 Mbps) and Bc = 125,000 bits, the time interval Tc is:

\`\`\`text
Tc = 125,000 bits / 10,000,000 bps = 0.0125 seconds = 12.5 ms
\`\`\`

Every 12.5 ms, the router deposits 125,000 bits of tokens into the shaping bucket.

---

### Single-Rate vs. Dual-Rate Policer Algorithms

RFC 2697 and RFC 2698 standardize formal token bucket implementations for policing:

1. **Single-Rate Two-Color Policer (1 Rate, 1 Bucket):**
   - Bucket capacity Bc, replenished at CIR.
   - When a packet of size S bits arrives:
     - If tokens in bucket ≥ S: **Conforming** (tokens decremented by S; packet forwarded).
     - If tokens in bucket < S: **Exceeding** (packet dropped or remarked).
2. **Single-Rate Three-Color Policer (srTCM, RFC 2697 - 1 Rate, 2 Buckets):**
   - Bucket 1 (Bc): Committed burst.
   - Bucket 2 (Be): Excess burst (overflow tokens from Bc collect here).
   - Packets are categorized as **Green** (Conform), **Yellow** (Exceed - e.g. remarked from AF31 to AF32), or **Red** (Violate - dropped).
3. **Dual-Rate Three-Color Policer (trTCM, RFC 2698 - 2 Rates, 2 Buckets):**
   - Rate 1: Committed Information Rate (CIR) with burst Bc.
   - Rate 2: Peak Information Rate (PIR) with peak burst Bp.
   - Allows sustained bursts up to PIR while enforcing strict drop actions above PIR.`,
      callout: {
        type: 'warning',
        title: 'Warning: The Danger of Bufferbloat in Traffic Shaping',
        text: 'While shaping prevents harsh packet drops by downstream carrier policers, misconfigured or oversized shaping queues cause "Bufferbloat." Interactive TCP connections and DNS queries trapped behind massive file uploads in deep shaping buffers experience latencies exceeding 2,000 ms, causing connection timeouts.',
      },
    },
    {
      id: 'sec-qos-congestion-management-queuing',
      title: '5. Congestion Management: Hardware Tx-Ring, CBWFQ and LLQ',
      contentMarkdown: `### The Queuing Architecture: Hardware Tx-Ring vs. Software Queues

A common misconception among network engineers is that QoS queuing algorithms (such as CBWFQ or LLQ) are active at all times. In reality, **QoS software queuing only activates when an interface is experiencing physical congestion!**

\`\`\`text
Packet Ingress
      |
      v
+-------------------------+
| Routing & Policy Lookup |
+-------------------------+
      |
      v
[ Is Hardware Tx-Ring Full? ]
      |
      +---> NO  ==> Bypasses all software queues; placed directly onto Hardware Tx-Ring!
      |
      +---> YES ==> Congestion! Packets diverted into Layer 3 Software Queuing Engine:
                     +---------------------------------------+
                     | Low Latency Queuing (LLQ / CBWFQ)     |
                     | [Priority Queue (Voice)]              |
                     | [Class Queue 1 (Critical Data)]       |
                     | [Class Queue 2 (Transactional Data)]  |
                     | [class-default (Best Effort)]         |
                     +---------------------------------------+
\`\`\`

1. **Hardware Transmit Ring (Tx-Ring):**
   - A fixed-size FIFO ring buffer in the network interface controller (NIC) ASIC.
   - When the Tx-Ring has empty slots, arriving packets bypass all software QoS schedulers and are immediately clocked onto the physical medium.
2. **Layer 3 Software Queues:**
   - When the physical interface cannot transmit fast enough, the hardware Tx-Ring fills up.
   - The driver halts direct delivery to the Tx-Ring and activates the configured software queuing discipline (such as MQC LLQ).
   - The scheduler dequeues packets from software queues and feeds them into the Tx-Ring as slots become available.

---

### The Evolution of Queuing Algorithms

Network engineering progressed through several scheduling architectures:

#### 1. First-In, First-Out (FIFO)
- Single queue; packets transmitted in exact arrival order. Zero differentiation.

#### 2. Priority Queuing (PQ)
- Four fixed priority queues: High, Medium, Normal, Low.
- A lower queue is **never** serviced as long as a single packet exists in a higher queue.
- **Fatal Flaw:** If the High queue is saturated by an aggressive sender, the Medium, Normal, and Low queues suffer **complete starvation**.

#### 3. Weighted Fair Queuing (WFQ)
- Automatically divides traffic into dynamic hash queues based on the 5-tuple flow (Source/Dest IP, Source/Dest Port, Protocol).
- Weights bandwidth inversely to IP Precedence.
- Cannot configure custom business classes or guarantee specific throughput to an application.

#### 4. Class-Based Weighted Fair Queuing (CBWFQ)
- Allows engineers to define custom business classes via MQC.
- Each class is assigned a minimum guaranteed bandwidth during congestion using the command \`bandwidth <kbps | percent>\`.
- Unused bandwidth is shared proportionally among active classes.
- **Limitation:** CBWFQ guarantees bandwidth but **does not guarantee latency**. Packets in CBWFQ queues may wait behind other packets in the same class queue, making it unsuitable for jitter-intolerant VoIP audio.

---

### Low Latency Queuing (LLQ): The Enterprise Standard

**Low Latency Queuing (LLQ)** represents the union of CBWFQ with one or more **Strict Priority Queues (PQ)**:

\`\`\`text
+--------------------------------------------------------------------------------+
|                        LOW LATENCY QUEUING (LLQ)                               |
|                                                                                |
|  +-------------------------------------+                                       |
|  | Strict Priority Queue (Voice RTP)   | ===> Dequeued FIRST whenever packets  |
|  | Configured: priority 512            |      are present!                     |
|  | Built-in Congestion Policer: 512k   |      (Policed at 512k during backlog) |
|  +-------------------------------------+                                       |
|                                                                                |
|  +-------------------------------------+                                       |
|  | CBWFQ Class 1 (Mission-Critical)    |                                       |
|  | Configured: bandwidth percent 30    | ===> Fairly scheduled via CBWFQ       |
|  +-------------------------------------+      whenever Priority Queue is empty |
|  +-------------------------------------+                                       |
|  | CBWFQ Class 2 (Business Data)       |                                       |
|  | Configured: bandwidth percent 20    |                                       |
|  +-------------------------------------+                                       |
|  +-------------------------------------+                                       |
|  | class-default (Best Effort Data)    |                                       |
|  +-------------------------------------+                                       |
+--------------------------------------------------------------------------------+
\`\`\`

---

### The LLQ Admission-Control Policer Invariant

Why doesn't LLQ suffer from the fatal starvation flaw of legacy Priority Queuing?

> **The LLQ Policer Invariant:** The bandwidth parameter specified in the MQC \`priority <kbps>\` command serves a dual purpose:
> 1. In the absence of congestion, priority traffic can burst up to the full physical line rate.
> 2. **During congestion (when non-priority software queues contain backlogged packets), the \`priority\` statement acts as an internal admission-control POLICER.**

If voice traffic attempts to send 800 kbps into a queue configured with \`priority 512\`, the router strictly polices and discards the excess 288 kbps of voice traffic! This guarantees that voice packets never starve the underlying CBWFQ business data queues.`,
      callout: {
        type: 'pro_tip',
        title: 'Pro Tip: Cisco 33% Priority Bandwidth Best Practice',
        text: 'Cisco Enterprise Solution Reference Network (SRND) guidelines strongly recommend that total strict priority traffic (Voice + Interactive Video) does NOT exceed 33% of total link capacity. Allocating more than one-third of a link to strict priority can induce severe jitter and starvation in underlying TCP control and business applications during peak periods.',
      },
    },
    {
      id: 'sec-qos-congestion-avoidance-wred',
      title: '6. Congestion Avoidance: Tail Drop, WRED & Queue Behaviour',
      contentMarkdown: `### The Failure of Tail Drop: TCP Global Synchronization

When a router output queue fills to its maximum limit, default queuing behavior drops all newly arriving packets at the tail of the queue. This is known as **Tail Drop**.

In networks dominated by TCP traffic, Tail Drop causes a severe performance collapse called **TCP Global Synchronization**:

\`\`\`text
Aggregated
Throughput
    ^
    |          /|         /|         /|   <-- Link Capacity Limit (Tail Drop Occurs)
    |         / |        / |        / |
    |        /  |       /  |       /  |
    |       /   |      /   |      /   |
    |      /    |     /    |     /    |   <-- Multiple TCP sessions drop packets simultaneously
    |     /     |    /     |    /     |       and all halve their congestion window (cwnd)!
    |    /      |   /      |   /      |
    |   /       +--/-------+--/-------+-- <-- Link utilization collapses (Sawtooth degradation)
    +----------------------------------------> Time
\`\`\`

1. Multiple independent TCP streams simultaneously fill the shared queue buffer to capacity.
2. Tail drop discards packets from **all** streams simultaneously.
3. Every TCP sender detects packet loss at the same moment, enters TCP Congestion Avoidance or Slow Start, and drastically reduces its congestion window (cwnd).
4. Link utilization plummets instantly.
5. As buffers drain, all TCP senders gradually increase their windows in lockstep until the queue overflows again, triggering an endless cyclical sawtooth collapse in network goodput.

---

### Weighted Random Early Detection (WRED)

**WRED (RFC 2309)** prevents TCP global synchronization by dropping packets **probabilistically before the queue becomes completely full**.

Instead of dropping all packets at 100% capacity, WRED monitors the **Average Queue Depth (q_avg)** using an Exponentially Weighted Moving Average (EWMA) algorithm:

\`\`\`text
Average Queue Depth = (q_avg * (1 - 2^-n)) + (q_current * 2^-n)
\`\`\`

This formula filters out brief, transient packet bursts, preventing premature drops during normal momentary spikes.

\`\`\`text
Drop
Probability
   100% |                                      +------------------ (100% Tail Drop Zone)
        |                                     /|
        |                                    / |
   Max% |                                   +  | (Linear Drop Zone)
        |                                  /|  |
        |                                 / |  |
     0% +--------------------------------+  |  |
        0                         Min-TH    Max-TH    Queue Capacity
                                Average Queue Depth (q_avg)
\`\`\`

#### The Three WRED Operating Zones
1. **Average Queue Depth < Minimum Threshold:** 0% drop probability. All arriving packets are enqueued.
2. **Minimum Threshold ≤ Average Queue Depth ≤ Maximum Threshold:** Packets are dropped randomly based on a linear probability ramp from 0% up to the configured **Mark Probability Denominator** (typically 10%, or 1 in 10 packets). Dropping packets from only one or two random TCP flows causes those specific flows to throttle back, allowing remaining flows to utilize the link and preventing global synchronization!
3. **Average Queue Depth > Maximum Threshold:** 100% drop probability (tail drop). All arriving packets are discarded until queue depth recedes.

---

### DSCP-Based WRED Profiles

Standard RED treats all packets identically. Cisco **DSCP-Based WRED** (\`random-detect dscp-based\`) establishes independent minimum and maximum thresholds for each DSCP value:

| Traffic Class | DSCP Name | DSCP Dec | Min Threshold | Max Threshold | Mark Probability |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Assured Forwarding 31** | \`AF31\` (Low Drop) | 26 | **40 packets** | 60 packets | 1 in 10 (10%) |
| **Assured Forwarding 32** | \`AF32\` (Med Drop) | 28 | **30 packets** | 60 packets | 1 in 10 (10%) |
| **Assured Forwarding 33** | \`AF33\` (High Drop)| 30 | **20 packets** | 60 packets | 1 in 10 (10%) |

Under congestion, as average queue depth crosses 20 packets, the router begins selectively dropping \`AF33\` packets while \`AF31\` packets experience 0% drops. Only if congestion worsens beyond 40 packets does \`AF31\` begin experiencing random drops.`,
      callout: {
        type: 'warning',
        title: 'Critical Warning: Never Configure WRED on Voice Queues',
        text: 'WRED relies entirely on TCP window-reduction semantics to alleviate congestion. Real-time VoIP (UDP) has no retransmission or window mechanism; dropped voice packets cause immediate audio garbling. Strict priority voice queues must NEVER have WRED enabled.',
      },
    },
    {
      id: 'sec-qos-cisco-mqc-three-tier-architecture',
      title: '7. Cisco Modular QoS CLI (MQC): 3-Stage Architecture',
      contentMarkdown: `### The Three-Stage MQC Configuration Model

Cisco standardized QoS configuration across routers and switches using the **Modular QoS CLI (MQC)**. MQC separates QoS policy into three modular, reusable components:

\`\`\`text
+-----------------------+     +-------------------------+     +--------------------------+
| 1. CLASS-MAP          |     | 2. POLICY-MAP           |     | 3. SERVICE-POLICY        |
| "Identify & Classify" | ==> | "Actions & Conditioning"| ==> | "Interface & Direction"  |
| Match criteria:       |     | Actions:                |     | Attach to:               |
| - match dscp          |     | - priority              |     | - GigabitEthernet0/0/1   |
| - match access-group  |     | - bandwidth             |     | - Tunnel0                |
| - match protocol      |     | - shape / police        |     | Direction:               |
| Logic: any vs all     |     | - set dscp              |     | - input / output         |
+-----------------------+     +-------------------------+     +--------------------------+
\`\`\`

---

### Step 1: Defining Class Maps (\`class-map\`)

Class maps inspect packet attributes. The operator must explicitly choose between Boolean OR (\`match-any\`) and Boolean AND (\`match-all\`):

\`\`\`cisco
! Boolean OR: Packet matches if ANY statement is true
class-map match-any CM-VOICE-TRAFFIC
 match dscp ef
 match dscp cs3
 match access-group name ACL-VOIP-PAYLOAD

! Boolean AND: ALL statements must be simultaneously true! (Default if omitted)
class-map match-all CM-BUSINESS-SECURE
 match dscp af31
 match access-group name ACL-CORPORATE-SUBNET
\`\`\`

> **Common Cisco Trap:** If you create a class map with multiple \`match protocol\` statements under \`match-all\`, a packet can never be simultaneously HTTP and DNS; the class map will match **0 packets**!

---

### Step 2: Defining Policy Maps (\`policy-map\`)

Policy maps associate traffic classes with QoS conditioning and queuing actions:

\`\`\`cisco
policy-map PM-BRANCH-EGRESS
 ! 1. Real-time voice assigned to Low Latency Queue (Strict Priority)
 class CM-VOICE-TRAFFIC
  priority 1000
 !
 ! 2. Mission-critical ERP assigned guaranteed bandwidth with WRED
 class CM-BUSINESS-SECURE
  bandwidth remaining percent 40
  random-detect dscp-based
 !
 ! 3. Bulk data policed to prevent link oversubscription
 class CM-BULK-DATA
  bandwidth remaining percent 20
  police cir 5000000 bc 62500
   conform-action transmit
   exceed-action drop
 !
 ! 4. Default class catches all remaining unmatched traffic
 class class-default
  bandwidth remaining percent 40
  random-detect
\`\`\`

---

### Step 3: Interface Attachment (\`service-policy\`)

The policy map is activated on an interface or subinterface using \`service-policy\`:

\`\`\`cisco
interface GigabitEthernet0/0/1
 description WAN Edge Circuit to Service Provider
 service-policy output PM-BRANCH-EGRESS
\`\`\`

#### Directional Constraints in MQC
- **Input Direction (\`service-policy input\`):** Classification, marking (\`set dscp\`), and policing (\`police\`) are supported. **Queuing actions (\`priority\`, \`bandwidth\`) and shaping (\`shape\`) CANNOT be applied inbound** because a router cannot buffer packets that have already arrived across the wire.
- **Output Direction (\`service-policy output\`):** Classification, marking, policing, shaping, and all queuing disciplines are fully supported.`,
      callout: {
        type: 'cisco_quirk',
        title: 'Cisco IOS-XE MQC Hierarchy (HQoS)',
        text: 'When connecting to sub-rate Ethernet WAN circuits (e.g., 20 Mbps service on a 1 Gbps physical port), Cisco IOS-XE requires Hierarchical QoS (HQoS). A parent policy performs aggregate traffic shaping (`shape average 20000000`), and a nested child policy applies queuing (`priority` and `bandwidth`) within the shaped stream.',
      },
    },
    {
      id: 'sec-qos-verification-troubleshooting-cli',
      title: '8. Verification, Metrics & Field Troubleshooting',
      contentMarkdown: `### The Master Verification Tool: \`show policy-map interface\`

In Cisco IOS-XE, the command \`show policy-map interface <interface-name>\` is the definitive diagnostic tool for evaluating QoS health and packet scheduling in real time.

\`\`\`text
Branch-Router# show policy-map interface GigabitEthernet0/0/1
 GigabitEthernet0/0/1 

  Service-policy output: PM-BRANCH-EGRESS

    Class-map: CM-VOICE-TRAFFIC (match-any)  
      1249820 packets, 104984880 bytes
      5 minute offered rate 872000 bps, drop rate 0000 bps
      Match: dscp ef (46)
        1249820 packets, 104984880 bytes
      Priority: 1000 kbps, burst bytes 25000, Exceed action: discard
      
      Priority Output Queue: [Packets Enqueued / Dropped]
        (pkts matched/bytes matched) 1249820/104984880
        (total drops) 0
        (bytes dropped) 0

    Class-map: CM-BUSINESS-SECURE (match-all)  
      3490122 packets, 4188146400 bytes
      5 minute offered rate 5200000 bps, drop rate 12000 bps
      Match: dscp af31 (26)
      Queueing
      queue limit 64 packets
      (queue depth/total drops/no-buffer drops) 14/842/0
      (pkts output/bytes output) 3489280/4187138000
      bandwidth remaining 40% (4000 kbps)
        
      WRED: 
        Mean queue depth: 32 packets
        dscp      min-threshold    max-threshold    mark-prob    random-drops    tail-drops
        af31      40               60               1/10         0               0
        af32      30               60               1/10         312             0
        af33      20               60               1/10         530             0

    Class-map: class-default (match-default)  
      9821034 packets, 11785240800 bytes
      5 minute offered rate 9800000 bps, drop rate 842000 bps
      Queueing
      queue limit 128 packets
      (queue depth/total drops/no-buffer drops) 128/94210/0
      (pkts output/bytes output) 9726824/11672388000
      bandwidth remaining 40% (4000 kbps)
\`\`\`

---

### Diagnosing Key Metrics in Policy-Map Output

1. **Offered Rate vs. Drop Rate:** Indicates the incoming throughput offered to the class vs. how much traffic is being discarded.
2. **Priority Total Drops:** If \`(total drops)\` in a priority class is greater than 0, the priority queue is bursting **above its configured CIR allocation** during interface congestion. The internal admission-control policer is actively dropping real-time packets.
3. **Queue Depth vs. Queue Limit:** If current queue depth equals the queue limit (e.g. \`128/128\`), the queue is saturated and suffering tail drops.
4. **WRED Drop Breakdown:** Differentiates healthy random drops (which pace TCP streams) from tail drops (which cause global synchronization).

---

### Systematic QoS Troubleshooting Matrix

| Symptom | Probable Root Cause | Verification Command | Remediation |
| :--- | :--- | :--- | :--- |
| **Choppy audio, voice drops during peak hours** | Voice traffic exceeds \`priority\` bandwidth; internal policer dropping RTP | \`show policy-map interface\` (check priority drops) | Audit codec count; increase \`priority <kbps>\` allocation |
| **Critical application traffic ends up in class-default** | Class map configured with \`match-all\` instead of \`match-any\` | \`show class-map\` | Change class map definition to \`match-any\` |
| **Service-policy rejected on interface** | Queuing or shaping configured on an inbound interface | Console error: \`Queuing not supported in input\` | Move queuing to egress policy; use policing on ingress |
| **Service provider polices traffic at demarc** | Router sending full line rate on sub-rate Ethernet handoff | Interface output drops at SP router | Implement Hierarchical QoS (HQoS) with parent \`shape average\` |
| **TCP streams suffer sudden throughput collapse** | Tail drop causing TCP global synchronization | \`show policy-map interface\` (high tail drops in class) | Enable \`random-detect dscp-based\` (WRED) |`,
      callout: {
        type: 'rfc',
        title: 'RFC 4594: Configuration Guidelines for DiffServ Service Classes',
        text: 'RFC 4594 standardizes enterprise QoS architecture into 12 distinct service classes, defining precise DSCP markings, queuing strategies, and drop behaviors for Voice (EF), Broadcast Video (CS5), Multimedia Conferencing (AF4x), Multimedia Streaming (AF3x), and High-Throughput Data (AF1x).',
      },
    },
    {
      id: 'sec-qos-enterprise-case-study',
      title: '9. End-to-End Case Study: Voice & ERP vs. Backup Storm',
      contentMarkdown: `### The Incident: Disaster at the Medical Center Branch

**Enterprise Topology:**
A regional medical center connects back to the core datacenter over a **20 Mbps sub-rate Metro Ethernet circuit** handed off over a physical Gigabit Ethernet interface (\`GigabitEthernet0/0/1\`).

\`\`\`text
+-----------------------+                    20 Mbps Committed WAN                    +-----------------------+
| Regional Clinic LAN   |  Gig0/0/1         ========================>  Gig0/0/1       | Datacenter Core       |
| - 25 VoIP Phones (EF) | [Branch Edge]       Service Provider Core   [Datacenter]    | - PBX & Epic EHR      |
| - Epic EHR App (AF31) |                      (Polices at 20M hard)                  | - PACS Imaging Archive|
+-----------------------+                                                             +-----------------------+
\`\`\`

**The Crisis:**
At precisely 2:00 PM every weekday, nursing staff report that telephone calls develop severe latency and audio dropouts, and patient chart updates in the Electronic Health Record (EHR) freeze. Concurrently, radiographic PACS image transfers to the datacenter archive are underway.

---

### Step-by-Step Incident Investigation

#### Phase 1: Physical Link and Provider Demarcation Analysis
Checking interface status shows the local Gigabit Ethernet link running at 1 Gbps with 0 CRC errors. However, checking the Service Provider SLA shows that the provider enforces a **strict ingress policer of 20 Mbps** at their demarcation switch!

Because the branch router interface was transmitting full gigabit line bursts without shaping, the carrier's policer was discarding up to 35% of all frames at random—including voice packets!

#### Phase 2: Inspecting the Existing Branch QoS Policy
The engineer examines the running QoS configuration on the branch router:

\`\`\`cisco
! Defective configuration discovered on Branch-Router:
class-map match-all CM-VOICE
 match dscp ef
 match access-group name ACL-OLD-PHONE-SUBNET
!
policy-map PM-DEFECTIVE
 class CM-VOICE
  priority 200
 class class-default
  bandwidth remaining percent 100
\`\`\`

Two fatal defects were discovered:
1. \`CM-VOICE\` was configured with \`match-all\`, referencing an obsolete ACL that omitted the newly installed VoIP handset subnet \`10.50.20.0/24\`. Voice packets failed the ACL match, fell through to \`class-default\`, and were treated as best-effort bulk traffic!
2. The priority bandwidth was set to only \`200 kbps\`. With 25 concurrent calls needing 25 × 87.2 kbps = 2,180 kbps, the internal LLQ policer would have discarded over 90% of the audio packets even if classification had matched!

---

### The Engineering Solution: Hierarchical MQC (HQoS)

The network engineering team designs and applies a comprehensive Hierarchical QoS policy:

\`\`\`cisco
! =========================================================================
! 1. CLASSIFICATION: Ingress Identification via match-any
! =========================================================================
class-map match-any CM-VOICE-RTP
 match dscp ef
 match access-group name ACL-VOIP-PHONES

class-map match-any CM-CALL-SIGNALING
 match dscp cs3
 match dscp af31
 match port-map sip

class-map match-any CM-EHR-CRITICAL
 match dscp af31
 match access-group name ACL-EPIC-EHR-TRAFFIC

class-map match-any CM-PACS-IMAGING
 match dscp af11
 match access-group name ACL-PACS-TRANSFERS

! =========================================================================
! 2. CHILD POLICY: Queuing, Latency & Congestion Avoidance
! =========================================================================
policy-map PM-CHILD-QUEUING
 class CM-VOICE-RTP
  ! 25 VoIP calls require ~2.2 Mbps; allocate 3 Mbps strict priority
  priority 3000
 !
 class CM-CALL-SIGNALING
  bandwidth remaining percent 5
 !
 class CM-EHR-CRITICAL
  ! Guaranteed 50% of remaining bandwidth with WRED to protect TCP
  bandwidth remaining percent 50
  random-detect dscp-based
 !
 class CM-PACS-IMAGING
  ! Bulk PACS images get guaranteed bandwidth but drop first during congestion
  bandwidth remaining percent 25
  random-detect dscp-based
 !
 class class-default
  bandwidth remaining percent 20
  random-detect

! =========================================================================
! 3. PARENT POLICY: Shaping to Service Provider Committed Rate
! =========================================================================
policy-map PM-PARENT-WAN-SHAPING
 class class-default
  ! Shape aggregate traffic to 20 Mbps committed rate
  shape average 20000000
  service-policy PM-CHILD-QUEUING

! =========================================================================
! 4. ATTACHMENT: Outbound on WAN Interface
! =========================================================================
interface GigabitEthernet0/0/1
 description Primary WAN to Datacenter (20 Mbps CIR)
 service-policy output PM-PARENT-WAN-SHAPING
\`\`\`

---

### Post-Implementation Verification

Executing \`show policy-map interface GigabitEthernet0/0/1\` during the 2:00 PM PACS backup window confirms resolution:
- The **Parent Shaper** buffers excess PACS transfers, smoothing outbound bursts to exactly 19.95 Mbps and preventing carrier demarc drops.
- \`CM-VOICE-RTP\` reports **0 total drops**, with voice packets forwarded ahead of all queued data.
- \`CM-EHR-CRITICAL\` reports steady TCP throughput with **0 tail drops**, as WRED gently paces PACS transfers.`,
      callout: {
        type: 'pro_tip',
        title: 'Case Study Takeaway: Shape to the Demarcation CIR',
        text: 'Whenever the physical interface speed exceeds the subscribed WAN service provider bandwidth (e.g. 1 Gbps handoff with a 20 Mbps CIR), you MUST shape aggregate outbound traffic to the CIR. If you fail to shape, your router sends at 1 Gbps wire rate and the service provider hard-polices your traffic, randomly dropping voice and critical data before your internal QoS queues can take effect.',
      },
    },
  ],
  predictExercise: {
    id: 'ex-qos-four-degradations-mc',
    lessonId: 'lesson-qos-fundamentals',
    type: 'multiple_choice',
    title: 'The Four Network Degradations: Identifying Delay Bottlenecks',
    learningObjective:
      'Analyze the four primary network degradation factors and evaluate their impact against real-time application SLAs.',
    scenarioContext:
      'An enterprise network connects its corporate headquarters in New York to an engineering branch in London over a dedicated transatlantic optical fiber link. Users report high voice latency.',
    prompt:
      'A network administrator measures an end-to-end one-way delay of 78 ms for VoIP calls between New York and London. The physical transatlantic fiber run is approximately 5,500 km. The administrator decides to upgrade the WAN circuit bandwidth from 100 Mbps to 10 Gbps to reduce this delay. Why will this bandwidth upgrade FAIL to significantly reduce the measured 78 ms voice latency?',
    options: [
      {
        id: 'opt-propagation-delay-dominates',
        label:
          'Propagation delay is bounded by the speed of light in optical fiber (~5 µs/km, totaling ~27.5 ms each way) and serialization delay for a tiny 80-byte voice packet is already sub-millisecond, so increasing bandwidth cannot alter the dominant physical propagation time.',
        isCorrect: true,
        explanation:
          'Correct! End-to-end latency consists of propagation, serialization, processing, and queuing delay. Propagation delay across 5,500 km of fiber is ~27.5 ms one-way, and intermediate terrestrial path routing adds further physical distance. Serializing an 80-byte VoIP packet on a 100 Mbps link takes only 6.4 microseconds. Upgrading to 10 Gbps only reduces serialization delay from 6.4 µs to 0.064 µs—a completely imperceptible difference.',
      },
      {
        id: 'opt-bandwidth-never-affects-delay',
        label:
          'Bandwidth has mathematically zero relationship with packet serialization delay on Ethernet interfaces.',
        isCorrect: false,
        explanation:
          'Incorrect. Serialization delay is directly proportional to frame size divided by bandwidth (Bits / bps). Bandwidth directly dictates serialization delay, but for small voice packets on high-speed links, serialization delay is already negligible compared to propagation delay.',
      },
      {
        id: 'opt-itu-prevents-bandwidth-upgrade',
        label:
          'ITU-T G.114 mandates that VoIP streams must be throttled to 64 kbps regardless of interface bandwidth.',
        isCorrect: false,
        explanation:
          'Incorrect. ITU-T G.114 specifies recommended latency limits (150 ms one-way), not interface bandwidth restrictions. The G.711 codec uses 64 kbps of audio payload, but interface bandwidth can be arbitrarily high.',
      },
      {
        id: 'opt-voice-requires-tcp-retransmissions',
        label:
          'Voice RTP traffic uses TCP slow-start which intentionally caps throughput until window acknowledgment arrives.',
        isCorrect: false,
        explanation:
          'Incorrect. Real-time VoIP audio bearer traffic uses UDP (and RTP), not TCP. UDP has no slow-start, no windowing, and no acknowledgment delays.',
      },
    ],
    hints: [
      'Break down end-to-end delay into its four discrete components: propagation, serialization, processing, and queuing.',
      'Calculate the serialization delay of a typical 80-byte (640-bit) G.729 voice packet on a 100 Mbps link (640 / 100,000,000).',
      'Compare that tiny microsecond serialization number with the speed of light in optical fiber traveling 5,500 kilometers.',
    ],
    explanation:
      'Total delay is the sum of propagation, serialization, processing, and queuing delay. Propagation delay is governed by the speed of light in fiber (~200,000 km/s). On high-speed WAN links, propagation delay represents the overwhelming majority of latency; adding raw bandwidth cannot overcome the physical limits of light propagation.',
    commonMistakes: [
      {
        mistake: 'Assuming more bandwidth always lowers end-to-end network latency.',
        explanation:
          'Bandwidth only reduces serialization delay and relieves congestion-induced queuing delay. Bandwidth cannot reduce physical propagation delay or router processing delay.',
      },
    ],
    practicalTakeaway:
      'Bandwidth is throughput; latency is distance and serialization. You cannot solve propagation delay across intercontinental distances by buying more bandwidth.',
    difficulty: 'ccnp',
  },
  practiceChallenge: {
    id: 'ex-qos-mqc-lifecycle-seq',
    lessonId: 'lesson-qos-fundamentals',
    type: 'sequence',
    title: 'Cisco MQC Configuration Lifecycle Sequence',
    learningObjective:
      'Architect and implement end-to-end Cisco Modular QoS CLI (MQC) policies across class maps, policy maps, and interface service policies.',
    scenarioContext:
      'A network engineer is configuring quality of service from scratch on a newly commissioned Cisco IOS-XE enterprise edge router.',
    prompt:
      'Order the following administrative and configuration steps to implement and verify an end-to-end Modular QoS CLI (MQC) policy on a Cisco router interface:',
    sequenceItems: [
      {
        id: 'step-define-class-map',
        text: 'Configure class-map match-any or match-all to identify traffic using match statements (match dscp, match protocol, etc.)',
        correctIndex: 0,
      },
      {
        id: 'step-create-policy-map',
        text: 'Create a policy-map and reference the configured class maps using the class command',
        correctIndex: 1,
      },
      {
        id: 'step-assign-qos-actions',
        text: 'Assign QoS conditioning and queuing actions within each class (priority, bandwidth, shape, police, set dscp)',
        correctIndex: 2,
      },
      {
        id: 'step-attach-service-policy',
        text: 'Attach the completed policy map to the target interface using service-policy input or service-policy output',
        correctIndex: 3,
      },
      {
        id: 'step-verify-telemetry',
        text: 'Execute show policy-map interface to verify real-time class matching, queue depths, and drop counters',
        correctIndex: 4,
      },
    ],
    hints: [
      'MQC follows a strict 3-tier hierarchy: First identify (class-map), then treat (policy-map), then apply (service-policy).',
      'You cannot assign queuing actions to a class before the class map has been defined and called inside a policy map.',
      'Verification always takes place after interface activation using runtime telemetry commands.',
    ],
    explanation:
      'Cisco MQC separates QoS into: 1) Classification (class-map), 2) Policy formulation (policy-map and action assignment), 3) Interface activation (service-policy), and 4) Telemetry verification (show policy-map interface).',
    commonMistakes: [
      {
        mistake: 'Attempting to configure service-policy before defining class maps and policy maps.',
        explanation:
          'An interface service-policy requires a pre-existing policy-map name in the configuration.',
      },
    ],
    practicalTakeaway:
      'Remember the MQC 3-step mantra: Classify (class-map), Act (policy-map), Apply (service-policy).',
    difficulty: 'ccnp',
  },
  exercises: [
    {
      id: 'ex-qos-four-degradations-mc',
      lessonId: 'lesson-qos-fundamentals',
      type: 'multiple_choice',
      title: 'The Four Network Degradations: Identifying Delay Bottlenecks',
      learningObjective:
        'Analyze the four primary network degradation factors and evaluate their impact against real-time application SLAs.',
      scenarioContext:
        'An enterprise network connects its corporate headquarters in New York to an engineering branch in London over a dedicated transatlantic optical fiber link. Users report high voice latency.',
      prompt:
        'A network administrator measures an end-to-end one-way delay of 78 ms for VoIP calls between New York and London. The physical transatlantic fiber run is approximately 5,500 km. The administrator decides to upgrade the WAN circuit bandwidth from 100 Mbps to 10 Gbps to reduce this delay. Why will this bandwidth upgrade FAIL to significantly reduce the measured 78 ms voice latency?',
      options: [
        {
          id: 'opt-propagation-delay-dominates',
          label:
            'Propagation delay is bounded by the speed of light in optical fiber (~5 µs/km, totaling ~27.5 ms each way) and serialization delay for a tiny 80-byte voice packet is already sub-millisecond, so increasing bandwidth cannot alter the dominant physical propagation time.',
          isCorrect: true,
          explanation:
            'Correct! End-to-end latency consists of propagation, serialization, processing, and queuing delay. Propagation delay across 5,500 km of fiber is ~27.5 ms one-way, and intermediate terrestrial path routing adds further physical distance. Serializing an 80-byte VoIP packet on a 100 Mbps link takes only 6.4 microseconds. Upgrading to 10 Gbps only reduces serialization delay from 6.4 µs to 0.064 µs—a completely imperceptible difference.',
        },
        {
          id: 'opt-bandwidth-never-affects-delay',
          label:
            'Bandwidth has mathematically zero relationship with packet serialization delay on Ethernet interfaces.',
          isCorrect: false,
          explanation:
            'Incorrect. Serialization delay is directly proportional to frame size divided by bandwidth (Bits / bps). Bandwidth directly dictates serialization delay, but for small voice packets on high-speed links, serialization delay is already negligible compared to propagation delay.',
        },
        {
          id: 'opt-itu-prevents-bandwidth-upgrade',
          label:
            'ITU-T G.114 mandates that VoIP streams must be throttled to 64 kbps regardless of interface bandwidth.',
          isCorrect: false,
          explanation:
            'Incorrect. ITU-T G.114 specifies recommended latency limits (150 ms one-way), not interface bandwidth restrictions. The G.711 codec uses 64 kbps of audio payload, but interface bandwidth can be arbitrarily high.',
        },
        {
          id: 'opt-voice-requires-tcp-retransmissions',
          label:
            'Voice RTP traffic uses TCP slow-start which intentionally caps throughput until window acknowledgment arrives.',
          isCorrect: false,
          explanation:
            'Incorrect. Real-time VoIP audio bearer traffic uses UDP (and RTP), not TCP. UDP has no slow-start, no windowing, and no acknowledgment delays.',
        },
      ],
      hints: [
        'Break down end-to-end delay into its four discrete components: propagation, serialization, processing, and queuing.',
        'Calculate the serialization delay of a typical 80-byte (640-bit) G.729 voice packet on a 100 Mbps link (640 / 100,000,000).',
        'Compare that tiny microsecond serialization number with the speed of light in optical fiber traveling 5,500 kilometers.',
      ],
      explanation:
        'Total delay is the sum of propagation, serialization, processing, and queuing delay. Propagation delay is governed by the speed of light in fiber (~200,000 km/s). On high-speed WAN links, propagation delay represents the overwhelming majority of latency; adding raw bandwidth cannot overcome the physical limits of light propagation.',
      commonMistakes: [
        {
          mistake: 'Assuming more bandwidth always lowers end-to-end network latency.',
          explanation:
            'Bandwidth only reduces serialization delay and relieves congestion-induced queuing delay. Bandwidth cannot reduce physical propagation delay or router processing delay.',
        },
      ],
      practicalTakeaway:
        'Bandwidth is throughput; latency is distance and serialization. You cannot solve propagation delay across intercontinental distances by buying more bandwidth.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-dscp-af-calculation-num',
      lessonId: 'lesson-qos-fundamentals',
      type: 'numerical',
      title: 'DSCP Assured Forwarding (AFxy) Formula Calculation',
      learningObjective:
        'Differentiate Layer 2 CoS, Layer 3 IP Precedence, and DSCP, including Class Selector and Assured Forwarding binary/decimal mapping.',
      scenarioContext:
        'An enterprise network engineer is creating an MQC policy map matching transactional SQL database queries marked as Assured Forwarding Class 3, Medium Drop Precedence (AF32).',
      prompt:
        'What is the decimal DSCP value for Assured Forwarding class AF32? (Use the standard RFC 2597 formula: Decimal = 8x + 2y, where x is the class number and y is the drop precedence).',
      numericAnswer: 28,
      numericTolerance: 0,
      hints: [
        'Identify the class number x: for AF32, x = 3.',
        'Identify the drop precedence number y: for AF32, y = 2.',
        'Compute the formula: Decimal = 8(x) + 2(y) = 8(3) + 2(2).',
      ],
      explanation:
        'RFC 2597 defines Assured Forwarding (AFxy) where x is the class (1 to 4) and y is the drop precedence (1 to 3). The 6-bit DSCP bit structure is [Class bits: 3 bits] [Drop bits: 2 bits] [0: 1 bit]. For AF32, class = 3 (binary 011), drop = 2 (binary 10), and the trailing bit is 0, giving binary 011100 = decimal 28. Using the mathematical formula: 8(3) + 2(2) = 24 + 4 = 28.',
      commonMistakes: [
        {
          mistake: 'Entering 32 as the decimal value.',
          explanation:
            'AF32 is a name designation (Class 3, Drop 2), not a decimal value. Decimal 32 corresponds to CS4.',
        },
      ],
      practicalTakeaway:
        'Memorize the AF formula: Decimal = 8x + 2y. For AF31, 8(3)+2(1) = 26; for AF32, 28; for AF33, 30.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-token-bucket-math-num',
      lessonId: 'lesson-qos-fundamentals',
      type: 'numerical',
      title: 'Traffic Shaper Token Bucket Timing Interval (Tc) Calculation',
      learningObjective:
        'Differentiate traffic policing from traffic shaping, calculating token-bucket parameters (Bc, Be, Tc, CIR).',
      scenarioContext:
        'An edge router is configured with traffic shaping on a sub-rate Ethernet WAN interface connecting to an ISP.',
      prompt:
        'A router is configured with traffic shaping using a Committed Information Rate (CIR) of 10,000,000 bps (10 Mbps) and a Committed Burst (Bc) of 125,000 bits. Calculate the resulting token bucket time interval (Tc) in milliseconds (ms). Formula: Tc = (Bc / CIR) * 1000.',
      numericAnswer: 12.5,
      numericTolerance: 0.1,
      hints: [
        'Use the formula: Tc (in seconds) = Bc / CIR.',
        'Calculate: 125,000 bits / 10,000,000 bps = 0.0125 seconds.',
        'Convert seconds to milliseconds by multiplying by 1,000.',
      ],
      explanation:
        'The token bucket timing interval Tc is the frequency at which the token bucket is replenished with Bc tokens. Tc = Bc / CIR = 125,000 bits / 10,000,000 bps = 0.0125 seconds. Multiplying by 1,000 yields 12.5 ms. A smaller Tc (such as 10-25 ms) provides smoother traffic flow and lower queuing delay for voice.',
      commonMistakes: [
        {
          mistake: 'Entering 0.0125 instead of 12.5.',
          explanation:
            'The question requested the answer in milliseconds (ms), not seconds.',
        },
      ],
      practicalTakeaway:
        'Tc = Bc / CIR. In Cisco IOS, lower Tc values (10 ms) ensure VoIP traffic does not suffer burst-induced jitter.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-policing-vs-shaping-mc',
      lessonId: 'lesson-qos-fundamentals',
      type: 'multiple_choice',
      title: 'Traffic Conditioning: Policing vs. Shaping Architectural Contrast',
      learningObjective:
        'Differentiate traffic policing from traffic shaping, evaluating buffer vs. drop latency impacts.',
      scenarioContext:
        'An enterprise is interconnecting two regional data centers across a leased 50 Mbps metro Ethernet service delivered over a 1 Gbps physical fiber interface.',
      prompt:
        'Which statement accurately characterizes the operational differences between traffic policing and traffic shaping?',
      options: [
        {
          id: 'opt-policing-drops-shaping-buffers',
          label:
            'Policing drops or remarks excess traffic without buffering, introducing no queuing delay and functioning inbound or outbound; shaping buffers excess packets in software queues, introducing variable latency and jitter, and functions outbound only.',
          isCorrect: true,
          explanation:
            'Correct! Policing enforces limits by immediate drop or remark actions, requiring no buffers and operating in both directions. Shaping delays packets in software queues to smooth bursts into an even rate, introducing latency/jitter and operating strictly in the outbound direction.',
        },
        {
          id: 'opt-shaping-inbound-only',
          label:
            'Shaping can only be applied in the inbound direction because ingress buffers must absorb incoming WAN bursts.',
          isCorrect: false,
          explanation:
            'Incorrect. Shaping can ONLY be applied outbound (egress). A router cannot shape inbound traffic that has already arrived across the wire.',
        },
        {
          id: 'opt-policing-buffers-packets',
          label:
            'Policing buffers non-conforming packets in hardware FIFO rings until the token bucket replenishes.',
          isCorrect: false,
          explanation:
            'Incorrect. Policing never buffers packets. Non-conforming packets are either dropped immediately or remarked (e.g. to a higher drop precedence).',
        },
        {
          id: 'opt-shaping-no-delay',
          label:
            'Shaping guarantees zero additional latency by dynamically rewriting the TCP window scale option in packet headers.',
          isCorrect: false,
          explanation:
            'Incorrect. Shaping actively introduces queuing delay because packets are held in software queues until tokens become available.',
        },
      ],
      hints: [
        'Think about what happens to a packet that exceeds the configured rate: does it get dropped or put in a waiting line?',
        'Consider directionality: can a router buffer packets that have already arrived across the wire from another device?',
      ],
      explanation:
        'Policing meters traffic against a token bucket and immediately drops or remarks non-conforming packets. Because no packets are held, policing introduces no delay and works inbound or outbound. Shaping buffers excess packets in software queues, smoothing bursts into a uniform flow at the cost of variable queuing delay, and operates outbound only.',
      commonMistakes: [
        {
          mistake: 'Believing shaping can be configured on an ingress interface.',
          explanation:
            'Ingress packets have already been transmitted by the upstream sender. A router cannot delay what has already arrived.',
        },
      ],
      practicalTakeaway:
        'Shape outbound on your WAN router to the ISP CIR so you control the buffer queue; if you let the ISP police, they drop indiscriminately.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-mqc-lifecycle-seq',
      lessonId: 'lesson-qos-fundamentals',
      type: 'sequence',
      title: 'Cisco MQC Configuration Lifecycle Sequence',
      learningObjective:
        'Architect and implement end-to-end Cisco Modular QoS CLI (MQC) policies across class maps, policy maps, and interface service policies.',
      scenarioContext:
        'A network engineer is configuring quality of service from scratch on a newly commissioned Cisco IOS-XE enterprise edge router.',
      prompt:
        'Order the following administrative and configuration steps to implement and verify an end-to-end Modular QoS CLI (MQC) policy on a Cisco router interface:',
      sequenceItems: [
        {
          id: 'step-define-class-map',
          text: 'Configure class-map match-any or match-all to identify traffic using match statements (match dscp, match protocol, etc.)',
          correctIndex: 0,
        },
        {
          id: 'step-create-policy-map',
          text: 'Create a policy-map and reference the configured class maps using the class command',
          correctIndex: 1,
        },
        {
          id: 'step-assign-qos-actions',
          text: 'Assign QoS conditioning and queuing actions within each class (priority, bandwidth, shape, police, set dscp)',
          correctIndex: 2,
        },
        {
          id: 'step-attach-service-policy',
          text: 'Attach the completed policy map to the target interface using service-policy input or service-policy output',
          correctIndex: 3,
        },
        {
          id: 'step-verify-telemetry',
          text: 'Execute show policy-map interface to verify real-time class matching, queue depths, and drop counters',
          correctIndex: 4,
        },
      ],
      hints: [
        'MQC follows a strict 3-tier hierarchy: First identify (class-map), then treat (policy-map), then apply (service-policy).',
        'You cannot assign queuing actions to a class before the class map has been defined and called inside a policy map.',
        'Verification always takes place after interface activation using runtime telemetry commands.',
      ],
      explanation:
        'Cisco MQC separates QoS into: 1) Classification (class-map), 2) Policy formulation (policy-map and action assignment), 3) Interface activation (service-policy), and 4) Telemetry verification (show policy-map interface).',
      commonMistakes: [
        {
          mistake: 'Attempting to configure service-policy before defining class maps and policy maps.',
          explanation:
            'An interface service-policy requires a pre-existing policy-map name in the configuration.',
        },
      ],
      practicalTakeaway:
        'Remember the MQC 3-step mantra: Classify (class-map), Act (policy-map), Apply (service-policy).',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-llq-priority-policer-tb',
      lessonId: 'lesson-qos-fundamentals',
      type: 'troubleshooting',
      title: 'Diagnosing LLQ Priority Queue Drops via Runtime CLI Telemetry',
      learningObjective:
        'Execute systematic CLI troubleshooting using show policy-map interface to isolate priority queue drops and policing actions.',
      scenarioContext:
        'Branch office users report that phone calls sound robotic and clip words during peak morning hours. The WAN link is a 10 Mbps circuit.',
      prompt:
        'A network engineer runs "show policy-map interface GigabitEthernet0/0/1" and reviews the output below:\n\n```text\nClass-map: CM-VOIP (match-any)\n  412890 packets, 34682760 bytes\n  5 minute offered rate 482000 bps, drop rate 182000 bps\n  Match: dscp ef (46)\n  Priority: 300 kbps, burst bytes 7500, Exceed action: discard\n  \n  Priority Output Queue: [Packets Enqueued / Dropped]\n    (pkts matched/bytes matched) 412890/34682760\n    (total drops) 14210\n    (bytes dropped) 1193640\n\nClass-map: class-default (match-default)\n  5 minute offered rate 5200000 bps, drop rate 0 bps\n```\n\nTotal interface utilization is only 5.68 Mbps out of the 10 Mbps link (57% utilized). What is the root cause of the voice packet drops, and what is the proper remediation?',
      options: [
        {
          id: 'opt-priority-policer-drops-excess',
          label:
            'The voice traffic (482 kbps offered rate) exceeds the configured priority bandwidth limit (300 kbps); during periods of interface queuing, LLQ enforces an internal admission-control policer that discards all voice traffic exceeding 300 kbps. Remediate by increasing the priority bandwidth allocation to accommodate peak call volume (e.g. priority 600).',
          isCorrect: true,
          explanation:
            'Correct! In LLQ, the bandwidth assigned in the priority command acts as a strict admission policer during congestion. Here, voice offered rate is 482 kbps but the priority queue is policed at 300 kbps, generating 14,210 dropped packets. Increasing the priority bandwidth resolves the drop condition.',
        },
        {
          id: 'opt-interface-hardware-oversubscription',
          label:
            'The physical GigabitEthernet interface has failed due to hardware ASIC buffer exhaustion; replace the router SFP module.',
          isCorrect: false,
          explanation:
            'Incorrect. Total interface utilization is only 5.68 Mbps. The hardware interface is completely healthy; this is a software QoS policer discard.',
        },
        {
          id: 'opt-wred-dropping-voice',
          label:
            'WRED is actively discarding voice packets due to TCP global synchronization in the CM-VOIP class map.',
          isCorrect: false,
          explanation:
            'Incorrect. Priority queues do not run WRED, and voice RTP is UDP, not TCP. The output explicitly states "Exceed action: discard" under Priority: 300 kbps.',
        },
        {
          id: 'opt-voice-needs-class-default',
          label:
            'Voice packets should be moved into class-default where 100% of remaining bandwidth is available.',
          isCorrect: false,
          explanation:
            'Incorrect. Moving voice into class-default subjects voice to high queuing delay and jitter behind bulk data transfers.',
        },
      ],
      hints: [
        'Notice the offered rate for CM-VOIP (482,000 bps) versus the configured Priority rate (300 kbps).',
        'Recall the LLQ Policer Invariant: what does the priority statement do when congestion occurs?',
        'Check the field: (total drops) 14210 under the Priority Output Queue.',
      ],
      explanation:
        'In Low Latency Queuing, the priority statement provides an internal policer during congestion to protect other classes from starvation. When voice traffic offered (482 kbps) exceeds the configured priority bandwidth (300 kbps), the router discards the excess voice packets. Increasing the priority rate to cover peak concurrent calls eliminates the drops.',
      commonMistakes: [
        {
          mistake: 'Assuming the router drops packets only when the physical interface reaches 100% capacity.',
          explanation:
            'QoS policers enforce per-class limits independently of overall physical interface utilization.',
        },
      ],
      practicalTakeaway:
        'If show policy-map interface shows drops in a priority class, your priority policer is undersized for the volume of voice/video calls passing through.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-wred-congestion-avoidance-mc',
      lessonId: 'lesson-qos-fundamentals',
      type: 'multiple_choice',
      title: 'Congestion Avoidance: WRED Mechanics & TCP Synchronization',
      learningObjective:
        'Diagnose congestion avoidance failure modes, including TCP global synchronization and tail drop, and evaluate WRED profiles.',
      scenarioContext:
        'A network engineer is reviewing WAN edge performance. Graphing tools reveal an aggressive sawtooth pattern where WAN utilization repeatedly peaks and drops sharply.',
      prompt:
        'How does Weighted Random Early Detection (WRED) prevent TCP global synchronization across congested network links?',
      options: [
        {
          id: 'opt-wred-drops-probabilistically-early',
          label:
            'WRED monitors average queue depth and drops packets probabilistically from a small number of random TCP flows before the queue fills; only those individual senders throttle back their congestion window, while other flows continue transmitting at full rate.',
          isCorrect: true,
          explanation:
            'Correct! By randomly dropping packets before buffer saturation, only the specific TCP senders experiencing drops reduce their window. This desynchronizes TCP back-off intervals, maintaining high aggregate link utilization and eliminating the global synchronization sawtooth collapse.',
        },
        {
          id: 'opt-wred-rewrites-tcp-headers',
          label:
            'WRED intercepts TCP ACKs and rewrites the receive window (rwnd) field to 0 for all active senders simultaneously.',
          isCorrect: false,
          explanation:
            'Incorrect. WRED does not rewrite TCP ACK window sizes. It is an active queue management drop/marking mechanism.',
        },
        {
          id: 'opt-wred-buffers-infinite-bursts',
          label:
            'WRED provides an dynamically expandable memory buffer that prevents any packet from ever being discarded.',
          isCorrect: false,
          explanation:
            'Incorrect. Memory buffers are physically finite. WRED actively drops packets early to prevent buffers from becoming full.',
        },
        {
          id: 'opt-wred-only-for-udp',
          label:
            'WRED is engineered exclusively for UDP voice streams and should never be applied to TCP data queues.',
          isCorrect: false,
          explanation:
            'Incorrect. Exactly the reverse: WRED relies on TCP window reduction and MUST NEVER be applied to UDP voice streams!',
        },
      ],
      hints: [
        'Think about the difference between Tail Drop (dropping all streams simultaneously at 100% capacity) vs. Random Early Detection.',
        'Why does dropping packets from ONE stream help the other 99 streams?',
      ],
      explanation:
        'Tail drop discards packets from all TCP connections when the queue reaches 100% capacity, causing all senders to enter slow-start simultaneously (TCP Global Synchronization). WRED drops packets probabilistically before full saturation, causing individual flows to stagger their back-offs and keeping link utilization steady.',
      commonMistakes: [
        {
          mistake: 'Believing WRED is designed for UDP traffic.',
          explanation:
            'UDP has no windowing mechanism and cannot back off in response to drops. Dropping UDP simply results in lost data with zero congestion relief.',
        },
      ],
      practicalTakeaway:
        'Use WRED on TCP data queues (ERP, HTTP, Bulk) to eliminate the sawtooth global synchronization trap. Never use WRED on voice/video queues.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-mqc-match-all-predict',
      lessonId: 'lesson-qos-fundamentals',
      type: 'predict_output',
      title: 'Predict Output: Cisco MQC match-all Multiple Protocol Trap',
      learningObjective:
        'Architect and implement end-to-end Cisco Modular QoS CLI (MQC) policies across class maps (match-any vs. match-all).',
      scenarioContext:
        'A junior network administrator configures a new class map on a branch office router to identify corporate web and DNS traffic.',
      prompt:
        'A network engineer configures the following class map on Cisco IOS-XE:\n\n```cisco\nclass-map match-all CM-INTERNET-SERVICES\n match protocol http\n match protocol dns\n```\n\nHow many packets will this class map match when production user web browsing and DNS lookup traffic passes through the router? (Enter a single number or word)',
      acceptableAnswers: ['0', '0 packets', 'zero', 'none'],
      textAnswerPattern: '^(0(\\s*packets?)?|zero|none)$',
      hints: [
        'Pay close attention to the parameter: "match-all".',
        'What logical Boolean operation does "match-all" perform across its match statements (AND vs. OR)?',
        'Can an individual IP packet simultaneously be both HTTP (TCP 80) and DNS (UDP/TCP 53)?',
      ],
      explanation:
        'The command "class-map match-all" specifies a Boolean AND operation. For a packet to match, ALL match statements must evaluate to true simultaneously. Because a single packet cannot be simultaneously HTTP and DNS, this class map will match exactly 0 packets! The administrator intended to use "class-map match-any" (Boolean OR).',
      commonMistakes: [
        {
          mistake: 'Assuming match-all matches all HTTP packets and all DNS packets.',
          explanation:
            'match-all means a single packet must match statement 1 AND statement 2 simultaneously.',
        },
      ],
      practicalTakeaway:
        'Always use match-any when listing multiple protocols or multiple DSCP values in a class map. match-all is the default if omitted.',
      difficulty: 'ccnp',
    },
    {
      id: 'ex-qos-trust-boundary-phone-tb',
      lessonId: 'lesson-qos-fundamentals',
      type: 'troubleshooting',
      title: 'Trust Boundary Misconfiguration on Switchport with Attached PC',
      learningObjective:
        'Establish enterprise trust boundaries, contrasting access-layer ingress classification against core forwarding.',
      scenarioContext:
        'An enterprise deploys Cisco IP Phones with user desktop PCs daisy-chained to the phones PC data port. The access switch is a Catalyst 9300.',
      prompt:
        'A network engineer notices that several power-users are downloading massive files using BitTorrent clients, and that this bulk peer-to-peer traffic is entering the WAN edge router tagged as DSCP EF (46) and consuming the strict priority voice queue! Inspection of the access switchport reveals:\n\n```cisco\ninterface GigabitEthernet1/0/12\n switchport mode access\n switchport access vlan 100\n switchport voice vlan 200\n trust dscp\n```\n\nWhat is the fundamental architectural flaw in this switchport configuration, and what is the proper fix?',
      options: [
        {
          id: 'opt-untrusted-pc-trust-boundary-flaw',
          label:
            'The command "trust dscp" unconditionally trusts all DSCP markings entering the physical switchport, allowing untrusted software on the daisy-chained PC to tag its own packets as EF; remediate by applying conditional trust ("trust device cisco-phone") and instructing the phone to remark PC untrusted traffic to DSCP 0.',
          isCorrect: true,
          explanation:
            'Correct! "trust dscp" unconditionally accepts markings from any device on that port. Because the user PC is daisy-chained through the phone, the PC can set DSCP EF on its own packets. Using conditional trust ("trust device cisco-phone") ensures only the phone is trusted, while traffic from the PC port is untrusted and remarked to Best Effort.',
        },
        {
          id: 'opt-voice-vlan-should-be-removed',
          label:
            'The voice vlan 200 configuration is conflicting with access vlan 100; remove the voice vlan and place both phone and PC into vlan 100.',
          isCorrect: false,
          explanation:
            'Incorrect. Putting voice and data into the same VLAN violates security isolation and prevents Layer 2 CoS separation.',
        },
        {
          id: 'opt-bittorrent-uses-rtp',
          label:
            'BitTorrent protocol inherently uses UDP RTP port 5004, which routers are hardcoded to treat as voice payload.',
          isCorrect: false,
          explanation:
            'Incorrect. Routers do not hardcode port 5004 as voice without MQC policies, and BitTorrent client applications set DSCP markings via user-space socket APIs when unrestricted by operating system policy.',
        },
        {
          id: 'opt-switchport-mode-trunk-required',
          label:
            'Switchports connecting Cisco IP phones must be configured in full 802.1Q trunk mode rather than access mode.',
          isCorrect: false,
          explanation:
            'Incorrect. Cisco IP phones utilize multi-VLAN access ports with the "switchport voice vlan" command, which internally creates a special 802.1Q tagged sub-stream for voice without exposing full trunk capabilities.',
        },
      ],
      hints: [
        'Where should the trust boundary be located: at the switch, at the phone, or at the PC?',
        'What does "trust dscp" do to frames generated by an unauthorized application running on Windows or Linux?',
        'Look up the command: "trust device cisco-phone".',
      ],
      explanation:
        'Unconditional trust ("trust dscp") trusts every packet arriving on the physical port, including frames transmitted by the PC plugged into the phone. The trust boundary must be set at the phone using conditional trust: trust the phone via CDP ("trust device cisco-phone") and instruct the phone to remark all PC data to DSCP 0.',
      commonMistakes: [
        {
          mistake: 'Assuming a Cisco IP phone automatically blocks or strips DSCP markings from an attached PC.',
          explanation:
            'Without explicit switchport QoS trust configuration, incoming frames from the PC port may pass through with their DSCP tags intact if the switch unconditionally trusts the port.',
        },
      ],
      practicalTakeaway:
        'Always use conditional trust (trust device cisco-phone) on ports with daisy-chained PCs so the phone remarks PC traffic to Best Effort (0).',
      difficulty: 'ccnp',
    },
  ],
  relatedFlashcardDecks: [],
  relatedLabs: [],
  externalReferences: [
    {
      title: 'Cisco IOS-XE Quality of Service Configuration Guide (Catalyst 9000 Switches)',
      url: 'https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/software/release/17-9/configuration_guide/qos/b_179_qos_9300_cg.html',
      sourceType: 'cisco_doc',
      relevantSection: 'Modular QoS CLI (MQC), Classification, Marking, Trust Boundaries, and Queuing',
    },
    {
      title: 'RFC 2474: Definition of the Differentiated Services Field (DS Field) in the IPv4 and IPv6 Headers',
      url: 'https://datatracker.ietf.org/doc/html/rfc2474',
      sourceType: 'rfc',
      relevantSection: 'Section 3: Differentiated Services Code Point (DSCP) Definition',
    },
    {
      title: 'RFC 2597: Assured Forwarding PHB Group',
      url: 'https://datatracker.ietf.org/doc/html/rfc2597',
      sourceType: 'rfc',
      relevantSection: 'Section 2: AF Classes and Drop Precedences',
    },
    {
      title: 'RFC 3246: An Expedited Forwarding PHB (Per-Hop Behavior)',
      url: 'https://datatracker.ietf.org/doc/html/rfc3246',
      sourceType: 'rfc',
      relevantSection: 'Section 2: Expedited Forwarding Definition and Mathematical Criteria',
    },
    {
      title: 'Cisco Enterprise QoS Solution Reference Network (SRND) Design Guide',
      url: 'https://www.cisco.com/c/en/us/td/docs/solutions/Enterprise/WAN_and_MAN/QoS_SRND_40/QoSSRND40.html',
      sourceType: 'cisco_doc',
      relevantSection: 'LLQ Sizing, 33% Priority Rule, and Hierarchical QoS (HQoS) Shaping',
    },
  ],
};
