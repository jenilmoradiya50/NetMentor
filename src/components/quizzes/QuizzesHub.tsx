import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Sparkles,
  Search,
  Clock,
  Play,
  RotateCcw,
  Trash2,
  BookOpen,
  Award,
  Loader2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import {
  quizzesApi,
  type UserQuizSummaryItem,
  type QuizDifficulty,
} from '../../lib/api';

interface QuizzesHubProps {
  onStartQuiz: (quizId: string) => void;
  onViewResults: (attemptId: string) => void;
  onOpenGenerator: () => void;
  onViewLesson?: (lessonId: string) => void;
}

export const QuizzesHub: React.FC<QuizzesHubProps> = ({
  onStartQuiz,
  onViewResults,
  onOpenGenerator,
  onViewLesson,
}) => {
  const [quizzes, setQuizzes] = useState<UserQuizSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'lesson' | 'standalone'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | QuizDifficulty>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await quizzesApi.listQuizzes();
      if (res.data?.success && res.data.quizzes) {
        setQuizzes(res.data.quizzes);
      } else {
        setError(res.message || 'Failed to load quizzes.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz and all its attempt history?')) {
      return;
    }

    try {
      setDeletingId(quizId);
      await quizzesApi.deleteQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete quiz.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredQuizzes = quizzes.filter((q) => {
    // Search
    if (search.trim()) {
      const qLower = search.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(qLower);
      const matchTopic = q.topic.toLowerCase().includes(qLower);
      if (!matchTitle && !matchTopic) return false;
    }

    // Scope
    if (scopeFilter === 'lesson' && !q.lessonId) return false;
    if (scopeFilter === 'standalone' && q.lessonId) return false;

    // Difficulty
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileQuestion className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              AI Knowledge Quizzes
            </h1>
          </div>
          <p className="text-sm text-slate-400 max-w-xl">
            Test and validate your networking comprehension with AI-crafted assessments, real-world troubleshooting scenarios, and automated server-side grading.
          </p>
        </div>

        <button
          onClick={onOpenGenerator}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Generate AI Quiz</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quizzes by title or topic..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'lesson', label: 'Lesson Quizzes' },
                { id: 'standalone', label: 'Standalone' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setScopeFilter(item.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  scopeFilter === item.id
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Difficulty Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            {(
              [
                { id: 'all', label: 'All Diffs' },
                { id: 'easy', label: 'Easy' },
                { id: 'medium', label: 'Med' },
                { id: 'hard', label: 'Hard' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setDifficultyFilter(item.id)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition capitalize ${
                  difficultyFilter === item.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <p className="text-sm text-slate-400">Loading your quizzes...</p>
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-slate-300">{error}</p>
          <button
            onClick={fetchQuizzes}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="p-12 sm:p-16 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-slate-500">
            <FileQuestion className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Quizzes Found</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              {quizzes.length === 0
                ? 'You have not created any AI assessments yet. Generate your first custom networking quiz now.'
                : 'No quizzes match your selected filter or search term.'}
            </p>
          </div>
          {quizzes.length === 0 && (
            <button
              onClick={onOpenGenerator}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-lg shadow-cyan-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Quiz Now</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuizzes.map((quiz) => {
            const hasAttempt = Boolean(quiz.latestAttempt);
            const isPassing = hasAttempt && (quiz.latestAttempt?.percentage || 0) >= 75;

            return (
              <div
                key={quiz.id}
                className="flex flex-col justify-between p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-4 group"
              >
                {/* Top Card Info */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {quiz.topic}
                    </span>

                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded capitalize ${
                        quiz.difficulty === 'easy'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : quiz.difficulty === 'hard'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {quiz.difficulty}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2 group-hover:text-cyan-300 transition">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                      <span>{quiz.questionCount} Questions</span>
                      <span>•</span>
                      <span>{quiz.questionTypes.length} types</span>
                    </p>
                  </div>

                  {/* Linked Lesson Notice */}
                  {quiz.lessonId && (
                    <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-slate-400 truncate">
                        <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">
                          {quiz.lessonTitle ? `Lesson: ${quiz.lessonTitle}` : 'Linked Lesson'}
                        </span>
                      </div>
                      {onViewLesson && (
                        <button
                          onClick={() => onViewLesson(quiz.lessonId!)}
                          className="text-cyan-400 hover:underline shrink-0 text-xs font-medium pl-1"
                        >
                          View
                        </button>
                      )}
                    </div>
                  )}

                  {/* Latest Attempt Performance Pill */}
                  <div className="pt-1">
                    {hasAttempt && quiz.latestAttempt ? (
                      <div
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                          isPassing
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Award className="w-4 h-4 shrink-0" />
                          <span>
                            Latest: <strong className="font-bold">{quiz.latestAttempt.percentage}%</strong> ({quiz.latestAttempt.score}/{quiz.latestAttempt.totalQuestions})
                          </span>
                        </div>
                        <span className="text-slate-400 text-xs font-mono">
                          {new Date(quiz.latestAttempt.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Not yet attempted</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartQuiz(quiz.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition shadow-sm"
                    >
                      {hasAttempt ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{hasAttempt ? 'Retake' : 'Take Quiz'}</span>
                    </button>

                    {hasAttempt && (
                      <button
                        onClick={() => {
                          quizzesApi.getAttempts(quiz.id).then((res) => {
                            if (res.data?.attempts && res.data.attempts.length > 0) {
                              onViewResults(res.data.attempts[0].id);
                            }
                          });
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="View Last Results"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    disabled={deletingId === quiz.id}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-slate-800 transition disabled:opacity-50"
                    title="Delete Quiz"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
