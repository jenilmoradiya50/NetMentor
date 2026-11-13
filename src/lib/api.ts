/**
 * Frontend API client with credentials and CSRF mitigation headers.
 */

import type { ProtocolSimulationScenario, SavedSimulationRecord } from '../types/protocol-simulation';


export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  errors?: string[];
  category?: string;
  retryAfterSeconds?: number;
  status: number;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});

  // Add custom header to satisfy server-side CSRF guard
  headers.set('X-NetMentor-Request', '1');

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
      // Ensure cookies (HttpOnly session) are transmitted
      credentials: 'same-origin',
    });

    let json: any = {};
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }

    if (!res.ok) {
      const retryHeader = res.headers.get('Retry-After');
      const retryParsed = retryHeader ? parseInt(retryHeader, 10) : undefined;
      return {
        status: res.status,
        error: json.error || 'RequestFailed',
        message: json.message || `Request failed with status ${res.status}`,
        errors: Array.isArray(json.errors) ? json.errors : undefined,
        category: typeof json.category === 'string' ? json.category : undefined,
        retryAfterSeconds: json.retryAfterSeconds || json.retryAfter || (Number.isFinite(retryParsed) ? retryParsed : undefined),
      };
    }

    return {
      status: res.status,
      data: json as T,
    };
  } catch (err: any) {
    return {
      status: 0,
      error: 'NetworkError',
      message: err?.message || 'Failed to connect to NetMentor server.',
    };
  }
}

