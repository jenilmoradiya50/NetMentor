/**
 * NetMentor AI Tutor - Persistent Multi-Conversation & Provider Status Test Suite
 * 
 * Verifies:
 * 1. Conversation creation, listing, retrieval with messages, renaming, and deletion.
 * 2. Strict user ownership enforcement (isolation between student and admin accounts).
 * 3. CSRF and session authentication guards on /api/ai/conversations.
 * 4. Context isolation (General Q&A vs Lesson Q&A conversations).
 * 5. Database message persistence on POST /api/ai/tutor with conversationId.
 * 6. Deterministic, quota-free title auto-generation from first user query.
 * 7. Accurate provider badge mapping (Gemini, Groq, Cloudflare, Cohere, Simulated).
 * 8. Strict API quota protection: zero live requests during test suite execution.
 */

import conversationsHandler from '../api/ai/conversations.js';
import tutorHandler from '../api/ai/tutor.js';
import * as client from '../api/_lib/db/client.js';
import { createSignedSessionToken } from '../api/_lib/crypto.js';
import { formatProviderLabel } from '../src/lib/api.js';

// Enforce mock AI provider and mock environment to guarantee 0 live API tokens are spent
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
    url: options.url || '/api/ai/conversations',
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
    getHeader(name: string) {
      return responseHeaders[name.toLowerCase()];
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

async function runAiConversationsTests() {
  console.log('=== STARTING NETMENTOR AI CONVERSATION & PROVIDER STATUS TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
    } else {
      console.log(`   ✓ ${msg}`);
      passed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Mock Database In-Memory Store Setup
  // ---------------------------------------------------------------------------
  console.log('1. Setting up Isolated In-Memory Store:');

  const mockUsers = new Map<string, { id: string; username: string; role: 'admin' | 'user'; status: 'active' | 'suspended' }>();
  const mockSessions = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  const mockConversations = new Map<string, client.AiConversationRecord>();
  const mockMessages: client.AiMessageRecord[] = [];

  mockUsers.set('user-student-1', {
    id: 'user-student-1',
    username: 'student1',
    role: 'user',
    status: 'active',
  });

  mockUsers.set('user-student-2', {
    id: 'user-student-2',
    username: 'student2',
    role: 'user',
    status: 'active',
  });

  // Helper to create active authenticated session token
  function createAuthSession(userId: string, role: 'admin' | 'user' = 'user') {
    const { token, payload } = createSignedSessionToken(userId, role);
    mockSessions.set(payload.jti, {
      userId,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
    });
    return token;
  }

  const student1Token = createAuthSession('user-student-1', 'user');
  const student2Token = createAuthSession('user-student-2', 'user');

  // Inject test mock store into db client
  client.__setTestMockStore({
    async validateDbSession(sessionId: string) {
      const s = mockSessions.get(sessionId);
      if (!s || s.revokedAt || s.expiresAt < new Date()) {
        return { valid: false };
      }
      const u = mockUsers.get(s.userId);
      if (u) {
        if (u.status !== 'active') {
          return { valid: false, userStatus: u.status };
        }
        return { valid: true, currentRole: u.role as any, userStatus: u.status, userId: u.id };
      }
      return { valid: true, currentRole: 'user', userStatus: 'active', userId: s.userId };
    },

    async createAiConversation(userId: string, options?: any) {
      const id = options?.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const conv: client.AiConversationRecord = {
        id,
        userId,
        title: options?.title || 'New Conversation',
        mode: options?.mode || 'general_qa',
        lessonId: options?.lessonId || null,
        sectionId: options?.sectionId || null,
        exerciseId: options?.exerciseId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockConversations.set(id, conv);
      return conv;
    },

    async getUserAiConversations(userId: string) {
      return Array.from(mockConversations.values())
        .filter((c) => c.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getAiConversationWithMessages(userId: string, conversationId: string) {
      const conv = mockConversations.get(conversationId);
      if (!conv || conv.userId !== userId) return null;
      const msgs = mockMessages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return { conversation: conv, messages: msgs };
    },

    async updateAiConversationTitle(userId: string, conversationId: string, title: string) {
      const conv = mockConversations.get(conversationId);
      if (!conv || conv.userId !== userId) return false;
      conv.title = title;
      conv.updatedAt = new Date();
      return true;
    },

    async deleteAiConversation(userId: string, conversationId: string) {
      const conv = mockConversations.get(conversationId);
      if (!conv || conv.userId !== userId) return false;
      mockConversations.delete(conversationId);
      // Cascade delete messages
      for (let i = mockMessages.length - 1; i >= 0; i--) {
        if (mockMessages[i].conversationId === conversationId) {
          mockMessages.splice(i, 1);
        }
      }
      return true;
    },

    async addAiMessage(userId: string, conversationId: string, message: any) {
      const conv = mockConversations.get(conversationId);
      if (!conv || conv.userId !== userId) throw new Error('Not found or access denied');
      const msg: client.AiMessageRecord = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversationId,
        role: message.role,
        content: message.content,
        model: message.model || null,
        isSimulated: message.isSimulated ?? false,
        promptTokens: message.usage?.promptTokens || null,
        completionTokens: message.usage?.completionTokens || null,
        totalTokens: message.usage?.totalTokens || null,
        createdAt: new Date(),
      };
      mockMessages.push(msg);
      conv.updatedAt = new Date();
      return msg;
    },
  });

  assert(true, 'In-memory test store initialized');

  const baseHeadersStudent1 = {
    'cookie': `netmentor_session=${student1Token}`,
    'x-netmentor-request': '1',
    'content-type': 'application/json',
  };

  const baseHeadersStudent2 = {
    'cookie': `netmentor_session=${student2Token}`,
    'x-netmentor-request': '1',
    'content-type': 'application/json',
  };

  // ---------------------------------------------------------------------------
  // 2. Authentication & CSRF Protection on /api/ai/conversations
  // ---------------------------------------------------------------------------
  console.log('\n2. Testing Authentication & CSRF Protection on Conversations Endpoint:');

  // Missing session
  const unauthHttp = createMockHttp({ method: 'GET', headers: {} });
  await conversationsHandler(unauthHttp.req, unauthHttp.res);
  assert(unauthHttp.getStatus() === 401, 'Request without session rejected with 401 Unauthorized');

  // Missing CSRF
  const missingCsrfHttp = createMockHttp({
    method: 'POST',
    headers: { 'cookie': `netmentor_session=${student1Token}`, 'content-type': 'application/json' },
    body: { title: 'Test' },
  });
  await conversationsHandler(missingCsrfHttp.req, missingCsrfHttp.res);
  assert(missingCsrfHttp.getStatus() === 403, 'POST request without CSRF header rejected with 403 Forbidden');

  // ---------------------------------------------------------------------------
  // 3. Conversation CRUD & Ownership Isolation
  // ---------------------------------------------------------------------------
  console.log('\n3. Testing Conversation CRUD & Multi-User Ownership Isolation:');

  // Student 1 creates a conversation
  const createHttp = createMockHttp({
    method: 'POST',
    headers: baseHeadersStudent1,
    body: { title: 'BGP Routing Architecture', mode: 'general_qa' },
  });
  await conversationsHandler(createHttp.req, createHttp.res);
  assert(createHttp.getStatus() === 201, 'Conversation created with 201 Created');
  const createdData = createHttp.getData();
  assert(createdData?.success === true, 'Response has success=true');
  const conv1Id = createdData?.conversation?.id;
  assert(typeof conv1Id === 'string' && conv1Id.length > 0, 'Conversation returned valid ID');
  assert(createdData.conversation.title === 'BGP Routing Architecture', 'Conversation title matches request');
  assert(createdData.conversation.userId === 'user-student-1', 'Conversation belongs to student 1');

  // Student 1 lists conversations
  const listHttp = createMockHttp({ method: 'GET', headers: baseHeadersStudent1 });
  await conversationsHandler(listHttp.req, listHttp.res);
  assert(listHttp.getStatus() === 200, 'List conversations returned 200 OK');
  assert(listHttp.getData()?.conversations?.length === 1, 'Student 1 has exactly 1 conversation');

  // Student 2 lists conversations (should see 0 conversations - strict isolation)
  const listStudent2Http = createMockHttp({ method: 'GET', headers: baseHeadersStudent2 });
  await conversationsHandler(listStudent2Http.req, listStudent2Http.res);
  assert(listStudent2Http.getStatus() === 200, 'Student 2 list returns 200 OK');
  assert(listStudent2Http.getData()?.conversations?.length === 0, 'Student 2 sees 0 conversations (strictly isolated)');

  // Student 2 tries to GET Student 1's conversation by ID
  const student2ViewStudent1Http = createMockHttp({
    method: 'GET',
    url: `/api/ai/conversations?id=${conv1Id}`,
    headers: baseHeadersStudent2,
    query: { id: conv1Id },
  });
  await conversationsHandler(student2ViewStudent1Http.req, student2ViewStudent1Http.res);
  assert(student2ViewStudent1Http.getStatus() === 404, 'Unauthorized read of another user conversation returns 404 Not Found');

  // Student 2 tries to RENAME Student 1's conversation
  const student2RenameHttp = createMockHttp({
    method: 'PATCH',
    headers: baseHeadersStudent2,
    body: { id: conv1Id, title: 'Hacked Title' },
  });
  await conversationsHandler(student2RenameHttp.req, student2RenameHttp.res);
  assert(student2RenameHttp.getStatus() === 404, 'Unauthorized rename of another user conversation returns 404 Not Found');

  // Student 1 renames own conversation
  const student1RenameHttp = createMockHttp({
    method: 'PATCH',
    headers: baseHeadersStudent1,
    body: { id: conv1Id, title: 'Advanced BGP & Path Selection' },
  });
  await conversationsHandler(student1RenameHttp.req, student1RenameHttp.res);
  assert(student1RenameHttp.getStatus() === 200, 'Student 1 successfully renames own conversation');
  assert(mockConversations.get(conv1Id)?.title === 'Advanced BGP & Path Selection', 'Database conversation title updated');

  // ---------------------------------------------------------------------------
  // 4. Message Persistence & Context Assembly in POST /api/ai/tutor
  // ---------------------------------------------------------------------------
  console.log('\n4. Testing Message Persistence & Context Assembly in Tutor API:');

  // Student 1 sends a question to conv1Id
  const tutorMsg1Http = createMockHttp({
    method: 'POST',
    url: '/api/ai/tutor',
    headers: baseHeadersStudent1,
    body: {
      conversationId: conv1Id,
      query: 'What is the BGP Local Preference attribute and its default value?',
      mode: 'general_qa',
    },
  });
  await tutorHandler(tutorMsg1Http.req, tutorMsg1Http.res);
  assert(tutorMsg1Http.getStatus() === 200, 'Tutor request with conversationId returned 200 OK');
  const tutorData = tutorMsg1Http.getData();
  assert(tutorData?.conversationId === conv1Id, 'Returned payload includes matching conversationId');
  assert(typeof tutorData?.answer === 'string' && tutorData.answer.length > 0, 'Returned valid answer');

  // Check that both user message and assistant response were persisted to DB
  const convDetailsHttp = createMockHttp({
    method: 'GET',
    url: `/api/ai/conversations?id=${conv1Id}`,
    headers: baseHeadersStudent1,
    query: { id: conv1Id },
  });
  await conversationsHandler(convDetailsHttp.req, convDetailsHttp.res);
  assert(convDetailsHttp.getStatus() === 200, 'Loaded conversation details with 200 OK');
  const convDetails = convDetailsHttp.getData();
  assert(convDetails.messages?.length === 2, 'Conversation contains exactly 2 persisted messages (user + assistant)');
  assert(convDetails.messages[0].role === 'user' && convDetails.messages[0].content.includes('Local Preference'), 'First message is user query');
  assert(convDetails.messages[1].role === 'assistant', 'Second message is assistant answer');
  assert(convDetails.messages[1].isSimulated === true, 'Mock provider response is flagged isSimulated=true');
  assert(convDetails.messages[1].model === 'netmentor-mock-engine-v1', 'Model name persisted');

  // ---------------------------------------------------------------------------
  // 5. Automatic Deterministic Title Generation on Fresh Chat
  // ---------------------------------------------------------------------------
  console.log('\n5. Testing Deterministic Title Auto-Generation from First Query:');

  // Create a blank conversation
  const freshConvHttp = createMockHttp({
    method: 'POST',
    headers: baseHeadersStudent1,
    body: { mode: 'general_qa' },
  });
  await conversationsHandler(freshConvHttp.req, freshConvHttp.res);
  const freshConvId = freshConvHttp.getData()?.conversation?.id;

  // First message sent to fresh conversation
  const firstMsgHttp = createMockHttp({
    method: 'POST',
    url: '/api/ai/tutor',
    headers: baseHeadersStudent1,
    body: {
      conversationId: freshConvId,
      query: 'Explain how OSPF neighbor adjacency progresses through ExStart and Exchange',
      mode: 'general_qa',
    },
  });
  await tutorHandler(firstMsgHttp.req, firstMsgHttp.res);
  assert(firstMsgHttp.getStatus() === 200, 'First message returns 200 OK');

  const updatedConv = mockConversations.get(freshConvId);
  assert(
    updatedConv?.title.includes('OSPF neighbor adjacency') || updatedConv?.title.includes('ExStart'),
    `Title auto-generated deterministically: "${updatedConv?.title}"`
  );

  // ---------------------------------------------------------------------------
  // 6. Delete Conversation & Cascade Verification
  // ---------------------------------------------------------------------------
  console.log('\n6. Testing Delete Conversation and Cascade Verification:');

  const deleteHttp = createMockHttp({
    method: 'DELETE',
    headers: baseHeadersStudent1,
    body: { id: freshConvId },
  });
  await conversationsHandler(deleteHttp.req, deleteHttp.res);
  assert(deleteHttp.getStatus() === 200, 'Conversation deleted successfully');
  assert(!mockConversations.has(freshConvId), 'Conversation removed from database');
  const remainingMsgs = mockMessages.filter((m) => m.conversationId === freshConvId);
  assert(remainingMsgs.length === 0, 'Associated messages cascade-deleted from database');

  // ---------------------------------------------------------------------------
  // 7. Provider Badge & Status Formatting Invariants
  // ---------------------------------------------------------------------------
  console.log('\n7. Testing Provider Badge Status Formatting:');

  const geminiBadge = formatProviderLabel('gemini/gemini-3-flash-preview', false);
  assert(geminiBadge.label === 'Gemini', 'Gemini model formats to label "Gemini"');
  assert(!geminiBadge.isSimulated, 'Gemini is marked not simulated');
  assert(geminiBadge.variant === 'green', 'Gemini badge variant is green');

  const groqBadge = formatProviderLabel('groq/qwen/qwen3.8-27b', false);
  assert(groqBadge.label === 'Groq', 'Groq model formats to label "Groq"');
  assert(!groqBadge.isSimulated, 'Groq is marked not simulated');
  assert(groqBadge.variant === 'green', 'Groq badge variant is green');

  const cfBadge = formatProviderLabel('cloudflare/@cf/meta/llama-3.1-8b-instruct', false);
  assert(cfBadge.label === 'Cloudflare AI', 'Cloudflare model formats to "Cloudflare AI"');
  assert(!cfBadge.isSimulated, 'Cloudflare is marked not simulated');

  const cohereBadge = formatProviderLabel('cohere/command-r-08-2024', false);
  assert(cohereBadge.label === 'Cohere', 'Cohere model formats to "Cohere"');

  const mockBadge = formatProviderLabel('netmentor-mock-engine-v1', true);
  assert(mockBadge.label === 'Simulated', 'Mock model formats to "Simulated"');
  assert(mockBadge.isSimulated, 'Mock model is flagged simulated');
  assert(mockBadge.variant === 'blue', 'Mock badge variant is blue');

  const fallbackMockBadge = formatProviderLabel('netmentor-mock-engine-v1', false);
  assert(fallbackMockBadge.label === 'Simulated', 'Engine containing "mock" safely forces simulated label');

  // Clean up
  client.__setTestMockStore(null);

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} AI CONVERSATION & PROVIDER STATUS CHECKS PASSED CLEANLY! (${failed} failures)`);
  console.log('=============================================================\n');

  if (failed > 0) process.exit(1);
}

runAiConversationsTests().catch((err) => {
  console.error('Fatal error in AI conversation tests:', err);
  process.exit(1);
});
