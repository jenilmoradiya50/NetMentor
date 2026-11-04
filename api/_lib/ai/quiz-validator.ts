/**
 * NetMentor AI Tutor Engine - Pure TypeScript Quiz Validator & Grader (Milestone: AI Quiz Generation)
 *
 * Validates and normalizes structured AI-generated quiz payloads.
 * Strips answer keys and explanations before exposing to clients.
 * Provides deterministic server-side grading with strict set matching for multi-select.
 * Zero external npm dependencies.
 */

import type {
  GeneratedQuiz,
  GeneratedQuizQuestion,
  ClientQuiz,
  ClientQuizQuestion,
  QuizValidationResult,
  QuizQuestionType,
  QuizDifficulty,
  QuizQuestionOption,
  QuizSubmissionPayload,
  GradedQuestionResult,
} from './types.js';
import { extractJsonFromText } from './lesson-validator.js';

export { extractJsonFromText };

/**
 * Normalizes question type synonyms to the canonical union:
 * 'single_choice' | 'multiple_select' | 'true_false' | 'scenario'
 */
export function normalizeQuestionType(rawType: unknown): QuizQuestionType {
  if (typeof rawType !== 'string') return 'single_choice';
  const clean = rawType.toLowerCase().trim().replace(/[-_ ]/g, '');

  if (clean.includes('multiselect') || clean.includes('multipleselect') || clean.includes('multichoice') || clean === 'multiple') {
    return 'multiple_select';
  }
  if (clean.includes('truefalse') || clean.includes('tf') || clean === 'boolean') {
    return 'true_false';
  }
  if (clean.includes('scenario') || clean.includes('troubleshoot') || clean.includes('casestudy') || clean.includes('incident')) {
    return 'scenario';
  }
  return 'single_choice';
}

/**
 * Normalizes difficulty synonyms to 'easy' | 'medium' | 'hard'
 */
export function normalizeQuizDifficulty(rawDiff: unknown): QuizDifficulty {
  if (typeof rawDiff !== 'string') return 'medium';
  const clean = rawDiff.toLowerCase().trim();
  if (clean.includes('easy') || clean.includes('begin') || clean.includes('fundam')) return 'easy';
  if (clean.includes('hard') || clean.includes('advanc') || clean.includes('expert')) return 'hard';
  return 'medium';
}

/**
 * Validates and normalizes raw AI-generated quiz JSON into a strongly typed GeneratedQuiz.
 */
