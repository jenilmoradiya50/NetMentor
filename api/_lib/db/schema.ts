import { pgTable, varchar, text, timestamp, integer, serial, index, unique } from 'drizzle-orm/pg-core';

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
