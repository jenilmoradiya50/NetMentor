import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { DatabaseStatusBadge } from './components/common/DatabaseStatusBadge';
import { GenerateStandaloneFlashcardModal } from './components/flashcards/GenerateStandaloneFlashcardModal';
import { GenerateLessonModal } from './components/library/GenerateLessonModal';
import { Sheet } from './components/ui/Sheet';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { DraggableFloatingPill } from './components/ui/DraggableFloatingPill';
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
  Activity,
} from 'lucide-react';
import { AiTutorProvider, useAiTutor } from './context/AiTutorContext';
import { AiTutorDrawer } from './components/curriculum/AiTutorDrawer';
import type { ActiveLabContext } from './types/protocol-simulation';
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
const CommandCenterDashboard = lazy(() =>
  import('./components/dashboard/CommandCenterDashboard').then((m) => ({ default: m.CommandCenterDashboard })),
);
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

export type TabId = 'dashboard' | 'curriculum' | 'flashcards' | 'quizzes' | 'labs' | 'library';

export interface AppRouteState {
  tab: TabId;
  scenarioId: string | null;
  lessonId: string | null;
  genLessonId: string | null;
  deckId: string | null;
  quizId: string | null;
  attemptId: string | null;
  isLegacyRedirect?: boolean;
}

export function parseAppRoute(pathname: string, search: string): AppRouteState {
  const searchParams = new URLSearchParams(search);
  const legacyTab = searchParams.get('tab');
  const legacyScenario = searchParams.get('scenario');
  const lessonId = searchParams.get('lesson');
  const genLessonId = searchParams.get('genLesson');
  const deckId = searchParams.get('deckId');
  const quizId = searchParams.get('quizId');
  const attemptId = searchParams.get('attemptId');

  let tab: TabId = 'dashboard';
  let scenarioId: string | null = legacyScenario || null;
  let isLegacyRedirect = false;

  // 1. Check legacy query string (?tab=...)
  if (legacyTab && ['dashboard', 'curriculum', 'flashcards', 'quizzes', 'labs', 'library'].includes(legacyTab)) {
    tab = legacyTab as TabId;
    isLegacyRedirect = true;
  } else {
    // 2. Parse clean path
    const trimmedPath = pathname.replace(/\/+$/, '') || '/';
    if (trimmedPath === '/' || trimmedPath === '/dashboard') {
      tab = 'dashboard';
    } else if (trimmedPath === '/curriculum') {
      tab = 'curriculum';
    } else if (trimmedPath === '/flashcards') {
      tab = 'flashcards';
    } else if (trimmedPath === '/quizzes') {
      tab = 'quizzes';
    } else if (trimmedPath === '/library') {
      tab = 'library';
    } else if (trimmedPath === '/labs') {
      tab = 'labs';
    } else if (trimmedPath.startsWith('/labs/')) {
      tab = 'labs';
      const segment = trimmedPath.slice('/labs/'.length).trim();
      if (segment) {
        scenarioId = decodeURIComponent(segment);
      }
    }
  }

  return {
    tab,
    scenarioId,
    lessonId,
    genLessonId,
    deckId,
    quizId,
    attemptId,
    isLegacyRedirect,
  };
}

