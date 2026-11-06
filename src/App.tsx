import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { DatabaseStatusBadge } from './components/common/DatabaseStatusBadge';
import { GenerateStandaloneFlashcardModal } from './components/flashcards/GenerateStandaloneFlashcardModal';
import { GenerateLessonModal } from './components/library/GenerateLessonModal';
import { Sheet } from './components/ui/Sheet';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { CURRICULUM_PATHS } from './data/curriculum/curriculum-data';
import {
  ShieldCheck,
  Compass,
  LogOut,
  Clock,
  Sparkles,
  Layers,
  Network,
  Loader2,
  ArrowLeft,
  Bot,
  BookOpen,
  FileQuestion,
} from 'lucide-react';
import { AiTutorProvider, useAiTutor } from './context/AiTutorContext';
import { AiTutorDrawer } from './components/curriculum/AiTutorDrawer';
import {
  generatedLessonsApi,
  type GeneratedLessonDetail,
  type GeneratedLessonContent,
  type GradedQuizAttemptResponse,
} from './lib/api';
import { GenerationManagerProvider, useGenerationManager } from './context/GenerationManagerContext';
import { FloatingGenerationWidget } from './components/common/FloatingGenerationWidget';
import { GenerateQuizModal } from './components/quizzes/GenerateQuizModal';

// Route-Level Code Splitting (Dynamic Lazy Imports)
const CurriculumHub = lazy(() =>
  import('./components/curriculum/CurriculumHub').then((m) => ({ default: m.CurriculumHub })),
);
const FlashcardsHub = lazy(() =>
  import('./components/flashcards/FlashcardsHub').then((m) => ({ default: m.FlashcardsHub })),
);
const QuizzesHub = lazy(() =>
  import('./components/quizzes/QuizzesHub').then((m) => ({ default: m.QuizzesHub })),
);
const QuizPlayerView = lazy(() =>
  import('./components/quizzes/QuizPlayerView').then((m) => ({ default: m.QuizPlayerView })),
);
const QuizResultsView = lazy(() =>
  import('./components/quizzes/QuizResultsView').then((m) => ({ default: m.QuizResultsView })),
);
const PacketTracerLabsView = lazy(() =>
  import('./components/labs/PacketTracerLabsView').then((m) => ({ default: m.PacketTracerLabsView })),
);
const PersonalLibraryHub = lazy(() =>
  import('./components/library/PersonalLibraryHub').then((m) => ({ default: m.PersonalLibraryHub })),
);
const GeneratedLessonReader = lazy(() =>
  import('./components/library/GeneratedLessonReader').then((m) => ({ default: m.GeneratedLessonReader })),
);

function ViewLoadingFallback({ message = 'Loading module...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[45vh] p-8 text-center bg-canvas">
      <div className="relative flex items-center justify-center mb-4">
        <div className="absolute w-12 h-12 rounded-full bg-accent/20 animate-ping opacity-30" />
        <Loader2 className="w-8 h-8 text-accent animate-spin relative z-10" />
      </div>
      <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
        {message}
      </p>
      <span className="text-[10px] text-slate-600 mt-1 font-mono">
        NetMentor Telecom Console
      </span>
    </div>
  );
}

type TabId = 'curriculum' | 'flashcards' | 'quizzes' | 'labs' | 'library';

