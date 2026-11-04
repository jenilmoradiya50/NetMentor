/**
 * NetMentor AI Tutor Engine - Pure TypeScript Lesson Validator
 * 
 * Validates and normalizes structured lesson outputs received from AI providers.
 * Enforces strict typing, required sections, non-empty content, valid question options,
 * and boundaries without throwing unhandled exceptions. Zero external npm dependencies.
 */

import type {
  GeneratedLessonContent,
  GeneratedLessonSection,
  GeneratedLessonCommand,
  GeneratedLessonKnowledgeCheck,
  GeneratedLessonSummary,
  LessonDifficulty,
  LessonValidationResult,
} from './types.js';

/**
 * Normalizes common difficulty synonyms to guaranteed LessonDifficulty enum.
 */
function normalizeDifficulty(raw: unknown): LessonDifficulty {
  if (typeof raw !== 'string') return 'intermediate';
  const val = raw.toLowerCase().trim();
  if (
    val === 'beginner' ||
    val === 'fundamentals' ||
    val === 'fundamental' ||
    val === 'intro' ||
    val === 'introductory' ||
    val === 'basic' ||
    val === 'entry'
  ) {
    return 'beginner';
  }
  if (
    val === 'advanced' ||
    val === 'expert' ||
    val === 'ccnp' ||
    val === 'ccie' ||
    val === 'deep_dive' ||
    val === 'hard'
  ) {
    return 'advanced';
  }
  return 'intermediate';
}

/**
 * Safely repairs common LLM JSON formatting quirks:
 * - Unescaped raw newlines/tabs inside string literals
 * - JavaScript comments (// and /*...*\/) outside of string literals
 * - Trailing commas before closing brackets or braces
 * - Single-quoted JSON structures when double quotes are absent
 */
export function repairJsonString(input: string): string {
  let out = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        out += ch;
      } else if (ch === '\\') {
        isEscaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else if (ch.charCodeAt(0) < 32) {
        out += ' ';
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
        out += ch;
      } else if (ch === '/' && input[i + 1] === '/') {
        // Line comment, skip until newline
        while (i < input.length && input[i] !== '\n') {
          i++;
        }
        if (i < input.length) out += input[i]; // retain newline
      } else if (ch === '/' && input[i + 1] === '*') {
        // Block comment, skip until */
        i += 2;
        while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
          i++;
        }
        i++; // skip /
      } else {
        out += ch;
      }
    }
  }

  // Remove trailing commas before closing braces/brackets: [1, 2, 3,] -> [1, 2, 3]
  let cleaned = out.replace(/,\s*([\]}])/g, '$1');

  // If input contains single-quoted keys/values and no double quotes, convert to valid JSON quotes
  if (!cleaned.includes('"') && cleaned.includes("'")) {
    cleaned = cleaned.replace(/'((?:\\'|[^'])*)'/g, '"$1"');
  }

  return cleaned;
}

/**
 * Extracts and parses JSON from raw LLM text, safely handling:
 * - Markdown fences (```json ... ```) with or without leading/trailing chatter
 * - Both top-level JSON Objects ({...}) and Arrays ([...])
 * - Nested code blocks inside markdown text fields
 * - Unescaped raw newlines or control characters inside JSON strings
 * - Trailing conversational comments after closing fences or brackets
 * - Trailing commas in arrays and objects
 * - Truncation detection with actionable diagnostic feedback
 */
