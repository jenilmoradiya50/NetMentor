import { pgTable, varchar, text, timestamp, integer, serial, index, unique, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * 0. users
 * Database-backed accounts for administrator and standard user authentication.
 */
export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    username: varchar('username', { length: 64 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).default('user').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    usernameIdx: index('users_username_idx').on(table.username),
    roleIdx: index('users_role_idx').on(table.role),
  }),
);

/**
 * 1. user_sessions
 * Tracks active and revoked session tokens.
 * The primary key `id` corresponds directly to the cryptographic token nonce (`jti`).
 */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('user_sessions_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * 2. login_rate_limits
 * Persistent brute-force protection tracking failed login attempts per client identifier (IP address).
 */
export const loginRateLimits = pgTable(
  'login_rate_limits',
  {
    id: serial('id').primaryKey(),
    identifier: varchar('identifier', { length: 128 }).notNull().unique(),
    failedAttempts: integer('failed_attempts').default(1).notNull(),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (table) => ({
    identifierIdx: index('login_rate_limits_identifier_idx').on(table.identifier),
  }),
);

/**
 * 3. learning_paths
 * High-level certification tracks (Fundamentals, CCNA, CCNP Enterprise).
 */
export const learningPaths = pgTable('learning_paths', {
  id: varchar('id', { length: 36 }).primaryKey(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  description: text('description').notNull(),
  targetCert: varchar('target_cert', { length: 32 }).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 4. topics
 * Modules/domains belonging to a learning path.
 */
export const topics = pgTable(
  'topics',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    pathId: varchar('path_id', { length: 36 })
      .notNull()
      .references(() => learningPaths.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 128 }).notNull(),
    description: text('description').notNull(),
    orderIndex: integer('order_index').default(0).notNull(),
    estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  },
  (table) => ({
    pathIdIdx: index('topics_path_id_idx').on(table.pathId),
  }),
);

/**
 * 5. lessons
 * Granular lessons within a topic.
 */
export const lessons = pgTable(
  'lessons',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    topicId: varchar('topic_id', { length: 36 })
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 128 }).notNull(),
    summary: text('summary').notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    orderIndex: integer('order_index').default(0).notNull(),
  },
  (table) => ({
    topicIdIdx: index('lessons_topic_id_idx').on(table.topicId),
  }),
);

/**
 * 6. external_references
 * Authority documentation (Cisco Docs, RFCs, Cert Guides).
 */
export const externalReferences = pgTable(
  'external_references',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    lessonId: varchar('lesson_id', { length: 36 }).references(() => lessons.id, { onDelete: 'cascade' }),
    topicId: varchar('topic_id', { length: 36 }).references(() => topics.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    url: text('url').notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull(),
    relevantSection: varchar('relevant_section', { length: 128 }),
    notes: text('notes'),
  },
  (table) => ({
    lessonIdIdx: index('external_references_lesson_id_idx').on(table.lessonId),
    topicIdIdx: index('external_references_topic_id_idx').on(table.topicId),
  }),
);

/**
 * 7. user_progress
 * Multi-user completion and review state per lesson.
 */
export const userProgress = pgTable(
  'user_progress',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: varchar('lesson_id', { length: 36 })
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    masteryLevel: varchar('mastery_level', { length: 20 }).default('not_started').notNull(),
    confidenceScore: integer('confidence_score').default(1).notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (table) => ({
    userIdIdx: index('user_progress_user_id_idx').on(table.userId),
    lessonIdIdx: index('user_progress_lesson_id_idx').on(table.lessonId),
    userLessonUnique: unique('user_progress_user_lesson_unique').on(table.userId, table.lessonId),
  }),
);

/**
 * 8. imported_decks
 * Imported flashcard collections (e.g. Jeremy's IT Lab CCNA Anki decks).
 * Isolated per-user with provenance tracking and duplicate import prevention.
 */
