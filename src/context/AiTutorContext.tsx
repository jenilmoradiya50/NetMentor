/**
 * NetMentor AI Tutor Context
 * 
 * Provides global state management for the NetMentor AI Tutor.
 * Supports:
 * - General Networking Q&A (outside of an active lesson)
 * - Grounded Lesson Q&A (when a lesson context is registered)
 * - Socratic Exercise Hints (when an interactive challenge is active)
 * 
 * Ensures a single mounted tutor instance and single floating entry point
 * across all tabs and routes.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { AiTutoringMode } from '../../api/_lib/ai/types.js';

export interface LessonContextData {
  lessonId: string;
  lessonTitle: string;
  sections?: Array<{ id: string; title: string }>;
}

export interface OpenTutorOptions {
  mode?: AiTutoringMode;
  lessonId?: string;
  lessonTitle?: string;
  sections?: Array<{ id: string; title: string }>;
  sectionId?: string;
  exerciseId?: string;
  initialPrompt?: string;
}

export interface AiTutorContextType {
  isOpen: boolean;
  mode: AiTutoringMode;
  lessonContext: LessonContextData | null;
  activeSectionId?: string;
  activeExerciseId?: string;
  initialPrompt?: string;
  openTutor: (options?: OpenTutorOptions) => void;
  closeTutor: () => void;
  setLessonContext: (context: LessonContextData | null) => void;
  clearLessonContext: () => void;
  setMode: (mode: AiTutoringMode) => void;
  setActiveSectionId: (sectionId?: string) => void;
  setInitialPrompt: (prompt?: string) => void;
}

const AiTutorContext = createContext<AiTutorContextType | undefined>(undefined);

export const AiTutorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AiTutoringMode>('general_qa');
  const [lessonContext, setLessonContextState] = useState<LessonContextData | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>(undefined);
  const [activeExerciseId, setActiveExerciseId] = useState<string | undefined>(undefined);
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(undefined);

  const setLessonContext = useCallback((context: LessonContextData | null) => {
    setLessonContextState(context);
    if (!context) {
      setActiveSectionId(undefined);
      setActiveExerciseId(undefined);
      setMode('general_qa');
    }
  }, []);

  const clearLessonContext = useCallback(() => {
    setLessonContextState(null);
    setActiveSectionId(undefined);
    setActiveExerciseId(undefined);
    setMode('general_qa');
  }, []);

  const openTutor = useCallback(
    (options?: OpenTutorOptions) => {
      let targetLesson = lessonContext;

      if (options?.lessonId && options?.lessonTitle) {
        targetLesson = {
          lessonId: options.lessonId,
          lessonTitle: options.lessonTitle,
          sections: options.sections,
        };
        setLessonContextState(targetLesson);
      }

      if (options?.mode) {
        setMode(options.mode);
      } else if (options?.exerciseId) {
        setMode('socratic_hint');
      } else if (targetLesson) {
        setMode('lesson_qa');
      } else {
        setMode('general_qa');
      }

      if (options?.sectionId !== undefined) {
        setActiveSectionId(options.sectionId);
      }
      if (options?.exerciseId !== undefined) {
        setActiveExerciseId(options.exerciseId);
      }
      if (options?.initialPrompt !== undefined) {
        setInitialPrompt(options.initialPrompt);
      }

      setIsOpen(true);
    },
    [lessonContext]
  );

  const closeTutor = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<AiTutorContextType>(
    () => ({
      isOpen,
      mode,
      lessonContext,
      activeSectionId,
      activeExerciseId,
      initialPrompt,
      openTutor,
      closeTutor,
      setLessonContext,
      clearLessonContext,
      setMode,
      setActiveSectionId,
      setInitialPrompt,
    }),
    [
      isOpen,
      mode,
      lessonContext,
      activeSectionId,
      activeExerciseId,
      initialPrompt,
      openTutor,
      closeTutor,
      setLessonContext,
      clearLessonContext,
    ]
  );

  return <AiTutorContext.Provider value={value}>{children}</AiTutorContext.Provider>;
};

export function useAiTutor(): AiTutorContextType {
  const context = useContext(AiTutorContext);
  if (!context) {
    throw new Error('useAiTutor must be used within an AiTutorProvider');
  }
  return context;
}
