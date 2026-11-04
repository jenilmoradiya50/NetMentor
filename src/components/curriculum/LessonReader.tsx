import React, { useState, useEffect } from 'react';
import type {
  DetailedLesson,
  LessonMasteryLevel,
  ExerciseAttemptRecord,
} from '../../types/curriculum.js';
import { PacketWalkVisualizer } from './visualizers/PacketWalkVisualizer.js';
import { SubnetVisualizer } from './visualizers/SubnetVisualizer.js';
import { OspfStateMachineVisualizer } from './visualizers/OspfStateMachineVisualizer.js';
import { ActiveLearningSection } from './ActiveLearningSection.js';
import { useAiTutor } from '../../context/AiTutorContext.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { MarkdownView, renderInlineMarkdown } from '../ui/MarkdownView.js';
import {
  ChevronRight,
  Clock,
  Sparkles,
  Award,
  Layers,
  Network,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Info,
  BookOpen,
} from 'lucide-react';

interface LessonReaderProps {
  lesson: DetailedLesson;
  pathTitle: string;
  topicTitle: string;
  initialMastery?: LessonMasteryLevel;
  initialExerciseAttempts?: Record<string, ExerciseAttemptRecord>;
  onBack?: () => void;
  onSaveProgress: (
    lessonId: string,
    masteryLevel: LessonMasteryLevel,
    confidenceScore: number,
  ) => Promise<void>;
  onSaveExerciseAttempt?: (attempt: ExerciseAttemptRecord) => Promise<void> | void;
  onNavigateToFlashcards?: (deckId: string) => void;
  onNavigateToLabs?: (labId: string) => void;
}

