import React, { useState, useEffect, useCallback } from 'react';
import type { FlashcardDeck, FlashcardItem } from '../../types/flashcards';
import { flashcardsApi } from '../../lib/api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
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
  const loadCards = useCallback(async () => {
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
  }, [deckId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const currentCard = cards[currentIndex];

  // Flip card
  const handleToggleFlip = () => {
    // If the student is highlighting or selecting text (e.g. copying CIDR / CLI commands), abort flip
    if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }
    }
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
          : c,
      ),
    );

    try {
      await flashcardsApi.updateProgress({
        cardId: currentCard.id,
        deckId: deck.id,
        status,
        confidenceScore: score,
      });
    } catch (err: any) {
      console.error('Failed to save card progress:', err?.message);
    }

    setSavingProgress(false);
    handleNext();
  };

  // Keyboard controls listener (Space = flip, 1 = Review, 2 = Mastered, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleFlip();
      } else if (e.key === '1' || e.code === 'ArrowLeft') {
        e.preventDefault();
        handleMarkProgress('review');
      } else if (e.key === '2' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleMarkProgress('mastered');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length, isFlipped]);

  if (loading) {
    return (
      <div className="p-16 text-center glass-card rounded-2xl flex flex-col items-center justify-center max-w-lg mx-auto">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading cards for study session...</p>
      </div>
    );
  }

  if (error || !deck || cards.length === 0) {
    return (
      <Card variant="default" padding="lg" className="text-center max-w-lg mx-auto space-y-4">
        <p className="text-red-300 text-sm">{error || 'This deck contains no flashcards.'}</p>
        <Button variant="secondary" size="md" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Back to Decks
        </Button>
      </Card>
    );
  }

  // Completion Screen
  if (sessionCompleted) {
    const masteredCount = cards.filter((c) => c.progress?.status === 'mastered').length;
    const reviewCount = cards.filter((c) => c.progress?.status === 'review').length;

    return (
      <Card variant="elevated" padding="lg" className="text-center max-w-md mx-auto space-y-5">
        <div className="h-16 w-16 rounded-2xl bg-success/15 text-success border border-success/30 flex items-center justify-center mx-auto shadow-xl shadow-success/10">
          <Award className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white heading-title">Study Session Complete!</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            You reviewed all {cards.length} flashcards in <strong className="text-white">{deck.title}</strong>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 text-xs font-mono">
          <div className="p-3 rounded-xl bg-surface-subtle/80 border border-success/30">
            <span className="text-[10px] text-success uppercase block font-semibold font-sans">Mastered</span>
            <span className="text-lg font-bold text-emerald-300">{masteredCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-surface-subtle/80 border border-warning/30">
            <span className="text-[10px] text-warning uppercase block font-semibold font-sans">Needs Review</span>
            <span className="text-lg font-bold text-amber-300">{reviewCount}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setSessionCompleted(false);
            }}
            icon={<RotateCw className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Study Again
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onBack}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Back to My Decks
          </Button>
        </div>
      </Card>
    );
  }

  // Calculate deck progress
  const progressPercent = Math.round(((currentIndex + 1) / cards.length) * 100);
  const masteredTotal = cards.filter((c) => c.progress?.status === 'mastered').length;

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-32 sm:pb-20">
      {/* Top Study Bar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          icon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Decks
        </Button>

        <div className="text-center truncate px-2">
          <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{deck.title}</h2>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
            Card {currentIndex + 1} of {cards.length} ({progressPercent}%) · Mastered: {masteredTotal}
          </span>
        </div>

        {/* Keyboard shortcut legend pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 px-2.5 py-1 rounded-xl bg-surface-subtle border border-white/[0.08] font-mono">
          <span>[Space] flip</span>
          <span>·</span>
          <span>[1] review</span>
          <span>·</span>
          <span>[2] know</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-surface-subtle rounded-full h-1.5 border border-white/[0.06] overflow-hidden">
        <div
          className="bg-accent h-full transition-all duration-200 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Study Flashcard */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggleFlip}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleToggleFlip();
        }}
        className={`cursor-pointer min-h-[300px] sm:min-h-[340px] p-5 sm:p-8 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-2xl relative select-none press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          isFlipped
            ? 'glass-card-elevated border-success/40 shadow-emerald-950/20 ring-1 ring-success/20'
            : 'glass-card hover:border-white/20'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Badge variant={isFlipped ? 'green' : 'blue'} size="sm">
              {isFlipped ? 'Answer (Back)' : 'Question (Front)'}
            </Badge>

            {currentCard.cardType === 'fill_in_blank' && (
              <Badge variant="amber" size="sm">
                Fill-in-the-blank [...]
              </Badge>
            )}
            {currentCard.cardType === 'cloze' && (
              <Badge variant="purple" size="sm">
                Cloze Deletion
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            {currentCard.progress?.status && (
              <Badge
                variant={currentCard.progress.status === 'mastered' ? 'green' : 'amber'}
                size="sm"
              >
                Status: {currentCard.progress.status}
              </Badge>
            )}
            <span className="text-slate-500 text-[11px] hidden sm:inline">Tap to flip ↷</span>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="py-6 flex-1 flex flex-col justify-center">
          {isFlipped ? (
            <div className="space-y-4">
              <div
                className="text-emerald-300 font-mono text-sm sm:text-base md:text-lg leading-relaxed whitespace-pre-wrap select-text break-words"
                dangerouslySetInnerHTML={{ __html: currentCard.backMarkdown }}
              />
              {/* Also show question context on the flipped side */}
              <div className="pt-4 border-t border-white/[0.08] text-xs text-slate-400">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-semibold">
                  Original Question:
                </span>
                <div
                  className="opacity-75 select-text leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: currentCard.frontMarkdown }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className="text-slate-100 text-sm sm:text-base md:text-lg leading-relaxed whitespace-pre-wrap select-text break-words font-sans"
                dangerouslySetInnerHTML={{ __html: currentCard.frontMarkdown }}
              />

              {/* Interactive Fill-in reveal button */}
              {(currentCard.cardType === 'fill_in_blank' || currentCard.cardType === 'cloze') && !revealedBlank && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRevealedBlank(true);
                    }}
                    icon={<Eye className="w-3.5 h-3.5 text-warning" />}
                    className="border-warning/30 text-amber-300 bg-warning/15 hover:bg-warning/25"
                  >
                    Reveal Term [...]
                  </Button>
                </div>
              )}

              {revealedBlank && (
                <div className="p-3 rounded-xl bg-warning/15 border border-warning/30 text-xs text-amber-200 flex items-center justify-between">
                  <span>
                    <strong>Missing Term:</strong>{' '}
                    <code className="font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded bg-black/40">
                      {currentCard.backMarkdown}
                    </code>
                  </span>
                  <span className="text-[10px] text-amber-400">Revealed</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-500 font-mono">
          <span className="truncate max-w-[200px]">
            {currentCard.tags && currentCard.tags.length > 0 ? `Tags: ${currentCard.tags.join(', ')}` : 'CCNA 200-301 Flashcard'}
          </span>
          <span>Review count: {currentCard.progress?.reviewCount || 0}</span>
        </div>
      </div>

      {/* Review Response Controls (Big comfortable touch buttons) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => handleMarkProgress('review')}
          disabled={savingProgress}
          className="p-3.5 sm:p-4 rounded-2xl bg-warning/15 hover:bg-warning/25 text-amber-300 border border-warning/30 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] press-scale shadow-sm disabled:opacity-40 touch-target-44"
        >
          <XCircle className="w-4 h-4 text-warning" />
          <span>Needs Review <span className="hidden sm:inline font-mono text-xs">(1 / ←)</span></span>
        </button>

        <button
          type="button"
          onClick={() => handleMarkProgress('mastered')}
          disabled={savingProgress}
          className="p-3.5 sm:p-4 rounded-2xl bg-success/15 hover:bg-success/25 text-emerald-300 border border-success/30 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[48px] press-scale shadow-sm disabled:opacity-40 touch-target-44"
        >
          <CheckCircle2 className="w-4 h-4 text-success" />
          <span>I Know This <span className="hidden sm:inline font-mono text-xs">(2 / →)</span></span>
        </button>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          icon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleFlip}
          icon={<RotateCw className="w-3.5 h-3.5" />}
        >
          Flip Card
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleNext}
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
