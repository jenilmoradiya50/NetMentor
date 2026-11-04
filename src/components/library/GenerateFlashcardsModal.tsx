import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Layers,
  RotateCw,
  Plus,
  Trash2,
  Edit3,
  Check,
  Eye,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { flashcardsApi } from '../../lib/api';
import { MarkdownView } from '../ui/MarkdownView';
import { useGenerationManager } from '../../context/GenerationManagerContext';
import type { FlashcardDeck, FlashcardItem } from '../../types/flashcards';

export interface DraftCard {
  id?: string;
  frontMarkdown: string;
  backMarkdown: string;
  tags: string[];
  cardType?: 'basic' | 'cloze' | 'fill_in_blank';
  orderIndex: number;
}

interface GenerateFlashcardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string;
  existingDeck?: FlashcardDeck | null;
  existingCards?: FlashcardItem[];
  initialDraftDeck?: {
    title?: string;
    description?: string;
    isSimulated?: boolean;
    cards: Array<{
      frontMarkdown: string;
      backMarkdown: string;
      tags?: string[];
      cardType?: 'basic' | 'cloze' | 'fill_in_blank';
      orderIndex?: number;
    }>;
  } | null;
  onSaved: (deckId: string) => void;
  onStudyNow?: (deckId: string) => void;
}

