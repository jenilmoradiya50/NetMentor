import React from 'react';
import { Card } from '../../ui';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Gauge,
} from 'lucide-react';

interface SimulationPlaybackControlsProps {
  currentStepIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  stepTitle: string;
  isAtStart: boolean;
  isAtEnd: boolean;
  progressPercentage: number;
  onPlay: () => void;
  onPause: () => void;
  onTogglePlay: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onJumpToStep: (index: number) => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
}

export const SimulationPlaybackControls: React.FC<SimulationPlaybackControlsProps> = ({
  currentStepIndex,
  totalSteps,
  isPlaying,
  playbackSpeed,
  stepTitle,
  isAtStart,
  isAtEnd,
  progressPercentage,
  onTogglePlay,
  onStepForward,
  onStepBackward,
  onJumpToStep,
  onReset,
  onSetSpeed,
}) => {
  const speeds = [0.5, 1, 2];

  return (
    <Card variant="elevated" className="p-4 sm:p-5 space-y-4">
      {/* Top Meta Bar: Step indicator & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-md bg-accent/15 border border-accent/30 text-accent font-mono text-xs font-bold">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <span className="text-sm font-semibold text-white truncate max-w-[280px] sm:max-w-md">
            {stepTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Toggle Pills */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-canvas border border-border-hairline">
            <Gauge className="w-3.5 h-3.5 text-slate-500 ml-2 mr-1" />
            {speeds.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetSpeed(s)}
                className={`px-2 py-1 text-xs font-mono rounded-md transition-all touch-target-44 min-w-[36px] sm:min-w-[40px] ${
                  playbackSpeed === s
                    ? 'bg-accent text-canvas font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Set playback speed to ${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step Scrubber Slider */}
      <div className="space-y-1.5">
        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) => onJumpToStep(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-canvas rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-2 focus:ring-accent/40 border border-border-hairline"
            aria-label="Simulation step scrubber"
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-0.5">
          <span>Start (Handshake Sync)</span>
          <span className="text-accent">{progressPercentage}% Complete</span>
          <span>Teardown (TIME_WAIT)</span>
        </div>
      </div>

      {/* Primary Playback Transport Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          disabled={isAtStart && !isPlaying}
          className="touch-target-44 px-3 py-2 rounded-xl bg-surface border border-border-hairline text-slate-300 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 text-xs font-medium"
          title="Rewind to Step 1"
          aria-label="Rewind simulation to beginning"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          <span className="hidden xs:inline">Reset</span>
        </button>

        {/* Center Transport Cluster */}
        <div className="flex items-center gap-2">
          {/* Step Back */}
          <button
            type="button"
            onClick={onStepBackward}
            disabled={isAtStart}
            className="touch-target-44 w-11 h-11 rounded-xl bg-surface border border-border-hairline text-slate-200 hover:text-white hover:border-accent/40 hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center press-scale"
            title="Step backward"
            aria-label="Step backward to previous packet"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Play / Pause Toggle */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="touch-target-44 min-w-[52px] h-12 px-4 rounded-xl bg-accent hover:bg-accent-vivid text-canvas font-bold shadow-lg shadow-accent/25 border border-amber-400 transition-all flex items-center justify-center gap-2 press-scale"
            title={isPlaying ? 'Pause simulation' : isAtEnd ? 'Replay from start' : 'Play simulation'}
            aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span className="text-xs uppercase font-mono font-bold tracking-wider hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current ml-0.5" />
                <span className="text-xs uppercase font-mono font-bold tracking-wider hidden sm:inline">
                  {isAtEnd ? 'Replay' : 'Play'}
                </span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            type="button"
            onClick={onStepForward}
            disabled={isAtEnd}
            className="touch-target-44 w-11 h-11 rounded-xl bg-surface border border-border-hairline text-slate-200 hover:text-white hover:border-accent/40 hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center press-scale"
            title="Step forward"
            aria-label="Step forward to next packet"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Step Counter Badge */}
        <div className="text-right hidden xs:block">
          <span className="text-[11px] font-mono text-slate-400 block">Status</span>
          <span className={`text-xs font-mono font-semibold ${isPlaying ? 'text-accent animate-pulse' : 'text-emerald-400'}`}>
            {isPlaying ? 'TRANSIT' : isAtEnd ? 'CONVERGED' : 'STEPPED'}
          </span>
        </div>
      </div>
    </Card>
  );
};