export function buildAppUrl(state: {
  tab: TabId;
  scenarioId?: string | null;
  lessonId?: string | null;
  genLessonId?: string | null;
  deckId?: string | null;
  quizId?: string | null;
  attemptId?: string | null;
}): string {
  let path = '/';
  if (state.tab === 'curriculum') path = '/curriculum';
  else if (state.tab === 'flashcards') path = '/flashcards';
  else if (state.tab === 'quizzes') path = '/quizzes';
  else if (state.tab === 'library') path = '/library';
  else if (state.tab === 'labs') {
    path = state.scenarioId ? `/labs/${encodeURIComponent(state.scenarioId)}` : '/labs';
  }

  const query = new URLSearchParams();
  if (state.lessonId) query.set('lesson', state.lessonId);
  if (state.genLessonId) query.set('genLesson', state.genLessonId);
  if (state.deckId) query.set('deckId', state.deckId);
  if (state.quizId) query.set('quizId', state.quizId);
  if (state.attemptId) query.set('attemptId', state.attemptId);

  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

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

  // Initialize route state from current window location
  const initialRoute = useMemo(() => {
    if (typeof window !== 'undefined') {
      return parseAppRoute(window.location.pathname, window.location.search);
    }
    return {
      tab: 'dashboard' as TabId,
      scenarioId: null,
      lessonId: null,
      genLessonId: null,
      deckId: null,
      quizId: null,
      attemptId: null,
      isLegacyRedirect: false,
    };
  }, []);

  const [mainTab, setMainTab] = useState<TabId>(initialRoute.tab);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(initialRoute.lessonId);
  const [selectedGeneratedLessonId, setSelectedGeneratedLessonId] = useState<string | null>(initialRoute.genLessonId);
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(initialRoute.deckId);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(initialRoute.quizId);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(initialRoute.attemptId);
  const [targetLabScenarioId, setTargetLabScenarioId] = useState<string | null>(initialRoute.scenarioId);
  const [activeAttemptData, setActiveAttemptData] = useState<GradedQuizAttemptResponse | null>(null);
  const [selectedGeneratedLesson, setSelectedGeneratedLesson] = useState<GeneratedLessonDetail | null>(null);
  const [isLoadingGenLesson, setIsLoadingGenLesson] = useState(false);

  // Normalize legacy query URLs (?tab=labs&scenario=...) to clean paths (/labs/...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const current = parseAppRoute(window.location.pathname, window.location.search);
      if (current.isLegacyRedirect) {
        const cleanUrl = buildAppUrl({
          tab: current.tab,
          scenarioId: current.scenarioId,
          lessonId: current.lessonId,
          genLessonId: current.genLessonId,
          deckId: current.deckId,
          quizId: current.quizId,
          attemptId: current.attemptId,
        });
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, []);


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
  const [activeLabContext, setActiveLabContext] = useState<ActiveLabContext | null>(null);

  // Clear lab context when leaving labs tab
  useEffect(() => {
    if (mainTab !== 'labs') {
      setActiveLabContext(null);
    }
  }, [mainTab]);

  // Synchronize browser history and hardware back buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const state = parseAppRoute(window.location.pathname, window.location.search);
        setMainTab(state.tab);
        setActiveLessonId(state.lessonId);
        setSelectedGeneratedLessonId(state.genLessonId);
        setStudyingDeckId(state.deckId);
        setActiveQuizId(state.quizId);
        setActiveAttemptId(state.attemptId);
        setTargetLabScenarioId(state.scenarioId);
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
      const nextUrl = buildAppUrl({ tab: 'library', genLessonId: id });
      window.history.pushState({ genLesson: id }, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToLibraryHub = () => {
    setSelectedGeneratedLessonId(null);
    setSelectedGeneratedLesson(null);
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppUrl({ tab: 'library' });
      window.history.pushState({}, '', nextUrl);
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
      const nextUrl = buildAppUrl({ tab: 'curriculum', lessonId });
      window.history.pushState({ lessonId }, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToCurriculum = () => {
    setActiveLessonId(null);
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppUrl({ tab: 'curriculum' });
      window.history.pushState({}, '', nextUrl);
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
      const nextUrl = buildAppUrl({
        tab: newTab,
        scenarioId: newTab === 'labs' ? targetLabScenarioId : null,
      });
      window.history.pushState({}, '', nextUrl);
    }
  };

  const handleNavigateToLabs = (scenarioOrLabId?: string) => {
    const scenarioId = scenarioOrLabId || targetLabScenarioId || null;
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
      const nextUrl = buildAppUrl({ tab: 'labs', scenarioId });
      window.history.pushState({}, '', nextUrl);
    }
  };

  const handleStartQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setActiveAttemptId(null);
    setActiveAttemptData(null);
    setMainTab('quizzes');
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppUrl({ tab: 'quizzes', quizId });
      window.history.pushState({ quizId }, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleViewQuizResults = (attemptId: string, preloadedAttempt?: GradedQuizAttemptResponse) => {
    setActiveAttemptId(attemptId);
    setActiveAttemptData(preloadedAttempt || null);
    setActiveQuizId(null);
    setMainTab('quizzes');
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppUrl({ tab: 'quizzes', attemptId });
      window.history.pushState({ attemptId }, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleExitQuiz = () => {
    setActiveQuizId(null);
    setActiveAttemptId(null);
    setActiveAttemptData(null);
    if (typeof window !== 'undefined') {
      const nextUrl = buildAppUrl({ tab: 'quizzes' });
      window.history.pushState({}, '', nextUrl);
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
      const nextUrl = buildAppUrl({ tab: 'flashcards', deckId });
      window.history.pushState({ deckId }, '', nextUrl);
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

  const desktopNavOptions = [
    {
      id: 'dashboard' as TabId,
      label: 'Command Center',
      icon: <Activity className="w-4 h-4" />,
      badge: 'Hub',
    },
    {
      id: 'curriculum' as TabId,
      label: 'Curriculum',
      icon: <Compass className="w-4 h-4" />,
      badge: 'Core',
    },
    {
      id: 'labs' as TabId,
      label: 'Labs',
      icon: <Network className="w-4 h-4" />,
      badge: '5 Sims',
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
      <header className="glass-nav sticky top-0 z-30 safe-top w-full border-b border-border-hairline bg-[#090A0C]/95 backdrop-blur-md">
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
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => handleTabChange('dashboard')}
                className="flex items-center gap-2.5 sm:gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl press-scale-subtle"
              >
                <div className="h-9 w-9 rounded-xl bg-surface-elevated flex items-center justify-center shadow-md border border-border-hairline overflow-hidden p-0.5 flex-shrink-0">
                  <img src="/icon.svg" alt="NetMentor" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-bold tracking-tight text-white heading-title">
                      NetMentor
                    </span>
                    {isDemoMode ? (
                      <Badge variant="amber" size="sm" className="hidden sm:inline-flex">
                        Demo Mode
                      </Badge>
                    ) : (
                      <Badge variant="blue" size="sm" className="hidden sm:inline-flex">
                        Protected
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Interactive Networking Engineering &amp; CCNA / CCNP Mastery
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* Desktop Right Controls (Database status, Session info & Logout) */}
          <div className="hidden md:flex items-center gap-3">
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

          {/* Mobile Right Controls: Database status badge/refresh & Compact Account Details */}
          <div className="flex items-center gap-2 md:hidden flex-shrink-0">
            <DatabaseStatusBadge showLatency={false} />
            <button
              type="button"
              onClick={() => setIsMobileAccountOpen(true)}
              className="p-2 rounded-xl bg-surface-elevated text-slate-300 border border-border-hairline press-scale min-h-[44px] min-w-[44px] flex items-center justify-center touch-target-44"
              aria-label="Account details"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Platform Navigation Bar with Bold Blue Active Indicator */}
      <nav aria-label="Desktop Platform Navigation" className="glass-subnav sticky top-[53px] z-20 hidden md:block border-b border-border-hairline">
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-1">
          {desktopNavOptions.map((opt) => {
            const isSelected = opt.id === mainTab;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTabChange(opt.id)}
                className={`py-3 px-3.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all select-none press-scale-subtle ${
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-7 pb-20">
        <Suspense fallback={<ViewLoadingFallback />}>
          {mainTab === 'dashboard' ? (
            <CommandCenterDashboard
              onNavigateToCurriculum={() => handleTabChange('curriculum')}
              onNavigateToLabs={handleNavigateToLabs}
              onNavigateToFlashcards={() => handleTabChange('flashcards')}
              onNavigateToQuizzes={() => handleTabChange('quizzes')}
              onNavigateToLibrary={() => handleTabChange('library')}
              onOpenAiTutor={() => openTutor()}
            />
          ) : mainTab === 'flashcards' ? (
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
            <PacketTracerLabsView
              targetScenarioId={targetLabScenarioId}
              onLabContextChange={setActiveLabContext}
            />
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
      </main>

      {/* Opposing Draggable Bottom-Corner Floating Action Buttons */}
      {/* Floating Dashboard Button (Bottom-Left default — visible only when mainTab !== 'dashboard') */}
      {mainTab !== 'dashboard' && (
        <DraggableFloatingPill
          storageKey="netmentor_fab_dashboard"
          defaultAlign="left"
          onClick={() => handleTabChange('dashboard')}
          ariaLabel="Return to Command Center Dashboard"
          title="Return to Command Center Dashboard (Drag to reposition)"
          className="bg-[#111317]/95 backdrop-blur-md border border-[#232730] hover:border-amber-500/50 text-slate-100 font-medium"
        >
          <ArrowLeft className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Dashboard</span>
        </DraggableFloatingPill>
      )}

      {/* Floating AI Tutor Button (Bottom-Right default — always accessible) */}
      <DraggableFloatingPill
        storageKey="netmentor_fab_ai"
        defaultAlign="right"
        onClick={() => openTutor()}
        ariaLabel="Open NetMentor AI Tutor"
        title="Ask NetMentor AI Tutor (Drag to reposition)"
        className="bg-[#111317]/95 backdrop-blur-md border border-amber-500/40 hover:border-amber-400 text-amber-400 font-semibold"
      >
        <Bot className="w-4 h-4 flex-shrink-0" />
        <span>Ask AI</span>
        <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse flex-shrink-0" />
      </DraggableFloatingPill>



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
        labContext={activeLabContext}
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
