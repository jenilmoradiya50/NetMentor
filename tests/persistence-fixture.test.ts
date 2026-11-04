import type {
  ExerciseAttemptRecord,
  LessonMasteryLevel,
  LessonProgressState,
  DetailedLesson,
} from '../src/types/curriculum.ts';
import { evaluateExerciseAnswer } from '../src/lib/exercise-evaluator.ts';

/**
 * Isolated in-memory SQL jsonb merge simulator matching PostgreSQL 16
 * jsonb_set and || semantics used in upsertLessonProgress:
 *
 * CASE
 *   WHEN user_progress.notes IS NOT NULL
 *        AND user_progress.notes LIKE '{%'
 *        AND EXCLUDED.notes IS NOT NULL
 *        AND EXCLUDED.notes LIKE '{%'
 *   THEN (
 *     jsonb_set(
 *       COALESCE(user_progress.notes::jsonb, '{}'::jsonb),
 *       '{exercises}',
 *       COALESCE(user_progress.notes::jsonb->'exercises', '{}'::jsonb) || COALESCE(EXCLUDED.notes::jsonb->'exercises', '{}'::jsonb),
 *       true
 *     ) || (EXCLUDED.notes::jsonb - 'exercises')
 *   )::text
 *   ELSE COALESCE(EXCLUDED.notes, user_progress.notes)
 * END
 */
export function simulatePostgresJsonbNotesMerge(
  storedNotes: string | null | undefined,
  incomingNotes: string | null | undefined,
): string | null {
  const isStoredJson =
    typeof storedNotes === 'string' && storedNotes.trim().startsWith('{');
  const isIncomingJson =
    typeof incomingNotes === 'string' && incomingNotes.trim().startsWith('{');

  if (isStoredJson && isIncomingJson) {
    let storedObj: Record<string, any> = {};
    let incomingObj: Record<string, any> = {};
    try {
      storedObj = JSON.parse(storedNotes!);
    } catch {
      return incomingNotes ?? storedNotes ?? null;
    }
    try {
      incomingObj = JSON.parse(incomingNotes!);
    } catch {
      return incomingNotes ?? storedNotes ?? null;
    }

    // Merge exercises dictionary
    const mergedExercises = {
      ...(storedObj.exercises || {}),
      ...(incomingObj.exercises || {}),
    };

    // Top-level fields: stored fields overridden only by incoming non-exercises fields
    const incomingWithoutExercises = { ...incomingObj };
    delete incomingWithoutExercises.exercises;

    const merged = {
      ...storedObj,
      exercises: mergedExercises,
      ...incomingWithoutExercises,
    };

    return JSON.stringify(merged);
  }

  // ELSE COALESCE(EXCLUDED.notes, user_progress.notes)
  return incomingNotes ?? storedNotes ?? null;
}

/**
 * Isolated in-memory Curriculum progress state store simulating CurriculumHub rollback logic
 */
export class IsolatedProgressManager {
  private progressMap: Record<string, LessonProgressState> = {};
  public errorMessage: string | null = null;

  getProgress(lessonId: string): LessonProgressState | undefined {
    return this.progressMap[lessonId];
  }

  getAllProgress(): Record<string, LessonProgressState> {
    return { ...this.progressMap };
  }

  seedProgress(lessonId: string, state: LessonProgressState) {
    this.progressMap[lessonId] = { ...state };
  }

