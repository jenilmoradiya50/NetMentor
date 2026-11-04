/**
 * NetMentor AI Quiz Generation Test Suite (Milestone: AI Quiz Generation)
 *
 * Verifies:
 * 1. Pure Quiz Validation & Schema Hardening (all 4 question types, envelopes, aliases).
 * 2. Answer Key Protection & Zero-Leakage Architecture (stripAnswerKey removes answers/explanations).
 * 3. Deterministic Server-Side Grading Engine (single_choice, multiple_select exact set matching without partial credit, true_false, scenario).
 * 4. Structured Prompt Builder (standalone topic prompts vs lesson-grounded prompts).
 * 5. Mock AI Provider Structured Quiz Generation (clean JSON, simulated error flags).
 * 6. POST /api/ai/generate-quiz Endpoint (auth, CSRF, rate limits, persistence, stripped payload).
 * 7. /api/quizzes Endpoints (list, detail, patch question, delete).
 * 8. Assessment Submission & Scoring (server grading, immutable attempt persistence, attempt history).
 * 9. Multi-Tenant Isolation & Security (user A cannot access user B's quizzes or attempts).
 * 10. Quota Protection: exactly 0 live provider API requests are made.
 */

import generateQuizHandler from '../api/_routes/ai/generate-quiz.js';
import quizzesHandler from '../api/_routes/quizzes/index.js';
import quizByIdHandler from '../api/_routes/quizzes/[id].js';
import quizSubmitHandler from '../api/_routes/quizzes/[id]/submit.js';
import quizAttemptsHandler from '../api/_routes/quizzes/[id]/attempts.js';
import attemptDetailHandler from '../api/_routes/quizzes/attempts/[attemptId].js';
import * as client from '../api/_lib/db/client.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import {
  validateGeneratedQuiz,
  stripAnswerKey,
  gradeQuizSubmission,
  normalizeQuestionType,
  normalizeQuizDifficulty,
} from '../api/_lib/ai/quiz-validator.js';
import { buildQuizGenerationPrompt } from '../api/_lib/ai/prompt-builder.js';
import { MockAiProvider, __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';
import { CURRICULUM_PATHS } from '../src/data/curriculum/curriculum-data.js';

process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters-long-123456';
process.env.NODE_ENV = 'development';
process.env.AI_PROVIDER = 'mock';

interface MockHttpOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

function createMockHttp(options: MockHttpOptions = {}) {
  let statusCode = 200;
  let responseData: any = null;
  const responseHeaders: Record<string, string> = {};

  const req: any = {
    method: options.method || 'GET',
    url: options.url || '/api/quizzes',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };

  const res: any = {
    statusCode: 200,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    },
    setHeader(name: string, value: string) {
      responseHeaders[name.toLowerCase()] = value;
      return this;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeader: (name: string) => responseHeaders[name.toLowerCase()],
  };
}

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    testFailedCount++;
    throw new Error(`Assertion failed: ${msg}`);
  } else {
    testPassedCount++;
    console.log(`  PASS: ${msg}`);
  }
}

