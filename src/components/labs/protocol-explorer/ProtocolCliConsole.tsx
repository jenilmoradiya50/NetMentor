import React, { useState, useRef, useEffect } from 'react';
import { Card, Badge, Button } from '../../ui';
import type { CliLogEntry } from '../../../hooks/useProtocolSimulation';
import type { ScenarioCliConfig } from '../../../types/protocol-simulation';
import {
  Terminal,
  CheckCircle2,
  RotateCcw,
  Send,
  HelpCircle,
  Play,
  Check,
  AlertCircle,
} from 'lucide-react';

export interface ProtocolCliConsoleProps {
  cliConfig?: ScenarioCliConfig;
  cliHistory: CliLogEntry[];
  promptHostname: string;
  isObjectiveSolved: boolean;
  onExecuteCommand: (command: string) => { success: boolean; output: string; goalAchieved?: boolean };
  onResetCli: () => void;
  className?: string;
}

export const ProtocolCliConsole: React.FC<ProtocolCliConsoleProps> = ({
  cliConfig,
  cliHistory,
  promptHostname,
  isObjectiveSolved,
  onExecuteCommand,
  onResetCli,
  className = '',
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal log to bottom on new entries
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [cliHistory]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    onExecuteCommand(trimmed);
    setCommandHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setInputVal(commandHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (commandHistory.length === 0 || historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= commandHistory.length) {
        setHistoryIndex(-1);
        setInputVal('');
      } else {
        setHistoryIndex(nextIdx);
        setInputVal(commandHistory[nextIdx]);
      }
    }
  };

  const handleChipClick = (cmd: string) => {
    onExecuteCommand(cmd);
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
  };

  // Quick chips: available commands or common abbreviations
  const quickCommands = cliConfig?.allowedCommands?.map((c) => c.command) || [
    'show running-config',
    'show ip route',
    'help',
  ];

  return (
    <Card
      variant="elevated"
      className={`p-4 sm:p-5 flex flex-col space-y-4 border-border-hairline bg-[#090A0C] shadow-2xl ${className}`}
    >
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-hairline/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-surface-elevated border border-border-hairline flex items-center justify-center text-accent shadow-sm flex-shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white font-mono tracking-tight">
                {cliConfig?.promptHostname || 'Router#'} In-App IOS Console
              </span>
              {cliConfig?.protocolScope && (
                <Badge variant="blue" size="sm">
                  {cliConfig.protocolScope}
                </Badge>
              )}
              {isObjectiveSolved ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  OBJECTIVE VERIFIED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border-hairline text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  Active Session
                </span>
              )}
            </div>
            {cliConfig?.targetNodeId && (
              <span className="text-[11px] text-slate-400 font-mono block">
                Target Node: <strong className="text-slate-200">{cliConfig.targetNodeId}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => handleChipClick('?')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-surface-elevated border border-border-hairline hover:border-accent/40 transition-colors press-scale touch-target-44 min-h-[36px]"
            title="List valid commands"
            aria-label="List valid commands"
          >
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            <span>?</span>
          </button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onResetCli}
            icon={<RotateCcw className="w-3 h-3" />}
            className="touch-target-44 min-h-[36px]"
            title="Reset Terminal Session"
          >
            <span className="text-xs">Reset</span>
          </Button>
        </div>
      </div>

      {/* Lab Objective Banner */}
      {cliConfig?.objective && (
        <div
          className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 transition-all ${
            isObjectiveSolved
              ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
              : 'bg-[#111317] border-border-hairline text-slate-300'
          }`}
        >
          {isObjectiveSolved ? (
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <span className="font-semibold text-white uppercase text-[10px] tracking-wider block font-mono">
              {isObjectiveSolved ? 'Lab Objective Solved' : 'Lab Objective / Break-Fix Challenge'}
            </span>
            <p>{cliConfig.objective}</p>
          </div>
        </div>
      )}

      {/* Monospace Output Window */}
      <div
        ref={logContainerRef}
        role="log"
        aria-live="polite"
        className="h-64 sm:h-72 overflow-y-auto rounded-xl p-3.5 bg-[#090A0C] border border-[#232730] font-mono text-xs text-slate-200 space-y-2 selection:bg-accent/30 focus:outline-none"
        tabIndex={0}
      >
        {cliHistory.map((item) => {
          if (item.type === 'input') {
            return (
              <div key={item.id} className="text-accent flex items-start gap-1 font-semibold">
                <span className="text-slate-500 select-none">&gt;</span>
                <span className="text-white">{item.text}</span>
              </div>
            );
          }
          if (item.type === 'system') {
            return (
              <div
                key={item.id}
                className="text-emerald-400 bg-emerald-950/20 border-l-2 border-emerald-500 pl-2.5 py-1 text-[11px] whitespace-pre-wrap leading-relaxed"
              >
                {item.text}
              </div>
            );
          }
          if (item.type === 'error') {
            return (
              <div
                key={item.id}
                className="text-rose-400 bg-rose-950/20 border-l-2 border-rose-500 pl-2.5 py-1 text-[11px] whitespace-pre-wrap leading-relaxed"
              >
                {item.text}
              </div>
            );
          }
          return (
            <div key={item.id} className="text-slate-300 whitespace-pre-wrap leading-relaxed">
              {item.text}
            </div>
          );
        })}
      </div>

      {/* Mobile-Friendly Quick-Command Chips Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Quick Commands (Tap to execute):</span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">Use ↑/↓ for history</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {quickCommands.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChipClick(cmd)}
              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface border border-border-hairline hover:border-accent/40 text-[11px] font-mono text-slate-300 hover:text-white whitespace-nowrap transition-colors flex-shrink-0 touch-target-44 min-h-[38px] flex items-center gap-1.5 press-scale"
            >
              <Play className="w-2.5 h-2.5 text-accent" />
              <span>{cmd}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Command Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border-hairline focus-within:border-accent focus-within:ring-1 focus-within:ring-accent min-h-[44px]">
          <span className="text-xs font-mono font-bold text-accent select-none whitespace-nowrap">
            {promptHostname}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type Cisco IOS command or '?' for syntax..."
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none min-w-0"
            aria-label="Cisco IOS Command Input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!inputVal.trim()}
          icon={<Send className="w-3.5 h-3.5" />}
          className="touch-target-44 min-h-[44px] px-3.5 flex-shrink-0"
          aria-label="Execute Command"
        >
          <span className="hidden sm:inline text-xs">Run</span>
        </Button>
      </form>
    </Card>
  );
};
