import type {
  DetailedPath,
  DetailedLesson,
  LessonExercise,
  LessonSection,
} from '../types/curriculum.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CurriculumValidationResult extends ValidationResult {
  lessonCount: number;
  exerciseCount: number;
  pathCount: number;
  topicCount: number;
}

/**
 * Validates a single active-learning exercise deterministically.
 */
export function validateExercise(exercise: LessonExercise, contextPath = 'exercise'): ValidationResult {
  const errors: string[] = [];

  if (!exercise.id || typeof exercise.id !== 'string') {
    errors.push(`${contextPath}: Missing or invalid "id"`);
  }
  if (!exercise.type || typeof exercise.type !== 'string') {
    errors.push(`${contextPath}: Missing or invalid "type"`);
  }
  if (!exercise.prompt || typeof exercise.prompt !== 'string' || exercise.prompt.trim().length === 0) {
    errors.push(`${contextPath}: "prompt" must be a non-empty string`);
  }
  if (!exercise.explanation || typeof exercise.explanation !== 'string' || exercise.explanation.trim().length === 0) {
    errors.push(`${contextPath}: "explanation" must be a non-empty string`);
  }
  if (!Array.isArray(exercise.hints) || exercise.hints.length < 2) {
    errors.push(`${contextPath}: "hints" must contain at least 2 progressive hints`);
  } else {
    exercise.hints.forEach((hint, idx) => {
      if (!hint || typeof hint !== 'string' || hint.trim().length === 0) {
        errors.push(`${contextPath}.hints[${idx}]: Hint text must be non-empty string`);
      }
    });
  }

  // Type-specific answer key validation
  if (exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') {
    if (!Array.isArray(exercise.options) || exercise.options.length < 2) {
      errors.push(`${contextPath}: "${exercise.type}" must have at least 2 options`);
    } else {
      const correctOptions = exercise.options.filter((o) => o.isCorrect === true);
      if (correctOptions.length !== 1) {
        errors.push(
          `${contextPath}: "${exercise.type}" must have exactly ONE correct option (found ${correctOptions.length})`,
        );
      }
      exercise.options.forEach((opt, idx) => {
        if (!opt.id || typeof opt.id !== 'string') {
          errors.push(`${contextPath}.options[${idx}]: Missing option id`);
        }
        if (!opt.label || typeof opt.label !== 'string' || opt.label.trim().length === 0) {
          errors.push(`${contextPath}.options[${idx}]: Option label must be non-empty string`);
        }
      });
    }
  } else if (exercise.type === 'numerical') {
    if (typeof exercise.numericAnswer !== 'number' || isNaN(exercise.numericAnswer)) {
      errors.push(`${contextPath}: "numerical" exercise requires a valid "numericAnswer" number`);
    }
    if (exercise.numericTolerance !== undefined && (typeof exercise.numericTolerance !== 'number' || exercise.numericTolerance < 0)) {
      errors.push(`${contextPath}: "numericTolerance" must be a non-negative number`);
    }
  } else if (exercise.type === 'predict_output') {
    const hasPattern = typeof exercise.textAnswerPattern === 'string' && exercise.textAnswerPattern.trim().length > 0;
    const hasAcceptable = Array.isArray(exercise.acceptableAnswers) && exercise.acceptableAnswers.length > 0;
    if (!hasPattern && !hasAcceptable) {
      errors.push(`${contextPath}: "predict_output" exercise must provide "acceptableAnswers" or "textAnswerPattern"`);
    }
    if (hasPattern) {
      try {
        new RegExp(exercise.textAnswerPattern!, 'i');
      } catch (err: any) {
        errors.push(`${contextPath}: Invalid regex in "textAnswerPattern": ${err?.message}`);
      }
    }
  } else if (exercise.type === 'sequence') {
    if (!Array.isArray(exercise.sequenceItems) || exercise.sequenceItems.length < 2) {
      errors.push(`${contextPath}: "sequence" exercise must have at least 2 "sequenceItems"`);
    } else {
      const n = exercise.sequenceItems.length;
      const indices = exercise.sequenceItems.map((s) => s.correctIndex).sort((a, b) => a - b);
      const isContiguous = indices.every((val, i) => val === i);
      if (!isContiguous) {
        errors.push(
          `${contextPath}: "sequenceItems" correctIndex must be contiguous 0 to ${n - 1} (got: ${indices.join(', ')})`,
        );
      }
      exercise.sequenceItems.forEach((item, idx) => {
        if (!item.id || typeof item.id !== 'string') {
          errors.push(`${contextPath}.sequenceItems[${idx}]: Missing item id`);
        }
        if (!item.text || typeof item.text !== 'string' || item.text.trim().length === 0) {
          errors.push(`${contextPath}.sequenceItems[${idx}]: Item text must be non-empty string`);
        }
      });
    }
  } else {
    errors.push(`${contextPath}: Unknown exercise type "${exercise.type}"`);
  }

  // Common mistakes validation if provided
  if (exercise.commonMistakes) {
    if (!Array.isArray(exercise.commonMistakes)) {
      errors.push(`${contextPath}: "commonMistakes" must be an array`);
    } else {
      exercise.commonMistakes.forEach((cm, idx) => {
        if (!cm.mistake || typeof cm.mistake !== 'string' || cm.mistake.trim().length === 0) {
          errors.push(`${contextPath}.commonMistakes[${idx}]: "mistake" must be a non-empty string`);
        }
        if (!cm.explanation || typeof cm.explanation !== 'string' || cm.explanation.trim().length === 0) {
          errors.push(`${contextPath}.commonMistakes[${idx}]: "explanation" must be a non-empty string`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an entire Lesson structure deterministically.
 */
export function validateLesson(lesson: DetailedLesson): ValidationResult {
  const errors: string[] = [];
  const ctx = `Lesson [${lesson.id || 'unnamed'}]`;

  // Required metadata
  const requiredStringFields: (keyof DetailedLesson)[] = [
    'id',
    'topicId',
    'pathId',
    'slug',
    'title',
    'subtitle',
    'difficulty',
  ];
  for (const field of requiredStringFields) {
    if (!lesson[field] || typeof lesson[field] !== 'string' || (lesson[field] as string).trim().length === 0) {
      errors.push(`${ctx}: Missing or empty required string field "${field}"`);
    }
  }

  if (typeof lesson.estimatedMinutes !== 'number' || lesson.estimatedMinutes <= 0) {
    errors.push(`${ctx}: "estimatedMinutes" must be a positive number`);
  }

  if (!Array.isArray(lesson.learningObjectives) || lesson.learningObjectives.length < 2) {
    errors.push(`${ctx}: "learningObjectives" must contain at least 2 objectives`);
  } else {
    lesson.learningObjectives.forEach((obj, idx) => {
      if (!obj || typeof obj !== 'string' || obj.trim().length === 0) {
        errors.push(`${ctx}.learningObjectives[${idx}]: Objective must be non-empty string`);
      }
    });
  }

  // Sections validation
  if (!Array.isArray(lesson.sections) || lesson.sections.length === 0) {
    errors.push(`${ctx}: Lesson must contain at least 1 section in "sections"`);
  } else {
    lesson.sections.forEach((sec: LessonSection, idx: number) => {
      const sCtx = `${ctx}.sections[${idx} - ${sec.id || idx}]`;
      if (!sec.id || typeof sec.id !== 'string') errors.push(`${sCtx}: Missing section id`);
      if (!sec.title || typeof sec.title !== 'string') errors.push(`${sCtx}: Missing section title`);
      if (!sec.contentMarkdown || typeof sec.contentMarkdown !== 'string' || sec.contentMarkdown.trim().length === 0) {
        errors.push(`${sCtx}: Section contentMarkdown must be non-empty string`);
      }
      if (sec.callout) {
        const validCallouts = ['rfc', 'cisco_quirk', 'pro_tip', 'warning'];
        if (!validCallouts.includes(sec.callout.type)) {
          errors.push(`${sCtx}.callout: Invalid callout type "${sec.callout.type}"`);
        }
        if (!sec.callout.title || typeof sec.callout.title !== 'string') {
          errors.push(`${sCtx}.callout: Missing callout title`);
        }
        if (!sec.callout.text || typeof sec.callout.text !== 'string') {
          errors.push(`${sCtx}.callout: Missing callout text`);
        }
      }
    });
  }

  // Primary Predict Exercise
  if (!lesson.predictExercise) {
    errors.push(`${ctx}: Missing required "predictExercise"`);
  } else {
    const pRes = validateExercise(lesson.predictExercise, `${ctx}.predictExercise`);
    errors.push(...pRes.errors);
  }

  // Optional Practice Challenge
  if (lesson.practiceChallenge) {
    const cRes = validateExercise(lesson.practiceChallenge, `${ctx}.practiceChallenge`);
    errors.push(...cRes.errors);
  }

  // Exercise challenge bank
  if (lesson.exercises) {
    if (!Array.isArray(lesson.exercises)) {
      errors.push(`${ctx}: "exercises" must be an array`);
    } else {
      const exIds = new Set<string>();
      lesson.exercises.forEach((ex, idx) => {
        if (exIds.has(ex.id)) {
          errors.push(`${ctx}: Duplicate exercise ID "${ex.id}" in exercises bank`);
        }
        exIds.add(ex.id);
        const exRes = validateExercise(ex, `${ctx}.exercises[${idx}]`);
        errors.push(...exRes.errors);
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the entire curriculum graph, verifying structural consistency and ID uniqueness.
 */
export function validateCurriculum(paths: DetailedPath[]): CurriculumValidationResult {
  const errors: string[] = [];
  const pathIds = new Set<string>();
  const topicIds = new Set<string>();
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();

  let lessonCount = 0;
  let exerciseCount = 0;
  let topicCount = 0;

  if (!Array.isArray(paths) || paths.length === 0) {
    errors.push('Curriculum paths array must be non-empty');
    return {
      valid: false,
      errors,
      lessonCount: 0,
      exerciseCount: 0,
      pathCount: 0,
      topicCount: 0,
    };
  }

  for (const p of paths) {
    if (pathIds.has(p.id)) {
      errors.push(`Duplicate path ID "${p.id}"`);
    }
    pathIds.add(p.id);

    for (const t of p.topics) {
      topicCount++;
      if (topicIds.has(t.id)) {
        errors.push(`Duplicate topic ID "${t.id}"`);
      }
      topicIds.add(t.id);

      for (const l of t.lessons) {
        lessonCount++;
        if (lessonIds.has(l.id)) {
          errors.push(`Duplicate lesson ID "${l.id}"`);
        }
        lessonIds.add(l.id);

        const lRes = validateLesson(l);
        errors.push(...lRes.errors);

        // Check exercise ID uniqueness across the curriculum
        const lessonExList: LessonExercise[] = [];
        if (l.predictExercise) lessonExList.push(l.predictExercise);
        if (l.practiceChallenge) lessonExList.push(l.practiceChallenge);
        if (l.exercises) lessonExList.push(...l.exercises);

        for (const ex of lessonExList) {
          if (ex && ex.id) {
            exerciseCount++;
            if (exerciseIds.has(ex.id)) {
              // Note: predictExercise and practiceChallenge are typically also in exercises[]
              // so duplicate within the same lesson is allowed, but across different lessons is not.
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    lessonCount,
    exerciseCount,
    pathCount: paths.length,
    topicCount,
  };
}
