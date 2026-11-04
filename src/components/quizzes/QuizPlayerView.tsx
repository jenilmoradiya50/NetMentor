import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  Terminal,
  Send,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import {
  quizzesApi,
  type ClientQuizData,
  type ClientQuizQuestionItem,
  type GradedQuizAttemptResponse,
} from '../../lib/api';

interface QuizPlayerViewProps {
  quizId: string;
  onComplete: (attemptId: string, preloadedAttempt?: GradedQuizAttemptResponse) => void;
  onExit: () => void;
}

export const QuizPlayerView: React.FC<QuizPlayerViewProps> = ({
  quizId,
  onComplete,
  onExit,
}) => {
  const [quiz, setQuiz] = useState<ClientQuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // Load quiz
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await quizzesApi.getQuiz(quizId);
        if (mounted) {
          if (res.data?.success && res.data.quiz) {
            setQuiz(res.data.quiz);
          } else {
            setError(res.message || 'Failed to load quiz details.');
          }
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || 'Error loading quiz.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [quizId]);

  // Elapsed timer
  useEffect(() => {
    if (loading || isSubmitting || !quiz) return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isSubmitting, quiz]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading assessment questions...</p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 my-12">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <h3 className="text-lg font-semibold text-white">Quiz Unavailable</h3>
        <p className="text-sm text-slate-400">{error || 'Unable to retrieve quiz.'}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
        >
          Return to Quizzes Hub
        </button>
      </div>
    );
  }

  const currentQ: ClientQuizQuestionItem = quiz.questions[currentIndex];
  const currentAnswer = answers[currentQ.id];

  // Helper to check if question is answered
  const isQuestionAnswered = (qId: string) => {
    const ans = answers[qId];
    if (ans === undefined || ans === null) return false;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === 'string') return ans.trim().length > 0;
    if (typeof ans === 'boolean') return true;
    return false;
  };

  const answeredCount = quiz.questions.filter((q) => isQuestionAnswered(q.id)).length;
  const unansweredCount = quiz.questions.length - answeredCount;

  // Answer handlers
  const handleSelectSingle = (optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionId,
    }));
  };

  const handleToggleMultiple = (optionId: string) => {
    const currentList = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
    const idx = currentList.indexOf(optionId);
    if (idx >= 0) {
      currentList.splice(idx, 1);
    } else {
      currentList.push(optionId);
    }
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: currentList,
    }));
  };

  const handleSelectTrueFalse = (val: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: val,
    }));
  };

  // Submit assessment
  const executeSubmit = async () => {
    setIsSubmitting(true);
    setShowConfirmSubmit(false);
    try {
      const res = await quizzesApi.submitQuiz(quizId, {
        answers,
        timeTakenSeconds: secondsElapsed,
      });

      if (res.data?.success && res.data.attempt) {
        onComplete(res.data.attempt.id, res.data.attempt);
      } else {
        throw new Error(res.message || 'Grading failed on server');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit quiz. Please retry.');
      setIsSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (unansweredCount > 0) {
      setShowConfirmSubmit(true);
    } else {
      executeSubmit();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Assessment</span>
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold text-white truncate max-w-md">{quiz.title}</h2>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="capitalize">{quiz.difficulty}</span>
            <span>•</span>
            <span>{quiz.topic}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTimer(secondsElapsed)}</span>
        </div>
      </div>

      {/* Question Number Pills Navigation */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {quiz.questions.map((q, idx) => {
            const answered = isQuestionAnswered(q.id);
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center border ${
                  isCurrent
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20'
                    : answered
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-400 font-medium whitespace-nowrap pl-2">
          {answeredCount}/{quiz.questions.length} Answered
        </div>
      </div>

      {/* Question Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        {/* Question Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              Question {currentIndex + 1} of {quiz.questions.length}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 capitalize">
              {currentQ.type.replace('_', ' ')}
            </span>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            {currentQ.metadata?.points || 1} {currentQ.metadata?.points === 1 ? 'pt' : 'pts'}
          </span>
        </div>

        {/* Scenario Context (if present) */}
        {currentQ.scenarioContext && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 space-y-2">
            <div className="text-slate-500 flex items-center gap-1.5 font-semibold">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Scenario Context & Symptoms:
            </div>
            <div className="whitespace-pre-wrap leading-relaxed text-slate-200">
              {currentQ.scenarioContext}
            </div>
          </div>
        )}

        {/* Question Prompt */}
        <div>
          <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
            {currentQ.question}
          </p>
          {currentQ.type === 'multiple_select' && (
            <p className="text-xs text-cyan-400 mt-1 font-medium">
              * Multiple choice: Select all that apply. Exact match required for credit.
            </p>
          )}
        </div>

        {/* Options Selection */}
        <div className="space-y-3 pt-2">
          {currentQ.type === 'true_false' ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                { val: true, label: 'True' },
                { val: false, label: 'False' },
              ].map((item) => {
                const isSelected = currentAnswer === item.val;
                return (
                  <button
                    key={String(item.val)}
                    type="button"
                    onClick={() => handleSelectTrueFalse(item.val)}
                    className={`py-5 px-6 rounded-xl font-bold text-base transition border flex items-center justify-center gap-3 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                    </div>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ) : currentQ.type === 'multiple_select' ? (
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = Array.isArray(currentAnswer) && currentAnswer.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleToggleMultiple(opt.id)}
                    className={`w-full text-left p-4 rounded-xl transition border flex items-center gap-4 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        isSelected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-700'
                      }`}
                    >
                      {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                    <span className="font-bold text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                      {opt.id}
                    </span>
                    <span className="text-sm font-medium leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            // single_choice or scenario
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = currentAnswer === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectSingle(opt.id)}
                    className={`w-full text-left p-4 rounded-xl transition border flex items-center gap-4 ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-slate-700'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-slate-950" />}
                    </div>
                    <span className="font-bold text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                      {opt.id}
                    </span>
                    <span className="text-sm font-medium leading-relaxed">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer Controls */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <div className="text-xs text-slate-400">
          Question <span className="text-white font-bold">{currentIndex + 1}</span> of{' '}
          <span className="text-white font-bold">{quiz.questions.length}</span>
        </div>

        {currentIndex < quiz.questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmitClick}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Submit Assessment</span>
          </button>
        )}
      </div>

      {/* Unanswered Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Unanswered Questions</h3>
            </div>
            <p className="text-sm text-slate-300">
              You have <span className="text-amber-400 font-bold">{unansweredCount}</span> unanswered question{unansweredCount > 1 ? 's' : ''}. Unanswered questions will receive 0 points.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white"
              >
                Review Questions
              </button>
              <button
                onClick={executeSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