export const importedDecks = pgTable(
  'imported_decks',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('anki_apkg'),
    sourceName: varchar('source_name', { length: 255 }).notNull(),
    sourceHash: varchar('source_hash', { length: 64 }).notNull(),
    deckName: varchar('deck_name', { length: 128 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    cardCount: integer('card_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('imported_decks_user_id_idx').on(table.userId),
    userSourceHashUnique: unique('imported_decks_user_source_hash_unique').on(table.userId, table.sourceHash),
  }),
);

/**
 * 9. flashcards
 * Granular flashcard questions, answers, and metadata within an imported deck.
 */
export const flashcards = pgTable(
  'flashcards',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    deckId: varchar('deck_id', { length: 36 })
      .notNull()
      .references(() => importedDecks.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardType: varchar('card_type', { length: 32 }).notNull().default('basic'),
    frontMarkdown: text('front_markdown').notNull(),
    backMarkdown: text('back_markdown').notNull(),
    clozeData: text('cloze_data'),
    tags: text('tags'),
    sourceNoteId: varchar('source_note_id', { length: 64 }),
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    deckIdIdx: index('flashcards_deck_id_idx').on(table.deckId),
    userIdIdx: index('flashcards_user_id_idx').on(table.userId),
    deckCardOrderIdx: index('flashcards_deck_order_idx').on(table.deckId, table.orderIndex),
    deckNoteOrdUnique: unique('flashcards_deck_note_ord_unique').on(table.deckId, table.sourceNoteId, table.orderIndex),
  }),
);

/**
 * 10. flashcard_progress
 * Per-user learning state, review count, and mastery scores for each flashcard.
 */
export const flashcardProgress = pgTable(
  'flashcard_progress',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardId: varchar('card_id', { length: 36 })
      .notNull()
      .references(() => flashcards.id, { onDelete: 'cascade' }),
    deckId: varchar('deck_id', { length: 36 })
      .notNull()
      .references(() => importedDecks.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('new'),
    confidenceScore: integer('confidence_score').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCardUnique: unique('flashcard_progress_user_card_unique').on(table.userId, table.cardId),
    userDeckStatusIdx: index('flashcard_progress_user_deck_status_idx').on(table.userId, table.deckId, table.status),
    userNextReviewIdx: index('flashcard_progress_user_next_review_idx').on(table.userId, table.nextReviewAt),
  }),
);

/**
 * 11. ai_conversations
 * Multi-user persistent AI tutoring chat sessions.
 * Preserves independent conversation contexts across reloads.
 */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).default('New Conversation').notNull(),
    mode: varchar('mode', { length: 32 }).default('general_qa').notNull(),
    lessonId: varchar('lesson_id', { length: 64 }),
    sectionId: varchar('section_id', { length: 64 }),
    exerciseId: varchar('exercise_id', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('ai_conversations_user_id_idx').on(table.userId),
    userUpdatedIdx: index('ai_conversations_user_updated_idx').on(table.userId, table.updatedAt),
  }),
);

/**
 * 12. ai_messages
 * Persistent conversation turns belonging to an ai_conversation.
 * Tracks content, role, model metadata, token usage, and simulated status.
 */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    conversationId: varchar('conversation_id', { length: 36 })
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 64 }),
    isSimulated: boolean('is_simulated').default(false).notNull(),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index('ai_messages_conv_id_idx').on(table.conversationId),
    convCreatedIdx: index('ai_messages_conv_created_idx').on(table.conversationId, table.createdAt),
  }),
);

/**
 * 13. user_generated_lessons
 * User-created, AI-generated custom networking lessons stored in the user's
 * Personal Learning Library.
 * 
 * Strictly separated from the official curriculum (no foreign keys to learning_paths,
 * topics, or official lessons).
 * conversationId has onDelete: 'set null' so deleting chat history preserves saved lessons.
 */
