import React, { useState, useEffect } from 'react';
import type { CatalogLab } from '../../types/flashcards';
import { labsApi } from '../../lib/api';
import {
  Network,
  Download,
  Search,
  Info,
  Loader2,
  Terminal,
} from 'lucide-react';

export const PacketTracerLabsView: React.FC = () => {
  const [labs, setLabs] = useState<CatalogLab[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [softwareRequirement, setSoftwareRequirement] = useState('');
  const [browserNotice, setBrowserNotice] = useState('');

  useEffect(() => {
    async function loadLabs() {
      setLoading(true);
      const res = await labsApi.getLabs();
      if (res.data?.labs) {
        setLabs(res.data.labs);
        setSoftwareRequirement(res.data.softwareRequirement);
        setBrowserNotice(res.data.browserExecutionNotice);
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shadow-inner">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Cisco Packet Tracer Hands-On Labs
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60 font-semibold">
                  48 Topologies
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Official supplementary CCNA 200-301 simulation topologies from Jeremy's IT Lab
              </p>
            </div>
          </div>
        </div>

        {/* Browser execution limitation notice */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="leading-relaxed">
              <strong>Execution Notice:</strong> {browserNotice || 'Packet Tracer (.pkt) simulation files contain proprietary Cisco network topologies and cannot run natively inside a web browser. Download the topology file below and open it with your local Cisco Packet Tracer software.'}
            </p>
            <p className="text-slate-400 mt-1">
              Software: {softwareRequirement || 'Cisco Packet Tracer 8.0+ (Free download from Cisco Networking Academy)'}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search labs by topic (e.g. OSPF, VLAN, STP, ACL, NAT, Static Routing)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
          />
        </div>
        <span className="text-xs text-slate-400">
          Showing {filteredLabs.length} of {labs.length} labs
        </span>
      </div>

      {/* Labs Grid */}
      {loading ? (
        <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading Packet Tracer Lab Catalog...</p>
        </div>
      ) : filteredLabs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
          <Terminal className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-300">No matching labs found</h4>
          <p className="text-xs text-slate-500 mt-1">Try searching for a different protocol or CCNA day.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLabs.map((lab) => (
            <div
              key={lab.id}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider px-2 py-0.5 rounded bg-brand-950/60 border border-brand-800/40 font-mono">
                    Day {lab.day < 10 ? `0${lab.day}` : lab.day}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">.pkt topology</span>
                </div>

                <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-300 transition-colors line-clamp-2">
                  {lab.title}
                </h3>
                <p className="text-xs font-mono text-slate-500 mt-1.5 truncate" title={lab.filename}>
                  {lab.filename}
                </p>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Cisco Packet Tracer</span>
                <a
                  href={lab.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={lab.filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-brand-500 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .pkt</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
