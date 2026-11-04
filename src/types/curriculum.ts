/**
 * NetMentor Curriculum & Interactive Lesson Domain Types
 */

export type ExerciseType =
  | 'multiple_choice'
  | 'numerical'
  | 'predict_output'
  | 'sequence'
  | 'troubleshooting';

export interface ExerciseOption {
  id: string;
  label: string;
  isCorrect: boolean;
  explanation: string;
}

export interface SequenceItem {
  id: string;
  text: string;
  correctIndex: number;
}

export interface CommonMistake {
  mistake: string;
  explanation: string;
}

export interface VisualizerLink {
  type: 'packet_walk' | 'subnet_calculator' | 'ospf_state_machine';
  targetStep?: number;
  label: string;
}

export interface LessonExercise {
  id: string;
  lessonId?: string;
  type: ExerciseType;
  title?: string;
  prompt: string;
  learningObjective?: string;
  scenarioContext?: string;
  options?: ExerciseOption[];
  numericAnswer?: number;
  numericTolerance?: number;
  textAnswerPattern?: string; // Regex string for flexible matching
  acceptableAnswers?: string[]; // Alternative exact or case-insensitive answers
  sequenceItems?: SequenceItem[];
  hints: string[]; // Progressive hints: 1 (Concept), 2 (Narrow reasoning), 3 (Explicit clue)
  explanation: string; // Underlying networking principle
  commonMistakes?: CommonMistake[]; // Why common alternative answers fail
  practicalTakeaway?: string; // Practical takeaway / rule of thumb
  difficulty: 'fundamentals' | 'ccna' | 'ccnp';
  visualizerLink?: VisualizerLink;
  labLink?: { id: string; label: string };
}

export interface CalloutConfig {
  type: 'rfc' | 'cisco_quirk' | 'pro_tip' | 'warning';
  title: string;
  text: string;
}

export interface LessonSection {
  id: string;
  title: string;
  contentMarkdown: string;
  callout?: CalloutConfig;
}

export interface InteractiveWidgetConfig {
  type: 'packet_walk' | 'subnet_calculator' | 'ospf_state_machine';
  title: string;
  description: string;
  initialState?: Record<string, any>;
}

export interface RelatedResource {
  id: string;
  title: string;
  type: 'flashcard' | 'lab';
  day?: number;
  filename?: string;
  description?: string;
}

export interface DetailedLesson {
  id: string;
  topicId: string;
  pathId: string;
  slug: string;
  title: string;
  subtitle: string;
  difficulty: 'Fundamentals' | 'CCNA' | 'CCNP Enterprise';
  estimatedMinutes: number;
  learningObjectives: string[];
  sections: LessonSection[];
  interactiveWidget?: InteractiveWidgetConfig;
  predictExercise: LessonExercise;
  practiceChallenge?: LessonExercise;
  exercises?: LessonExercise[]; // Complete active learning challenge bank
  relatedFlashcardDecks?: RelatedResource[];
  relatedLabs?: RelatedResource[];
  externalReferences: {
    title: string;
    url: string;
    sourceType: 'cisco_doc' | 'rfc' | 'cert_guide';
    relevantSection?: string;
  }[];
}

export interface DetailedTopic {
  id: string;
  pathId: string;
  slug: string;
  title: string;
  description: string;
  orderIndex: number;
  estimatedMinutes: number;
  lessons: DetailedLesson[];
}

export interface DetailedPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetCert: 'Fundamentals' | 'CCNA' | 'CCNP Enterprise';
  orderIndex: number;
  topics: DetailedTopic[];
}

export type LessonMasteryLevel = 'not_started' | 'learning' | 'reviewing' | 'mastered';

export type ExerciseOutcome = 'unattempted' | 'incorrect' | 'correct';

export interface ExerciseAttemptRecord {
  exerciseId: string;
  lessonId: string;
  status: ExerciseOutcome;
  attemptsCount: number;
  hintsUsedCount: number;
  lastSubmittedAnswer?: any;
  lastAttemptedAt: string;
}

export interface LessonProgressState {
  lessonId: string;
  masteryLevel: LessonMasteryLevel;
  confidenceScore: number; // 1-5
  lastReviewedAt: string | null;
  notes?: string;
  exerciseAttempts?: Record<string, ExerciseAttemptRecord>;
}
