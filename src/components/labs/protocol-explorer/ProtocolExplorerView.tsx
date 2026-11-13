import React, { useState, useEffect } from 'react';
import { useProtocolSimulation } from '../../../hooks/useProtocolSimulation';
import { PROTOCOL_SIMULATION_CATALOG, TCP_HANDSHAKE_SCENARIO } from '../../../data/simulations';
import type {
  ProtocolSimulationScenario,
  ActiveLabContext,
  ActiveLabCliEntry,
  ActiveLabTablesSummary,
} from '../../../types/protocol-simulation';
import {
  fetchSavedSimulations,
  saveCustomSimulation,
  deleteSavedSimulation,
  fetchCompletedSimulations,
  markSimulationCompleted,
  getCompletedSimulationIds,
} from '../../../lib/api';
import { TopologyVisualizer } from './TopologyVisualizer';
import { SimulationPlaybackControls } from './SimulationPlaybackControls';
import { PacketHeaderInspector } from './PacketHeaderInspector';
import { NodeTableInspector } from './NodeTableInspector';
import { ProtocolCliConsole } from './ProtocolCliConsole';
import { AiScenarioGeneratorModal } from './AiScenarioGeneratorModal';
import { Card, Badge, Button } from '../../ui';
import { Network, Info, Sparkles, Trash2, Download } from 'lucide-react';
import { buildScenarioTraceJson } from '../../../utils/packetHexEncoder';


export interface ProtocolExplorerViewProps {
  initialScenarioId?: string | null;
  onLabContextChange?: (context: ActiveLabContext | null) => void;
}

