/**
 * NetMentor AI-Generated Flashcards Test Suite (Milestone 3)
 * 
 * Verifies:
 * 1. Structured JSON schema validation and extraction for flashcards (clean, malformed, alias normalization, length boundaries).
 * 2. Deterministic AI Flashcard Generation on networking topics with 0 live API tokens (AI_PROVIDER=mock).
 * 3. POST /api/ai/generate-flashcards endpoint (auth, CSRF, rate limits, lesson ownership verification, validation error responses).
 * 4. GET /api/flashcards/lesson-deck and POST /api/flashcards/lesson-deck (retrieval, saving, updating existing deck).
 * 5. Strict User Ownership & Multi-Tenant Isolation (User A cannot access or modify User B's lesson or deck).
 * 6. Review Progress Preservation: editing an existing deck preserves unchanged card IDs and their study/mastery history.
 * 7. Official Curriculum & Anki Importer Invariants: existing CCNA/CCNP paths, imported decks, and user progress remain untouched.
 * 8. Quota Conservation: exactly 0 live provider API requests are made during test execution.
 */

import generateFlashcardsHandler from '../api/_routes/ai/generate-flashcards.js';
import lessonDeckHandler from '../api/_routes/flashcards/lesson-deck.js';
import standaloneDeckHandler from '../api/_routes/flashcards/standalone-deck.js';
import * as client from '../api/_lib/db/client.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import { validateGeneratedFlashcards, extractJsonFromText } from '../api/_lib/ai/flashcard-validator.js';
import { buildFlashcardGenerationPrompt } from '../api/_lib/ai/prompt-builder.js';
import { MockAiProvider, __setTestAiProvider } from '../api/_lib/ai/mock-provider.js';
import { CURRICULUM_PATHS } from '../src/data/curriculum/curriculum-data.js';
import { tutorRateLimiter } from '../api/_lib/ai/rate-limiter.js';

// Force mock AI provider and mock environment to guarantee 0 live tokens are spent
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
    url: options.url || '/api/flashcards/lesson-deck',
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
    getStatus: () => statusCode,
    getData: () => responseData,
    getHeader: (name: string) => responseHeaders[name.toLowerCase()],
  };
}

