import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Sparkles,
  Plus,
  Search,
  Clock,
  Trash2,
  Edit2,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import {
  generatedLessonsApi,
  type GeneratedLessonSummary,
} from '../../lib/api';

interface PersonalLibraryHubProps {
  onOpenLesson: (lessonId: string) => void;
  onCreateNewLesson: () => void;
}

export const PersonalLibraryHub: React.FC<PersonalLibraryHubProps> = ({
  onOpenLesson,
  onCreateNewLesson,
}) => {
  const [lessons, setLessons] = useState<GeneratedLessonSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  // Inline rename & delete states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadLessons = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await generatedLessonsApi.listLessons({
        search: searchQuery.trim() || undefined,
        difficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
      });
      if (res.data?.success) {
        setLessons(res.data.lessons || []);
      } else {
        setErrorMessage(res.message || 'Failed to load personal library lessons.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error fetching generated lessons.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, [searchQuery, difficultyFilter]);

  const handleRename = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await generatedLessonsApi.renameLesson(id, editingTitle.trim());
      setLessons((prev) =>
        prev.map((l) => (l.id === id ? { ...l, title: editingTitle.trim() } : l))
      );
      setEditingId(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to rename lesson.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await generatedLessonsApi.deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete lesson.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-surface border border-white/10 rounded-2xl shadow-glass">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <BookOpen className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Personal Learning Library
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-white/60 leading-relaxed max-w-2xl">
            Your private repository of custom AI-generated lessons. Generated lessons are isolated from the official curriculum and persistent across devices.
          </p>
        </div>

        <button
          onClick={onCreateNewLesson}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold bg-accent text-white hover:bg-accent-hover shadow-glow-brand transition-all shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Create Custom Lesson
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lessons by title, topic, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-white/40 hidden sm:block" />
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as any)}
            className="px-3 py-2.5 bg-surface border border-white/10 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-accent"
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-xs text-white/50">Loading your saved lessons...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && lessons.length === 0 && (
        <div className="py-16 px-6 bg-surface border border-white/10 rounded-2xl text-center space-y-4 shadow-glass">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 text-accent mx-auto">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">No Saved Lessons Found</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              {searchQuery || difficultyFilter !== 'all'
                ? 'No lessons matched your current filter criteria. Try adjusting your search query.'
                : 'You have not created any custom networking lessons yet. Discuss a topic with the AI Tutor and click "Create Lesson" or start one now!'}
            </p>
          </div>
          <button
            onClick={onCreateNewLesson}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-glow-brand transition-all"
          >
            <Plus className="w-4 h-4" />
            Generate Your First Custom Lesson
          </button>
        </div>
      )}

      {/* Lessons Grid */}
      {!isLoading && lessons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="group flex flex-col justify-between p-5 bg-surface border border-white/10 rounded-2xl hover:border-accent/40 hover:shadow-glow-brand-sm transition-all shadow-glass"
            >
              <div className="space-y-3">
                {/* Meta badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30">
                      {lesson.difficulty}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-white/50">
                      <Clock className="w-3 h-3" />
                      ~{lesson.estimatedMinutes}m
                    </span>
                  </div>

                  <span className="text-[10px] text-white/40 font-mono">
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Title */}
                {editingId === lesson.id ? (
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-canvas border border-accent rounded-lg text-xs font-bold text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(lesson.id)}
                      className="px-2 py-1 bg-accent text-white text-[11px] font-bold rounded-lg hover:bg-accent-hover"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-1.5 py-1 text-[11px] text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <h3
                      onClick={() => onOpenLesson(lesson.id)}
                      className="text-base font-bold text-white group-hover:text-accent transition-colors cursor-pointer line-clamp-2"
                    >
                      {lesson.title}
                    </h3>
                    <p className="text-xs text-white/60 mt-1 line-clamp-2 leading-relaxed">
                      {lesson.description}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {lesson.tags && lesson.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {lesson.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] bg-white/[0.04] text-white/60 border border-white/5"
                      >
                        #{tag}
                      </span>
                    ))}
                    {lesson.tags.length > 3 && (
                      <span className="text-[10px] text-white/40 self-center">
                        +{lesson.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Card Actions */}
              <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(lesson.id);
                      setEditingTitle(lesson.title);
                    }}
                    className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Rename lesson"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {deletingId === lesson.id ? (
                    <div className="flex items-center gap-1 bg-danger/10 border border-danger/30 rounded-lg p-0.5">
                      <span className="text-[10px] text-danger px-1">Delete?</span>
                      <button
                        onClick={() => handleDelete(lesson.id)}
                        className="px-1.5 py-0.5 bg-danger text-white text-[10px] font-bold rounded hover:bg-danger-hover"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-1 text-[10px] text-white/60 hover:text-white"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(lesson.id)}
                      className="p-1.5 text-danger/50 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      title="Delete lesson"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => onOpenLesson(lesson.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-accent hover:text-white text-white/80 transition-all"
                >
                  <span>Read Lesson</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
