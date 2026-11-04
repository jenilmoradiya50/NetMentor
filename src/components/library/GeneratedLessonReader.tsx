import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Terminal,
  Layers,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Play,
  FileQuestion,
  Award,
} from 'lucide-react';
import {
  type GeneratedLessonDetail,
  type UserQuizSummaryItem,
  flashcardsApi,
  quizzesApi,
} from '../../lib/api';
import { MarkdownView } from '../ui/MarkdownView';
import { GenerateFlashcardsModal } from './GenerateFlashcardsModal';
import type { FlashcardDeck, FlashcardItem } from '../../types/flashcards';

interface GeneratedLessonReaderProps {
  lesson: GeneratedLessonDetail;
  onBack: () => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAskAi: (topic: string, lessonId: string) => void;
  onStudyDeck?: (deckId: string) => void;
  onTakeQuiz?: (quizId: string) => void;
  onGenerateQuiz?: (lessonId: string, lessonTitle: string, lessonTopic: string) => void;
}

export const GeneratedLessonReader: React.FC<GeneratedLessonReaderProps> = ({
  lesson,
  onBack,
  onRename,
  onDelete,
  onAskAi,
  onStudyDeck,
  onTakeQuiz,
  onGenerateQuiz,
}) => {
  const content = lesson.content;

  // Flashcards state
  const [isFlashcardsModalOpen, setIsFlashcardsModalOpen] = useState(false);
  const [lessonDeck, setLessonDeck] = useState<FlashcardDeck | null>(null);
  const [deckCards, setDeckCards] = useState<FlashcardItem[]>([]);

  // Quiz state
  const [lessonQuiz, setLessonQuiz] = useState<UserQuizSummaryItem | null>(null);

  // Fetch linked flashcard deck for this lesson
  const fetchLessonDeck = useCallback(async () => {
    try {
      const res = await flashcardsApi.getLessonDeck(lesson.id);
      if (res.data?.success && res.data.deck) {
        setLessonDeck(res.data.deck);
        setDeckCards(res.data.cards || []);
      } else {
        setLessonDeck(null);
        setDeckCards([]);
      }
    } catch {
      setLessonDeck(null);
      setDeckCards([]);
    }
  }, [lesson.id]);

  // Fetch linked quiz for this lesson
  const fetchLessonQuiz = useCallback(async () => {
    try {
      const res = await quizzesApi.listQuizzes({ lessonId: lesson.id });
      if (res.data?.success && res.data.quizzes && res.data.quizzes.length > 0) {
        setLessonQuiz(res.data.quizzes[0]);
      } else {
        setLessonQuiz(null);
      }
    } catch {
      setLessonQuiz(null);
    }
  }, [lesson.id]);

  useEffect(() => {
    fetchLessonDeck();
    fetchLessonQuiz();
  }, [fetchLessonDeck, fetchLessonQuiz]);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(lesson.title);
  const [isSubmittingTitle, setIsSubmittingTitle] = useState(false);

  // Deletion confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Interactive knowledge check answers: { [checkId: string]: { selectedId: string; isSubmitted: boolean } }
  const [userAnswers, setUserAnswers] = useState<
    Record<string, { selectedOptionId: string; isSubmitted: boolean }>
  >({});

  const handleSelectOption = (checkId: string, optionId: string) => {
    const current = userAnswers[checkId];
    if (current?.isSubmitted) return; // Prevent changing after submission
    setUserAnswers((prev) => ({
      ...prev,
      [checkId]: { selectedOptionId: optionId, isSubmitted: false },
    }));
  };

  const handleCheckAnswer = (checkId: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [checkId]: {
        selectedOptionId: prev[checkId]?.selectedOptionId || '',
        isSubmitted: true,
      },
    }));
  };

  const handleSaveTitle = async () => {
    if (!titleInput.trim() || titleInput === lesson.title) {
      setIsEditingTitle(false);
      return;
    }
    setIsSubmittingTitle(true);
    try {
      await onRename(lesson.id, titleInput.trim());
      setIsEditingTitle(false);
    } catch {
      // Revert on error
      setTitleInput(lesson.title);
    } finally {
      setIsSubmittingTitle(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(lesson.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!content) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center space-y-4">
        <div className="p-8 bg-surface border border-white/10 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-danger mx-auto mb-2" />
          <h2 className="text-lg font-bold text-white">Lesson Content Unavailable</h2>
          <p className="text-xs text-white/60 mt-1">
            Could not parse content JSON for this generated lesson.
          </p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-xs font-semibold rounded-xl text-white"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-6 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Personal Library
        </button>

        <div className="flex items-center gap-2">
          {lessonDeck ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onStudyDeck?.(lessonDeck.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-sm transition-all"
                title={`Study ${lessonDeck.cardCount} flashcards for this lesson`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Study Flashcards ({lessonDeck.cardCount})
              </button>
              <button
                type="button"
                onClick={() => setIsFlashcardsModalOpen(true)}
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                title="Edit or add flashcards"
              >
                <Layers className="w-4 h-4 text-purple-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsFlashcardsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-all shadow-sm"
              title="Generate active-recall flashcards from this lesson"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Generate Flashcards
            </button>
          )}

          {/* AI Quiz Action */}
          {lessonQuiz ? (
            <button
              type="button"
              onClick={() => onTakeQuiz?.(lessonQuiz.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-sm"
              title="Take or retake the assessment quiz for this lesson"
            >
              <FileQuestion className="w-3.5 h-3.5 text-cyan-400" />
              {lessonQuiz.latestAttempt ? `Quiz (${lessonQuiz.latestAttempt.percentage}%)` : 'Take Quiz'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onGenerateQuiz?.(lesson.id, lesson.title, content.topic)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-all shadow-sm"
              title="Generate an AI assessment quiz for this lesson"
            >
              <FileQuestion className="w-3.5 h-3.5 text-cyan-400" />
              Generate Quiz
            </button>
          )}

          <button
            onClick={() => onAskAi(content.topic, lesson.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 transition-all"
            title="Ask AI Tutor about this topic"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Discuss with AI Tutor
          </button>

          <button
            onClick={() => setIsEditingTitle(true)}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Rename lesson"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            title="Delete lesson"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-5 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-4">
            <h3 className="text-base font-bold text-white">Delete Generated Lesson?</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-semibold">"{lesson.title}"</span>? This will permanently remove it from your Personal Learning Library.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-danger text-white rounded-xl hover:bg-danger-hover disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Lesson'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Hero Header */}
      <div className="p-6 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
            {content.difficulty}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-white/70 border border-white/10">
            <Clock className="w-3 h-3 text-white/40" />
            ~{content.estimatedMinutes} minutes
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-white/70 border border-white/10">
            {content.topic}
          </span>
          <span className="ml-auto text-[11px] text-white/40">
            Generated {new Date(lesson.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Title / Inline Rename */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-canvas border border-accent rounded-xl text-lg font-bold text-white focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              disabled={isSubmittingTitle}
              className="px-3 py-1.5 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent-hover"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditingTitle(false);
                setTitleInput(lesson.title);
              }}
              className="px-3 py-1.5 text-xs text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {lesson.title}
          </h1>
        )}

        <p className="text-sm text-white/70 leading-relaxed">{content.shortDescription}</p>

        {/* Tags */}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {content.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[10px] bg-white/[0.04] text-white/60 border border-white/5"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Learning Objectives & Prerequisites */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-success" />
              Learning Objectives
            </h3>
            <ul className="space-y-1.5 text-xs text-white/80">
              {content.learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-accent font-bold">&bull;</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>

          {content.prerequisites && content.prerequisites.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-accent" />
                Recommended Prerequisites
              </h3>
              <ul className="space-y-1.5 text-xs text-white/70">
                {content.prerequisites.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-white/40">&bull;</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Main Lesson Content Sections */}
      <div className="space-y-6">
        {content.sections.map((section, idx) => (
          <section
            key={section.id || idx}
            className="p-6 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-5"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent/20 border border-accent/30 text-accent font-extrabold text-sm">
                {idx + 1}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {section.title}
              </h2>
            </div>

            {/* Explanation rendered via MarkdownView */}
            <div className="text-sm leading-relaxed text-white/90">
              <MarkdownView content={section.explanation} />
            </div>

            {/* Terminology definition callouts */}
            {section.terminology && section.terminology.length > 0 && (
              <div className="p-4 bg-canvas/60 border border-white/10 rounded-xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Key Terminology in this Section
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {section.terminology.map((t, tIdx) => (
                    <div key={tIdx} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                      <span className="font-bold text-accent">{t.term}: </span>
                      <span className="text-white/70">{t.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CLI Commands */}
            {section.commands && section.commands.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  CLI Syntax & Implementation Examples
                </h4>
                {section.commands.map((cmd, cIdx) => (
                  <div
                    key={cIdx}
                    className="p-4 bg-canvas border border-white/10 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span className="font-semibold text-accent">{cmd.platform || 'CLI'}</span>
                      <span>{cmd.description}</span>
                    </div>
                    <pre className="p-3 bg-black/70 rounded-lg text-accent font-mono text-xs overflow-x-auto border border-white/5">
                      {cmd.command}
                    </pre>
                    {cmd.expectedOutput && (
                      <div className="text-xs text-white/70 pt-1">
                        <span className="text-white/40 font-mono">Expected Output: </span>
                        <pre className="mt-1 p-2.5 bg-white/[0.02] rounded border border-white/5 text-[11px] text-white/80 font-mono whitespace-pre-wrap">
                          {cmd.expectedOutput}
                        </pre>
                      </div>
                    )}
                    {cmd.notes && (
                      <p className="text-[11px] text-white/50 italic pt-1">&bull; {cmd.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Practical Scenario */}
            {section.practicalScenario && (
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase tracking-wider">
                  <Layers className="w-4 h-4" />
                  Scenario: {section.practicalScenario.title}
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  {section.practicalScenario.description}
                </p>

                {section.practicalScenario.packetFlow && (
                  <div className="p-3 bg-canvas/80 rounded-lg border border-white/10 space-y-1">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                      Packet Flow Progression
                    </span>
                    <pre className="text-xs font-mono text-white/90 whitespace-pre-wrap">
                      {section.practicalScenario.packetFlow}
                    </pre>
                  </div>
                )}

                {section.practicalScenario.troubleshootingSteps &&
                  section.practicalScenario.troubleshootingSteps.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                        Troubleshooting Sequence
                      </span>
                      <ol className="list-decimal list-inside text-xs text-white/80 space-y-1">
                        {section.practicalScenario.troubleshootingSteps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                {section.practicalScenario.commonMistakes &&
                  section.practicalScenario.commonMistakes.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-accent/20">
                      <span className="text-[11px] font-bold text-warning uppercase tracking-wider">
                        Common Engineering Mistakes & Root Causes
                      </span>
                      {section.practicalScenario.commonMistakes.map((cm, cmIdx) => (
                        <div
                          key={cmIdx}
                          className="p-2.5 bg-warning/5 border border-warning/20 rounded-lg text-xs space-y-1"
                        >
                          <div className="font-semibold text-warning-200">
                            Pitfall: {cm.mistake}
                          </div>
                          <div className="text-white/70">
                            <span className="text-white/40">Cause: </span>
                            {cm.cause}
                          </div>
                          <div className="text-success-200">
                            <span className="text-white/40">Prevention: </span>
                            {cm.prevention}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Interactive Knowledge Checks */}
      {content.knowledgeChecks && content.knowledgeChecks.length > 0 && (
        <div className="p-6 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <HelpCircle className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Interactive Knowledge Checks
            </h2>
          </div>

          <div className="space-y-6">
            {content.knowledgeChecks.map((kc, kIdx) => {
              const state = userAnswers[kc.id] || { selectedOptionId: '', isSubmitted: false };
              const isSelected = Boolean(state.selectedOptionId);
              const isCorrect = state.selectedOptionId.toLowerCase() === kc.correctOptionId.toLowerCase();

              return (
                <div
                  key={kc.id || kIdx}
                  className="p-5 bg-canvas/60 border border-white/10 rounded-xl space-y-4 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-accent/20 text-accent font-bold text-xs shrink-0 mt-0.5">
                      Question {kIdx + 1}
                    </span>
                    <p className="text-sm font-semibold text-white leading-relaxed">{kc.question}</p>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2 pl-2 sm:pl-4">
                    {kc.options.map((opt) => {
                      const isOptionSelected = state.selectedOptionId === opt.id;
                      const isOptionCorrect = opt.id.toLowerCase() === kc.correctOptionId.toLowerCase();

                      let optionClass =
                        'border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.04] cursor-pointer';

                      if (state.isSubmitted) {
                        if (isOptionCorrect) {
                          optionClass = 'border-success/40 bg-success/15 text-success font-semibold';
                        } else if (isOptionSelected && !isCorrect) {
                          optionClass = 'border-danger/40 bg-danger/15 text-danger';
                        } else {
                          optionClass = 'border-white/5 bg-white/[0.01] text-white/40 cursor-default';
                        }
                      } else if (isOptionSelected) {
                        optionClass = 'border-accent bg-accent/15 text-white font-semibold';
                      }

                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectOption(kc.id, opt.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${optionClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] bg-white/10">
                              {opt.id}
                            </span>
                            <span className="text-xs">{opt.text}</span>
                          </div>

                          {state.isSubmitted && isOptionCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          )}
                          {state.isSubmitted && isOptionSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-danger shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Answer Action */}
                  {!state.isSubmitted ? (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleCheckAnswer(kc.id)}
                        disabled={!isSelected}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Check Answer
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`p-3.5 rounded-xl border space-y-1 animate-fade-in ${
                        isCorrect
                          ? 'bg-success/10 border-success/30 text-success-200'
                          : 'bg-danger/10 border-danger/30 text-danger-200'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        {isCorrect ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-success" />
                            Correct Answer!
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-danger" />
                            Incorrect
                          </>
                        )}
                      </div>
                      <p className="text-xs text-white/80 leading-relaxed pt-1">
                        <span className="font-semibold text-white">Explanation: </span>
                        {kc.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lesson Summary & Next Topics */}
      {content.summary && (
        <div className="p-6 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <BookOpen className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Lesson Summary & Core Takeaways
            </h2>
          </div>

          <div className="space-y-4 text-xs">
            {/* Key Takeaways */}
            <div className="p-4 bg-canvas/60 border border-white/10 rounded-xl space-y-2">
              <h3 className="font-bold text-sm text-white">Key Takeaways</h3>
              <ul className="space-y-1.5 list-disc list-inside text-white/80 leading-relaxed">
                {content.summary.keyTakeaways.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Key Terms */}
            {content.summary.keyTerms && content.summary.keyTerms.length > 0 && (
              <div className="p-4 bg-canvas/60 border border-white/10 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-white">Essential Terms</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {content.summary.keyTerms.map((kt, i) => (
                    <div key={i} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-lg">
                      <span className="font-bold text-accent">{kt.term}: </span>
                      <span className="text-white/70">{kt.definition}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What You Learned */}
            <div className="p-4 bg-canvas/60 border border-white/10 rounded-xl space-y-2">
              <h3 className="font-bold text-sm text-white">What You Have Mastered</h3>
              <p className="text-white/80 leading-relaxed">{content.summary.whatYouLearned}</p>
            </div>

            {/* Next Topics */}
            {content.summary.suggestedNextTopics && content.summary.suggestedNextTopics.length > 0 && (
              <div className="p-4 bg-canvas/60 border border-white/10 rounded-xl space-y-3">
                <h3 className="font-bold text-sm text-white">Recommended Next Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {content.summary.suggestedNextTopics.map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => onAskAi(topic, lesson.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{topic}</span>
                      <ChevronRight className="w-3 h-3 text-accent/60" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Recall Flashcards Section */}
      <div className="p-6 bg-surface border border-white/10 rounded-2xl shadow-glass space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white heading-title">
                {lessonDeck ? 'Lesson Flashcard Deck' : 'Active Recall Flashcard Practice'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lessonDeck
                  ? `${lessonDeck.cardCount} active-recall cards saved • ${lessonDeck.masteredCount || 0} mastered`
                  : 'Generate active-recall flashcards directly from this lesson to test and retain key concepts.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {lessonDeck ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsFlashcardsModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
                >
                  Edit Deck
                </button>
                <button
                  type="button"
                  onClick={() => onStudyDeck?.(lessonDeck.id)}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 press-scale"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Study Flashcards
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsFlashcardsModalOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 press-scale w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4" />
                Generate Flashcards
              </button>
            )}
          </div>
        </div>

        {lessonDeck && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Mastery Rate</span>
              <span className="text-white font-semibold">
                {lessonDeck.cardCount > 0 ? Math.round(((lessonDeck.masteredCount || 0) / lessonDeck.cardCount) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-canvas-subtle rounded-full h-1.5 overflow-hidden border border-white/5">
              <div
                className="bg-success h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    lessonDeck.cardCount > 0
                      ? Math.round(((lessonDeck.masteredCount || 0) / lessonDeck.cardCount) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Quiz Assessment Card */}
      <div className="p-6 rounded-2xl bg-surface border border-cyan-500/20 shadow-glass space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                AI Knowledge Assessment Quiz
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                  Assessment
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {lessonQuiz
                  ? `${lessonQuiz.questionCount} questions • Grounded in ${lesson.title}`
                  : 'Evaluate your mastery of this lesson with technical scenarios, multi-select questions, and automated scoring.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {lessonQuiz ? (
              <button
                type="button"
                onClick={() => onTakeQuiz?.(lessonQuiz.id)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-500/20 press-scale w-full sm:w-auto"
              >
                <Play className="w-4 h-4 fill-current" />
                {lessonQuiz.latestAttempt ? 'Retake Assessment' : 'Start Assessment'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onGenerateQuiz?.(lesson.id, lesson.title, content.topic)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-lg shadow-cyan-500/20 press-scale w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4" />
                Generate Lesson Quiz
              </button>
            )}
          </div>
        </div>

        {lessonQuiz && lessonQuiz.latestAttempt && (
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Award className="w-4 h-4 text-cyan-400" />
              Latest Score: <strong className="text-white font-bold">{lessonQuiz.latestAttempt.percentage}%</strong> ({lessonQuiz.latestAttempt.score}/{lessonQuiz.latestAttempt.totalQuestions})
            </span>
            <span className="text-slate-500 font-mono">
              Completed on {new Date(lessonQuiz.latestAttempt.completedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Generate / Manage Flashcards Modal */}
      <GenerateFlashcardsModal
        isOpen={isFlashcardsModalOpen}
        onClose={() => setIsFlashcardsModalOpen(false)}
        lessonId={lesson.id}
        lessonTitle={lesson.title}
        lessonTopic={lesson.topic}
        existingDeck={lessonDeck}
        existingCards={deckCards}
        onSaved={() => {
          fetchLessonDeck();
        }}
        onStudyNow={(deckId) => {
          fetchLessonDeck();
          onStudyDeck?.(deckId);
        }}
      />
    </div>
  );
};