export const LessonReader: React.FC<LessonReaderProps> = ({
  lesson,
  pathTitle,
  topicTitle,
  initialMastery = 'not_started',
  initialExerciseAttempts,
  onBack: _onBack,
  onSaveProgress,
  onSaveExerciseAttempt,
  onNavigateToFlashcards,
  onNavigateToLabs,
}) => {
  const [mastery, setMastery] = useState<LessonMasteryLevel>(initialMastery);
  const [saving, setSaving] = useState(false);
  const [exercisePassed, setExercisePassed] = useState<boolean>(() => {
    if (!initialExerciseAttempts) return false;
    return Object.values(initialExerciseAttempts).some((a) => a.status === 'correct');
  });

  // Connect to Global AI Tutor context
  const { openTutor, setLessonContext, clearLessonContext } = useAiTutor();

  // Register current lesson context with Global AI Tutor on mount; clear on unmount
  useEffect(() => {
    setLessonContext({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      sections: lesson.sections.map((s) => ({ id: s.id, title: s.title })),
    });
    return () => {
      clearLessonContext();
    };
  }, [lesson.id, lesson.title, lesson.sections, setLessonContext, clearLessonContext]);

  // Ensure the page always starts cleanly at the top whenever a lesson opens or changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [lesson.id]);

  const handleUpdateMastery = async (newLevel: LessonMasteryLevel) => {
    setSaving(true);
    try {
      const confidence = newLevel === 'mastered' ? 5 : newLevel === 'reviewing' ? 3 : 2;
      await onSaveProgress(lesson.id, newLevel, confidence);
      setMastery(newLevel);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-20">
      {/* Lesson Hierarchy Breadcrumb Navigation */}
      <nav
        aria-label="Curriculum Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-slate-400 border-b border-white/[0.08] pb-3 overflow-x-auto no-scrollbar"
      >
        <span className="truncate max-w-[130px] sm:max-w-[200px]">{pathTitle}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[200px]">{topicTitle}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
        <span className="text-white font-medium truncate max-w-[150px] sm:max-w-[280px]">{lesson.title}</span>
      </nav>

      {/* Lesson Header Card */}
      <Card variant="elevated" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="blue" size="sm">
              {lesson.difficulty}
            </Badge>
            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {lesson.estimatedMinutes} mins
            </span>
          </div>

          {/* Current Mastery Badge */}
          <Badge
            variant={mastery === 'mastered' ? 'green' : mastery === 'learning' ? 'amber' : 'slate'}
            size="md"
            icon={<Award className="w-3.5 h-3.5" />}
          >
            Status: {mastery.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white heading-display tracking-tight">
            {lesson.title}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1.5 leading-relaxed">{lesson.subtitle}</p>
        </div>

        {/* Learning Objectives Box */}
        <div className="pt-3.5 border-t border-white/[0.08] space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            Core Learning Objectives
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {lesson.learningObjectives.map((obj, i) => (
              <div
                key={i}
                className="flex items-start gap-2.5 text-slate-300 bg-surface-subtle/80 p-2.5 rounded-xl border border-white/[0.06]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{obj}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Main Lesson Sections */}
      <div className="space-y-5 sm:space-y-6">
        {lesson.sections.map((sec) => (
          <Card key={sec.id} variant="default" padding="lg" className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white border-b border-white/[0.08] pb-2.5 heading-title">
              {sec.title}
            </h2>
            <div className="space-y-3">
              <MarkdownView content={sec.contentMarkdown} />
            </div>

            {/* Custom Callout Box */}
            {sec.callout && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                  sec.callout.type === 'pro_tip'
                    ? 'bg-success/15 border-success/30 text-emerald-200'
                    : sec.callout.type === 'warning'
                    ? 'bg-danger/15 border-danger/30 text-red-200'
                    : sec.callout.type === 'cisco_quirk'
                    ? 'bg-warning/15 border-warning/30 text-amber-200'
                    : 'bg-accent/15 border-accent/30 text-sky-200'
                }`}
              >
                {sec.callout.type === 'warning' ? (
                  <ShieldAlert className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                ) : sec.callout.type === 'cisco_quirk' ? (
                  <Sparkles className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <strong className="block font-semibold text-sm">{sec.callout.title}</strong>
                  <div className="leading-relaxed text-xs">
                    {renderInlineMarkdown(sec.callout.text)}
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Embedded Interactive Visualizer */}
      {lesson.interactiveWidget && (
        <section id="visualizer-section" className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            <Sparkles className="w-4 h-4 text-accent" />
            Interactive Concept Demonstration
          </div>

          {lesson.interactiveWidget.type === 'packet_walk' && <PacketWalkVisualizer />}
          {lesson.interactiveWidget.type === 'subnet_calculator' && <SubnetVisualizer />}
          {lesson.interactiveWidget.type === 'ospf_state_machine' && <OspfStateMachineVisualizer />}
        </section>
      )}

      {/* Active Learning Section */}
      <ActiveLearningSection
        lesson={lesson}
        exerciseAttempts={initialExerciseAttempts}
        onSaveExerciseAttempt={(attempt) => {
          if (attempt.status === 'correct') {
            setExercisePassed(true);
          }
          onSaveExerciseAttempt?.(attempt);
        }}
        onOpenAiTutor={(exerciseId) => {
          openTutor({ mode: 'socratic_hint', exerciseId });
        }}
      />

      {/* Related Resources & Cross-References */}
      <Card variant="default" padding="lg" className="space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 heading-title">
          <Layers className="w-4 h-4 text-accent" />
          Reinforce with NetMentor Flashcards & Labs
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Flashcard Cross-Ref */}
          {lesson.relatedFlashcardDecks?.map((deck) => (
            <div
              key={deck.id}
              className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.06] flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-accent block mb-1">
                  Flashcard Revision Deck
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-white">{deck.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{deck.description}</p>
              </div>

              {onNavigateToFlashcards && (
                <button
                  type="button"
                  onClick={() => onNavigateToFlashcards(deck.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-sky-300 font-semibold pt-1 press-scale self-start min-h-[36px]"
                >
                  <span>Study in Flashcard Mode</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          {/* Packet Tracer Lab Cross-Ref */}
          {lesson.relatedLabs?.map((lab) => (
            <div
              key={lab.id}
              className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.06] flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-success block mb-1">
                  Cisco Packet Tracer Lab
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-white">{lab.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{lab.description}</p>
              </div>

              {onNavigateToLabs && (
                <button
                  type="button"
                  onClick={() => onNavigateToLabs(lab.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-success hover:text-emerald-300 font-semibold pt-1 press-scale self-start min-h-[36px]"
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>View Lab in Catalog ({lab.filename})</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* External RFC / Documentation Links */}
        {lesson.externalReferences && lesson.externalReferences.length > 0 && (
          <div className="pt-3.5 border-t border-white/[0.08] space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Official Technical References:
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {lesson.externalReferences.map((ref, idx) => (
                <a
                  key={idx}
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle/90 border border-white/[0.08] text-slate-300 hover:text-white hover:border-white/20 transition-colors press-scale"
                >
                  <span>{ref.title}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Lesson Completion & Mastery Card (Part of Natural Document Flow - Avoids Nested Sticky Collision) */}
      <Card
        id="mastery-section"
        variant="elevated"
        padding="md"
        className="border border-brand-500/40 bg-surface-elevated/95 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <span className="text-xs text-slate-400 block font-medium">Finished studying this lesson?</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">Record Your Mastery Level:</span>
            {exercisePassed && (
              <Badge variant="green" size="sm">
                Challenge Solved!
              </Badge>
            )}
            {mastery === 'mastered' && (
              <Badge variant="green" size="sm">
                Mastered in Database
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant={mastery === 'learning' ? 'secondary' : 'ghost'}
            size="md"
            disabled={saving}
            onClick={() => handleUpdateMastery('learning')}
            className={`flex-1 sm:flex-initial min-h-[44px] ${
              mastery === 'learning' ? 'border-warning/60 text-amber-300 bg-warning/15 font-semibold' : ''
            }`}
          >
            Mark In Progress
          </Button>

          <Button
            variant={mastery === 'mastered' ? 'success' : 'primary'}
            size="md"
            disabled={saving}
            onClick={() => handleUpdateMastery('mastered')}
            icon={<CheckCircle2 className="w-4 h-4" />}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            <span>{mastery === 'mastered' ? 'Mastered!' : 'Mark as Mastered'}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