function Dashboard() {
  const { logout, isDemoMode, exitDemoMode, user, sessionExpiresAt } = useAuth();
  const {
    isOpen: isAiTutorOpen,
    mode: aiTutorMode,
    lessonContext,
    activeSectionId,
    activeExerciseId,
    initialPrompt,
    setInitialPrompt,
    openTutor,
    closeTutor,
  } = useAiTutor();
  const [mainTab, setMainTab] = useState<TabId>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'flashcards' || t === 'quizzes' || t === 'labs' || t === 'curriculum' || t === 'library') return t;
    }
    return 'flashcards';
  });
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('lesson');
    }
    return null;
  });
  const [selectedGeneratedLessonId, setSelectedGeneratedLessonId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('genLesson');
    }
    return null;
  });
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('deckId');
    }
    return null;
  });
  const [activeQuizId, setActiveQuizId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('quizId');
    }
    return null;
  });
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('attemptId');
    }
    return null;
  });
  const [targetLabScenarioId, setTargetLabScenarioId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('scenario');
    }
    return null;
  });
  const [activeAttemptData, setActiveAttemptData] = useState<GradedQuizAttemptResponse | null>(null);
  const [selectedGeneratedLesson, setSelectedGeneratedLesson] = useState<GeneratedLessonDetail | null>(null);
  const [isLoadingGenLesson, setIsLoadingGenLesson] = useState(false);

  // Lesson Generator Modal state
  const [isCreateLessonModalOpen, setIsCreateLessonModalOpen] = useState(false);
  const [createLessonParams, setCreateLessonParams] = useState<{
    initialTopic?: string;
    context?: string;
    conversationId?: string;
  }>({});

  // Quiz Generator Modal state
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizModalParams, setQuizModalParams] = useState<{
    initialTopic?: string;
    lessonId?: string;
    lessonTitle?: string;
  }>({});

  // Standalone Flashcard Generator Modal state
  const [isStandaloneFlashcardModalOpen, setIsStandaloneFlashcardModalOpen] = useState(false);
  const [standaloneFlashcardInitialTopic, setStandaloneFlashcardInitialTopic] = useState('');

  // Background Task Result Preview hydration state
  const { registerResultViewer } = useGenerationManager();
  const [lessonDraftToPreview, setLessonDraftToPreview] = useState<GeneratedLessonContent | null>(null);
  const [flashcardDraftToPreview, setFlashcardDraftToPreview] = useState<any | null>(null);

  // Register callback so clicking "Open Result" in the persistent floating widget routes properly
  useEffect(() => {
    return registerResultViewer(({ task }) => {
      if (task.taskType === 'quiz') {
        const quizId = task.persistedEntityId || task.resultData?.quizId;
        if (quizId) {
          handleStartQuiz(quizId);
        } else {
          handleTabChange('quizzes');
        }
      } else if (task.taskType === 'lesson') {
        if (task.resultData?.lesson) {
          setLessonDraftToPreview(task.resultData.lesson);
          setCreateLessonParams({
            initialTopic: task.resultData.lesson.topic || task.resultData.lesson.lessonTitle,
          });
          setIsCreateLessonModalOpen(true);
        } else {
          handleTabChange('library');
        }
      } else if (task.taskType === 'flashcards') {
        if (task.resultData?.deck) {
          setFlashcardDraftToPreview(task.resultData.deck);
          setStandaloneFlashcardInitialTopic(task.resultData.deck.title || task.topic || '');
          setIsStandaloneFlashcardModalOpen(true);
        } else {
          handleTabChange('flashcards');
        }
      }
    });
  }, [registerResultViewer]);

  const [isMobileAccountOpen, setIsMobileAccountOpen] = useState(false);

  // Synchronize browser history and hardware back buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'flashcards' || tab === 'quizzes' || tab === 'labs' || tab === 'curriculum' || tab === 'library') {
          setMainTab(tab as TabId);
        }
        const lesson = params.get('lesson');
        setActiveLessonId(lesson);
        const genLesson = params.get('genLesson');
        setSelectedGeneratedLessonId(genLesson);
        const deck = params.get('deckId');
        setStudyingDeckId(deck);
        const qId = params.get('quizId');
        setActiveQuizId(qId);
        const aId = params.get('attemptId');
        setActiveAttemptId(aId);
        const scenario = params.get('scenario');
        setTargetLabScenarioId(scenario);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch full details when selectedGeneratedLessonId changes
  useEffect(() => {
    if (!selectedGeneratedLessonId) {
      setSelectedGeneratedLesson(null);
      return;
    }
    let cancelled = false;
    setIsLoadingGenLesson(true);
    generatedLessonsApi
      .getLesson(selectedGeneratedLessonId)
      .then((res) => {
        if (!cancelled && res.data?.success && res.data.lesson) {
          setSelectedGeneratedLesson(res.data.lesson);
        }
      })
      .catch((err) => {
        console.error('Failed to load generated lesson:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGenLesson(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGeneratedLessonId]);

  const handleOpenGeneratedLesson = (id: string) => {
    setSelectedGeneratedLessonId(id);
    setMainTab('library');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'library');
      url.searchParams.set('genLesson', id);
      window.history.pushState({ genLesson: id }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToLibraryHub = () => {
    setSelectedGeneratedLessonId(null);
    setSelectedGeneratedLesson(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('genLesson');
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleRenameGeneratedLesson = async (id: string, newTitle: string) => {
    await generatedLessonsApi.renameLesson(id, newTitle);
    if (selectedGeneratedLesson && selectedGeneratedLesson.id === id) {
      setSelectedGeneratedLesson({
        ...selectedGeneratedLesson,
        title: newTitle,
      });
    }
  };

  const handleDeleteGeneratedLesson = async (id: string) => {
    await generatedLessonsApi.deleteLesson(id);
    handleBackToLibraryHub();
  };

  const handleSelectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setMainTab('curriculum');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'curriculum');
      url.searchParams.set('lesson', lessonId);
      window.history.pushState({ lessonId }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToCurriculum = () => {
    setActiveLessonId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('lesson');
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleTabChange = (newTab: TabId) => {
    setMainTab(newTab);
    setActiveLessonId(null);
    setSelectedGeneratedLessonId(null);
    setSelectedGeneratedLesson(null);
    setStudyingDeckId(null);
    setActiveQuizId(null);
    setActiveAttemptId(null);
    if (newTab !== 'labs') {
      setTargetLabScenarioId(null);
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      url.searchParams.delete('lesson');
      url.searchParams.delete('genLesson');
      url.searchParams.delete('deckId');
      url.searchParams.delete('quizId');
      url.searchParams.delete('attemptId');
      if (newTab !== 'labs') {
        url.searchParams.delete('scenario');
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleNavigateToLabs = (scenarioOrLabId?: string) => {
    if (scenarioOrLabId) {
      setTargetLabScenarioId(scenarioOrLabId);
    }
    setMainTab('labs');
    setActiveLessonId(null);
    setSelectedGeneratedLessonId(null);
    setSelectedGeneratedLesson(null);
    setStudyingDeckId(null);
    setActiveQuizId(null);
    setActiveAttemptId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'labs');
      url.searchParams.delete('lesson');
      url.searchParams.delete('genLesson');
      url.searchParams.delete('deckId');
      url.searchParams.delete('quizId');
      url.searchParams.delete('attemptId');
      if (scenarioOrLabId) {
        url.searchParams.set('scenario', scenarioOrLabId);
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleStartQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setActiveAttemptId(null);
    setActiveAttemptData(null);
    setMainTab('quizzes');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'quizzes');
      url.searchParams.set('quizId', quizId);
      url.searchParams.delete('attemptId');
      window.history.pushState({ quizId }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleViewQuizResults = (attemptId: string, preloadedAttempt?: GradedQuizAttemptResponse) => {
    setActiveAttemptId(attemptId);
    setActiveAttemptData(preloadedAttempt || null);
    setActiveQuizId(null);
    setMainTab('quizzes');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'quizzes');
      url.searchParams.set('attemptId', attemptId);
      url.searchParams.delete('quizId');
      window.history.pushState({ attemptId }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleExitQuiz = () => {
    setActiveQuizId(null);
    setActiveAttemptId(null);
    setActiveAttemptData(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('quizId');
      url.searchParams.delete('attemptId');
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleStudyDeck = (deckId: string) => {
    setStudyingDeckId(deckId);
    setMainTab('flashcards');
    setSelectedGeneratedLessonId(null);
    setSelectedGeneratedLesson(null);
    setActiveQuizId(null);
    setActiveAttemptId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'flashcards');
      url.searchParams.set('deckId', deckId);
      url.searchParams.delete('genLesson');
      url.searchParams.delete('lesson');
      url.searchParams.delete('quizId');
      url.searchParams.delete('attemptId');
      window.history.pushState({ deckId }, '', url.toString());
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const activeLessonData = useMemo(() => {
    if (!activeLessonId) return null;
    for (const p of CURRICULUM_PATHS) {
      for (const t of p.topics) {
        const found = t.lessons.find((l) => l.id === activeLessonId);
        if (found) {
          return { lesson: found, pathTitle: p.title, topicTitle: t.title };
        }
      }
    }
    return null;
  }, [activeLessonId]);

  const isInsideLesson =
    (mainTab === 'curriculum' && !!activeLessonData) ||
    (mainTab === 'library' && !!selectedGeneratedLessonId) ||
    (mainTab === 'flashcards' && !!studyingDeckId) ||
    (mainTab === 'quizzes' && (!!activeQuizId || !!activeAttemptId));

  const formatExpiresAt = (expSeconds: number | null) => {
    if (!expSeconds) return 'Active';
    const date = new Date(expSeconds * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const navOptions = [
    {
      id: 'curriculum' as TabId,
      label: 'Curriculum',
      icon: <Compass className="w-4 h-4" />,
      badge: 'Core',
    },
    {
      id: 'flashcards' as TabId,
      label: 'Flashcards',
      icon: <Layers className="w-4 h-4" />,
      badge: 'CCNA',
    },
    {
      id: 'quizzes' as TabId,
      label: 'Quizzes',
      icon: <FileQuestion className="w-4 h-4" />,
      badge: 'AI',
    },
    {
      id: 'labs' as TabId,
      label: 'Labs',
      icon: <Network className="w-4 h-4" />,
      badge: '48 .pkt',
    },
    {
      id: 'library' as TabId,
      label: 'Personal Library',
      icon: <BookOpen className="w-4 h-4" />,
      badge: 'AI',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-slate-100 flex flex-col font-sans selection:bg-accent/30 selection:text-white">
      {/* Demo Mode Alert Banner */}
      {isDemoMode && (
        <aside
          aria-label="Demo mode warning"
          className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-2 text-center text-xs text-amber-200 flex flex-wrap items-center justify-center gap-2 backdrop-blur-md"
        >
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span>
            <strong>DEMO MODE ACTIVE:</strong> Exploring synthetic curriculum data. Real database authentication is bypassed.
          </span>
          <button
            onClick={exitDemoMode}
            className="ml-2 px-2.5 py-0.5 rounded-full bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-700/80 text-[11px] font-medium press-scale"
          >
            Exit Demo
          </button>
        </aside>
      )}

      {/* Floating Glass Navigation Header */}
      <header className="glass-nav sticky top-0 z-30 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Brand Identity / Sticky Lesson Back Navigation */}
          {isInsideLesson && (activeLessonData || selectedGeneratedLesson) ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
              <button
                type="button"
                onClick={activeLessonData ? handleBackToCurriculum : handleBackToLibraryHub}
                className="flex items-center gap-2 text-slate-200 hover:text-white transition-colors press-scale py-1 -ml-1 pl-1 pr-2.5 rounded-xl hover:bg-surface-interactive min-h-[44px] touch-target-44 group"
                aria-label={activeLessonData ? "Back to Curriculum" : "Back to Personal Library"}
              >
                <div className="w-8 h-8 rounded-xl bg-surface-elevated border border-border-hairline flex items-center justify-center text-accent group-hover:text-white group-hover:border-accent/50 transition-colors shadow-sm flex-shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider leading-none">
                    {activeLessonData ? "Curriculum" : "Library"}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[85px] xs:max-w-[150px] sm:max-w-[280px]">
                    {activeLessonData?.lesson.title || selectedGeneratedLesson?.title}
                  </span>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-surface-elevated flex items-center justify-center shadow-md border border-border-hairline overflow-hidden p-0.5">
                <img src="/icon.svg" alt="NetMentor" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-bold tracking-tight text-white heading-title">
                    NetMentor
                  </span>
                  {isDemoMode ? (
                    <Badge variant="amber" size="sm" className="hidden xs:inline-flex">
                      Demo Mode
                    </Badge>
                  ) : (
                    <Badge variant="blue" size="sm" className="hidden xs:inline-flex">
                      Protected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Interactive Networking Engineering & CCNA / CCNP Mastery
                </p>
              </div>
            </div>
          )}

          {/* Desktop Right Controls (AI Tutor, Database status, Session info & Logout) */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openTutor()}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl bg-surface-elevated/70 hover:bg-surface-elevated text-slate-200 hover:text-white border border-slate-700/60 hover:border-accent/40 shadow-inner-light transition-all press-scale min-h-[36px]"
              aria-label="Open NetMentor AI Tutor"
            >
              <Bot className="w-3.5 h-3.5 text-accent" />
              <span className="font-medium">Ask AI Tutor</span>
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                AI Assistant
              </span>
            </button>

            <DatabaseStatusBadge showLatency={true} />

            <div className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-xl bg-surface-elevated/70 text-emerald-400 border border-slate-700/60 shadow-inner-light">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-slate-300 font-medium">
                {user || 'jenilmoradiya50'}
              </span>
              {sessionExpiresAt && (
                <span className="text-slate-500 border-l border-slate-700/60 pl-2 flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3" />
                  {formatExpiresAt(sessionExpiresAt)}
                </span>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => (isDemoMode ? exitDemoMode() : logout())}
              icon={<LogOut className="w-3.5 h-3.5" />}
              title={isDemoMode ? 'Exit Demo Mode' : 'Sign Out of NetMentor'}
            >
              <span>{isDemoMode ? 'Exit' : 'Sign Out'}</span>
            </Button>
          </div>

          {/* Mobile Right Controls: AI Tutor & Compact Account Button */}
          <div className="flex items-center gap-1.5 md:hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => openTutor()}
              className="p-2 rounded-xl bg-surface-elevated text-accent border border-slate-700/60 press-scale min-h-[44px] min-w-[44px] flex items-center justify-center relative"
              aria-label="Open NetMentor AI Tutor"
              title="Ask AI Tutor"
            >
              <Bot className="w-4 h-4 text-accent" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
            </button>
            <DatabaseStatusBadge showLatency={false} />
            <button
              type="button"
              onClick={() => setIsMobileAccountOpen(true)}
              className="p-2 rounded-xl bg-surface-elevated text-slate-300 border border-slate-700/60 press-scale min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Account details"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Platform Navigation Bar with Bold Blue Active Indicator */}
      <nav aria-label="Desktop Platform Navigation" className="glass-subnav sticky top-[53px] z-20 hidden md:block">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1">
          {navOptions.map((opt) => {
            const isSelected = opt.id === mainTab;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTabChange(opt.id)}
                className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all select-none press-scale-subtle ${
                  isSelected
                    ? 'border-brand-500 text-brand-300 bg-brand-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
                {opt.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-brand-950 text-brand-300 border-brand-800/60 font-semibold'
                        : 'bg-surface-elevated text-slate-400 border-slate-700/60'
                    }`}
                  >
                    {opt.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area (extra bottom padding only on screens with floating dock) */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8 ${
          isInsideLesson ? 'pb-8 md:pb-12' : 'pb-32 md:pb-12'
        }`}
      >
        <Suspense fallback={<ViewLoadingFallback />}>
          {mainTab === 'flashcards' ? (
            <FlashcardsHub
              initialStudyingDeckId={studyingDeckId}
              onClearStudyingDeck={() => setStudyingDeckId(null)}
            />
          ) : mainTab === 'quizzes' ? (
            activeAttemptId ? (
              <QuizResultsView
                attemptId={activeAttemptId}
                initialAttempt={activeAttemptData}
                onRetake={(quizId) => handleStartQuiz(quizId)}
                onBackToHub={handleExitQuiz}
                onViewLesson={handleOpenGeneratedLesson}
              />
            ) : activeQuizId ? (
              <QuizPlayerView
                quizId={activeQuizId}
                onComplete={(attemptId, attempt) => handleViewQuizResults(attemptId, attempt)}
                onExit={handleExitQuiz}
              />
            ) : (
              <QuizzesHub
                onStartQuiz={handleStartQuiz}
                onViewResults={handleViewQuizResults}
                onOpenGenerator={() => {
                  setQuizModalParams({});
                  setIsQuizModalOpen(true);
                }}
                onViewLesson={handleOpenGeneratedLesson}
              />
            )
          ) : mainTab === 'labs' ? (
            <PacketTracerLabsView targetScenarioId={targetLabScenarioId} />
          ) : mainTab === 'library' ? (
            selectedGeneratedLesson ? (
              <GeneratedLessonReader
                lesson={selectedGeneratedLesson}
                onBack={handleBackToLibraryHub}
                onRename={handleRenameGeneratedLesson}
                onDelete={handleDeleteGeneratedLesson}
                onStudyDeck={handleStudyDeck}
                onTakeQuiz={handleStartQuiz}
                onGenerateQuiz={(lessonId, lessonTitle, lessonTopic) => {
                  setQuizModalParams({
                    lessonId,
                    lessonTitle,
                    initialTopic: lessonTopic,
                  });
                  setIsQuizModalOpen(true);
                }}
                onAskAi={(topic) => {
                  openTutor({
                    mode: 'general_qa',
                    lessonTitle: topic,
                  });
                }}
              />
            ) : isLoadingGenLesson ? (
              <div className="py-24 text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-white/50">Loading custom lesson...</p>
              </div>
            ) : (
              <PersonalLibraryHub
                onOpenLesson={handleOpenGeneratedLesson}
                onCreateNewLesson={() => {
                  setCreateLessonParams({});
                  setIsCreateLessonModalOpen(true);
                }}
              />
            )
          ) : (
            <CurriculumHub
              activeLessonId={activeLessonId}
              onSelectLesson={handleSelectLesson}
              onBackToCurriculum={handleBackToCurriculum}
              onNavigateToFlashcards={() => handleTabChange('flashcards')}
              onNavigateToLabs={handleNavigateToLabs}
            />
          )}
        </Suspense>

        {/* Mobile bottom clearance spacer ensuring content never sits behind the floating dock */}
        {!isInsideLesson && (
          <div className="h-20 md:hidden pointer-events-none" aria-hidden="true" />
        )}
      </main>

      {/* Mobile Floating iOS-style Navigation Dock (Hidden inside individual lesson) */}
      {!isInsideLesson && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-3 left-4 right-4 z-40 glass-dock rounded-2xl p-1.5 flex items-center justify-around shadow-2xl safe-bottom"
        >
          {navOptions.map((opt) => {
            const isActive = mainTab === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTabChange(opt.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-xs font-medium transition-all duration-150 min-h-[44px] press-scale select-none ${
                  isActive
                    ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="mb-0.5">{opt.icon}</span>
                <span className="text-[11px] tracking-tight">{opt.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Mobile Account Details Bottom Sheet */}
      <Sheet
        isOpen={isMobileAccountOpen}
        onClose={() => setIsMobileAccountOpen(false)}
        title="Session & Security"
        subtitle="Active user credentials and database connection"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.08] space-y-2">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Signed in User
            </span>
            <div className="flex items-center gap-2 text-white font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{user || 'jenilmoradiya50'}</span>
            </div>
            {sessionExpiresAt && (
              <p className="text-xs text-slate-400 flex items-center gap-1 font-mono pt-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Session Expiry: {formatExpiresAt(sessionExpiresAt)}
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl bg-surface-subtle/80 border border-white/[0.08] space-y-2">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Neon PostgreSQL Target
            </span>
            <DatabaseStatusBadge showLatency={true} />
          </div>

          <div className="pt-2">
            <Button
              variant="danger"
              size="lg"
              className="w-full"
              onClick={() => {
                setIsMobileAccountOpen(false);
                if (isDemoMode) {
                  exitDemoMode();
                } else {
                  logout();
                }
              }}
              icon={<LogOut className="w-4 h-4" />}
            >
              {isDemoMode ? 'Exit Demo Mode' : 'Sign Out of NetMentor'}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Floating Ask AI Tutor Entry Button (Single persistent global entry point) */}
      <button
        type="button"
        onClick={() => openTutor()}
        className={`fixed z-40 flex items-center gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-full bg-surface-elevated/95 border border-accent/40 text-white shadow-xl shadow-black/50 hover:border-accent hover:bg-surface-elevated hover:shadow-accent/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none transition-all press-scale backdrop-blur-md min-h-[44px] touch-target-44 ${
          isInsideLesson
            ? 'bottom-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] right-4 sm:bottom-6 sm:right-6'
            : 'bottom-24 right-4 md:bottom-6 md:right-6'
        }`}
        aria-label="Open NetMentor AI Tutor"
      >
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <Bot className="w-4 h-4 text-accent" />
        <span className="text-xs font-bold tracking-tight">Ask AI Tutor</span>
        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
          AI Assistant
        </span>
      </button>

      {/* Global AI Tutor Slide-Over Drawer */}
      <AiTutorDrawer
        isOpen={isAiTutorOpen}
        onClose={closeTutor}
        lessonId={lessonContext?.lessonId}
        lessonTitle={lessonContext?.lessonTitle}
        sections={lessonContext?.sections}
        activeSectionId={activeSectionId}
        activeExerciseId={activeExerciseId}
        initialMode={aiTutorMode}
        initialPrompt={initialPrompt}
        onClearInitialPrompt={() => setInitialPrompt(undefined)}
        onCreateLesson={(topic, context, convId) => {
          setCreateLessonParams({
            initialTopic: topic,
            context,
            conversationId: convId,
          });
          setIsCreateLessonModalOpen(true);
        }}
        onGenerateStandaloneFlashcards={(topic) => {
          setStandaloneFlashcardInitialTopic(topic);
          setIsStandaloneFlashcardModalOpen(true);
        }}
      />

      {/* Persistent Background AI Generation Widget (Milestone 3) */}
      <FloatingGenerationWidget />

      {/* AI Lesson Generator Modal */}
      <GenerateLessonModal
        isOpen={isCreateLessonModalOpen}
        onClose={() => {
          setIsCreateLessonModalOpen(false);
          setLessonDraftToPreview(null);
        }}
        onLessonSaved={(lessonId) => {
          setIsCreateLessonModalOpen(false);
          setLessonDraftToPreview(null);
          setMainTab('library');
          handleOpenGeneratedLesson(lessonId);
        }}
        initialTopic={createLessonParams.initialTopic}
        conversationContext={createLessonParams.context}
        conversationId={createLessonParams.conversationId}
        initialDraftLesson={lessonDraftToPreview}
      />

      {/* AI Quiz Generator Modal */}
      <GenerateQuizModal
        isOpen={isQuizModalOpen}
        onClose={() => setIsQuizModalOpen(false)}
        initialTopic={quizModalParams.initialTopic}
        lessonId={quizModalParams.lessonId}
        lessonTitle={quizModalParams.lessonTitle}
        onQuizReady={(quizId, autoStart) => {
          setIsQuizModalOpen(false);
          if (autoStart) {
            handleStartQuiz(quizId);
          } else {
            handleTabChange('quizzes');
          }
        }}
      />

      {/* Standalone AI Flashcard Generator Modal */}
      <GenerateStandaloneFlashcardModal
        isOpen={isStandaloneFlashcardModalOpen}
        onClose={() => {
          setIsStandaloneFlashcardModalOpen(false);
          setFlashcardDraftToPreview(null);
        }}
        initialTopic={standaloneFlashcardInitialTopic}
        initialDraftDeck={flashcardDraftToPreview}
        onSaved={() => {
          setIsStandaloneFlashcardModalOpen(false);
          setFlashcardDraftToPreview(null);
          handleTabChange('flashcards');
        }}
        onStudyNow={(deckId) => {
          setIsStandaloneFlashcardModalOpen(false);
          setFlashcardDraftToPreview(null);
          handleStudyDeck(deckId);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-5 px-4 text-center text-xs text-slate-500 safe-bottom">
        NetMentor &bull; Personal AI Networking Tutor &bull; Protected Session
      </footer>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Full-screen loading screen while checking existing HttpOnly session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="h-16 w-16 rounded-2xl bg-surface-elevated border border-border-hairline flex items-center justify-center p-2 mb-4 shadow-xl shadow-accent/10 animate-pulse">
          <img src="/icon.svg" alt="NetMentor" className="w-full h-full object-contain" />
        </div>
        <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          Verifying security session...
        </p>
      </div>
    );
  }

  // Unauthenticated visitors must log in
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Authenticated user gets full application
  return <Dashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <GenerationManagerProvider>
        <AiTutorProvider>
          <AppContent />
        </AiTutorProvider>
      </GenerationManagerProvider>
    </AuthProvider>
  );
}

export default App;
