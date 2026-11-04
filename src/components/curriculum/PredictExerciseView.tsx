import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Send,
  RotateCcw,
  AlertTriangle,
  Lightbulb,
  Compass,
  Award,
  Bot,
} from 'lucide-react';
import type {
  LessonExercise,
  SequenceItem,
  ExerciseAttemptRecord,
  VisualizerLink,
} from '../../types/curriculum.js';
import { evaluateExerciseAnswer, type ExerciseEvaluationResult } from '../../lib/exercise-evaluator.js';
import { aiApi } from '../../lib/api.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { Card } from '../ui/Card.js';
import { renderInlineMarkdown } from '../ui/MarkdownView.js';

export interface PredictExerciseViewProps {
  exercise: LessonExercise;
  lessonId?: string;
  attemptRecord?: ExerciseAttemptRecord;
  onAttemptSaved?: (attempt: ExerciseAttemptRecord) => void;
  onCompleted?: (isCorrect: boolean) => void;
  title?: string;
  onInspectVisualizer?: (link: VisualizerLink) => void;
  onOpenAiTutor?: (exerciseId: string) => void;
}

export const PredictExerciseView: React.FC<PredictExerciseViewProps> = ({
  exercise,
  lessonId = 'active-lesson',
  attemptRecord,
  onAttemptSaved,
  onCompleted,
  title,
  onInspectVisualizer,
  onOpenAiTutor,
}) => {
  // Input states
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [numericInput, setNumericInput] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');
  const [sequenceList, setSequenceList] = useState<SequenceItem[]>(() => {
    if (!exercise.sequenceItems) return [];
    return [...exercise.sequenceItems].sort(() => Math.random() - 0.5);
  });

  // Attempt & feedback states
  const [hintsRevealed, setHintsRevealed] = useState<number>(attemptRecord?.hintsUsedCount ?? 0);
  const [submitted, setSubmitted] = useState<boolean>(Boolean(attemptRecord && attemptRecord.status !== 'unattempted'));
  const [isCorrect, setIsCorrect] = useState<boolean>(attemptRecord?.status === 'correct');
  const [attemptsCount, setAttemptsCount] = useState<number>(attemptRecord?.attemptsCount ?? 0);
  const [evalResult, setEvalResult] = useState<ExerciseEvaluationResult | null>(null);

  // AI Socratic hint states
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [loadingAiHint, setLoadingAiHint] = useState<boolean>(false);
  const [aiHintError, setAiHintError] = useState<string | null>(null);

  // Sync when exercise changes
  useEffect(() => {
    setSelectedOptionId(null);
    setNumericInput('');
    setTextInput('');
    setAiHint(null);
    setLoadingAiHint(false);
    setAiHintError(null);
    if (exercise.sequenceItems) {
      setSequenceList([...exercise.sequenceItems].sort(() => Math.random() - 0.5));
    }
    const currentAttempt = attemptRecord;
    setHintsRevealed(currentAttempt?.hintsUsedCount ?? 0);
    setSubmitted(Boolean(currentAttempt && currentAttempt.status !== 'unattempted'));
    setIsCorrect(currentAttempt?.status === 'correct');
    setAttemptsCount(currentAttempt?.attemptsCount ?? 0);
    setEvalResult(null);

    // Restore submitted user input if available
    if (currentAttempt && currentAttempt.status !== 'unattempted' && currentAttempt.lastSubmittedAnswer) {
      if (exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') {
        setSelectedOptionId(currentAttempt.lastSubmittedAnswer);
      } else if (exercise.type === 'numerical') {
        setNumericInput(currentAttempt.lastSubmittedAnswer);
      } else if (exercise.type === 'predict_output') {
        setTextInput(currentAttempt.lastSubmittedAnswer);
      } else if (exercise.type === 'sequence') {
        try {
          const ids = JSON.parse(currentAttempt.lastSubmittedAnswer);
          if (Array.isArray(ids) && exercise.sequenceItems) {
            const itemMap = new Map(exercise.sequenceItems.map((item) => [item.id, item]));
            const restored = ids.map((id) => itemMap.get(id)).filter(Boolean) as SequenceItem[];
            if (restored.length === exercise.sequenceItems.length) {
              setSequenceList(restored);
            }
          }
        } catch {}
      }
    }
  }, [exercise.id, attemptRecord]);

  const handleRequestAiHint = async () => {
    if (loadingAiHint) return;
    setLoadingAiHint(true);
    setAiHintError(null);

    const response = await aiApi.askTutor({
      lessonId,
      exerciseId: exercise.id,
      mode: 'socratic_hint',
      query: 'Please provide a Socratic hint to help me reason through this challenge.',
    });

    if (response.status === 200 && response.data?.success) {
      setAiHint(response.data.answer);
    } else {
      if (response.status === 401) {
        setAiHintError('Session expired. Please log in to request AI hints.');
      } else if (response.status === 429) {
        setAiHintError(`Rate limit reached (20 requests/hr). Please wait ${response.retryAfterSeconds || 60}s.`);
      } else {
        setAiHintError(response.message || 'Failed to fetch AI Socratic hint. Please try again.');
      }
    }
    setLoadingAiHint(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let rawAnswer: any = null;
    if (exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') {
      rawAnswer = selectedOptionId;
    } else if (exercise.type === 'numerical') {
      rawAnswer = parseFloat(numericInput.trim());
    } else if (exercise.type === 'predict_output') {
      rawAnswer = textInput.trim();
    } else if (exercise.type === 'sequence') {
      rawAnswer = sequenceList.map((item) => item.id);
    }

    const result = evaluateExerciseAnswer(exercise, rawAnswer);
    const newAttemptsCount = attemptsCount + 1;

    setEvalResult(result);
    setIsCorrect(result.isCorrect);
    setSubmitted(true);
    setAttemptsCount(newAttemptsCount);

    const record: ExerciseAttemptRecord = {
      exerciseId: exercise.id,
      lessonId,
      status: result.isCorrect ? 'correct' : 'incorrect',
      attemptsCount: newAttemptsCount,
      hintsUsedCount: hintsRevealed,
      lastSubmittedAnswer: typeof rawAnswer === 'object' ? JSON.stringify(rawAnswer) : String(rawAnswer),
      lastAttemptedAt: new Date().toISOString(),
    };

    onAttemptSaved?.(record);
    onCompleted?.(result.isCorrect);
  };

  const handleReset = () => {
    setSubmitted(false);
    setIsCorrect(false);
    setEvalResult(null);
    setSelectedOptionId(null);
    setNumericInput('');
    setTextInput('');
    if (exercise.sequenceItems) {
      setSequenceList([...exercise.sequenceItems].sort(() => Math.random() - 0.5));
    }
  };

  const handleInspectVisualizer = () => {
    if (exercise.visualizerLink) {
      const section = document.getElementById('visualizer-section');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      onInspectVisualizer?.(exercise.visualizerLink);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (submitted) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sequenceList.length) return;

    const copy = [...sequenceList];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    setSequenceList(copy);
  };

  const displayTitle = title || exercise.title || 'Predict-First Challenge';

  return (
    <Card variant="elevated" padding="md" className="space-y-4 text-slate-200">
      {/* Header: Title, Type Badge, Attempts Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-warning flex-shrink-0" />
          <h4 className="text-sm font-bold text-white heading-title">{displayTitle}</h4>
        </div>
        <div className="flex items-center gap-2">
          {attemptsCount > 0 && (
            <span className="text-[11px] font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
              {attemptsCount} {attemptsCount === 1 ? 'attempt' : 'attempts'}
            </span>
          )}
          <Badge variant="blue" size="sm">
            {exercise.type.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Learning Objective (if present) */}
      {exercise.learningObjective && (
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-surface-subtle/50 px-3 py-1.5 rounded-lg border border-white/[0.04]">
          <Award className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <span className="truncate">
            <strong className="text-slate-300 font-medium">Objective:</strong> {exercise.learningObjective}
          </span>
        </div>
      )}

      {/* Scenario Context (if provided) */}
      {exercise.scenarioContext && (
        <div className="p-3.5 rounded-xl bg-surface-subtle/90 border border-white/[0.06] text-xs text-slate-300">
          <strong className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider font-semibold">
            Scenario Context:
          </strong>
          <div className="leading-relaxed">{renderInlineMarkdown(exercise.scenarioContext)}</div>
        </div>
      )}

      {/* Question / Prompt */}
      <div className="text-sm sm:text-base font-medium text-white leading-relaxed">
        {renderInlineMarkdown(exercise.prompt)}
      </div>

      {/* Form Interaction Area */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Multiple Choice & Troubleshooting Options */}
        {(exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') && exercise.options && (
          <div className="space-y-2">
            {exercise.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const showResult = submitted;

              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all duration-150 press-scale-subtle min-h-[44px] ${
                    showResult && opt.isCorrect
                      ? 'bg-success/15 border-success/60 text-emerald-100 ring-1 ring-success/30'
                      : showResult && isSelected && !opt.isCorrect
                      ? 'bg-danger/15 border-danger/60 text-rose-100 ring-1 ring-danger/30'
                      : isSelected
                      ? 'bg-accent/15 border-accent/60 text-white ring-1 ring-accent/40 shadow-sm'
                      : 'bg-surface-subtle/80 border-white/[0.06] text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name={`exercise-${exercise.id}`}
                    value={opt.id}
                    disabled={submitted}
                    checked={isSelected}
                    onChange={() => setSelectedOptionId(opt.id)}
                    className="mt-1 accent-accent"
                  />
                  <div className="flex-1 space-y-1">
                    <span className="font-medium leading-relaxed">{renderInlineMarkdown(opt.label)}</span>
                    {showResult && isSelected && (
                      <div className="text-xs text-slate-400 mt-1 italic leading-relaxed">
                        {renderInlineMarkdown(opt.explanation)}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 2. Numerical Input */}
        {exercise.type === 'numerical' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="number"
                disabled={submitted}
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value)}
                placeholder="Enter numerical answer..."
                className="w-48 px-3.5 py-2.5 rounded-xl bg-canvas border border-white/[0.12] text-white font-mono text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent min-h-[42px]"
                required
              />
              <span className="text-xs text-slate-400 font-mono">
                {exercise.numericTolerance ? `± ${exercise.numericTolerance}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* 3. Predict Output / Text Input */}
        {exercise.type === 'predict_output' && (
          <div className="space-y-2">
            <input
              type="text"
              disabled={submitted}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="e.g. 192.168.1.10 or DOWN"
              className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-white/[0.12] text-white font-mono text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent min-h-[42px]"
              required
            />
          </div>
        )}

        {/* 4. Sequence Ordering */}
        {exercise.type === 'sequence' && (
          <div className="space-y-2.5">
            <p className="text-xs text-slate-400">Use arrow controls to place items in correct sequence:</p>
            <div className="space-y-2">
              {sequenceList.map((item, index) => {
                const isItemInCorrectPos = submitted && item.correctIndex === index;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs sm:text-sm font-mono transition-all min-h-[44px] ${
                      submitted
                        ? isItemInCorrectPos
                          ? 'bg-success/15 border-success/50 text-emerald-100'
                          : 'bg-danger/15 border-danger/50 text-rose-100'
                        : 'bg-surface-subtle/80 border-white/[0.08] text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-slate-500 w-5 font-semibold">#{index + 1}</span>
                      <span>{item.text}</span>
                    </span>

                    {!submitted && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveItem(index, 'up')}
                          className="p-2 rounded-lg bg-surface-elevated text-slate-300 hover:text-white disabled:opacity-20 press-scale min-h-[36px] min-w-[36px] flex items-center justify-center border border-white/5"
                          title="Move up"
                          aria-label="Move item up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === sequenceList.length - 1}
                          onClick={() => moveItem(index, 'down')}
                          className="p-2 rounded-lg bg-surface-elevated text-slate-300 hover:text-white disabled:opacity-20 press-scale min-h-[36px] min-w-[36px] flex items-center justify-center border border-white/5"
                          title="Move down"
                          aria-label="Move item down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progressive Reasoning Hints */}
        {exercise.hints && exercise.hints.length > 0 && (
          <div className="space-y-2 pt-1">
            {hintsRevealed > 0 && (
              <div className="space-y-2">
                {exercise.hints.slice(0, hintsRevealed).map((h, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-warning/15 border border-warning/30 text-xs text-amber-200 flex items-start gap-2.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Hint {i + 1}:</strong> {renderInlineMarkdown(h)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!submitted && hintsRevealed < exercise.hints.length && (
              <button
                type="button"
                onClick={() => setHintsRevealed((prev) => prev + 1)}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1.5 font-medium press-scale min-h-[36px]"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>
                  {hintsRevealed === 0
                    ? 'Need a conceptual hint?'
                    : `Reveal next hint (${hintsRevealed + 1} of ${exercise.hints.length})`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* AI Socratic Hint Action & Feedback */}
        <div className="pt-2 border-t border-white/[0.06] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleRequestAiHint}
              disabled={loadingAiHint}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-all press-scale min-h-[36px]"
              aria-label="Ask AI Tutor for a Socratic Hint"
            >
              <Bot className="w-3.5 h-3.5 text-accent" />
              <span>{loadingAiHint ? 'Consulting AI Tutor...' : 'Ask AI Tutor for a Socratic Hint'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                Simulated
              </span>
            </button>

            {onOpenAiTutor && (
              <button
                type="button"
                onClick={() => onOpenAiTutor(exercise.id)}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors min-h-[36px] flex items-center"
              >
                Discuss in Tutor Chat
              </button>
            )}
          </div>

          {/* AI Hint Content Box */}
          {aiHint && (
            <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-100 space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  AI Socratic Guidance
                </span>
                <Badge variant="blue" size="sm">Simulated Tutor</Badge>
              </div>
              <div className="leading-relaxed text-slate-200">
                {renderInlineMarkdown(aiHint)}
              </div>
            </div>
          )}

          {/* AI Hint Error Banner */}
          {aiHintError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2">
              <span>{aiHintError}</span>
              <button
                type="button"
                onClick={handleRequestAiHint}
                className="text-[11px] font-semibold text-rose-200 underline hover:text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Submit / Try Again / Visualizer Link Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!submitted ? (
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={
                Boolean(
                  (exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') &&
                    !selectedOptionId
                ) ||
                Boolean(exercise.type === 'numerical' && !numericInput) ||
                Boolean(exercise.type === 'predict_output' && !textInput.trim())
              }
              icon={<Send className="w-3.5 h-3.5" />}
            >
              <span>Submit Prediction</span>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              <span>Try Again</span>
            </Button>
          )}

          {exercise.visualizerLink && (
            <button
              type="button"
              onClick={handleInspectVisualizer}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-semibold px-3 py-2 rounded-xl bg-surface-subtle border border-white/[0.08] hover:border-white/20 transition-all press-scale min-h-[38px]"
            >
              <Compass className="w-3.5 h-3.5 text-accent" />
              <span>{exercise.visualizerLink.label || 'Inspect in Visualizer'}</span>
            </button>
          )}
        </div>
      </form>

      {/* Post-Submission Deep Feedback Cards */}
      {submitted && (
        <div className="space-y-3 pt-2">
          {/* 1. Status Banner */}
          <div
            className={`p-4 rounded-xl border space-y-2 text-xs transition-all ${
              isCorrect
                ? 'bg-success/15 border-success/40 text-emerald-200'
                : 'bg-danger/15 border-danger/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {isCorrect ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  <span>Excellent Reasoning! Exactly Right.</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-danger flex-shrink-0" />
                  <span>Not Quite — Let's Review the Technical Principle.</span>
                </>
              )}
            </div>

            {/* Expected Answer (if incorrect and available) */}
            {!isCorrect && evalResult?.expectedAnswer && (
              <p className="text-slate-300 font-mono text-[11px]">
                Expected answer: <strong className="text-white">{evalResult.expectedAnswer}</strong>
              </p>
            )}
          </div>

          {/* 2. Common Misconception Callout (if matched) */}
          {!isCorrect && evalResult?.commonMistake && (
            <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <span>Misconception Analysis: {evalResult.commonMistake.mistake}</span>
              </div>
              <div className="text-amber-100/90 leading-relaxed">
                {renderInlineMarkdown(evalResult.commonMistake.explanation)}
              </div>
            </div>
          )}

          {/* 3. Core Technical Principle */}
          <div className="p-4 rounded-xl bg-surface-subtle/90 border border-white/[0.08] text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Lightbulb className="w-4 h-4 text-accent flex-shrink-0" />
              <span>Core Technical Principle:</span>
            </div>
            <div className="leading-relaxed">
              {renderInlineMarkdown(evalResult?.explanation || exercise.explanation)}
            </div>
          </div>

          {/* 4. Practical Exam & Interview Takeaway (if provided) */}
          {(evalResult?.practicalTakeaway || exercise.practicalTakeaway) && (
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sky-300">
                <Award className="w-4 h-4 text-accent flex-shrink-0" />
                <span>CCNA &amp; CCNP Practical Takeaway:</span>
              </div>
              <div className="text-blue-100/90 leading-relaxed">
                {renderInlineMarkdown(evalResult?.practicalTakeaway || exercise.practicalTakeaway || '')}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
