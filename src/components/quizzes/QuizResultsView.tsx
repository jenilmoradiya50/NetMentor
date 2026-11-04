import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Award,
  Terminal,
  HelpCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  quizzesApi,
  type GradedQuizAttemptResponse,
  type GradedQuestionResultItem,
} from '../../lib/api';

interface QuizResultsViewProps {
  attemptId: string;
  initialAttempt?: GradedQuizAttemptResponse | null;
  onRetake: (quizId: string) => void;
  onBackToHub: () => void;
  onViewLesson?: (lessonId: string) => void;
}

export const QuizResultsView: React.FC<QuizResultsViewProps> = ({
  attemptId,
  initialAttempt,
  onRetake,
  onBackToHub,
  onViewLesson: _onViewLesson,
}) => {
  const [attempt, setAttempt] = useState<GradedQuizAttemptResponse | null>(() => {
    if (initialAttempt && initialAttempt.id === attemptId) {
      return initialAttempt;
    }
    return null;
  });
  const [loading, setLoading] = useState(!initialAttempt || initialAttempt.id !== attemptId);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (initialAttempt && initialAttempt.id === attemptId && (initialAttempt as any).results?.length > 0) {
        setAttempt(initialAttempt);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await quizzesApi.getAttempt(attemptId);
        if (mounted) {
          if (res.data?.success && res.data.attempt) {
            const rawAttempt = res.data.attempt;
            let resultsList = (rawAttempt as any).results;
            if (!resultsList && (rawAttempt as any).resultsJson) {
              try {
                resultsList = JSON.parse((rawAttempt as any).resultsJson);
              } catch {}
            }
            setAttempt({
              ...rawAttempt,
              results: Array.isArray(resultsList) ? resultsList : [],
            });
          } else {
            setError(res.message || 'Failed to load assessment results.');
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Error loading attempt.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [attemptId, initialAttempt]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading assessment review breakdown...</p>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 my-12">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
        <h3 className="text-lg font-semibold text-white">Results Unavailable</h3>
        <p className="text-sm text-slate-400">{error || 'Could not find attempt breakdown.'}</p>
        <button
          onClick={onBackToHub}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
        >
          Return to Quizzes Hub
        </button>
      </div>
    );
  }

  let rawResults = (attempt as any).results;
  if (!rawResults && (attempt as any).resultsJson) {
    try {
      rawResults = JSON.parse((attempt as any).resultsJson);
    } catch {}
  }
  const results: GradedQuestionResultItem[] = Array.isArray(rawResults) ? rawResults : [];
  const score = attempt.score ?? 0;
  const totalQuestions = attempt.totalQuestions ?? results.length;
  const percentage = attempt.percentage ?? (totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0);
  const timeTakenSeconds = attempt.timeTakenSeconds;
  const isPassing = percentage >= 75;

  const filteredResults = results.filter((r) => {
    if (filter === 'correct') return r.isCorrect;
    if (filter === 'incorrect') return !r.isCorrect;
    return true;
  });

  const formatTimer = (totalSeconds?: number) => {
    if (!totalSeconds) return '--';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToHub}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Quizzes</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onRetake(attempt.quizId)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake Assessment</span>
          </button>
        </div>
      </div>

      {/* Score Overview Banner */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border transition relative overflow-hidden ${
          isPassing
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/30'
            : 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex flex-col items-center justify-center border shadow-xl ${
                isPassing
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              }`}
            >
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">{percentage}%</span>
              <span className="text-xs font-bold uppercase tracking-wider mt-0.5">
                {isPassing ? 'Passed' : 'Needs Review'}
              </span>
            </div>

            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <Award className={`w-5 h-5 ${isPassing ? 'text-emerald-400' : 'text-amber-400'}`} />
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {isPassing ? 'Assessment Mastered!' : 'Assessment Completed'}
                </h2>
              </div>
              <p className="text-sm text-slate-300">
                You scored <span className="text-white font-bold">{score}</span> out of{' '}
                <span className="text-white font-bold">{totalQuestions}</span> questions correct.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Time: {formatTimer(timeTakenSeconds)}
                </span>
                <span>•</span>
                <span>Date: {new Date(attempt.completedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex sm:flex-col items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => onRetake(attempt.quizId)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Quiz</span>
            </button>
            <button
              onClick={onBackToHub}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-950/80 border border-slate-800 transition"
            >
              <span>Back to Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-base font-bold text-white">Detailed Question Breakdown</h3>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'all'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({results.length})
          </button>
          <button
            onClick={() => setFilter('incorrect')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'incorrect'
                ? 'bg-red-500/20 text-red-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Incorrect ({results.filter((r) => !r.isCorrect).length})
          </button>
          <button
            onClick={() => setFilter('correct')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filter === 'correct'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Correct ({results.filter((r) => r.isCorrect).length})
          </button>
        </div>
      </div>

      {/* Itemized Questions Review */}
      <div className="space-y-6">
        {filteredResults.map((item, idx) => {
          return (
            <div
              key={item.questionId}
              className={`p-6 rounded-2xl border bg-slate-900 transition space-y-5 ${
                item.isCorrect ? 'border-emerald-500/30' : 'border-red-500/30'
              }`}
            >
              {/* Question Item Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      item.isCorrect
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {item.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    item.isCorrect
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {item.isCorrect ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Correct (+1 pt)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Incorrect (0 pts)</span>
                    </>
                  )}
                </div>
              </div>

              {/* Scenario Context (if present) */}
              {item.scenarioContext && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-500 flex items-center gap-1.5 font-semibold">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Scenario Diagnostic Output:
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{item.scenarioContext}</p>
                </div>
              )}

              {/* Question Text */}
              <p className="text-base font-semibold text-white leading-relaxed">
                {item.question}
              </p>

              {/* Options Breakdown with Highlights */}
              <div className="space-y-2 pt-1">
                {item.type === 'true_false' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[true, false].map((val) => {
                      const isCorrectAnswer =
                        typeof item.correctAnswer === 'boolean'
                          ? item.correctAnswer === val
                          : String(item.correctAnswer).toLowerCase() === String(val);
                      const isUserSelection =
                        typeof item.userAnswer === 'boolean'
                          ? item.userAnswer === val
                          : String(item.userAnswer).toLowerCase() === String(val);

                      let style = 'bg-slate-950 border-slate-800 text-slate-400';
                      if (isCorrectAnswer) {
                        style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200';
                      } else if (isUserSelection && !item.isCorrect) {
                        style = 'bg-red-500/15 border-red-500/50 text-red-200';
                      }

                      return (
                        <div
                          key={String(val)}
                          className={`p-3.5 rounded-xl border flex items-center justify-between font-bold text-sm ${style}`}
                        >
                          <span>{val ? 'True' : 'False'}</span>
                          <div className="flex items-center gap-1 text-xs">
                            {isCorrectAnswer && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                Correct Answer
                              </span>
                            )}
                            {isUserSelection && (
                              <span
                                className={`px-2 py-0.5 rounded font-semibold ${
                                  item.isCorrect
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}
                              >
                                Your Selection
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  item.options.map((opt: any) => {
                    // Check if this option is part of the correct answer
                    let isCorrectAnswer = false;
                    if (Array.isArray(item.correctAnswer)) {
                      isCorrectAnswer = item.correctAnswer.map((x: any) => String(x).toUpperCase()).includes(opt.id.toUpperCase());
                    } else {
                      isCorrectAnswer = String(item.correctAnswer).toUpperCase() === opt.id.toUpperCase();
                    }

                    // Check if user selected this option
                    let isUserSelection = false;
                    if (Array.isArray(item.userAnswer)) {
                      isUserSelection = item.userAnswer.map((x: any) => String(x).toUpperCase()).includes(opt.id.toUpperCase());
                    } else if (item.userAnswer) {
                      isUserSelection = String(item.userAnswer).toUpperCase() === opt.id.toUpperCase();
                    }

                    let cardClass = 'bg-slate-950/70 border-slate-800 text-slate-300';
                    if (isCorrectAnswer) {
                      cardClass = 'bg-emerald-500/15 border-emerald-500/60 text-white font-medium';
                    } else if (isUserSelection && !isCorrectAnswer) {
                      cardClass = 'bg-red-500/15 border-red-500/60 text-red-200';
                    }

                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs sm:text-sm transition ${cardClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCorrectAnswer
                                ? 'bg-emerald-500 text-slate-950'
                                : isUserSelection
                                ? 'bg-red-500 text-white'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span>{opt.text}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          {isCorrectAnswer && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Correct Answer
                            </span>
                          )}
                          {isUserSelection && !isCorrectAnswer && (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-semibold flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Your Answer
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Detailed Technical Explanation */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Technical Explanation:
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {item.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
