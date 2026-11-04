import React, { useState, useEffect } from 'react';
import type { CatalogLab } from '../../types/flashcards';
import { labsApi } from '../../lib/api';
import { JEREMY_PACKET_TRACER_LABS } from '../../data/catalog';
import { Card, Badge } from '../ui';
import {
  Network,
  Download,
  Search,
  Info,
  Loader2,
  Terminal,
} from 'lucide-react';

export const PacketTracerLabsView: React.FC = () => {
  const [labs, setLabs] = useState<CatalogLab[]>(JEREMY_PACKET_TRACER_LABS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [softwareRequirement, setSoftwareRequirement] = useState('');
  const [browserNotice, setBrowserNotice] = useState('');

  useEffect(() => {
    async function loadLabs() {
      setLoading(true);
      try {
        const res = await labsApi.getLabs();
        if (res.data?.labs && res.data.labs.length > 0) {
          setLabs(res.data.labs);
          setSoftwareRequirement(res.data.softwareRequirement);
          setBrowserNotice(res.data.browserExecutionNotice);
        } else {
          setLabs(JEREMY_PACKET_TRACER_LABS);
        }
      } catch {
        setLabs(JEREMY_PACKET_TRACER_LABS);
      }
      setLoading(false);
    }
    loadLabs();
  }, []);

  const filteredLabs = labs.filter((lab) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lab.title.toLowerCase().includes(q) ||
      lab.filename.toLowerCase().includes(q) ||
      `day ${lab.day}`.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card variant="elevated" className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white border border-brand-400/30 flex items-center justify-center shadow-md shadow-brand-500/25 flex-shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight heading-title">
                  Cisco Packet Tracer Hands-On Labs
                </h2>
                <Badge variant="blue">48 Topologies</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Official supplementary CCNA 200-301 simulation topologies from Jeremy's IT Lab
              </p>
            </div>
          </div>
        </div>

        {/* Browser execution limitation notice */}
        <div className="p-3.5 rounded-xl bg-surface-subtle/90 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="leading-relaxed">
              <strong className="text-white font-medium">Execution Notice:</strong>{' '}
              {browserNotice ||
                'Packet Tracer (.pkt) simulation files contain proprietary Cisco network topologies and cannot run natively inside a web browser. Download the topology file below and open it with your local Cisco Packet Tracer software.'}
            </p>
            <p className="text-slate-400 text-[11px]">
              Software:{' '}
              {softwareRequirement ||
                'Cisco Packet Tracer 8.0+ (Free download from Cisco Networking Academy)'}
            </p>
          </div>
        </div>
      </Card>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search labs (OSPF, VLAN, STP, ACL, NAT, Static Routing)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-subtle border border-slate-700/80 text-base sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all min-h-[42px]"
          />
        </div>
        <span className="text-xs text-slate-400">
          Showing {filteredLabs.length} of {labs.length} labs
        </span>
      </div>

      {/* Labs Grid */}
      {loading ? (
        <Card variant="subtle" className="p-16 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading Packet Tracer Lab Catalog...</p>
        </Card>
      ) : filteredLabs.length === 0 ? (
        <Card variant="subtle" className="p-12 text-center">
          <Terminal className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">No matching labs found</h4>
          <p className="text-xs text-slate-400 mt-1">Try searching for a different protocol or CCNA day.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLabs.map((lab) => (
            <Card
              key={lab.id}
              variant="interactive"
              className="p-4 flex flex-col justify-between group h-full"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <Badge variant="blue">
                    Day {lab.day < 10 ? `0${lab.day}` : lab.day}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-mono">.pkt topology</span>
                </div>

                <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors line-clamp-2">
                  {lab.title}
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-1.5 truncate" title={lab.filename}>
                  {lab.filename}
                </p>
              </div>

              <div className="pt-3 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 truncate">Cisco Packet Tracer</span>
                <a
                  href={lab.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={lab.filename}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-500/20 border border-brand-400/30 transition-all select-none press-scale min-h-[38px] flex-shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .pkt</span>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
