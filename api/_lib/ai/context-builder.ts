/**
 * NetMentor AI Tutor Engine - Grounded Context Builder
 * 
 * Extracts lesson metadata and active section/exercise context from the authoritative
 * in-memory curriculum. Enforces strict boundary defenses to sanitize and strip all
 * answer keys and solution-revealing metadata before any context reaches the AI prompt.
 */

import type { DetailedLesson, LessonExercise } from '../../../src/types/curriculum.js';
import { getLessonById } from '../../../src/data/curriculum/index.js';
import type {
  GroundedLessonContext,
  GroundedLessonSection,
  GroundedExerciseContext,
  GroundedExerciseOption,
  GroundedSequenceItem,
  GroundedContextResult,
  AiTutoringMode,
} from './types.js';

export interface BuildGroundedContextParams {
  lessonId: string;
  sectionId?: string;
  exerciseId?: string;
  mode?: AiTutoringMode;
}

/**
 * Extracts all unique exercise IDs configured in a lesson (predict, challenge, and exercise bank).
 */
export function getAllExerciseIds(lesson: DetailedLesson): string[] {
  const ids = new Set<string>();

  if (lesson.predictExercise?.id) {
    ids.add(lesson.predictExercise.id);
  }
  if (lesson.practiceChallenge?.id) {
    ids.add(lesson.practiceChallenge.id);
  }
  if (Array.isArray(lesson.exercises)) {
    for (const ex of lesson.exercises) {
      if (ex?.id) {
        ids.add(ex.id);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Resolves an exercise by unique ID within a lesson's challenge structures.
 */
export function findExerciseInLesson(lesson: DetailedLesson, exerciseId: string): LessonExercise | null {
  if (lesson.predictExercise && lesson.predictExercise.id === exerciseId) {
    return lesson.predictExercise;
  }
  if (lesson.practiceChallenge && lesson.practiceChallenge.id === exerciseId) {
    return lesson.practiceChallenge;
  }
  if (Array.isArray(lesson.exercises)) {
    const found = lesson.exercises.find((ex) => ex.id === exerciseId);
    if (found) return found;
  }
  return null;
}

/**
 * STRICT ANSWER-KEY MASKING BOUNDARY:
 * Transforms an exercise into a sanitized representation suitable for AI prompts.
 * 
 * Strip list:
 * - isCorrect (options)
 * - explanation on options (explains why correct choice is right)
 * - explanation (top-level answer explanation)
 * - numericAnswer & numericTolerance
 * - textAnswerPattern & acceptableAnswers
 * - correctIndex (sequence items)
 */
export function sanitizeExerciseForGroundedContext(exercise: LessonExercise): GroundedExerciseContext {
  const grounded: GroundedExerciseContext = {
    id: exercise.id,
    type: exercise.type,
    title: exercise.title,
    prompt: exercise.prompt,
    learningObjective: exercise.learningObjective,
    scenarioContext: exercise.scenarioContext,
    hints: Array.isArray(exercise.hints) ? [...exercise.hints] : [],
    difficulty: exercise.difficulty,
  };

  // Strip multiple_choice / troubleshooting options: retain ONLY id and label
  if (Array.isArray(exercise.options)) {
    grounded.options = exercise.options.map((opt): GroundedExerciseOption => ({
      id: opt.id,
      label: opt.label,
    }));
  }

  // Strip sequence items: retain ONLY id and text
  if (Array.isArray(exercise.sequenceItems)) {
    grounded.sequenceItems = exercise.sequenceItems.map((item): GroundedSequenceItem => ({
      id: item.id,
      text: item.text,
    }));
  }

  // Retain common mistakes to help the AI detect when students fall into known traps
  if (Array.isArray(exercise.commonMistakes)) {
    grounded.commonMistakes = exercise.commonMistakes.map((cm) => ({
      mistake: cm.mistake,
      explanation: cm.explanation,
    }));
  }

  return grounded;
}

/**
 * Assembles grounded lesson context for AI tutoring requests.
 * Validates existence of lessonId, sectionId, and exerciseId against curriculum.
 */
export function buildGroundedLessonContext(params: BuildGroundedContextParams): GroundedContextResult {
  if (!params || !params.lessonId || typeof params.lessonId !== 'string') {
    return {
      success: false,
      error: 'InvalidRequest',
      message: 'A valid string lessonId is required to build grounded context.',
    };
  }

  const lessonLookup = getLessonById(params.lessonId);
  if (!lessonLookup) {
    return {
      success: false,
      error: 'UnknownLesson',
      message: `Lesson with ID "${params.lessonId}" was not found in the curriculum catalog.`,
    };
  }

  const { lesson, pathTitle, topicTitle, pathId, topicId } = lessonLookup;

  // Validate optional sectionId
  let currentSection: GroundedLessonSection | undefined;
  if (params.sectionId) {
    const section = lesson.sections.find((s) => s.id === params.sectionId);
    if (!section) {
      return {
        success: false,
        error: 'UnknownSection',
        message: `Section with ID "${params.sectionId}" was not found in lesson "${lesson.title}".`,
      };
    }
    currentSection = {
      id: section.id,
      title: section.title,
      contentMarkdown: section.contentMarkdown,
      calloutTitle: section.callout?.title,
      calloutText: section.callout?.text,
    };
  }

  // Validate optional exerciseId
  let currentExercise: GroundedExerciseContext | undefined;
  if (params.exerciseId) {
    const rawExercise = findExerciseInLesson(lesson, params.exerciseId);
    if (!rawExercise) {
      return {
        success: false,
        error: 'UnknownExercise',
        message: `Exercise with ID "${params.exerciseId}" was not found in lesson "${lesson.title}".`,
      };
    }
    currentExercise = sanitizeExerciseForGroundedContext(rawExercise);
  }

  const context: GroundedLessonContext = {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonSubtitle: lesson.subtitle,
    pathId,
    pathTitle,
    topicId,
    topicTitle,
    difficulty: lesson.difficulty,
    learningObjectives: Array.isArray(lesson.learningObjectives) ? [...lesson.learningObjectives] : [],
    currentSection,
    currentExercise,
    availableSections: lesson.sections.map((s) => ({ id: s.id, title: s.title })),
    availableExerciseIds: getAllExerciseIds(lesson),
  };

  return {
    success: true,
    context,
  };
}
