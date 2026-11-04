import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parseAnkiApkg, sanitizeAnkiHtml, MAX_APKG_SIZE } from '../api/_lib/anki-parser.js';
import {
  findImportedDeckByHash,
  getUserImportedDecks,
  getDeckWithCards,
  createImportedDeckWithCards,
  deleteImportedDeck,
  upsertCardProgress,
  withTransaction,
  query,
  isDatabaseConfigured,
} from '../api/_lib/db/client.js';

// Automatically load environment files if present
if (typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile('.env.local'); } catch {}
  try { process.loadEnvFile('.env'); } catch {}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_APKG_PATH = path.resolve(__dirname, 'fixtures', 'network-devices.apkg');
const LOCAL_OVERRIDE_PATH = process.env.ANKI_TEST_DECK_PATH;

// Use explicit local override path if provided and exists; otherwise use the repo fixture
const TEST_APKG_PATH = (LOCAL_OVERRIDE_PATH && fs.existsSync(LOCAL_OVERRIDE_PATH))
  ? LOCAL_OVERRIDE_PATH
  : FIXTURE_APKG_PATH;

async function runImporterTests() {
  console.log('=== STARTING NETMENTOR PHASE 5 FLASHCARD IMPORTER TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(`   ✗ FAILED: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`   ✓ ${msg}`);
    passed++;
  }

  // 1. Parsing Real Jeremy IT Lab CCNA .apkg File
  console.log('1. Testing Real Anki .apkg Archive Parsing (Day 01):');
  const realFileBuf = fs.readFileSync(TEST_APKG_PATH);
  const parsed = await parseAnkiApkg(realFileBuf, 'Day 01 Flashcards - Network Devices.apkg');

  assert(parsed.cardCount === 22, `Expected 22 cards, found ${parsed.cardCount}`);
  assert(parsed.deckName === '01networkdevices', `Expected deckName "01networkdevices", got "${parsed.deckName}"`);
  assert(parsed.title === 'Day 01 Flashcards - Network Devices', `Expected formatted title, got "${parsed.title}"`);
  assert(parsed.mediaCount === 5, `Expected 5 media files, found ${parsed.mediaCount}`);
  assert(parsed.sourceHash.length === 64, 'Source hash is a valid 64-char SHA-256');

  // 2. Question/Answer & Fill-in-the-Blank Extraction
  console.log('\n2. Testing Fill-in-the-Blank Bracket [...] Extraction:');
  const card0 = parsed.cards[0];
  assert(card0.cardType === 'fill_in_blank', `Expected cardType "fill_in_blank", got "${card0.cardType}"`);
  assert(card0.frontMarkdown.includes('[...]'), 'Front markdown preserves [...] placeholder');
  assert(card0.backMarkdown === 'nodes', `Expected backMarkdown "nodes", got "${card0.backMarkdown}"`);
  assert(card0.clozeData?.answer === 'nodes', 'clozeData extracted correct answer');

  // 3. Cloze Deletion Syntax {{c1::...}}
  console.log('\n3. Testing Standard Anki Cloze Deletion Syntax ({{c1::...}}):');
  const mockClozeHtml = 'The {{c1::OSPF::Protocol}} routing protocol uses port {{c2::89}} for transport.';
  const sanitizedCloze = sanitizeAnkiHtml(mockClozeHtml, {}, new Map(), []);
  const clozeMatches = [...sanitizedCloze.matchAll(/\{\{c(\d+)::([^:]+?)(?:::([^}]+))?\}\}/g)];
  assert(clozeMatches.length === 2, 'Parsed 2 cloze deletions from text');
  assert(clozeMatches[0][2] === 'OSPF' && clozeMatches[0][3] === 'Protocol', 'Extracted cloze 1 answer and hint');
  assert(clozeMatches[1][2] === '89', 'Extracted cloze 2 answer');

  // 4. Media Reference & Security Sanitization
  console.log('\n4. Testing Media Reference & Script Injection Sanitization:');
  const mediaMap = { '0': 'router.JPG' };
  const mockMediaFiles = new Map<string, Uint8Array>();
  mockMediaFiles.set('router.JPG', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])); // dummy JPEG

  const maliciousHtml = '<script>alert("pwned")</script><div>What is this?</div><img src="router.JPG"><iframe src="malicious.com"></iframe><img src="missing.png">';
  const warnings: string[] = [];
  const sanitized = sanitizeAnkiHtml(maliciousHtml, mediaMap, mockMediaFiles, warnings);

  assert(!sanitized.includes('<script>'), 'Dangerous <script> tag stripped');
  assert(!sanitized.includes('<iframe>'), 'Dangerous <iframe> tag stripped');
  assert(!sanitized.includes('malicious.com'), 'Malicious iframe payload removed');
  assert(sanitized.includes('data:image/jpeg;base64,'), 'Valid local image embedded as safe base64 data URI');
  assert(sanitized.includes('[Figure: missing.png]'), 'Missing/unresolved image converted to safe label');
  assert(warnings.length === 1, 'Warning recorded for unresolved image');

  // 5. Corrupt Archive and Malformed File Rejection
  console.log('\n5. Testing Malformed File and Archive Bomb Defense:');
  const corruptBuf = Buffer.from('not a zip file at all');
  let caughtCorrupt = false;
  try {
    await parseAnkiApkg(corruptBuf);
  } catch (err: any) {
    caughtCorrupt = true;
    assert(err.message.includes('not a valid zip'), 'Corrupted file rejected with clear error');
  }
  assert(caughtCorrupt, 'Corrupted buffer threw expected error');

  // Test missing collection.anki2
  const emptyZip = new JSZip();
  emptyZip.file('other.txt', 'hello');
  const emptyZipBuf = await emptyZip.generateAsync({ type: 'nodebuffer' });
  let caughtMissingAnki2 = false;
  try {
    await parseAnkiApkg(emptyZipBuf);
  } catch (err: any) {
    caughtMissingAnki2 = true;
    assert(err.message.includes('collection.anki2 database file was not found'), 'Missing collection.anki2 rejected');
  }
  assert(caughtMissingAnki2, 'Missing collection.anki2 threw expected error');

  // 6. Multi-User Deck & Progress Isolation in Database
  console.log('\n6. Testing Multi-User Deck & Progress Isolation in Database:');
  if (!isDatabaseConfigured()) {
    console.log('   ℹ DATABASE_URL is not configured in this environment.');
    console.log('   ℹ Skipping live PostgreSQL isolation checks (Sections 6-10) for offline/CI portability.\n');
    console.log('=============================================================');
    console.log(`✓ ALL ${passed} IMPORTER UNIT & PARSER TESTS PASSED CLEANLY! (0 failures)`);
    console.log('=============================================================\n');
    process.exit(0);
  }

  // Look up seeded admin and standard user
  const usersRes = await query(`SELECT id, username FROM users WHERE username IN ('jenilmoradiya50@admin', 'jenilmoradiya50')`);
  const admin = usersRes.rows.find((u: any) => u.username === 'jenilmoradiya50@admin');
  const student = usersRes.rows.find((u: any) => u.username === 'jenilmoradiya50');

  assert(Boolean(admin && student), 'Both test users found in Neon database');

  const testHashA = crypto.randomBytes(32).toString('hex');
  const testHashB = crypto.randomBytes(32).toString('hex');

  // Import deck for Admin
  const adminDeckResult = await createImportedDeckWithCards(
    admin.id,
    {
      sourceType: 'anki_apkg',
      sourceName: 'test-admin-deck.apkg',
      sourceHash: testHashA,
      deckName: 'admin_test_deck',
      title: 'Admin Test Deck',
    },
    [
      {
        orderIndex: 0,
        frontMarkdown: 'Admin Question 1: What is administrative distance of OSPF?',
        backMarkdown: '110',
        cardType: 'basic',
      },
      {
        orderIndex: 1,
        frontMarkdown: 'Admin Question 2: What is administrative distance of EIGRP internal?',
        backMarkdown: '90',
        cardType: 'basic',
      },
    ],
  );

  assert(!adminDeckResult.alreadyImported, 'Admin deck created successfully');

  // Import deck for Student
  const studentDeckResult = await createImportedDeckWithCards(
    student.id,
    {
      sourceType: 'anki_apkg',
      sourceName: 'test-student-deck.apkg',
      sourceHash: testHashB,
      deckName: 'student_test_deck',
      title: 'Student Test Deck',
    },
    [
      {
        orderIndex: 0,
        frontMarkdown: 'Student Question 1: What is default gateway?',
        backMarkdown: 'Router interface on the local subnet',
        cardType: 'basic',
      },
    ],
  );

  assert(!studentDeckResult.alreadyImported, 'Student deck created successfully');

  // Verify Admin cannot see Student's decks
  const adminDecks = await getUserImportedDecks(admin.id);
  const studentDecks = await getUserImportedDecks(student.id);

  assert(adminDecks.some((d: any) => d.id === adminDeckResult.deckId), 'Admin can view own deck');
  assert(!adminDecks.some((d: any) => d.id === studentDeckResult.deckId), 'Admin CANNOT view Student private deck');
  assert(studentDecks.some((d: any) => d.id === studentDeckResult.deckId), 'Student can view own deck');
  assert(!studentDecks.some((d: any) => d.id === adminDeckResult.deckId), 'Student CANNOT view Admin private deck');

  // Verify getDeckWithCards enforces strict ownership
  const studentAccessToAdminDeck = await getDeckWithCards(student.id, adminDeckResult.deckId);
  assert(studentAccessToAdminDeck === null, 'Student access to Admin deck rejected with null (strictly isolated)');

  // 7. Duplicate Import Handling & Progress Preservation
  console.log('\n7. Testing Duplicate Import Idempotency:');
  const duplicateImportResult = await createImportedDeckWithCards(
    admin.id,
    {
      sourceType: 'anki_apkg',
      sourceName: 'test-admin-deck.apkg',
      sourceHash: testHashA, // Same hash
      deckName: 'admin_test_deck',
      title: 'Admin Test Deck',
    },
    [
      {
        orderIndex: 0,
        frontMarkdown: 'Ignored duplicate question',
        backMarkdown: 'Ignored',
        cardType: 'basic',
      },
    ],
  );

  assert(duplicateImportResult.alreadyImported === true, 'Duplicate import detected and flagged alreadyImported=true');
  assert(duplicateImportResult.deckId === adminDeckResult.deckId, 'Returned original deck ID without creating duplicate');

  // 8. Study Progress Persistence
  console.log('\n8. Testing Flashcard Progress Tracking:');
  const adminCards = (await getDeckWithCards(admin.id, adminDeckResult.deckId))!.cards;
  const targetCard = adminCards[0];

  const p1 = await upsertCardProgress(admin.id, targetCard.id, adminDeckResult.deckId, 'mastered', 5);
  assert(p1.status === 'mastered', 'Progress saved with status "mastered"');
  assert(p1.confidenceScore === 5, 'Progress saved with score 5');
  assert(p1.reviewCount === 1, 'Review count incremented to 1');

  // Review same card again
  const p2 = await upsertCardProgress(admin.id, targetCard.id, adminDeckResult.deckId, 'review', 2);
  assert(p2.status === 'review', 'Progress updated to status "review"');
  assert(p2.confidenceScore === 2, 'Confidence score updated to 2');
  assert(p2.reviewCount === 2, 'Review count incremented to 2');

  // Verify progress is reflected in getDeckWithCards
  const updatedDeck = await getDeckWithCards(admin.id, adminDeckResult.deckId);
  const updatedCard = updatedDeck!.cards.find((c: any) => c.id === targetCard.id);
  assert(updatedCard?.progress?.status === 'review', 'getDeckWithCards reflects persistent progress');
  assert(updatedCard?.progress?.reviewCount === 2, 'getDeckWithCards reflects correct reviewCount');

  // 9. Atomic Transaction Rollback on Import Failure
  console.log('\n9. Testing Transaction Rollback on Import Failure:');
  let rollbackCaught = false;
  const failingHash = crypto.randomBytes(32).toString('hex');
  try {
    await withTransaction(async (client) => {
      // Step 1: insert deck
      const fakeDeckId = crypto.randomUUID();
      await client.query(
        `INSERT INTO imported_decks (id, user_id, source_type, source_name, source_hash, deck_name, title, card_count)
         VALUES ($1, $2, 'test', 'fail.apkg', $3, 'fail_deck', 'Fail Deck', 1);`,
        [fakeDeckId, admin.id, failingHash],
      );

      // Step 2: simulate catastrophic failure (e.g. invalid query)
      throw new Error('Simulated mid-import catastrophic network error');
    });
  } catch (err: any) {
    rollbackCaught = true;
    assert(err.message.includes('Simulated mid-import'), 'Transaction threw expected error');
  }
  assert(rollbackCaught, 'Transaction caught simulated failure');

  // Verify that the deck was NOT committed to the database
  const checkFail = await findImportedDeckByHash(admin.id, failingHash);
  assert(checkFail === null, 'Transaction rolled back completely: zero orphaned rows in imported_decks');

  // Clean up test decks (cascades to cards and progress)
  console.log('\n10. Cleaning up test data:');
  const d1 = await deleteImportedDeck(admin.id, adminDeckResult.deckId);
  const d2 = await deleteImportedDeck(student.id, studentDeckResult.deckId);
  assert(d1 && d2, 'Both test decks deleted cleanly with cascading cleanup');

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} IMPORTER & STUDY TESTS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================\n');
  process.exit(0);
}

runImporterTests().catch((err) => {
  console.error('\nImporter Test Suite Failed:', err);
  process.exit(1);
});
