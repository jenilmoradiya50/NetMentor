import React, { useState, useMemo } from 'react';
import { Calculator, Sparkles, Hash, Layers } from 'lucide-react';
import { Button } from '../../ui/Button.js';
import { Badge } from '../../ui/Badge.js';
import { Card } from '../../ui/Card.js';

interface SubnetCalculation {
  ip: string;
  cidr: number;
  maskDecimal: string;
  wildcardDecimal: string;
  networkId: string;
  firstUsable: string;
  lastUsable: string;
  broadcast: string;
  totalHosts: number;
  usableHosts: number;
  interestingOctet: number;
  magicNumber: number;
  binaryBits: { bit: string; isNetwork: boolean; octetIndex: number }[];
}

function calculateSubnet(ipStr: string, cidr: number): SubnetCalculation | null {
  const parts = ipStr.trim().split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }

  // 32-bit integer representations
  const ipInt = ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0);
  const maskInt = cidr === 0 ? 0 : ((0xffffffff << (32 - cidr)) >>> 0);
  const wildcardInt = ~maskInt >>> 0;

  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;

  const intToIp = (num: number) => [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');

  const totalHosts = Math.pow(2, 32 - cidr);
  const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : totalHosts - 2;

  const firstUsableInt = cidr >= 31 ? networkInt : networkInt + 1;
  const lastUsableInt = cidr >= 31 ? broadcastInt : broadcastInt - 1;

  // Interesting octet (1-indexed: 1, 2, 3, or 4)
  const interestingOctet = Math.floor((cidr - 1) / 8) + 1;
  const maskParts = intToIp(maskInt).split('.').map(Number);
  const maskInInteresting = maskParts[interestingOctet - 1] || 0;
  const magicNumber = 256 - maskInInteresting;

  // Build 32 binary bits with coloring
  const binaryBits: { bit: string; isNetwork: boolean; octetIndex: number }[] = [];
  for (let i = 31; i >= 0; i--) {
    const bitVal = (ipInt >>> i) & 1;
    const bitPosFromLeft = 32 - i;
    const isNetwork = bitPosFromLeft <= cidr;
    const octetIndex = Math.floor((31 - i) / 8);
    binaryBits.push({
      bit: String(bitVal),
      isNetwork,
      octetIndex,
    });
  }

  return {
    ip: parts.join('.'),
    cidr,
    maskDecimal: intToIp(maskInt),
    wildcardDecimal: intToIp(wildcardInt),
    networkId: intToIp(networkInt),
    firstUsable: intToIp(firstUsableInt),
    lastUsable: intToIp(lastUsableInt),
    broadcast: intToIp(broadcastInt),
    totalHosts,
    usableHosts,
    interestingOctet,
    magicNumber,
    binaryBits,
  };
}

