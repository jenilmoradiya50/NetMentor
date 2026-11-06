import React, { useState } from 'react';
import { useProtocolSimulation } from '../../../hooks/useProtocolSimulation';
import { PROTOCOL_SIMULATION_CATALOG, TCP_HANDSHAKE_SCENARIO } from '../../../data/simulations';
import { TopologyVisualizer } from './TopologyVisualizer';
import { SimulationPlaybackControls } from './SimulationPlaybackControls';
import { PacketHeaderInspector } from './PacketHeaderInspector';
import { NodeTableInspector } from './NodeTableInspector';
import { Card, Badge } from '../../ui';
import { Network, Info } from 'lucide-react';

export const ProtocolExplorerView: React.FC = () => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    TCP_HANDSHAKE_SCENARIO.metadata.id
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>('host-client');

  const activeScenario =
    PROTOCOL_SIMULATION_CATALOG.find((s) => s.metadata.id === selectedScenarioId) ||
    TCP_HANDSHAKE_SCENARIO;

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
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                {scenario.metadata.description}
              </p>
            </div>
          </div>

          {/* Scenario Selector Dropdown */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <label htmlFor="scenario-select" className="text-xs font-mono text-slate-400 whitespace-nowrap">
              Scenario:
            </label>
            <select
              id="scenario-select"
              value={selectedScenarioId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedScenarioId(nextId);
                const nextScenario = PROTOCOL_SIMULATION_CATALOG.find((s) => s.metadata.id === nextId);
                if (nextScenario) {
                  setScenario(nextScenario);
                  setSelectedNodeId(nextScenario.topology.nodes[0]?.id || 'host-client');
                }
              }}
              className="px-3 py-2 rounded-xl bg-surface border border-border-hairline text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent min-h-[40px]"
            >
              {PROTOCOL_SIMULATION_CATALOG.map((s) => (
                <option key={s.metadata.id} value={s.metadata.id} className="bg-canvas text-white">
                  {s.metadata.title}
                </option>
              ))}
            </select>
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
        onSelectNode={setSelectedNodeId}
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
          onSelectNode={setSelectedNodeId}
          socraticCheckpoint={currentStep.socraticCheckpoint}
          stepTitle={currentStep.title}
          stepIndex={currentStepIndex}
          scenarioTitle={scenario.metadata.title}
          packet={currentStep.transmission.packet}
        />
      </div>
    </div>
  );
};