export const GenerateFlashcardsModal: React.FC<GenerateFlashcardsModalProps> = ({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  lessonTopic,
  existingDeck,
  existingCards,
  initialDraftDeck,
  onSaved,
  onStudyNow,
}) => {
  const { startGeneration } = useGenerationManager();

  // Modal step: 'configure' | 'generating' | 'preview_edit' | 'saved'
  const [step, setStep] = useState<'configure' | 'generating' | 'preview_edit' | 'saved'>('configure');

  // Configuration options
  const [cardCount, setCardCount] = useState<number>(10);
  const [focusArea, setFocusArea] = useState<string>('Comprehensive (All Topics)');
  const [difficulty, setDifficulty] = useState<string>('Match Lesson');

  // Draft deck state
  const [deckTitle, setDeckTitle] = useState<string>(`${lessonTitle} - Flashcards`);
  const [deckDescription, setDeckDescription] = useState<string>(`AI-generated flashcards for "${lessonTitle}".`);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  // Editing state for cards
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editTags, setEditTags] = useState('');

  // Preview flip state per card (cardIndex -> boolean)
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

  // Loading & error state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDeck, setSavingDeck] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState<string | null>(null);

  // Track whether we already initialized this modal open session to prevent reset on re-renders
  const initializedOpenRef = useRef(false);

  // Initialize from existing deck, initial draft, or clean state
  useEffect(() => {
    if (isOpen && !initializedOpenRef.current) {
      initializedOpenRef.current = true;
      setError(null);

      if (initialDraftDeck) {
        setDeckTitle(initialDraftDeck.title || `${lessonTitle} - Flashcards`);
        setDeckDescription(initialDraftDeck.description || `AI-generated flashcards for "${lessonTitle}".`);
        setIsSimulated(initialDraftDeck.isSimulated ?? false);
        setDraftCards(
          initialDraftDeck.cards.map((c, idx) => ({
            frontMarkdown: c.frontMarkdown,
            backMarkdown: c.backMarkdown,
            tags: c.tags || [lessonTopic.split(' ')[0] || 'Networking'],
            cardType: c.cardType || 'basic',
            orderIndex: c.orderIndex ?? idx,
          }))
        );
        setStep('preview_edit');
      } else if (existingDeck && existingCards && existingCards.length > 0) {
        setDeckTitle(existingDeck.title);
        setDeckDescription(existingDeck.description || `AI-generated flashcards for "${lessonTitle}".`);
        setDraftCards(
          existingCards.map((c, idx) => ({
            id: c.id,
            frontMarkdown: c.frontMarkdown,
            backMarkdown: c.backMarkdown,
            tags: Array.isArray(c.tags) ? c.tags : [],
            cardType: c.cardType,
            orderIndex: c.orderIndex ?? idx,
          }))
        );
        setStep('preview_edit');
      } else {
        setDeckTitle(`${lessonTitle} - Flashcards`);
        setDeckDescription(`AI-generated flashcards for "${lessonTitle}".`);
        setDraftCards([]);
        setStep('configure');
      }
    } else if (!isOpen) {
      initializedOpenRef.current = false;
    }
  }, [isOpen, existingDeck, existingCards, lessonTitle, initialDraftDeck, lessonTopic]);

  if (!isOpen) return null;

  // Handle generation request
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      await startGeneration('flashcards', {
        lessonId,
        cardCount,
        focusArea,
        difficulty: difficulty === 'Match Lesson' ? undefined : difficulty.toLowerCase(),
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to start background flashcard generation.');
      setStep('configure');
    } finally {
      setLoading(false);
    }
  };

  // Toggle card flip preview
  const handleToggleFlip = (idx: number) => {
    setFlippedCards((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Start editing a card
  const handleStartEdit = (idx: number) => {
    const card = draftCards[idx];
    setEditingCardIndex(idx);
    setEditFront(card.frontMarkdown);
    setEditBack(card.backMarkdown);
    setEditTags(card.tags.join(', '));
  };

  // Save inline edit
  const handleSaveEdit = (idx: number) => {
    if (!editFront.trim() || !editBack.trim()) return;

    setDraftCards((prev) =>
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              frontMarkdown: editFront.trim(),
              backMarkdown: editBack.trim(),
              tags: editTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : c
      )
    );
    setEditingCardIndex(null);
  };

  // Delete a card from draft
  const handleDeleteCard = (idx: number) => {
    if (draftCards.length <= 1) {
      setError('A flashcard deck must contain at least 1 card.');
      return;
    }
    setDraftCards((prev) => prev.filter((_, i) => i !== idx));
    if (editingCardIndex === idx) {
      setEditingCardIndex(null);
    }
  };

  // Add a new card manually
  const handleAddCard = () => {
    const newIdx = draftCards.length;
    const newCard: DraftCard = {
      frontMarkdown: `New question or scenario for ${lessonTopic}...`,
      backMarkdown: `Detailed answer and verification steps...`,
      tags: [lessonTopic.split(' ')[0]],
      orderIndex: newIdx,
    };
    setDraftCards((prev) => [...prev, newCard]);
    handleStartEdit(newIdx);
  };

  // Save approved deck to DB
  const handleSaveDeck = async () => {
    if (draftCards.length === 0) {
      setError('Cannot save an empty flashcard deck.');
      return;
    }

    setSavingDeck(true);
    setError(null);

    try {
      const res = await flashcardsApi.saveLessonDeck({
        lessonId,
        title: deckTitle.trim(),
        description: deckDescription.trim(),
        cards: draftCards.map((c, i) => ({
          id: c.id,
          frontMarkdown: c.frontMarkdown,
          backMarkdown: c.backMarkdown,
          tags: c.tags,
          orderIndex: i,
        })),
      });

      if (res.data?.success && res.data.deckId) {
        setSavedDeckId(res.data.deckId);
        onSaved(res.data.deckId);
        setStep('saved');
      } else {
        setError(res.message || 'Failed to save flashcards.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with database.');
    } finally {
      setSavingDeck(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-surface border border-white/10 rounded-2xl shadow-glass overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white heading-title">
                  {existingDeck ? 'Manage Lesson Flashcards' : 'Generate AI Flashcards'}
                </h3>
                {isSimulated && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SIMULATED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                Source Lesson: <span className="text-slate-300 font-medium">{lessonTitle}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-danger/15 border border-danger/30 text-xs text-red-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs text-white/60 hover:text-white underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Active Recall Flashcard Generation
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  NetMentor AI will extract core networking principles, Cisco CLI verification commands,
                  protocol mechanics, and troubleshooting scenarios directly from this lesson to build a customized study deck.
                </p>
              </div>

              {/* Number of Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Target Card Count
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCardCount(num)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        cardCount === num
                          ? 'bg-accent/20 border-accent text-accent shadow-sm'
                          : 'bg-canvas-subtle border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {num} Cards {num === 10 && <span className="text-[10px] block opacity-75 font-normal">Default</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Area */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Knowledge Focus Area
                </label>
                <select
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  className="w-full bg-canvas-subtle border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="Comprehensive (All Topics)">Comprehensive (All Lesson Topics)</option>
                  <option value="CLI Commands & Verification">Cisco IOS-XE & Linux CLI Commands</option>
                  <option value="Protocol Mechanics & State Transitions">Protocol Mechanics & State Transitions</option>
                  <option value="Troubleshooting & Scenario Analysis">Troubleshooting & Scenario Analysis</option>
                  <option value="Key Definitions & Terminology">Key Definitions & Terminology</option>
                </select>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['Match Lesson', 'Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        difficulty === diff
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-canvas-subtle border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 press-scale disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      Starting Background Task...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Draft Deck
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center animate-pulse">
                <RotateCw className="w-7 h-7 animate-spin text-accent" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">Synthesizing Flashcards</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Analyzing <span className="text-white font-medium">{lessonTitle}</span>, grounding protocol mechanisms, and drafting {cardCount} active recall flashcards...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & EDIT */}
          {step === 'preview_edit' && (
            <div className="space-y-5">
              {/* Deck Info Bar */}
              <div className="p-4 rounded-xl bg-canvas-subtle border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={deckTitle}
                      onChange={(e) => setDeckTitle(e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent text-sm font-bold text-white focus:outline-none px-1 py-0.5 rounded"
                      title="Edit deck title"
                    />
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                      {draftCards.length} Cards
                    </span>
                  </div>
                  <input
                    type="text"
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent text-xs text-slate-400 focus:outline-none px-1 py-0.5 rounded"
                    title="Edit deck description"
                  />
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={handleAddCard}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-accent" />
                    Add Card
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Regenerate draft cards? Any unsaved edits will be replaced.')) {
                        handleGenerate();
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                    title="Regenerate from AI"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Cards List */}
              <div className="space-y-4">
                {draftCards.map((card, idx) => {
                  const isEditing = editingCardIndex === idx;
                  const isFlipped = flippedCards[idx] || false;

                  return (
                    <div
                      key={card.id || idx}
                      className="p-4 rounded-xl bg-canvas-subtle border border-white/10 space-y-3 transition-all hover:border-white/20"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold font-mono text-accent">
                            CARD {idx + 1} OF {draftCards.length}
                          </span>
                          {card.tags.map((t, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              #{t}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleFlip(idx)}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1"
                            title="Flip preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">{isFlipped ? 'Show Front' : 'Show Back'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => (isEditing ? handleSaveEdit(idx) : handleStartEdit(idx))}
                            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/5 text-xs flex items-center gap-1"
                            title={isEditing ? 'Save edits' : 'Edit card'}
                          >
                            {isEditing ? <Check className="w-3.5 h-3.5 text-success" /> : <Edit3 className="w-3.5 h-3.5" />}
                            <span className="text-[10px] hidden sm:inline">{isEditing ? 'Done' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(idx)}
                            className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 text-xs"
                            title="Remove card from deck"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        /* Inline Edit Form */
                        <div className="space-y-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Front (Question / Prompt)
                            </label>
                            <textarea
                              value={editFront}
                              onChange={(e) => setEditFront(e.target.value)}
                              rows={2}
                              className="w-full bg-surface border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-accent"
                              placeholder="Enter front question..."
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Back (Answer & Explanation)
                            </label>
                            <textarea
                              value={editBack}
                              onChange={(e) => setEditBack(e.target.value)}
                              rows={3}
                              className="w-full bg-surface border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-accent"
                              placeholder="Enter detailed answer..."
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Tags (Comma-separated)
                            </label>
                            <input
                              type="text"
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              className="w-full bg-surface border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent"
                              placeholder="BGP, Cisco, CLI"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingCardIndex(null)}
                              className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(idx)}
                              className="px-3.5 py-1 rounded-lg text-xs font-bold bg-accent text-white hover:bg-accent-hover"
                            >
                              Save Card
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Card View */
                        <div className="space-y-2 pt-1">
                          <div className="p-3 rounded-lg bg-surface/60 border border-white/5">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                              {isFlipped ? 'Back (Answer & Explanation)' : 'Front (Question / Prompt)'}
                            </span>
                            <div className="text-xs text-white leading-relaxed">
                              <MarkdownView content={isFlipped ? card.backMarkdown : card.frontMarkdown} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Footer */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 sticky bottom-0 bg-surface py-3">
                <span className="text-xs text-slate-400">
                  {draftCards.length} cards ready to save to your personal library.
                </span>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDeck}
                    disabled={savingDeck}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 press-scale disabled:opacity-50 w-full sm:w-auto"
                  >
                    {savingDeck ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Saving Deck...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Save Flashcards to Library
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SAVED SUCCESS */}
          {step === 'saved' && (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
              <div className="h-16 w-16 rounded-2xl bg-success/15 text-success border border-success/30 flex items-center justify-center shadow-lg shadow-success/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Flashcard Deck Saved!</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Your {draftCards.length} cards have been saved and associated with this lesson. You can study them now or find them in your Flashcards hub anytime.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                {savedDeckId && onStudyNow && (
                  <button
                    type="button"
                    onClick={() => {
                      onStudyNow(savedDeckId);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 press-scale"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Practice Deck Now
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Return to Lesson
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