export const userGeneratedLessons = pgTable(
  'user_generated_lessons',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    conversationId: varchar('conversation_id', { length: 36 })
      .references(() => aiConversations.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }).notNull(),
    description: text('description').notNull(),
    difficulty: varchar('difficulty', { length: 32 }).default('intermediate').notNull(),
    estimatedMinutes: integer('estimated_minutes').default(20).notNull(),
    tags: text('tags').default('[]').notNull(),
    prerequisites: text('prerequisites').default('[]').notNull(),
    learningObjectives: text('learning_objectives').default('[]').notNull(),
    contentJson: text('content_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_gen_lessons_user_id_idx').on(table.userId),
    userUpdatedIdx: index('user_gen_lessons_user_updated_idx').on(table.userId, table.updatedAt),
  }),
);

/**
 * 14. user_quizzes
 * User-created or lesson-linked AI quizzes.
 * Full question definitions (including server-side answer keys) are stored in questions_json.
 */
export const userQuizzes = pgTable(
  'user_quizzes',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: varchar('lesson_id', { length: 36 })
      .references(() => userGeneratedLessons.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }).notNull(),
    difficulty: varchar('difficulty', { length: 32 }).default('medium').notNull(),
    questionCount: integer('question_count').notNull(),
    questionTypes: text('question_types').notNull().default('["single_choice"]'),
    questionsJson: text('questions_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('user_quizzes_user_id_idx').on(table.userId),
    lessonIdIdx: index('user_quizzes_lesson_id_idx').on(table.lessonId),
    userUpdatedIdx: index('user_quizzes_user_updated_idx').on(table.userId, table.updatedAt),
  }),
);

/**
 * 15. quiz_attempts
 * Graded assessment attempts for a quiz.
 * Stores user answers, earned score, percentage, and itemized results.
 */
export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    quizId: varchar('quiz_id', { length: 36 })
      .notNull()
      .references(() => userQuizzes.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    percentage: integer('percentage').notNull(),
    timeTakenSeconds: integer('time_taken_seconds'),
    answersJson: text('answers_json').notNull(),
    resultsJson: text('results_json').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    quizIdIdx: index('quiz_attempts_quiz_id_idx').on(table.quizId),
    userIdIdx: index('quiz_attempts_user_id_idx').on(table.userId),
    userCompletedIdx: index('quiz_attempts_user_completed_idx').on(table.userId, table.completedAt),
  }),
);

/**
 * 16. generation_tasks
 * Persistent, bounded background AI generation jobs.
 * Supports asynchronous generation of lessons, quizzes, and flashcards
 * without locking users inside blocking frontend modals.
 */
export const generationTasks = pgTable(
  'generation_tasks',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskType: varchar('task_type', { length: 32 }).notNull(), // 'lesson' | 'quiz' | 'flashcards'
    status: varchar('status', { length: 20 }).default('queued').notNull(), // 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
    currentStage: varchar('current_stage', { length: 32 }).default('queued').notNull(), // 'queued' | 'prompting_ai' | 'validating_schema' | 'persisting'
    title: varchar('title', { length: 255 }).notNull(),
    topic: varchar('topic', { length: 255 }).notNull(),
    difficulty: varchar('difficulty', { length: 32 }).default('intermediate').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 64 }).notNull(),
    inputParamsJson: text('input_params_json').notNull(),
    resultDataJson: text('result_data_json'),
    persistedEntityId: varchar('persisted_entity_id', { length: 36 }),
    errorMessage: text('error_message'),
    errorCategory: varchar('error_category', { length: 64 }),
    isRetryable: boolean('is_retryable').default(true).notNull(),
    executionDeadlineAt: timestamp('execution_deadline_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index('generation_tasks_user_id_idx').on(table.userId),
    userStatusIdx: index('generation_tasks_user_status_idx').on(table.userId, table.status),
    createdIdx: index('generation_tasks_created_idx').on(table.createdAt),
    activeDeadlineIdx: index('generation_tasks_active_deadline_idx').on(table.status, table.executionDeadlineAt),
    userActiveIdempotencyIdx: uniqueIndex('generation_tasks_active_idempotency_idx')
      .on(table.userId, table.idempotencyKey)
      .where(sql`status IN ('queued', 'processing')`),
  }),
);



