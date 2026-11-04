import type { LessonExercise, ExerciseOption, CommonMistake } from '../types/curriculum.js';

export interface EvaluationResult {
  isCorrect: boolean;
  userAnswerFormatted: string;
  expectedAnswerFormatted?: string;
  expectedAnswer?: string;
  commonMistake?: CommonMistake;
  matchedOption?: ExerciseOption;
  matchedCommonMistake?: CommonMistake;
  explanation: string;
  practicalTakeaway?: string;
}

export type ExerciseEvaluationResult = EvaluationResult;

/**
 * Deterministic Subnetting Math Engine
 */
export function calculateSubnet(ipStr: string, prefix: number) {
  const octets = ipStr.trim().split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
    throw new Error(`Invalid IPv4 address string: "${ipStr}"`);
  }
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix length: /${prefix}`);
  }

  const ipNum = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
  const maskNum = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const netNum = (ipNum & maskNum) >>> 0;
  const bcastNum = (netNum | (~maskNum >>> 0)) >>> 0;

  const toIp = (num: number) =>
    `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;

  const interestingOctetIndex = Math.min(3, Math.floor((prefix - 1) / 8));
  const bitsInInterestingOctet = prefix - interestingOctetIndex * 8;
  const magicNumber = prefix === 0 ? 256 : prefix === 32 ? 1 : 2 ** (8 - bitsInInterestingOctet);

  const totalHosts = 2 ** (32 - prefix);

  // RFC 3021: /31 subnets on point-to-point links have 2 usable addresses (no network/broadcast reserved)
  // /32 single host routes have 1 address
  // /0 to /30 subnets subtract 2 for network ID and broadcast address
  let usableHosts: number;
  let firstUsable: string;
  let lastUsable: string;

  if (prefix === 31) {
    usableHosts = 2;
    firstUsable = toIp(netNum);
    lastUsable = toIp(bcastNum);
  } else if (prefix === 32) {
    usableHosts = 1;
    firstUsable = toIp(netNum);
    lastUsable = toIp(netNum);
  } else {
    usableHosts = Math.max(0, totalHosts - 2);
    firstUsable = toIp(netNum + 1);
    lastUsable = toIp(bcastNum - 1);
  }

  return {
    ipAddress: ipStr,
    prefix,
    subnetMask: toIp(maskNum),
    networkAddress: toIp(netNum),
    broadcastAddress: toIp(bcastNum),
    firstUsable,
    lastUsable,
    totalHosts,
    usableHosts,
    magicNumber,
    interestingOctet: interestingOctetIndex + 1,
  };
}

/**
 * Checks whether two IPv4 addresses belong to the exact same subnet under a given prefix length.
 */
export function areIpsInSameSubnet(ipA: string, ipB: string, prefix: number): boolean {
  const subA = calculateSubnet(ipA, prefix);
  const subB = calculateSubnet(ipB, prefix);
  return subA.networkAddress === subB.networkAddress;
}

/**
 * Deterministic Answer Evaluation Engine for all NetMentor Active-Learning Exercise Types.
 * Strictly adheres to protocol specifications, numerical math, and pattern matching.
 * Does not depend on external AI calls.
 */
