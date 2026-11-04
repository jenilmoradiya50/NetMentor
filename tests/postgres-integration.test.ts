/**
 * NetMentor PostgreSQL Catalog Integration Test Suite (Version 4.1)
 * Executes Section 3, Section 4, and Section 5 against actual PostgreSQL 18.6 engine (PGlite)
 * Tests all required database scenarios:
 * 1. Clean database with core tables and no downstream tables.
 * 2. Database with all expected downstream tables already present (17 indexes reconciled).
 * 3. Divergent downstream column.
 * 4. Wrong journal sequence/default.
 * 5. Out-of-sync journal sequence and 3-argument setval() remediation.
 * 6. Relation-kind collision & unlisted relation kinds in public.
 * 7. Foreign-key identity loophole: duplicate relationships & constraint name spoofing across tables.
 */

import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const drizzleDir = path.resolve(__dirname, '../drizzle');
const sql0000 = fs.readFileSync(path.join(drizzleDir, '0000_organic_white_tiger.sql'), 'utf-8');
const sql0001 = fs.readFileSync(path.join(drizzleDir, '0001_acoustic_captain_cross.sql'), 'utf-8');
const sql0002 = fs.readFileSync(path.join(drizzleDir, '0002_persistent_ai_conversations.sql'), 'utf-8');
const sql0003 = fs.readFileSync(path.join(drizzleDir, '0003_user_generated_lessons.sql'), 'utf-8');
const sql0004 = fs.readFileSync(path.join(drizzleDir, '0004_user_quizzes.sql'), 'utf-8');
const sql0005 = fs.readFileSync(path.join(drizzleDir, '0005_generation_tasks.sql'), 'utf-8');

async function executeMigration(db: PGlite, sqlContent: string) {
  const statements = sqlContent.split('--> statement-breakpoint');
  for (const rawStmt of statements) {
    const stmt = rawStmt.trim();
    if (stmt.length > 0) {
      await db.exec(stmt);
    }
  }
}

