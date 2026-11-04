/**
 * NetMentor Floating Generation Widget (Milestone 3)
 *
 * Provides a persistent, non-blocking UI for monitoring background AI generation tasks
 * (lessons, quizzes, flashcards) across the entire application.
 *
 * Supports:
 * - Minimized pill with real-time stage animation and multi-task counter.
 * - Expanded panel with progress bars, cancellation, retry, and instant result retrieval.
 * - Deep NetMentor dark cyber theme matching existing design language.
 */

import React, { useMemo } from 'react';
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  RotateCcw,
  BookOpen,
  FileQuestion,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Ban,
} from 'lucide-react';
import {
  useGenerationManager,
} from '../../context/GenerationManagerContext';
import type {
  GenerationTaskType,
  GenerationTaskStage,
} from '../../lib/api';

export const FloatingGenerationWidget: React.FC = () => {
  const {
    activeTasks,
    completedTasks,
    failedTasks,
    hasActiveTasks,
    unviewedCompletedCount,
    isWidgetExpanded,
    setIsWidgetExpanded,
    toggleWidgetExpanded,
    cancelTask,
    dismissTask,
    dismissAllCompleted,
    retryTask,
    openTaskResult,
  } = useGenerationManager();

  // Visible tasks: Active tasks + unviewed completed + failed
  const visibleTasks = useMemo(() => {
    // Show active first, then unviewed completed, then failed
    return [...activeTasks, ...completedTasks, ...failedTasks];
  }, [activeTasks, completedTasks, failedTasks]);

  // If there are zero active, completed, or failed tasks, hide widget entirely
  if (visibleTasks.length === 0) {
    return null;
  }

  // Primary active task for minimized pill headline
  const primaryTask = activeTasks[0] || completedTasks[0] || failedTasks[0];

  const getStageInfo = (stage: GenerationTaskStage, status: string) => {
    if (status === 'completed') {
      return { label: 'Complete', percent: 100, color: 'bg-emerald-400' };
    }
    if (status === 'failed') {
      return { label: 'Failed', percent: 100, color: 'bg-red-400' };
    }
    if (status === 'cancelled') {
      return { label: 'Cancelled', percent: 100, color: 'bg-slate-500' };
    }

    switch (stage) {
      case 'queued':
        return { label: 'In Queue', percent: 15, color: 'bg-amber-400' };
      case 'prompting_ai':
        return { label: 'Generating Content', percent: 50, color: 'bg-cyan-400' };
      case 'validating_schema':
        return { label: 'Validating Schema', percent: 80, color: 'bg-cyan-400' };
      case 'persisting':
        return { label: 'Saving Entity', percent: 95, color: 'bg-emerald-400' };
      default:
        return { label: 'Processing', percent: 35, color: 'bg-cyan-400' };
    }
  };

  const getTypeIcon = (type: GenerationTaskType) => {
    switch (type) {
      case 'lesson':
        return <BookOpen className="w-4 h-4 text-indigo-400" />;
      case 'quiz':
        return <FileQuestion className="w-4 h-4 text-cyan-400" />;
      case 'flashcards':
        return <Layers className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getTypeBadge = (type: GenerationTaskType) => {
    switch (type) {
      case 'lesson':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
            Lesson
          </span>
        );
      case 'quiz':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
            Quiz
          </span>
        );
      case 'flashcards':
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
            Flashcards
          </span>
        );
    }
  };

  return (
    <aside
      aria-label="AI Generation Task Monitor"
      className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 flex flex-col items-start select-none font-sans max-w-[calc(100vw-2rem)]"
    >
      {/* Expanded Task Panel */}
      {isWidgetExpanded && (
        <div className="w-[calc(100vw-2rem)] sm:w-[420px] mb-3 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 shadow-2xl shadow-cyan-950/40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-wide flex items-center gap-2">
                  <span>AI Generation Tasks</span>
                  {activeTasks.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {activeTasks.length} active
                    </span>
                  )}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {completedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={dismissAllCompleted}
                  className="px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
                  title="Clear all completed notifications"
                >
                  Clear Done
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsWidgetExpanded(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Minimize widget"
                aria-label="Minimize widget"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Task List */}
          <div className="max-h-[380px] overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-800/40">
            {visibleTasks.map((t) => {
              const stageInfo = getStageInfo(t.currentStage, t.status);
              const isActive = t.status === 'queued' || t.status === 'processing';
              const isCompleted = t.status === 'completed';
              const isFailed = t.status === 'failed';

              return (
                <div key={t.id} className="pt-2.5 first:pt-0 space-y-2">
                  {/* Task Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5 shrink-0">{getTypeIcon(t.taskType)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getTypeBadge(t.taskType)}
                          <span className="text-xs font-bold text-white truncate max-w-[200px]" title={t.title || t.topic}>
                            {t.topic || t.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                          {t.difficulty}
                          {t.inputParams?.questionCount ? ` • ${t.inputParams.questionCount} Questions` : ''}
                          {t.inputParams?.cardCount ? ` • ${t.inputParams.cardCount} Cards` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Stage status indicator badge */}
                    <div className="shrink-0 flex items-center gap-1">
                      {isActive && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{stageInfo.label}</span>
                        </span>
                      )}
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ready</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {isActive && (
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${stageInfo.color}`}
                        style={{ width: `${stageInfo.percent}%` }}
                      />
                    </div>
                  )}

                  {/* Error display if failed */}
                  {isFailed && t.errorMessage && (
                    <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300">
                      {t.errorMessage}
                    </div>
                  )}

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[10px] text-slate-500 font-mono">
                      {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <button
                          type="button"
                          onClick={() => cancelTask(t.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      )}

                      {isCompleted && (
                        <>
                          <button
                            type="button"
                            onClick={() => dismissTask(t.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openTaskResult(t.id)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-sm shadow-emerald-500/20"
                          >
                            <span>Open Result</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </>
                      )}

                      {isFailed && (
                        <>
                          <button
                            type="button"
                            onClick={() => dismissTask(t.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => retryTask(t.id)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition shadow-sm shadow-amber-500/20"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Minimized Floating Pill Button */}
      <div
        role="region"
        aria-label="Active Generation Task Pill"
        onClick={toggleWidgetExpanded}
        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-full cursor-pointer transition-all duration-200 border shadow-xl ${
          hasActiveTasks
            ? 'bg-slate-900/95 border-cyan-500/40 shadow-cyan-950/40 hover:border-cyan-400 text-white'
            : unviewedCompletedCount > 0
            ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/40 hover:border-emerald-400 text-white'
            : 'bg-slate-900/95 border-red-500/40 shadow-red-950/40 hover:border-red-400 text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          {hasActiveTasks ? (
            <div className="relative flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
          ) : unviewedCompletedCount > 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">
                {hasActiveTasks
                  ? `Generating ${primaryTask.taskType}:`
                  : unviewedCompletedCount > 0
                  ? 'Generation Complete:'
                  : 'Generation Failed:'}
              </span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-[120px] sm:max-w-[160px]">
                {primaryTask.topic || primaryTask.title}
              </span>
            </div>
            {hasActiveTasks && (
              <span className="text-[10px] text-cyan-300/80 font-mono">
                {getStageInfo(primaryTask.currentStage, primaryTask.status).label}
                {activeTasks.length > 1 ? ` (+${activeTasks.length - 1} more)` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
          {visibleTasks.length > 1 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {visibleTasks.length}
            </span>
          )}
          {isWidgetExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
    </aside>
  );
};