export function validateGeneratedQuiz(
  raw: unknown,
  expectedCount?: number,
): QuizValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      errors: ['Quiz payload must be a JSON object or array of questions.'],
    };
  }

  let obj: Record<string, any>;
  if (Array.isArray(raw)) {
    obj = { questions: raw };
  } else {
    obj = { ...(raw as Record<string, any>) };
  }

  // Normalize nested envelopes
  if (obj.quiz && typeof obj.quiz === 'object' && !Array.isArray(obj.quiz)) {
    obj = { ...obj.quiz, ...obj, questions: obj.questions || obj.quiz.questions || obj.quiz.items };
  } else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    obj = { ...obj.data, ...obj, questions: obj.questions || obj.data.questions || obj.data.items };
  } else if (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)) {
    obj = { ...obj.result, ...obj, questions: obj.questions || obj.result.questions || obj.result.items };
  } else if (obj.results && typeof obj.results === 'object' && !Array.isArray(obj.results)) {
    obj = { ...obj.results, ...obj, questions: obj.questions || obj.results.questions || obj.results.items };
  } else if (obj.response && typeof obj.response === 'object' && !Array.isArray(obj.response)) {
    obj = { ...obj.response, ...obj, questions: obj.questions || obj.response.questions || obj.response.items };
  }

  // 1. Title Normalization
  const rawTitle =
    obj.title ||
    obj.quizTitle ||
    obj.quiz_title ||
    obj.name ||
    obj.topic;
  let title = 'AI Networking Knowledge Assessment';
  if (typeof rawTitle === 'string' && rawTitle.trim()) {
    title = rawTitle.trim().slice(0, 255);
  }

  // 2. Topic Normalization
  const rawTopic = obj.topic || obj.subject || obj.category || title;
  let topic = 'Network Engineering';
  if (typeof rawTopic === 'string' && rawTopic.trim()) {
    topic = rawTopic.trim().slice(0, 255);
  }

  // 3. Difficulty
  const difficulty: QuizDifficulty = normalizeQuizDifficulty(obj.difficulty);

  // 4. Questions Array Normalization
  let candidateQuestions =
    obj.questions ||
    obj.items ||
    obj.quiz ||
    obj.assessment ||
    obj.list ||
    obj.results ||
    obj.questionsList ||
    obj.questions_list;

  if (candidateQuestions && typeof candidateQuestions === 'object' && !Array.isArray(candidateQuestions)) {
    candidateQuestions = Object.values(candidateQuestions);
  }

  if (!Array.isArray(candidateQuestions) || candidateQuestions.length === 0) {
    errors.push('Quiz must contain a non-empty "questions" array.');
    return { valid: false, errors };
  }

  const validatedQuestions: GeneratedQuizQuestion[] = [];
  const questionTypesSet = new Set<QuizQuestionType>();

  for (let i = 0; i < candidateQuestions.length; i++) {
    const qRaw = candidateQuestions[i];
    if (!qRaw || typeof qRaw !== 'object') {
      errors.push(`Question at index ${i} is not a valid object.`);
      continue;
    }

    const qNum = i + 1;
    const qId = typeof qRaw.id === 'string' && qRaw.id.trim() ? qRaw.id.trim() : `q-${qNum}`;
    const qType = normalizeQuestionType(qRaw.type || qRaw.questionType || qRaw.question_type);
    questionTypesSet.add(qType);

    // 1. Resolve Question Prompt Text across standard LLM synonyms
    let questionText = (
      qRaw.question ||
      qRaw.prompt ||
      qRaw.questionText ||
      qRaw.question_text ||
      qRaw.scenarioQuestion ||
      qRaw.scenario_question ||
      qRaw.query ||
      qRaw.text ||
      ''
    ).toString().trim();

    // 2. Resolve Scenario Context across standard LLM synonyms
    let scenarioContext: string | undefined = undefined;
    const rawScenario = (
      qRaw.scenarioContext ||
      qRaw.scenario_context ||
      qRaw.scenario ||
      qRaw.context ||
      qRaw.incident ||
      qRaw.problem ||
      qRaw.topology ||
      qRaw.caseStudy ||
      qRaw.case_study ||
      qRaw.troubleshootingScenario ||
      qRaw.troubleshooting_scenario ||
      qRaw.diagnosticOutput ||
      qRaw.diagnostic_output ||
      ''
    ).toString().trim();

    if (rawScenario) {
      scenarioContext = rawScenario;
    }

    // 3. Symmetric resolution for scenario questions
    if (qType === 'scenario') {
      // Sub-case A: questionText is empty or missing, but scenarioContext is present
      if (!questionText && scenarioContext) {
        // 1. Try splitting on blank lines / double newlines (paragraphs)
        const paragraphs = scenarioContext.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
        if (paragraphs.length > 1) {
          const lastPara = paragraphs[paragraphs.length - 1];
          if (
            lastPara.includes('?') ||
            lastPara.endsWith(':') ||
            /^(what|which|how|why|identify|determine|troubleshoot|choose)\b/i.test(lastPara)
          ) {
            questionText = lastPara;
            scenarioContext = paragraphs.slice(0, -1).join('\n\n').trim();
          }
        }

        // 2. If still no questionText, try splitting on the final question sentence
        if (!questionText && scenarioContext.includes('?')) {
          const qMarkIdx = scenarioContext.lastIndexOf('?');
          const textUpToQ = scenarioContext.slice(0, qMarkIdx + 1);
          const sentenceMatches = textUpToQ.split(/(?<=[.!\n])\s+(?=[A-Z0-9])/);
          if (sentenceMatches.length > 1) {
            const lastSentence = sentenceMatches[sentenceMatches.length - 1].trim();
            if (lastSentence.length >= 10 && lastSentence.includes('?')) {
              questionText = lastSentence;
              const remainingContext = scenarioContext.replace(lastSentence, '').trim();
              scenarioContext = remainingContext || undefined;
            }
          }
        }

        // 3. If no distinct question could be reliably extracted:
        // Do NOT silently treat the entire diagnostic scenario as the question!
        if (!questionText) {
          errors.push(`Question #${qNum} (scenario) has diagnostic context but is missing a distinct question prompt.`);
          continue;
        }
      } else if (questionText && !scenarioContext && questionText.length > 100) {
        // Sub-case B: questionText has long combined scenario text, but scenarioContext is empty
        const doubleBreakParts = questionText.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
        if (doubleBreakParts.length > 1) {
          scenarioContext = doubleBreakParts[0].trim();
          questionText = doubleBreakParts.slice(1).join('\n\n').trim();
        } else {
          const qMarkIdx = questionText.lastIndexOf('?');
          if (qMarkIdx !== -1) {
            const sentenceMatches = questionText.slice(0, qMarkIdx + 1).split(/(?<=[.!\n])\s+(?=[A-Z0-9])/);
            if (sentenceMatches.length > 1) {
              const lastSentence = sentenceMatches[sentenceMatches.length - 1].trim();
              scenarioContext = questionText.replace(lastSentence, '').trim();
              questionText = lastSentence;
            }
          }
        }
      }
    }

    // 4. Strict Non-Emptiness Validation
    if (!questionText) {
      errors.push(`Question #${qNum} has empty or missing question text.`);
      continue;
    }

    // Normalize Options
    let rawOptions =
      qRaw.options ||
      qRaw.choices ||
      qRaw.answers ||
      qRaw.possibleAnswers ||
      qRaw.optionsList ||
      qRaw.options_list ||
      qRaw.choiceList ||
      qRaw.alternatives;
    if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) {
      // Could be { "A": "...", "B": "..." }
      rawOptions = Object.entries(rawOptions).map(([key, val]) => ({
        id: key,
        text:
          typeof val === 'string'
            ? val
            : val && typeof val === 'object'
            ? (val as any).text || (val as any).content || (val as any).label || (val as any).value || JSON.stringify(val)
            : String(val),
      }));
    }

    let parsedOptions: QuizQuestionOption[] = [];

    if (qType === 'true_false') {
      // For true/false, standard canonical options
      parsedOptions = [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ];
    } else if (Array.isArray(rawOptions)) {
      parsedOptions = rawOptions.map((opt: any, optIdx: number) => {
        const fallbackId = String.fromCharCode(65 + optIdx); // A, B, C, D...
        if (typeof opt === 'string') {
          // Check for "A) text" or "A. text"
          const match = opt.match(/^([A-Da-d0-9])[).:\s]+(.+)$/);
          if (match) {
            return { id: match[1].toUpperCase(), text: match[2].trim() };
          }
          return { id: fallbackId, text: opt.trim() };
        }
        if (typeof opt === 'object' && opt !== null) {
          const optId = (opt.id || opt.key || opt.letter || opt.label || opt.option || fallbackId).toString().trim();
          const optText = (opt.text || opt.value || opt.content || opt.description || '').toString().trim();
          return { id: optId, text: optText };
        }
        return { id: fallbackId, text: String(opt || '') };
      }).filter((opt) => opt.text.length > 0);
    }

    if (qType !== 'true_false' && parsedOptions.length < 2) {
      errors.push(`Question #${qNum} (${qType}) must have at least 2 distinct options.`);
      continue;
    }

    // Ensure option IDs are unique (for non-true/false)
    if (qType !== 'true_false') {
      const seenOptionIds = new Set<string>();
      parsedOptions = parsedOptions.map((opt, idx) => {
        let normId = opt.id.toUpperCase();
        if (seenOptionIds.has(normId)) {
          normId = String.fromCharCode(65 + idx);
        }
        seenOptionIds.add(normId);
        return { id: normId, text: opt.text };
      });
    }

    // Normalize Correct Answer aliases
    const rawCorrect =
      qRaw.correctAnswer ??
      qRaw.correct_answer ??
      qRaw.correctAnswers ??
      qRaw.correct_answers ??
      qRaw.correctOption ??
      qRaw.correct_option ??
      qRaw.correctOptions ??
      qRaw.correct_options ??
      qRaw.answer ??
      qRaw.answers ??
      qRaw.solution ??
      qRaw.solutions ??
      qRaw.correct ??
      qRaw.key ??
      qRaw.keys;

    if (rawCorrect === undefined || rawCorrect === null || (typeof rawCorrect === 'string' && !rawCorrect.trim())) {
      errors.push(`Question #${qNum} is missing a correct answer definition.`);
      continue;
    }

    let validatedCorrectAnswer: string | string[] | boolean;

    if (qType === 'true_false') {
      if (typeof rawCorrect === 'boolean') {
        validatedCorrectAnswer = rawCorrect;
      } else {
        const strLower = String(rawCorrect).toLowerCase().trim();
        validatedCorrectAnswer = strLower === 'true' || strLower === 't' || strLower === 'yes' || strLower === 'a';
      }
    } else if (qType === 'multiple_select') {
      let rawCandidateList: any[] = [];
      if (Array.isArray(rawCorrect)) {
        rawCandidateList = rawCorrect;
      } else if (typeof rawCorrect === 'string') {
        // e.g. "A, B" or "A and C" or "A,C,D"
        rawCandidateList = rawCorrect.split(/[,&+]|\band\b/i).filter(Boolean);
      } else {
        rawCandidateList = [rawCorrect];
      }

      const validOptionIds = new Set(parsedOptions.map((o) => o.id.toUpperCase()));
      const matchedAnswerIds = new Set<string>();

      for (const item of rawCandidateList) {
        if (item === undefined || item === null) continue;
        const itemStr = String(item).trim();
        if (!itemStr) continue;

        // 1. Direct option ID match (e.g. "A" or "a")
        const directUpper = itemStr.toUpperCase();
        if (validOptionIds.has(directUpper)) {
          matchedAnswerIds.add(directUpper);
          continue;
        }

        // 2. "Option A" or "Choice A" match
        const optLetterMatch = itemStr.match(/(?:option|choice|answer)?\s*([A-Za-z0-9])[).:\s]*/i);
        if (optLetterMatch) {
          const letter = optLetterMatch[1].toUpperCase();
          if (validOptionIds.has(letter)) {
            matchedAnswerIds.add(letter);
            continue;
          }
        }

        // 3. Option text match (exact or case-insensitive)
        const textMatch = parsedOptions.find(
          (o) => o.text.trim().toLowerCase() === itemStr.toLowerCase()
        );
        if (textMatch) {
          matchedAnswerIds.add(textMatch.id.toUpperCase());
          continue;
        }

        // 4. Numeric index match (e.g. 0 or 1 or "0")
        const numIndex = parseInt(itemStr, 10);
        if (!isNaN(numIndex) && numIndex >= 0 && numIndex < parsedOptions.length) {
          matchedAnswerIds.add(parsedOptions[numIndex].id.toUpperCase());
          continue;
        }
      }

      const answerArray = Array.from(matchedAnswerIds);

      if (answerArray.length < 1) {
        errors.push(`Question #${qNum} (multiple_select) has no valid matching correct answer IDs in options.`);
        continue;
      }
      validatedCorrectAnswer = answerArray;
    } else {
      // single_choice or scenario
      let ansStr = String(rawCorrect).trim();
      const validOptionIds = new Set(parsedOptions.map((o) => o.id.toUpperCase()));
      let resolvedId: string | null = null;

      // 1. Direct ID match
      if (validOptionIds.has(ansStr.toUpperCase())) {
        resolvedId = ansStr.toUpperCase();
      }

      // 2. "Option A" or "Choice A" match
      if (!resolvedId) {
        const optMatch = ansStr.match(/^(?:option|choice|answer)?\s*([A-Za-z0-9])[).:\s]*/i);
        if (optMatch) {
          const letter = optMatch[1].toUpperCase();
          if (validOptionIds.has(letter)) {
            resolvedId = letter;
          }
        }
      }

      // 3. Match against option text
      if (!resolvedId) {
        const matchedOpt = parsedOptions.find(
          (o) => o.text.trim().toLowerCase() === ansStr.toLowerCase(),
        );
        if (matchedOpt) {
          resolvedId = matchedOpt.id.toUpperCase();
        }
      }

      // 4. Numeric index match
      if (!resolvedId) {
        const num = parseInt(ansStr, 10);
        if (!isNaN(num) && num >= 0 && num < parsedOptions.length) {
          resolvedId = parsedOptions[num].id.toUpperCase();
        }
      }

      if (!resolvedId) {
        errors.push(`Question #${qNum} correct answer "${rawCorrect}" does not match any valid option.`);
        continue;
      }
      validatedCorrectAnswer = resolvedId;
    }

    // Normalize Explanation
    const rawExplanation =
      qRaw.explanation ||
      qRaw.reason ||
      qRaw.rationale ||
      qRaw.justification ||
      qRaw.explanationMarkdown ||
      '';
    let explanation = typeof rawExplanation === 'string' ? rawExplanation.trim() : '';
    if (!explanation) {
      explanation = `Correct answer: ${Array.isArray(validatedCorrectAnswer) ? validatedCorrectAnswer.join(', ') : validatedCorrectAnswer}.`;
    }

    validatedQuestions.push({
      id: qId,
      type: qType,
      question: questionText,
      scenarioContext,
      options: parsedOptions,
      correctAnswer: validatedCorrectAnswer,
      explanation,
      orderIndex: i,
      metadata: {
        topic,
        points: qType === 'scenario' ? 2 : 1,
        platform: qRaw.platform || 'Cisco IOS-XE / Linux',
      },
    });
  }

  if (validatedQuestions.length === 0) {
    errors.push('No valid questions could be validated from the AI payload.');
    return { valid: false, errors };
  }

  if (expectedCount && expectedCount > 0) {
    // If fewer than expected by more than half, log a warning/error
    if (validatedQuestions.length < Math.min(3, expectedCount)) {
      errors.push(`Expected at least ${expectedCount} questions, but only ${validatedQuestions.length} were generated.`);
      return { valid: false, errors };
    }
  }

  const generatedQuiz: GeneratedQuiz = {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : undefined,
    title,
    topic,
    difficulty,
    questionCount: validatedQuestions.length,
    questionTypes: Array.from(questionTypesSet),
    lessonId: typeof obj.lessonId === 'string' ? obj.lessonId : null,
    lessonTitle: typeof obj.lessonTitle === 'string' ? obj.lessonTitle : null,
    questions: validatedQuestions,
  };

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    quiz: generatedQuiz,
  };
}