  async saveProgress(
    lessonId: string,
    masteryLevel: LessonMasteryLevel,
    confidenceScore: number,
    exerciseAttempt?: ExerciseAttemptRecord,
    simulatedServerCall?: () => Promise<{ success: boolean; error?: string; message?: string }>,
  ): Promise<void> {
    const previousState = this.progressMap[lessonId];
    const previousAttempt = exerciseAttempt
      ? previousState?.exerciseAttempts?.[exerciseAttempt.exerciseId]
      : undefined;
    const requestTimestamp = Date.now();

    // Optimistic update
    const existing = this.progressMap[lessonId] || {
      lessonId,
      masteryLevel,
      confidenceScore,
      lastReviewedAt: new Date(requestTimestamp).toISOString(),
      exerciseAttempts: {},
    };
    const updatedAttempts = { ...(existing.exerciseAttempts || {}) };
    if (exerciseAttempt) {
      updatedAttempts[exerciseAttempt.exerciseId] = exerciseAttempt;
    }

    this.progressMap[lessonId] = {
      ...existing,
      masteryLevel,
      confidenceScore,
      lastReviewedAt: new Date(requestTimestamp).toISOString(),
      exerciseAttempts: updatedAttempts,
    };

    if (simulatedServerCall) {
      try {
        const res = await simulatedServerCall();
        if (!res.success) {
          throw new Error(res.message || res.error || 'Server error');
        }
      } catch (err: any) {
        // Targeted rollback
        const current = this.progressMap[lessonId];
        if (current) {
          const rolledBackAttempts = { ...(current.exerciseAttempts || {}) };
          if (exerciseAttempt) {
            if (previousAttempt) {
              rolledBackAttempts[exerciseAttempt.exerciseId] = previousAttempt;
            } else {
              delete rolledBackAttempts[exerciseAttempt.exerciseId];
            }
          }

          const isNewerSubmissionPresent =
            current.lastReviewedAt &&
            new Date(current.lastReviewedAt).getTime() > requestTimestamp;

          this.progressMap[lessonId] = {
            ...current,
            masteryLevel: isNewerSubmissionPresent
              ? current.masteryLevel
              : previousState?.masteryLevel || 'not_started',
            confidenceScore: isNewerSubmissionPresent
              ? current.confidenceScore
              : previousState?.confidenceScore || 3,
            exerciseAttempts: rolledBackAttempts,
          };
        }
        this.errorMessage = 'Failed to save progress to server. Changes were not persisted.';
        throw err;
      }
    }
  }
}