export const ProtocolExplorerView: React.FC<ProtocolExplorerViewProps> = ({
  initialScenarioId,
  onLabContextChange,
}) => {
  const initialScenario =
    (initialScenarioId &&
      PROTOCOL_SIMULATION_CATALOG.find((s) => s.metadata.id === initialScenarioId)) ||
    TCP_HANDSHAKE_SCENARIO;

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    initialScenario.metadata.id
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    initialScenario.topology.nodes[0]?.id || 'host-client'
  );
  const [customScenarios, setCustomScenarios] = useState<ProtocolSimulationScenario[]>([]);
  const [completedScenarioIds, setCompletedScenarioIds] = useState<string[]>(() =>
    getCompletedSimulationIds()
  );
  const [isGenModalOpen, setIsGenModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fullCatalog = [...PROTOCOL_SIMULATION_CATALOG, ...customScenarios];

  const activeScenario =
    fullCatalog.find((s) => s.metadata.id === selectedScenarioId) ||
    initialScenario;

  const {
    scenario,
    currentStepIndex,
    currentStep,
    totalSteps,
    isPlaying,
    playbackSpeed,
    inspectedLayer,
    computedTopology,
    isAtStart,
    isAtEnd,
    progressPercentage,
    cliHistory,
    promptHostname,
    activePrompt,
    cliMode,
    cliSubModeLabel,
    isObjectiveSolved,
    activeCliNodeId,
    setActiveCliNodeId,
    executeCliCommand,
    resetCli,
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    jumpToStep,
    reset,
    setSpeed,
    setInspectedLayer,
    setScenario,
  } = useProtocolSimulation(activeScenario);

  // Load completed lab scenarios and saved custom simulations on mount
  useEffect(() => {
    let isMounted = true;

    fetchCompletedSimulations()
      .then((ids) => {
        if (isMounted && Array.isArray(ids)) {
          setCompletedScenarioIds(ids);
        }
      })
      .catch((err) => {
        console.warn('[Protocol Explorer] Could not load completed simulations:', err);
      });

    fetchSavedSimulations()
      .then((records) => {
        if (!isMounted) return;
        const scenarios = records
          .map((r) => r.scenario)
          .filter((s): s is ProtocolSimulationScenario => Boolean(s?.metadata?.id));
        if (scenarios.length > 0) {
          setCustomScenarios(scenarios);
          if (initialScenarioId) {
            const match = scenarios.find((s) => s.metadata.id === initialScenarioId);
            if (match) {
              setSelectedScenarioId(match.metadata.id);
              setScenario(match);
              setSelectedNodeId(match.topology.nodes[0]?.id || 'host-client');
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[Protocol Explorer] Could not load saved simulations:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [initialScenarioId, setScenario]);

  // Auto-record completion when CLI break-fix objective is verified
  useEffect(() => {
    if (isObjectiveSolved && scenario.metadata?.id) {
      const scenarioId = scenario.metadata.id;
      if (!completedScenarioIds.includes(scenarioId)) {
        setCompletedScenarioIds((prev) => Array.from(new Set([...prev, scenarioId])));
        markSimulationCompleted({
          scenarioId,
          protocol: scenario.metadata.protocol,
          certification: scenario.metadata.certification,
        }).catch((err) => {
          console.warn('[Protocol Explorer] Failed to record scenario completion:', err);
        });
      }
    }
  }, [isObjectiveSolved, scenario.metadata, completedScenarioIds]);

  // Compute live active node protocol state and recent CLI history for telemetry
  const activeNode =
    computedTopology?.nodes?.find((n) => n.id === activeCliNodeId) ||
    computedTopology?.nodes?.find((n) => n.id === selectedNodeId) ||
    computedTopology?.nodes?.[0];

  const activeNodeTablesSummary: ActiveLabTablesSummary | undefined = activeNode
    ? {
        ospfNeighbors: activeNode.tableState?.ospfNeighbors?.length
          ? `${activeNode.tableState.ospfNeighbors.length} neighbors (${activeNode.tableState.ospfNeighbors
              .map((n) => `${n.neighborId}:${n.state}`)
              .join(', ')})`
          : undefined,
        routingTable: activeNode.tableState?.routingTable?.length
          ? `${activeNode.tableState.routingTable.length} routes`
          : undefined,
        arpCache: activeNode.tableState?.arpCache?.length
          ? `${activeNode.tableState.arpCache.length} entries`
          : undefined,
        macTable: activeNode.tableState?.macTable?.length
          ? `${activeNode.tableState.macTable.length} dynamic entries`
          : undefined,
        tcpState: activeNode.tableState?.tcpState || undefined,
      }
    : undefined;

  const parsedCliCommands: ActiveLabCliEntry[] = [];
  for (let i = 0; i < (cliHistory || []).length; i++) {
    const entry = cliHistory[i];
    if (entry.type === 'input') {
      const spaceIdx = entry.text.indexOf(' ');
      const prompt = spaceIdx > 0 ? entry.text.slice(0, spaceIdx) : 'Router#';
      const command = spaceIdx > 0 ? entry.text.slice(spaceIdx + 1) : entry.text;
      const nextEntry = cliHistory[i + 1];
      const outputText =
        nextEntry && (nextEntry.type === 'output' || nextEntry.type === 'error') ? nextEntry.text : '';
      const outputSummary =
        outputText.length > 250 ? outputText.slice(0, 247) + '...' : outputText;
      parsedCliCommands.push({
        prompt,
        command,
        outputSummary,
      });
    }
  }
  const recentCliCommands: ActiveLabCliEntry[] = parsedCliCommands.slice(-6);

  // Emit live ActiveLabContext telemetry to parent whenever lab state evolves
  useEffect(() => {
    if (!onLabContextChange) return;

    const labCtx: ActiveLabContext = {
      scenarioId: activeScenario.metadata.id,
      title: activeScenario.metadata.title,
      protocol: activeScenario.metadata.protocol,
      certification: activeScenario.metadata.certification,
      difficulty: activeScenario.metadata.difficulty,
      objective: activeScenario.metadata.description || activeScenario.steps?.[0]?.explanation,
      currentStepIndex,
      totalSteps,
      currentStepTitle: currentStep?.title,
      activeCliNodeId: activeNode?.id || activeCliNodeId,
      activeCliNodeName: activeNode?.name || promptHostname,
      activePrompt,
      isObjectiveSolved,
      recentCliCommands,
      activeNodeTablesSummary,
    };

    onLabContextChange(labCtx);
  }, [
    onLabContextChange,
    activeScenario.metadata.id,
    activeScenario.metadata.title,
    activeScenario.metadata.protocol,
    activeScenario.metadata.certification,
    activeScenario.metadata.difficulty,
    activeScenario.metadata.description,
    currentStepIndex,
    totalSteps,
    currentStep?.title,
    activeNode?.id,
    activeNode?.name,
    activeCliNodeId,
    promptHostname,
    activePrompt,
    isObjectiveSolved,
    cliHistory.length,
    activeNodeTablesSummary?.ospfNeighbors,
    activeNodeTablesSummary?.routingTable,
    activeNodeTablesSummary?.arpCache,
    activeNodeTablesSummary?.macTable,
    activeNodeTablesSummary?.tcpState,
  ]);

  // Emit null on unmount
  useEffect(() => {
    return () => {
      onLabContextChange?.(null);
    };
  }, [onLabContextChange]);


  // Synchronize scenario state when initialScenarioId prop changes from parent navigation
  useEffect(() => {
    if (initialScenarioId) {
      const match = fullCatalog.find((s) => s.metadata.id === initialScenarioId);
      if (match && match.metadata.id !== selectedScenarioId) {
        setSelectedScenarioId(match.metadata.id);
        setScenario(match);
        setSelectedNodeId(match.topology.nodes[0]?.id || 'host-client');
      }
    }
  }, [initialScenarioId, selectedScenarioId, setScenario, fullCatalog]);

  const handleCustomScenarioGenerated = async (newScenario: ProtocolSimulationScenario) => {
    setCustomScenarios((prev) => [
      newScenario,
      ...prev.filter((s) => s.metadata.id !== newScenario.metadata.id),
    ]);
    setSelectedScenarioId(newScenario.metadata.id);
    setScenario(newScenario);
    setSelectedNodeId(newScenario.topology.nodes[0]?.id || 'node-1');

    try {
      await saveCustomSimulation(newScenario);
    } catch (err) {
      console.warn('[Protocol Explorer] Failed to auto-save custom simulation:', err);
    }
  };

  const isCustomScenario = customScenarios.some((s) => s.metadata.id === selectedScenarioId);

  const handleDeleteActiveScenario = async () => {
    if (!isCustomScenario) return;
    const confirmDelete = window.confirm(`Delete custom lab "${activeScenario.metadata.title}"?`);
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteSavedSimulation(selectedScenarioId);
      const remaining = customScenarios.filter((s) => s.metadata.id !== selectedScenarioId);
      setCustomScenarios(remaining);
      const fallback = PROTOCOL_SIMULATION_CATALOG[0] || TCP_HANDSHAKE_SCENARIO;
      setSelectedScenarioId(fallback.metadata.id);
      setScenario(fallback);
      setSelectedNodeId(fallback.topology.nodes[0]?.id || 'host-client');
      if (typeof window !== 'undefined') {
        const isLabsRoute =
          window.location.pathname.startsWith('/labs') ||
          new URLSearchParams(window.location.search).get('tab') === 'labs';
        if (isLabsRoute) {
          window.history.replaceState({}, '', `/labs/${encodeURIComponent(fallback.metadata.id)}`);
        }
      }
    } catch (err) {
      console.error('[Protocol Explorer] Failed to delete custom simulation:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportTrace = () => {
    try {
      const traceData = buildScenarioTraceJson(activeScenario, computedTopology);
      const jsonStr = JSON.stringify(traceData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeScenario.metadata.id}-wire-trace.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Protocol Explorer] Failed to export trace JSON:', err);
    }
  };

  if (!currentStep) return null;

  return (
    <div className="space-y-6">
      {/* Simulation Scenario Header & Objective Banner */}
      <Card variant="elevated" className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center shadow-md shadow-accent/10 flex-shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight heading-title">
                  {scenario.metadata.title}
                </h2>
                <Badge variant="blue">{scenario.metadata.certification}</Badge>
                <Badge variant="amber">{scenario.metadata.protocol}</Badge>
                <Badge variant="green">{scenario.metadata.difficulty}</Badge>
                {isCustomScenario && (
                  <Badge variant="purple">Saved AI Lab</Badge>
                )}
                {completedScenarioIds.includes(scenario.metadata.id) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-600/70 font-bold shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                    ✓ SOLVED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {scenario.metadata.description}
              </p>
            </div>
          </div>

          {/* Scenario Selector Dropdown & AI Generator Launch Button */}
          <div className="flex items-center gap-2.5 self-start md:self-center flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="scenario-select" className="text-xs font-mono text-slate-400 whitespace-nowrap">
                Scenario:
              </label>
              <select
                id="scenario-select"
                value={selectedScenarioId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedScenarioId(nextId);
                  const nextScenario = fullCatalog.find((s) => s.metadata.id === nextId);
                  if (nextScenario) {
                    setScenario(nextScenario);
                    setSelectedNodeId(nextScenario.topology.nodes[0]?.id || 'host-client');
                    if (typeof window !== 'undefined') {
                      const isLabsRoute =
                        window.location.pathname.startsWith('/labs') ||
                        new URLSearchParams(window.location.search).get('tab') === 'labs';
                      if (isLabsRoute) {
                        window.history.replaceState({}, '', `/labs/${encodeURIComponent(nextId)}`);
                      }
                    }
                  }
                }}
                className="px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent min-h-[40px] max-w-[200px] sm:max-w-xs"
              >
                <optgroup label="Core Curriculum Labs" className="bg-canvas text-slate-400 font-semibold">
                  {PROTOCOL_SIMULATION_CATALOG.map((s) => {
                    const isSolved = completedScenarioIds.includes(s.metadata.id);
                    return (
                      <option key={s.metadata.id} value={s.metadata.id} className="bg-canvas text-white">
                        {isSolved ? `✓ ${s.metadata.title}` : s.metadata.title}
                      </option>
                    );
                  })}
                </optgroup>
                {customScenarios.length > 0 && (
                  <optgroup label="My Saved AI Labs" className="bg-canvas text-accent font-semibold">
                    {customScenarios.map((s) => {
                      const isSolved = completedScenarioIds.includes(s.metadata.id);
                      return (
                        <option key={s.metadata.id} value={s.metadata.id} className="bg-canvas text-white">
                          {isSolved ? `✓ ★ ${s.metadata.title}` : `★ ${s.metadata.title}`}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
              </select>
            </div>

            {isCustomScenario && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteActiveScenario}
                disabled={isDeleting}
                icon={<Trash2 className="w-3.5 h-3.5" />}
                className="touch-target-44 min-h-[40px]"
                title="Delete this custom saved simulation"
              >
                <span className="hidden sm:inline">Delete Lab</span>
                <span className="sm:hidden">Delete</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsGenModalOpen(true)}
              icon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
              className="touch-target-44 min-h-[40px]"
              title="Generate custom networking scenario with AI"
            >
              <span className="hidden sm:inline">AI Generate Lab</span>
              <span className="sm:hidden">AI Lab</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportTrace}
              icon={<Download className="w-3.5 h-3.5 text-accent" />}
              className="touch-target-44 min-h-[40px]"
              title="Download wire-level JSON packet trace"
            >
              <span className="hidden sm:inline">Export Trace</span>
              <span className="sm:hidden">Trace</span>
            </Button>
          </div>
        </div>

        {/* Current Step Explanation & Socratic Context */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-surface border border-border-hairline text-xs sm:text-sm text-slate-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-white block">
              Step {currentStepIndex + 1}: {currentStep.title}
            </span>
            <p className="text-slate-300 text-xs leading-relaxed">
              {currentStep.explanation}
            </p>
          </div>
        </div>
      </Card>

      {/* Main Interactive Stage: Topology Visualizer */}
      <TopologyVisualizer
        topology={computedTopology}
        activeStep={currentStep}
        isPlaying={isPlaying}
        selectedNodeId={selectedNodeId}
        onSelectNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setActiveCliNodeId(nodeId);
        }}
      />

      {/* Playback & Scrubbing Controller */}
      <SimulationPlaybackControls
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        stepTitle={currentStep.title}
        isAtStart={isAtStart}
        isAtEnd={isAtEnd}
        progressPercentage={progressPercentage}
        onPlay={play}
        onPause={pause}
        onTogglePlay={togglePlay}
        onStepForward={stepForward}
        onStepBackward={stepBackward}
        onJumpToStep={jumpToStep}
        onReset={reset}
        onSetSpeed={setSpeed}
      />

      {/* Topic-Bounded In-App Cisco IOS CLI Console */}
      <ProtocolCliConsole
        cliConfig={scenario.cliConfig}
        cliHistory={cliHistory}
        promptHostname={promptHostname}
        activePrompt={activePrompt}
        cliMode={cliMode}
        cliSubModeLabel={cliSubModeLabel}
        isObjectiveSolved={isObjectiveSolved}
        activeCliNodeId={activeCliNodeId}
        nodes={computedTopology.nodes}
        targetNodeId={scenario.cliConfig?.targetNodeId}
        onSelectCliNode={(nodeId) => {
          setActiveCliNodeId(nodeId);
          setSelectedNodeId(nodeId);
        }}
        onExecuteCommand={executeCliCommand}
        onResetCli={resetCli}
      />

      {/* Deep Inspection Grid: Header Ladder & Node Internal States */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Packet Header Encapsulation Inspector */}
        <PacketHeaderInspector
          packet={currentStep.transmission.packet}
          inspectedLayer={inspectedLayer}
          onSelectLayer={setInspectedLayer}
          stepIndex={currentStepIndex}
        />

        {/* Right Column: Node Tables & Socratic Checkpoint Inspector */}
        <NodeTableInspector
          nodes={computedTopology.nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setActiveCliNodeId(nodeId);
          }}
          socraticCheckpoint={currentStep.socraticCheckpoint}
          stepTitle={currentStep.title}
          stepIndex={currentStepIndex}
          scenarioTitle={scenario.metadata.title}
          packet={currentStep.transmission.packet}
        />
      </div>

      {/* AI Scenario Generator Sheet Modal */}
      <AiScenarioGeneratorModal
        isOpen={isGenModalOpen}
        onClose={() => setIsGenModalOpen(false)}
        onScenarioGenerated={handleCustomScenarioGenerated}
      />
    </div>
  );
};
