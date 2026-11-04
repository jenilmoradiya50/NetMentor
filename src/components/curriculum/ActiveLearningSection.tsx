import React, { useState } from 'react';
import {
  Brain,
  CheckCircle2,
  XCircle,
  Circle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type {
  DetailedLesson,
  LessonExercise,
  ExerciseAttemptRecord,
  VisualizerLink,
} from '../../types/curriculum.js';
import { PredictExerciseView } from './PredictExerciseView.js';
import { Card } from '../ui/Card.js';

interface ActiveLearningSectionProps {
  lesson: DetailedLesson;
  exerciseAttempts?: Record<string, ExerciseAttemptRecord>;
  onSaveExerciseAttempt?: (attempt: ExerciseAttemptRecord) => void;
  onInspectVisualizer?: (link: VisualizerLink) => void;
  onOpenAiTutor?: (exerciseId: string) => void;
}

const EMPTY_EXERCISE_ATTEMPTS: Record<string, ExerciseAttemptRecord> = {};

export const ActiveLearningSection: React.FC<ActiveLearningSectionProps> = ({
  lesson,
  exerciseAttempts = EMPTY_EXERCISE_ATTEMPTS,
  onSaveExerciseAttempt,
  onInspectVisualizer,
  onOpenAiTutor,
}) => {
  // Collect all available exercises: prefer lesson.exercises array, fallback to predictExercise + practiceChallenge
  const exercises: LessonExercise[] = React.useMemo(() => {
    if (lesson.exercises && lesson.exercises.length > 0) {
      return lesson.exercises;
    }
    const fallback: LessonExercise[] = [];
    if (lesson.predictExercise) fallback.push(lesson.predictExercise);
    if (lesson.practiceChallenge) fallback.push(lesson.practiceChallenge);
    return fallback;
  }, [lesson]);

  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Local mirror of attempts so UI responds immediately to submissions
  const [localAttempts, setLocalAttempts] = useState<Record<string, ExerciseAttemptRecord>>(exerciseAttempts);

  React.useEffect(() => {
    if (exerciseAttempts && Object.keys(exerciseAttempts).length > 0) {
      setLocalAttempts((prev) => ({
        ...prev,
        ...exerciseAttempts,
      }));
    }
  }, [exerciseAttempts]);

  if (exercises.length === 0) {
    return null;
  }

  const currentExercise = exercises[activeIndex] || exercises[0];

  const handleAttemptSaved = (attempt: ExerciseAttemptRecord) => {
    setLocalAttempts((prev) => ({
      ...prev,
      [attempt.exerciseId]: attempt,
    }));
    onSaveExerciseAttempt?.(attempt);
  };

  // Metrics calculation
  const totalCount = exercises.length;
  const masteredCount = exercises.filter((ex) => localAttempts[ex.id]?.status === 'correct').length;
  const reviewCount = exercises.filter((ex) => localAttempts[ex.id]?.status === 'incorrect').length;
  const progressPercent = Math.round((masteredCount / totalCount) * 100);

  return (
    <section className="space-y-4" id="active-learning-section">
      {/* Header Card with Progress Stepper */}
      <Card variant="elevated" padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white heading-title flex items-center gap-2">
                Active Learning & Mastery Engine
              </h3>
              <p className="text-[11px] text-slate-400">
                Reason through protocol mechanics, predict packet behavior, and diagnose failures.
              </p>
            </div>
          </div>

          {/* Overall Score Badge */}
          <div className="flex items-center gap-2 bg-surface-subtle/80 px-3 py-1.5 rounded-xl border border-white/[0.06]">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-semibold text-white">
              {masteredCount} / {totalCount} Mastered ({progressPercent}%)
            </span>
            {reviewCount > 0 && (
              <span className="text-[10px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                {reviewCount} review
              </span>
            )}
          </div>
        </div>

        {/* Mini Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden border border-white/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Exercise Navigation Stepper (Pills) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {exercises.map((ex, idx) => {
              const attempt = localAttempts[ex.id];
              const isSelected = idx === activeIndex;
              const isPassed = attempt?.status === 'correct';
              const isFailed = attempt?.status === 'incorrect';

              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all press-scale min-h-[38px] ${
                    isSelected
                      ? 'bg-accent text-white shadow-md shadow-accent/20 ring-1 ring-white/20'
                      : isPassed
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                      : isFailed
                      ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                      : 'bg-surface-subtle/70 border border-white/[0.06] text-slate-400 hover:text-white hover:border-white/20'
                  }`}
                  title={ex.title || `Exercise ${idx + 1}`}
                >
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : isFailed ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                  )}
                  <span>Ex {idx + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Prev / Next controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
              className="p-2 rounded-xl bg-surface-subtle text-slate-400 hover:text-white disabled:opacity-20 press-scale border border-white/[0.06] min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Previous Exercise"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={activeIndex === exercises.length - 1}
              onClick={() => setActiveIndex((prev) => Math.min(exercises.length - 1, prev + 1))}
              className="p-2 rounded-xl bg-surface-subtle text-slate-400 hover:text-white disabled:opacity-20 press-scale border border-white/[0.06] min-h-[38px] min-w-[38px] flex items-center justify-center"
              aria-label="Next Exercise"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Currently Active Exercise Card */}
      <PredictExerciseView
        key={currentExercise.id}
        exercise={currentExercise}
        lessonId={lesson.id}
        attemptRecord={localAttempts[currentExercise.id]}
        onAttemptSaved={handleAttemptSaved}
        title={`Exercise ${activeIndex + 1} of ${totalCount}: ${currentExercise.title || currentExercise.type.replace('_', ' ')}`}
        onInspectVisualizer={onInspectVisualizer}
        onOpenAiTutor={onOpenAiTutor}
      />
    </section>
  );
};
