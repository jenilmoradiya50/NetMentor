/**
 * Core Domain Interfaces for NetMentor
 */

export type SourceType = 'cisco_doc' | 'rfc' | 'cert_guide' | 'lab_manual' | 'article' | 'video';

export interface ExternalReference {
  id: string;
  lessonId?: string;
  topicId?: string;
  title: string;
  url: string;
  sourceType: SourceType;
  relevantSection?: string;
  notes?: string;
}

export interface LearningPath {
  id: string;
  slug: string;
  title: string;
  description: string;
  targetCert: 'Fundamentals' | 'CCNA' | 'CCNP Enterprise' | 'General';
  orderIndex: number;
  createdAt: string;
}

export interface Topic {
  id: string;
  pathId: string;
  slug: string;
  title: string;
  description: string;
  orderIndex: number;
  estimatedMinutes: number;
}

export interface Lesson {
  id: string;
  topicId: string;
  slug: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  orderIndex: number;
  externalReferences?: ExternalReference[];
}

export type MasteryLevel = 'not_started' | 'learning' | 'reviewing' | 'mastered';

export interface UserProgress {
  id: string;
  userId: string;
  lessonId: string;
  masteryLevel: MasteryLevel;
  confidenceScore: number; // 1-5
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  notes?: string;
}

export type QuestionType = 'multiple_choice' | 'troubleshooting_scenario' | 'cli_output_analysis' | 'interview_question';

export interface AssessmentItem {
  id: string;
  topicId: string;
  lessonId?: string;
  questionType: QuestionType;
  prompt: string;
  scenarioContext?: string;
  expectedKeyPoints: string[];
  explanation: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface AssessmentAttempt {
  id: string;
  assessmentItemId: string;
  userResponse: string;
  feedback?: string;
  isSelfEvaluatedCorrect: boolean;
  score?: number; // 0-100
  attemptedAt: string;
}

export interface UserSession {
  isAuthenticated: boolean;
  userRole: 'admin';
  expiresAt: number;
}