export function extractJsonFromText(rawText: string): {
  success: boolean;
  data?: any;
  error?: string;
  isTruncated?: boolean;
} {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return { success: false, error: 'Empty or non-string AI output' };
  }

  const text = rawText.trim();

  // 1. Direct parse attempt (fast path for clean JSON)
  try {
    return { success: true, data: JSON.parse(text) };
  } catch {}

  // 1b. Direct parse with repair
  try {
    return { success: true, data: JSON.parse(repairJsonString(text)) };
  } catch {}

  // 2. Greedy code fence extraction (outermost ``` to outermost ```)
  // Handles cases where cards contain nested markdown code blocks (e.g. ```bash ... ```)
  const firstFence = text.indexOf('```');
  const lastFence = text.lastIndexOf('```');
  if (firstFence !== -1 && lastFence !== -1 && lastFence > firstFence) {
    let fenceContent = text.slice(firstFence + 3, lastFence).trim();
    // Strip optional language identifier on the first line (e.g. "json\n")
    fenceContent = fenceContent.replace(/^[a-zA-Z0-9_-]*\r?\n/, '').trim();
    try {
      return { success: true, data: JSON.parse(fenceContent) };
    } catch {}
    try {
      return { success: true, data: JSON.parse(repairJsonString(fenceContent)) };
    } catch {}
  }

  // 3. Non-greedy code fence extraction (for multiple distinct code blocks)
  const fenceMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const match of fenceMatches) {
    const candidate = match[1]?.trim();
    if (candidate) {
      try {
        return { success: true, data: JSON.parse(candidate) };
      } catch {}
      try {
        return { success: true, data: JSON.parse(repairJsonString(candidate)) };
      } catch {}
    }
  }

  // 4. Balanced boundary extraction: supports BOTH Objects {...} and Arrays [...]
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');

  const candidates: string[] = [];

  const hasObject = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const hasArray = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

  if (hasArray && (!hasObject || (firstBracket < firstBrace && lastBracket > lastBrace))) {
    // Array wraps objects or array exists alone
    candidates.push(text.slice(firstBracket, lastBracket + 1).trim());
    if (hasObject) candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
  } else if (hasObject) {
    // Object wraps arrays or object exists alone
    candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
    if (hasArray) candidates.push(text.slice(firstBracket, lastBracket + 1).trim());
  } else if (hasArray) {
    candidates.push(text.slice(firstBracket, lastBracket + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      return { success: true, data: JSON.parse(candidate) };
    } catch {}
    try {
      return { success: true, data: JSON.parse(repairJsonString(candidate)) };
    } catch {}
  }

  // 5. Truncation and malformed diagnostics
  const braceUnbalanced = firstBrace !== -1 && (lastBrace === -1 || (text.split('{').length > text.split('}').length));
  const bracketUnbalanced = firstBracket !== -1 && (lastBracket === -1 || (text.split('[').length > text.split(']').length));

  if (braceUnbalanced || bracketUnbalanced) {
    return {
      success: false,
      isTruncated: true,
      error: 'Malformed JSON: Unterminated JSON structure or missing closing bracket/brace (output was truncated)',
    };
  }

  return { success: false, error: 'Malformed JSON: No valid JSON object or array found in output' };
}

/**
 * Validates a lesson data structure and normalizes all fields into a guaranteed
 * GeneratedLessonContent object.
 */
