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

interface GenerateStandaloneFlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTopic?: string;
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

const TOPIC_SUGGESTIONS = [
  'VTP',
  'VLANs & Trunking',
  'IPv4 Subnetting',
  'OSPF',
  'BGP',
  'STP',
  'SD-WAN',
  'Linux Networking',
  'DNS & DHCP',
  'Network Troubleshooting',
];

const EMPHASIS_OPTIONS = [
  { id: 'balanced', label: 'Balanced (All Topics)' },
  { id: 'definitions', label: 'Definitions & Mechanics' },
  { id: 'commands', label: 'CLI Commands & Verification' },
  { id: 'troubleshooting', label: 'Troubleshooting & Scenarios' },
  { id: 'comparisons', label: 'Comparisons & Trade-offs' },
];

export const GenerateStandaloneFlashcardModal: React.FC<GenerateStandaloneFlashcardModalProps> = ({
  isOpen,
  onClose,
  initialTopic = '',
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
  const [topic, setTopic] = useState<string>(initialTopic);
  const [cardCount, setCardCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>('Intermediate');
  const [focusArea, setFocusArea] = useState<string>('');
  const [emphasis, setEmphasis] = useState<string>('balanced');

  // Draft deck state
  const [deckTitle, setDeckTitle] = useState<string>('');
  const [deckDescription, setDeckDescription] = useState<string>('');
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

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false);

  // Track initialization
  const initializedOpenRef = useRef(false);

  // Initialize from existing deck, initial draft, or clean state
  useEffect(() => {
    if (isOpen && !initializedOpenRef.current) {
      initializedOpenRef.current = true;
      setError(null);
      setHasUnsavedChanges(false);
      setShowConfirmClose(false);

      if (initialDraftDeck) {
        setDeckTitle(initialDraftDeck.title || (initialTopic ? `${initialTopic.trim()} - Flashcards` : 'Custom AI Flashcards'));
        setDeckDescription(initialDraftDeck.description || '');
        setIsSimulated(initialDraftDeck.isSimulated ?? false);
        setDraftCards(
          initialDraftDeck.cards.map((c, idx) => ({
            frontMarkdown: c.frontMarkdown,
            backMarkdown: c.backMarkdown,
            tags: Array.isArray(c.tags) ? c.tags : [initialTopic ? initialTopic.split(' ')[0] : 'Networking'],
            cardType: c.cardType || 'basic',
            orderIndex: c.orderIndex ?? idx,
          }))
        );
        setHasUnsavedChanges(true);
        setStep('preview_edit');
      } else if (existingDeck && existingCards && existingCards.length > 0) {
        setDeckTitle(existingDeck.title);
        setDeckDescription(existingDeck.description || `AI-generated flashcards for "${existingDeck.title}".`);
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
        setTopic(initialTopic);
        setCardCount(10);
        setDifficulty('Intermediate');
        setFocusArea('');
        setEmphasis('balanced');
        setDeckTitle(initialTopic ? `${initialTopic.trim()} - Flashcards` : 'Custom AI Flashcards');
        setDeckDescription(initialTopic ? `AI-generated flashcards reinforcing ${initialTopic.trim()}.` : '');
        setDraftCards([]);
        setStep('configure');
      }
    } else if (!isOpen) {
      initializedOpenRef.current = false;
    }
  }, [isOpen, existingDeck, existingCards, initialTopic, initialDraftDeck]);

  if (!isOpen) return null;

  // Handle generation request
  const handleGenerate = async () => {
    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setError('Please enter a topic to generate flashcards.');
      return;
    }
    if (cleanTopic.length < 2) {
      setError('Topic must be at least 2 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    const selectedEmphasisLabel = EMPHASIS_OPTIONS.find((e) => e.id === emphasis)?.label;

    try {
      await startGeneration('flashcards', {
        topic: cleanTopic,
        cardCount,
        difficulty: difficulty.toLowerCase(),
        focusArea: focusArea.trim() || undefined,
        emphasis: emphasis !== 'balanced' ? selectedEmphasisLabel : undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error scheduling background flashcard generation.');
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  // Add a new card manually
  const handleAddCard = () => {
    const newIdx = draftCards.length;
    const fallbackTag = topic.trim() ? topic.trim().split(' ')[0] : 'Networking';
    const newCard: DraftCard = {
      frontMarkdown: `New question or concept for ${topic.trim() || 'this deck'}...`,
      backMarkdown: `Detailed answer and explanation...`,
      tags: [fallbackTag],
      orderIndex: newIdx,
    };
    setDraftCards((prev) => [...prev, newCard]);
    handleStartEdit(newIdx);
    setHasUnsavedChanges(true);
  };

  // Save approved deck to DB
  const handleSaveDeck = async (autoStudy = false) => {
    if (draftCards.length === 0) {
      setError('Cannot save an empty flashcard deck.');
      return;
    }

    setSavingDeck(true);
    setError(null);

    try {
      const res = await flashcardsApi.saveStandaloneDeck({
        deckId: existingDeck?.id,
        topic: topic.trim() || undefined,
        title: deckTitle.trim() || `${topic.trim() || 'AI'} - Flashcards`,
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
        setHasUnsavedChanges(false);
        onSaved(res.data.deckId);

        if (autoStudy && onStudyNow) {
          onClose();
          onStudyNow(res.data.deckId);
        } else {
          setStep('saved');
        }
      } else {
        setError(res.message || 'Failed to save flashcards.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with database.');
    } finally {
      setSavingDeck(false);
    }
  };

  // Attempt close with confirmation if unsaved changes exist
  const handleRequestClose = () => {
    if (hasUnsavedChanges && step === 'preview_edit') {
      setShowConfirmClose(true);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-surface border border-white/10 rounded-2xl shadow-glass overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white heading-title">
                  {existingDeck ? 'Edit Flashcard Deck' : 'Generate AI Flashcards'}
                </h3>
                {isSimulated && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SIMULATED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'configure'
                  ? 'Generate high-yield active-recall study flashcards for any topic'
                  : step === 'generating'
                  ? 'Designing questions, answers, and verification commands...'
                  : step === 'preview_edit'
                  ? `Review, edit, and fine-tune your ${draftCards.length} flashcards before saving`
                  : 'Flashcard deck saved to your personal library'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRequestClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Global Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/30 text-xs text-red-200 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-slate-400 hover:text-white text-xs underline">
                Dismiss
              </button>
            </div>
          )}

          {/* STEP 1: CONFIGURE */}
          {step === 'configure' && (
            <div className="space-y-5">
              {/* Topic Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Topic or Concept <span className="text-accent">*</span></span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. VTP, OSPF, Subnetting</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter any networking or technical topic (e.g. VTP, BGP, STP, IPv4 subnetting)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-white/10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-accent/60 transition-colors"
                  maxLength={200}
                />
                {/* Topic Suggestions Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent" /> Popular:
                  </span>
                  {TOPIC_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setTopic(sug)}
                      className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-accent/40 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Target Card Count
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCardCount(count)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                        cardCount === count
                          ? 'bg-accent/20 border-accent text-accent shadow-sm'
                          : 'bg-surface-subtle border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span>{count} Cards</span>
                      {count === 10 && <span className="text-[9px] font-normal text-slate-400 mt-0.5">Recommended</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        difficulty === lvl
                          ? 'bg-accent/20 border-accent text-accent shadow-sm'
                          : 'bg-surface-subtle border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Emphasis */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Content Emphasis (Optional)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EMPHASIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEmphasis(opt.id)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        emphasis === opt.id
                          ? 'bg-accent/20 border-accent text-white shadow-sm'
                          : 'bg-surface-subtle border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Focus Instruction (Optional) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Custom Study Focus (Optional)</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g. packet flow, packet captures</span>
                </label>
                <input
                  type="text"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  placeholder="Optional instruction (e.g. Focus on Cisco CLI verification and state machine transitions)..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-accent/60 transition-colors"
                  maxLength={150}
                />
              </div>

              {/* Information Note */}
              <div className="p-3.5 rounded-xl bg-accent/5 border border-accent/20 text-xs text-slate-300 flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-white">Interactive Review & Preview</span>
                  <p className="text-[11px] text-slate-400">
                    You can review, flip, edit markdown, delete, or add custom cards before saving to your study library.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: GENERATING */}
          {step === 'generating' && (
            <div className="py-14 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-accent/20 animate-ping opacity-75" />
                <div className="relative w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                  <RotateCw className="w-7 h-7 animate-spin text-accent" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white heading-title">
                  Generating AI Flashcards
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Synthesizing {cardCount} high-yield {difficulty.toLowerCase()} cards for <span className="text-accent font-semibold">{topic}</span>...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & EDIT */}
          {step === 'preview_edit' && (
            <div className="space-y-5">
              {/* Deck Metadata Summary & Editing */}
              <div className="p-3.5 rounded-xl bg-surface-subtle border border-white/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Deck Title
                    </label>
                    <input
                      type="text"
                      value={deckTitle}
                      onChange={(e) => {
                        setDeckTitle(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-accent/60"
                      maxLength={200}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-accent/15 border border-accent/30 text-accent">
                      {draftCards.length} Cards
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Deck Description
                  </label>
                  <input
                    type="text"
                    value={deckDescription}
                    onChange={(e) => {
                      setDeckDescription(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Short description of this deck..."
                    className="w-full px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-accent/60"
                    maxLength={300}
                  />
                </div>
              </div>

              {/* Card List Actions Bar */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-accent" />
                  Flashcards in Deck ({draftCards.length})
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddCard}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-accent/40 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-accent" />
                    <span>Add Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (hasUnsavedChanges && !window.confirm('Regenerating will replace your current card edits. Continue?')) {
                        return;
                      }
                      setStep('configure');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors"
                    title="Change topic or regenerate deck"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Regenerate</span>
                  </button>
                </div>
              </div>

              {/* Cards Accordion / List */}
              <div className="space-y-3">
                {draftCards.map((card, idx) => {
                  const isFlipped = Boolean(flippedCards[idx]);
                  const isEditing = editingCardIndex === idx;

                  if (isEditing) {
                    return (
                      <div
                        key={card.id || `card-${idx}`}
                        className="p-4 rounded-xl bg-surface-elevated border border-accent/40 space-y-3 animate-fade-in shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-accent font-mono">
                            Editing Card {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(idx)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-accent text-slate-950 hover:bg-accent-hover transition-colors shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Front (Question / Prompt)
                          </label>
                          <textarea
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            rows={2}
                            className="w-full p-2.5 rounded-lg bg-surface border border-white/10 text-xs text-white focus:outline-none focus:border-accent/60"
                            placeholder="Front question or concept prompt..."
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Back (Answer & Explanation)
                          </label>
                          <textarea
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 rounded-lg bg-surface border border-white/10 text-xs text-white focus:outline-none focus:border-accent/60 font-mono"
                            placeholder="Accurate answer, verification commands, and mechanics..."
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Tags (comma separated)
                          </label>
                          <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-white/10 text-xs text-white focus:outline-none focus:border-accent/60"
                            placeholder="e.g. OSPF, Protocol, CLI"
                          />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={card.id || `card-${idx}`}
                      className="p-3.5 rounded-xl bg-surface-subtle border border-white/10 hover:border-white/20 transition-all space-y-2.5"
                    >
                      {/* Top Card Controls */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 font-semibold text-[11px]">
                            #{idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isFlipped
                              ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                              : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
                          }`}>
                            {isFlipped ? 'Back (Answer)' : 'Front (Prompt)'}
                          </span>
                          {card.tags && card.tags.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1">
                              {card.tags.slice(0, 2).map((t) => (
                                <span key={t} className="text-[10px] text-slate-400 font-mono">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleFlip(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                            title={isFlipped ? 'Show Front' : 'Flip to Answer'}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Edit Card"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCard(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Delete Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Card Content (Markdown) */}
                      <div
                        onClick={() => handleToggleFlip(idx)}
                        className="cursor-pointer p-3 rounded-lg bg-surface/70 border border-white/5 hover:border-accent/30 transition-colors min-h-[52px]"
                      >
                        {isFlipped ? (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 font-mono">
                              Answer & Verification
                            </span>
                            <div className="text-xs text-slate-200">
                              <MarkdownView content={card.backMarkdown} />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">
                              Question / Prompt
                            </span>
                            <div className="text-xs font-semibold text-white">
                              <MarkdownView content={card.frontMarkdown} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: SAVED */}
          {step === 'saved' && (
            <div className="py-12 text-center space-y-4 animate-fade-in">
              <div className="h-16 w-16 rounded-2xl bg-success/20 text-success border border-success/40 flex items-center justify-center mx-auto shadow-lg shadow-success/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white heading-title">
                  Deck Saved to Flashcard Hub!
                </h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  <strong className="text-white">{deckTitle}</strong> ({draftCards.length} cards) is ready to study.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                {onStudyNow && savedDeckId && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStudyNow(savedDeckId);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-accent text-slate-950 hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Study Now</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-white/10 text-white hover:bg-white/15 border border-white/10 transition-colors"
                >
                  Back to Flashcards Hub
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-surface-elevated/40 flex items-center justify-between gap-3">
          {step === 'configure' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !topic.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-slate-950 hover:bg-accent-hover transition-colors shadow-md shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Starting Background Task...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Flashcards</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview_edit' && (
            <>
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5">
                {onStudyNow && (
                  <button
                    type="button"
                    onClick={() => handleSaveDeck(true)}
                    disabled={savingDeck || draftCards.length === 0}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-accent" />
                    <span>Save & Study</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveDeck(false)}
                  disabled={savingDeck || draftCards.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-accent text-slate-950 hover:bg-accent-hover transition-colors shadow-md shadow-accent/20 disabled:opacity-50"
                >
                  {savingDeck ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Saving Deck...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Deck</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'saved' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/15 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Dialog on Discard */}
        {showConfirmClose && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="max-w-sm w-full p-5 rounded-2xl bg-surface border border-white/20 shadow-2xl space-y-4 text-center">
              <div className="h-12 w-12 rounded-xl bg-danger/20 text-danger border border-danger/40 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Discard Unsaved Changes?</h4>
                <p className="text-xs text-slate-400">
                  You have unsaved edits in this flashcard deck. If you exit now, your changes will be discarded.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConfirmClose(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:text-white"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmClose(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-danger text-white hover:bg-danger/80"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
