/**
 * NetMentor AI Tutor Engine - Core Domain Types
 * 
 * Provides strict TypeScript types for lesson grounding, Socratic tutoring,
 * prompt construction, and pluggable AI providers.
 */

import type { ExerciseType, CommonMistake } from '../../../src/types/curriculum.js';

/**
 * Tutoring interaction modes supported by the NetMentor AI engine.
 */
export type AiTutoringMode = 'general_qa' | 'lesson_qa' | 'socratic_hint';

export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

/**
 * Sanitized option for multiple choice / troubleshooting in AI context.
 * Strictly excludes answer correctness (`isCorrect`) and answer-revealing explanation.
 */
export interface GroundedExerciseOption {
  id: string;
  label: string;
}

/**
 * Sanitized sequence item.
 * Strictly excludes `correctIndex` to prevent answer leakage.
 */
export interface GroundedSequenceItem {
  id: string;
  text: string;
}

/**
 * Sanitized exercise representation for AI prompts.
 * Strictly excludes all answer-key fields (numericAnswer, acceptableAnswers,
 * textAnswerPattern, isCorrect, correctIndex, top-level answer explanation).
 */
export interface GroundedExerciseContext {
  id: string;
  type: ExerciseType;
  title?: string;
  prompt: string;
  learningObjective?: string;
  scenarioContext?: string;
  options?: GroundedExerciseOption[];
  sequenceItems?: GroundedSequenceItem[];
  hints: string[];
  commonMistakes?: CommonMistake[];
  difficulty: 'fundamentals' | 'ccna' | 'ccnp';
}

/**
 * Grounded section context within a lesson.
 */
export interface GroundedLessonSection {
  id: string;
  title: string;
  contentMarkdown: string;
  calloutTitle?: string;
  calloutText?: string;
}

/**
 * Grounded lesson context assembled from the official in-memory curriculum.
 */
export interface GroundedLessonContext {
  lessonId: string;
  lessonTitle: string;
  lessonSubtitle: string;
  pathId: string;
  pathTitle: string;
  topicId: string;
  topicTitle: string;
  difficulty: string;
  learningObjectives: string[];
  currentSection?: GroundedLessonSection;
  currentExercise?: GroundedExerciseContext;
  availableSections: { id: string; title: string }[];
  availableExerciseIds: string[];
}

export interface GroundedContextSuccess {
  success: true;
  context: GroundedLessonContext;
}

export interface GroundedContextError {
  success: false;
  error: 'UnknownLesson' | 'UnknownSection' | 'UnknownExercise' | 'InvalidRequest';
  message: string;
}

export type GroundedContextResult = GroundedContextSuccess | GroundedContextError;

export interface ActiveLabCliEntry {
  prompt: string;
  command: string;
  outputSummary: string;
}

export interface ActiveLabTablesSummary {
  ospfNeighbors?: string;
  routingTable?: string;
  arpCache?: string;
  macTable?: string;
  tcpState?: string;
}

export interface ActiveLabContext {
  scenarioId: string;
  title: string;
  protocol: string;
  certification: string;
  difficulty: string;
  objective?: string;
  currentStepIndex: number;
  totalSteps: number;
  currentStepTitle?: string;
  activeCliNodeId?: string;
  activeCliNodeName?: string;
  activePrompt?: string;
  isObjectiveSolved: boolean;
  recentCliCommands: ActiveLabCliEntry[];
  activeNodeTablesSummary?: ActiveLabTablesSummary;
}

/**
 * Inbound request parameters to the tutor.
 */
export interface TutorLessonRequest {
  lessonId?: string;
  sectionId?: string;
  exerciseId?: string;
  query: string;
  history?: AiHistoryTurn[];
  mode?: AiTutoringMode;
  conversationId?: string;
  labContext?: ActiveLabContext;
}

export interface SocraticHintRequest {
  lessonId: string;
  exerciseId: string;
  query?: string;
  attemptCount?: number;
  lastSubmittedAnswer?: unknown;
  hintsUsedCount?: number;
}

/**
 * Abstract AI Provider Request & Response interfaces for future model integrations.
 */
export interface AiGenerateRequest {
  systemPrompt: string;
  userPrompt: string;
  history?: AiHistoryTurn[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional epoch timestamp (ms since epoch) representing a hard deadline for the overall AI generation chain.
   * Remote provider attempts will halt before this timestamp to reserve compute budget for validation/persistence.
   */
  deadlineTimestamp?: number;
  /**
   * Optional maximum total duration in milliseconds across the entire AI fallback chain.
   * Defaults to 35,000ms (35 seconds) to guarantee headroom within the 60s serverless function limit.
   */
  maxChainDurationMs?: number;
}

export interface AiGenerateResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  finishReason?: string;
  isSimulated?: boolean;
}

/**
 * Common pluggable AI provider client interface.
 */
export interface AiProviderClient {
  generateResponse(request: AiGenerateRequest): Promise<AiGenerateResponse>;
}

export interface TutorResponse {
  answer: string;
  mode: AiTutoringMode;
  groundedLessonId?: string;
  groundedSectionId?: string;
  groundedExerciseId?: string;
  suggestedFollowUps?: string[];
  model: string;
  conversationId?: string;
}

