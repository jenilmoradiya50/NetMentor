import React, { useState, useEffect, useCallback } from 'react';
import type { FlashcardDeck, FlashcardItem } from '../../types/flashcards';
import { flashcardsApi } from '../../lib/api';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  XCircle,
  Award,
  Loader2,
  Eye,
} from 'lucide-react';

interface StudyDeckViewProps {
  deckId: string;
  onBack: () => void;
}

export const StudyDeckView: React.FC<StudyDeckViewProps> = ({ deckId, onBack }) => {
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<FlashcardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [revealedBlank, setRevealedBlank] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Load deck & cards
  const loadCards = async () => {
    setLoading(true);
    setError(null);
    const res = await flashcardsApi.getCards(deckId);
    if (res.data?.cards && res.data?.deck) {
      setDeck(res.data.deck);
      setCards(res.data.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setRevealedBlank(false);
      setSessionCompleted(false);
    } else {
      setError(res.message || 'Failed to load flashcards for study.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCards();
  }, [deckId]);

  const currentCard = cards[currentIndex];

  // Flip card
  const handleToggleFlip = () => {
    setIsFlipped((prev) => !prev);
  };

  // Next / Previous navigation
  const handleNext = () => {
    setIsFlipped(false);
    setRevealedBlank(false);
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionCompleted(true);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setRevealedBlank(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Mark card rating (Needs Review or Mastered)
  const handleMarkProgress = async (status: 'review' | 'mastered') => {
    if (!currentCard || !deck) return;

    setSavingProgress(true);
    const score = status === 'mastered' ? 5 : 2;

    // Optimistically update local state
    setCards((prev) =>
      prev.map((c, i) =>
        i === currentIndex
          ? {
              ...c,
              progress: {
                status,
                confidenceScore: score,
                reviewCount: (c.progress?.reviewCount || 0) + 1,
                lastReviewedAt: new Date().toISOString(),
              },
            }
          : c
      )
    );

    await flashcardsApi.updateProgress({
      cardId: currentCard.id,
      deckId: deck.id,
      status,
      confidenceScore: score,
    });

    setSavingProgress(false);
    handleNext();
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (loading || sessionCompleted || !currentCard) return;

      // Don't trigger if user is focusing an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleToggleFlip();
      } else if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleMarkProgress('review');
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleMarkProgress('mastered');
      }
    },
    [loading, sessionCompleted, currentCard, currentIndex, cards.length]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
        <h3 className="text-base font-semibold text-slate-200">Preparing Flashcard Study Deck...</h3>
        <p className="text-xs text-slate-400 mt-1">Loading questions, diagrams, and review progress.</p>
      </div>
    );
  }

  if (error || !deck || cards.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl max-w-lg mx-auto space-y-4">
        <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-100">Deck Unavailable</h3>
        <p className="text-xs text-slate-400">{error || 'This deck contains no flashcards.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Return to My Decks
        </button>
      </div>
    );
  }

  // Session Summary Screen
  if (sessionCompleted) {
    const masteredInSession = cards.filter((c) => c.progress?.status === 'mastered').length;
    const reviewInSession = cards.filter((c) => c.progress?.status === 'review' || c.progress?.status === 'learning').length;

    return (
      <div className="max-w-xl mx-auto p-8 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-6 shadow-2xl">
        <div className="h-16 w-16 rounded-2xl bg-brand-500/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto shadow-inner">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white">Study Session Complete!</h2>
          <p className="text-xs text-slate-400 mt-1">
            You completed reviewing all {cards.length} cards in <strong className="text-slate-200">{deck.title}</strong>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-center">
            <span className="text-xs font-semibold text-emerald-300 block mb-1">Mastered</span>
            <span className="text-2xl font-bold text-emerald-400">{masteredInSession}</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/40 text-center">
            <span className="text-xs font-semibold text-amber-300 block mb-1">Needs Review</span>
            <span className="text-2xl font-bold text-amber-400">{reviewInSession}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionCompleted(false);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors inline-flex items-center gap-2"
          >
            <RotateCw className="w-4 h-4" /> Study Again
          </button>
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition-all inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Decks
          </button>
        </div>
      </div>
    );
  }

  // Calculate deck progress
  const progressPercent = Math.round(((currentIndex + 1) / cards.length) * 100);
  const masteredTotal = cards.filter((c) => c.progress?.status === 'mastered').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Study Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Decks
        </button>

        <div className="text-center">
          <h2 className="text-sm font-bold text-slate-100 truncate max-w-md">{deck.title}</h2>
          <span className="text-[11px] text-slate-400">
            Card {currentIndex + 1} of {cards.length} ({progressPercent}%) · Mastered: {masteredTotal}
          </span>
        </div>

        {/* Keyboard shortcut legend button / pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-800 font-mono">
          <span>[Space] flip</span>
          <span>·</span>
          <span>[1] review</span>
          <span>·</span>
          <span>[2] know</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-900 rounded-full h-1.5 border border-slate-800 overflow-hidden">
        <div
          className="bg-brand-500 h-full transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Study Flashcard */}
      <div
        onClick={handleToggleFlip}
        className={`cursor-pointer min-h-[320px] p-8 rounded-2xl border transition-all flex flex-col justify-between shadow-2xl relative select-none ${
          isFlipped
            ? 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/20 ring-1 ring-emerald-500/20'
            : 'bg-slate-900/95 border-slate-800 hover:border-slate-700 hover:shadow-brand-950/20'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isFlipped
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                  : 'bg-brand-950/70 text-brand-300 border-brand-800/60'
              }`}
            >
              {isFlipped ? 'Answer (Back)' : 'Question (Front)'}
            </span>

            {currentCard.cardType === 'fill_in_blank' && (
              <span className="text-[11px] text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/30">
                Fill-in-the-blank [...]
              </span>
            )}
            {currentCard.cardType === 'cloze' && (
              <span className="text-[11px] text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/30">
                Cloze Deletion
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {currentCard.progress?.status && (
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  currentCard.progress.status === 'mastered'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                    : 'bg-amber-950 text-amber-300 border-amber-800/60'
                }`}
              >
                Status: {currentCard.progress.status}
              </span>
            )}
            <span className="text-slate-500 text-[11px]">Click or press Space to flip ↷</span>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="py-6 flex-1 flex flex-col justify-center">
          {isFlipped ? (
            <div className="space-y-4">
              <div
                className="text-emerald-300 font-mono text-base md:text-lg leading-relaxed whitespace-pre-wrap select-text break-words"
                dangerouslySetInnerHTML={{ __html: currentCard.backMarkdown }}
              />
              {/* Also show question context on the flipped side */}
              <div className="pt-4 border-t border-slate-800/60 text-xs text-slate-400">
                <span className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-semibold">
                  Original Question:
                </span>
                <div
                  className="opacity-75 select-text"
                  dangerouslySetInnerHTML={{ __html: currentCard.frontMarkdown }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="text-slate-100 text-base md:text-lg leading-relaxed whitespace-pre-wrap select-text break-words font-sans"
                dangerouslySetInnerHTML={{ __html: currentCard.frontMarkdown }}
              />

              {/* Interactive Fill-in reveal button */}
              {(currentCard.cardType === 'fill_in_blank' || currentCard.cardType === 'cloze') && !revealedBlank && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevealedBlank(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/60 text-amber-200 border border-amber-800/50 hover:bg-amber-900/60 text-xs font-semibold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Reveal Missing Term [...]
                  </button>
                </div>
              )}

              {revealedBlank && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200 flex items-center justify-between">
                  <span>
                    <strong>Missing Answer:</strong>{' '}
                    <code className="font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-950">
                      {currentCard.backMarkdown}
                    </code>
                  </span>
                  <span className="text-[10px] text-amber-400/80">Term revealed</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>{currentCard.tags && currentCard.tags.length > 0 ? `Tags: ${currentCard.tags.join(', ')}` : 'CCNA 200-301 Official Flashcard'}</span>
          <span>Review count: {currentCard.progress?.reviewCount || 0}</span>
        </div>
      </div>

      {/* Review Response Controls */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => handleMarkProgress('review')}
          disabled={savingProgress}
          className="p-3.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-950/20 active:scale-[0.99]"
        >
          <XCircle className="w-4 h-4 text-amber-400" />
          <span>Needs Review (Key 1 / ←)</span>
        </button>

        <button
          type="button"
          onClick={() => handleMarkProgress('mastered')}
          disabled={savingProgress}
          className="p-3.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/20 active:scale-[0.99]"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Know It / Mastered (Key 2 / →)</span>
        </button>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none text-xs font-semibold text-slate-300 border border-slate-800 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Previous Card
        </button>

        <button
          type="button"
          onClick={handleToggleFlip}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" /> Flip Card
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800 transition-colors"
        >
          Next Card <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
