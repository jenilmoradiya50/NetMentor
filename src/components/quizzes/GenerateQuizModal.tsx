import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  ShieldCheck,
  CheckSquare,
  FileQuestion,
  Terminal,
} from 'lucide-react';
import {
  quizzesApi,
  type ClientQuizData,
  type QuizDifficulty,
  type QuizQuestionType,
} from '../../lib/api';
import { useGenerationManager } from '../../context/GenerationManagerContext';

interface GenerateQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuizReady: (quizId: string, autoStart?: boolean) => void;
  initialTopic?: string;
  lessonId?: string;
  lessonTitle?: string;
  initialQuiz?: ClientQuizData | null;
  initialQuizId?: string | null;
}

export const GenerateQuizModal: React.FC<GenerateQuizModalProps> = ({
  isOpen,
  onClose,
  onQuizReady,
  initialTopic = '',
  lessonId,
  lessonTitle,
  initialQuiz,
  initialQuizId,
}) => {
  const { startGeneration } = useGenerationManager();

  // Wizard steps: 'configure' | 'generating' | 'preview'
  const [step, setStep] = useState<'configure' | 'generating' | 'preview'>('configure');

  // Configuration state
  const [topic, setTopic] = useState(initialTopic || lessonTitle || '');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [selectedTypes, setSelectedTypes] = useState<QuizQuestionType[]>([
    'single_choice',
    'multiple_select',
    'true_false',
    'scenario',
  ]);

  // Preview state
  const [generatedQuiz, setGeneratedQuiz] = useState<ClientQuizData | null>(null);
  const [persistedQuizId, setPersistedQuizId] = useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>('');

  // Status & error state
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial state when opening modal
  React.useEffect(() => {
    if (isOpen) {
      if (initialQuiz && initialQuizId) {
        setGeneratedQuiz(initialQuiz);
        setPersistedQuizId(initialQuizId);
        setTopic(initialQuiz.title || initialTopic || lessonTitle || '');
        setStep('preview');
      } else {
        setTopic(initialTopic || lessonTitle || '');
        setStep('configure');
        setGeneratedQuiz(null);
        setPersistedQuizId(null);
      }
      setErrorMessage(null);
    }
  }, [isOpen, initialTopic, lessonTitle, initialQuiz, initialQuizId]);

  if (!isOpen) return null;

  const toggleType = (t: QuizQuestionType) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((x) => x !== t));
      }
    } else {
      setSelectedTypes([...selectedTypes, t]);
    }
  };

  const handleGenerate = async () => {
    const targetTopic = topic.trim() || lessonTitle || 'Network Engineering';
    setErrorMessage(null);
    setIsStarting(true);

    try {
      await startGeneration('quiz', {
        topic: targetTopic,
        difficulty,
        questionCount,
        questionTypes: selectedTypes,
        lessonId: lessonId || undefined,
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start quiz generation. Please retry.');
      setStep('configure');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSaveQuestionEdit = async (questionId: string) => {
    if (!persistedQuizId || !editedText.trim()) {
      setEditingQuestionId(null);
      return;
    }

    try {
      await quizzesApi.updateQuestion(persistedQuizId, questionId, {
        question: editedText.trim(),
      });

      if (generatedQuiz) {
        setGeneratedQuiz({
          ...generatedQuiz,
          questions: generatedQuiz.questions.map((q) =>
            q.id === questionId ? { ...q, question: editedText.trim() } : q
          ),
        });
      }
    } catch (err) {
      console.error('Failed to update question', err);
    } finally {
      setEditingQuestionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Generate AI Networking Quiz
                {lessonId && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Lesson Linked
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {lessonTitle ? `Grounded in: ${lessonTitle}` : 'Custom topic knowledge assessment'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Generation Failed</p>
                <p className="text-xs opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-5">
              {/* Topic Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Assessment Topic *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. OSPFv2 Area Types, BGP Path Selection, Subnetting..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm"
                />
              </div>

              {/* Difficulty Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as QuizDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition border ${
                        difficulty === d
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Question Count
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition border ${
                        questionCount === num
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Types Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Included Question Types
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'single_choice' as QuizQuestionType, label: 'Single Choice (MCQ)' },
                    { id: 'multiple_select' as QuizQuestionType, label: 'Multiple Select' },
                    { id: 'true_false' as QuizQuestionType, label: 'True / False' },
                    { id: 'scenario' as QuizQuestionType, label: 'Troubleshooting Scenario' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleType(item.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition ${
                        selectedTypes.includes(item.id)
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          selectedTypes.includes(item.id)
                            ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                            : 'border-slate-700'
                        }`}
                      >
                        {selectedTypes.includes(item.id) && <CheckSquare className="w-3 h-3" />}
                      </div>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Security Invariant Callout */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Anti-leakage protection active. Ground-truth answer keys are secured server-side and revealed only after assessment submission.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Generating Assessment Questions</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Synthesizing protocol mechanics, Cisco IOS-XE verification scenarios, and plausible distractors...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW (WITHOUT ANSWERS) */}
          {step === 'preview' && generatedQuiz && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">{generatedQuiz.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {generatedQuiz.difficulty}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {generatedQuiz.questions.length} questions
                    </span>
                  </div>
                </div>
                <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved to Library
                </div>
              </div>

              {/* Security banner */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Preview Mode: Review question text below. Answer keys remain encrypted until you complete the assessment.
                </span>
              </div>

              {/* Questions list */}
              <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
                {generatedQuiz.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                          Question {idx + 1}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {q.type.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          if (editingQuestionId === q.id) {
                            handleSaveQuestionEdit(q.id);
                          } else {
                            setEditingQuestionId(q.id);
                            setEditedText(q.question);
                          }
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                      >
                        {editingQuestionId === q.id ? 'Save Edit' : 'Edit Text'}
                      </button>
                    </div>

                    {q.scenarioContext && (
                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-xs text-slate-300 space-y-1">
                        <div className="text-slate-500 flex items-center gap-1">
                          <Terminal className="w-3.5 h-3.5" />
                          Scenario Context:
                        </div>
                        <p className="whitespace-pre-wrap">{q.scenarioContext}</p>
                      </div>
                    )}

                    {editingQuestionId === q.id ? (
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-slate-900 border border-cyan-500/50 text-white text-xs font-medium focus:outline-none"
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-100">{q.question}</p>
                    )}

                    {/* Options list */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2"
                        >
                          <span className="w-5 h-5 rounded flex items-center justify-center font-bold text-slate-400 bg-slate-800 shrink-0">
                            {opt.id}
                          </span>
                          <span className="truncate">{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-900/50">
          {step === 'configure' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!topic.trim() || isStarting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Starting Background Task...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Quiz
                  </>
                )}
              </button>
            </>
          )}

          {step === 'generating' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          )}

          {step === 'preview' && persistedQuizId && (
            <>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onQuizReady(persistedQuizId, false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  View in Quizzes Hub
                </button>
                <button
                  type="button"
                  onClick={() => onQuizReady(persistedQuizId, true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Take Quiz Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