/**
 * Strips answer keys (correctAnswer) and explanations from a GeneratedQuiz,
 * returning a secure ClientQuiz safe for transmission to the frontend
 * prior to assessment completion.
 */
export function stripAnswerKey(quiz: GeneratedQuiz): ClientQuiz {
  const clientQuestions: ClientQuizQuestion[] = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    scenarioContext: q.scenarioContext,
    options: q.options.map((opt) => ({
      id: opt.id,
      text: opt.text,
    })),
    metadata: q.metadata,
    orderIndex: q.orderIndex,
  }));

  return {
    id: quiz.id,
    title: quiz.title,
    topic: quiz.topic,
    difficulty: quiz.difficulty,
    questionCount: clientQuestions.length,
    questionTypes: quiz.questionTypes,
    lessonId: quiz.lessonId,
    lessonTitle: quiz.lessonTitle,
    questions: clientQuestions,
  };
}

/**
 * Server-side grading engine for submitted quiz attempts.
 * Evaluates each question based on its type:
 * - single_choice & scenario: Exact match of option ID.
 * - multiple_select: Exact match of option ID set (no partial credit; extra or missing options fail).
 * - true_false: Boolean equality or canonical true/false option matching.
 */
export function gradeQuizSubmission(
  quiz: GeneratedQuiz,
  submission: QuizSubmissionPayload,
): {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: GradedQuestionResult[];
} {
  const userAnswers = submission.answers || {};
  let totalScore = 0;
  const gradedResults: GradedQuestionResult[] = [];

  for (const q of quiz.questions) {
    const rawUserAnswer = userAnswers[q.id];
    let isCorrect = false;

    if (rawUserAnswer !== undefined && rawUserAnswer !== null) {
      if (q.type === 'true_false') {
        let normUser: boolean;
        if (typeof rawUserAnswer === 'boolean') {
          normUser = rawUserAnswer;
        } else {
          const s = String(rawUserAnswer).toLowerCase().trim();
          normUser = s === 'true' || s === 't' || s === 'yes' || s === 'a';
        }

        let normCorrect: boolean;
        if (typeof q.correctAnswer === 'boolean') {
          normCorrect = q.correctAnswer;
        } else {
          const s = String(q.correctAnswer).toLowerCase().trim();
          normCorrect = s === 'true' || s === 't' || s === 'yes' || s === 'a';
        }

        isCorrect = normUser === normCorrect;
      } else if (q.type === 'multiple_select') {
        // User answers must match correct answers set exactly
        let uArr: string[] = [];
        if (Array.isArray(rawUserAnswer)) {
          uArr = rawUserAnswer.map((x) => String(x).trim().toUpperCase());
        } else if (typeof rawUserAnswer === 'string') {
          uArr = rawUserAnswer.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
        }

        let cArr: string[] = [];
        if (Array.isArray(q.correctAnswer)) {
          cArr = q.correctAnswer.map((x) => String(x).trim().toUpperCase());
        } else if (typeof q.correctAnswer === 'string') {
          cArr = q.correctAnswer.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
        }

        // Deduplicate and sort
        const uSet = Array.from(new Set(uArr)).sort();
        const cSet = Array.from(new Set(cArr)).sort();

        isCorrect = uSet.length === cSet.length && uSet.every((val, idx) => val === cSet[idx]);
      } else {
        // single_choice or scenario
        const uStr = String(rawUserAnswer).trim().toUpperCase();
        const cStr = String(q.correctAnswer).trim().toUpperCase();
        isCorrect = uStr === cStr;
      }
    }

    if (isCorrect) {
      totalScore++;
    }

    gradedResults.push({
      questionId: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      scenarioContext: q.scenarioContext,
      userAnswer: rawUserAnswer ?? null,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
    });
  }

  const totalQuestions = quiz.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

  return {
    score: totalScore,
    totalQuestions,
    percentage,
    results: gradedResults,
  };
}