export function evaluateExerciseAnswer(exercise: LessonExercise, answer: any): EvaluationResult {
  let isCorrect = false;
  let userAnswerFormatted = String(answer ?? '').trim();
  let expectedAnswerFormatted: string | undefined = undefined;
  let matchedOption: ExerciseOption | undefined;
  let matchedCommonMistake: CommonMistake | undefined;

  // 1. Multiple Choice & Troubleshooting Question Types
  if (exercise.type === 'multiple_choice' || exercise.type === 'troubleshooting') {
    const selectedId = String(answer || '').trim();
    matchedOption = exercise.options?.find((o) => o.id === selectedId);
    isCorrect = Boolean(matchedOption?.isCorrect);
    userAnswerFormatted = matchedOption ? matchedOption.label : selectedId;

    const correctOpt = exercise.options?.find((o) => o.isCorrect);
    expectedAnswerFormatted = correctOpt ? correctOpt.label : undefined;

    // Detect if user fell into a known common mistake
    if (!isCorrect && exercise.commonMistakes) {
      const lowerSelected = userAnswerFormatted.toLowerCase();
      matchedCommonMistake = exercise.commonMistakes.find(
        (cm) =>
          lowerSelected.includes(cm.mistake.toLowerCase()) ||
          cm.mistake.toLowerCase().includes(lowerSelected),
      );
    }
  }

  // 2. Numerical Input (Subnetting, host counts, block sizes)
  else if (exercise.type === 'numerical') {
    const userNum = parseFloat(userAnswerFormatted);
    const expected = exercise.numericAnswer ?? 0;
    const tolerance = exercise.numericTolerance ?? 0;

    isCorrect = !isNaN(userNum) && Math.abs(userNum - expected) <= tolerance;
    userAnswerFormatted = isNaN(userNum) ? userAnswerFormatted : String(userNum);
    expectedAnswerFormatted = tolerance > 0 ? `${expected} (±${tolerance})` : String(expected);

    if (!isCorrect && exercise.commonMistakes) {
      matchedCommonMistake = exercise.commonMistakes.find((cm) =>
        cm.mistake.includes(userAnswerFormatted),
      );
    }
  }

  // 3. Predict Output / Text Matching (Header values, IPs, Protocol states, CLI strings)
  else if (exercise.type === 'predict_output') {
    const cleanUserText = userAnswerFormatted.replace(/\s+/g, ' ');

    // Check regex pattern if defined
    if (exercise.textAnswerPattern) {
      try {
        const regex = new RegExp(exercise.textAnswerPattern, 'i');
        isCorrect = regex.test(cleanUserText);
      } catch {
        isCorrect = cleanUserText.toLowerCase() === exercise.textAnswerPattern.toLowerCase();
      }
    }

    // Check acceptable answers list if not yet matched
    if (!isCorrect && exercise.acceptableAnswers && exercise.acceptableAnswers.length > 0) {
      isCorrect = exercise.acceptableAnswers.some(
        (acc) => acc.trim().toLowerCase() === cleanUserText.toLowerCase(),
      );
    }

    // If neither pattern nor acceptableAnswers defined, require non-empty
    if (!exercise.textAnswerPattern && (!exercise.acceptableAnswers || exercise.acceptableAnswers.length === 0)) {
      isCorrect = cleanUserText.length > 0;
    }

    expectedAnswerFormatted =
      exercise.acceptableAnswers?.[0] || exercise.textAnswerPattern?.replace(/[\^\$\\]/g, '') || 'Expected output';

    if (!isCorrect && exercise.commonMistakes) {
      const lower = cleanUserText.toLowerCase();
      matchedCommonMistake = exercise.commonMistakes.find((cm) =>
        lower.includes(cm.mistake.toLowerCase()),
      );
    }
  }

  // 4. Sequence Ordering
  else if (exercise.type === 'sequence') {
    if (Array.isArray(answer) && exercise.sequenceItems) {
      // answer is an array of sequenceItem ids in user order
      isCorrect = answer.every((id, idx) => {
        const item = exercise.sequenceItems?.find((s) => s.id === id);
        return item?.correctIndex === idx;
      });

      userAnswerFormatted = answer
        .map((id) => exercise.sequenceItems?.find((s) => s.id === id)?.text || id)
        .join(' ➔ ');

      expectedAnswerFormatted = [...exercise.sequenceItems]
        .sort((a, b) => a.correctIndex - b.correctIndex)
        .map((s) => s.text)
        .join(' ➔ ');
    } else {
      isCorrect = false;
    }
  }

  return {
    isCorrect,
    userAnswerFormatted,
    expectedAnswerFormatted,
    expectedAnswer: expectedAnswerFormatted,
    commonMistake: matchedCommonMistake,
    matchedOption,
    matchedCommonMistake,
    explanation: exercise.explanation,
    practicalTakeaway: exercise.practicalTakeaway,
  };
}