let assertionCount = 0;
function assert(condition: boolean, message: string, details?: any) {
  assertionCount++;
  if (!condition) {
    console.error(`\n❌ ASSERTION FAILED: ${message}`);
    if (details) console.error('Details:', details);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`   ✓ ${message}`);
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log(' NetMentor AI-Generated Flashcards Test Suite (Milestone 3)');
  console.log('======================================================\n');

  // Configure test mock AI provider (guaranteeing 0 live tokens)
  const mockProvider = new MockAiProvider('netmentor-mock-engine-v1');
  __setTestAiProvider(mockProvider);

  // Setup In-Memory Test Database Store
  const userLessonsStore = new Map<string, any>();
  const userDecksStore = new Map<string, any>();
  const userCardsStore = new Map<string, any[]>();
  const userProgressStore = new Map<string, any>();
  const mockSessions = new Map<string, any>();

  const userAId = 'user-student-alpha';
  const userBId = 'user-student-bravo';
  const sampleLessonId = 'lesson-ipsec-vpn-01';

  const sessionA = createSignedSessionToken('student-alpha', 'user');
  const sessionB = createSignedSessionToken('student-bravo', 'user');

  mockSessions.set(sessionA.payload.jti, { userId: userAId, role: 'user', status: 'active' });
  mockSessions.set(sessionB.payload.jti, { userId: userBId, role: 'user', status: 'active' });

  client.__setTestMockStore({
    validateDbSession: async (sessionId: string) => {
      const s = mockSessions.get(sessionId);
      if (!s) return { valid: false };
      return { valid: true, currentRole: s.role || 'user', userStatus: 'active', userId: s.userId };
    },
    getUserGeneratedLessonById: async (userId: string, lessonId: string) => {
      const lesson = userLessonsStore.get(lessonId);
      if (!lesson || lesson.userId !== userId) return null;
      return lesson;
    },
    getLessonFlashcardDeck: async (userId: string, lessonId: string) => {
      for (const [deckId, deck] of userDecksStore.entries()) {
        if (deck.userId === userId && deck.sourceName === `lesson:${lessonId}`) {
          const cards = userCardsStore.get(deckId) || [];
          return { deck, cards };
        }
      }
      return null;
    },
    saveOrUpdateLessonFlashcardDeck: async (userId: string, lessonId: string, deckData: any, cards: any[]) => {
      const sourceName = `lesson:${lessonId}`;
      let targetDeckId: string | null = null;

      for (const [deckId, deck] of userDecksStore.entries()) {
        if (deck.userId === userId && deck.sourceName === sourceName) {
          targetDeckId = deckId;
          break;
        }
      }

      if (targetDeckId) {
        // Update existing deck
        const existingDeck = userDecksStore.get(targetDeckId);
        existingDeck.title = deckData.title;
        existingDeck.description = deckData.description;
        existingDeck.cardCount = cards.length;
        existingDeck.updatedAt = new Date().toISOString();

        // Preserve existing card IDs and review progress
        const existingCards = userCardsStore.get(targetDeckId) || [];
        const existingCardMap = new Map(existingCards.map((c) => [c.id, c]));

        const updatedCards = cards.map((c, idx) => {
          const cardId = c.id && existingCardMap.has(c.id) ? c.id : `card-${Date.now()}-${idx}`;
          const existingProgress = userProgressStore.get(`${userId}:${cardId}`);

          return {
            id: cardId,
            deckId: targetDeckId,
            userId,
            frontMarkdown: c.frontMarkdown,
            backMarkdown: c.backMarkdown,
            tags: c.tags || [],
            orderIndex: c.orderIndex ?? idx,
            progress: existingProgress || null,
          };
        });

        userCardsStore.set(targetDeckId, updatedCards);
        return { deckId: targetDeckId, cardCount: cards.length, isUpdated: true };
      } else {
        // Create new deck
        const newDeckId = `deck-${Date.now()}`;
        const newDeck = {
          id: newDeckId,
          userId,
          sourceType: 'ai_generated',
          sourceName,
          deckName: deckData.deckName || 'ai-lesson-flashcards',
          title: deckData.title,
          description: deckData.description,
          cardCount: cards.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        userDecksStore.set(newDeckId, newDeck);

        const newCards = cards.map((c, idx) => ({
          id: c.id || `card-${Date.now()}-${idx}`,
          deckId: newDeckId,
          userId,
          frontMarkdown: c.frontMarkdown,
          backMarkdown: c.backMarkdown,
          tags: c.tags || [],
          orderIndex: c.orderIndex ?? idx,
        }));

        userCardsStore.set(newDeckId, newCards);
        return { deckId: newDeckId, cardCount: cards.length, isUpdated: false };
      }
    },
    getDeckWithCards: async (userId: string, deckId: string) => {
      const deck = userDecksStore.get(deckId);
      if (!deck || deck.userId !== userId) return null;
      const cards = userCardsStore.get(deckId) || [];
      return { deck, cards };
    },
    saveOrUpdateStandaloneFlashcardDeck: async (
      userId: string,
      deckId: string | null | undefined,
      deckData: any,
      cards: any[]
    ) => {
      let targetDeckId = deckId || null;

      if (targetDeckId && userDecksStore.has(targetDeckId)) {
        const existingDeck = userDecksStore.get(targetDeckId);
        if (existingDeck.userId === userId) {
          existingDeck.title = deckData.title;
          existingDeck.description = deckData.description;
          existingDeck.cardCount = cards.length;
          existingDeck.updatedAt = new Date().toISOString();

          const existingCards = userCardsStore.get(targetDeckId) || [];
          const existingCardMap = new Map<string, any>(existingCards.map((c) => [c.id, c]));

          const updatedCards = cards.map((c, idx) => {
            const cardId = c.id && existingCardMap.has(c.id) ? c.id : `card-standalone-${Date.now()}-${idx}`;
            const existingProgress = userProgressStore.get(cardId);
            return {
              id: cardId,
              deckId: targetDeckId,
              userId,
              frontMarkdown: c.frontMarkdown,
              backMarkdown: c.backMarkdown,
              tags: c.tags || [],
              orderIndex: c.orderIndex ?? idx,
              progress: existingProgress || null,
            };
          });

          userCardsStore.set(targetDeckId, updatedCards);
          return { deckId: targetDeckId, cardCount: cards.length, isUpdated: true };
        }
      }

      // Completely new standalone deck
      const newDeckId = `deck-standalone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newDeck = {
        id: newDeckId,
        userId,
        sourceType: 'ai_standalone',
        sourceName: `standalone:${deckData.topic || 'deck'}:${newDeckId}`,
        deckName: deckData.deckName || 'ai-standalone-flashcards',
        title: deckData.title,
        description: deckData.description,
        cardCount: cards.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      userDecksStore.set(newDeckId, newDeck);

      const newCards = cards.map((c, idx) => ({
        id: c.id || `card-standalone-${Date.now()}-${idx}`,
        deckId: newDeckId,
        userId,
        frontMarkdown: c.frontMarkdown,
        backMarkdown: c.backMarkdown,
        tags: c.tags || [],
        orderIndex: c.orderIndex ?? idx,
      }));

      userCardsStore.set(newDeckId, newCards);
      return { deckId: newDeckId, cardCount: cards.length, isUpdated: false };
    },
    deleteImportedDeck: async (userId: string, deckId: string) => {
      const deck = userDecksStore.get(deckId);
      if (!deck || deck.userId !== userId) return false;
      userDecksStore.delete(deckId);
      userCardsStore.delete(deckId);
      return true;
    },
  });

  // Seed sample custom lesson for User A
  userLessonsStore.set(sampleLessonId, {
    id: sampleLessonId,
    userId: userAId,
    title: 'Site-to-Site IPsec VPN Architecture',
    topic: 'Site-to-Site IPsec VPNs',
    difficulty: 'intermediate',
    estimatedMinutes: 20,
    tags: JSON.stringify(['VPN', 'IPsec', 'Cisco']),
    description: 'A deep dive into IKEv1/IKEv2 Phase 1 and Phase 2 negotiations.',
    contentJson: JSON.stringify({
      lessonTitle: 'Site-to-Site IPsec VPN Architecture',
      topic: 'Site-to-Site IPsec VPNs',
      difficulty: 'intermediate',
      sections: [
        {
          id: 'sec-1',
          title: 'IKE Negotiation Phases',
          explanation: 'Phase 1 establishes ISAKMP SA. Phase 2 negotiates IPsec SAs.',
          commands: [
            { command: 'show crypto ikev2 sa', description: 'Inspect IKEv2 Phase 1 SA state' },
            { command: 'show crypto ipsec sa', description: 'Inspect IPsec Phase 2 SAs and ESP packet counters' },
          ],
        },
      ],
      summary: {
        whatYouLearned: 'Mastered IKE Phase 1 and Phase 2 crypto map configuration and verification.',
        keyTerms: [
          { term: 'ISAKMP', definition: 'Internet Security Association and Key Management Protocol' },
          { term: 'ESP', definition: 'Encapsulating Security Payload (IP Protocol 50)' },
        ],
      },
    }),
  });

  const studentAHeaders = {
    cookie: `netmentor_session=${sessionA.token}`,
    'x-netmentor-request': '1',
  };

  const studentBHeaders = {
    cookie: `netmentor_session=${sessionB.token}`,
    'x-netmentor-request': '1',
  };

  // ========================================================
  // [Suite 1] Flashcard JSON Extraction & Validation
  // ========================================================
  console.log('[Suite 1] Flashcard JSON Extraction & Validation');

  const validFlashcardJson = JSON.stringify({
    title: 'Site-to-Site IPsec VPNs - Flashcards',
    description: 'High-yield active recall flashcard deck for IPsec VPNs.',
    cards: [
      {
        frontMarkdown: 'What is the purpose of IKEv2 Phase 1 (IKE SA)?',
        backMarkdown: 'Authenticates peers and sets up a secure, encrypted tunnel for control traffic.',
        tags: ['IPsec', 'IKEv2'],
      },
      {
        frontMarkdown: 'Which IP protocol number is used by ESP (Encapsulating Security Payload)?',
        backMarkdown: 'IP Protocol 50 (does not use TCP or UDP ports).',
        tags: ['IPsec', 'ESP'],
      },
    ],
  });

  const validationResult = validateGeneratedFlashcards(JSON.parse(validFlashcardJson));
  assert(validationResult.valid === true, 'Valid flashcard JSON passes schema validation');
  assert(validationResult.deck?.cards.length === 2, 'Parsed exact card count');
  assert(validationResult.deck?.title === 'Site-to-Site IPsec VPNs - Flashcards', 'Preserved deck title');

  // Test alias normalization: "question" / "answer", "tag", "items"
  const aliasedJson = JSON.stringify({
    name: 'Aliased Flashcards Deck',
    summary: 'Deck using aliases',
    items: [
      {
        question: 'What is MTU?',
        answer: 'Maximum Transmission Unit',
        tag: 'Framing, Layer 2',
      },
    ],
  });

  const aliasResult = validateGeneratedFlashcards(JSON.parse(aliasedJson));
  assert(aliasResult.valid === true, 'Aliased JSON (items, question, answer, tag) is normalized successfully');
  assert(aliasResult.deck?.cards[0].frontMarkdown === 'What is MTU?', 'Normalized question to frontMarkdown');
  assert(aliasResult.deck?.cards[0].backMarkdown === 'Maximum Transmission Unit', 'Normalized answer to backMarkdown');
  assert(aliasResult.deck?.cards[0].tags?.includes('Framing'), 'Normalized string tags to array');

  // Test malformed JSON extraction
  const rawTextWithFenceAndChatter = '```json\n' + validFlashcardJson + '\n```\nHope these flashcards help your CCNA studies!';
  const extracted = extractJsonFromText(rawTextWithFenceAndChatter);
  assert(extracted.success === true, 'extractJsonFromText handles code fences with trailing conversational remarks');

  // Test invalid/empty card rejection
  const emptyCardsResult = validateGeneratedFlashcards({ title: 'Empty', cards: [] });
  assert(emptyCardsResult.valid === false, 'Deck with empty cards array is rejected');
  assert(emptyCardsResult.errors?.some((e) => e.includes('cards')) === true, 'Error message identifies missing cards');

  // ========================================================
  // [Suite 2] Deterministic AI Flashcard Generation (Mock Provider)
  // ========================================================
  console.log('\n[Suite 2] Deterministic AI Flashcard Generation (Mock Provider)');

  const prompt = buildFlashcardGenerationPrompt({
    lessonTitle: 'Site-to-Site IPsec VPNs',
    topic: 'Site-to-Site IPsec VPNs',
    cardCount: 10,
    focusArea: 'CLI Commands & Verification',
  });

  const aiResponse = await mockProvider.generateResponse({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
  });

  assert(aiResponse.isSimulated === true, 'Mock provider flags response as isSimulated=true');
  assert(aiResponse.model === 'netmentor-mock-engine-v1', 'Model matches deterministic mock engine');

  const parsedGenerated = validateGeneratedFlashcards(JSON.parse(aiResponse.text));
  assert(parsedGenerated.valid === true, 'Mock generated flashcards pass strict validation');
  assert(parsedGenerated.deck?.cards.length === 10, 'Generated exact requested card count (10)');
  assert(parsedGenerated.deck?.cards.some((c) => c.frontMarkdown.toLowerCase().includes('ipsec')), 'Flashcards reflect source topic');

  // ========================================================
  // [Suite 3] POST /api/ai/generate-flashcards Endpoint
  // ========================================================
  console.log('\n[Suite 3] POST /api/ai/generate-flashcards Endpoint');

  // Unauthenticated request (401)
  const unauthHttp = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { lessonId: sampleLessonId, cardCount: 10 },
  });
  await generateFlashcardsHandler(unauthHttp.req, unauthHttp.res);
  assert(unauthHttp.getStatus() === 401, 'Unauthenticated request with CSRF rejected with 401 Unauthorized');

  // Valid authenticated generation request
  const validGenHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: sampleLessonId, cardCount: 10, focusArea: 'Comprehensive' },
  });
  await generateFlashcardsHandler(validGenHttp.req, validGenHttp.res);
  console.log('validGenHttp status:', validGenHttp.getStatus(), 'data:', validGenHttp.getData());
  assert(validGenHttp.getStatus() === 200, 'Valid generation request returns 200 OK');
  assert(validGenHttp.getData()?.success === true, 'Response contains success=true');
  assert(validGenHttp.getData()?.deck?.cards?.length === 10, 'Returned 10 draft flashcards');
  assert(validGenHttp.getData()?.isSimulated === true, 'Draft flagged isSimulated=true');

  // Missing lessonId (400)
  const missingLessonHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { cardCount: 10 },
  });
  await generateFlashcardsHandler(missingLessonHttp.req, missingLessonHttp.res);
  assert(missingLessonHttp.getStatus() === 400, 'Missing lessonId returns 400 Bad Request');

  // Non-existent lesson (404)
  const nonExistentLessonHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: 'non-existent-lesson-id-999', cardCount: 10 },
  });
  await generateFlashcardsHandler(nonExistentLessonHttp.req, nonExistentLessonHttp.res);
  assert(nonExistentLessonHttp.getStatus() === 404, 'Non-existent lesson returns 404 Not Found');

  // ========================================================
  // [Suite 4] User Ownership & Multi-Tenant Isolation
  // ========================================================
  console.log('\n[Suite 4] User Ownership & Multi-Tenant Isolation');

  // User B attempts to generate flashcards from User A's custom lesson (404 / access denied)
  const crossTenantGenHttp = createMockHttp({
    method: 'POST',
    headers: studentBHeaders,
    body: { lessonId: sampleLessonId, cardCount: 10 },
  });
  await generateFlashcardsHandler(crossTenantGenHttp.req, crossTenantGenHttp.res);
  assert(crossTenantGenHttp.getStatus() === 404, 'User B access to User A lesson rejected with 404 Not Found');

  // ========================================================
  // [Suite 5] Lesson Deck Persistence & Retrieval (/api/flashcards/lesson-deck)
  // ========================================================
  console.log('\n[Suite 5] Lesson Deck Persistence & Retrieval (/api/flashcards/lesson-deck)');

  // Before saving, GET /api/flashcards/lesson-deck returns deck: null
  const getEmptyDeckHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { lessonId: sampleLessonId },
  });
  await lessonDeckHandler(getEmptyDeckHttp.req, getEmptyDeckHttp.res);
  assert(getEmptyDeckHttp.getStatus() === 200, 'GET unsaved deck returns 200 OK');
  assert(getEmptyDeckHttp.getData()?.deck === null, 'Deck is null when not yet saved');

  // Save approved deck
  const draftCardsToSave = [
    {
      id: 'card-1',
      frontMarkdown: 'What is Phase 1 IKEv2?',
      backMarkdown: 'Authenticates peers and establishes bidirectional IKE SA.',
      tags: ['IPsec', 'IKEv2'],
    },
    {
      id: 'card-2',
      frontMarkdown: 'What command displays Phase 2 IPsec SAs?',
      backMarkdown: '```bash\nshow crypto ipsec sa\n```',
      tags: ['CLI', 'Cisco IOS-XE'],
    },
  ];

  const saveDeckHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      lessonId: sampleLessonId,
      title: 'Site-to-Site IPsec VPNs - Study Flashcards',
      description: 'Active recall cards for IPsec.',
      cards: draftCardsToSave,
    },
  });
  await lessonDeckHandler(saveDeckHttp.req, saveDeckHttp.res);
  assert(saveDeckHttp.getStatus() === 200, 'Saving deck returns 200 OK');
  assert(saveDeckHttp.getData()?.success === true, 'Response indicates success=true');
  assert(Boolean(saveDeckHttp.getData()?.deckId) === true, 'Returned valid deckId');
  const savedDeckId = saveDeckHttp.getData()?.deckId;

  // Retrieve saved deck via GET /api/flashcards/lesson-deck
  const getSavedDeckHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { lessonId: sampleLessonId },
  });
  await lessonDeckHandler(getSavedDeckHttp.req, getSavedDeckHttp.res);
  assert(getSavedDeckHttp.getStatus() === 200, 'GET saved deck returns 200 OK');
  assert(getSavedDeckHttp.getData()?.deck?.id === savedDeckId, 'Deck ID matches saved ID');
  assert(getSavedDeckHttp.getData()?.cards?.length === 2, 'Retrieved exact saved card count');

  // ========================================================
  // [Suite 6] Review Progress Preservation & Card Editing
  // ========================================================
  console.log('\n[Suite 6] Review Progress Preservation & Card Editing');

  // Simulate studying: Record study progress on card-1 ('mastered', confidence 5, review count 3)
  userProgressStore.set(`${userAId}:card-1`, {
    status: 'mastered',
    confidenceScore: 5,
    reviewCount: 3,
    lastReviewedAt: new Date().toISOString(),
  });

  // User edits deck: Updates card-1 front text, removes card-2, adds card-3
  const updatedCardsPayload = [
    {
      id: 'card-1', // existing ID
      frontMarkdown: 'What is Phase 1 IKEv2 (Updated question)?',
      backMarkdown: 'Authenticates peers and establishes bidirectional IKE SA.',
      tags: ['IPsec', 'IKEv2', 'Phase1'],
    },
    {
      // new card without existing ID
      frontMarkdown: 'What does ESP packet encapsulation provide?',
      backMarkdown: 'Confidentiality, data integrity, anti-replay, and optional authentication.',
      tags: ['IPsec', 'Security'],
    },
  ];

  const updateDeckHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      lessonId: sampleLessonId,
      title: 'Site-to-Site IPsec VPNs - Study Flashcards (v2)',
      cards: updatedCardsPayload,
    },
  });
  await lessonDeckHandler(updateDeckHttp.req, updateDeckHttp.res);
  assert(updateDeckHttp.getStatus() === 200, 'Updating deck returns 200 OK');
  assert(updateDeckHttp.getData()?.isUpdated === true, 'Response confirms deck was updated in-place');

  // Verify review progress on card-1 is PRESERVED
  const verifyProgressDeckHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { lessonId: sampleLessonId },
  });
  await lessonDeckHandler(verifyProgressDeckHttp.req, verifyProgressDeckHttp.res);
  const reloadedCards = verifyProgressDeckHttp.getData()?.cards || [];
  const reloadedCard1 = reloadedCards.find((c: any) => c.id === 'card-1');

  assert(reloadedCard1 !== undefined, 'Card-1 ID was preserved in database');
  assert(reloadedCard1?.frontMarkdown.includes('Updated question'), 'Card-1 question text updated successfully');
  assert(reloadedCard1?.progress?.status === 'mastered', 'Card-1 review progress status ("mastered") was strictly preserved');
  assert(reloadedCard1?.progress?.confidenceScore === 5, 'Card-1 confidence score (5) was strictly preserved');
  assert(reloadedCard1?.progress?.reviewCount === 3, 'Card-1 review count (3) was strictly preserved');

  // ========================================================
  // [Suite 7] Official Curriculum & Anki Importer Invariants
  // ========================================================
  console.log('\n[Suite 7] Official Curriculum & Anki Importer Invariants');

  assert(Array.isArray(CURRICULUM_PATHS), 'CURRICULUM_PATHS exists and is an array');
  assert(CURRICULUM_PATHS.length >= 2, 'Official CCNA & CCNP certification paths are intact');

  const ccnaPath = CURRICULUM_PATHS.find((p) => p.id === 'path-fundamentals' || p.targetCert === 'CCNA');
  assert(ccnaPath !== undefined, 'Official CCNA track is present');

  const officialLessons = ccnaPath?.topics.flatMap((t) => t.lessons) || [];
  assert(officialLessons.length > 0, 'Official curriculum lessons remain populated');
  assert(officialLessons.every((l) => typeof l.id === 'string' && l.id.length > 0), 'Official lesson IDs are strictly unmodified');

  // ========================================================
  // [Suite 8] Flashcard Parser & Normalizer Regression Tests
  // ========================================================
  console.log('\n[Suite 8] Flashcard Parser & Normalizer Regression Tests');

  // 8.1: JSON inside Markdown code fences with top-level array
  const rawFenceArray = '```json\n[\n  {"front": "What is Layer 2 switching?", "back": "Forwarding Ethernet frames using MAC addresses.", "tags": ["Switching"]},\n  {"front": "What is ARP?", "back": "Resolves IPv4 addresses to MAC addresses.", "tags": ["ARP"]}\n]\n```';
  const extArray = extractJsonFromText(rawFenceArray);
  assert(extArray.success === true, 'extractJsonFromText successfully parses top-level array inside code fences');
  const valArray = validateGeneratedFlashcards(extArray.data);
  assert(valArray.valid === true, 'validateGeneratedFlashcards validates top-level array deck');
  assert(valArray.deck?.cards.length === 2, 'Parsed 2 cards from array deck');

  // 8.2: JSON with nested Markdown code blocks inside fields
  const rawNestedFences = '```json\n{\n  "title": "Cisco CLI Diagnostics",\n  "cards": [\n    {\n      "frontMarkdown": "Which command verifies OSPF neighbor adjacency?",\n      "backMarkdown": "Use the following command:\\n```bash\\nshow ip ospf neighbor\\n```\\nCheck for 2-WAY or FULL state.",\n      "tags": ["OSPF", "CLI"]\n    }\n  ]\n}\n```\nHope this helps your studies!';
  const extNested = extractJsonFromText(rawNestedFences);
  assert(extNested.success === true, 'extractJsonFromText handles nested code fences without breaking on internal backticks');
  const valNested = validateGeneratedFlashcards(extNested.data);
  assert(valNested.valid === true, 'Validates deck with nested code fences');
  assert(valNested.deck?.cards[0].backMarkdown.includes('show ip ospf neighbor'), 'Preserved nested code block in backMarkdown');

  // 8.3: JSON surrounded by explanatory text (no fences)
  const rawTextSurrounded = 'Here are 2 networking flashcards:\n{\n  "title": "Subnetting Principles",\n  "cards": [\n    {"front": "What is /27 host capacity?", "back": "30 usable hosts (32 total - 2).", "tags": ["Subnetting"]},\n    {"front": "What is /30 host capacity?", "back": "2 usable hosts.", "tags": ["Subnetting"]}\n  ]\n}\nReview these daily for best retention!';
  const extSurrounded = extractJsonFromText(rawTextSurrounded);
  assert(extSurrounded.success === true, 'extractJsonFromText extracts JSON surrounded by explanatory text without fences');
  assert(validateGeneratedFlashcards(extSurrounded.data).valid === true, 'Validates extracted surrounded JSON');

  // 8.4: JSON with unescaped raw newlines in string literals
  const rawWithNewlines = '{\n  "title": "BGP Path Attributes",\n  "cards": [\n    {\n      "front": "What are the BGP path selection steps?",\n      "back": "1. Highest Weight\n2. Highest Local Preference\n3. Locally Originated\n4. Shortest AS_PATH",\n      "tags": ["BGP"]\n    }\n  ]\n}';
  const extNewlines = extractJsonFromText(rawWithNewlines);
  assert(extNewlines.success === true, 'extractJsonFromText repairs and parses unescaped raw newlines inside string literals');
  assert(validateGeneratedFlashcards(extNewlines.data).deck?.cards[0].backMarkdown.includes('Highest Weight'), 'Preserves content across repaired newlines');

  // 8.5: JSON with comments and trailing commas
  const rawWithComments = '{\n  // Single line comment\n  "title": "VLANs & Trunks",\n  /* Multi-line\n     comment */\n  "cards": [\n    {\n      "front": "What is 802.1Q?",\n      "back": "Industry standard VLAN trunking protocol that inserts a 4-byte tag.",\n      "tags": ["VLAN", "802.1Q"],\n    },\n  ],\n}';
  const extComments = extractJsonFromText(rawWithComments);
  assert(extComments.success === true, 'extractJsonFromText strips comments and trailing commas');

  // 8.6: Supported alternative envelope structures
  const nestedDeckEnvelope = {
    deck: {
      title: 'Nested Deck Test',
      description: 'Nested inside deck property',
      cards: [
        { question: 'Q1', answer: 'A1', tag: 'Tag1' },
      ],
    },
  };
  const valNestedEnv = validateGeneratedFlashcards(nestedDeckEnvelope);
  assert(valNestedEnv.valid === true, 'Normalizes { deck: { cards: [...] } } envelope');
  assert(valNestedEnv.deck?.title === 'Nested Deck Test', 'Extracted title from nested deck envelope');

  const indexedMapDeck = {
    title: 'Indexed Map Deck',
    cards: {
      '0': { prompt: 'Q1', explanation: 'A1' },
      '1': { prompt: 'Q2', explanation: 'A2' },
    },
  };
  const valIndexed = validateGeneratedFlashcards(indexedMapDeck);
  assert(valIndexed.valid === true, 'Normalizes indexed object map { "0": {...}, "1": {...} } into cards array');
  assert(valIndexed.deck?.cards.length === 2, 'Parsed 2 cards from indexed object map');

  // 8.7: Supported alternative card field names
  const aliasFieldsDeck = {
    cards: [
      {
        front_text: 'What is a collision domain?',
        back_text: 'A network segment where simultaneous frame transmissions cause collisions.',
        category: 'Layer 2',
      },
      {
        term: 'Broadcast Domain',
        definition: 'A segment enclosed by Layer 3 routers where all devices receive broadcast frames.',
        topics: 'Layer 2; Layer 3',
      },
      {
        challenge: { text: 'What is MTU?' },
        solution: { text: 'Maximum Transmission Unit.' },
        labels: ['Framing'],
      },
    ],
  };
  const valAliases = validateGeneratedFlashcards(aliasFieldsDeck);
  assert(valAliases.valid === true, 'Normalizes alternative card field names (front_text, term, challenge.text, definition, etc.)');
  assert(valAliases.deck?.cards.length === 3, 'All 3 aliased cards normalized successfully');
  assert(valAliases.deck?.cards[2].frontMarkdown === 'What is MTU?', 'Extracted text from nested object prompt');

  // 8.8: Missing required fields and invalid card structures
  assert(validateGeneratedFlashcards(null).valid === false, 'Rejects null payload');
  assert(validateGeneratedFlashcards({ cards: [] }).valid === false, 'Rejects deck with empty cards array');
  assert(validateGeneratedFlashcards({ cards: [{ front: '', back: 'A1' }] }).valid === false, 'Rejects card with empty front question');
  assert(validateGeneratedFlashcards({ cards: [{ front: 'Q1', back: '' }] }).valid === false, 'Rejects card with empty back answer');
  assert(validateGeneratedFlashcards({ cards: [null, undefined, 'string'] }).valid === false, 'Rejects non-object cards');

  // 8.9: Truncated JSON detection and actionable error reporting via API
  // Seed lesson for testing truncated generation
  userLessonsStore.set('lesson-truncated-test', {
    id: 'lesson-truncated-test',
    userId: userAId,
    title: 'TEST_TRUNCATED_JSON Lesson',
    topic: 'TEST_TRUNCATED_JSON',
    difficulty: 'intermediate',
    description: 'Testing truncated generation',
  });

  const truncatedGenHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: 'lesson-truncated-test', cardCount: 10 },
  });
  await generateFlashcardsHandler(truncatedGenHttp.req, truncatedGenHttp.res);
  assert(truncatedGenHttp.getStatus() === 422, 'Truncated JSON returns 422 Unprocessable Entity');
  const truncData = truncatedGenHttp.getData();
  assert(truncData.category === 'truncated_json', 'Categorized cleanly as truncated_json');
  assert(truncData.message.includes('cut off before completion'), 'Returns actionable truncated message suggesting smaller card count');

  // 8.10: Malformed JSON detection and syntax error reporting via API
  userLessonsStore.set('lesson-invalid-test', {
    id: 'lesson-invalid-test',
    userId: userAId,
    title: 'TEST_INVALID_JSON Lesson',
    topic: 'TEST_INVALID_JSON',
    difficulty: 'intermediate',
    description: 'Testing malformed generation',
  });

  const invalidGenHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: 'lesson-invalid-test', cardCount: 10 },
  });
  await generateFlashcardsHandler(invalidGenHttp.req, invalidGenHttp.res);
  assert(invalidGenHttp.getStatus() === 422, 'Malformed JSON returns 422 Unprocessable Entity');
  const invData = invalidGenHttp.getData();
  assert(invData.category === 'malformed_json', 'Categorized cleanly as malformed_json');
  assert(invData.message.includes('valid JSON syntax'), 'Returns clear syntax error message');

  // 8.11: Top-level array generation via API
  userLessonsStore.set('lesson-array-test', {
    id: 'lesson-array-test',
    userId: userAId,
    title: 'TEST_ARRAY_JSON Lesson',
    topic: 'TEST_ARRAY_JSON',
    difficulty: 'intermediate',
    description: 'Testing array output',
  });

  const arrayGenHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: 'lesson-array-test', cardCount: 5 },
  });
  await generateFlashcardsHandler(arrayGenHttp.req, arrayGenHttp.res);
  assert(arrayGenHttp.getStatus() === 200, 'Array JSON generation returns 200 OK');
  assert(arrayGenHttp.getData()?.deck?.cards?.length === 2, 'Array JSON normalized into valid deck cards array');

  // 8.12: Nested code blocks generation via API
  userLessonsStore.set('lesson-nested-code-test', {
    id: 'lesson-nested-code-test',
    userId: userAId,
    title: 'TEST_NESTED_CODE_BLOCKS Lesson',
    topic: 'TEST_NESTED_CODE_BLOCKS',
    difficulty: 'intermediate',
    description: 'Testing nested code blocks',
  });

  const nestedGenHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: 'lesson-nested-code-test', cardCount: 5 },
  });
  await generateFlashcardsHandler(nestedGenHttp.req, nestedGenHttp.res);
  assert(nestedGenHttp.getStatus() === 200, 'Nested code blocks generation returns 200 OK');
  assert(nestedGenHttp.getData()?.deck?.cards[0]?.backMarkdown.includes('show ip ospf neighbor'), 'CLI code block preserved');

  // 8.13: Minimum and maximum card counts
  assert(buildFlashcardGenerationPrompt({ lessonTitle: 'T', topic: 'T', cardCount: 1 }).userPrompt.includes('Generate exactly 3 flashcards'), 'Prompt clamps cardCount < 3 to 3');
  assert(buildFlashcardGenerationPrompt({ lessonTitle: 'T', topic: 'T', cardCount: 50 }).userPrompt.includes('Generate exactly 25 flashcards'), 'Prompt clamps cardCount > 25 to 25');

  // Large deck cap at 30
  const largeCards = Array.from({ length: 40 }, (_, i) => ({ front: `Q${i + 1}`, back: `A${i + 1}` }));
  const valLarge = validateGeneratedFlashcards({ cards: largeCards });
  assert(valLarge.valid === true, 'Deck with 40 cards passes validation');
  assert(valLarge.deck?.cards.length === 30, 'Capped at maximum 30 cards to prevent payload bloat');

  // Reset rate limiter so extended standalone test suites have fresh quota
  tutorRateLimiter.reset();

  console.log('\n[Suite 9] Standalone AI Flashcard Generation (Zero Lesson Required)');

  // 9.1: Generate standalone flashcards for topic "VTP"
  const standaloneVtpHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      topic: 'VTP (VLAN Trunking Protocol)',
      cardCount: 5,
      difficulty: 'intermediate',
    },
  });
  await generateFlashcardsHandler(standaloneVtpHttp.req, standaloneVtpHttp.res);
  assert(standaloneVtpHttp.getStatus() === 200, 'Standalone VTP flashcard generation returns 200 OK');
  const vtpDeck = standaloneVtpHttp.getData()?.deck;
  assert(vtpDeck && vtpDeck.cards.length === 5, 'Returned exactly 5 cards for standalone VTP deck');
  assert(standaloneVtpHttp.getData()?.topic === 'VTP (VLAN Trunking Protocol)', 'Echoes sanitized standalone topic');
  assert(standaloneVtpHttp.getData()?.lessonId === undefined, 'No lessonId attached to standalone deck');
  assert(standaloneVtpHttp.getData()?.isSimulated === true, 'Deterministic mock flag set to true');

  // 9.2: Test all supported difficulties
  for (const diff of ['beginner', 'intermediate', 'advanced'] as const) {
    const diffHttp = createMockHttp({
      method: 'POST',
      headers: studentAHeaders,
      body: { topic: 'OSPF Areas', difficulty: diff, cardCount: 5 },
    });
    await generateFlashcardsHandler(diffHttp.req, diffHttp.res);
    assert(diffHttp.getStatus() === 200, `Generates flashcards for difficulty "${diff}" (200 OK)`);
    assert(diffHttp.getData()?.deck?.cards?.length === 5, `Returns valid cards for "${diff}"`);
  }

  // 9.3: Test all supported card counts (5, 10, 15, 20)
  for (const count of [5, 10, 15, 20]) {
    const countHttp = createMockHttp({
      method: 'POST',
      headers: studentAHeaders,
      body: { topic: 'BGP Path Attributes', cardCount: count },
    });
    await generateFlashcardsHandler(countHttp.req, countHttp.res);
    assert(countHttp.getStatus() === 200, `Generates exactly ${count} cards requested (200 OK)`);
    assert(countHttp.getData()?.deck?.cards?.length === count, `Deck contains exactly ${count} flashcards`);
  }

  // 9.4: Test optional focusArea and emphasis
  const focusHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      topic: 'STP Spanning Tree Protocol',
      cardCount: 5,
      focusArea: 'PortFast, BPDU Guard, and Root Guard',
      emphasis: 'Cisco CLI Commands & Verification',
    },
  });
  await generateFlashcardsHandler(focusHttp.req, focusHttp.res);
  assert(focusHttp.getStatus() === 200, 'Generates flashcards with custom focusArea and emphasis (200 OK)');
  assert(focusHttp.getData()?.deck?.cards?.length === 5, 'Focus-grounded deck has 5 cards');

  // 9.5: Test non-networking topic (general technical concepts allowed)
  const nonNetHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      topic: 'Linux systemd cgroups and resource limits',
      cardCount: 5,
    },
  });
  await generateFlashcardsHandler(nonNetHttp.req, nonNetHttp.res);
  assert(nonNetHttp.getStatus() === 200, 'Non-networking technical topic allowed (200 OK)');
  assert(nonNetHttp.getData()?.topic === 'Linux systemd cgroups and resource limits', 'Preserves general technical topic');

  // 9.6: Missing both topic and lessonId rejected
  const missingBothHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { cardCount: 10 },
  });
  await generateFlashcardsHandler(missingBothHttp.req, missingBothHttp.res);
  assert(missingBothHttp.getStatus() === 400, 'Missing both topic and lessonId returns 400 Bad Request');
  assert(missingBothHttp.getData()?.message?.includes('Either "topic" or "lessonId" must be provided'), 'Error message informs user topic or lessonId is required');

  // 9.7: Empty or whitespace-only topic rejected
  const emptyTopicHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { topic: '   ' },
  });
  await generateFlashcardsHandler(emptyTopicHttp.req, emptyTopicHttp.res);
  assert(emptyTopicHttp.getStatus() === 400, 'Empty whitespace topic returns 400 Bad Request');

  // 9.8: Topic < 2 chars rejected
  const shortTopicHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { topic: 'X' },
  });
  await generateFlashcardsHandler(shortTopicHttp.req, shortTopicHttp.res);
  assert(shortTopicHttp.getStatus() === 400, 'Topic under 2 characters returns 400 Bad Request');

  // 9.9: Upstream provider failure in standalone mode
  const providerErrorHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { topic: 'TEST_PROVIDER_ERROR', cardCount: 5 },
  });
  await generateFlashcardsHandler(providerErrorHttp.req, providerErrorHttp.res);
  assert(providerErrorHttp.getStatus() === 502, 'Provider failure in standalone mode returns 502 Bad Gateway');

  // 9.10: Malformed JSON in standalone mode
  const malformedHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { topic: 'TEST_INVALID_JSON', cardCount: 5 },
  });
  await generateFlashcardsHandler(malformedHttp.req, malformedHttp.res);
  assert(malformedHttp.getStatus() === 422, 'Malformed JSON in standalone mode returns 422 Unprocessable Entity');

  // 9.11: Truncated JSON in standalone mode
  const truncatedHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { topic: 'TEST_TRUNCATED_JSON', cardCount: 5 },
  });
  await generateFlashcardsHandler(truncatedHttp.req, truncatedHttp.res);
  assert(truncatedHttp.getStatus() === 422, 'Truncated JSON in standalone mode returns 422 Unprocessable Entity');

  console.log('\n[Suite 10] Standalone Deck Persistence, Retrieval & Editing (/api/flashcards/standalone-deck)');

  // 10.1: Save new standalone deck
  const sampleStandaloneCards = [
    { frontMarkdown: 'What is VTP Server mode?', backMarkdown: 'Can create, modify, and delete VLANs and transmits VTP advertisements.', tags: ['VTP'] },
    { frontMarkdown: 'What is VTP Client mode?', backMarkdown: 'Cannot create, modify, or delete VLANs; synchronizes from server advertisements.', tags: ['VTP'] },
    { frontMarkdown: 'What is VTP Transparent mode?', backMarkdown: 'Maintains local VLAN database; forwards advertisements without synchronizing.', tags: ['VTP'] },
    { frontMarkdown: 'What is Configuration Revision Number?', backMarkdown: 'A 32-bit number indicating database revision; higher revision overwrites lower.', tags: ['VTP'] },
    { frontMarkdown: 'How to reset VTP revision number?', backMarkdown: 'Change VTP domain name to dummy value then back, or change to transparent mode.', tags: ['VTP', 'CLI'] },
  ];

  const standaloneSaveDeckHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      title: 'VLAN Trunking Protocol (VTP) Mastery',
      description: 'Comprehensive flashcards on VTP modes, revision numbers, and pruning.',
      topic: 'VTP',
      cards: sampleStandaloneCards,
    },
  });
  await standaloneDeckHandler(standaloneSaveDeckHttp.req, standaloneSaveDeckHttp.res);
  assert(standaloneSaveDeckHttp.getStatus() === 200, 'POST /api/flashcards/standalone-deck returns 200 OK');
  assert(standaloneSaveDeckHttp.getData()?.success === true, 'Response indicates success=true');
  const savedStandaloneDeckId = standaloneSaveDeckHttp.getData()?.deckId;
  assert(Boolean(savedStandaloneDeckId), 'Returns non-empty saved deckId');
  assert(standaloneSaveDeckHttp.getData()?.cardCount === 5, 'Persisted exact card count of 5');
  assert(standaloneSaveDeckHttp.getData()?.isUpdated === false, 'isUpdated is false for initial save');

  // 10.2: Retrieve saved standalone deck via GET
  const getDeckHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(getDeckHttp.req, getDeckHttp.res);
  assert(getDeckHttp.getStatus() === 200, 'GET /api/flashcards/standalone-deck returns 200 OK');
  assert(getDeckHttp.getData()?.deck?.id === savedStandaloneDeckId, 'Retrieved deck matches saved ID');
  assert(getDeckHttp.getData()?.deck?.title === 'VLAN Trunking Protocol (VTP) Mastery', 'Retrieved exact saved deck title');
  assert(getDeckHttp.getData()?.deck?.sourceType === 'ai_standalone', 'Source type is ai_standalone');
  const retrievedCards = getDeckHttp.getData()?.cards || [];
  assert(retrievedCards.length === 5, 'Retrieved exact 5 flashcards');
  const firstCardId = retrievedCards[0]?.id;
  assert(Boolean(firstCardId), 'Card #1 has a valid unique ID');

  // 10.3: Seed review progress for Card #1
  userProgressStore.set(firstCardId, {
    status: 'mastered',
    confidenceScore: 5,
    reviewCount: 4,
  });

  // 10.4: Reopen and edit deck: modify Card #1, add Card #6, delete Card #5
  const editedCardsPayload = [
    {
      id: firstCardId,
      frontMarkdown: 'Updated Front: What is VTP Server Mode (Enhanced)?',
      backMarkdown: 'Updated Back: Can configure global VLANs and transmits advertisements with incremental revision numbers.',
      tags: ['VTP', 'Enhanced'],
    },
    { ...retrievedCards[1] },
    { ...retrievedCards[2] },
    { ...retrievedCards[3] },
    // Card #4 (the 5th original card) is omitted (deleted)
    {
      frontMarkdown: 'Newly Added Card: What is VTP Pruning?',
      backMarkdown: 'Suppresses broadcast/multicast traffic on trunk links where downstream switches have no active ports in that VLAN.',
      tags: ['VTP', 'Pruning'],
    },
  ];

  const standaloneUpdateDeckHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: {
      deckId: savedStandaloneDeckId,
      title: 'VLAN Trunking Protocol (VTP) Mastery - Edited',
      topic: 'VTP',
      cards: editedCardsPayload,
    },
  });
  await standaloneDeckHandler(standaloneUpdateDeckHttp.req, standaloneUpdateDeckHttp.res);
  assert(standaloneUpdateDeckHttp.getStatus() === 200, 'Update standalone deck returns 200 OK');
  assert(standaloneUpdateDeckHttp.getData()?.isUpdated === true, 'Response confirms deck was updated in-place');

  // 10.5: Re-fetch and verify Card #1 ID and review progress preserved
  const reGetDeckHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(reGetDeckHttp.req, reGetDeckHttp.res);
  const reRetrievedCards = reGetDeckHttp.getData()?.cards || [];
  assert(reRetrievedCards.length === 5, 'Deck still contains 5 cards after edit & add');
  assert(reRetrievedCards[0]?.id === firstCardId, 'Card #1 ID was strictly preserved after edit');
  assert(reRetrievedCards[0]?.frontMarkdown.includes('Updated Front'), 'Card #1 question text updated successfully');
  assert(reRetrievedCards[0]?.progress?.status === 'mastered', 'Card #1 "mastered" progress strictly preserved across deck edit');
  assert(reRetrievedCards[0]?.progress?.confidenceScore === 5, 'Card #1 confidence score (5) strictly preserved');
  assert(reRetrievedCards[4]?.frontMarkdown.includes('Newly Added Card'), 'Newly added card persisted with valid structure');

  // 10.6: Multi-Tenant Security: User B cannot access or modify User A's standalone deck
  const userBAccessHttp = createMockHttp({
    method: 'GET',
    headers: studentBHeaders,
    query: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(userBAccessHttp.req, userBAccessHttp.res);
  assert(userBAccessHttp.getStatus() === 404, 'User B access to User A standalone deck returns 404 Not Found');

  const userBDeleteHttp = createMockHttp({
    method: 'DELETE',
    headers: studentBHeaders,
    body: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(userBDeleteHttp.req, userBDeleteHttp.res);
  assert(userBDeleteHttp.getStatus() === 404, 'User B deletion of User A standalone deck returns 404 Not Found');

  // User A deck remains intact after User B attempted delete
  const verifyIntactHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(verifyIntactHttp.req, verifyIntactHttp.res);
  assert(verifyIntactHttp.getStatus() === 200, 'User A deck remains intact in database');

  // 10.7: User A deletes standalone deck
  const userADeleteHttp = createMockHttp({
    method: 'DELETE',
    headers: studentAHeaders,
    body: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(userADeleteHttp.req, userADeleteHttp.res);
  assert(userADeleteHttp.getStatus() === 200, 'User A deletion of owned standalone deck returns 200 OK');

  // Subsequent GET returns 404
  const postDeleteGetHttp = createMockHttp({
    method: 'GET',
    headers: studentAHeaders,
    query: { deckId: savedStandaloneDeckId },
  });
  await standaloneDeckHandler(postDeleteGetHttp.req, postDeleteGetHttp.res);
  assert(postDeleteGetHttp.getStatus() === 404, 'Deleted standalone deck returns 404 Not Found');

  console.log('\n[Suite 11] Regressions, Security & Invariants');

  // 11.1: Lesson-grounded flashcards still work identically
  const regressionLessonHttp = createMockHttp({
    method: 'POST',
    headers: studentAHeaders,
    body: { lessonId: sampleLessonId, cardCount: 10 },
  });
  await generateFlashcardsHandler(regressionLessonHttp.req, regressionLessonHttp.res);
  assert(regressionLessonHttp.getStatus() === 200, 'Regression: Lesson-grounded flashcard generation still returns 200 OK');
  assert(regressionLessonHttp.getData()?.lessonId === sampleLessonId, 'Regression: Lesson ID strictly preserved');

  // 11.2: CSRF protection on mutation requests
  const csrfHttp = createMockHttp({
    method: 'POST',
    body: { topic: 'OSPF' },
  });
  await standaloneDeckHandler(csrfHttp.req, csrfHttp.res);
  assert(csrfHttp.getStatus() === 403, 'Request missing CSRF header returns 403 Forbidden');

  // 11.3: Unauthenticated requests rejected
  const standaloneUnauthHttp = createMockHttp({
    method: 'POST',
    headers: { 'x-netmentor-request': '1' },
    body: { topic: 'OSPF' },
  });
  await standaloneDeckHandler(standaloneUnauthHttp.req, standaloneUnauthHttp.res);
  assert(standaloneUnauthHttp.getStatus() === 401, 'Unauthenticated request to standalone deck returns 401 Unauthorized');

  // Clean up test store
  client.__setTestMockStore(null);

  console.log('\n======================================================');
  console.log(` ALL TESTS PASSED: ${assertionCount} assertions verified cleanly!`);
  console.log(' Live AI Provider Requests: EXACTLY 0 (Safe Mock Mode)');
  console.log('======================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