/**
 * Reconstructs a GeneratedQuiz from a persisted UserQuizRecord.
 */
export function parseQuizRecord(record: {
  id?: string;
  title: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  questionTypes?: string[] | string;
  lessonId?: string | null;
  lessonTitle?: string | null;
  questionsJson: string;
}): GeneratedQuiz {
  let questions: GeneratedQuizQuestion[] = [];
  try {
    questions = typeof record.questionsJson === 'string'
      ? JSON.parse(record.questionsJson)
      : (record.questionsJson as any);
  } catch {}

  let qTypes: QuizQuestionType[] = ['single_choice'];
  if (Array.isArray(record.questionTypes)) {
    qTypes = record.questionTypes.map((t) => normalizeQuestionType(t));
  } else if (typeof record.questionTypes === 'string') {
    try {
      const parsed = JSON.parse(record.questionTypes);
      if (Array.isArray(parsed)) {
        qTypes = parsed.map((t) => normalizeQuestionType(t));
      }
    } catch {}
  }

  return {
    id: record.id,
    title: record.title,
    topic: record.topic,
    difficulty: normalizeQuizDifficulty(record.difficulty),
    questionCount: questions.length || record.questionCount,
    questionTypes: qTypes,
    lessonId: record.lessonId,
    lessonTitle: record.lessonTitle,
    questions,
  };
}