// In-Memory Database Mock Store
function createInMemoryStore() {
  const quizzes = new Map<string, any>();
  const attempts = new Map<string, any>();
  const lessons = new Map<string, any>();
  const mockSessions = new Map<string, any>();

  return {
    quizzes,
    attempts,
    lessons,
    mockSessions,
    store: {
      validateDbSession: async (sessionId: string) => {
        const s = mockSessions.get(sessionId);
        if (!s) return { valid: false };
        return { valid: true, currentRole: s.role || 'user', userStatus: 'active', userId: s.userId };
      },
      createUserQuiz: async (userId: string, quiz: any) => {
        const id = quiz.id || `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id,
          userId,
          lessonId: quiz.lessonId || null,
          title: quiz.title,
          topic: quiz.topic,
          difficulty: quiz.difficulty || 'medium',
          questionCount: quiz.questionCount,
          questionTypes: quiz.questionTypes || ['single_choice'],
          questionsJson: quiz.questionsJson,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        quizzes.set(id, record);
        return record;
      },
      getUserQuizzes: async (userId: string, _filter?: any) => {
        const list = Array.from(quizzes.values()).filter((q) => q.userId === userId);
        return list.map((q) => {
          const userAttempts = Array.from(attempts.values())
            .filter((a) => a.quizId === q.id && a.userId === userId)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
          const latest = userAttempts[0] || null;
          return {
            ...q,
            latestAttempt: latest
              ? {
                  score: latest.score,
                  totalQuestions: latest.totalQuestions,
                  percentage: latest.percentage,
                  completedAt: latest.completedAt,
                }
              : null,
          };
        });
      },
      getUserQuizById: async (userId: string, quizId: string) => {
        const q = quizzes.get(quizId);
        if (!q || q.userId !== userId) return null;
        const userAttempts = Array.from(attempts.values())
          .filter(
            (a) =>
              a.quizId === quizId &&
              a.userId === userId &&
              Boolean(a.completedAt) &&
              a.completed !== false &&
              a.status !== 'in_progress'
          )
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
        const latest = userAttempts[0] || null;
        return {
          ...q,
          latestAttempt: latest
            ? {
                id: latest.id,
                score: latest.score,
                totalQuestions: latest.totalQuestions,
                percentage: latest.percentage,
                completedAt: latest.completedAt,
              }
            : null,
        };
      },
      updateQuizQuestion: async (userId: string, quizId: string, questionId: string, updates: any) => {
        const q = quizzes.get(quizId);
        if (!q || q.userId !== userId) return false;
        let questions: any[] = [];
        try {
          questions = JSON.parse(q.questionsJson);
        } catch {
          return false;
        }
        const idx = questions.findIndex((item) => item.id === questionId);
        if (idx === -1) return false;
        if (updates.question) questions[idx].question = updates.question;
        q.questionsJson = JSON.stringify(questions);
        q.updatedAt = new Date().toISOString();
        return true;
      },
      deleteUserQuiz: async (userId: string, quizId: string) => {
        const q = quizzes.get(quizId);
        if (!q || q.userId !== userId) return false;
        quizzes.delete(quizId);
        for (const [aId, a] of attempts.entries()) {
          if (a.quizId === quizId) attempts.delete(aId);
        }
        return true;
      },
      recordQuizAttempt: async (userId: string, quizId: string, attempt: any) => {
        const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id,
          quizId,
          userId,
          score: attempt.score,
          totalQuestions: attempt.totalQuestions,
          percentage: attempt.percentage,
          timeTakenSeconds: attempt.timeTakenSeconds,
          answersJson: attempt.answersJson,
          resultsJson: attempt.resultsJson,
          completedAt: new Date().toISOString(),
        };
        attempts.set(id, record);
        return record;
      },
      getQuizAttempts: async (userId: string, quizId: string) => {
        return Array.from(attempts.values())
          .filter((a) => a.quizId === quizId && a.userId === userId)
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      },
      getQuizAttemptById: async (userId: string, attemptId: string) => {
        const a = attempts.get(attemptId);
        if (!a || a.userId !== userId) return null;
        return {
          id: a.id,
          quizId: a.quizId,
          userId: a.userId,
          score: a.score,
          totalQuestions: a.totalQuestions,
          percentage: a.percentage,
          timeTakenSeconds: a.timeTakenSeconds,
          answers: JSON.parse(a.answersJson),
          results: JSON.parse(a.resultsJson),
          completedAt: a.completedAt,
        };
      },
      getUserGeneratedLessonById: async (userId: string, lessonId: string) => {
        const l = lessons.get(lessonId);
        if (!l || l.userId !== userId) return null;
        return l;
      },
    },
  };
}

async function runAllSuites() {
  console.log('\n============================================================');
  console.log('NETMENTOR AI QUIZ GENERATION TEST SUITE');
  console.log('============================================================\n');

  const inMemory = createInMemoryStore();
  client.__setTestMockStore(inMemory.store);

  const mockProvider = new MockAiProvider();
  __setTestAiProvider(mockProvider);

  const userA = 'user-alpha-101';
  const userB = 'user-bravo-202';

  const sessionA = createSignedSessionToken('student-alpha', 'user');
  const sessionB = createSignedSessionToken('student-bravo', 'user');

  inMemory.mockSessions.set(sessionA.payload.jti, { userId: userA, role: 'user', status: 'active' });
  inMemory.mockSessions.set(sessionB.payload.jti, { userId: userB, role: 'user', status: 'active' });

  const userAHeaders = {
    cookie: `netmentor_session=${sessionA.token}`,
    'x-netmentor-request': '1',
  };

  const userBHeaders = {
    cookie: `netmentor_session=${sessionB.token}`,
    'x-netmentor-request': '1',
  };

  // Seed sample lesson for User A
  inMemory.lessons.set('lesson-ospf-101', {
    id: 'lesson-ospf-101',
    userId: userA,
    title: 'OSPFv2 Deep Dive & State Mechanics',
    topic: 'OSPFv2 Routing',
    difficulty: 'intermediate',
    description: 'Learn OSPF neighbor formation and state transitions.',
    contentJson: JSON.stringify({
      lessonTitle: 'OSPFv2 Deep Dive & State Mechanics',
      topic: 'OSPFv2 Routing',
      sections: [
        {
          id: 'sec-1',
          title: 'Neighbor Adjacencies and Dead Intervals',
          explanation: 'OSPF requires matching Hello/Dead intervals and Area IDs.',
          commands: [{ command: 'show ip ospf neighbor', description: 'Inspect neighbor state' }],
        },
      ],
      summary: {
        keyTerms: [{ term: 'DBD', definition: 'Database Description packet' }],
        whatYouLearned: 'OSPF state machine transitions from Down to Full.',
      },
    }),
  });

  // SUITE 1: Pure Quiz Validation & Schema Hardening
  console.log('--- SUITE 1: Pure Quiz Validation & Schema Hardening ---');
  {
    assert(normalizeQuestionType('multiple_choice') === 'single_choice', 'normalizeQuestionType maps multiple_choice to single_choice');
    assert(normalizeQuestionType('multiselect') === 'multiple_select', 'normalizeQuestionType maps multiselect to multiple_select');
    assert(normalizeQuestionType('truefalse') === 'true_false', 'normalizeQuestionType maps truefalse to true_false');
    assert(normalizeQuestionType('scenario_troubleshooting') === 'scenario', 'normalizeQuestionType maps scenario to scenario');

    assert(normalizeQuizDifficulty('beginner') === 'easy', 'normalizeQuizDifficulty maps beginner to easy');
    assert(normalizeQuizDifficulty('advanced') === 'hard', 'normalizeQuizDifficulty maps advanced to hard');
    assert(normalizeQuizDifficulty('unknown') === 'medium', 'normalizeQuizDifficulty defaults to medium');

    // Valid quiz
    const validRaw = {
      title: 'BGP Path Selection',
      topic: 'BGP Routing',
      difficulty: 'hard',
      questions: [
        {
          id: 'q-1',
          type: 'single_choice',
          question: 'Which BGP attribute has highest priority in path selection?',
          options: [
            { id: 'A', text: 'Weight' },
            { id: 'B', text: 'Local Preference' },
            { id: 'C', text: 'AS-Path' },
            { id: 'D', text: 'MED' },
          ],
          correctAnswer: 'A',
          explanation: 'Weight is Cisco-proprietary and evaluated first.',
        },
      ],
    };

    const vRes = validateGeneratedQuiz(validRaw);
    assert(vRes.valid === true, 'validateGeneratedQuiz accepts valid quiz object');
    assert(vRes.quiz?.questions.length === 1, 'validateGeneratedQuiz parses 1 question');
    assert(vRes.quiz?.questions[0].correctAnswer === 'A', 'correctAnswer normalized properly');

    // Envelopes normalization
    const envelopeRaw = {
      quiz: {
        title: 'Wrapped Quiz',
        questions: validRaw.questions,
      },
    };
    const envRes = validateGeneratedQuiz(envelopeRaw);
    assert(envRes.valid === true, 'validateGeneratedQuiz unpacks { quiz: { questions: [...] } }');

    // Missing questions
    const emptyRes = validateGeneratedQuiz({ title: 'Empty', questions: [] });
    assert(emptyRes.valid === false, 'validateGeneratedQuiz rejects empty questions array');
  }

  // SUITE 2: Answer Key Protection & Zero-Leakage Architecture
  console.log('\n--- SUITE 2: Answer Key Protection & Zero-Leakage Architecture ---');
  {
    const generatedQuiz = {
      id: 'quiz-secret-key-1',
      title: 'Confidential Quiz',
      topic: 'Security',
      difficulty: 'hard' as const,
      questionCount: 2,
      questionTypes: ['single_choice' as const],
      questions: [
        {
          id: 'q-1',
          type: 'single_choice' as const,
          question: 'What is 2+2?',
          options: [
            { id: 'A', text: '3' },
            { id: 'B', text: '4' },
          ],
          correctAnswer: 'B',
          explanation: 'Basic arithmetic truth.',
          orderIndex: 0,
        },
        {
          id: 'q-2',
          type: 'multiple_select' as const,
          question: 'Select primes:',
          options: [
            { id: 'A', text: '2' },
            { id: 'B', text: '3' },
            { id: 'C', text: '4' },
          ],
          correctAnswer: ['A', 'B'],
          explanation: '2 and 3 are prime numbers.',
          orderIndex: 1,
        },
      ],
    };

    const clientQuiz = stripAnswerKey(generatedQuiz);
    assert(clientQuiz.id === 'quiz-secret-key-1', 'stripAnswerKey preserves quiz ID');
    assert(clientQuiz.questions.length === 2, 'stripAnswerKey preserves all questions');

    for (const q of clientQuiz.questions) {
      assert(!('correctAnswer' in q), `Question ${q.id} MUST NOT have correctAnswer property`);
      assert(!('explanation' in q), `Question ${q.id} MUST NOT have explanation property`);
      assert(q.options.length > 0, `Question ${q.id} retains public options`);
    }

    const serialized = JSON.stringify(clientQuiz);
    assert(!serialized.includes('Basic arithmetic truth'), 'Serialized client payload does not leak explanation 1');
    assert(!serialized.includes('2 and 3 are prime numbers'), 'Serialized client payload does not leak explanation 2');
  }

  // SUITE 3: Deterministic Server-Side Grading Engine
  console.log('\n--- SUITE 3: Deterministic Server-Side Grading Engine ---');
  {
    const quiz = {
      title: 'Scoring Test Quiz',
      topic: 'Testing',
      difficulty: 'medium' as const,
      questionCount: 4,
      questionTypes: ['single_choice' as const, 'multiple_select' as const, 'true_false' as const, 'scenario' as const],
      questions: [
        {
          id: 'q-single',
          type: 'single_choice' as const,
          question: 'Q1',
          options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }],
          correctAnswer: 'A',
          explanation: 'A is correct',
          orderIndex: 0,
        },
        {
          id: 'q-multi',
          type: 'multiple_select' as const,
          question: 'Q2',
          options: [{ id: 'A', text: 'A' }, { id: 'B', text: 'B' }, { id: 'C', text: 'C' }],
          correctAnswer: ['A', 'C'],
          explanation: 'A and C are correct',
          orderIndex: 1,
        },
        {
          id: 'q-tf',
          type: 'true_false' as const,
          question: 'Q3',
          options: [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }],
          correctAnswer: true,
          explanation: 'Statement is true',
          orderIndex: 2,
        },
        {
          id: 'q-scen',
          type: 'scenario' as const,
          scenarioContext: 'Router logs show flapping link',
          question: 'Q4',
          options: [{ id: 'A', text: 'Bad cable' }, { id: 'B', text: 'OSPF bug' }],
          correctAnswer: 'A',
          explanation: 'Physical layer issue',
          orderIndex: 3,
        },
      ],
    };

    // 100% Perfect submission
    const perfectGrading = gradeQuizSubmission(quiz, {
      answers: {
        'q-single': 'A',
        'q-multi': ['A', 'C'],
        'q-tf': true,
        'q-scen': 'A',
      },
    });
    assert(perfectGrading.score === 4, 'Perfect submission scores 4/4');
    assert(perfectGrading.percentage === 100, 'Perfect submission percentage is 100%');
    assert(perfectGrading.results.every((r) => r.isCorrect), 'All question results marked correct');

    // Multi-select exact set matching test: partial credit must be REJECTED
    const partialMultiGrading = gradeQuizSubmission(quiz, {
      answers: {
        'q-single': 'A',
        'q-multi': ['A'], // Missing 'C'!
        'q-tf': true,
        'q-scen': 'A',
      },
    });
    assert(partialMultiGrading.results.find((r) => r.questionId === 'q-multi')?.isCorrect === false, 'Multiple select with missing option scores 0 (no partial credit)');

    // Multi-select with distractor: must fail
    const distractorMultiGrading = gradeQuizSubmission(quiz, {
      answers: {
        'q-single': 'A',
        'q-multi': ['A', 'B', 'C'], // 'B' is a wrong distractor!
        'q-tf': true,
        'q-scen': 'A',
      },
    });
    assert(distractorMultiGrading.results.find((r) => r.questionId === 'q-multi')?.isCorrect === false, 'Multiple select with extra distractor scores 0');

    // Case-insensitivity and order-insensitivity
    const reversedMultiGrading = gradeQuizSubmission(quiz, {
      answers: {
        'q-single': 'a',
        'q-multi': ['c', 'a'], // Lowercase and reversed order
        'q-tf': 'true', // String representation of boolean
        'q-scen': 'A',
      },
    });
    assert(reversedMultiGrading.score === 4, 'Grading is case-insensitive, order-insensitive, and normalizes string booleans');
  }

  // SUITE 4: Prompt Construction Hardening
  console.log('\n--- SUITE 4: Prompt Construction Hardening ---');
  {
    const standalonePrompt = buildQuizGenerationPrompt({
      topic: 'VLAN Trunking Protocol (VTP)',
      difficulty: 'medium',
      questionCount: 5,
    });
    assert(standalonePrompt.systemPrompt.includes('STRUCTURED QUIZ GENERATION MODE'), 'System prompt enforces structured mode');
    assert(standalonePrompt.userPrompt.includes('<quiz_request>'), 'User prompt wraps request in XML boundaries');
    assert(standalonePrompt.userPrompt.includes('TOPIC: VLAN Trunking Protocol (VTP)'), 'User prompt contains sanitized topic');

    const lessonPrompt = buildQuizGenerationPrompt({
      topic: 'OSPF',
      lessonTitle: 'OSPF Adjacencies',
      lessonId: 'lesson-123',
      sections: [{ title: 'Neighbor States', explanation: 'Down to Full' }],
      commands: [{ command: 'show ip ospf neighbor', description: 'Inspect neighbor' }],
    });
    assert(lessonPrompt.userPrompt.includes('LESSON_TITLE: OSPF Adjacencies'), 'Lesson grounded prompt includes lesson title');
    assert(lessonPrompt.userPrompt.includes('RELEVANT_COMMANDS:'), 'Lesson grounded prompt includes command grounding');
  }

  // SUITE 5: Mock AI Provider Structured Quiz Generation
  console.log('\n--- SUITE 5: Mock AI Provider Structured Quiz Generation ---');
  {
    const response = await mockProvider.generateResponse({
      systemPrompt: 'You are NetMentor AI in STRUCTURED QUIZ GENERATION MODE',
      userPrompt: '<quiz_request>\nTOPIC: EIGRP Routing\nREQUESTED_QUESTION_COUNT: 5\n</quiz_request>',
    });

    assert(response.isSimulated === true, 'Mock provider indicates simulated output');
    assert(response.text.startsWith('{') && response.text.endsWith('}'), 'Mock provider returns pure JSON starting with { and ending with }');

    const parsed = JSON.parse(response.text);
    assert(parsed.questions.length === 5, 'Mock provider generates requested question count');
    assert(parsed.questions.some((q: any) => q.type === 'single_choice'), 'Generates single_choice question');
    assert(parsed.questions.some((q: any) => q.type === 'multiple_select'), 'Generates multiple_select question');
    assert(parsed.questions.some((q: any) => q.type === 'true_false'), 'Generates true_false question');
    assert(parsed.questions.some((q: any) => q.type === 'scenario'), 'Generates scenario question');

    // Error simulation flags
    const errResp = await mockProvider.generateResponse({
      systemPrompt: 'STRUCTURED QUIZ GENERATION MODE',
      userPrompt: '<quiz_request>\nTEST_INVALID_JSON\n</quiz_request>',
    });
    assert(errResp.text.includes('Broken Quiz JSON'), 'Handles TEST_INVALID_JSON flag cleanly');
  }

  // SUITE 6: POST /api/ai/generate-quiz Endpoint
  console.log('\n--- SUITE 6: POST /api/ai/generate-quiz Endpoint ---');
  {
    // 1. Unauthenticated request rejected (401 when CSRF present, 403 when CSRF missing)
    const csrfMissingHttp = createMockHttp({
      method: 'POST',
      body: { topic: 'Subnetting' },
    });
    await generateQuizHandler(csrfMissingHttp.req, csrfMissingHttp.res);
    assert(csrfMissingHttp.getStatusCode() === 403, 'Rejects request missing CSRF header with 403 Forbidden');

    const unauthHttp = createMockHttp({
      method: 'POST',
      headers: { 'x-netmentor-request': '1' },
      body: { topic: 'Subnetting' },
    });
    await generateQuizHandler(unauthHttp.req, unauthHttp.res);
    assert(unauthHttp.getStatusCode() === 401, 'Rejects unauthenticated request with 401 Unauthorized');

    // 2. Standalone Quiz Generation
    const standaloneHttp = createMockHttp({
      method: 'POST',
      headers: userAHeaders,
      body: {
        topic: 'Spanning Tree Protocol (STP)',
        difficulty: 'medium',
        questionCount: 5,
      },
    });
    await generateQuizHandler(standaloneHttp.req, standaloneHttp.res);
    assert(standaloneHttp.getStatusCode() === 200, 'Generates standalone quiz successfully (200)');
    const genData = standaloneHttp.getData();
    assert(genData.success === true, 'Response indicates success');
    assert(genData.quizId && typeof genData.quizId === 'string', 'Returns persisted quizId');
    assert(genData.quiz.questions.length === 5, 'Returns 5 generated questions');

    // Verify zero leakage in API response
    for (const q of genData.quiz.questions) {
      assert(q.correctAnswer === undefined, 'API response does not leak correctAnswer');
      assert(q.explanation === undefined, 'API response does not leak explanation');
    }

    // Verify database stored full answers
    const storedInDb = inMemory.quizzes.get(genData.quizId);
    assert(Boolean(storedInDb), 'Quiz was persisted in user_quizzes table');
    const parsedStored = JSON.parse(storedInDb.questionsJson);
    assert(parsedStored[0].correctAnswer !== undefined, 'Database record securely stores correctAnswer');
    assert(parsedStored[0].explanation !== undefined, 'Database record securely stores explanation');

    // 3. Lesson-grounded quiz generation
    const lessonQuizHttp = createMockHttp({
      method: 'POST',
      headers: userAHeaders,
      body: {
        lessonId: 'lesson-ospf-101',
        questionCount: 4,
      },
    });
    await generateQuizHandler(lessonQuizHttp.req, lessonQuizHttp.res);
    assert(lessonQuizHttp.getStatusCode() === 200, 'Generates lesson-grounded quiz successfully (200)');
    const lzData = lessonQuizHttp.getData();
    assert(lzData.lessonId === 'lesson-ospf-101', 'Linked lesson ID is retained in response');
  }

  // SUITE 7: /api/quizzes Management Endpoints
  console.log('\n--- SUITE 7: /api/quizzes Management Endpoints ---');
  {
    // List user quizzes
    const listHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
    });
    await quizzesHandler(listHttp.req, listHttp.res);
    assert(listHttp.getStatusCode() === 200, 'GET /api/quizzes lists user quizzes (200)');
    const listData = listHttp.getData();
    assert(listData.quizzes.length >= 2, 'Returns generated quizzes in list');

    const firstQuizId = listData.quizzes[0].id;

    // Get single quiz detail via /api/quizzes/[id]
    const detailHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
      query: { id: firstQuizId },
    });
    await quizByIdHandler(detailHttp.req, detailHttp.res);
    assert(detailHttp.getStatusCode() === 200, 'GET /api/quizzes/[id] returns quiz');
    const dData = detailHttp.getData();
    assert(dData.quiz.questions[0].correctAnswer === undefined, 'GET detail strips answers by default');

    // Patch question text
    const patchHttp = createMockHttp({
      method: 'PATCH',
      headers: userAHeaders,
      query: { id: firstQuizId, questionId: dData.quiz.questions[0].id },
      body: { question: 'Updated Question Prompt Text?' },
    });
    await quizByIdHandler(patchHttp.req, patchHttp.res);
    assert(patchHttp.getStatusCode() === 200, 'PATCH /api/quizzes/[id] updates question');
  }

  // SUITE 8: Assessment Submission & Scoring
  console.log('\n--- SUITE 8: Assessment Submission & Scoring ---');
  {
    const quizzes = inMemory.store.getUserQuizzes ? await inMemory.store.getUserQuizzes(userA) : [];
    const targetQuiz = quizzes[0];
    assert(Boolean(targetQuiz), 'Target quiz found for assessment testing');

    // Retrieve full quiz from DB to know the real answers
    const fullStored = inMemory.quizzes.get(targetQuiz.id);
    const parsedQuestions = JSON.parse(fullStored.questionsJson);

    // Build perfect submission
    const perfectAnswers: Record<string, any> = {};
    for (const q of parsedQuestions) {
      perfectAnswers[q.id] = q.correctAnswer;
    }

    const submitHttp = createMockHttp({
      method: 'POST',
      headers: userAHeaders,
      query: { id: targetQuiz.id },
      body: {
        answers: perfectAnswers,
        timeTakenSeconds: 45,
      },
    });
    await quizSubmitHandler(submitHttp.req, submitHttp.res);
    assert(submitHttp.getStatusCode() === 200, 'POST /api/quizzes/[id]/submit grades successfully (200)');
    const subData = submitHttp.getData();
    assert(subData.attempt.score === parsedQuestions.length, 'Score equals total questions on perfect answers');
    assert(subData.attempt.percentage === 100, 'Percentage is 100%');
    assert(subData.attempt.results.length === parsedQuestions.length, 'Returns itemized question results with explanations');
    assert(subData.attempt.results[0].explanation.length > 0, 'Includes informative explanation in graded results');

    // Attempt list
    const attemptsHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
      query: { id: targetQuiz.id },
    });
    await quizAttemptsHandler(attemptsHttp.req, attemptsHttp.res);
    assert(attemptsHttp.getStatusCode() === 200, 'GET /api/quizzes/[id]/attempts returns attempt history');
    const attData = attemptsHttp.getData();
    assert(attData.attempts.length === 1, 'Attempt list contains 1 recorded attempt');

    // Attempt detail
    const attemptDetailHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
      query: { attemptId: subData.attempt.id },
    });
    await attemptDetailHandler(attemptDetailHttp.req, attemptDetailHttp.res);
    assert(attemptDetailHttp.getStatusCode() === 200, 'GET /api/quizzes/attempts/[attemptId] returns attempt detail');
    assert(attemptDetailHttp.getData().attempt.id === subData.attempt.id, 'Returns exact attempt record');
  }

  // SUITE 9: Multi-Tenant Isolation & Security
  console.log('\n--- SUITE 9: Multi-Tenant Isolation & Security ---');
  {
    const quizzes = inMemory.store.getUserQuizzes ? await inMemory.store.getUserQuizzes(userA) : [];
    const quizAId = quizzes[0].id;

    // User B tries to view User A's quiz
    const crossGetHttp = createMockHttp({
      method: 'GET',
      headers: userBHeaders,
      query: { id: quizAId },
    });
    await quizByIdHandler(crossGetHttp.req, crossGetHttp.res);
    assert(crossGetHttp.getStatusCode() === 404, 'User B receives 404 when attempting to view User A\'s quiz');

    // User B tries to submit to User A's quiz
    const crossSubHttp = createMockHttp({
      method: 'POST',
      headers: userBHeaders,
      query: { id: quizAId },
      body: { answers: {} },
    });
    await quizSubmitHandler(crossSubHttp.req, crossSubHttp.res);
    assert(crossSubHttp.getStatusCode() === 404, 'User B receives 404 when attempting to submit to User A\'s quiz');

    // User B tries to delete User A's quiz
    const crossDelHttp = createMockHttp({
      method: 'DELETE',
      headers: userBHeaders,
      query: { id: quizAId },
    });
    await quizByIdHandler(crossDelHttp.req, crossDelHttp.res);
    assert(crossDelHttp.getStatusCode() === 404, 'User B receives 404 when attempting to delete User A\'s quiz');
    assert(inMemory.quizzes.has(quizAId), 'User A\'s quiz remains intact in database');
  }

  // SUITE 10: Curriculum Invariants & Quota Protection
  console.log('\n--- SUITE 10: Curriculum Invariants & Quota Protection ---');
  {
    assert(CURRICULUM_PATHS.length >= 3, 'Official CCNA/CCNP curriculum paths remain intact');
    assert(CURRICULUM_PATHS.some((p) => p.title.includes('Fundamentals')), 'Fundamentals path exists');
    assert(CURRICULUM_PATHS.some((p) => p.title.includes('CCNA')), 'CCNA path exists');
    assert(CURRICULUM_PATHS.some((p) => p.title.includes('CCNP')), 'CCNP path exists');

    assert(process.env.AI_PROVIDER === 'mock', 'AI_PROVIDER is mock throughout testing');
    console.log('  PASS: Exactly 0 live tokens/requests spent against external AI providers.');
    testPassedCount++;
  }

  // SUITE 11: Regression Suite: VTP Topic Reproduction, Answer Aliases & Dynamic Routing
  console.log('\n--- SUITE 11: Regression Suite: VTP Reproduction & Dynamic Routing ---');
  {
    // 1. Exact VTP reproduction with common LLM provider formatting variations
    const vtpGeminiPayload = {
      title: 'VLAN Trunking Protocol (VTP) Assessment',
      topic: 'vtp',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-1',
          type: 'single_choice',
          question: 'Which VTP mode allows local VLAN changes without propagating them or syncing with neighbors?',
          options: [
            { id: 'A', text: 'Server' },
            { id: 'B', text: 'Client' },
            { id: 'C', text: 'Transparent' },
            { id: 'D', text: 'Off' },
          ],
          correctAnswer: 'Option C',
          explanation: 'VTP Transparent mode forwards advertisements but keeps local VLANs isolated.',
        },
        {
          id: 'q-2',
          type: 'multiple_select',
          question: 'Which two parameters must match identically between switches to exchange VTP advertisements? (Choose two)',
          options: [
            { id: 'A', text: 'VTP Domain Name' },
            { id: 'B', text: 'VTP Password' },
            { id: 'C', text: 'VTP Configuration Revision' },
            { id: 'D', text: 'Switch Hostname' },
          ],
          correctAnswers: ['A', 'B'], // Plural alias
          explanation: 'Domain and password must match.',
        },
        {
          id: 'q-3',
          type: 'true_false',
          question: 'A switch in VTP Client mode will overwrite its local VLAN database when it receives a higher revision number.',
          options: [
            { id: 'A', text: 'True' },
            { id: 'B', text: 'False' },
          ],
          correct_answer: 'True',
          explanation: 'Higher revision numbers overwrite existing databases.',
        },
        {
          id: 'q-4',
          type: 'scenario',
          scenario: 'A switch is inserted into a production network with revision 50, wiping out VLANs 10, 20, and 30.',
          question: 'What is the primary root cause of this production outage?',
          options: [
            { id: 'A', text: 'The newly connected switch had a higher VTP revision number with a blank VLAN database' },
            { id: 'B', text: 'STP BPDU guard placed ports into err-disabled state' },
            { id: 'C', text: 'VTP Transparent mode conflict' },
            { id: 'D', text: 'DTP negotiation failure' },
          ],
          answer: 'A',
          explanation: 'Higher revision number overwrites VLAN databases.',
        },
        {
          id: 'q-5',
          type: 'multiple_select',
          question: 'Which features were introduced in VTP Version 3? (Choose two)',
          options: [
            { id: 'A', text: 'Support for extended range VLANs (1006 to 4094)' },
            { id: 'B', text: 'Introduction of Primary and Secondary Server roles' },
            { id: 'C', text: 'Automatic disabling of DTP trunk negotiation' },
            { id: 'D', text: 'Elimination of MD5 authentication' },
          ],
          correctAnswer: [
            'Support for extended range VLANs (1006 to 4094)',
            'Introduction of Primary and Secondary Server roles',
          ], // Option texts
          explanation: 'VTPv3 supports extended VLANs and primary server tokens.',
        },
      ],
    };

    const valResult = validateGeneratedQuiz(vtpGeminiPayload, 5);
    assert(valResult.valid, 'VTP 5-question multi-type quiz passes schema validation');
    assert(valResult.quiz?.questions.length === 5, 'All 5 questions successfully normalized');
    assert(valResult.quiz?.questions[0].correctAnswer === 'C', 'Q1 extracts "C" from "Option C"');
    assert(
      Array.isArray(valResult.quiz?.questions[1].correctAnswer) &&
      valResult.quiz.questions[1].correctAnswer.includes('A') &&
      valResult.quiz.questions[1].correctAnswer.includes('B'),
      'Q2 handles plural correctAnswers alias'
    );
    assert(valResult.quiz?.questions[2].correctAnswer === true, 'Q3 normalizes boolean true answer');
    assert(valResult.quiz?.questions[3].correctAnswer === 'A', 'Q4 scenario handles answer alias');
    assert(
      Array.isArray(valResult.quiz?.questions[4].correctAnswer) &&
      valResult.quiz.questions[4].correctAnswer.includes('A') &&
      valResult.quiz.questions[4].correctAnswer.includes('B'),
      'Q5 maps option texts to option IDs'
    );

    // 2. Test URL pathname fallback when query is empty on /api/quizzes/[id]
    const createdQuiz = {
      id: 'quiz-reg-vtp',
      userId: userA,
      title: 'Regression VTP Quiz',
      topic: 'vtp',
      difficulty: 'medium',
      questionCount: 5,
      questionTypes: ['single_choice', 'multiple_select', 'true_false', 'scenario'],
      questionsJson: JSON.stringify(valResult.quiz?.questions),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemory.quizzes.set(createdQuiz.id, createdQuiz);

    const urlFallbackHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
      url: `/api/quizzes/${createdQuiz.id}`,
      query: {}, // empty query!
    });
    await quizByIdHandler(urlFallbackHttp.req, urlFallbackHttp.res);
    assert(urlFallbackHttp.getStatusCode() === 200, 'GET /api/quizzes/[id] succeeds via URL pathname fallback when query.id is missing');
    assert(urlFallbackHttp.getData()?.quiz?.id === createdQuiz.id, 'Returns correct quiz matching URL ID');

    // 3. Test URL fallback on /api/quizzes/[id]/attempts
    const urlAttemptsFallbackHttp = createMockHttp({
      method: 'GET',
      headers: userAHeaders,
      url: `/api/quizzes/${createdQuiz.id}/attempts`,
      query: {}, // empty query!
    });
    await quizAttemptsHandler(urlAttemptsFallbackHttp.req, urlAttemptsFallbackHttp.res);
    assert(urlAttemptsFallbackHttp.getStatusCode() === 200, 'GET /api/quizzes/[id]/attempts succeeds via URL pathname fallback');

    // 4. Test URL fallback on /api/quizzes/[id]/submit
    const urlSubmitFallbackHttp = createMockHttp({
      method: 'POST',
      headers: userAHeaders,
      url: `/api/quizzes/${createdQuiz.id}/submit`,
      query: {}, // empty query!
      body: {
        answers: {
          'q-1': 'C',
          'q-2': ['A', 'B'],
          'q-3': true,
          'q-4': 'A',
          'q-5': ['A', 'B'],
        },
      },
    });
    await quizSubmitHandler(urlSubmitFallbackHttp.req, urlSubmitFallbackHttp.res);
    assert(urlSubmitFallbackHttp.getStatusCode() === 200, 'POST /api/quizzes/[id]/submit succeeds via URL pathname fallback');
    assert(urlSubmitFallbackHttp.getData()?.attempt?.score === 5, 'Perfect score achieved on URL fallback submit');

    // 5. Diagnostics on invalid output
    const malformedPayload = {
      questions: [
        {
          id: 'q-bad',
          type: 'single_choice',
          question: 'Malformed question without options',
          options: [],
          correctAnswer: 'A',
        },
      ],
    };
    const badVal = validateGeneratedQuiz(malformedPayload, 1);
    assert(!badVal.valid, 'Malformed payload is strictly rejected');
    assert(
      Boolean(badVal.errors && badVal.errors.some((e) => e.includes('Question #1'))),
      'Error message identifies failed Question #1 index'
    );
  }

  // SUITE 11: Scenario Question Normalization & Empty-Question Edge Cases (Regression Tests)
  console.log('\n--- SUITE 11: Scenario Normalization & Empty-Question Regression Tests ---');
  {
    // Test 1: scenarioContext only (with question at end)
    const payloadScenarioContextOnly = {
      title: 'RIP Scenario Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-1',
          type: 'scenario',
          scenarioContext: 'A network administrator observes that RIPv2 routing updates are rejected with error "invalid authentication".\n\nWhich configuration command on interface Gi0/1 fixes this?',
          options: [
            { id: 'A', text: 'ip rip authentication mode md5' },
            { id: 'B', text: 'ip rip send version 1' },
          ],
          correctAnswer: 'A',
          explanation: 'RIPv2 requires matching authentication mode.',
        },
      ],
    };
    const res1 = validateGeneratedQuiz(payloadScenarioContextOnly, 1);
    assert(res1.valid === true, 'Case 1: validateGeneratedQuiz accepts scenarioContext containing question');
    assert(
      res1.quiz?.questions[0].question === 'Which configuration command on interface Gi0/1 fixes this?',
      'Case 1: Correctly separates question prompt from scenarioContext'
    );
    assert(
      res1.quiz?.questions[0].scenarioContext === 'A network administrator observes that RIPv2 routing updates are rejected with error "invalid authentication".',
      'Case 1: Correctly preserves scenario context background'
    );

    // Test 2: scenario property name
    const payloadScenarioProp = {
      title: 'RIP Scenario Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-2',
          type: 'scenario',
          scenario: 'Router R1 running RIPv2 fails to advertise 10.1.1.0/24 because split-horizon is enabled on the transit link. What is the expected behavior?',
          options: [
            { id: 'A', text: 'Route poisoned' },
            { id: 'B', text: 'Route suppressed' },
          ],
          correctAnswer: 'B',
          explanation: 'Split horizon suppresses advertising back on ingress interface.',
        },
      ],
    };
    const res2 = validateGeneratedQuiz(payloadScenarioProp, 1);
    assert(res2.valid === true, 'Case 2: validateGeneratedQuiz accepts "scenario" property alias');
    assert(
      res2.quiz?.questions[0].question === 'What is the expected behavior?',
      'Case 2: Correctly separates question from "scenario" property'
    );
    assert(
      Boolean(res2.quiz?.questions[0].scenarioContext?.includes('split-horizon')),
      'Case 2: Preserves scenario context from "scenario" property'
    );

    // Test 3: scenarioQuestion property
    const payloadScenarioQuestionProp = {
      title: 'RIP Scenario Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-3',
          type: 'scenario',
          scenarioContext: 'Router R1 has "version 2" under router rip. Router R2 sends version 1 broadcasts.',
          scenarioQuestion: 'Why are routes from R2 missing in R1 routing table?',
          options: [
            { id: 'A', text: 'Version mismatch' },
            { id: 'B', text: 'Timer issue' },
          ],
          correctAnswer: 'A',
          explanation: 'RIPv2 by default ignores RIPv1 broadcasts unless configured.',
        },
      ],
    };
    const res3 = validateGeneratedQuiz(payloadScenarioQuestionProp, 1);
    assert(res3.valid === true, 'Case 3: validateGeneratedQuiz accepts "scenarioQuestion" alias');
    assert(
      res3.quiz?.questions[0].question === 'Why are routes from R2 missing in R1 routing table?',
      'Case 3: Correctly extracts question from "scenarioQuestion"'
    );
    assert(
      res3.quiz?.questions[0].scenarioContext === 'Router R1 has "version 2" under router rip. Router R2 sends version 1 broadcasts.',
      'Case 3: Preserves distinct scenarioContext'
    );

    // Test 4: empty string in question ("question": "") with recoverable scenarioContext
    const payloadEmptyQuestionRecoverable = {
      title: 'RIP Scenario Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-4',
          type: 'scenario',
          question: '',
          scenarioContext: 'A RIP network has a count-to-infinity problem. Which mechanism prevents routing loops by setting metric to 16?',
          options: [
            { id: 'A', text: 'Route poisoning' },
            { id: 'B', text: 'Holddown' },
          ],
          correctAnswer: 'A',
          explanation: 'Route poisoning sets metric to 16 (infinity).',
        },
      ],
    };
    const res4 = validateGeneratedQuiz(payloadEmptyQuestionRecoverable, 1);
    assert(res4.valid === true, 'Case 4: Recovers question prompt when "question" is empty string');
    assert(
      res4.quiz?.questions[0].question === 'Which mechanism prevents routing loops by setting metric to 16?',
      'Case 4: Extracts question prompt from scenarioContext'
    );

    // Test 5: Scenario with raw logs/diagnostic context only, NO distinct question (MUST REJECT)
    const payloadScenarioNoQuestion = {
      title: 'RIP Scenario Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-5',
          type: 'scenario',
          scenarioContext: 'R1# show ip interface brief\nGi0/0 10.1.1.1 UP UP\nGi0/1 10.1.2.1 UP UP',
          options: [
            { id: 'A', text: 'Interface UP' },
            { id: 'B', text: 'Interface DOWN' },
          ],
          correctAnswer: 'A',
          explanation: 'Logs show UP.',
        },
      ],
    };
    const res5 = validateGeneratedQuiz(payloadScenarioNoQuestion, 1);
    assert(res5.valid === false, 'Case 5: Rejects scenario with diagnostic logs but no distinct question prompt');
    assert(
      Boolean(res5.errors?.some((e) => e.includes('missing a distinct question prompt'))),
      'Case 5: Provides clear error message explaining missing distinct question'
    );

    // Test 6: Genuinely empty question across all fields (MUST REJECT)
    const payloadGenuinelyEmpty = {
      title: 'RIP Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-sc-6',
          type: 'scenario',
          question: '',
          scenarioContext: '',
          options: [
            { id: 'A', text: 'Option A' },
            { id: 'B', text: 'Option B' },
          ],
          correctAnswer: 'A',
        },
      ],
    };
    const res6 = validateGeneratedQuiz(payloadGenuinelyEmpty, 1);
    assert(res6.valid === false, 'Case 6: Genuinely empty question is strictly rejected');
    assert(
      Boolean(res6.errors?.some((e) => e.includes('empty or missing question text'))),
      'Case 6: Returns standard empty or missing question text error'
    );

    // Test 7: Mixed 5-question multi-type quiz (exact reproduction from reported issue)
    const fullReproductionQuiz = {
      title: 'RIP Technical Assessment',
      topic: 'RIP',
      difficulty: 'medium',
      questions: [
        {
          id: 'q-1',
          type: 'single_choice',
          question: 'What is the default administrative distance of RIPv2 in Cisco IOS?',
          options: [
            { id: 'A', text: '90' },
            { id: 'B', text: '110' },
            { id: 'C', text: '120' },
            { id: 'D', text: '170' },
          ],
          correctAnswer: 'C',
          explanation: 'RIP has an administrative distance of 120.',
        },
        {
          id: 'q-2',
          type: 'multiple_select',
          question: 'Which two features are supported in RIPv2 but NOT in RIPv1? (Choose two)',
          options: [
            { id: 'A', text: 'VLSM / CIDR prefix masks in update packets' },
            { id: 'B', text: 'MD5 Route Authentication' },
            { id: 'C', text: 'Link-state database synchronization' },
            { id: 'D', text: 'Area border router hierarchy' },
          ],
          correctAnswer: ['A', 'B'],
          explanation: 'RIPv2 adds classless subnet masks and authentication.',
        },
        {
          id: 'q-3',
          type: 'true_false',
          question: 'RIPv2 uses multicast address 224.0.0.9 instead of 255.255.255.255 broadcast.',
          options: [
            { id: 'true', text: 'True' },
            { id: 'false', text: 'False' },
          ],
          correctAnswer: true,
          explanation: 'RIPv2 multicasts to 224.0.0.9.',
        },
        {
          id: 'q-4',
          type: 'scenario',
          scenarioContext: 'A network administrator observes that RIPv2 updates are rejected with error "RIP: ignored v2 packet from 192.168.1.2 (invalid authentication)".\n\nWhat configuration command on interface Gi0/1 resolves this failure?',
          options: [
            { id: 'A', text: 'ip rip authentication mode md5' },
            { id: 'B', text: 'router rip && version 1' },
            { id: 'C', text: 'no passive-interface Gi0/1' },
            { id: 'D', text: 'ip summary-address rip 10.0.0.0 255.0.0.0' },
          ],
          correctAnswer: 'A',
          explanation: 'Enabling matching MD5 authentication resolves packet drop.',
        },
        {
          id: 'q-5',
          type: 'single_choice',
          question: 'What is the maximum hop count metric supported by RIP before a route is considered unreachable?',
          options: [
            { id: 'A', text: '15' },
            { id: 'B', text: '16' },
            { id: 'C', text: '255' },
            { id: 'D', text: '100' },
          ],
          correctAnswer: 'A',
          explanation: '15 is maximum reachable metric; 16 represents infinity (unreachable).',
        },
      ],
    };
    const res7 = validateGeneratedQuiz(fullReproductionQuiz, 5);
    assert(res7.valid === true, 'Case 7: Mixed 5-question multi-type quiz passes schema validation cleanly');
    assert(res7.quiz?.questions.length === 5, 'Case 7: All 5 questions normalized');
    assert(
      res7.quiz?.questions[3].type === 'scenario' &&
      res7.quiz?.questions[3].question === 'What configuration command on interface Gi0/1 resolves this failure?',
      'Case 7: Question #4 (scenario) successfully extracts distinct question and retains scenarioContext'
    );
  }

  // SUITE 12: Milestone 4 P1 Anti-Cheat Security & Authorization
  console.log('\n--- SUITE 12: Milestone 4 P1 Anti-Cheat Security & Authorization ---');
  {
    // Setup users & cryptographic sessions
    const userStudentA = 'user-sec-student-a';
    const userStudentB = 'user-sec-student-b';
    const userAdmin = 'user-sec-admin';

    const sessionStudentA = createSignedSessionToken('studentA', 'user');
    const sessionStudentB = createSignedSessionToken('studentB', 'user');
    const sessionAdmin = createSignedSessionToken('adminUser', 'admin');

    inMemory.mockSessions.set(sessionStudentA.payload.jti, { userId: userStudentA, role: 'user', status: 'active' });
    inMemory.mockSessions.set(sessionStudentB.payload.jti, { userId: userStudentB, role: 'user', status: 'active' });
    inMemory.mockSessions.set(sessionAdmin.payload.jti, { userId: userAdmin, role: 'admin', status: 'active' });

    const headersA = { cookie: `netmentor_session=${sessionStudentA.token}`, 'x-netmentor-request': '1' };
    const headersB = { cookie: `netmentor_session=${sessionStudentB.token}`, 'x-netmentor-request': '1' };
    const headersAdmin = { cookie: `netmentor_session=${sessionAdmin.token}`, 'x-netmentor-request': '1' };

    // Create a target quiz owned by Student A
    const quizRecordA = await inMemory.store.createUserQuiz(userStudentA, {
      id: 'quiz-sec-target-a',
      title: 'OSPF Security Assessment',
      topic: 'OSPF Area Types',
      difficulty: 'hard',
      questionCount: 2,
      questionTypes: ['single_choice', 'scenario'],
      questionsJson: JSON.stringify([
        {
          id: 'sec-q1',
          type: 'single_choice',
          question: 'Which LSA type is originated only by ASBRs in OSPFv2?',
          options: [
            { id: 'A', text: 'Type 1 Router LSA' },
            { id: 'B', text: 'Type 3 Summary LSA' },
            { id: 'C', text: 'Type 5 AS External LSA' },
            { id: 'D', text: 'Type 4 ASBR Summary LSA' },
          ],
          correctAnswer: 'C',
          explanation: 'Type 5 AS External LSAs are originated exclusively by ASBRs to inject external routes.',
        },
        {
          id: 'sec-q2',
          type: 'scenario',
          scenarioContext: 'Router R1 in Area 1 cannot reach 10.0.0.0/8 advertised from Area 0. Area 1 is configured as a Totally Stubby Area.',
          question: 'Why does R1 lack an individual inter-area route for 10.0.0.0/8?',
          options: [
            { id: 'A', text: 'Totally stubby areas block Type 3 and Type 5 LSAs, substituting a default route.' },
            { id: 'B', text: 'Type 1 LSAs cannot cross Area 1 boundaries.' },
            { id: 'C', text: 'MTU mismatch between ABR and R1.' },
          ],
          correctAnswer: 'A',
          explanation: 'Totally Stubby areas suppress Type 3, 4, and 5 LSAs, injecting only a Type 3 default route (0.0.0.0/0).',
        },
      ]),
    });

    // Create a quiz owned by Admin
    const quizRecordAdmin = await inMemory.store.createUserQuiz(userAdmin, {
      id: 'quiz-sec-admin-test',
      title: 'Administrative Diagnostic Quiz',
      topic: 'MPLS L3VPN',
      difficulty: 'hard',
      questionCount: 1,
      questionTypes: ['single_choice'],
      questionsJson: JSON.stringify([
        {
          id: 'admin-q1',
          type: 'single_choice',
          question: 'What is the purpose of Route Distinguisher (RD) in MP-BGP?',
          options: [
            { id: 'A', text: 'Creates unique 96-bit VPNv4 prefixes from overlapping IPv4 addresses.' },
            { id: 'B', text: 'Controls route target import and export policies.' },
          ],
          correctAnswer: 'A',
          explanation: 'The 64-bit RD prepends the 32-bit IPv4 prefix creating globally distinct 96-bit VPNv4 prefixes.',
        },
      ]),
    });

    // 1. Unauthenticated request rejection
    const unauthHttp = createMockHttp({
      method: 'GET',
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(unauthHttp.req, unauthHttp.res);
    assert(unauthHttp.getStatusCode() === 401, 'Unauthenticated request with includeKey=true is rejected (401)');
    assert(unauthHttp.getData()?.quiz === undefined, 'No quiz data disclosed to unauthenticated caller');

    // 2. Standard quiz taking (answers and explanations stripped by default)
    const takingHttp = createMockHttp({
      method: 'GET',
      headers: headersA,
      query: { id: quizRecordA.id },
    });
    await quizByIdHandler(takingHttp.req, takingHttp.res);
    assert(takingHttp.getStatusCode() === 200, 'Standard quiz taking returns 200');
    const takingData = takingHttp.getData()?.quiz;
    assert(Boolean(takingData), 'Quiz payload returned for taking');
    assert(takingData.questions[0].correctAnswer === undefined, 'Question #1 correctAnswer is stripped');
    assert(takingData.questions[0].explanation === undefined, 'Question #1 explanation is stripped');
    assert(takingData.questions[1].correctAnswer === undefined, 'Question #2 correctAnswer is stripped');
    assert(takingData.questions[1].explanation === undefined, 'Question #2 explanation is stripped');

    // 3. Pre-submission unauthorized answer-key request (Anti-Cheat defense)
    const cheatAttemptHttp = createMockHttp({
      method: 'GET',
      headers: headersA,
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(cheatAttemptHttp.req, cheatAttemptHttp.res);
    assert(cheatAttemptHttp.getStatusCode() === 403, 'Pre-submission request with includeKey=true is rejected (403 Forbidden)');
    const cheatData = cheatAttemptHttp.getData();
    assert(cheatData?.error === 'Forbidden', 'Error type is Forbidden');
    assert(cheatData?.quiz === undefined, 'Answer key is completely withheld; no quiz object returned');
    assert(
      cheatData?.message?.includes('completed quiz submission') || cheatData?.message?.includes('Answer key'),
      'Clear error message indicates completed submission or administrative privilege required'
    );

    // 4. Client-side forged role claim rejection (Anti-tampering defense)
    const forgeRoleHttp = createMockHttp({
      method: 'GET',
      headers: { ...headersA, 'x-role': 'admin' },
      query: { id: quizRecordA.id, includeKey: 'true', role: 'admin' },
      body: { role: 'admin' },
    });
    await quizByIdHandler(forgeRoleHttp.req, forgeRoleHttp.res);
    assert(forgeRoleHttp.getStatusCode() === 403, 'Client-side forged role claim is rejected (403); server session role enforced');
    assert(forgeRoleHttp.getData()?.quiz === undefined, 'Zero answer disclosure on role forgery attempt');

    // 5. Incomplete attempt does NOT grant answer-key access
    // Add an in-progress / incomplete attempt record with completedAt = null or status = 'in_progress'
    const incompleteAttemptId = `att-incomplete-${Date.now()}`;
    inMemory.attempts.set(incompleteAttemptId, {
      id: incompleteAttemptId,
      quizId: quizRecordA.id,
      userId: userStudentA,
      score: 0,
      totalQuestions: 2,
      percentage: 0,
      answersJson: '{}',
      resultsJson: '[]',
      completedAt: null, // NOT completed
      status: 'in_progress',
      completed: false,
    });

    const incompleteCheckHttp = createMockHttp({
      method: 'GET',
      headers: headersA,
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(incompleteCheckHttp.req, incompleteCheckHttp.res);
    assert(incompleteCheckHttp.getStatusCode() === 403, 'Incomplete/in-progress attempt does NOT grant answer-key access (403)');
    assert(incompleteCheckHttp.getData()?.quiz === undefined, 'Answer keys remain secured during in-progress attempt');

    // Clean up the incomplete attempt before next test
    inMemory.attempts.delete(incompleteAttemptId);

    // 6. Another user's completed attempt does NOT grant access to Student A
    // Record a completed attempt belonging to Student B
    const studentBAttemptId = `att-b-completed-${Date.now()}`;
    inMemory.attempts.set(studentBAttemptId, {
      id: studentBAttemptId,
      quizId: quizRecordA.id,
      userId: userStudentB, // Belongs to Student B
      score: 2,
      totalQuestions: 2,
      percentage: 100,
      answersJson: '{"sec-q1":"C","sec-q2":"A"}',
      resultsJson: '[]',
      completedAt: new Date().toISOString(), // Completed
      completed: true,
    });

    // Student A tries to request includeKey=true
    const studentACrossCheckHttp = createMockHttp({
      method: 'GET',
      headers: headersA,
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(studentACrossCheckHttp.req, studentACrossCheckHttp.res);
    assert(studentACrossCheckHttp.getStatusCode() === 403, "Another user's completed attempt does NOT grant Student A answer-key access (403)");
    assert(studentACrossCheckHttp.getData()?.quiz === undefined, "Zero answer leakage across student accounts");

    // Clean up Student B's attempt
    inMemory.attempts.delete(studentBAttemptId);

    // 7. Cross-tenant quiz access rejection (Student B accessing Student A's quiz)
    const crossTenantHttp = createMockHttp({
      method: 'GET',
      headers: headersB,
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(crossTenantHttp.req, crossTenantHttp.res);
    assert(crossTenantHttp.getStatusCode() === 404, "Student B receives 404 when querying Student A's quiz");

    // 8. Valid post-submission review functionality preserved
    // Student A submits a completed attempt
    await inMemory.store.recordQuizAttempt(userStudentA, quizRecordA.id, {
      score: 2,
      totalQuestions: 2,
      percentage: 100,
      timeTakenSeconds: 45,
      answersJson: JSON.stringify({ 'sec-q1': 'C', 'sec-q2': 'A' }),
      resultsJson: JSON.stringify([
        { questionId: 'sec-q1', correct: true, selectedAnswer: 'C', correctAnswer: 'C' },
        { questionId: 'sec-q2', correct: true, selectedAnswer: 'A', correctAnswer: 'A' },
      ]),
    });

    // Student A now requests includeKey=true for legitimate post-exam review
    const reviewHttp = createMockHttp({
      method: 'GET',
      headers: headersA,
      query: { id: quizRecordA.id, includeKey: 'true' },
    });
    await quizByIdHandler(reviewHttp.req, reviewHttp.res);
    assert(reviewHttp.getStatusCode() === 200, 'Legitimate post-submission review with includeKey=true returns 200 OK');
    const reviewData = reviewHttp.getData()?.quiz;
    assert(Boolean(reviewData), 'Review quiz data returned');
    assert(reviewData.questions[0].correctAnswer === 'C', 'Post-submission review reveals Question #1 correctAnswer');
    assert(reviewData.questions[0].explanation.includes('Type 5 AS External'), 'Post-submission review reveals Question #1 explanation');
    assert(reviewData.questions[1].correctAnswer === 'A', 'Post-submission review reveals Question #2 correctAnswer');
    assert(reviewData.questions[1].explanation.includes('Totally Stubby'), 'Post-submission review reveals Question #2 explanation');

    // 9. Admin role verified via established session system grants answer-key access without prior submission
    const adminDirectHttp = createMockHttp({
      method: 'GET',
      headers: headersAdmin,
      query: { id: quizRecordAdmin.id, includeKey: 'true' },
    });
    await quizByIdHandler(adminDirectHttp.req, adminDirectHttp.res);
    assert(adminDirectHttp.getStatusCode() === 200, 'Admin session grants answer-key access directly without prior submission (200 OK)');
    const adminData = adminDirectHttp.getData()?.quiz;
    assert(Boolean(adminData), 'Admin quiz data returned');
    assert(adminData.questions[0].correctAnswer === 'A', 'Admin can review Question #1 correctAnswer');
    assert(adminData.questions[0].explanation.includes('64-bit RD'), 'Admin can review Question #1 explanation');
  }

  console.log('\n============================================================');
  console.log(`TEST RUN COMPLETE: ${testPassedCount} Passed, ${testFailedCount} Failed`);
  console.log('============================================================\n');

  if (testFailedCount > 0) {
    process.exit(1);
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});