export async function runIntegrationTests() {
  console.log('============================================================');
  console.log('NETMENTOR POSTGRESQL INTEGRATION TEST SUITE (VERSION 4.1)');
  console.log('============================================================\n');

  const versionDb = new PGlite();
  const vRes = await versionDb.query<{ version: string }>('SELECT version();');
  console.log(`Running on: ${vRes.rows[0].version}\n`);
  await versionDb.close();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  // --- Canonical Version 4.1 SQL Queries ---
  const section3Query = `
WITH 
expected_tables (table_name) AS (
  VALUES 
    ('users'), ('learning_paths'), ('topics'), ('lessons'), ('external_references'),
    ('user_progress'), ('user_sessions'), ('login_rate_limits'),
    ('imported_decks'), ('flashcards'), ('flashcard_progress')
),
expected_columns (table_name, column_name, data_type, char_len, is_nullable, col_default) AS (
  VALUES
    ('users', 'id', 'character varying', 36, 'NO', NULL),
    ('users', 'username', 'character varying', 64, 'NO', NULL),
    ('users', 'password_hash', 'text', NULL, 'NO', NULL),
    ('users', 'role', 'character varying', 20, 'NO', '''user''::character varying'),
    ('users', 'status', 'character varying', 20, 'NO', '''active''::character varying'),
    ('users', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('users', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('users', 'last_login_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('learning_paths', 'id', 'character varying', 36, 'NO', NULL),
    ('learning_paths', 'slug', 'character varying', 64, 'NO', NULL),
    ('learning_paths', 'title', 'character varying', 128, 'NO', NULL),
    ('learning_paths', 'description', 'text', NULL, 'NO', NULL),
    ('learning_paths', 'target_cert', 'character varying', 32, 'NO', NULL),
    ('learning_paths', 'order_index', 'integer', NULL, 'NO', '0'),
    ('learning_paths', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('topics', 'id', 'character varying', 36, 'NO', NULL),
    ('topics', 'path_id', 'character varying', 36, 'NO', NULL),
    ('topics', 'slug', 'character varying', 64, 'NO', NULL),
    ('topics', 'title', 'character varying', 128, 'NO', NULL),
    ('topics', 'description', 'text', NULL, 'NO', NULL),
    ('topics', 'order_index', 'integer', NULL, 'NO', '0'),
    ('topics', 'estimated_minutes', 'integer', NULL, 'NO', '15'),
    ('lessons', 'id', 'character varying', 36, 'NO', NULL),
    ('lessons', 'topic_id', 'character varying', 36, 'NO', NULL),
    ('lessons', 'slug', 'character varying', 64, 'NO', NULL),
    ('lessons', 'title', 'character varying', 128, 'NO', NULL),
    ('lessons', 'summary', 'text', NULL, 'NO', NULL),
    ('lessons', 'content_markdown', 'text', NULL, 'NO', NULL),
    ('lessons', 'order_index', 'integer', NULL, 'NO', '0'),
    ('external_references', 'id', 'character varying', 36, 'NO', NULL),
    ('external_references', 'lesson_id', 'character varying', 36, 'YES', NULL),
    ('external_references', 'topic_id', 'character varying', 36, 'YES', NULL),
    ('external_references', 'title', 'character varying', 255, 'NO', NULL),
    ('external_references', 'url', 'text', NULL, 'NO', NULL),
    ('external_references', 'source_type', 'character varying', 32, 'NO', NULL),
    ('external_references', 'relevant_section', 'character varying', 128, 'YES', NULL),
    ('external_references', 'notes', 'text', NULL, 'YES', NULL),
    ('user_progress', 'id', 'character varying', 36, 'NO', NULL),
    ('user_progress', 'user_id', 'character varying', 36, 'NO', NULL),
    ('user_progress', 'lesson_id', 'character varying', 36, 'NO', NULL),
    ('user_progress', 'mastery_level', 'character varying', 20, 'NO', '''not_started''::character varying'),
    ('user_progress', 'confidence_score', 'integer', NULL, 'NO', '1'),
    ('user_progress', 'last_reviewed_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('user_progress', 'next_review_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('user_progress', 'notes', 'text', NULL, 'YES', NULL),
    ('user_sessions', 'id', 'character varying', 64, 'NO', NULL),
    ('user_sessions', 'user_id', 'character varying', 64, 'NO', NULL),
    ('user_sessions', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('user_sessions', 'expires_at', 'timestamp with time zone', NULL, 'NO', NULL),
    ('user_sessions', 'revoked_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('user_sessions', 'user_agent', 'text', NULL, 'YES', NULL),
    ('user_sessions', 'ip_address', 'character varying', 45, 'YES', NULL),
    ('login_rate_limits', 'id', 'integer', NULL, 'NO', 'nextval(''login_rate_limits_id_seq''::regclass)'),
    ('login_rate_limits', 'identifier', 'character varying', 128, 'NO', NULL),
    ('login_rate_limits', 'failed_attempts', 'integer', NULL, 'NO', '1'),
    ('login_rate_limits', 'last_attempt_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('login_rate_limits', 'locked_until', 'timestamp with time zone', NULL, 'YES', NULL),
    ('imported_decks', 'id', 'character varying', 36, 'NO', NULL),
    ('imported_decks', 'user_id', 'character varying', 36, 'NO', NULL),
    ('imported_decks', 'source_type', 'character varying', 32, 'NO', '''anki_apkg''::character varying'),
    ('imported_decks', 'source_name', 'character varying', 255, 'NO', NULL),
    ('imported_decks', 'source_hash', 'character varying', 64, 'NO', NULL),
    ('imported_decks', 'deck_name', 'character varying', 128, 'NO', NULL),
    ('imported_decks', 'title', 'character varying', 255, 'NO', NULL),
    ('imported_decks', 'description', 'text', NULL, 'YES', NULL),
    ('imported_decks', 'card_count', 'integer', NULL, 'NO', '0'),
    ('imported_decks', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('imported_decks', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('flashcards', 'id', 'character varying', 36, 'NO', NULL),
    ('flashcards', 'deck_id', 'character varying', 36, 'NO', NULL),
    ('flashcards', 'user_id', 'character varying', 36, 'NO', NULL),
    ('flashcards', 'card_type', 'character varying', 32, 'NO', '''basic''::character varying'),
    ('flashcards', 'front_markdown', 'text', NULL, 'NO', NULL),
    ('flashcards', 'back_markdown', 'text', NULL, 'NO', NULL),
    ('flashcards', 'cloze_data', 'text', NULL, 'YES', NULL),
    ('flashcards', 'tags', 'text', NULL, 'YES', NULL),
    ('flashcards', 'source_note_id', 'character varying', 64, 'YES', NULL),
    ('flashcards', 'order_index', 'integer', NULL, 'NO', '0'),
    ('flashcards', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('flashcard_progress', 'id', 'character varying', 36, 'NO', NULL),
    ('flashcard_progress', 'user_id', 'character varying', 36, 'NO', NULL),
    ('flashcard_progress', 'card_id', 'character varying', 36, 'NO', NULL),
    ('flashcard_progress', 'deck_id', 'character varying', 36, 'NO', NULL),
    ('flashcard_progress', 'status', 'character varying', 20, 'NO', '''new''::character varying'),
    ('flashcard_progress', 'confidence_score', 'integer', NULL, 'NO', '0'),
    ('flashcard_progress', 'review_count', 'integer', NULL, 'NO', '0'),
    ('flashcard_progress', 'last_reviewed_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('flashcard_progress', 'next_review_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('flashcard_progress', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('flashcard_progress', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()')
),
expected_fks (table_name, constraint_name, col_name, f_schema_name, f_table_name, f_col_name, del_rule, upd_rule) AS (
  VALUES
    ('external_references', 'external_references_lesson_id_lessons_id_fk', 'lesson_id', 'public', 'lessons', 'id', 'c', 'a'),
    ('external_references', 'external_references_topic_id_topics_id_fk', 'topic_id', 'public', 'topics', 'id', 'c', 'a'),
    ('lessons', 'lessons_topic_id_topics_id_fk', 'topic_id', 'public', 'topics', 'id', 'c', 'a'),
    ('topics', 'topics_path_id_learning_paths_id_fk', 'path_id', 'public', 'learning_paths', 'id', 'c', 'a'),
    ('user_progress', 'user_progress_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('user_progress', 'user_progress_lesson_id_lessons_id_fk', 'lesson_id', 'public', 'lessons', 'id', 'c', 'a'),
    ('flashcard_progress', 'flashcard_progress_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('flashcard_progress', 'flashcard_progress_card_id_flashcards_id_fk', 'card_id', 'public', 'flashcards', 'id', 'c', 'a'),
    ('flashcard_progress', 'flashcard_progress_deck_id_imported_decks_id_fk', 'deck_id', 'public', 'imported_decks', 'id', 'c', 'a'),
    ('flashcards', 'flashcards_deck_id_imported_decks_id_fk', 'deck_id', 'public', 'imported_decks', 'id', 'c', 'a'),
    ('flashcards', 'flashcards_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('imported_decks', 'imported_decks_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a')
),
expected_uniques (table_name, constraint_name, col_list) AS (
  VALUES
    ('users', 'users_username_unique', 'username'),
    ('learning_paths', 'learning_paths_slug_unique', 'slug'),
    ('login_rate_limits', 'login_rate_limits_identifier_unique', 'identifier'),
    ('user_progress', 'user_progress_user_lesson_unique', 'user_id,lesson_id'),
    ('imported_decks', 'imported_decks_user_source_hash_unique', 'user_id,source_hash'),
    ('flashcards', 'flashcards_deck_note_ord_unique', 'deck_id,source_note_id,order_index'),
    ('flashcard_progress', 'flashcard_progress_user_card_unique', 'user_id,card_id')
),
expected_indexes (idx_name, tbl_name, col_list, is_unique) AS (
  VALUES
    ('external_references_lesson_id_idx', 'external_references', 'lesson_id', false),
    ('external_references_topic_id_idx', 'external_references', 'topic_id', false),
    ('lessons_topic_id_idx', 'lessons', 'topic_id', false),
    ('login_rate_limits_identifier_idx', 'login_rate_limits', 'identifier', false),
    ('topics_path_id_idx', 'topics', 'path_id', false),
    ('user_progress_user_id_idx', 'user_progress', 'user_id', false),
    ('user_progress_lesson_id_idx', 'user_progress', 'lesson_id', false),
    ('user_sessions_user_id_idx', 'user_sessions', 'user_id', false),
    ('user_sessions_expires_at_idx', 'user_sessions', 'expires_at', false),
    ('users_username_idx', 'users', 'username', false),
    ('users_role_idx', 'users', 'role', false),
    ('flashcard_progress_user_deck_status_idx', 'flashcard_progress', 'user_id,deck_id,status', false),
    ('flashcard_progress_user_next_review_idx', 'flashcard_progress', 'user_id,next_review_at', false),
    ('flashcards_deck_id_idx', 'flashcards', 'deck_id', false),
    ('flashcards_user_id_idx', 'flashcards', 'user_id', false),
    ('flashcards_deck_order_idx', 'flashcards', 'deck_id,order_index', false),
    ('imported_decks_user_id_idx', 'imported_decks', 'user_id', false)
)

-- 1. Table Existence Check
SELECT 
  'TABLE' AS check_category,
  'public.' || e.table_name AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'FAIL'
    WHEN c.relkind != 'r' THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'MISSING table: relation not found in public schema'
    WHEN c.relkind = 'v' THEN 'RELATION KIND COLLISION: Object is a VIEW, expected ordinary table (r)'
    WHEN c.relkind = 'm' THEN 'RELATION KIND COLLISION: Object is a MATERIALIZED VIEW, expected ordinary table (r)'
    WHEN c.relkind = 'p' THEN 'RELATION KIND COLLISION: Object is a PARTITIONED TABLE, expected ordinary table (r)'
    WHEN c.relkind = 'f' THEN 'RELATION KIND COLLISION: Object is a FOREIGN TABLE, expected ordinary table (r)'
    WHEN c.relkind != 'r' THEN 'RELATION KIND COLLISION: Unexpected relation kind: ' || c.relkind::text
    ELSE 'Ordinary table (r) exists in public schema'
  END AS discrepancy_details
FROM expected_tables e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
) ON c.relname = e.table_name

UNION ALL

-- 2. Unexpected Relations in 'public' Schema (Genuinely Exhaustive Relation-Kind Classification)
SELECT
  'UNEXPECTED_RELATION' AS check_category,
  'public.' || c.relname AS object_name,
  'FAIL' AS status,
  CASE 
    WHEN c.relname = '__drizzle_migrations' 
      THEN 'CRITICAL DIVERGENCE: __drizzle_migrations exists in public schema! Drizzle ORM 0.45.4 expects schema "drizzle".'
    ELSE 'Unexpected public ' || 
      CASE c.relkind
        WHEN 'r' THEN 'ordinary table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'f' THEN 'foreign table'
        WHEN 'S' THEN 'sequence'
        WHEN 'i' THEN 'index'
        WHEN 'I' THEN 'partitioned index'
        WHEN 'c' THEN 'composite type'
        WHEN 't' THEN 'TOAST table'
        ELSE 'relation (unknown relkind=' || c.relkind::text || ')'
      END || ': public.' || c.relname
  END AS discrepancy_details
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE 
  -- Do NOT filter relkind with an allowlist; inspect all relations and fail closed on unexpected ones
  NOT (c.relname IN (SELECT table_name FROM expected_tables) AND c.relkind = 'r')
  AND NOT (c.relname IN ('ai_conversations', 'ai_messages', 'user_generated_lessons', 'user_quizzes', 'quiz_attempts', 'generation_tasks') AND c.relkind = 'r')
  AND NOT (c.relname = 'login_rate_limits_id_seq' AND c.relkind = 'S')
  AND NOT (
    c.relkind IN ('i', 'I') 
    AND EXISTS (
      SELECT 1 FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace tn ON tn.oid = t.relnamespace AND tn.nspname = 'public'
      WHERE ix.indexrelid = c.oid
        AND (
          t.relname IN (SELECT table_name FROM expected_tables)
          OR t.relname IN ('ai_conversations', 'ai_messages', 'user_generated_lessons', 'user_quizzes', 'quiz_attempts', 'generation_tasks')
        )
    )
  )
  AND NOT (
    c.relkind = 'c'
    AND EXISTS (
      SELECT 1 FROM pg_class parent
      JOIN pg_namespace pn ON pn.oid = parent.relnamespace AND pn.nspname = 'public'
      WHERE parent.relname = c.relname AND parent.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND (
          parent.relname IN (SELECT table_name FROM expected_tables)
          OR parent.relname IN ('ai_conversations', 'ai_messages', 'user_generated_lessons', 'user_quizzes', 'quiz_attempts', 'generation_tasks')
        )
    )
  )

UNION ALL

-- 3. Column Data Type, Character Length, and Nullability (90 columns)
SELECT 
  'COLUMN' AS check_category,
  e.table_name || '.' || e.column_name AS object_name,
  CASE 
    WHEN a.attname IS NULL THEN 'FAIL'
    WHEN format_type(a.atttypid, a.atttypmod) != 
         CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END THEN 'FAIL'
    WHEN (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END) != e.is_nullable THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN a.attname IS NULL THEN 'MISSING column in public.' || e.table_name
    WHEN format_type(a.atttypid, a.atttypmod) != 
         CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END 
      THEN 'TYPE/LENGTH MISMATCH: expected ' || 
           CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END || 
           ', found ' || format_type(a.atttypid, a.atttypmod)
    WHEN (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END) != e.is_nullable 
      THEN 'NULLABILITY MISMATCH: expected ' || e.is_nullable || ', found ' || (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END)
    ELSE 'Column definition matches catalog'
  END AS discrepancy_details
FROM expected_columns e
JOIN pg_class c ON c.relname = e.table_name AND c.relkind = 'r'
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = e.column_name AND a.attnum > 0 AND NOT a.attisdropped

UNION ALL

-- 4. Column Defaults
SELECT
  'COLUMN_DEFAULT' AS check_category,
  e.table_name || '.' || e.column_name AS object_name,
  CASE
    WHEN a.attname IS NULL THEN 'FAIL'
    WHEN e.col_default IS NULL AND ad.adbin IS NULL THEN 'PASS'
    WHEN e.col_default IS NULL AND ad.adbin IS NOT NULL THEN 'FAIL'
    WHEN e.col_default IS NOT NULL AND ad.adbin IS NULL THEN 'FAIL'
    WHEN pg_get_expr(ad.adbin, ad.adrelid) = e.col_default THEN 'PASS'
    WHEN e.col_default = '0' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('0', '0::integer') THEN 'PASS'
    WHEN e.col_default = '1' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('1', '1::integer') THEN 'PASS'
    WHEN e.col_default = '15' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('15', '15::integer') THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  CASE
    WHEN a.attname IS NULL THEN 'MISSING column in public.' || e.table_name
    WHEN e.col_default IS NULL AND ad.adbin IS NOT NULL 
      THEN 'UNEXPECTED DEFAULT: column has default ' || pg_get_expr(ad.adbin, ad.adrelid) || ' but expected NULL'
    WHEN e.col_default IS NOT NULL AND ad.adbin IS NULL 
      THEN 'MISSING DEFAULT: expected ' || e.col_default || ' but column has no default'
    WHEN NOT (
      pg_get_expr(ad.adbin, ad.adrelid) = e.col_default OR 
      (e.col_default = '0' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('0', '0::integer')) OR
      (e.col_default = '1' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('1', '1::integer')) OR
      (e.col_default = '15' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('15', '15::integer'))
    ) THEN 'DEFAULT MISMATCH: expected ' || e.col_default || ', found ' || pg_get_expr(ad.adbin, ad.adrelid)
    ELSE 'Default expression verified'
  END AS discrepancy_details
FROM expected_columns e
JOIN pg_class c ON c.relname = e.table_name AND c.relkind = 'r'
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = e.column_name AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum

UNION ALL

-- 5. Unexpected Columns Check
SELECT
  'UNEXPECTED_COLUMN' AS check_category,
  c.relname || '.' || a.attname AS object_name,
  'FAIL' AS status,
  'Unexpected column detected in public.' || c.relname || ': ' || a.attname AS discrepancy_details
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relname IN (SELECT table_name FROM expected_tables)
  AND NOT EXISTS (
    SELECT 1 FROM expected_columns ec 
    WHERE ec.table_name = c.relname AND ec.column_name = a.attname
  )

UNION ALL

-- 6. Exact Primary Key Constraints
SELECT
  'PRIMARY_KEY' AS check_category,
  e.table_name || ' (PK)' AS object_name,
  CASE WHEN pk.col_list = 'id' THEN 'PASS' ELSE 'FAIL' END AS status,
  CASE 
    WHEN pk.col_list IS NULL THEN 'MISSING Primary Key on public.' || e.table_name
    WHEN pk.col_list != 'id' THEN 'INVALID PRIMARY KEY: expected exactly (id), found (' || pk.col_list || ')'
    ELSE 'Primary key on column id verified'
  END AS discrepancy_details
FROM expected_tables e
LEFT JOIN (
  SELECT 
    c.relname AS table_name,
    string_agg(a.attname, ',' ORDER BY array_position(con.conkey, a.attnum)) AS col_list
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'p'
  GROUP BY c.relname
) pk ON pk.table_name = e.table_name

UNION ALL

-- 7. Exact Unique Constraints Check
SELECT
  'UNIQUE_CONSTRAINT' AS check_category,
  u.table_name || ' (' || u.col_list || ')' AS object_name,
  CASE WHEN act.col_list = u.col_list THEN 'PASS' ELSE 'FAIL' END AS status,
  CASE 
    WHEN act.col_list IS NULL THEN 'MISSING unique constraint: ' || u.constraint_name || ' on (' || u.col_list || ')'
    WHEN act.col_list != u.col_list THEN 'COLUMNS MISMATCH: expected (' || u.col_list || '), found (' || act.col_list || ')'
    ELSE 'Unique constraint verified'
  END AS discrepancy_details
FROM expected_uniques u
LEFT JOIN (
  SELECT 
    c.relname AS table_name,
    con.conname AS constraint_name,
    string_agg(a.attname, ',' ORDER BY array_position(con.conkey, a.attnum)) AS col_list
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'u'
  GROUP BY c.relname, con.conname
) act ON act.table_name = u.table_name AND act.col_list = u.col_list

UNION ALL

-- 8. Unexpected Unique Constraints Check
SELECT
  'UNEXPECTED_UNIQUE_CONSTRAINT' AS check_category,
  c.relname || ' (' || con.conname || ')' AS object_name,
  'FAIL' AS status,
  'Unexpected unique constraint found on public.' || c.relname || ': ' || con.conname AS discrepancy_details
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE con.contype = 'u'
  AND c.relname IN (SELECT table_name FROM expected_tables)
  AND NOT EXISTS (
    SELECT 1 FROM expected_uniques eu 
    WHERE eu.table_name = c.relname AND eu.constraint_name = con.conname
  )

UNION ALL

-- 9. Foreign Key Integrity Check (Exact 1:1 match by constraint name, table, columns, and properties)
SELECT
  'FOREIGN_KEY' AS check_category,
  e.table_name || '.' || e.constraint_name AS object_name,
  CASE 
    WHEN fk.exact_name_matches = 0 THEN 'FAIL'
    WHEN fk.perfect_matches != 1 THEN 'FAIL'
    WHEN fk.duplicate_rel_matches > 0 THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN fk.exact_name_matches = 0 THEN 'MISSING constraint ' || e.constraint_name || ' on public.' || e.table_name
    WHEN fk.duplicate_rel_matches > 0 THEN 'DUPLICATE RELATIONSHIP: Found ' || (1 + fk.duplicate_rel_matches) || ' constraints for this relationship on ' || e.table_name || ': ' || fk.constraint_details
    WHEN fk.perfect_matches != 1 THEN 'FK PROPERTY MISMATCH on ' || e.constraint_name || ': ' || fk.constraint_details
    ELSE 'Exact constraint verified (' || fk.constraint_details || ')'
  END AS discrepancy_details
FROM expected_fks e
LEFT JOIN LATERAL (
  SELECT 
    count(*) AS exact_name_matches,
    count(*) FILTER (
      WHERE con.conname = e.constraint_name
        AND cols.src_cols = e.col_name
        AND ref_n.nspname = e.f_schema_name
        AND ref_c.relname = e.f_table_name
        AND cols.ref_cols = e.f_col_name
        AND con.confdeltype = e.del_rule
        AND con.confupdtype = e.upd_rule
        AND con.convalidated = true
        AND con.condeferrable = false
        AND con.condeferred = false
        AND con.confmatchtype = 's'
    ) AS perfect_matches,
    count(*) FILTER (
      WHERE cols.src_cols = e.col_name
        AND ref_n.nspname = e.f_schema_name
        AND ref_c.relname = e.f_table_name
        AND cols.ref_cols = e.f_col_name
        AND con.conname != e.constraint_name
    ) AS duplicate_rel_matches,
    string_agg(
      con.conname || ' [src=' || src_c.relname || '.' || cols.src_cols || 
      ' -> ' || ref_n.nspname || '.' || ref_c.relname || '.' || cols.ref_cols || 
      ', del=' || con.confdeltype::text || ', upd=' || con.confupdtype::text || 
      ', val=' || con.convalidated::text || ', def=' || con.condeferrable::text || 
      ', deferred=' || con.condeferred::text || ', match=' || con.confmatchtype::text || ']',
      '; '
    ) AS constraint_details
  FROM pg_constraint con
  JOIN pg_class src_c ON src_c.oid = con.conrelid
  JOIN pg_namespace src_n ON src_n.oid = src_c.relnamespace AND src_n.nspname = 'public'
  JOIN pg_class ref_c ON ref_c.oid = con.confrelid
  JOIN pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
  JOIN LATERAL (
    SELECT 
      string_agg(src_a.attname, ',' ORDER BY array_position(con.conkey, src_a.attnum)) AS src_cols,
      string_agg(ref_a.attname, ',' ORDER BY array_position(con.confkey, ref_a.attnum)) AS ref_cols
    FROM pg_attribute src_a, pg_attribute ref_a
    WHERE src_a.attrelid = src_c.oid AND src_a.attnum = ANY(con.conkey)
      AND ref_a.attrelid = ref_c.oid AND ref_a.attnum = ANY(con.confkey)
  ) cols ON true
  WHERE con.contype = 'f'
    AND src_c.relname = e.table_name
    AND (
      con.conname = e.constraint_name
      OR (cols.src_cols = e.col_name AND ref_n.nspname = e.f_schema_name AND ref_c.relname = e.f_table_name AND cols.ref_cols = e.f_col_name)
    )
) fk ON true

UNION ALL

-- 10. Unexpected Foreign Keys Check (Composite key table_name + constraint_name; closes name-spoofing loophole)
SELECT
  'UNEXPECTED_FOREIGN_KEY' AS check_category,
  src_c.relname || '.' || con.conname AS object_name,
  'FAIL' AS status,
  'Unexpected foreign key on public.' || src_c.relname || ': ' || con.conname || 
  ' (' || fk_cols.src_cols || ' -> ' || ref_n.nspname || '.' || ref_c.relname || '.' || fk_cols.ref_cols || ')' AS discrepancy_details
FROM pg_constraint con
JOIN pg_class src_c ON src_c.oid = con.conrelid
JOIN pg_class ref_c ON ref_c.oid = con.confrelid
JOIN pg_namespace src_n ON src_n.oid = src_c.relnamespace AND src_n.nspname = 'public'
JOIN pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
JOIN LATERAL (
  SELECT 
    string_agg(src_a.attname, ',' ORDER BY array_position(con.conkey, src_a.attnum)) AS src_cols,
    string_agg(ref_a.attname, ',' ORDER BY array_position(con.confkey, ref_a.attnum)) AS ref_cols
  FROM pg_attribute src_a, pg_attribute ref_a
  WHERE src_a.attrelid = src_c.oid AND src_a.attnum = ANY(con.conkey)
    AND ref_a.attrelid = ref_c.oid AND ref_a.attnum = ANY(con.confkey)
) fk_cols ON true
WHERE con.contype = 'f'
  AND src_c.relname IN (SELECT table_name FROM expected_tables)
  AND NOT EXISTS (
    SELECT 1 FROM expected_fks ef 
    WHERE ef.table_name = src_c.relname AND ef.constraint_name = con.conname
  )

UNION ALL

-- 11. Unexpected CHECK & EXCLUDE Constraints on Core Tables
SELECT
  'UNEXPECTED_CONSTRAINT' AS check_category,
  c.relname || '.' || con.conname AS object_name,
  'FAIL' AS status,
  'Unexpected constraint found on public.' || c.relname || ': ' || con.conname || ' (type=' || con.contype::text || ')' AS discrepancy_details
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relname IN (SELECT table_name FROM expected_tables)
  AND con.contype NOT IN ('p', 'u', 'f', 'n')

UNION ALL

-- 12. B-Tree Indexes Check (17 indexes)
SELECT
  'INDEX' AS check_category,
  e.idx_name AS object_name,
  CASE 
    WHEN pi.indexname IS NULL THEN 'FAIL'
    WHEN pi.is_valid = false THEN 'FAIL'
    WHEN pi.is_ready = false THEN 'FAIL'
    WHEN pi.amname != 'btree' THEN 'FAIL'
    WHEN pi.has_include_cols = true THEN 'FAIL'
    WHEN pi.has_expression_cols = true THEN 'FAIL'
    WHEN pi.has_non_default_indoption = true THEN 'FAIL'
    WHEN pi.has_custom_opclass = true THEN 'FAIL'
    WHEN pi.key_cols != e.col_list THEN 'FAIL'
    WHEN pi.is_unique != e.is_unique THEN 'FAIL'
    WHEN pi.has_predicate = true THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE
    WHEN pi.indexname IS NULL THEN 'MISSING index on table public.' || e.tbl_name
    WHEN pi.is_valid = false THEN 'INVALID INDEX: index creation was interrupted (indisvalid=false)'
    WHEN pi.is_ready = false THEN 'UNREADY INDEX: index is not queryable (indisready=false)'
    WHEN pi.amname != 'btree' THEN 'ACCESS METHOD MISMATCH: expected btree, found ' || pi.amname
    WHEN pi.has_include_cols = true THEN 'UNEXPECTED INCLUDE COLUMNS: index has non-key included attributes'
    WHEN pi.has_expression_cols = true THEN 'UNEXPECTED EXPRESSION INDEX: index contains expression columns'
    WHEN pi.has_non_default_indoption = true THEN 'UNEXPECTED SORT ORDER: index uses non-default indoption (expected ASC NULLS LAST)'
    WHEN pi.has_custom_opclass = true THEN 'UNEXPECTED OPCLASS: index uses non-default operator class'
    WHEN pi.key_cols != e.col_list THEN 'KEY COLUMNS MISMATCH: expected (' || e.col_list || '), found (' || pi.key_cols || ')'
    WHEN pi.is_unique != e.is_unique THEN 'UNIQUENESS MISMATCH: expected ' || e.is_unique::text
    WHEN pi.has_predicate = true THEN 'UNEXPECTED PREDICATE: index has WHERE clause: ' || pi.predicate_expr
    ELSE 'Valid B-tree index verified without predicate'
  END AS discrepancy_details
FROM expected_indexes e
LEFT JOIN (
  SELECT 
    i.relname AS indexname,
    t.relname AS tablename,
    am.amname,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    ix.indisunique AS is_unique,
    (ix.indnatts > ix.indnkeyatts) AS has_include_cols,
    (0 = ANY(ix.indkey[0 : ix.indnkeyatts - 1])) AS has_expression_cols,
    (ix.indpred IS NOT NULL) AS has_predicate,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_expr,
    EXISTS (
      SELECT 1 FROM generate_series(0, ix.indnkeyatts - 1) pos
      WHERE ix.indoption[pos] != 0
    ) AS has_non_default_indoption,
    EXISTS (
      SELECT 1 FROM generate_series(0, ix.indnkeyatts - 1) pos
      JOIN pg_opclass opc ON opc.oid = ix.indclass[pos]
      WHERE NOT opc.opcdefault
    ) AS has_custom_opclass,
    string_agg(
      a.attname, ',' 
      ORDER BY array_position(ix.indkey[0 : ix.indnkeyatts - 1], a.attnum)
    ) AS key_cols
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey[0 : ix.indnkeyatts - 1])
  GROUP BY i.relname, t.relname, am.amname, ix.indisvalid, ix.indisready, ix.indisunique, 
           ix.indnatts, ix.indnkeyatts, ix.indpred, ix.indrelid, ix.indoption, ix.indkey, ix.indclass
) pi ON pi.indexname = e.idx_name AND pi.tablename = e.tbl_name

UNION ALL

-- 13. Unexpected Indexes Check on Expected Tables
SELECT
  'UNEXPECTED_INDEX' AS check_category,
  t.relname || '.' || i.relname AS object_name,
  'FAIL' AS status,
  'Unexpected index found on public.' || t.relname || ': ' || i.relname AS discrepancy_details
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
WHERE t.relname IN (SELECT table_name FROM expected_tables)
  AND NOT ix.indisprimary
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint con 
    WHERE con.conindid = i.oid AND con.contype = 'u'
  )
  AND i.relname NOT IN (SELECT idx_name FROM expected_indexes)
GROUP BY t.relname, i.relname

UNION ALL

-- 14. Sequence Existence in 'public' Schema
SELECT
  'SEQUENCE' AS check_category,
  'public.login_rate_limits_id_seq' AS object_name,
  CASE WHEN s.oid IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  CASE 
    WHEN s.oid IS NOT NULL THEN 'Sequence exists in public schema' 
    ELSE 'MISSING sequence: login_rate_limits_id_seq not found in public schema' 
  END AS discrepancy_details
FROM (SELECT 1) dummy
LEFT JOIN (
  pg_class s 
  JOIN pg_namespace n ON n.oid = s.relnamespace AND n.nspname = 'public' AND s.relkind = 'S'
) ON s.relname = 'login_rate_limits_id_seq'

UNION ALL

-- 15. Sequence Dependency Ownership Check
SELECT
  'SEQUENCE_OWNERSHIP' AS check_category,
  'login_rate_limits.id -> login_rate_limits_id_seq' AS object_name,
  CASE WHEN dep.refobjid IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS status,
  CASE 
    WHEN dep.refobjid IS NOT NULL THEN 'Auto-dependency ownership verified via pg_depend' 
    ELSE 'MISSING or BROKEN sequence auto-dependency ownership' 
  END AS discrepancy_details
FROM (SELECT 1) dummy
LEFT JOIN (
  SELECT d.refobjid
  FROM pg_depend d
  JOIN pg_class seq ON seq.oid = d.objid AND seq.relkind = 'S'
  JOIN pg_class tbl ON tbl.oid = d.refobjid AND tbl.relkind = 'r'
  JOIN pg_namespace n ON n.oid = tbl.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute col ON col.attrelid = tbl.oid AND col.attnum = d.refobjsubid
  WHERE seq.relname = 'login_rate_limits_id_seq' 
    AND tbl.relname = 'login_rate_limits' 
    AND col.attname = 'id'
    AND d.deptype = 'a'
) dep ON true

ORDER BY status DESC, check_category, object_name;
`;

  const section4Query = `
WITH 
expected_downstream_tables (table_name) AS (
  VALUES 
    ('ai_conversations'), ('ai_messages'), ('user_generated_lessons'),
    ('user_quizzes'), ('quiz_attempts'), ('generation_tasks')
),
expected_downstream_cols (table_name, column_name, data_type, char_len, is_nullable, col_default) AS (
  VALUES
    -- ai_conversations (9)
    ('ai_conversations', 'id', 'character varying', 36, 'NO', NULL),
    ('ai_conversations', 'user_id', 'character varying', 36, 'NO', NULL),
    ('ai_conversations', 'title', 'character varying', 255, 'NO', '''New Conversation''::character varying'),
    ('ai_conversations', 'mode', 'character varying', 32, 'NO', '''general_qa''::character varying'),
    ('ai_conversations', 'lesson_id', 'character varying', 64, 'YES', NULL),
    ('ai_conversations', 'section_id', 'character varying', 64, 'YES', NULL),
    ('ai_conversations', 'exercise_id', 'character varying', 64, 'YES', NULL),
    ('ai_conversations', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('ai_conversations', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    -- ai_messages (10)
    ('ai_messages', 'id', 'character varying', 36, 'NO', NULL),
    ('ai_messages', 'conversation_id', 'character varying', 36, 'NO', NULL),
    ('ai_messages', 'role', 'character varying', 20, 'NO', NULL),
    ('ai_messages', 'content', 'text', NULL, 'NO', NULL),
    ('ai_messages', 'model', 'character varying', 64, 'YES', NULL),
    ('ai_messages', 'is_simulated', 'boolean', NULL, 'NO', 'false'),
    ('ai_messages', 'prompt_tokens', 'integer', NULL, 'YES', NULL),
    ('ai_messages', 'completion_tokens', 'integer', NULL, 'YES', NULL),
    ('ai_messages', 'total_tokens', 'integer', NULL, 'YES', NULL),
    ('ai_messages', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    -- user_generated_lessons (14)
    ('user_generated_lessons', 'id', 'character varying', 36, 'NO', NULL),
    ('user_generated_lessons', 'user_id', 'character varying', 36, 'NO', NULL),
    ('user_generated_lessons', 'conversation_id', 'character varying', 36, 'YES', NULL),
    ('user_generated_lessons', 'title', 'character varying', 255, 'NO', NULL),
    ('user_generated_lessons', 'topic', 'character varying', 255, 'NO', NULL),
    ('user_generated_lessons', 'description', 'text', NULL, 'NO', NULL),
    ('user_generated_lessons', 'difficulty', 'character varying', 32, 'NO', '''intermediate''::character varying'),
    ('user_generated_lessons', 'estimated_minutes', 'integer', NULL, 'NO', '20'),
    ('user_generated_lessons', 'tags', 'text', NULL, 'NO', '''[]''::text'),
    ('user_generated_lessons', 'prerequisites', 'text', NULL, 'NO', '''[]''::text'),
    ('user_generated_lessons', 'learning_objectives', 'text', NULL, 'NO', '''[]''::text'),
    ('user_generated_lessons', 'content_json', 'text', NULL, 'NO', NULL),
    ('user_generated_lessons', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('user_generated_lessons', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    -- user_quizzes (11)
    ('user_quizzes', 'id', 'character varying', 36, 'NO', NULL),
    ('user_quizzes', 'user_id', 'character varying', 36, 'NO', NULL),
    ('user_quizzes', 'lesson_id', 'character varying', 36, 'YES', NULL),
    ('user_quizzes', 'title', 'character varying', 255, 'NO', NULL),
    ('user_quizzes', 'topic', 'character varying', 255, 'NO', NULL),
    ('user_quizzes', 'difficulty', 'character varying', 32, 'NO', '''medium''::character varying'),
    ('user_quizzes', 'question_count', 'integer', NULL, 'NO', NULL),
    ('user_quizzes', 'question_types', 'text', NULL, 'NO', '''["single_choice"]''::text'),
    ('user_quizzes', 'questions_json', 'text', NULL, 'NO', NULL),
    ('user_quizzes', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('user_quizzes', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    -- quiz_attempts (10)
    ('quiz_attempts', 'id', 'character varying', 36, 'NO', NULL),
    ('quiz_attempts', 'quiz_id', 'character varying', 36, 'NO', NULL),
    ('quiz_attempts', 'user_id', 'character varying', 36, 'NO', NULL),
    ('quiz_attempts', 'score', 'integer', NULL, 'NO', NULL),
    ('quiz_attempts', 'total_questions', 'integer', NULL, 'NO', NULL),
    ('quiz_attempts', 'percentage', 'integer', NULL, 'NO', NULL),
    ('quiz_attempts', 'time_taken_seconds', 'integer', NULL, 'YES', NULL),
    ('quiz_attempts', 'answers_json', 'text', NULL, 'NO', NULL),
    ('quiz_attempts', 'results_json', 'text', NULL, 'NO', NULL),
    ('quiz_attempts', 'completed_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    -- generation_tasks (19)
    ('generation_tasks', 'id', 'character varying', 36, 'NO', NULL),
    ('generation_tasks', 'user_id', 'character varying', 36, 'NO', NULL),
    ('generation_tasks', 'task_type', 'character varying', 32, 'NO', NULL),
    ('generation_tasks', 'status', 'character varying', 20, 'NO', '''queued''::character varying'),
    ('generation_tasks', 'current_stage', 'character varying', 32, 'NO', '''queued''::character varying'),
    ('generation_tasks', 'title', 'character varying', 255, 'NO', NULL),
    ('generation_tasks', 'topic', 'character varying', 255, 'NO', NULL),
    ('generation_tasks', 'difficulty', 'character varying', 32, 'NO', '''intermediate''::character varying'),
    ('generation_tasks', 'idempotency_key', 'character varying', 64, 'NO', NULL),
    ('generation_tasks', 'input_params_json', 'text', NULL, 'NO', NULL),
    ('generation_tasks', 'result_data_json', 'text', NULL, 'YES', NULL),
    ('generation_tasks', 'persisted_entity_id', 'character varying', 36, 'YES', NULL),
    ('generation_tasks', 'error_message', 'text', NULL, 'YES', NULL),
    ('generation_tasks', 'error_category', 'character varying', 64, 'YES', NULL),
    ('generation_tasks', 'is_retryable', 'boolean', NULL, 'NO', 'true'),
    ('generation_tasks', 'execution_deadline_at', 'timestamp with time zone', NULL, 'YES', NULL),
    ('generation_tasks', 'created_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('generation_tasks', 'updated_at', 'timestamp with time zone', NULL, 'NO', 'now()'),
    ('generation_tasks', 'completed_at', 'timestamp with time zone', NULL, 'YES', NULL)
),
expected_downstream_fks (table_name, constraint_name, col_name, f_schema_name, f_table_name, f_col_name, del_rule, upd_rule) AS (
  VALUES
    ('ai_conversations', 'ai_conversations_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('ai_messages', 'ai_messages_conversation_id_ai_conversations_id_fk', 'conversation_id', 'public', 'ai_conversations', 'id', 'c', 'a'),
    ('user_generated_lessons', 'user_generated_lessons_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('user_generated_lessons', 'user_generated_lessons_conversation_id_ai_conversations_id_fk', 'conversation_id', 'public', 'ai_conversations', 'id', 'n', 'a'),
    ('user_quizzes', 'user_quizzes_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('user_quizzes', 'user_quizzes_lesson_id_user_generated_lessons_id_fk', 'lesson_id', 'public', 'user_generated_lessons', 'id', 'n', 'a'),
    ('quiz_attempts', 'quiz_attempts_quiz_id_user_quizzes_id_fk', 'quiz_id', 'public', 'user_quizzes', 'id', 'c', 'a'),
    ('quiz_attempts', 'quiz_attempts_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a'),
    ('generation_tasks', 'generation_tasks_user_id_users_id_fk', 'user_id', 'public', 'users', 'id', 'c', 'a')
),
expected_downstream_indexes (idx_name, tbl_name, col_list, is_unique, is_partial) AS (
  VALUES
    -- 0002_persistent_ai_conversations.sql (4 indexes)
    ('ai_conversations_user_id_idx', 'ai_conversations', 'user_id', false, false),
    ('ai_conversations_user_updated_idx', 'ai_conversations', 'user_id,updated_at', false, false),
    ('ai_messages_conv_id_idx', 'ai_messages', 'conversation_id', false, false),
    ('ai_messages_conv_created_idx', 'ai_messages', 'conversation_id,created_at', false, false),
    -- 0003_user_generated_lessons.sql (2 indexes)
    ('user_gen_lessons_user_id_idx', 'user_generated_lessons', 'user_id', false, false),
    ('user_gen_lessons_user_updated_idx', 'user_generated_lessons', 'user_id,updated_at', false, false),
    -- 0004_user_quizzes.sql (6 indexes)
    ('user_quizzes_user_id_idx', 'user_quizzes', 'user_id', false, false),
    ('user_quizzes_lesson_id_idx', 'user_quizzes', 'lesson_id', false, false),
    ('user_quizzes_user_updated_idx', 'user_quizzes', 'user_id,updated_at', false, false),
    ('quiz_attempts_quiz_id_idx', 'quiz_attempts', 'quiz_id', false, false),
    ('quiz_attempts_user_id_idx', 'quiz_attempts', 'user_id', false, false),
    ('quiz_attempts_user_completed_idx', 'quiz_attempts', 'user_id,completed_at', false, false),
    -- 0005_generation_tasks.sql (5 indexes)
    ('generation_tasks_user_id_idx', 'generation_tasks', 'user_id', false, false),
    ('generation_tasks_user_status_idx', 'generation_tasks', 'user_id,status', false, false),
    ('generation_tasks_created_idx', 'generation_tasks', 'created_at', false, false),
    ('generation_tasks_active_deadline_idx', 'generation_tasks', 'status,execution_deadline_at', false, false),
    ('generation_tasks_active_idempotency_idx', 'generation_tasks', 'user_id,idempotency_key', true, true)
)

-- 1. Downstream Relation Existence & Exhaustive Relation-Kind Classification
SELECT 
  'DOWNSTREAM_RELATION' AS check_category,
  e.table_name AS object_name,
  CASE 
    WHEN rel.total_matches = 0 THEN 'CLEAN_ABSENT (Will be created cleanly by Drizzle)'
    WHEN rel.total_matches = 1 AND rel.public_table_count = 1 THEN 'EXISTS_IN_PUBLIC'
    ELSE 'FAIL'
  END AS status,
  CASE 
    WHEN rel.total_matches = 0 
      THEN 'Relation does not exist anywhere in database (clean slate for automated migration)'
    WHEN rel.total_matches = 1 AND rel.public_table_count = 1 
      THEN 'Ordinary table (r) exists strictly in public schema (verifying column & constraint definitions below)'
    WHEN rel.public_non_table_count > 0 
      THEN 'RELATION KIND COLLISION: Object exists in public as non-table relation (' || rel.all_matching_relations || '). CREATE TABLE will FAIL!'
    WHEN rel.other_schema_count > 0 AND rel.public_table_count = 0 
      THEN 'DIVERGENT SCHEMA: Relation exists in non-public schema (' || rel.all_matching_relations || ') instead of public!'
    WHEN rel.total_matches > 1 
      THEN 'AMBIGUOUS DUPLICATE RELATIONS: Found ' || rel.total_matches || ' matching relations across schemas (' || rel.all_matching_relations || ')!'
    ELSE 'Unexpected relation state: ' || COALESCE(rel.all_matching_relations, 'UNKNOWN')
  END AS discrepancy_details
FROM expected_downstream_tables e
LEFT JOIN LATERAL (
  SELECT 
    count(*) AS total_matches,
    count(*) FILTER (WHERE n.nspname = 'public' AND c.relkind = 'r') AS public_table_count,
    count(*) FILTER (WHERE n.nspname = 'public' AND c.relkind != 'r') AS public_non_table_count,
    count(*) FILTER (WHERE n.nspname NOT IN ('public', 'pg_toast', 'pg_catalog', 'information_schema')) AS other_schema_count,
    string_agg(
      n.nspname || '.' || c.relname || ' (' || 
      CASE c.relkind
        WHEN 'r' THEN 'ordinary table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'f' THEN 'foreign table'
        WHEN 'S' THEN 'sequence'
        WHEN 'i' THEN 'index'
        WHEN 'I' THEN 'partitioned index'
        WHEN 'c' THEN 'composite type'
        WHEN 't' THEN 'TOAST table'
        ELSE 'unknown relkind=' || c.relkind::text
      END || ')', 
      ', '
    ) AS all_matching_relations
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = e.table_name
    AND n.nspname NOT IN ('pg_toast', 'pg_catalog', 'information_schema')
) rel ON true

UNION ALL

-- 2. Downstream Primary Key Verification
SELECT
  'DOWNSTREAM_PRIMARY_KEY' AS check_category,
  e.table_name || ' (PK)' AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'PASS (Clean slate)'
    WHEN pk.col_list = 'id' THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'Table pending creation by Drizzle'
    WHEN pk.col_list IS NULL THEN 'DIVERGENCE: Table exists in public, but primary key is MISSING!'
    WHEN pk.col_list != 'id' THEN 'INVALID PK: expected (id), found (' || pk.col_list || ')'
    ELSE 'Primary key on column id verified'
  END AS discrepancy_details
FROM expected_downstream_tables e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
) ON c.relname = e.table_name
LEFT JOIN (
  SELECT 
    c.relname AS table_name,
    string_agg(a.attname, ',' ORDER BY array_position(con.conkey, a.attnum)) AS col_list
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
  WHERE con.contype = 'p'
  GROUP BY c.relname
) pk ON pk.table_name = e.table_name

UNION ALL

-- 3. Unexpected Unique Constraints on Existing Downstream Tables
SELECT
  'UNEXPECTED_DOWNSTREAM_UNIQUE' AS check_category,
  c.relname || ' (' || con.conname || ')' AS object_name,
  'FAIL' AS status,
  'Unexpected unique constraint found on public.' || c.relname || ': ' || con.conname AS discrepancy_details
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE con.contype = 'u'
  AND c.relname IN (SELECT table_name FROM expected_downstream_tables)

UNION ALL

-- 4. Downstream Column Integrity (73 columns)
SELECT 
  'DOWNSTREAM_COLUMN' AS check_category,
  e.table_name || '.' || e.column_name AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'PASS (Clean slate)'
    WHEN a.attname IS NULL THEN 'FAIL'
    WHEN format_type(a.atttypid, a.atttypmod) != 
         CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END THEN 'FAIL'
    WHEN (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END) != e.is_nullable THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'Table pending creation by Drizzle'
    WHEN a.attname IS NULL THEN 'CRITICAL DIVERGENCE: Table exists in public, but column ' || e.column_name || ' is MISSING! CREATE TABLE IF NOT EXISTS will NOT add it!'
    WHEN format_type(a.atttypid, a.atttypmod) != 
         CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END 
      THEN 'TYPE MISMATCH: expected ' || 
           CASE WHEN e.char_len IS NOT NULL THEN e.data_type || '(' || e.char_len || ')' ELSE e.data_type END || 
           ', found ' || format_type(a.atttypid, a.atttypmod)
    WHEN (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END) != e.is_nullable 
      THEN 'NULLABILITY MISMATCH: expected ' || e.is_nullable || ', found ' || (CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END)
    ELSE 'Column definition matches'
  END AS discrepancy_details
FROM expected_downstream_cols e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
) ON c.relname = e.table_name
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = e.column_name AND a.attnum > 0 AND NOT a.attisdropped

UNION ALL

-- 5. Downstream Column Defaults
SELECT 
  'DOWNSTREAM_DEFAULT' AS check_category,
  e.table_name || '.' || e.column_name AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'PASS (Clean slate)'
    WHEN a.attname IS NULL THEN 'FAIL'
    WHEN e.col_default IS NULL AND ad.adbin IS NULL THEN 'PASS'
    WHEN e.col_default IS NULL AND ad.adbin IS NOT NULL THEN 'FAIL'
    WHEN e.col_default IS NOT NULL AND ad.adbin IS NULL THEN 'FAIL'
    WHEN pg_get_expr(ad.adbin, ad.adrelid) = e.col_default THEN 'PASS'
    WHEN e.col_default = '20' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('20', '20::integer') THEN 'PASS'
    ELSE 'FAIL'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'Table pending creation by Drizzle'
    WHEN a.attname IS NULL THEN 'Column missing from public table'
    WHEN e.col_default IS NULL AND ad.adbin IS NOT NULL THEN 'UNEXPECTED default: ' || pg_get_expr(ad.adbin, ad.adrelid)
    WHEN e.col_default IS NOT NULL AND ad.adbin IS NULL THEN 'MISSING default: expected ' || e.col_default
    WHEN NOT (pg_get_expr(ad.adbin, ad.adrelid) = e.col_default OR (e.col_default = '20' AND pg_get_expr(ad.adbin, ad.adrelid) IN ('20', '20::integer')))
      THEN 'DEFAULT MISMATCH: expected ' || e.col_default || ', found ' || pg_get_expr(ad.adbin, ad.adrelid)
    ELSE 'Default expression verified'
  END AS discrepancy_details
FROM expected_downstream_cols e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
) ON c.relname = e.table_name
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = e.column_name AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum

UNION ALL

-- 6. Unexpected Columns on Existing Downstream Tables
SELECT
  'UNEXPECTED_DOWNSTREAM_COLUMN' AS check_category,
  c.relname || '.' || a.attname AS object_name,
  'FAIL' AS status,
  'Unexpected column detected in public.' || c.relname || ': ' || a.attname AS discrepancy_details
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.relname IN (SELECT table_name FROM expected_downstream_tables)
  AND NOT EXISTS (
    SELECT 1 FROM expected_downstream_cols edc 
    WHERE edc.table_name = c.relname AND edc.column_name = a.attname
  )

UNION ALL

-- 7. Downstream Foreign Key Checks (Exact 1:1 match by constraint name, table, columns, and properties)
SELECT
  'DOWNSTREAM_FOREIGN_KEY' AS check_category,
  e.table_name || '.' || e.constraint_name AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'PASS (Clean slate)'
    WHEN fk.exact_name_matches = 0 THEN 'FAIL'
    WHEN fk.perfect_matches != 1 THEN 'FAIL'
    WHEN fk.duplicate_rel_matches > 0 THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'Table pending creation by Drizzle'
    WHEN fk.exact_name_matches = 0 THEN 'MISSING constraint ' || e.constraint_name || ' on public.' || e.table_name
    WHEN fk.duplicate_rel_matches > 0 THEN 'DUPLICATE RELATIONSHIP: Found ' || (1 + fk.duplicate_rel_matches) || ' constraints for this relationship on ' || e.table_name || ': ' || fk.constraint_details
    WHEN fk.perfect_matches != 1 THEN 'FK PROPERTY MISMATCH on ' || e.constraint_name || ': ' || fk.constraint_details
    ELSE 'Exact constraint verified (' || fk.constraint_details || ')'
  END AS discrepancy_details
FROM expected_downstream_fks e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
) ON c.relname = e.table_name
LEFT JOIN LATERAL (
  SELECT 
    count(*) AS exact_name_matches,
    count(*) FILTER (
      WHERE con.conname = e.constraint_name
        AND cols.src_cols = e.col_name
        AND ref_n.nspname = e.f_schema_name
        AND ref_c.relname = e.f_table_name
        AND cols.ref_cols = 'id'
        AND con.confdeltype = e.del_rule
        AND con.confupdtype = e.upd_rule
        AND con.convalidated = true
        AND con.condeferrable = false
        AND con.condeferred = false
        AND con.confmatchtype = 's'
    ) AS perfect_matches,
    count(*) FILTER (
      WHERE cols.src_cols = e.col_name
        AND ref_n.nspname = e.f_schema_name
        AND ref_c.relname = e.f_table_name
        AND cols.ref_cols = 'id'
        AND con.conname != e.constraint_name
    ) AS duplicate_rel_matches,
    string_agg(
      con.conname || ' [src=' || src_c.relname || '.' || cols.src_cols || 
      ' -> ' || ref_n.nspname || '.' || ref_c.relname || '.' || cols.ref_cols || 
      ', del=' || con.confdeltype::text || ', upd=' || con.confupdtype::text || 
      ', val=' || con.convalidated::text || ', def=' || con.condeferrable::text || 
      ', deferred=' || con.condeferred::text || ', match=' || con.confmatchtype::text || ']',
      '; '
    ) AS constraint_details
  FROM pg_constraint con
  JOIN pg_class src_c ON src_c.oid = con.conrelid
  JOIN pg_namespace src_n ON src_n.oid = src_c.relnamespace AND src_n.nspname = 'public'
  JOIN pg_class ref_c ON ref_c.oid = con.confrelid
  JOIN pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
  JOIN LATERAL (
    SELECT 
      string_agg(src_a.attname, ',' ORDER BY array_position(con.conkey, src_a.attnum)) AS src_cols,
      string_agg(ref_a.attname, ',' ORDER BY array_position(con.confkey, ref_a.attnum)) AS ref_cols
    FROM pg_attribute src_a, pg_attribute ref_a
    WHERE src_a.attrelid = src_c.oid AND src_a.attnum = ANY(con.conkey)
      AND ref_a.attrelid = ref_c.oid AND ref_a.attnum = ANY(con.confkey)
  ) cols ON true
  WHERE con.contype = 'f'
    AND src_c.relname = e.table_name
    AND (
      con.conname = e.constraint_name
      OR (cols.src_cols = e.col_name AND ref_n.nspname = e.f_schema_name AND ref_c.relname = e.f_table_name AND cols.ref_cols = 'id')
    )
) fk ON true

UNION ALL

-- 8. Unexpected Foreign Keys on Existing Downstream Tables (Composite key table_name + constraint_name)
SELECT
  'UNEXPECTED_DOWNSTREAM_FK' AS check_category,
  src_c.relname || '.' || con.conname AS object_name,
  'FAIL' AS status,
  'Unexpected foreign key on public.' || src_c.relname || ': ' || con.conname || 
  ' (' || fk_cols.src_cols || ' -> ' || ref_n.nspname || '.' || ref_c.relname || '.' || fk_cols.ref_cols || ')' AS discrepancy_details
FROM pg_constraint con
JOIN pg_class src_c ON src_c.oid = con.conrelid
JOIN pg_class ref_c ON ref_c.oid = con.confrelid
JOIN pg_namespace src_n ON src_n.oid = src_c.relnamespace AND src_n.nspname = 'public'
JOIN pg_namespace ref_n ON ref_n.oid = ref_c.relnamespace
JOIN LATERAL (
  SELECT 
    string_agg(src_a.attname, ',' ORDER BY array_position(con.conkey, src_a.attnum)) AS src_cols,
    string_agg(ref_a.attname, ',' ORDER BY array_position(con.confkey, ref_a.attnum)) AS ref_cols
  FROM pg_attribute src_a, pg_attribute ref_a
  WHERE src_a.attrelid = src_c.oid AND src_a.attnum = ANY(con.conkey)
    AND ref_a.attrelid = ref_c.oid AND ref_a.attnum = ANY(con.confkey)
) fk_cols ON true
WHERE con.contype = 'f'
  AND src_c.relname IN (SELECT table_name FROM expected_downstream_tables)
  AND NOT EXISTS (
    SELECT 1 FROM expected_downstream_fks ef 
    WHERE ef.table_name = src_c.relname AND ef.constraint_name = con.conname
  )

UNION ALL

-- 9. Downstream Indexes & Strict Partial Predicate Comparison (Exactly 17 indexes)
SELECT
  'DOWNSTREAM_INDEX' AS check_category,
  e.idx_name AS object_name,
  CASE 
    WHEN c.oid IS NULL THEN 'PASS (Clean slate)'
    WHEN pi.indexname IS NULL THEN 'FAIL'
    WHEN pi.is_valid = false THEN 'FAIL'
    WHEN pi.is_ready = false THEN 'FAIL'
    WHEN pi.amname != 'btree' THEN 'FAIL'
    WHEN pi.has_include_cols = true THEN 'FAIL'
    WHEN pi.has_expression_cols = true THEN 'FAIL'
    WHEN pi.has_non_default_indoption = true THEN 'FAIL'
    WHEN pi.has_custom_opclass = true THEN 'FAIL'
    WHEN pi.key_cols != e.col_list THEN 'FAIL'
    WHEN pi.is_unique != e.is_unique THEN 'FAIL'
    WHEN e.is_partial = true AND (
      pi.predicate_expr IS NULL OR 
      pi.predicate_expr NOT IN (
        '((status)::text = ANY ((ARRAY[''queued''::character varying, ''processing''::character varying])::text[]))',
        '((status)::text = ANY (ARRAY[(''queued''::character varying)::text, (''processing''::character varying)::text]))',
        '(status = ANY (ARRAY[''queued''::character varying, ''processing''::character varying]))',
        '((status)::text = ANY (ARRAY[''queued''::text, ''processing''::text]))',
        '(status = ANY (ARRAY[''queued''::text, ''processing''::text]))',
        '((status)::text = ANY (ARRAY[''queued''::character varying, ''processing''::character varying]))'
      )
    ) THEN 'FAIL'
    WHEN e.is_partial = false AND pi.has_predicate = true THEN 'FAIL'
    ELSE 'PASS'
  END AS status,
  CASE 
    WHEN c.oid IS NULL THEN 'Table pending creation by Drizzle'
    WHEN pi.indexname IS NULL THEN 'DIVERGENCE: Table exists in public, but index ' || e.idx_name || ' is MISSING!'
    WHEN pi.is_valid = false THEN 'INVALID INDEX: index creation was interrupted (indisvalid=false)'
    WHEN pi.is_ready = false THEN 'UNREADY INDEX: index is not queryable (indisready=false)'
    WHEN pi.amname != 'btree' THEN 'ACCESS METHOD MISMATCH: expected btree, found ' || pi.amname
    WHEN pi.has_include_cols = true THEN 'UNEXPECTED INCLUDE COLUMNS on downstream index'
    WHEN pi.has_expression_cols = true THEN 'UNEXPECTED EXPRESSION INDEX: index contains expression columns'
    WHEN pi.has_non_default_indoption = true THEN 'UNEXPECTED SORT ORDER: non-default sort option (expected ASC NULLS LAST)'
    WHEN pi.has_custom_opclass = true THEN 'UNEXPECTED OPCLASS: downstream index uses custom operator class'
    WHEN pi.key_cols != e.col_list THEN 'KEY COLUMNS MISMATCH: expected (' || e.col_list || '), found (' || pi.key_cols || ')'
    WHEN pi.is_unique != e.is_unique THEN 'UNIQUENESS MISMATCH: expected ' || e.is_unique::text
    WHEN e.is_partial = true AND (
      pi.predicate_expr IS NULL OR 
      pi.predicate_expr NOT IN (
        '((status)::text = ANY ((ARRAY[''queued''::character varying, ''processing''::character varying])::text[]))',
        '((status)::text = ANY (ARRAY[(''queued''::character varying)::text, (''processing''::character varying)::text]))',
        '(status = ANY (ARRAY[''queued''::character varying, ''processing''::character varying]))',
        '((status)::text = ANY (ARRAY[''queued''::text, ''processing''::text]))',
        '(status = ANY (ARRAY[''queued''::text, ''processing''::text]))',
        '((status)::text = ANY (ARRAY[''queued''::character varying, ''processing''::character varying]))'
      )
    ) THEN 'PREDICATE MISMATCH: unexpected predicate: ' || COALESCE(pi.predicate_expr, 'NULL')
    WHEN e.is_partial = false AND pi.has_predicate = true
      THEN 'UNEXPECTED PREDICATE: index should be unconditional, found: ' || pi.predicate_expr
    ELSE 'Index definition matches catalog specification'
  END AS discrepancy_details
FROM expected_downstream_indexes e
LEFT JOIN (
  pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public' AND c.relkind = 'r'
) ON c.relname = e.tbl_name
LEFT JOIN (
  SELECT 
    i.relname AS indexname,
    t.relname AS tablename,
    am.amname,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    ix.indisunique AS is_unique,
    (ix.indnatts > ix.indnkeyatts) AS has_include_cols,
    (0 = ANY(ix.indkey[0 : ix.indnkeyatts - 1])) AS has_expression_cols,
    (ix.indpred IS NOT NULL) AS has_predicate,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_expr,
    EXISTS (
      SELECT 1 FROM generate_series(0, ix.indnkeyatts - 1) pos
      WHERE ix.indoption[pos] != 0
    ) AS has_non_default_indoption,
    EXISTS (
      SELECT 1 FROM generate_series(0, ix.indnkeyatts - 1) pos
      JOIN pg_opclass opc ON opc.oid = ix.indclass[pos]
      WHERE NOT opc.opcdefault
    ) AS has_custom_opclass,
    string_agg(
      a.attname, ',' 
      ORDER BY array_position(ix.indkey[0 : ix.indnkeyatts - 1], a.attnum)
    ) AS key_cols
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
  JOIN pg_am am ON am.oid = i.relam
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey[0 : ix.indnkeyatts - 1])
  GROUP BY i.relname, t.relname, am.amname, ix.indisvalid, ix.indisready, ix.indisunique, 
           ix.indnatts, ix.indnkeyatts, ix.indpred, ix.indrelid, ix.indkey, ix.indoption, ix.indclass
) pi ON pi.indexname = e.idx_name AND pi.tablename = e.tbl_name

UNION ALL

-- 10. Unexpected Indexes on Existing Downstream Tables
SELECT
  'UNEXPECTED_DOWNSTREAM_INDEX' AS check_category,
  t.relname || '.' || i.relname AS object_name,
  'FAIL' AS status,
  'Unexpected index found on public.' || t.relname || ': ' || i.relname AS discrepancy_details
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
WHERE t.relname IN (SELECT table_name FROM expected_downstream_tables)
  AND NOT ix.indisprimary
  AND i.relname NOT IN (SELECT idx_name FROM expected_downstream_indexes)
GROUP BY t.relname, i.relname

ORDER BY status DESC, check_category, object_name;
`;

  const section5BaselineBlock = `
DO $$
DECLARE
  v_tbl_oid OID;
  v_total_cols INTEGER;
  v_valid_cols INTEGER;
  v_attrdef_oid OID;
  v_id_default_expr TEXT;
  v_default_dep_count INTEGER;
  v_seq_oid OID;
  v_seq_dep_count INTEGER;
  v_seq_last_value BIGINT;
  v_seq_is_called BOOLEAN;
  v_next_seq_val BIGINT;
  v_max_id BIGINT;
  v_pk_cols TEXT;
  v_unexpected_con_count INTEGER;
  v_unexpected_idx_count INTEGER;
  v_count INTEGER;
  v_hash0000 TEXT;
  v_hash0001 TEXT;
  c_expected_hash0000 CONSTANT TEXT := '8f2418b022a42d5a10cfbfd2fb5a4eb4051f372a3e4f14c94ed3834f8fd55b3e';
  c_expected_hash0001 CONSTANT TEXT := '19602828caf802675b3faa334c540dcb2b1b8cf3a2e65514c637527824f916c8';
  c_when0000 CONSTANT BIGINT := 1793435374100;
  c_when0001 CONSTANT BIGINT := 1793439022931;
BEGIN
  PERFORM pg_advisory_xact_lock(847291048201);
  CREATE SCHEMA IF NOT EXISTS "drizzle";

  SELECT c.oid INTO v_tbl_oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations' AND c.relkind = 'r';

  IF v_tbl_oid IS NULL THEN
    CREATE TABLE "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
    SELECT c.oid INTO v_tbl_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations';
  ELSE
    SELECT count(*) INTO v_total_cols
    FROM information_schema.columns
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations';

    IF v_total_cols != 3 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: drizzle.__drizzle_migrations has % columns, expected exactly 3. Unexpected columns present.', v_total_cols;
    END IF;

    SELECT count(*) INTO v_valid_cols
    FROM information_schema.columns
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      AND (
        (column_name = 'id' AND data_type = 'integer' AND is_nullable = 'NO') OR
        (column_name = 'hash' AND data_type = 'text' AND is_nullable = 'NO') OR
        (column_name = 'created_at' AND data_type = 'bigint' AND is_nullable = 'YES')
      );

    IF v_valid_cols != 3 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Existing table drizzle.__drizzle_migrations has invalid columns or types. Cannot proceed.';
    END IF;

    SELECT c.oid INTO v_seq_oid
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'drizzle' AND c.relname = '__drizzle_migrations_id_seq' AND c.relkind = 'S';

    IF v_seq_oid IS NULL THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Sequence drizzle.__drizzle_migrations_id_seq not found in schema "drizzle".';
    END IF;

    SELECT ad.oid, pg_get_expr(ad.adbin, ad.adrelid) 
    INTO v_attrdef_oid, v_id_default_expr
    FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    WHERE ad.adrelid = v_tbl_oid AND a.attname = 'id';

    IF v_attrdef_oid IS NULL OR v_id_default_expr IS NULL THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Column id on drizzle.__drizzle_migrations has NO default value. Expected SERIAL nextval default.';
    END IF;

    IF v_id_default_expr NOT IN (
      'nextval(''drizzle.__drizzle_migrations_id_seq''::regclass)',
      'nextval(''"drizzle"."__drizzle_migrations_id_seq"''::regclass)'
    ) THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Column id default expression is invalid: expected nextval(''drizzle.__drizzle_migrations_id_seq''::regclass), found: %', v_id_default_expr;
    END IF;

    SELECT count(*) INTO v_default_dep_count
    FROM pg_depend d
    WHERE d.classid = 'pg_attrdef'::regclass
      AND d.objid = v_attrdef_oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = v_seq_oid;

    IF v_default_dep_count = 0 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Column id default does NOT reference sequence OID % (drizzle.__drizzle_migrations_id_seq). Default points to wrong sequence!', v_seq_oid;
    END IF;

    SELECT count(*) INTO v_seq_dep_count
    FROM pg_depend d
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = v_seq_oid
      AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = v_tbl_oid
      AND a.attname = 'id'
      AND d.deptype = 'a';

    IF v_seq_dep_count = 0 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Sequence drizzle.__drizzle_migrations_id_seq is NOT owned by drizzle.__drizzle_migrations.id (missing auto-dependency).';
    END IF;

    IF pg_get_serial_sequence('"drizzle"."__drizzle_migrations"', 'id') != 'drizzle.__drizzle_migrations_id_seq' THEN
      RAISE EXCEPTION '[BASELINE ABORT]: pg_get_serial_sequence did not resolve to drizzle.__drizzle_migrations_id_seq. Found: %', COALESCE(pg_get_serial_sequence('"drizzle"."__drizzle_migrations"', 'id'), 'NULL');
    END IF;

    SELECT string_agg(a.attname, ',' ORDER BY array_position(con.conkey, a.attnum)) INTO v_pk_cols
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
    WHERE con.conrelid = v_tbl_oid AND con.contype = 'p';

    IF v_pk_cols IS NULL OR v_pk_cols != 'id' THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Primary key on drizzle.__drizzle_migrations is invalid or missing: %', COALESCE(v_pk_cols, 'NONE');
    END IF;

    SELECT count(*) INTO v_unexpected_con_count
    FROM pg_constraint
    WHERE conrelid = v_tbl_oid AND contype NOT IN ('p', 'n');

    IF v_unexpected_con_count > 0 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Unexpected constraints found on drizzle.__drizzle_migrations (% extra constraints).', v_unexpected_con_count;
    END IF;

    SELECT count(*) INTO v_unexpected_idx_count
    FROM pg_index
    WHERE indrelid = v_tbl_oid AND NOT indisprimary;

    IF v_unexpected_idx_count > 0 THEN
      RAISE EXCEPTION '[BASELINE ABORT]: Unexpected indexes found on drizzle.__drizzle_migrations (% extra indexes).', v_unexpected_idx_count;
    END IF;
  END IF;

  LOCK TABLE "drizzle"."__drizzle_migrations" IN ACCESS EXCLUSIVE MODE;

  SELECT count(*) INTO v_count
  FROM "drizzle"."__drizzle_migrations"
  WHERE created_at IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: drizzle.__drizzle_migrations contains % row(s) with NULL created_at.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM "drizzle"."__drizzle_migrations"
  WHERE hash IS NULL OR trim(hash) = '';
  IF v_count > 0 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: drizzle.__drizzle_migrations contains % row(s) with NULL or empty hash.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT created_at FROM "drizzle"."__drizzle_migrations"
    GROUP BY created_at HAVING count(*) > 1
  ) dups;
  IF v_count > 0 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Duplicate created_at timestamps exist in drizzle.__drizzle_migrations.';
  END IF;

  SELECT count(*) INTO v_count
  FROM (
    SELECT hash FROM "drizzle"."__drizzle_migrations"
    GROUP BY hash HAVING count(*) > 1
  ) dup_hashes;
  IF v_count > 0 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Duplicate hash entries exist in drizzle.__drizzle_migrations.';
  END IF;

  SELECT count(*) INTO v_count
  FROM "drizzle"."__drizzle_migrations"
  WHERE created_at NOT IN (c_when0000, c_when0001);
  IF v_count > 0 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Found unexpected migration timestamps in drizzle.__drizzle_migrations.';
  END IF;

  IF EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE created_at = c_when0001)
     AND NOT EXISTS (SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE created_at = c_when0000) THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Chronological inversion detected - 0001 exists but 0000 is missing.';
  END IF;

  SELECT last_value, is_called 
  INTO v_seq_last_value, v_seq_is_called 
  FROM "drizzle"."__drizzle_migrations_id_seq";

  IF v_seq_is_called THEN
    v_next_seq_val := v_seq_last_value + 1;
  ELSE
    v_next_seq_val := v_seq_last_value;
  END IF;

  SELECT COALESCE(max(id), 0) INTO v_max_id 
  FROM "drizzle"."__drizzle_migrations";

  IF v_next_seq_val <= v_max_id THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Sequence desynchronization detected: sequence next value (%) <= max table id (%). Inserting without explicit id will cause a primary key collision on __drizzle_migrations_pkey. Remediate with: SELECT setval(''drizzle.__drizzle_migrations_id_seq'', COALESCE((SELECT max(id) FROM "drizzle"."__drizzle_migrations"), 1), (SELECT max(id) IS NOT NULL FROM "drizzle"."__drizzle_migrations"));', v_next_seq_val, v_max_id;
  END IF;

  SELECT hash INTO v_hash0000 FROM "drizzle"."__drizzle_migrations" WHERE created_at = c_when0000;
  IF v_hash0000 IS NOT NULL AND v_hash0000 != c_expected_hash0000 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Migration 0000 has corrupted hash: expected %, found %', c_expected_hash0000, v_hash0000;
  END IF;

  SELECT hash INTO v_hash0001 FROM "drizzle"."__drizzle_migrations" WHERE created_at = c_when0001;
  IF v_hash0001 IS NOT NULL AND v_hash0001 != c_expected_hash0001 THEN
    RAISE EXCEPTION '[BASELINE ABORT]: Migration 0001 has corrupted hash: expected %, found %', c_expected_hash0001, v_hash0001;
  END IF;

  IF v_hash0000 IS NULL THEN
    INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
    VALUES (c_expected_hash0000, c_when0000);
    RAISE NOTICE '[BASELINE SUCCESS]: Inserted verified record for migration 0000 (%).', c_expected_hash0000;
  END IF;

  IF v_hash0001 IS NULL THEN
    INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
    VALUES (c_expected_hash0001, c_when0001);
    RAISE NOTICE '[BASELINE SUCCESS]: Inserted verified record for migration 0001 (%).', c_expected_hash0001;
  END IF;

END $$;
`;

  // =========================================================================
  // SCENARIO 1: Clean database with core tables and no downstream tables
  // =========================================================================
  console.log('--- SCENARIO 1: Clean database with core tables and no downstream tables ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);

    const s3Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section3Query);
    const s3Fails = s3Res.rows.filter(r => r.status === 'FAIL');
    assert(s3Fails.length === 0, 'Scenario 1: Section 3 returns 0 FAILs on genuine core schema');
    assert(s3Res.rows.length === 240, `Scenario 1: Section 3 returns exactly 240 rows (got ${s3Res.rows.length})`);

    const s4Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section4Query);
    const s4Fails = s4Res.rows.filter(r => r.status === 'FAIL');
    assert(s4Fails.length === 0, 'Scenario 1: Section 4 returns 0 FAILs on clean absent downstream');
    const relations = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_RELATION');
    assert(relations.every(r => r.status.startsWith('CLEAN_ABSENT')), 'Scenario 1: All 6 downstream relations are CLEAN_ABSENT');
    const downIdxs = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_INDEX');
    assert(downIdxs.length === 17, `Scenario 1: Section 4 checks exactly 17 downstream indexes (got ${downIdxs.length})`);

    let baselineSucceeded = false;
    try {
      await db.exec(section5BaselineBlock);
      baselineSucceeded = true;
    } catch (err: any) {
      console.error('Scenario 1 baseline error:', err.message);
    }
    assert(baselineSucceeded, 'Scenario 1: Section 5 baseline block executes successfully');

    const jRes = await db.query<{ id: number; hash: string; created_at: string | bigint }>('SELECT * FROM "drizzle"."__drizzle_migrations" ORDER BY id ASC;');
    assert(jRes.rows.length === 2, 'Scenario 1: Journal contains exactly 2 baselined rows');
    assert(String(jRes.rows[0].created_at) === '1793435374100', 'Scenario 1: Migration 0000 registered');
    assert(String(jRes.rows[1].created_at) === '1793439022931', 'Scenario 1: Migration 0001 registered');

    await db.close();
  }

  // =========================================================================
  // SCENARIO 2: Database with all expected downstream tables already present
  // =========================================================================
  console.log('\n--- SCENARIO 2: Database with all expected downstream tables already present ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);
    await executeMigration(db, sql0002);
    await executeMigration(db, sql0003);
    await executeMigration(db, sql0004);
    await executeMigration(db, sql0005);

    const s3Res = await db.query<{ status: string }>(section3Query);
    const s3Fails = s3Res.rows.filter(r => r.status === 'FAIL');
    assert(s3Fails.length === 0, 'Scenario 2: Section 3 ignores expected downstream tables and passes cleanly');

    const s4Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section4Query);
    const s4Fails = s4Res.rows.filter(r => r.status === 'FAIL');
    assert(s4Fails.length === 0, 'Scenario 2: Section 4 returns 0 FAILs on complete valid downstream schema');
    const rels = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_RELATION');
    assert(rels.every(r => r.status === 'EXISTS_IN_PUBLIC'), 'Scenario 2: All 6 downstream relations are EXISTS_IN_PUBLIC');
    const cols = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_COLUMN');
    assert(cols.every(r => r.status === 'PASS'), 'Scenario 2: All 73 downstream columns are PASS');
    const fks = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_FOREIGN_KEY');
    assert(fks.every(r => r.status === 'PASS'), 'Scenario 2: All 9 downstream foreign keys are PASS');
    const idxs = s4Res.rows.filter(r => r.check_category === 'DOWNSTREAM_INDEX');
    assert(idxs.length === 17, `Scenario 2: Exactly 17 downstream indexes audited (got ${idxs.length})`);
    assert(idxs.every(r => r.status === 'PASS'), 'Scenario 2: All 17 downstream indexes are PASS');

    await db.close();
  }

  // =========================================================================
  // SCENARIO 3: Divergent downstream column
  // =========================================================================
  console.log('\n--- SCENARIO 3: Divergent downstream column ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);
    await executeMigration(db, sql0002);
    await db.exec('ALTER TABLE "ai_messages" DROP COLUMN "total_tokens";');
    await db.exec('ALTER TABLE "ai_messages" ALTER COLUMN "role" TYPE text;');

    const s4Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section4Query);
    const missingCol = s4Res.rows.find(r => r.object_name === 'ai_messages.total_tokens' && r.check_category === 'DOWNSTREAM_COLUMN');
    assert(missingCol?.status === 'FAIL', 'Scenario 3: Missing column ai_messages.total_tokens detected as FAIL');
    assert(missingCol?.discrepancy_details.includes('CRITICAL DIVERGENCE') ?? false, 'Scenario 3: Correct discrepancy detail for missing column');

    const typeMismatch = s4Res.rows.find(r => r.object_name === 'ai_messages.role' && r.check_category === 'DOWNSTREAM_COLUMN');
    assert(typeMismatch?.status === 'FAIL', 'Scenario 3: Type mismatch on ai_messages.role detected as FAIL');
    assert(typeMismatch?.discrepancy_details.includes('TYPE MISMATCH') ?? false, 'Scenario 3: Correct discrepancy detail for type mismatch');

    await db.close();
  }

  // =========================================================================
  // SCENARIO 4: Wrong journal sequence/default
  // =========================================================================
  console.log('\n--- SCENARIO 4: Wrong journal sequence / default ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);
    await db.exec('CREATE SCHEMA "drizzle";');
    await db.exec('CREATE SEQUENCE "public"."fake_seq";');
    await db.exec('CREATE TABLE "drizzle"."__drizzle_migrations" (id integer DEFAULT nextval(\'public.fake_seq\'::regclass) PRIMARY KEY, hash text NOT NULL, created_at bigint);');

    let errorCaught = false;
    let errorMsg = '';
    try {
      await db.exec(section5BaselineBlock);
    } catch (err: any) {
      errorCaught = true;
      errorMsg = err.message;
    }
    assert(errorCaught, 'Scenario 4: Section 5 baseline block aborted on wrong sequence default');
    assert(errorMsg.includes('Sequence drizzle.__drizzle_migrations_id_seq not found in schema "drizzle"'), `Scenario 4: Abort reason indicates sequence schema mismatch (${errorMsg})`);

    await db.close();
  }

  // =========================================================================
  // SCENARIO 5: Out-of-sync journal sequence & 3-argument setval remediation
  // =========================================================================
  console.log('\n--- SCENARIO 5: Out-of-sync journal sequence & 3-argument remediation ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);
    await db.exec('CREATE SCHEMA "drizzle";');
    await db.exec('CREATE TABLE "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);');
    await db.exec(`INSERT INTO "drizzle"."__drizzle_migrations" (id, hash, created_at) VALUES (10, '8f2418b022a42d5a10cfbfd2fb5a4eb4051f372a3e4f14c94ed3834f8fd55b3e', 1793435374100);`);

    let errorCaught = false;
    let errorMsg = '';
    try {
      await db.exec(section5BaselineBlock);
    } catch (err: any) {
      errorCaught = true;
      errorMsg = err.message;
    }
    assert(errorCaught, 'Scenario 5: Section 5 baseline block aborted on desynchronized sequence');
    assert(errorMsg.includes('COALESCE((SELECT max(id) FROM "drizzle"."__drizzle_migrations"), 1)'), 'Scenario 5: Error message recommends reviewed 3-argument setval() remediation');

    // Execute 3-argument remediation
    await db.exec(`
      SELECT setval(
        'drizzle.__drizzle_migrations_id_seq',
        COALESCE((SELECT max(id) FROM "drizzle"."__drizzle_migrations"), 1),
        (SELECT max(id) IS NOT NULL FROM "drizzle"."__drizzle_migrations")
      );
    `);

    let remediatedSuccess = false;
    try {
      await db.exec(section5BaselineBlock);
      remediatedSuccess = true;
    } catch (err: any) {
      console.error('Scenario 5 post-remediation error:', err.message);
    }
    assert(remediatedSuccess, 'Scenario 5: Baseline block succeeds after safe 3-argument setval() remediation');

    // Also test 3-argument remediation on an empty journal table
    await db.exec('TRUNCATE "drizzle"."__drizzle_migrations";');
    await db.exec(`
      SELECT setval(
        'drizzle.__drizzle_migrations_id_seq',
        COALESCE((SELECT max(id) FROM "drizzle"."__drizzle_migrations"), 1),
        (SELECT max(id) IS NOT NULL FROM "drizzle"."__drizzle_migrations")
      );
    `);
    const seqState = await db.query<{ last_value: string | bigint; is_called: boolean }>('SELECT last_value, is_called FROM "drizzle"."__drizzle_migrations_id_seq";');
    assert(String(seqState.rows[0].last_value) === '1', 'Scenario 5: Empty table setval sets last_value to 1');
    assert(seqState.rows[0].is_called === false, 'Scenario 5: Empty table setval sets is_called to false');

    await db.close();
  }

  // =========================================================================
  // SCENARIO 6: Relation-kind collision & unlisted relation kinds in public
  // =========================================================================
  console.log('\n--- SCENARIO 6: Relation-kind collision & exhaustive relation audit ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);
    await db.exec('CREATE VIEW "public"."ai_conversations" AS SELECT 1 AS id;');
    await db.exec('CREATE TABLE "public"."user_quizzes" (id varchar(36) not null) PARTITION BY LIST (id);');

    const s4Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section4Query);
    const viewCollision = s4Res.rows.find(r => r.object_name === 'ai_conversations' && r.check_category === 'DOWNSTREAM_RELATION');
    assert(viewCollision?.status === 'FAIL', 'Scenario 6: View collision on ai_conversations detected as FAIL');
    assert(viewCollision?.discrepancy_details.includes('RELATION KIND COLLISION') && viewCollision?.discrepancy_details.includes('view'), 'Scenario 6: Correctly classifies view relation kind');

    const partCollision = s4Res.rows.find(r => r.object_name === 'user_quizzes' && r.check_category === 'DOWNSTREAM_RELATION');
    assert(partCollision?.status === 'FAIL', 'Scenario 6: Partitioned table collision on user_quizzes detected as FAIL');
    assert(partCollision?.discrepancy_details.includes('RELATION KIND COLLISION') && partCollision?.discrepancy_details.includes('partitioned table'), 'Scenario 6: Correctly classifies partitioned table relation kind');

    // Create an unexpected relation in public that was not in the old fixed filter
    // PostgreSQL composite type via CREATE TYPE:
    await db.exec('CREATE TYPE "public"."unexpected_enum_rel" AS (col1 int, col2 text);');
    // Create an unlisted relation
    await db.exec('CREATE VIEW "public"."fake_report_view" AS SELECT 1;');

    const s3Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section3Query);
    const viewUnexp = s3Res.rows.find(r => r.object_name === 'public.fake_report_view');
    assert(viewUnexp?.status === 'FAIL', 'Scenario 6: Section 3 detects unexpected view');
    assert(viewUnexp?.discrepancy_details.includes('Unexpected public view') ?? false, 'Scenario 6: Section 3 correctly decodes unexpected view relation kind');

    const compUnexp = s3Res.rows.find(r => r.object_name === 'public.unexpected_enum_rel');
    assert(compUnexp?.status === 'FAIL', 'Scenario 6: Section 3 fails closed on unexpected standalone composite type');
    assert(compUnexp?.discrepancy_details.includes('Unexpected public composite type') ?? false, 'Scenario 6: Correctly identifies composite type');

    await db.close();
  }

  // =========================================================================
  // SCENARIO 7: Foreign-key identity loophole & duplicate matching FKs
  // =========================================================================
  console.log('\n--- SCENARIO 7: Foreign-key identity loophole & constraint name spoofing ---');
  {
    const db = new PGlite();
    await executeMigration(db, sql0000);
    await executeMigration(db, sql0001);

    // 7A: Injected duplicate FK on external_references(lesson_id)
    await db.exec(`
      ALTER TABLE "external_references" 
      ADD CONSTRAINT "external_references_lesson_id_duplicate_fk" 
      FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    // 7B: Constraint Name Spoofing: Table A creates a constraint using Table B's expected constraint name!
    // Specifically: "users" table adds a bogus FK named "lessons_topic_id_topics_id_fk"
    await db.exec(`
      ALTER TABLE "users"
      ADD CONSTRAINT "lessons_topic_id_topics_id_fk"
      FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    `);

    const s3Res = await db.query<{ check_category: string; object_name: string; status: string; discrepancy_details: string }>(section3Query);

    // Verify duplicate relationship detection on external_references
    const dupExpected = s3Res.rows.find(r => r.check_category === 'FOREIGN_KEY' && r.object_name === 'external_references.external_references_lesson_id_lessons_id_fk');
    assert(dupExpected?.status === 'FAIL', 'Scenario 7: Duplicate relationship causes expected FK check to FAIL');
    assert(dupExpected?.discrepancy_details.includes('DUPLICATE RELATIONSHIP: Found 2 constraints') ?? false, 'Scenario 7: Discrepancy details explicitly states DUPLICATE RELATIONSHIP');

    // Verify unexpected FK check flags the duplicate constraint
    const dupUnexpected = s3Res.rows.find(r => r.check_category === 'UNEXPECTED_FOREIGN_KEY' && r.object_name === 'external_references.external_references_lesson_id_duplicate_fk');
    assert(dupUnexpected?.status === 'FAIL', 'Scenario 7: Duplicate constraint flagged by UNEXPECTED_FOREIGN_KEY check');

    // Verify constraint name spoofing on "users" is detected
    // Since expected_fks expects "lessons_topic_id_topics_id_fk" on "lessons", NOT on "users"!
    const spoofedUnexpected = s3Res.rows.find(r => r.check_category === 'UNEXPECTED_FOREIGN_KEY' && r.object_name === 'users.lessons_topic_id_topics_id_fk');
    assert(spoofedUnexpected?.status === 'FAIL', 'Scenario 7: Spoofed constraint name on different table flagged by UNEXPECTED_FOREIGN_KEY');
    assert(spoofedUnexpected?.discrepancy_details.includes('Unexpected foreign key on public.users: lessons_topic_id_topics_id_fk') ?? false, 'Scenario 7: Scoped check rejects constraint name assigned to wrong table');

    await db.close();
  }

  console.log('\n============================================================');
  console.log(`INTEGRATION RUN COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('postgres-integration')) {
  runIntegrationTests().catch(err => {
    console.error('Fatal error during integration testing:', err);
    process.exit(1);
  });
}
