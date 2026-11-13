/**
 * NetMentor Wire-Level Hex & ASCII Frame Encoder
 * Pure TypeScript utility converting high-level PacketHeader representations
 * into authentic binary/hex frame buffers and canonical Wireshark-style dumps.
 *
 * Implements deterministic byte layout for:
 * - IEEE 802.3 / Ethernet II (with optional IEEE 802.1Q VLAN encapsulation)
 * - ARP (RFC 826) 28-byte hardware/protocol payload
 * - IPv4 (RFC 791) 20-byte datagram with RFC 1071 one's-complement checksum
 * - TCP (RFC 793) 20-byte segment with 6-bit control flag bitmask
 * - UDP (RFC 768) 8-byte datagram
 * - ICMP (RFC 792) 8-byte Echo Request / Echo Reply framing
 * - OSPFv2 (RFC 2328) 24-byte packet header
 */

import type {
  PacketHeader,
  ProtocolSimulationScenario,
  TopologyNode,
  TopologyLink,
} from '../types/protocol-simulation';

export interface LayerByteRange {
  start: number;
  end: number;
  length: number;
  hexBadge: string;
}

export interface LayerByteRanges {
  l2: LayerByteRange;
  l3: LayerByteRange;
  l4: LayerByteRange;
  payload?: LayerByteRange;
}

export interface EncodedHexDump {
  bytes: Uint8Array;
  hexDump: string;
  rawHex: string;
  byteCount: number;
  layerRanges: LayerByteRanges;
  toString(): string;
  [Symbol.toPrimitive]?(hint: string): string;
}

export interface ScenarioTraceStep {
  stepIndex: number;
  title: string;
  explanation: string;
  fromNodeId: string;
  toNodeId: string;
  decodedPacket: PacketHeader;
  hexDump: string;
  rawHex: string;
  byteCount: number;
  layerRanges: LayerByteRanges;
}

export interface ScenarioTraceJson {
  captureInfo: {
    title: string;
    scenarioId: string;
    protocol: string;
    certification: string;
    difficulty: string;
    totalSteps: number;
    exportTimestamp: string;
    engine: string;
  };
  topologySummary: {
    nodeCount: number;
    nodes: Array<{ id: string; name: string; type: string }>;
    links: Array<{ id: string; source: string; target: string; label: string }>;
  };
  trace: ScenarioTraceStep[];
}

/**
 * Parses MAC address strings into 6 raw byte octets.
 * Handles colon (:), hyphen (-), dot (.) separators and non-hex placeholder characters.
 */
export function parseMac(macStr?: string): number[] {
  if (!macStr) return [0, 0, 0, 0, 0, 0];
  const parts = macStr.split(/[:\.-]/);
  if (parts.length === 6) {
    const bytes: number[] = [];
    for (const part of parts) {
      const clean = part.replace(/[^0-9A-Fa-f]/g, '');
      let val = parseInt(clean, 16);
      if (isNaN(val)) {
        // Deterministic fallback for non-hex label tokens (e.g. 'R1', 'sw')
        val = ((part.charCodeAt(0) || 0) * 31 + (part.charCodeAt(1) || 0)) & 0xff;
      }
      bytes.push(val & 0xff);
    }
    return bytes;
  }

  // Handle contiguous hex strings or fallback
  const cleanContiguous = macStr.replace(/[^0-9A-Fa-f]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < 12; i += 2) {
    const chunk = cleanContiguous.slice(i, i + 2);
    const val = parseInt(chunk, 16);
    bytes.push(isNaN(val) ? 0 : val & 0xff);
  }
  while (bytes.length < 6) bytes.push(0);
  return bytes.slice(0, 6);
}

/**
 * Parses dotted-quad IPv4 strings into 4 octets.
 */
export function parseIpv4(ipStr?: string): number[] {
  if (!ipStr) return [0, 0, 0, 0];
  const parts = ipStr.split('.');
  const bytes: number[] = [];
  for (let i = 0; i < 4; i++) {
    const val = parseInt(parts[i] || '0', 10);
    bytes.push(isNaN(val) ? 0 : Math.min(255, Math.max(0, val)));
  }
  return bytes;
}

/**
 * Converts a UTF-8 / ASCII string to an array of byte codes.
 */
export function stringToBytes(str?: string): number[] {
  if (!str) return [];
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code & 0xff);
  }
  return bytes;
}

/**
 * Computes the standard Internet Checksum (RFC 1071) over 16-bit words.
 */