/**
 * ============================================================================
 * Milestone 2: AI-Generated Lessons Domain Types
 * ============================================================================
 */

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type LessonDepth = 'overview' | 'standard' | 'deep_dive';

export interface GeneratedLessonTerminology {
  term: string;
  definition: string;
}

export interface GeneratedLessonCommand {
  platform?: string; // e.g. "Cisco IOS-XE", "Linux"
  description?: string;
  command: string;
  expectedOutput?: string;
  notes?: string;
}

export interface GeneratedLessonPracticalScenario {
  title: string;
  description: string;
  packetFlow?: string;
  troubleshootingSteps?: string[];
  commonMistakes?: {
    mistake: string;
    cause: string;
    prevention: string;
  }[];
}

export interface GeneratedLessonSection {
  id: string;
  title: string;
  explanation: string; // Markdown supported
  terminology?: GeneratedLessonTerminology[];
  commands?: GeneratedLessonCommand[];
  practicalScenario?: GeneratedLessonPracticalScenario;
}

export interface GeneratedLessonKnowledgeCheckOption {
  id: string;
  text: string;
}

export interface GeneratedLessonKnowledgeCheck {
  id: string;
  question: string;
  options: GeneratedLessonKnowledgeCheckOption[];
  correctOptionId: string;
  explanation: string;
}

export interface GeneratedLessonSummary {
  keyTakeaways: string[];
  keyTerms: GeneratedLessonTerminology[];
  whatYouLearned: string;
  suggestedNextTopics: string[];
}

export interface GeneratedLessonContent {
  lessonTitle: string;
  shortDescription: string;
  topic: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  sections: GeneratedLessonSection[];
  knowledgeChecks: GeneratedLessonKnowledgeCheck[];
  summary: GeneratedLessonSummary;
}

export interface GenerateLessonRequestParams {
  topic: string;
  difficulty?: LessonDifficulty;
  desiredDepth?: LessonDepth;
  platform?: string;
  prerequisites?: string[];
  goals?: string[];
  conversationContext?: string;
  conversationId?: string;
}

export interface LessonValidationResult {
  valid: boolean;
  errors?: string[];
  lesson?: GeneratedLessonContent;
}

/**
 * AI-Generated Flashcards Domain Types (Milestone 3)
 */
export interface GeneratedFlashcard {
  id?: string;
  frontMarkdown: string;
  backMarkdown: string;
  cardType?: 'basic' | 'cloze' | 'fill_in_blank';
  tags?: string[];
  orderIndex?: number;
}

export interface GeneratedFlashcardDeck {
  title: string;
  description: string;
  cards: GeneratedFlashcard[];
}

export interface GenerateFlashcardsRequestParams {
  lessonId?: string;
  topic?: string;
  cardCount?: number;
  focusArea?: string;
  difficulty?: string;
  emphasis?: string;
}

export interface FlashcardValidationResult {
  valid: boolean;
  errors?: string[];
  deck?: GeneratedFlashcardDeck;
}

/**
 * ============================================================================
 * AI-Generated Quiz Domain Types (Milestone: AI Quiz Generation)
 * ============================================================================
 */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizQuestionType = 'single_choice' | 'multiple_select' | 'true_false' | 'scenario';

export interface QuizQuestionOption {
  id: string; // e.g. "A", "B", "C", "D" or "true", "false"
  text: string;
}

export interface GeneratedQuizQuestion {
  id: string; // e.g. "q-1"
  type: QuizQuestionType;
  question: string;
  scenarioContext?: string;
  options: QuizQuestionOption[];
  correctAnswer: string | string[] | boolean; // Server-side answer key
  explanation: string; // Server-side explanation
  metadata?: {
    topic?: string;
    points?: number;
    platform?: string;
  };
  orderIndex: number;
}

export interface ClientQuizQuestion {
  id: string;
  type: QuizQuestionType;
  question: string;
  scenarioContext?: string;
  options: QuizQuestionOption[];
  metadata?: {
    topic?: string;
    points?: number;
    platform?: string;
  };
  orderIndex: number;
}

export interface GeneratedQuiz {
  id?: string;
  title: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionTypes: QuizQuestionType[];
  lessonId?: string | null;
  lessonTitle?: string | null;
  questions: GeneratedQuizQuestion[];
}

export interface ClientQuiz {
  id?: string;
  title: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionTypes: QuizQuestionType[];
  lessonId?: string | null;
  lessonTitle?: string | null;
  questions: ClientQuizQuestion[];
}

export interface GenerateQuizRequestParams {
  topic: string;
  difficulty?: QuizDifficulty;
  questionCount?: number;
  questionTypes?: QuizQuestionType[];
  lessonId?: string;
}

export interface QuizValidationResult {
  valid: boolean;
  errors?: string[];
  quiz?: GeneratedQuiz;
}

export interface GradedQuestionResult {
  questionId: string;
  question: string;
  type: QuizQuestionType;
  options: QuizQuestionOption[];
  scenarioContext?: string;
  userAnswer: string | string[] | boolean | null;
  correctAnswer: string | string[] | boolean;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizSubmissionPayload {
  answers: Record<string, string | string[] | boolean>;
  timeTakenSeconds?: number;
}

export interface QuizAttemptDetail {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds?: number;
  answers: Record<string, string | string[] | boolean>;
  results: GradedQuestionResult[];
  completedAt: string;
}