export function validateGeneratedLesson(input: unknown): LessonValidationResult {
  const errors: string[] = [];

  let data: any = input;

  if (typeof input === 'string') {
    const extract = extractJsonFromText(input);
    if (!extract.success) {
      return { valid: false, errors: [extract.error || 'Failed to parse JSON string'] };
    }
    data = extract.data;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Lesson content must be a JSON object'] };
  }

  // 1. Metadata validation & normalization
  const rawTitle = data.lessonTitle || data.title || data.name;
  const lessonTitle = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim().slice(0, 255) : '';
  if (!lessonTitle) {
    errors.push('Missing or empty "lessonTitle"');
  }

  const rawTopic = data.topic || data.lessonTitle || data.title;
  const topic = typeof rawTopic === 'string' && rawTopic.trim() ? rawTopic.trim().slice(0, 200) : 'Networking';

  const rawDesc =
    data.shortDescription ||
    data.description ||
    data.subtitle ||
    data.overview ||
    (data.summary && typeof data.summary.whatYouLearned === 'string' && data.summary.whatYouLearned);
  const shortDescription =
    typeof rawDesc === 'string' && rawDesc.trim()
      ? rawDesc.trim()
      : `A comprehensive technical guide to ${topic}, covering operational mechanics, practical CLI configuration, and troubleshooting.`;

  const difficulty: LessonDifficulty = normalizeDifficulty(data.difficulty);

  let estimatedMinutes = 20;
  if (typeof data.estimatedMinutes === 'number' && !isNaN(data.estimatedMinutes)) {
    estimatedMinutes = Math.max(5, Math.min(180, Math.round(data.estimatedMinutes)));
  } else if (typeof data.estimatedMinutes === 'string') {
    const parsed = parseInt(data.estimatedMinutes.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) {
      estimatedMinutes = Math.max(5, Math.min(180, parsed));
    }
  }

  let tags: string[] = [];
  if (Array.isArray(data.tags)) {
    tags = data.tags
      .filter((t: any) => typeof t === 'string' && t.trim())
      .map((t: string) => t.trim().slice(0, 50));
  } else if (typeof data.tags === 'string' && data.tags.trim()) {
    tags = data.tags.split(',').map((t: string) => t.trim().slice(0, 50)).filter(Boolean);
  }
  if (tags.length === 0) {
    tags = [topic.split(' ')[0], 'Networking', difficulty].filter(Boolean);
  }

  let prerequisites: string[] = [];
  if (Array.isArray(data.prerequisites)) {
    prerequisites = data.prerequisites
      .filter((p: any) => typeof p === 'string' && p.trim())
      .map((p: string) => p.trim());
  } else if (typeof data.prerequisites === 'string' && data.prerequisites.trim()) {
    prerequisites = data.prerequisites.split(/[,;\n]/).map((p: string) => p.trim()).filter(Boolean);
  }
  if (prerequisites.length === 0) {
    prerequisites = ['Layer 2 Ethernet framing and Layer 3 IP addressing fundamentals'];
  }

  const rawObjectives = data.learningObjectives || data.objectives || data.learning_objectives || data.goals;
  let learningObjectives: string[] = [];
  if (Array.isArray(rawObjectives)) {
    learningObjectives = rawObjectives
      .filter((o: any) => typeof o === 'string' && o.trim())
      .map((o: string) => o.trim());
  } else if (typeof rawObjectives === 'string' && rawObjectives.trim()) {
    learningObjectives = rawObjectives.split(/[\n;]/).map((o: string) => o.trim()).filter(Boolean);
  }
  if (learningObjectives.length === 0) {
    learningObjectives = [
      `Analyze the architectural foundations and protocol operations of ${topic}.`,
      `Implement and verify standard configurations using CLI commands.`,
      `Diagnose and remediate common production errors and anomalies.`
    ];
  }

  // 2. Sections validation & normalization
  const rawSections = data.sections || data.modules || data.chapters || data.topics;
  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    errors.push('"sections" must be a non-empty array of lesson sections');
  }

  const validatedSections: GeneratedLessonSection[] = [];
  if (Array.isArray(rawSections)) {
    if (rawSections.length < 2) {
      errors.push('Lesson must contain at least 2 structured sections for pedagogical depth');
    }
    rawSections.forEach((sec: any, index: number) => {
      const secPrefix = `Section [${index + 1}]`;
      if (!sec || typeof sec !== 'object' || Array.isArray(sec)) {
        errors.push(`${secPrefix} is not a valid object`);
        return;
      }

      const id = typeof sec.id === 'string' && sec.id.trim() ? sec.id.trim() : `section-${index + 1}`;
      const rawTitle = sec.title || sec.name || sec.heading;
      const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : `Section ${index + 1}: ${topic} Principles`;

      const rawExpl = sec.explanation || sec.content || sec.markdown || sec.body || sec.text || sec.description;
      const explanation = typeof rawExpl === 'string' ? rawExpl.trim() : '';
      if (!explanation) {
        errors.push(`${secPrefix} "${title}" is missing explanation content`);
      }

      let terminology = undefined;
      const rawTerms = sec.terminology || sec.terms || sec.definitions;
      if (Array.isArray(rawTerms)) {
        terminology = rawTerms
          .filter((t: any) => t && (typeof t.term === 'string' || typeof t.name === 'string'))
          .map((t: any) => ({
            term: String(t.term || t.name).trim(),
            definition: String(t.definition || t.meaning || t.desc || '').trim(),
          }))
          .filter((t) => t.term.length > 0 && t.definition.length > 0);
        if (terminology.length === 0) terminology = undefined;
      }

      let commands: GeneratedLessonCommand[] | undefined = undefined;
      const rawCommands = sec.commands || sec.cliCommands || sec.cli;
      if (Array.isArray(rawCommands)) {
        commands = rawCommands
          .map((c: any): GeneratedLessonCommand | null => {
            if (typeof c === 'string' && c.trim()) {
              return {
                command: c.trim(),
                description: 'Operational command',
                platform: 'Cisco IOS-XE / Linux',
              };
            }
            if (c && typeof c === 'object') {
              const cmdStr = String(c.command || c.cmd || c.syntax || '').trim();
              if (!cmdStr) return null;
              return {
                platform: typeof c.platform === 'string' && c.platform.trim() ? c.platform.trim() : 'Cisco IOS-XE / Linux',
                description: typeof c.description === 'string' && c.description.trim() ? c.description.trim() : 'Operational command',
                command: cmdStr,
                expectedOutput: typeof c.expectedOutput === 'string' ? c.expectedOutput.trim() : undefined,
                notes: typeof c.notes === 'string' ? c.notes.trim() : undefined,
              };
            }
            return null;
          })
          .filter((cmd): cmd is GeneratedLessonCommand => Boolean(cmd));
        if (commands.length === 0) commands = undefined;
      }

      let practicalScenario = undefined;
      const rawScenario = sec.practicalScenario || sec.scenario;
      if (rawScenario && typeof rawScenario === 'object') {
        const ps = rawScenario;
        const steps = Array.isArray(ps.troubleshootingSteps || ps.steps)
          ? (ps.troubleshootingSteps || ps.steps).filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
          : undefined;

        const mistakes = Array.isArray(ps.commonMistakes || ps.pitfalls || ps.mistakes)
          ? (ps.commonMistakes || ps.pitfalls || ps.mistakes)
              .filter((m: any) => m && (typeof m.mistake === 'string' || typeof m.issue === 'string'))
              .map((m: any) => ({
                mistake: String(m.mistake || m.issue).trim(),
                cause: String(m.cause || m.reason || '').trim(),
                prevention: String(m.prevention || m.fix || m.solution || '').trim(),
              }))
          : undefined;

        practicalScenario = {
          title: typeof ps.title === 'string' && ps.title.trim() ? ps.title.trim() : 'Practical Implementation Scenario',
          description: typeof ps.description === 'string' && ps.description.trim() ? ps.description.trim() : 'Production network implementation scenario.',
          packetFlow: typeof ps.packetFlow === 'string' && ps.packetFlow.trim() ? ps.packetFlow.trim() : (typeof ps.flow === 'string' ? ps.flow.trim() : undefined),
          troubleshootingSteps: steps && steps.length > 0 ? steps : undefined,
          commonMistakes: mistakes && mistakes.length > 0 ? mistakes : undefined,
        };
      }

      validatedSections.push({
        id,
        title,
        explanation,
        terminology,
        commands,
        practicalScenario,
      });
    });
  }

  // 3. Knowledge Checks validation & normalization
  const validatedChecks: GeneratedLessonKnowledgeCheck[] = [];
  const rawChecks = data.knowledgeChecks || data.knowledge_checks || data.quiz || data.questions || data.checks;

  if (!Array.isArray(rawChecks) || rawChecks.length === 0) {
    errors.push('"knowledgeChecks" must contain at least 1 check question');
  } else {
    rawChecks.forEach((kc: any, index: number) => {
      const qPrefix = `Knowledge Check [${index + 1}]`;
      if (!kc || typeof kc !== 'object' || Array.isArray(kc)) {
        errors.push(`${qPrefix} is not a valid object`);
        return;
      }

      const id = typeof kc.id === 'string' && kc.id.trim() ? kc.id.trim() : `check-${index + 1}`;
      const rawQ = kc.question || kc.prompt || kc.text;
      const question = typeof rawQ === 'string' ? rawQ.trim() : '';
      if (!question) {
        errors.push(`${qPrefix} is missing a question`);
      }

      const rawOpts = kc.options || kc.choices || kc.answers;
      if (!Array.isArray(rawOpts) || rawOpts.length < 2) {
        errors.push(`${qPrefix} must provide at least 2 options`);
        return;
      }

      const options = rawOpts
        .map((opt: any, optIdx: number) => {
          // If option is a plain string: "A) Text" or "Text"
          if (typeof opt === 'string' && opt.trim()) {
            const trimmed = opt.trim();
            const letterMatch = trimmed.match(/^([A-Da-d])[\)\.\:\-]\s*(.*)$/);
            if (letterMatch) {
              return {
                id: letterMatch[1].toUpperCase(),
                text: letterMatch[2].trim() || trimmed,
              };
            }
            return {
              id: String.fromCharCode(65 + optIdx),
              text: trimmed,
            };
          }
          if (opt && typeof opt === 'object') {
            const optText = String(opt.text || opt.label || opt.value || opt.option || '').trim();
            if (!optText) return null;
            const optId = typeof opt.id === 'string' && opt.id.trim() ? opt.id.trim().toUpperCase() : String.fromCharCode(65 + optIdx);
            return {
              id: optId,
              text: optText,
            };
          }
          return null;
        })
        .filter((opt): opt is { id: string; text: string } => Boolean(opt && opt.text.length > 0));

      if (options.length < 2) {
        errors.push(`${qPrefix} must have at least 2 non-empty options`);
      }

      // Normalize correctOptionId
      let correctOptionId = '';
      const rawCorrect = kc.correctOptionId ?? kc.correctAnswer ?? kc.correct_answer ?? kc.correctOption ?? kc.answer;
      if (typeof rawCorrect === 'string') {
        const trimmed = rawCorrect.trim();
        // If "Option A" or "A) ..."
        const letterMatch = trimmed.match(/^Option\s+([A-Da-d])/i) || trimmed.match(/^([A-Da-d])[\)\.\:\-]/);
        if (letterMatch) {
          correctOptionId = letterMatch[1].toUpperCase();
        } else if (trimmed.length === 1 && /[A-Za-z]/.test(trimmed)) {
          correctOptionId = trimmed.toUpperCase();
        } else {
          // Check if it matches an option text
          const matchingOpt = options.find((o) => o.text.toLowerCase() === trimmed.toLowerCase());
          if (matchingOpt) {
            correctOptionId = matchingOpt.id;
          } else {
            correctOptionId = trimmed;
          }
        }
      } else if (typeof rawCorrect === 'number' && Number.isInteger(rawCorrect)) {
        // 0 -> 'A', 1 -> 'B'
        correctOptionId = String.fromCharCode(65 + rawCorrect);
      }

      if (!correctOptionId) {
        errors.push(`${qPrefix} is missing "correctOptionId"`);
      } else {
        const optionExists = options.some((o) => o.id.toLowerCase() === correctOptionId.toLowerCase());
        if (!optionExists) {
          errors.push(`${qPrefix} "correctOptionId" (${correctOptionId}) does not match any available option id`);
        }
      }

      const explanation =
        typeof kc.explanation === 'string' && kc.explanation.trim()
          ? kc.explanation.trim()
          : (typeof kc.rationale === 'string' && kc.rationale.trim()
          ? kc.rationale.trim()
          : 'The correct option aligns with standard networking protocol mechanics.');

      validatedChecks.push({
        id,
        question,
        options,
        correctOptionId,
        explanation,
      });
    });
  }

  // 4. Lesson Summary validation & normalization
  const rawSummary = data.summary || data.conclusion || data.review;
  let validatedSummary: GeneratedLessonSummary;

  if (rawSummary && typeof rawSummary === 'object' && !Array.isArray(rawSummary)) {
    const rawTakeaways = rawSummary.keyTakeaways || rawSummary.key_takeaways || rawSummary.takeaways || rawSummary.points;
    let keyTakeaways = Array.isArray(rawTakeaways)
      ? rawTakeaways.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
      : [];
    if (keyTakeaways.length === 0) {
      keyTakeaways = learningObjectives.slice(0, 3);
    }

    const rawTerms = rawSummary.keyTerms || rawSummary.key_terms || rawSummary.terms;
    let keyTerms = Array.isArray(rawTerms)
      ? rawTerms
          .filter((t: any) => t && (typeof t.term === 'string' || typeof t.name === 'string'))
          .map((t: any) => ({
            term: String(t.term || t.name).trim(),
            definition: String(t.definition || t.meaning || t.desc || '').trim(),
          }))
          .filter((t) => t.term.length > 0 && t.definition.length > 0)
      : [];

    if (keyTerms.length === 0) {
      keyTerms = [
        { term: topic, definition: 'The primary networking protocol or concept analyzed in this structured lesson.' },
      ];
    }

    const rawWhatLearned = rawSummary.whatYouLearned || rawSummary.what_you_learned || rawSummary.conclusion || rawSummary.summaryText;
    const whatYouLearned =
      typeof rawWhatLearned === 'string' && rawWhatLearned.trim()
        ? rawWhatLearned.trim()
        : `You have completed the structured study of ${topic}, covering core architecture, implementation commands, and troubleshooting principles.`;

    const rawNext = rawSummary.suggestedNextTopics || rawSummary.suggested_next_topics || rawSummary.nextTopics || rawSummary.nextSteps;
    let suggestedNextTopics = Array.isArray(rawNext)
      ? rawNext.filter((t: any) => typeof t === 'string' && t.trim()).map((t: string) => t.trim())
      : [];
    if (suggestedNextTopics.length === 0) {
      suggestedNextTopics = [
        'Advanced Network Security & Hardening',
        'High-Availability Architecture (HSRP / VRRP)',
        'Network Automation with Python and RESTCONF',
      ];
    }

    validatedSummary = {
      keyTakeaways,
      keyTerms,
      whatYouLearned,
      suggestedNextTopics,
    };
  } else {
    // Gracefully synthesize standard summary if omitted
    validatedSummary = {
      keyTakeaways: learningObjectives.slice(0, 3),
      keyTerms: [
        { term: topic, definition: 'The primary networking protocol or concept analyzed in this structured lesson.' },
      ],
      whatYouLearned: `You have completed the structured study of ${topic}, covering core architecture, implementation commands, and troubleshooting principles.`,
      suggestedNextTopics: [
        'Advanced Network Security & Hardening',
        'High-Availability Architecture (HSRP / VRRP)',
        'Network Automation with Python and RESTCONF',
      ],
    };
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  const lesson: GeneratedLessonContent = {
    lessonTitle,
    shortDescription,
    topic,
    difficulty,
    estimatedMinutes,
    tags,
    prerequisites,
    learningObjectives,
    sections: validatedSections,
    knowledgeChecks: validatedChecks,
    summary: validatedSummary,
  };

  return {
    valid: true,
    lesson,
  };
}