export function computeIpv4Checksum(header: number[]): number {
  let sum = 0;
  for (let i = 0; i < 20; i += 2) {
    if (i === 10) continue; // Skip existing checksum field
    const word = ((header[i] || 0) << 8) | (header[i + 1] || 0);
    sum += word;
  }
  while ((sum >> 16) > 0) {
    sum = (sum & 0xffff) + (sum >> 16);
  }
  return (~sum) & 0xffff;
}

/**
 * Formats byte address range into hex badge string (e.g. "0x00–0x0D").
 */
export function formatHexRange(start: number, end: number): string {
  const s = '0x' + start.toString(16).padStart(2, '0').toUpperCase();
  const e = '0x' + end.toString(16).padStart(2, '0').toUpperCase();
  return `${s}–${e}`;
}

/**
 * Formats a raw byte buffer into canonical 16-byte-per-row Wireshark / hexdump -C lines.
 * Layout:
 * 0000  00 1a 2b 3c 4d 99 00 1a  2b 3c 4d 01 08 00 45 00  |..+<M... +<M...E.|
 */
export function formatWiresharkHexDump(bytes: Uint8Array): string {
  if (bytes.length === 0) return '0000                            | |';

  const lines: string[] = [];
  const len = bytes.length;

  for (let offset = 0; offset < len; offset += 16) {
    const chunk = bytes.slice(offset, Math.min(offset + 16, len));
    const offsetStr = offset.toString(16).padStart(4, '0');

    const first8 = chunk.slice(0, 8);
    const second8 = chunk.slice(8, 16);

    let hexCols1 = '';
    for (let i = 0; i < 8; i++) {
      if (i < first8.length) {
        hexCols1 += first8[i].toString(16).padStart(2, '0') + ' ';
      } else {
        hexCols1 += '   ';
      }
    }

    let hexCols2 = '';
    for (let i = 0; i < 8; i++) {
      if (i < second8.length) {
        hexCols2 += second8[i].toString(16).padStart(2, '0') + (i < 7 ? ' ' : '');
      } else {
        hexCols2 += (i < 7 ? '   ' : '  ');
      }
    }

    let ascii = '';
    for (let i = 0; i < chunk.length; i++) {
      const b = chunk[i];
      ascii += (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.';
    }

    lines.push(`${offsetStr}  ${hexCols1} ${hexCols2}  |${ascii}|`);
  }

  return lines.join('\n');
}

/**
 * Encodes any high-level PacketHeader snapshot into a deterministic wire-level binary frame
 * and canonical Wireshark-style hex dump.
 */
export function encodePacketToHexDump(packet: PacketHeader): EncodedHexDump {
  const { L2, L3, L4, payloadDescription = '' } = packet || ({} as PacketHeader);

  // -------------------------------------------------------------------------
  // 1. Layer 2: Ethernet II Header (14 bytes, or 18 bytes if IEEE 802.1Q tagged)
  // -------------------------------------------------------------------------
  const dstMacBytes = parseMac(L2?.dstMac || '00:00:00:00:00:00');
  const srcMacBytes = parseMac(L2?.srcMac || '00:00:00:00:00:00');

  // Determine EtherType
  const ethertypeStr = (L2?.ethertype || '').toLowerCase();
  const l3ProtocolStr = (L3?.protocol || '').toLowerCase();
  const isArp =
    ethertypeStr.includes('0806') ||
    ethertypeStr.includes('arp') ||
    l3ProtocolStr.includes('arp');

  const etherTypeWord = isArp ? 0x0806 : 0x0800;

  const l2Bytes: number[] = [
    ...dstMacBytes,
    ...srcMacBytes,
  ];

  // Optional IEEE 802.1Q VLAN Tagging (4 bytes: TPID 0x8100 + 16-bit TCI)
  const vlanTag = L2?.vlanTag;
  if (vlanTag && typeof vlanTag.vlanId === 'number') {
    const pcp = (vlanTag.pcp || 0) & 0x07;
    const dei = vlanTag.dei ? 1 : 0;
    const vid = vlanTag.vlanId & 0x0fff;
    const tci = (pcp << 13) | (dei << 12) | vid;

    l2Bytes.push(0x81, 0x00); // 802.1Q TPID
    l2Bytes.push((tci >> 8) & 0xff, tci & 0xff); // 802.1Q TCI
  }

  // EtherType
  l2Bytes.push((etherTypeWord >> 8) & 0xff, etherTypeWord & 0xff);

  // -------------------------------------------------------------------------
  // 2. Layer 7 Payload Bytes
  // -------------------------------------------------------------------------
  const payloadBytes = stringToBytes(payloadDescription);

  // -------------------------------------------------------------------------
  // 3. Layer 4 Transport Header
  // -------------------------------------------------------------------------
  const l4Bytes: number[] = [];
  const protocolType = L4?.protocolType || (isArp ? 'ARP' : 'TCP');

  if (isArp) {
    // ARP has no Layer 4 header; payload is encapsulated in L3 ARP structure
  } else if (protocolType === 'TCP' || l3ProtocolStr.includes('tcp') || l3ProtocolStr.includes('6')) {
    // RFC 793 TCP Header (20 bytes)
    const srcPort = L4?.srcPort || 49152;
    const dstPort = L4?.dstPort || 80;
    const seqNum = (L4?.seqNumber || 0) >>> 0;
    const ackNum = (L4?.ackNumber || 0) >>> 0;
    const windowSize = L4?.windowSize ?? 64240;

    // 6-bit control flag bitmask
    const urg = L4?.flags?.urg ? 0x20 : 0;
    const ack = L4?.flags?.ack ? 0x10 : 0;
    const psh = L4?.flags?.psh ? 0x08 : 0;
    const rst = L4?.flags?.rst ? 0x04 : 0;
    const syn = L4?.flags?.syn ? 0x02 : 0;
    const fin = L4?.flags?.fin ? 0x01 : 0;
    const flagsByte = urg | ack | psh | rst | syn | fin;

    l4Bytes.push((srcPort >> 8) & 0xff, srcPort & 0xff); // Source Port
    l4Bytes.push((dstPort >> 8) & 0xff, dstPort & 0xff); // Dest Port
    l4Bytes.push((seqNum >> 24) & 0xff, (seqNum >> 16) & 0xff, (seqNum >> 8) & 0xff, seqNum & 0xff); // Seq Number
    l4Bytes.push((ackNum >> 24) & 0xff, (ackNum >> 16) & 0xff, (ackNum >> 8) & 0xff, ackNum & 0xff); // Ack Number
    l4Bytes.push(0x50); // Data Offset: 5 32-bit words (20 bytes), Reserved: 0
    l4Bytes.push(flagsByte); // TCP Flags
    l4Bytes.push((windowSize >> 8) & 0xff, windowSize & 0xff); // Window Size
    l4Bytes.push(0x1a, 0x2b); // Checksum (deterministic pseudo-checksum)
    l4Bytes.push(0x00, 0x00); // Urgent Pointer
  } else if (protocolType === 'UDP' || l3ProtocolStr.includes('udp') || l3ProtocolStr.includes('17')) {
    // RFC 768 UDP Header (8 bytes)
    const srcPort = L4?.srcPort || 53;
    const dstPort = L4?.dstPort || 53;
    const udpLen = 8 + payloadBytes.length;

    l4Bytes.push((srcPort >> 8) & 0xff, srcPort & 0xff);
    l4Bytes.push((dstPort >> 8) & 0xff, dstPort & 0xff);
    l4Bytes.push((udpLen >> 8) & 0xff, udpLen & 0xff);
    l4Bytes.push(0x00, 0x00); // Checksum
  } else if (protocolType === 'ICMP' || l3ProtocolStr.includes('icmp') || l3ProtocolStr.includes('1')) {
    // RFC 792 ICMP Echo Header (8 bytes)
    const isEchoReply =
      (L4?.icmpType || '').toLowerCase().includes('reply') ||
      (L4?.icmpType || '').includes('0');
    const icmpType = isEchoReply ? 0 : 8; // 8 = Echo Request, 0 = Echo Reply

    l4Bytes.push(icmpType); // Type
    l4Bytes.push(0x00);     // Code
    l4Bytes.push(0x4c, 0x5d); // Checksum
    l4Bytes.push(0x00, 0x01); // Identifier
    l4Bytes.push(0x00, 0x01); // Sequence Number
  } else if (protocolType === 'OSPF' || l3ProtocolStr.includes('ospf') || l3ProtocolStr.includes('89')) {
    // RFC 2328 OSPFv2 Header (24 bytes)
    const ospfTypeStr = (L4?.ospfType || 'Hello').toLowerCase();
    let ospfType = 1; // Hello
    if (ospfTypeStr.includes('dbd')) ospfType = 2;
    else if (ospfTypeStr.includes('lsr')) ospfType = 3;
    else if (ospfTypeStr.includes('lsu')) ospfType = 4;
    else if (ospfTypeStr.includes('lsack')) ospfType = 5;

    const ospfLen = 24 + payloadBytes.length;
    const routerIdBytes = parseIpv4(L3?.srcIp || '1.1.1.1');

    l4Bytes.push(0x02); // OSPF Version 2
    l4Bytes.push(ospfType); // Type
    l4Bytes.push((ospfLen >> 8) & 0xff, ospfLen & 0xff); // Packet Length
    l4Bytes.push(...routerIdBytes); // Router ID (4 bytes)
    l4Bytes.push(0x00, 0x00, 0x00, 0x00); // Area ID: 0.0.0.0
    l4Bytes.push(0x2d, 0x3e); // Checksum
    l4Bytes.push(0x00, 0x00); // AuType (0 = Null Auth)
    l4Bytes.push(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00); // Authentication data (8 bytes)
  }

  // -------------------------------------------------------------------------
  // 4. Layer 3 Header: IPv4 (20 bytes) or ARP (28 bytes)
  // -------------------------------------------------------------------------
  const l3Bytes: number[] = [];

  if (isArp) {
    // RFC 826 ARP Frame (28 bytes)
    const isReply =
      (L4?.icmpType || '').toLowerCase().includes('reply') ||
      payloadDescription.toLowerCase().includes('reply');
    const opcode = isReply ? 0x0002 : 0x0001;

    const senderMac = parseMac(L2?.srcMac || '00:00:00:00:00:00');
    const senderIp = parseIpv4(L3?.srcIp || '0.0.0.0');

    // In ARP Request to broadcast, target MAC in payload is usually 00:00:00:00:00:00
    const targetMac = isReply
      ? parseMac(L2?.dstMac || '00:00:00:00:00:00')
      : [0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    const targetIp = parseIpv4(L3?.dstIp || '0.0.0.0');

    l3Bytes.push(0x00, 0x01); // Hardware Type: Ethernet (1)
    l3Bytes.push(0x08, 0x00); // Protocol Type: IPv4 (0x0800)
    l3Bytes.push(0x06);       // Hardware Size: 6
    l3Bytes.push(0x04);       // Protocol Size: 4
    l3Bytes.push((opcode >> 8) & 0xff, opcode & 0xff); // Opcode (1=Req, 2=Reply)
    l3Bytes.push(...senderMac);
    l3Bytes.push(...senderIp);
    l3Bytes.push(...targetMac);
    l3Bytes.push(...targetIp);
  } else {
    // RFC 791 IPv4 Header (20 bytes)
    const totalLength = 20 + l4Bytes.length + payloadBytes.length;
    const ident = (L3?.identification ?? 0x4120) & 0xffff;
    const dontFragment = L3?.flags?.dontFragment !== false;
    const flagsAndOffset = (dontFragment ? 0x4000 : 0x0000);
    const ttl = Math.min(255, Math.max(1, L3?.ttl || 64));

    // IP Protocol Number
    let ipProto = 6; // TCP
    if (protocolType === 'UDP' || l3ProtocolStr.includes('udp') || l3ProtocolStr.includes('17')) {
      ipProto = 17;
    } else if (protocolType === 'ICMP' || l3ProtocolStr.includes('icmp') || l3ProtocolStr.includes('1')) {
      ipProto = 1;
    } else if (protocolType === 'OSPF' || l3ProtocolStr.includes('ospf') || l3ProtocolStr.includes('89')) {
      ipProto = 89;
    }

    const srcIpBytes = parseIpv4(L3?.srcIp || '192.168.1.1');
    const dstIpBytes = parseIpv4(L3?.dstIp || '192.168.1.2');

    l3Bytes.push(0x45); // Version: 4, IHL: 5 (20 bytes)
    l3Bytes.push(0x00); // DSCP: 0, ECN: 0
    l3Bytes.push((totalLength >> 8) & 0xff, totalLength & 0xff); // Total Length
    l3Bytes.push((ident >> 8) & 0xff, ident & 0xff); // Identification
    l3Bytes.push((flagsAndOffset >> 8) & 0xff, flagsAndOffset & 0xff); // Flags & Frag Offset
    l3Bytes.push(ttl); // TTL
    l3Bytes.push(ipProto); // Protocol
    l3Bytes.push(0x00, 0x00); // Placeholder Checksum
    l3Bytes.push(...srcIpBytes);
    l3Bytes.push(...dstIpBytes);

    // Compute and populate real RFC 1071 Header Checksum
    const cksum = computeIpv4Checksum(l3Bytes);
    l3Bytes[10] = (cksum >> 8) & 0xff;
    l3Bytes[11] = cksum & 0xff;
  }

  // -------------------------------------------------------------------------
  // 5. Total Frame Assembly & Layer Boundaries
  // -------------------------------------------------------------------------
  const totalFrame = new Uint8Array([
    ...l2Bytes,
    ...l3Bytes,
    ...l4Bytes,
    ...payloadBytes,
  ]);

  const l2Start = 0;
  const l2End = l2Bytes.length - 1;

  const l3Start = l2Bytes.length;
  const l3End = l3Start + l3Bytes.length - 1;

  const l4Start = l3End + 1;
  const l4End = l4Bytes.length > 0 ? l4Start + l4Bytes.length - 1 : l3End;

  const payloadStart = l4End + 1;
  const payloadEnd = totalFrame.length > payloadStart ? totalFrame.length - 1 : payloadStart;

  const l2Label = vlanTag && typeof vlanTag.vlanId === 'number'
    ? `L2: ${formatHexRange(l2Start, l2End)} (802.1Q)`
    : `L2: ${formatHexRange(l2Start, l2End)}`;

  const l3Label = isArp
    ? `L3: ${formatHexRange(l3Start, l3End)} (ARP)`
    : `L3: ${formatHexRange(l3Start, l3End)} (IPv4)`;

  const l4Label = l4Bytes.length > 0
    ? `L4: ${formatHexRange(l4Start, l4End)} (${protocolType})`
    : `L4/Payload: ${formatHexRange(l3End + 1, totalFrame.length - 1)}`;

  const layerRanges: LayerByteRanges = {
    l2: {
      start: l2Start,
      end: l2End,
      length: l2Bytes.length,
      hexBadge: l2Label,
    },
    l3: {
      start: l3Start,
      end: l3End,
      length: l3Bytes.length,
      hexBadge: l3Label,
    },
    l4: {
      start: l4Start,
      end: l4End,
      length: l4Bytes.length,
      hexBadge: l4Label,
    },
  };

  if (payloadBytes.length > 0) {
    layerRanges.payload = {
      start: payloadStart,
      end: payloadEnd,
      length: payloadBytes.length,
      hexBadge: `Payload: ${formatHexRange(payloadStart, payloadEnd)}`,
    };
  }

  const hexDump = formatWiresharkHexDump(totalFrame);
  const rawHex = Array.from(totalFrame)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  const result: EncodedHexDump = {
    bytes: totalFrame,
    hexDump,
    rawHex,
    byteCount: totalFrame.length,
    layerRanges,
    toString() {
      return hexDump;
    },
    [Symbol.toPrimitive]() {
      return hexDump;
    },
  };

  return result;
}

/**
 * Builds a comprehensive, formatted JSON capture object containing scenario metadata,
 * every chronological step's decoded headers, authentic wire hex dump, raw bytes, and topology.
 */
export function buildScenarioTraceJson(
  scenario: ProtocolSimulationScenario,
  computedTopology?: { nodes: TopologyNode[]; links: TopologyLink[] }
): ScenarioTraceJson {
  const steps: ScenarioTraceStep[] = (scenario.steps || []).map((step) => {
    const encoded = encodePacketToHexDump(step.transmission.packet);
    return {
      stepIndex: step.stepIndex,
      title: step.title,
      explanation: step.explanation,
      fromNodeId: step.transmission.fromNodeId,
      toNodeId: step.transmission.toNodeId,
      decodedPacket: step.transmission.packet,
      hexDump: encoded.hexDump,
      rawHex: encoded.rawHex,
      byteCount: encoded.byteCount,
      layerRanges: encoded.layerRanges,
    };
  });

  const nodes = computedTopology?.nodes || scenario.topology?.nodes || [];
  const links = computedTopology?.links || scenario.topology?.links || [];

  return {
    captureInfo: {
      title: scenario.metadata.title,
      scenarioId: scenario.metadata.id,
      protocol: scenario.metadata.protocol,
      certification: scenario.metadata.certification,
      difficulty: scenario.metadata.difficulty,
      totalSteps: scenario.steps.length,
      exportTimestamp: new Date().toISOString(),
      engine: 'NetMentor Protocol Explorer Wire-Trace Engine v1.0',
    },
    topologySummary: {
      nodeCount: nodes.length,
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
      })),
      links: links.map((l) => ({
        id: l.id,
        source: l.sourceNodeId,
        target: l.targetNodeId,
        label: l.label,
      })),
    },
    trace: steps,
  };
}
