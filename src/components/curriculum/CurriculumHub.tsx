import React, { useState, useEffect } from 'react';
import {
  Compass,
  BookOpen,
  Clock,
  Sparkles,
  ArrowRight,
  Network,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { CURRICULUM_PATHS } from '../../data/curriculum/curriculum-data.js';
import type {
  LessonMasteryLevel,
  LessonProgressState,
  ExerciseAttemptRecord,
} from '../../types/curriculum.js';
import { curriculumApi } from '../../lib/api.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';

// Lazy-load LessonReader for route-level code splitting
const LessonReader = React.lazy(() =>
  import('./LessonReader.js').then((m) => ({ default: m.LessonReader })),
);

interface CurriculumHubProps {
  onNavigateToFlashcards?: (deckId: string) => void;
  onNavigateToLabs?: (labId: string) => void;
  activeLessonId?: string | null;
  onSelectLesson?: (lessonId: string) => void;
  onBackToCurriculum?: () => void;
}

export const CurriculumHub: React.FC<CurriculumHubProps> = ({
  onNavigateToFlashcards,
  onNavigateToLabs,
  activeLessonId,
  onSelectLesson,
  onBackToCurriculum,
}) => {
  const [selectedPathId, setSelectedPathId] = useState<string>('path-fundamentals');
  const [internalLessonId, setInternalLessonId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('lesson');
    }
    return null;
  });

  const effectiveLessonId = activeLessonId !== undefined ? activeLessonId : internalLessonId;

  const activeLesson = React.useMemo(() => {
    if (!effectiveLessonId) return null;
    for (const p of CURRICULUM_PATHS) {
      for (const t of p.topics) {
        const found = t.lessons.find((l) => l.id === effectiveLessonId);
        if (found) {
          return { lesson: found, pathTitle: p.title, topicTitle: t.title };
        }
      }
    }
    return null;
  }, [effectiveLessonId]);

  const handleSelectLesson = (lessonId: string) => {
    if (onSelectLesson) {
      onSelectLesson(lessonId);
    } else {
      setInternalLessonId(lessonId);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  };

  const handleBack = () => {
    if (onBackToCurriculum) {
      onBackToCurriculum();
    } else {
      setInternalLessonId(null);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }
  };

  // Lesson progress map: lessonId -> LessonProgressState
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgressState>>({});
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load user progress from API
  const loadUserProgress = async () => {
    setLoadingProgress(true);
    setErrorMsg(null);
    try {
      const res = await curriculumApi.getProgress();
      if (res.data?.progress) {
        const pMap: Record<string, LessonProgressState> = {};
        for (const p of res.data.progress) {
          let attempts: Record<string, ExerciseAttemptRecord> = {};
          if (p.exerciseAttempts && typeof p.exerciseAttempts === 'object') {
            attempts = p.exerciseAttempts;
          } else if (p.notes && typeof p.notes === 'string' && p.notes.startsWith('{')) {
            try {
              const parsed = JSON.parse(p.notes);
              if (parsed?.exercises && typeof parsed.exercises === 'object') {
                attempts = parsed.exercises;
              }
            } catch {}
          }

          pMap[p.lessonId] = {
            lessonId: p.lessonId,
            masteryLevel: p.masteryLevel as LessonMasteryLevel,
            confidenceScore: p.confidenceScore,
            lastReviewedAt: p.lastReviewedAt,
            notes: p.notes,
            exerciseAttempts: attempts,
          };
        }
        setProgressMap(pMap);
      }
    } catch (err: any) {
      console.warn('[Curriculum] Could not fetch remote progress, using local state:', err?.message);
      setErrorMsg('Could not fetch server progress. Local progress is preserved.');
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    loadUserProgress();
  }, []);

  const handleSaveLessonProgress = async (
    lessonId: string,
    masteryLevel: LessonMasteryLevel,
    confidenceScore: number,
    exerciseAttempt?: ExerciseAttemptRecord,
  ) => {
    // Snapshot previous state for targeted rollback on error
    const previousState = progressMap[lessonId];
    const previousAttempt = exerciseAttempt
      ? previousState?.exerciseAttempts?.[exerciseAttempt.exerciseId]
      : undefined;
    const requestTimestamp = Date.now();

    // Optimistic update
    setProgressMap((prev) => {
      const existing = prev[lessonId] || {
        lessonId,
        masteryLevel,
        confidenceScore,
        lastReviewedAt: new Date(requestTimestamp).toISOString(),
        exerciseAttempts: {},
      };
      const updatedAttempts = { ...(existing.exerciseAttempts || {}) };
      if (exerciseAttempt) {
        updatedAttempts[exerciseAttempt.exerciseId] = exerciseAttempt;
      }
      return {
        ...prev,
        [lessonId]: {
          ...existing,
          masteryLevel,
          confidenceScore,
          lastReviewedAt: new Date(requestTimestamp).toISOString(),
          exerciseAttempts: updatedAttempts,
        },
      };
    });

    try {
      const res = await curriculumApi.saveProgress({
        lessonId,
        masteryLevel,
        confidenceScore,
        exerciseAttempt,
      });

      if (res.error || !res.data?.success) {
        throw new Error(res.message || res.error || 'Failed to persist progress to server');
      }
    } catch (err: any) {
      console.error('[Curriculum] Failed to persist progress to database:', err?.message);
      // Safe targeted rollback: do not overwrite newer updates from concurrent submissions
      setProgressMap((prev) => {
        const current = prev[lessonId];
        if (!current) return prev;

        // 1. Roll back only this exercise attempt, preserving any other concurrent attempts
        const rolledBackAttempts = { ...(current.exerciseAttempts || {}) };
        if (exerciseAttempt) {
          if (previousAttempt) {
            rolledBackAttempts[exerciseAttempt.exerciseId] = previousAttempt;
          } else {
            delete rolledBackAttempts[exerciseAttempt.exerciseId];
          }
        }

        // 2. Only roll back mastery level if no newer submission has updated the lesson
        const isNewerSubmissionPresent =
          current.lastReviewedAt &&
          new Date(current.lastReviewedAt).getTime() > requestTimestamp;

        return {
          ...prev,
          [lessonId]: {
            ...current,
            masteryLevel: isNewerSubmissionPresent
              ? current.masteryLevel
              : previousState?.masteryLevel || 'not_started',
            confidenceScore: isNewerSubmissionPresent
              ? current.confidenceScore
              : previousState?.confidenceScore || 3,
            exerciseAttempts: rolledBackAttempts,
          },
        };
      });
      setErrorMsg('Failed to save progress to server. Changes were not persisted.');
      throw err;
    }
  };

  // If a lesson is actively open, render the full LessonReader
  if (activeLesson) {
    const currentProgress = progressMap[activeLesson.lesson.id];
    const currentMastery = currentProgress?.masteryLevel || 'not_started';

    return (
      <React.Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-canvas">
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute w-12 h-12 rounded-full bg-accent/20 animate-ping opacity-30" />
              <Loader2 className="w-8 h-8 text-accent animate-spin relative z-10" />
            </div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Loading Lesson Reader...</p>
            <span className="text-[10px] text-slate-600 mt-1 font-mono">NetMentor Telecom Console</span>
          </div>
        }
      >
        <LessonReader
          lesson={activeLesson.lesson}
          pathTitle={activeLesson.pathTitle}
          topicTitle={activeLesson.topicTitle}
          initialMastery={currentMastery}
          initialExerciseAttempts={currentProgress?.exerciseAttempts}
          onBack={handleBack}
          onSaveProgress={handleSaveLessonProgress}
          onSaveExerciseAttempt={async (attempt) => {
            await handleSaveLessonProgress(
              activeLesson.lesson.id,
              currentMastery,
              currentProgress?.confidenceScore || 3,
              attempt,
            );
          }}
          onNavigateToFlashcards={onNavigateToFlashcards}
          onNavigateToLabs={onNavigateToLabs}
        />
      </React.Suspense>
    );
  }

  const selectedPath = CURRICULUM_PATHS.find((p) => p.id === selectedPathId) || CURRICULUM_PATHS[0];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Track Switcher Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5 heading-title">
              <Compass className="w-5 h-5 text-accent" />
              Interactive Networking Curriculum
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Structured progressive tracks from fundamentals through CCNA and CCNP Enterprise.
            </p>
          </div>

          <button
            type="button"
            onClick={loadUserProgress}
            disabled={loadingProgress}
            className="p-2 rounded-xl border border-white/10 bg-surface-elevated text-slate-300 hover:text-white press-scale"
            title="Refresh progress"
            aria-label="Refresh curriculum progress"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProgress ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-warning/15 border border-warning/30 text-amber-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
              {errorMsg}
            </span>
            <button
              type="button"
              onClick={loadUserProgress}
              className="underline hover:text-white font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* 3 Tracks (Mobile Swipeable Horizontal Snap Track / Desktop Grid) */}
        <div className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {CURRICULUM_PATHS.map((path) => {
            const isSelected = path.id === selectedPathId;

            // Compute total lessons in this path
            const totalLessons = path.topics.reduce((acc, t) => acc + t.lessons.length, 0);
            const masteredCount = path.topics.reduce((acc, t) => {
              return (
                acc +
                t.lessons.filter((l) => progressMap[l.id]?.masteryLevel === 'mastered').length
              );
            }, 0);

            return (
              <button
                key={path.id}
                type="button"
                onClick={() => setSelectedPathId(path.id)}
                className={`w-[270px] sm:w-auto shrink-0 snap-start p-3.5 sm:p-5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden select-none press-scale ${
                  isSelected
                    ? 'bg-surface-elevated border-brand-500/80 ring-2 ring-brand-500/30 shadow-lg shadow-brand-500/15'
                    : 'bg-surface/80 border-slate-800/80 hover:border-slate-700 hover:bg-surface'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={isSelected ? 'blue' : 'slate'} size="sm">
                    {path.targetCert}
                  </Badge>
                  {totalLessons > 0 ? (
                    <span className="text-[11px] text-slate-400 font-mono">
                      {masteredCount}/{totalLessons} Mastered
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Roadmap &bull; In Development
                    </span>
                  )}
                </div>

                <h3 className={`font-semibold text-sm sm:text-base tracking-tight ${isSelected ? 'text-white font-bold' : 'text-slate-200'}`}>
                  {path.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{path.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Track Detail View */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">
                {selectedPath.title}
              </h3>
              <Badge variant="blue" size="sm">
                {selectedPath.targetCert}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-1">{selectedPath.description}</p>
          </div>
          <span className="text-xs text-slate-400 font-mono flex-shrink-0">
            {selectedPath.topics.length} Topic Modules
          </span>
        </div>

        {/* Topic Modules List */}
        <div className="space-y-5 sm:space-y-6">
          {selectedPath.topics.map((topic, topicIdx) => (
            <Card
              key={topic.id}
              variant="default"
              padding="md"
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center text-xs font-bold shadow-md shadow-brand-500/20 flex-shrink-0">
                    {topicIdx + 1}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white heading-title">{topic.title}</h3>
                    <p className="text-xs text-slate-400">{topic.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {topic.lessons.length === 0 && (
                    <Badge variant="slate" size="sm">
                      In Development
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    ~{topic.estimatedMinutes} mins
                  </span>
                </div>
              </div>

              {/* Lessons Grid within Topic */}
              {topic.lessons.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {topic.lessons.map((lesson) => {
                    const lProgress = progressMap[lesson.id];
                    const isMastered = lProgress?.masteryLevel === 'mastered';
                    const isLearning = lProgress?.masteryLevel === 'learning';

                    return (
                      <div
                        key={lesson.id}
                        className="p-4 rounded-xl bg-surface-subtle/90 border border-slate-800/70 hover:border-slate-700 hover:bg-surface-subtle transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-white">{lesson.title}</h4>

                            {/* Status Badge */}
                            {isMastered ? (
                              <Badge variant="green" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                                Mastered
                              </Badge>
                            ) : isLearning ? (
                              <Badge variant="amber" size="sm">
                                In Progress
                              </Badge>
                            ) : null}
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{lesson.subtitle}</p>

                          {/* Feature Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {lesson.interactiveWidget && (
                              <Badge variant="blue" size="sm" icon={<Sparkles className="w-3 h-3 text-accent" />}>
                                Interactive
                              </Badge>
                            )}
                            <Badge variant="slate" size="sm" icon={<BookOpen className="w-3 h-3 text-amber-400" />}>
                              Predict Challenge
                            </Badge>
                            {lesson.relatedLabs && lesson.relatedLabs.length > 0 && (
                              <Badge variant="slate" size="sm" icon={<Network className="w-3 h-3 text-emerald-400" />}>
                                Packet Tracer Lab
                              </Badge>
                            )}
                            {lesson.relatedFlashcardDecks && lesson.relatedFlashcardDecks.length > 0 && (
                              <Badge variant="slate" size="sm" icon={<Layers className="w-3 h-3 text-sky-400" />}>
                                Flashcards
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Button
                          variant={isMastered ? 'secondary' : 'primary'}
                          size="md"
                          onClick={() => handleSelectLesson(lesson.id)}
                          icon={<ArrowRight className="w-4 h-4" />}
                          className="w-full sm:w-auto flex-shrink-0"
                        >
                          <span>{isMastered ? 'Review Lesson' : isLearning ? 'Continue' : 'Start Lesson'}</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 sm:p-5 rounded-xl bg-surface-subtle/50 border border-slate-800/80 text-xs text-slate-300 space-y-2.5">
                  <div className="flex items-center gap-2 font-semibold text-slate-200">
                    <Compass className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>Curriculum Module in Development</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Lesson modules, interactive visualizers, and prediction exercises for{' '}
                    <strong className="text-slate-300">{topic.title}</strong> are planned for the upcoming curriculum release (Phase 3: Advanced Protocols &amp; Enterprise Routing). No active lessons are published for this module yet.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 font-mono">
                    <span className="w-2 h-2 rounded-full bg-slate-600 inline-block flex-shrink-0" />
                    <span>Status: Content authoring scheduled &bull; No active lessons available</span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