export const authApi = {
  login: (credentials: { username: string; passphrase: string }) =>
    fetchApi<{ success: boolean; role: string; user: string; expiresIn: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    fetchApi<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  checkSession: () =>
    fetchApi<{ authenticated: boolean; role: string; user: string; expiresAt: number }>('/api/auth/session', {
      method: 'GET',
    }),

  getPaths: () =>
    fetchApi<{ paths: any[] }>('/api/paths', {
      method: 'GET',
    }),
};

export const flashcardsApi = {
  getCatalog: () =>
    fetchApi<{ totalDecks: number; decks: any[] }>('/api/flashcards/catalog', {
      method: 'GET',
    }),

  getDecks: () =>
    fetchApi<{ decks: any[] }>('/api/flashcards/decks', {
      method: 'GET',
    }),

  getCards: (deckId: string) =>
    fetchApi<{ deck: any; cards: any[]; totalCards: number }>(`/api/flashcards/cards?deckId=${encodeURIComponent(deckId)}`, {
      method: 'GET',
    }),

  preview: (payload: { catalogId?: string; base64Data?: string; filename?: string }) =>
    fetchApi<{ preview: any }>('/api/flashcards/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  importDeck: (payload: { catalogId?: string; base64Data?: string; filename?: string; customTitle?: string }) =>
    fetchApi<{ success: boolean; alreadyImported: boolean; deckId: string; title: string; cardCount: number; message: string; warnings?: string[] }>('/api/flashcards/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteDeck: (deckId: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/flashcards/decks', {
      method: 'DELETE',
      body: JSON.stringify({ id: deckId }),
    }),

  updateProgress: (payload: { cardId: string; deckId: string; status: 'new' | 'learning' | 'review' | 'mastered'; confidenceScore?: number }) =>
    fetchApi<{ success: boolean; progress: any }>('/api/flashcards/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getLessonDeck: (lessonId: string) =>
    fetchApi<{ success: boolean; deck: any | null; cards: any[]; totalCards?: number }>(
      `/api/flashcards/lesson-deck?lessonId=${encodeURIComponent(lessonId)}`,
      { method: 'GET' },
    ),

  saveLessonDeck: (payload: {
    lessonId: string;
    title?: string;
    description?: string;
    cards: Array<{
      id?: string;
      frontMarkdown: string;
      backMarkdown: string;
      tags?: string[];
      cardType?: 'basic' | 'cloze' | 'fill_in_blank';
      orderIndex?: number;
    }>;
  }) =>
    fetchApi<{ success: boolean; deckId: string; cardCount: number; isUpdated: boolean; message: string }>(
      '/api/flashcards/lesson-deck',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  generateStandaloneFlashcards: (payload: {
    topic: string;
    cardCount?: number;
    focusArea?: string;
    difficulty?: string;
    emphasis?: string;
  }) =>
    fetchApi<{
      success: boolean;
      deck: {
        title: string;
        description: string;
        cards: Array<{
          id?: string;
          frontMarkdown: string;
          backMarkdown: string;
          tags?: string[];
          cardType?: 'basic' | 'cloze' | 'fill_in_blank';
          orderIndex?: number;
        }>;
      };
      topic?: string;
      model?: string;
      isSimulated?: boolean;
    }>('/api/ai/generate-flashcards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getStandaloneDeck: (deckId: string) =>
    fetchApi<{ success: boolean; deck: any | null; cards: any[]; totalCards?: number }>(
      `/api/flashcards/standalone-deck?deckId=${encodeURIComponent(deckId)}`,
      { method: 'GET' },
    ),

  saveStandaloneDeck: (payload: {
    deckId?: string;
    topic?: string;
    title?: string;
    description?: string;
    cards: Array<{
      id?: string;
      frontMarkdown: string;
      backMarkdown: string;
      tags?: string[];
      cardType?: 'basic' | 'cloze' | 'fill_in_blank';
      orderIndex?: number;
    }>;
  }) =>
    fetchApi<{ success: boolean; deckId: string; cardCount: number; isUpdated: boolean; message: string }>(
      '/api/flashcards/standalone-deck',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
};

export const labsApi = {
  getLabs: () =>
    fetchApi<{ totalLabs: number; softwareRequirement: string; browserExecutionNotice: string; labs: any[] }>('/api/labs', {
      method: 'GET',
    }),
};

export const curriculumApi = {
  getPaths: () =>
    fetchApi<{ paths: any[] }>('/api/paths', {
      method: 'GET',
    }),

  getProgress: () =>
    fetchApi<{ success: boolean; progress: any[] }>('/api/curriculum/progress', {
      method: 'GET',
    }),

  saveProgress: (payload: {
    lessonId: string;
    masteryLevel: 'not_started' | 'learning' | 'reviewing' | 'mastered';
    confidenceScore?: number;
    notes?: string;
    exerciseAttempt?: {
      exerciseId: string;
      status: 'unattempted' | 'incorrect' | 'correct';
      attemptsCount: number;
      hintsUsedCount: number;
      lastSubmittedAnswer?: any;
    };
  }) =>
    fetchApi<{ success: boolean; progress: any }>('/api/curriculum/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export interface AiTutorRequestPayload {
  lessonId?: string;
  sectionId?: string;
  exerciseId?: string;
  query: string;
  mode?: 'general_qa' | 'lesson_qa' | 'socratic_hint';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
}

export interface AiTutorResponsePayload {
  success: boolean;
  conversationId?: string;
  mode: 'general_qa' | 'lesson_qa' | 'socratic_hint';
  answer: string;
  groundedContext?: {
    lessonId: string;
    lessonTitle: string;
    sectionId?: string;
    exerciseId?: string;
  };
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  isSimulated: boolean;
}

export interface AiConversationSummary {
  id: string;
  userId: string;
  title: string;
  mode: 'general_qa' | 'lesson_qa' | 'socratic_hint';
  lessonId?: string | null;
  sectionId?: string | null;
  exerciseId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string | null;
  isSimulated: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  createdAt: string;
}

/**
 * Formats model and simulated metadata into a human-readable, safe provider badge.
 */
export function formatProviderLabel(
  model?: string | null,
  isSimulated?: boolean
): {
  label: string;
  isSimulated: boolean;
  variant: 'blue' | 'green' | 'amber' | 'purple';
} {
  if (isSimulated || !model || model.includes('mock')) {
    return { label: 'Simulated', isSimulated: true, variant: 'blue' };
  }
  const lower = model.toLowerCase();
  if (lower.startsWith('gemini') || lower.includes('gemini')) {
    return { label: 'Gemini', isSimulated: false, variant: 'green' };
  }
  if (lower.startsWith('groq') || lower.includes('groq') || lower.includes('qwen')) {
    return { label: 'Groq', isSimulated: false, variant: 'green' };
  }
  if (lower.startsWith('cloudflare') || lower.includes('@cf/')) {
    return { label: 'Cloudflare AI', isSimulated: false, variant: 'green' };
  }
  if (lower.startsWith('cohere') || lower.includes('command-r')) {
    return { label: 'Cohere', isSimulated: false, variant: 'green' };
  }
  if (lower.startsWith('nvidia') || lower.includes('deepseek')) {
    return { label: 'NVIDIA AI', isSimulated: false, variant: 'green' };
  }
  const clean = model.split('/').pop()?.slice(0, 16) || 'Live AI';
  return { label: clean, isSimulated: false, variant: 'green' };
}

export const aiApi = {
  askTutor: (payload: AiTutorRequestPayload) =>
    fetchApi<AiTutorResponsePayload>('/api/ai/tutor', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listConversations: () =>
    fetchApi<{ success: boolean; conversations: AiConversationSummary[] }>('/api/ai/conversations'),

  getConversation: (id: string) =>
    fetchApi<{
      success: boolean;
      conversation: AiConversationSummary;
      messages: AiConversationMessage[];
    }>(`/api/ai/conversations?id=${encodeURIComponent(id)}`),

  createConversation: (payload: {
    title?: string;
    mode?: 'general_qa' | 'lesson_qa' | 'socratic_hint';
    lessonId?: string;
    sectionId?: string;
    exerciseId?: string;
  }) =>
    fetchApi<{ success: boolean; conversation: AiConversationSummary }>('/api/ai/conversations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  renameConversation: (id: string, title: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/ai/conversations', {
      method: 'PATCH',
      body: JSON.stringify({ id, title }),
    }),

  deleteConversation: (id: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/ai/conversations', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    }),
};

/**
 * ============================================================================
 * Milestone 2: AI-Generated Lessons Frontend API & Types
 * ============================================================================
 */

export interface GeneratedLessonTerminologyItem {
  term: string;
  definition: string;
}

export interface GeneratedLessonCommandItem {
  platform?: string;
  description?: string;
  command: string;
  expectedOutput?: string;
  notes?: string;
}

export interface GeneratedLessonPracticalScenarioItem {
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

export interface GeneratedLessonSectionItem {
  id: string;
  title: string;
  explanation: string;
  terminology?: GeneratedLessonTerminologyItem[];
  commands?: GeneratedLessonCommandItem[];
  practicalScenario?: GeneratedLessonPracticalScenarioItem;
}

export interface GeneratedLessonKnowledgeCheckOptionItem {
  id: string;
  text: string;
}

export interface GeneratedLessonKnowledgeCheckItem {
  id: string;
  question: string;
  options: GeneratedLessonKnowledgeCheckOptionItem[];
  correctOptionId: string;
  explanation: string;
}

export interface GeneratedLessonSummaryItem {
  keyTakeaways: string[];
  keyTerms: GeneratedLessonTerminologyItem[];
  whatYouLearned: string;
  suggestedNextTopics: string[];
}

export interface GeneratedLessonContent {
  lessonTitle: string;
  shortDescription: string;
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  sections: GeneratedLessonSectionItem[];
  knowledgeChecks: GeneratedLessonKnowledgeCheckItem[];
  summary: GeneratedLessonSummaryItem;
}

export interface GeneratedLessonSummary {
  id: string;
  userId: string;
  conversationId?: string | null;
  title: string;
  topic: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  tags: string[];
  prerequisites: string[];
  learningObjectives: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedLessonDetail extends GeneratedLessonSummary {
  content: GeneratedLessonContent | null;
}

export const generatedLessonsApi = {
  generateLesson: (payload: {
    topic: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    desiredDepth?: 'overview' | 'standard' | 'deep_dive';
    platform?: string;
    prerequisites?: string[];
    goals?: string[];
    conversationContext?: string;
    conversationId?: string;
  }) =>
    fetchApi<{
      success: boolean;
      lesson: GeneratedLessonContent;
      model: string;
      isSimulated: boolean;
      conversationId: string | null;
    }>('/api/ai/generate-lesson', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listLessons: (params?: { search?: string; difficulty?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.difficulty && params.difficulty !== 'all') query.set('difficulty', params.difficulty);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchApi<{ success: boolean; lessons: GeneratedLessonSummary[]; count: number }>(
      `/api/lessons/generated${qs}`
    );
  },

  getLesson: (id: string) =>
    fetchApi<{ success: boolean; lesson: GeneratedLessonDetail }>(
      `/api/lessons/generated?id=${encodeURIComponent(id)}`
    ),

  saveLesson: (lesson: GeneratedLessonContent, conversationId?: string) =>
    fetchApi<{ success: boolean; lessonId: string; lesson: GeneratedLessonDetail }>(
      '/api/lessons/generated',
      {
        method: 'POST',
        body: JSON.stringify({ lesson, conversationId }),
      }
    ),

  renameLesson: (id: string, title: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/lessons/generated', {
      method: 'PATCH',
      body: JSON.stringify({ id, title }),
    }),

  deleteLesson: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(
      `/api/lessons/generated?id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    ),

  generateFlashcards: (payload: {
    lessonId: string;
    cardCount?: number;
    focusArea?: string;
    difficulty?: string;
  }) =>
    fetchApi<{
      success: boolean;
      deck: {
        title: string;
        description: string;
        cards: Array<{
          id?: string;
          frontMarkdown: string;
          backMarkdown: string;
          cardType?: string;
          tags?: string[];
          orderIndex?: number;
        }>;
      };
      lessonId: string;
      model: string;
      isSimulated: boolean;
    }>('/api/ai/generate-flashcards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/**
 * ============================================================================
 * Milestone: AI Quiz Generation Frontend API & Types
 * ============================================================================
 */
export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizQuestionType = 'single_choice' | 'multiple_select' | 'true_false' | 'scenario';

export interface QuizOptionItem {
  id: string;
  text: string;
}

export interface ClientQuizQuestionItem {
  id: string;
  type: QuizQuestionType;
  question: string;
  scenarioContext?: string;
  options: QuizOptionItem[];
  metadata?: {
    topic?: string;
    points?: number;
    platform?: string;
  };
  orderIndex: number;
}

export interface ClientQuizData {
  id?: string;
  title: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionTypes: QuizQuestionType[];
  lessonId?: string | null;
  lessonTitle?: string | null;
  questions: ClientQuizQuestionItem[];
}

export interface UserQuizSummaryItem {
  id: string;
  userId: string;
  lessonId: string | null;
  lessonTitle?: string | null;
  title: string;
  topic: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  questionTypes: QuizQuestionType[];
  createdAt: string;
  updatedAt: string;
  latestAttempt?: {
    score: number;
    totalQuestions: number;
    percentage: number;
    completedAt: string;
  } | null;
}

export interface GradedQuestionResultItem {
  questionId: string;
  question: string;
  type: QuizQuestionType;
  options: QuizOptionItem[];
  scenarioContext?: string;
  userAnswer: string | string[] | boolean | null;
  correctAnswer: string | string[] | boolean;
  isCorrect: boolean;
  explanation: string;
}

export interface GradedQuizAttemptResponse {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTakenSeconds?: number;
  completedAt: string;
  results: GradedQuestionResultItem[];
}

export const quizzesApi = {
  generateQuiz: (payload: {
    topic: string;
    difficulty?: QuizDifficulty;
    questionCount?: number;
    questionTypes?: QuizQuestionType[];
    lessonId?: string;
  }) =>
    fetchApi<{
      success: boolean;
      quiz: ClientQuizData;
      quizId: string;
      lessonId: string | null;
      model: string;
      isSimulated: boolean;
    }>('/api/ai/generate-quiz', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listQuizzes: (params?: { search?: string; difficulty?: string; lessonId?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.lessonId) query.set('lessonId', params.lessonId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return fetchApi<{ success: boolean; quizzes: UserQuizSummaryItem[]; count: number }>(
      `/api/quizzes${qs}`
    );
  },

  getQuiz: (id: string, includeKey = false) =>
    fetchApi<{ success: boolean; quiz: ClientQuizData }>(
      `/api/quizzes/${encodeURIComponent(id)}${includeKey ? '?includeKey=true' : ''}`
    ),

  updateQuestion: (quizId: string, questionId: string, updates: Partial<ClientQuizQuestionItem>) =>
    fetchApi<{ success: boolean; message: string }>(
      `/api/quizzes/${encodeURIComponent(quizId)}?questionId=${encodeURIComponent(questionId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ questionId, updates }),
      }
    ),

  deleteQuiz: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(
      `/api/quizzes/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    ),

  submitQuiz: (
    quizId: string,
    submission: { answers: Record<string, string | string[] | boolean>; timeTakenSeconds?: number }
  ) =>
    fetchApi<{ success: boolean; attempt: GradedQuizAttemptResponse }>(
      `/api/quizzes/${encodeURIComponent(quizId)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify(submission),
      }
    ),

  getAttempts: (quizId: string) =>
    fetchApi<{
      success: boolean;
      quizId: string;
      attempts: Array<{
        id: string;
        score: number;
        totalQuestions: number;
        percentage: number;
        timeTakenSeconds?: number;
        completedAt: string;
      }>;
    }>(`/api/quizzes/${encodeURIComponent(quizId)}/attempts`),

  getAttempt: (attemptId: string) =>
    fetchApi<{ success: boolean; attempt: GradedQuizAttemptResponse }>(
      `/api/quizzes/attempts/${encodeURIComponent(attemptId)}`
    ),
};

export type GenerationTaskType = 'lesson' | 'quiz' | 'flashcards';
export type GenerationTaskStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type GenerationTaskStage =
  | 'queued'
  | 'prompting_ai'
  | 'validating_schema'
  | 'persisting'
  | 'completed'
  | 'failed';

export interface ClientGenerationTask {
  id: string;
  userId?: string;
  taskType: GenerationTaskType;
  status: GenerationTaskStatus;
  currentStage: GenerationTaskStage;
  title: string;
  topic: string;
  difficulty: string;
  inputParamsJson?: string;
  inputParams?: Record<string, any>;
  resultDataJson?: string | null;
  resultData?: any;
  persistedEntityId?: string | null;
  errorMessage?: string | null;
  errorCategory?: string | null;
  isRetryable?: boolean;
  executionDeadlineAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export const tasksApi = {
  createTask: (taskType: GenerationTaskType, inputParams: Record<string, any>) =>
    fetchApi<{ success: boolean; task: ClientGenerationTask; alreadyExists: boolean }>(
      '/api/ai/tasks/create',
      {
        method: 'POST',
        body: JSON.stringify({ taskType, inputParams }),
      }
    ),

  getActiveTasks: () =>
    fetchApi<{ success: boolean; count: number; tasks: ClientGenerationTask[] }>(
      '/api/ai/tasks/active'
    ),

  getTask: (id: string) =>
    fetchApi<{ success: boolean; task: ClientGenerationTask }>(
      `/api/ai/tasks/${encodeURIComponent(id)}`
    ),

  cancelTask: (id: string) =>
    fetchApi<{ success: boolean; taskId: string; status: string }>(
      `/api/ai/tasks/${encodeURIComponent(id)}/cancel`,
      {
        method: 'POST',
      }
    ),
};

export async function generateSimulationScenario(params: {
  topic: string;
  certification?: string;
  protocol?: string;
  difficulty?: string;
  faultScenario?: string;
}): Promise<ApiResponse<{ success: boolean; scenario: any; model?: string; isSimulated?: boolean }>> {
  return fetchApi('/api/generate-simulation', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

const SAVED_SIMULATIONS_STORAGE_KEY = 'netmentor_saved_simulations';
const COMPLETED_SIMULATIONS_STORAGE_KEY = 'netmentor_completed_simulations';

export interface SimulationCompletionRecord {
  id: string;
  userId: string;
  scenarioId: string;
  protocol: string;
  certification: string;
  completedAt: string;
}

export function getCompletedSimulationIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPLETED_SIMULATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setCompletedSimulationIds(ids: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMPLETED_SIMULATIONS_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
}

export function addCompletedSimulationId(id: string): void {
  const current = getCompletedSimulationIds();
  if (!current.includes(id)) {
    setCompletedSimulationIds([...current, id]);
  }
}

export function getLocalSavedSimulations(): SavedSimulationRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_SIMULATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setLocalSavedSimulations(records: SavedSimulationRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SAVED_SIMULATIONS_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export const simulationsApi = {
  fetchSavedSimulations: async (options?: { isDemoMode?: boolean }): Promise<SavedSimulationRecord[]> => {
    // If explicitly in demo mode
    if (options?.isDemoMode) {
      return getLocalSavedSimulations();
    }

    try {
      const res = await fetchApi<{ success: boolean; simulations: SavedSimulationRecord[] }>('/api/simulations');
      if (res.data?.success && Array.isArray(res.data.simulations)) {
        // Cache to localStorage for offline / fast read
        setLocalSavedSimulations(res.data.simulations);
        return res.data.simulations;
      }
    } catch {
      // Fallback on network or auth error
    }

    return getLocalSavedSimulations();
  },

  saveCustomSimulation: async (
    scenario: ProtocolSimulationScenario,
    options?: { isDemoMode?: boolean }
  ): Promise<{ success: boolean; record: SavedSimulationRecord }> => {
    const scenarioId = scenario.metadata.id;
    const localRecord: SavedSimulationRecord = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: options?.isDemoMode ? 'demo-user' : 'current-user',
      scenarioId,
      title: scenario.metadata.title,
      protocol: scenario.metadata.protocol,
      certification: scenario.metadata.certification,
      difficulty: scenario.metadata.difficulty,
      scenario,
      createdAt: new Date().toISOString(),
    };

    // If Demo Mode, write directly to localStorage
    if (options?.isDemoMode) {
      const existing = getLocalSavedSimulations().filter((s) => s.scenarioId !== scenarioId);
      setLocalSavedSimulations([localRecord, ...existing]);
      return { success: true, record: localRecord };
    }

    try {
      const res = await fetchApi<{ success: boolean; simulation: SavedSimulationRecord }>('/api/simulations', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      });

      if (res.data?.success && res.data.simulation) {
        const saved = res.data.simulation;
        const existing = getLocalSavedSimulations().filter((s) => s.scenarioId !== saved.scenarioId);
        setLocalSavedSimulations([saved, ...existing]);
        return { success: true, record: saved };
      }
    } catch {
      // Fallback
    }

    // Write-through fallback to localStorage
    const existing = getLocalSavedSimulations().filter((s) => s.scenarioId !== scenarioId);
    setLocalSavedSimulations([localRecord, ...existing]);
    return { success: true, record: localRecord };
  },

  deleteSavedSimulation: async (
    scenarioOrDbId: string,
    options?: { isDemoMode?: boolean }
  ): Promise<boolean> => {
    // Update local cache immediately
    const existing = getLocalSavedSimulations();
    const updated = existing.filter((s) => s.id !== scenarioOrDbId && s.scenarioId !== scenarioOrDbId);
    setLocalSavedSimulations(updated);

    if (options?.isDemoMode) {
      return true;
    }

    try {
      const res = await fetchApi<{ success: boolean }>(
        `/api/simulations?id=${encodeURIComponent(scenarioOrDbId)}`,
        {
          method: 'DELETE',
        }
      );
      return Boolean(res.data?.success);
    } catch {
      return true;
    }
  },

  fetchCompletedSimulations: async (options?: { isDemoMode?: boolean }): Promise<string[]> => {
    const localIds = getCompletedSimulationIds();
    if (options?.isDemoMode) {
      return localIds;
    }

    try {
      const res = await fetchApi<{ success: boolean; completions: SimulationCompletionRecord[] }>(
        '/api/simulations?resource=completions'
      );
      if (res.data?.success && Array.isArray(res.data.completions)) {
        const remoteIds = res.data.completions.map((c) => c.scenarioId);
        const merged = Array.from(new Set([...localIds, ...remoteIds]));
        setCompletedSimulationIds(merged);
        return merged;
      }
    } catch {
      // Fallback to local storage
    }

    return localIds;
  },

  markSimulationCompleted: async (
    params: { scenarioId: string; protocol?: string; certification?: string },
    options?: { isDemoMode?: boolean }
  ): Promise<{ success: boolean; scenarioId: string }> => {
    addCompletedSimulationId(params.scenarioId);

    if (options?.isDemoMode) {
      return { success: true, scenarioId: params.scenarioId };
    }

    try {
      const res = await fetchApi<{ success: boolean; completion: SimulationCompletionRecord }>(
        '/api/simulations',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'complete',
            scenarioId: params.scenarioId,
            protocol: params.protocol || 'OSPF',
            certification: params.certification || 'CCNA',
          }),
        }
      );
      if (res.data?.success) {
        return { success: true, scenarioId: params.scenarioId };
      }
    } catch {
      // Fallback
    }

    return { success: true, scenarioId: params.scenarioId };
  },
};

export const fetchSavedSimulations = simulationsApi.fetchSavedSimulations;
export const saveCustomSimulation = simulationsApi.saveCustomSimulation;
export const deleteSavedSimulation = simulationsApi.deleteSavedSimulation;
export const fetchCompletedSimulations = simulationsApi.fetchCompletedSimulations;
export const markSimulationCompleted = simulationsApi.markSimulationCompleted;