export const SubnetVisualizer: React.FC = () => {
  const [ipInput, setIpInput] = useState('192.168.10.138');
  const [cidrInput, setCidrInput] = useState(27);

  const calc = useMemo(() => calculateSubnet(ipInput, cidrInput), [ipInput, cidrInput]);

  const handleRandomize = () => {
    const r1 = Math.floor(Math.random() * 223) + 1;
    const r2 = Math.floor(Math.random() * 256);
    const r3 = Math.floor(Math.random() * 256);
    const r4 = Math.floor(Math.random() * 254) + 1;
    const randomPrefix = Math.floor(Math.random() * 15) + 16; // /16 to /30
    setIpInput(`${r1}.${r2}.${r3}.${r4}`);
    setCidrInput(randomPrefix);
  };

  return (
    <Card variant="elevated" padding="md" className="space-y-5 text-slate-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2 heading-title">
            <Calculator className="w-4 h-4 text-success" />
            Interactive Subnet & Binary Breakdown
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Slide prefix or enter IP to observe host boundaries and the Magic Number live.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleRandomize}
          icon={<Sparkles className="w-3.5 h-3.5 text-warning" />}
        >
          <span>Practice Random IP</span>
        </Button>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface-subtle/80 p-4 rounded-xl border border-white/[0.06]">
        <div className="sm:col-span-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 block">Host IPv4 Address:</label>
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            className="w-full px-3.5 py-2 text-base sm:text-xs font-mono rounded-xl bg-canvas border border-white/[0.12] text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            placeholder="e.g. 192.168.1.50"
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Prefix Length (CIDR):</span>
            <Badge variant="blue" size="md">
              /{cidrInput}
            </Badge>
          </div>
          <div className="py-2 flex items-center min-h-[44px]">
            <input
              type="range"
              min="8"
              max="30"
              value={cidrInput}
              onChange={(e) => setCidrInput(parseInt(e.target.value, 10))}
              className="w-full accent-accent cursor-pointer h-2 bg-surface-elevated rounded-lg min-h-[44px]"
              aria-label="CIDR prefix slider"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>/8 (Class A)</span>
            <span>/16 (Class B)</span>
            <span>/24 (Class C)</span>
            <span>/30 (P2P WAN)</span>
          </div>
        </div>
      </div>

      {calc ? (
        <>
          {/* Binary Bitstream Breakdown */}
          <div className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.08] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                32-Bit Binary Breakdown (Network vs. Host)
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-emerald-300 font-medium">Network ({calc.cidr})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <span className="text-sky-300 font-medium">Host ({32 - calc.cidr})</span>
                </span>
              </div>
            </div>

            {/* Binary Blocks (Responsive 2-col on mobile, 4-col on tablet/desktop) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 xs:gap-2 font-mono text-xs">
              {[0, 1, 2, 3].map((octetIdx) => {
                const octetVal = ipInput.split('.')[octetIdx] || '0';
                return (
                  <div
                    key={octetIdx}
                    className="p-1.5 xs:p-2 sm:p-2.5 rounded-xl bg-canvas border border-white/[0.08] flex flex-col items-center gap-1 shadow-inner-light"
                  >
                    <span className="text-[9px] xs:text-[10px] text-slate-400 uppercase tracking-wider font-sans">
                      Octet {octetIdx + 1} ({octetVal})
                    </span>
                    <div className="flex items-center gap-[1px] xs:gap-0.5 justify-center w-full">
                      {calc.binaryBits
                        .filter((b) => b.octetIndex === octetIdx)
                        .map((b, bitIdx) => (
                          <span
                            key={bitIdx}
                            className={`inline-flex items-center justify-center w-2.5 xs:w-3.5 h-4 xs:h-5 text-center font-bold text-[9px] xs:text-[11px] rounded transition-colors ${
                              b.isNetwork
                                ? 'text-emerald-300 bg-success/20'
                                : 'text-sky-300 bg-accent/20'
                            }`}
                          >
                            {b.bit}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Calculated Subnet Boundaries Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Subnet Mask:</span>
              <span className="text-emerald-300 font-bold truncate block">{calc.maskDecimal}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Wildcard Mask:</span>
              <span className="text-slate-300 font-bold truncate block">{calc.wildcardDecimal}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Magic Number:</span>
              <span className="text-warning font-bold truncate block">
                {calc.magicNumber} (Octet {calc.interestingOctet})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Usable Hosts:</span>
              <span className="text-sky-300 font-bold truncate block">
                {calc.usableHosts.toLocaleString()}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-success/30">
              <span className="text-[10px] text-success block uppercase font-bold font-sans">Network ID:</span>
              <span className="text-emerald-300 font-bold truncate block">{calc.networkId}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">First Usable:</span>
              <span className="text-slate-200 font-bold truncate block">{calc.firstUsable}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06]">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Last Usable:</span>
              <span className="text-slate-200 font-bold truncate block">{calc.lastUsable}</span>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-danger/30">
              <span className="text-[10px] text-danger block uppercase font-bold font-sans">Broadcast:</span>
              <span className="text-rose-300 font-bold truncate block">{calc.broadcast}</span>
            </div>
          </div>

          {/* Mental Math Formula Bar */}
          <div className="p-4 rounded-xl bg-success/15 border border-success/30 text-xs flex items-start gap-3">
            <Layers className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300">
                Magic Number Calculation for /{calc.cidr}:
              </p>
              <p className="text-slate-300 leading-relaxed">
                Interesting Octet is #{calc.interestingOctet}. Magic Number is 256 - {256 - calc.magicNumber} ={' '}
                <strong className="text-warning">{calc.magicNumber}</strong>. Subnets start at multiples of {calc.magicNumber}.
                Because {ipInput.split('.')[calc.interestingOctet - 1]} falls in block [{calc.networkId.split('.')[calc.interestingOctet - 1]} to{' '}
                {calc.broadcast.split('.')[calc.interestingOctet - 1]}], this host belongs to network{' '}
                <strong className="text-emerald-300">{calc.networkId}</strong>!
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="p-4 rounded-xl bg-danger/15 border border-danger/30 text-xs text-red-200">
          Invalid IPv4 address format. Please enter an address like 192.168.1.1.
        </div>
      )}
    </Card>
  );
};
