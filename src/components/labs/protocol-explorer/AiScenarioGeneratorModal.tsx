import React, { useState } from 'react';
import { Sheet, Button } from '../../ui';
import { generateSimulationScenario } from '../../../lib/api';
import type { ProtocolSimulationScenario, ProtocolFamily, CertificationLevel, DifficultyLevel } from '../../../types/protocol-simulation';
import {
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export interface AiScenarioGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScenarioGenerated: (scenario: ProtocolSimulationScenario) => void;
}

const PRESET_TOPICS = [
  {
    topic: 'OSPF Area ID Mismatch & Adjacency Failure',
    protocol: 'OSPF' as ProtocolFamily,
    certification: 'CCNA' as CertificationLevel,
    difficulty: 'Intermediate' as DifficultyLevel,
    fault: 'R1 in Area 0 and R2 in Area 1 on link Gi0/0 prevent exchange of DBDs.',
  },
  {
    topic: '802.1Q Native VLAN Mismatch on Trunk Link',
    protocol: 'VLAN' as ProtocolFamily,
    certification: 'CCNA' as CertificationLevel,
    difficulty: 'Intermediate' as DifficultyLevel,
    fault: 'SW-1 native VLAN 1 and SW-2 native VLAN 99 cause CDP native VLAN mismatch and traffic leakage.',
  },
  {
    topic: 'BGP Local-Preference Asymmetric Traffic Steering',
    protocol: 'BGP' as ProtocolFamily,
    certification: 'CCNP' as CertificationLevel,
    difficulty: 'Advanced' as DifficultyLevel,
    fault: 'Set LOCAL_PREF 200 on primary transit peer to override default equal-cost path.',
  },
  {
    topic: 'ARP Cache Poisoning & Gratuitous ARP Defense',
    protocol: 'ARP' as ProtocolFamily,
    certification: 'CCNA' as CertificationLevel,
    difficulty: 'Intermediate' as DifficultyLevel,
    fault: 'Malicious host sends unsolicited ARP replies claiming default gateway IP.',
  },
  {
    topic: 'TCP 3-Way Handshake SYN Drop & Zero Window',
    protocol: 'TCP' as ProtocolFamily,
    certification: 'Fundamentals' as CertificationLevel,
    difficulty: 'Beginner' as DifficultyLevel,
    fault: 'Server receive buffer is exhausted, advertising TCP Window Size 0.',
  },
];

export const AiScenarioGeneratorModal: React.FC<AiScenarioGeneratorModalProps> = ({
  isOpen,
  onClose,
  onScenarioGenerated,
}) => {
  const [topic, setTopic] = useState<string>('OSPF Area ID Mismatch');
  const [protocol, setProtocol] = useState<ProtocolFamily>('OSPF');
  const [certification, setCertification] = useState<CertificationLevel>('CCNA');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Intermediate');
  const [faultScenario, setFaultScenario] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectPreset = (preset: typeof PRESET_TOPICS[0]) => {
    setTopic(preset.topic);
    setProtocol(preset.protocol);
    setCertification(preset.certification);
    setDifficulty(preset.difficulty);
    setFaultScenario(preset.fault);
    setErrorMsg(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setErrorMsg('Please specify a networking topic or scenario title.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await generateSimulationScenario({
        topic: topic.trim(),
        protocol,
        certification,
        difficulty,
        faultScenario: faultScenario.trim() || undefined,
      });

      if (!res.data?.success || !res.data.scenario) {
        throw new Error(res.message || res.error || 'Failed to generate simulation scenario.');
      }

      onScenarioGenerated(res.data.scenario);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Scenario generation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="AI Protocol Simulation Generator"
      subtitle="Generate interactive multi-node topologies, wire transmissions, and Cisco IOS break-fix CLI challenges"
      maxWidth="lg"
    >
      <form onSubmit={handleGenerate} className="space-y-5 pt-1">
        {/* Presets Row */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono text-slate-400 block">
            Curated Break-Fix Challenges:
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {PRESET_TOPICS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface border border-border-hairline hover:border-accent/40 text-[11px] font-mono text-slate-300 hover:text-white whitespace-nowrap transition-colors flex-shrink-0 touch-target-44 min-h-[36px]"
              >
                {p.topic.split('&')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Topic Input */}
        <div className="space-y-1.5">
          <label htmlFor="gen-topic" className="text-xs font-semibold text-slate-200 block">
            Lab Topic / Network Fault Scenario:
          </label>
          <input
            id="gen-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. OSPF Area ID Mismatch, BGP AS-Path Prepending, 802.1Q Native VLAN Mismatch"
            maxLength={180}
            className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border-hairline text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent min-h-[44px]"
            required
          />
        </div>

        {/* 3-Column Dropdown Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Protocol */}
          <div className="space-y-1.5">
            <label htmlFor="gen-protocol" className="text-xs font-semibold text-slate-200 block">
              Protocol:
            </label>
            <select
              id="gen-protocol"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as ProtocolFamily)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
            >
              <option value="OSPF" className="bg-canvas text-white">OSPFv2 (L3)</option>
              <option value="BGP" className="bg-canvas text-white">BGP / eBGP (L7/TCP)</option>
              <option value="VLAN" className="bg-canvas text-white">802.1Q VLAN (L2)</option>
              <option value="TCP" className="bg-canvas text-white">TCP (L4)</option>
              <option value="ARP" className="bg-canvas text-white">ARP (L2/L3)</option>
            </select>
          </div>

          {/* Certification Tier */}
          <div className="space-y-1.5">
            <label htmlFor="gen-cert" className="text-xs font-semibold text-slate-200 block">
              Certification:
            </label>
            <select
              id="gen-cert"
              value={certification}
              onChange={(e) => setCertification(e.target.value as CertificationLevel)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
            >
              <option value="CCNA" className="bg-canvas text-white">CCNA 200-301</option>
              <option value="CCNP" className="bg-canvas text-white">CCNP ENCOR 350-401</option>
              <option value="Fundamentals" className="bg-canvas text-white">Fundamentals</option>
            </select>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label htmlFor="gen-diff" className="text-xs font-semibold text-slate-200 block">
              Difficulty:
            </label>
            <select
              id="gen-diff"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent/50 min-h-[44px]"
            >
              <option value="Beginner" className="bg-canvas text-white">Beginner</option>
              <option value="Intermediate" className="bg-canvas text-white">Intermediate</option>
              <option value="Advanced" className="bg-canvas text-white">Advanced</option>
            </select>
          </div>
        </div>

        {/* Optional Fault Context */}
        <div className="space-y-1.5">
          <label htmlFor="gen-fault" className="text-xs font-semibold text-slate-200 block">
            Custom Fault / Break-Fix Context (Optional):
          </label>
          <textarea
            id="gen-fault"
            rows={2}
            value={faultScenario}
            onChange={(e) => setFaultScenario(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. R1 and R2 have mismatched authentication keys, causing OSPF adjacency to fail..."
            className="w-full px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            maxLength={300}
          />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-xs text-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <span className="font-semibold block">Generation Failed</span>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-hairline">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="touch-target-44 min-h-[44px]"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={isLoading || !topic.trim()}
            icon={
              isLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-accent" />
              )
            }
            className="touch-target-44 min-h-[44px] min-w-[170px]"
          >
            <span>{isLoading ? 'Architecting Lab...' : 'Generate Interactive Lab'}</span>
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