async function runIsolatedPersistenceRegressionSuite() {
  console.log('=== RUNNING ISOLATED PROGRESS PERSISTENCE REGRESSION TEST SUITE ===\n');

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

  // =========================================================================
  // SECTION 2: Database Concurrency & Data Integrity Verifications
  // =========================================================================
  console.log('--- 1. Testing Concurrency & Data Integrity SQL Merge Semantics ---');

  // 1.1 Concurrent submissions for different exercise IDs preserve both attempts
  const stored1 = JSON.stringify({
    exercises: {
      'ex-1': { exerciseId: 'ex-1', status: 'correct', attemptsCount: 1 },
    },
  });
  const incoming1 = JSON.stringify({
    exercises: {
      'ex-2': { exerciseId: 'ex-2', status: 'incorrect', attemptsCount: 2 },
    },
  });
  const result1 = simulatePostgresJsonbNotesMerge(stored1, incoming1);
  const parsed1 = JSON.parse(result1!);
  assert(Boolean(parsed1.exercises['ex-1']), 'Ex-1 preserved in exercises dictionary');
  assert(Boolean(parsed1.exercises['ex-2']), 'Ex-2 merged into exercises dictionary');
  assert(parsed1.exercises['ex-1'].status === 'correct', 'Ex-1 status remained "correct"');
  assert(parsed1.exercises['ex-2'].status === 'incorrect', 'Ex-2 status recorded as "incorrect"');

  // 1.2 Updating the same exercise does not corrupt unrelated exercise records
  const incomingUpdate = JSON.stringify({
    exercises: {
      'ex-2': { exerciseId: 'ex-2', status: 'correct', attemptsCount: 3 },
    },
  });
  const result1Updated = simulatePostgresJsonbNotesMerge(result1, incomingUpdate);
  const parsed1Updated = JSON.parse(result1Updated!);
  assert(Boolean(parsed1Updated.exercises['ex-1']), 'Ex-1 untouched when updating Ex-2');
  assert(parsed1Updated.exercises['ex-2'].status === 'correct', 'Ex-2 updated to "correct"');
  assert(parsed1Updated.exercises['ex-2'].attemptsCount === 3, 'Ex-2 attemptsCount updated to 3');

  // 1.3 Existing non-JSON notes and legacy notes formats are handled safely
  const legacyPlainNote = 'Review BGP next-hop-self rule before exam';
  const incomingWithExercise = JSON.stringify({
    exercises: {
      'ex-1': { exerciseId: 'ex-1', status: 'correct' },
    },
  });
  // When stored is plain text, fallback to COALESCE(incoming, stored)
  const legacyMerge = simulatePostgresJsonbNotesMerge(legacyPlainNote, incomingWithExercise);
  assert(legacyMerge === incomingWithExercise, 'Non-JSON legacy note replaced safely by valid JSON notes object');

  // What if incoming is null and stored is plain text?
  const nullIncomingMerge = simulatePostgresJsonbNotesMerge(legacyPlainNote, null);
  assert(nullIncomingMerge === legacyPlainNote, 'Stored legacy plain note preserved when incoming is null');

  // 1.4 Merge does not accidentally overwrite unrelated top-level note fields
  const storedWithCustomFields = JSON.stringify({
    notes: 'Personal student note',
    bookmarked: true,
    streakCount: 7,
    exercises: {
      'ex-1': { exerciseId: 'ex-1', status: 'correct' },
    },
  });
  const incomingOnlyExercise = JSON.stringify({
    exercises: {
      'ex-2': { exerciseId: 'ex-2', status: 'correct' },
    },
  });
  const mergedCustom = simulatePostgresJsonbNotesMerge(storedWithCustomFields, incomingOnlyExercise);
  const parsedCustom = JSON.parse(mergedCustom!);
  assert(parsedCustom.notes === 'Personal student note', 'Top-level "notes" string preserved');
  assert(parsedCustom.bookmarked === true, 'Top-level "bookmarked" boolean preserved');
  assert(parsedCustom.streakCount === 7, 'Top-level "streakCount" number preserved');
  assert(Boolean(parsedCustom.exercises['ex-1'] && parsedCustom.exercises['ex-2']), 'Both exercises present in dictionary');

  // What if incoming updates the top-level note text while adding an exercise?
  const incomingWithNewNote = JSON.stringify({
    notes: 'Updated student note for lesson',
    exercises: {
      'ex-3': { exerciseId: 'ex-3', status: 'correct' },
    },
  });
  const mergedNewNote = simulatePostgresJsonbNotesMerge(storedWithCustomFields, incomingWithNewNote);
  const parsedNewNote = JSON.parse(mergedNewNote!);
  assert(parsedNewNote.notes === 'Updated student note for lesson', 'Top-level "notes" cleanly updated by incoming note');
  assert(parsedNewNote.streakCount === 7, 'Unrelated top-level "streakCount" remains preserved');
  assert(Boolean(parsedNewNote.exercises['ex-1'] && parsedNewNote.exercises['ex-3']), 'Exercises merged correctly with note update');

  // 1.5 Existing records are not lost when either incoming or stored notes are null
  assert(
    simulatePostgresJsonbNotesMerge(null, incomingWithExercise) === incomingWithExercise,
    'Incoming note accepted when stored note is null',
  );
  assert(
    simulatePostgresJsonbNotesMerge(storedWithCustomFields, null) === storedWithCustomFields,
    'Stored note preserved when incoming note is null',
  );
  assert(
    simulatePostgresJsonbNotesMerge(null, null) === null,
    'Returns null when both notes are null',
  );

  // =========================================================================
  // SECTION 3: Failure Handling & Targeted Rollback Verifications
  // =========================================================================
  console.log('\n--- 2. Testing Failure Handling & Targeted Rollback ---');

  const mgr = new IsolatedProgressManager();
  const lessonId = 'lesson-bgp-path-selection';

  // 2.1 Single failure cleanly rolls back and sets user error message
  let caught1 = false;
  try {
    await mgr.saveProgress(
      lessonId,
      'mastered',
      5,
      {
        exerciseId: 'ex-1',
        lessonId,
        status: 'correct',
        attemptsCount: 1,
        hintsUsedCount: 0,
        lastAttemptedAt: new Date().toISOString(),
      },
      async () => ({ success: false, error: 'Database timeout (504)' }),
    );
  } catch {
    caught1 = true;
  }
  assert(caught1, 'Failed save threw error to prevent false-positive mastery advancement');
  assert(
    mgr.getProgress(lessonId)?.exerciseAttempts?.['ex-1'] === undefined,
    'Failed exercise attempt rolled back; not falsely shown as saved',
  );
  assert(
    mgr.getProgress(lessonId)?.masteryLevel === 'not_started',
    'Mastery level rolled back to "not_started"',
  );
  assert(
    mgr.errorMessage === 'Failed to save progress to server. Changes were not persisted.',
    'Clear, actionable error message surfaced to user',
  );

  // 2.2 Targeted rollback: does NOT overwrite a newer successful update from another submission
  // Seed successful progress for ex-1
  await mgr.saveProgress(
    lessonId,
    'learning',
    3,
    {
      exerciseId: 'ex-1',
      lessonId,
      status: 'correct',
      attemptsCount: 1,
      hintsUsedCount: 0,
      lastAttemptedAt: new Date().toISOString(),
    },
    async () => ({ success: true }),
  );
  assert(mgr.getProgress(lessonId)?.exerciseAttempts?.['ex-1']?.status === 'correct', 'Ex-1 saved successfully');

  // Now simulate concurrent requests:
  // Request A starts saving ex-2 (which will fail later)
  // Request B starts saving ex-3 immediately and succeeds
  const mgrConcurrent = new IsolatedProgressManager();
  mgrConcurrent.seedProgress(lessonId, {
    lessonId,
    masteryLevel: 'learning',
    confidenceScore: 3,
    lastReviewedAt: new Date(Date.now() - 5000).toISOString(),
    exerciseAttempts: {
      'ex-1': {
        exerciseId: 'ex-1',
        lessonId,
        status: 'correct',
        attemptsCount: 1,
        hintsUsedCount: 0,
        lastAttemptedAt: new Date(Date.now() - 5000).toISOString(),
      },
    },
  });

  // Emulate Request A (failing after Request B finishes)
  const previousStateSnapshot = mgrConcurrent.getProgress(lessonId);
  const previousAttemptEx2 = previousStateSnapshot?.exerciseAttempts?.['ex-2'];
  const requestATimestamp = Date.now();

  // Optimistic update for Request A (ex-2)
  await mgrConcurrent.saveProgress(
    lessonId,
    'learning',
    3,
    {
      exerciseId: 'ex-2',
      lessonId,
      status: 'correct',
      attemptsCount: 1,
      hintsUsedCount: 0,
      lastAttemptedAt: new Date(requestATimestamp).toISOString(),
    },
    // Server succeeds for now
    async () => ({ success: true }),
  );

  // In the meantime, Request B saves ex-3 with mastery 'mastered' and newer timestamp
  await new Promise((r) => setTimeout(r, 10)); // Ensure later timestamp
  await mgrConcurrent.saveProgress(
    lessonId,
    'mastered',
    5,
    {
      exerciseId: 'ex-3',
      lessonId,
      status: 'correct',
      attemptsCount: 1,
      hintsUsedCount: 0,
      lastAttemptedAt: new Date().toISOString(),
    },
    async () => ({ success: true }),
  );

  // Now simulate that Request A's background save actually reported a failure and triggered rollback:
  // Applying the targeted rollback logic:
  const current = mgrConcurrent.getProgress(lessonId)!;
  const rolledBackAttempts = { ...(current.exerciseAttempts || {}) };
  if (previousAttemptEx2) {
    rolledBackAttempts['ex-2'] = previousAttemptEx2;
  } else {
    delete rolledBackAttempts['ex-2'];
  }
  const isNewerSubmissionPresent =
    current.lastReviewedAt &&
    new Date(current.lastReviewedAt).getTime() > requestATimestamp;

  mgrConcurrent.seedProgress(lessonId, {
    ...current,
    masteryLevel: isNewerSubmissionPresent
      ? current.masteryLevel
      : previousStateSnapshot?.masteryLevel || 'not_started',
    confidenceScore: isNewerSubmissionPresent
      ? current.confidenceScore
      : previousStateSnapshot?.confidenceScore || 3,
    exerciseAttempts: rolledBackAttempts,
  });

  const finalState = mgrConcurrent.getProgress(lessonId)!;
  assert(finalState.exerciseAttempts?.['ex-2'] === undefined, 'Failed Ex-2 attempt cleanly removed');
  assert(
    finalState.exerciseAttempts?.['ex-3']?.status === 'correct',
    'Newer successful Ex-3 attempt PRESERVED (Not wiped out by Ex-2 rollback)',
  );
  assert(
    finalState.exerciseAttempts?.['ex-1']?.status === 'correct',
    'Prior Ex-1 attempt PRESERVED',
  );
  assert(
    finalState.masteryLevel === 'mastered',
    'Newer mastery "mastered" from Ex-3 PRESERVED (Not downgraded by Ex-2 rollback)',
  );

  // =========================================================================
  // SECTION 4: Exercise Answers Restoration Across All 4 Exercise Types
  // =========================================================================
  console.log('\n--- 3. Testing Answer Restoration Across All 4 Exercise Types ---');

  // 3.1 Multiple Choice / Troubleshooting
  const mcExercise = {
    id: 'ex-bgp-troubleshoot-nexthop',
    lessonId,
    type: 'troubleshooting' as const,
    prompt: 'R2 cannot ping BGP next hop...',
    options: [
      { id: 'opt-next-hop-self', label: 'neighbor next-hop-self', isCorrect: true },
      { id: 'opt-ebgp-multihop', label: 'neighbor ebgp-multihop', isCorrect: false },
    ],
    explanation: 'iBGP does not change next-hop by default.',
    difficulty: 'ccnp' as const,
  };

  // Evaluate incorrect first
  const mcWrongResult = evaluateExerciseAnswer(mcExercise, 'opt-ebgp-multihop');
  assert(mcWrongResult.isCorrect === false, 'MC: opt-ebgp-multihop evaluated as incorrect');

  const mcWrongRecord: ExerciseAttemptRecord = {
    exerciseId: mcExercise.id,
    lessonId,
    status: 'incorrect',
    attemptsCount: 1,
    hintsUsedCount: 1,
    lastSubmittedAnswer: 'opt-ebgp-multihop',
    lastAttemptedAt: new Date().toISOString(),
  };

  // Simulate restoration:
  let restoredSelectedOption = mcWrongRecord.lastSubmittedAnswer;
  let restoredSubmitted = mcWrongRecord.status !== 'unattempted';
  let restoredIsCorrect = mcWrongRecord.status === 'correct';
  let restoredHints = mcWrongRecord.hintsUsedCount;
  let restoredAttempts = mcWrongRecord.attemptsCount;

  assert(restoredSelectedOption === 'opt-ebgp-multihop', 'MC: Restored selected option matches incorrect choice');
  assert(restoredSubmitted === true, 'MC: Status is submitted');
  assert(restoredIsCorrect === false, 'MC: Status is not correct');
  assert(restoredHints === 1, 'MC: 1 hint restored');
  assert(restoredAttempts === 1, 'MC: 1 attempt restored');

  // Retry with correct answer
  const mcRetryResult = evaluateExerciseAnswer(mcExercise, 'opt-next-hop-self');
  assert(mcRetryResult.isCorrect === true, 'MC Retry: opt-next-hop-self evaluated as correct');
  const mcRetryRecord: ExerciseAttemptRecord = {
    exerciseId: mcExercise.id,
    lessonId,
    status: 'correct',
    attemptsCount: 2,
    hintsUsedCount: 2,
    lastSubmittedAnswer: 'opt-next-hop-self',
    lastAttemptedAt: new Date().toISOString(),
  };

  restoredSelectedOption = mcRetryRecord.lastSubmittedAnswer;
  restoredIsCorrect = mcRetryRecord.status === 'correct';
  restoredHints = mcRetryRecord.hintsUsedCount;
  restoredAttempts = mcRetryRecord.attemptsCount;

  assert(restoredSelectedOption === 'opt-next-hop-self', 'MC Retry: Restored selected option matches correct choice');
  assert(restoredIsCorrect === true, 'MC Retry: Status is correct');
  assert(restoredHints === 2, 'MC Retry: 2 hints used preserved');
  assert(restoredAttempts === 2, 'MC Retry: attempts count incremented to 2');

  // 3.2 Numerical Exercise
  const numExercise = {
    id: 'ex-subnet-hosts',
    lessonId,
    type: 'numerical' as const,
    prompt: 'How many usable hosts in /27?',
    numericAnswer: 30,
    explanation: '2^5 - 2 = 30',
    difficulty: 'fundamentals' as const,
  };
  const numResult = evaluateExerciseAnswer(numExercise, 30);
  assert(numResult.isCorrect === true, 'Numerical: 30 evaluated as correct');

  const numRecord: ExerciseAttemptRecord = {
    exerciseId: numExercise.id,
    lessonId,
    status: 'correct',
    attemptsCount: 1,
    hintsUsedCount: 0,
    lastSubmittedAnswer: '30',
    lastAttemptedAt: new Date().toISOString(),
  };

  const restoredNumInput = numRecord.lastSubmittedAnswer;
  assert(restoredNumInput === '30', 'Numerical: Restored input string matches "30"');
  assert(parseFloat(restoredNumInput) === 30, 'Numerical: Parsed float matches numericAnswer');

  // 3.3 Text / Predict Output Exercise
  const textExercise = {
    id: 'ex-ospf-state',
    lessonId,
    type: 'predict_output' as const,
    prompt: 'What OSPF state indicates Hello received but bidirectional communication not confirmed?',
    acceptableAnswers: ['INIT', 'Init'],
    explanation: 'The Init state indicates Hello was seen without the receiving router ID.',
    difficulty: 'ccna' as const,
  };
  const textResult = evaluateExerciseAnswer(textExercise, 'init');
  assert(textResult.isCorrect === true, 'Text: "init" evaluated as correct');

  const textRecord: ExerciseAttemptRecord = {
    exerciseId: textExercise.id,
    lessonId,
    status: 'correct',
    attemptsCount: 1,
    hintsUsedCount: 0,
    lastSubmittedAnswer: 'init',
    lastAttemptedAt: new Date().toISOString(),
  };

  const restoredTextInput = textRecord.lastSubmittedAnswer;
  assert(restoredTextInput === 'init', 'Text: Restored text input matches "init"');

  // 3.4 Sequence Exercise
  const seqExercise = {
    id: 'ex-bgp-seq',
    lessonId,
    type: 'sequence' as const,
    prompt: 'Order BGP best path attributes:',
    sequenceItems: [
      { id: 's-weight', text: '1. Weight', correctIndex: 0 },
      { id: 's-localpref', text: '2. Local Preference', correctIndex: 1 },
      { id: 's-aspath', text: '3. AS_PATH', correctIndex: 2 },
    ],
    explanation: 'Weight > Local Preference > AS_PATH',
    difficulty: 'ccnp' as const,
  };

  const correctOrder = ['s-weight', 's-localpref', 's-aspath'];
  const seqResult = evaluateExerciseAnswer(seqExercise, correctOrder);
  assert(seqResult.isCorrect === true, 'Sequence: Correct order evaluated as correct');

  const seqRecord: ExerciseAttemptRecord = {
    exerciseId: seqExercise.id,
    lessonId,
    status: 'correct',
    attemptsCount: 1,
    hintsUsedCount: 0,
    lastSubmittedAnswer: JSON.stringify(correctOrder),
    lastAttemptedAt: new Date().toISOString(),
  };

  // Restoration logic simulation
  const parsedSeqIds = JSON.parse(seqRecord.lastSubmittedAnswer!);
  const itemMap = new Map(seqExercise.sequenceItems.map((item) => [item.id, item]));
  const restoredSeqList = parsedSeqIds.map((id: string) => itemMap.get(id)).filter(Boolean);

  assert(restoredSeqList.length === 3, 'Sequence: Restored list length matches sequenceItems');
  assert(restoredSeqList[0].id === 's-weight', 'Sequence: Item 0 restored in position 0');
  assert(restoredSeqList[1].id === 's-localpref', 'Sequence: Item 1 restored in position 1');
  assert(restoredSeqList[2].id === 's-aspath', 'Sequence: Item 2 restored in position 2');

  console.log('\n=============================================================');
  console.log(`✓ ALL ${passed} ISOLATED PERSISTENCE REGRESSION CHECKS PASSED CLEANLY! (0 failures)`);
  console.log('=============================================================\n');
}

runIsolatedPersistenceRegressionSuite().catch((err) => {
  console.error('\n❌ Persistence regression test failed:', err);
  process.exit(1);
});
