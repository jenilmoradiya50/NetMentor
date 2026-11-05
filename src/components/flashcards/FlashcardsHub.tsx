import React, { useState, useEffect } from 'react';
import type { FlashcardDeck, CatalogDeck, DeckImportPreview } from '../../types/flashcards';
import { flashcardsApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ImportPreviewModal } from './ImportPreviewModal';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';

// Lazy-load StudyDeckView for route-level code splitting
const StudyDeckView = React.lazy(() =>
  import('./StudyDeckView').then((m) => ({ default: m.StudyDeckView })),
);
import {
  Layers,
  Upload,
  BookOpen,
  Sparkles,
  Search,
  CheckCircle2,
  Trash2,
  Play,
  RotateCw,
  AlertCircle,
  FileText,
  Loader2,
  Plus,
  FolderOpen,
  Edit3,
} from 'lucide-react';

import { JEREMY_CCNA_DECKS } from '../../data/catalog';
import { GenerateStandaloneFlashcardModal } from './GenerateStandaloneFlashcardModal';

interface FlashcardsHubProps {
  initialStudyingDeckId?: string | null;
  onClearStudyingDeck?: () => void;
}

export const FlashcardsHub: React.FC<FlashcardsHubProps> = ({
  initialStudyingDeckId,
  onClearStudyingDeck,
}) => {
  const { isDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-decks' | 'catalog' | 'upload'>('catalog');
  const [myDecks, setMyDecks] = useState<FlashcardDeck[]>([]);
  const [myDecksFilter, setMyDecksFilter] = useState<'all' | 'standalone' | 'lesson' | 'anki'>('all');
  const [catalogDecks, setCatalogDecks] = useState<CatalogDeck[]>(JEREMY_CCNA_DECKS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Standalone AI Flashcard Generator Modal state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [editingCards, setEditingCards] = useState<any[]>([]);
  const [loadingEditDeckId, setLoadingEditDeckId] = useState<string | null>(null);

  // Active study deck
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(initialStudyingDeckId || null);

  useEffect(() => {
    if (initialStudyingDeckId) {
      setStudyingDeckId(initialStudyingDeckId);
      setActiveTab('my-decks');
    }
  }, [initialStudyingDeckId]);

  // Preview Modal state
  const [previewData, setPreviewData] = useState<DeckImportPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Custom upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter / Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Load My Decks & Catalog
  const loadData = async () => {
    setLoading(true);
    setError(null);
    if (isDemoMode) {
      setCatalogDecks(JEREMY_CCNA_DECKS);
      setLoading(false);
      return;
    }
    try {
      const [decksRes, catalogRes] = await Promise.all([
        flashcardsApi.getDecks(),
        flashcardsApi.getCatalog(),
      ]);

      if (decksRes.data?.decks) {
        setMyDecks(decksRes.data.decks);
      }
      if (catalogRes.data?.decks) {
        setCatalogDecks(catalogRes.data.decks);
      } else {
        setCatalogDecks(JEREMY_CCNA_DECKS);
      }
    } catch {
      setCatalogDecks(JEREMY_CCNA_DECKS);
      setError('Failed to load flashcard decks.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Delete Deck
  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${deckTitle}"? All review history will be deleted.`)) {
      return;
    }
    try {
      const res = await flashcardsApi.deleteDeck(deckId);
      if (res.data?.success) {
        setMyDecks((prev) => prev.filter((d) => d.id !== deckId));
      } else {
        setError(res.message || 'Failed to delete deck.');
      }
    } catch {
      setError('Error communicating with server while deleting deck.');
    }
  };

  // Open Edit Modal for Standalone Deck
  const handleOpenEditDeck = async (deck: FlashcardDeck) => {
    setLoadingEditDeckId(deck.id);
    setError(null);
    try {
      const res = await flashcardsApi.getCards(deck.id);
      if (res.data?.cards) {
        setEditingDeck(deck);
        setEditingCards(res.data.cards);
        setGenerateModalOpen(true);
      } else {
        setError(res.message || 'Failed to load flashcards for editing.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with server to load cards.');
    } finally {
      setLoadingEditDeckId(null);
    }
  };

  // Preview Catalog Deck
  const handlePreviewCatalogDeck = async (deck: CatalogDeck) => {
    setPreviewLoadingId(deck.id);
    try {
      const res = await flashcardsApi.preview({ catalogId: deck.id });
      if (res.data?.preview) {
        setPreviewData(res.data.preview);
        setPreviewOpen(true);
      } else {
        setError(res.message || 'Could not parse catalog deck.');
      }
    } catch {
      setError('Failed to load deck preview.');
    }
    setPreviewLoadingId(null);
  };

  // Upload Custom File Preview
  const handlePreviewCustomFile = async (file: File) => {
    setLoading(true);
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];

        const res = await flashcardsApi.preview({
          base64Data,
          filename: file.name,
        });

        if (res.data?.preview) {
          setPreviewData(res.data.preview);
          setPreviewOpen(true);
        } else {
          setUploadError(res.message || 'Failed to parse Anki package.');
        }
      } catch (err: any) {
        setUploadError(err?.message || 'Failed to read uploaded file.');
      }
      setLoading(false);
    };
    reader.onerror = () => {
      setUploadError('Failed to read file from disk.');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!previewData) return;
    setImporting(true);
    try {
      const matchingCatalog = catalogDecks.find((d) => d.title.includes(previewData.title) || d.filename.includes(previewData.deckName));

      const payload = matchingCatalog
        ? { catalogId: matchingCatalog.id, customTitle: previewData.title }
        : selectedFile
        ? {
            base64Data: await fileToBase64(selectedFile),
            filename: selectedFile.name,
            customTitle: previewData.title,
          }
        : { catalogId: previewData.deckName, customTitle: previewData.title };

      const res = await flashcardsApi.importDeck(payload);
      if (res.data?.success) {
        setPreviewOpen(false);
        await loadData();
        setActiveTab('my-decks');
        if (res.data.deckId) {
          setStudyingDeckId(res.data.deckId);
        }
      } else {
        setError(res.message || 'Failed to import deck.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import deck.');
    }
    setImporting(false);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Unique categories for filtering
  const categories = ['all', ...Array.from(new Set(catalogDecks.map((d) => d.category)))];

  // Filter catalog decks
  const filteredCatalog = catalogDecks.filter((d) => {
    const matchesSearch =
      d.cleanTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.day.toString() === searchQuery.trim();
    const matchesCategory = selectedCategory === 'all' || d.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // If studying a deck, render study view
  if (studyingDeckId) {
    return (
      <React.Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-canvas">
            <div className="relative flex items-center justify-center mb-4">
              <div className="absolute w-12 h-12 rounded-full bg-accent/20 animate-ping opacity-30" />
              <Loader2 className="w-8 h-8 text-accent animate-spin relative z-10" />
            </div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Loading Study Deck...</p>
            <span className="text-[10px] text-slate-600 mt-1 font-mono">NetMentor Telecom Console</span>
          </div>
        }
      >
        <StudyDeckView
          deckId={studyingDeckId}
          onBack={() => {
            setStudyingDeckId(null);
            onClearStudyingDeck?.();
            loadData();
          }}
        />
      </React.Suspense>
    );
  }

  const tabOptions = [
    {
      id: 'my-decks' as const,
      label: 'My Study Decks',
      icon: <FolderOpen className="w-4 h-4" />,
      badge: myDecks.length,
    },
    {
      id: 'catalog' as const,
      label: 'CCNA Catalog',
      icon: <BookOpen className="w-4 h-4" />,
      badge: catalogDecks.length,
    },
    {
      id: 'upload' as const,
      label: 'Upload .apkg',
      icon: <Upload className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/10">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex flex-wrap items-center gap-2.5 heading-title">
              Jeremy's IT Lab CCNA Flashcards
              <Badge variant="blue" size="sm">
                61 Modules
              </Badge>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Interactive flashcard study system with fill-in-the-blank brackets, cloze deletions, and persistent progress.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setEditingDeck(null);
              setEditingCards([]);
              setGenerateModalOpen(true);
            }}
            icon={<Sparkles className="w-4 h-4" />}
            className="w-full sm:w-auto shadow-md shadow-accent/20"
          >
            Generate AI Flashcards
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setActiveTab('catalog')}
            icon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Import CCNA Catalog
          </Button>
        </div>
      </div>

      {/* Tabs Navigation Control (Horizontally Scrollable without Page Overflow) */}
      <div className="flex items-center justify-between gap-2 max-w-full">
        <div className="flex-1 overflow-x-auto no-scrollbar py-0.5">
          <SegmentedControl
            options={tabOptions}
            value={activeTab}
            onChange={(tab) => setActiveTab(tab)}
          />
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-2.5 rounded-xl border border-slate-800 bg-surface-elevated text-slate-400 hover:text-white press-scale shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center"
          title="Refresh decks"
          aria-label="Refresh deck lists"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-accent' : ''}`} />
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-danger/15 border border-danger/30 text-xs text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-danger" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: MY DECKS */}
      {activeTab === 'my-decks' && (
        <div>
          {loading ? (
            <div className="p-16 text-center glass-card rounded-2xl flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
              <p className="text-xs text-slate-400">Loading your flashcard collection...</p>
            </div>
          ) : myDecks.length === 0 ? (
            /* Empty State */
            <Card variant="subtle" padding="lg" className="text-center max-w-lg mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white heading-title">No Flashcard Decks Imported Yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Import official CCNA modules from Jeremy's IT Lab collection or upload your own custom Anki (.apkg) files to start practicing.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setActiveTab('catalog')}
                  icon={<BookOpen className="w-4 h-4" />}
                >
                  Browse 61 CCNA Decks
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setActiveTab('upload')}
                  icon={<Upload className="w-4 h-4" />}
                >
                  Upload .apkg
                </Button>
              </div>
            </Card>
          ) : (
            /* Decks Grid */
            <div className="space-y-4">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 pb-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setMyDecksFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    myDecksFilter === 'all'
                      ? 'bg-accent/20 border-accent text-accent'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  All Decks ({myDecks.length})
                </button>
                {myDecks.some((d) => d.sourceType === 'ai_standalone' || d.sourceName?.startsWith('standalone:')) && (
                  <button
                    type="button"
                    onClick={() => setMyDecksFilter('standalone')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      myDecksFilter === 'standalone'
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Standalone AI ({myDecks.filter((d) => d.sourceType === 'ai_standalone' || d.sourceName?.startsWith('standalone:')).length})
                  </button>
                )}
                {myDecks.some((d) => d.sourceType === 'ai_generated' || d.sourceName?.startsWith('lesson:')) && (
                  <button
                    type="button"
                    onClick={() => setMyDecksFilter('lesson')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      myDecksFilter === 'lesson'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    AI Lesson Decks ({myDecks.filter((d) => d.sourceType === 'ai_generated' || d.sourceName?.startsWith('lesson:')).length})
                  </button>
                )}
                {myDecks.some((d) => d.sourceType !== 'ai_standalone' && d.sourceType !== 'ai_generated' && !d.sourceName?.startsWith('lesson:') && !d.sourceName?.startsWith('standalone:')) && (
                  <button
                    type="button"
                    onClick={() => setMyDecksFilter('anki')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      myDecksFilter === 'anki'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    CCNA Anki ({myDecks.filter((d) => d.sourceType !== 'ai_standalone' && d.sourceType !== 'ai_generated' && !d.sourceName?.startsWith('lesson:') && !d.sourceName?.startsWith('standalone:')).length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myDecks
                  .filter((deck) => {
                    const isStandalone = deck.sourceType === 'ai_standalone' || deck.sourceName?.startsWith('standalone:');
                    const isLesson = deck.sourceType === 'ai_generated' || deck.sourceName?.startsWith('lesson:');
                    const isAnki = !isStandalone && !isLesson;
                    if (myDecksFilter === 'standalone') return isStandalone;
                    if (myDecksFilter === 'lesson') return isLesson;
                    if (myDecksFilter === 'anki') return isAnki;
                    return true;
                  })
                  .map((deck) => {
                    const studiedCount = deck.studiedCount || 0;
                    const masteredCount = deck.masteredCount || 0;
                    const percent = deck.cardCount > 0 ? Math.round((masteredCount / deck.cardCount) * 100) : 0;
                    const isStandalone = deck.sourceType === 'ai_standalone' || deck.sourceName?.startsWith('standalone:');
                    const isLesson = deck.sourceType === 'ai_generated' || deck.sourceName?.startsWith('lesson:');

                    return (
                      <Card
                        key={deck.id}
                        variant="interactive"
                        padding="md"
                        className="flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2.5">
                            {isStandalone ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-accent" />
                                AI Standalone
                              </span>
                            ) : isLesson ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                AI Lesson
                              </span>
                            ) : (
                              <Badge variant="blue" size="sm">
                                {deck.deckName || 'CCNA Anki'}
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDeck(deck.id, deck.title);
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/[0.04] transition-colors press-scale"
                              title="Delete Deck"
                              aria-label={`Delete ${deck.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-2">
                            {deck.title}
                          </h3>

                          <div className="mt-3.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                              <span>Mastery Progress</span>
                              <span className="font-semibold text-white">{percent}%</span>
                            </div>
                            <div className="w-full bg-canvas-subtle rounded-full h-1.5 overflow-hidden border border-white/[0.06]">
                              <div
                                className="bg-success h-full rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 font-mono">
                              <span>{deck.cardCount} cards total</span>
                              <span>{masteredCount} mastered</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/[0.08] flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">
                            {studiedCount > 0 ? `${studiedCount} reviewed` : 'Not started'}
                          </span>
                          <div className="flex items-center gap-2">
                            {isStandalone && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEditDeck(deck)}
                                disabled={loadingEditDeckId === deck.id}
                                icon={<Edit3 className="w-3 h-3" />}
                              >
                                Edit
                              </Button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setStudyingDeckId(deck.id)}
                              icon={<Play className="w-3.5 h-3.5 fill-current" />}
                            >
                              Study Deck
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JEREMY'S IT LAB CCNA CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-5">
          {/* Search & Domain Filter (Mobile-First Stacked Layout) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CCNA decks (OSPF, VLAN, Subnetting)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-subtle border border-slate-700/80 text-base sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 min-h-[44px]"
              />
            </div>

            <div className="w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-slate-700/80 text-base sm:text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 min-h-[44px]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat} className="bg-canvas text-white">
                    {cat === 'all' ? 'All Exam Domains' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Decks List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((deck) => {
              const alreadyImported = myDecks.some(
                (d) => d.deckName.toLowerCase() === deck.cleanTitle.toLowerCase().replace(/\s+/g, '') || d.sourceName === deck.filename,
              );
              const isLoading = previewLoadingId === deck.id;

              return (
                <Card
                  key={deck.id}
                  variant="interactive"
                  padding="md"
                  className="flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="blue" size="sm">
                        Day {deck.day < 10 ? `0${deck.day}` : deck.day}
                      </Badge>
                      <span className="text-[10px] text-slate-400 font-medium">{deck.category}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-2">
                      {deck.cleanTitle}
                    </h3>

                    {deck.labs.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 mt-2">
                        <CheckCircle2 className="w-3 h-3 text-success" /> Includes Packet Tracer Lab
                      </span>
                    )}
                  </div>

                  <div className="pt-4 mt-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
                    {alreadyImported ? (
                      <Badge variant="green" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                        In Library
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-slate-400">Official Jeremy Deck</span>
                    )}

                    <Button
                      variant={alreadyImported ? 'secondary' : 'primary'}
                      size="sm"
                      loading={isLoading}
                      onClick={() => handlePreviewCatalogDeck(deck)}
                      icon={!isLoading ? <Sparkles className="w-3.5 h-3.5" /> : undefined}
                    >
                      <span>{alreadyImported ? 'Review / Study' : 'Preview & Import'}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM .APKG UPLOAD */}
      {activeTab === 'upload' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="p-8 rounded-2xl bg-surface-subtle/80 border-2 border-dashed border-white/20 hover:border-accent/60 transition-all text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white heading-title">Upload Anki Flashcard Package (.apkg)</h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                Select an Anki collection package exported from your desktop or Jeremy's IT Lab archive. Up to 50 MB supported.
              </p>
            </div>

            <label className="inline-block cursor-pointer">
              <span className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all inline-flex items-center gap-2 press-scale min-h-[44px]">
                <FileText className="w-4 h-4" /> Browse .apkg File
              </span>
              <input
                type="file"
                accept=".apkg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    handlePreviewCustomFile(file);
                  }
                }}
                className="hidden"
              />
            </label>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-danger/15 border border-danger/30 text-xs text-red-200">
                {uploadError}
              </div>
            )}
          </div>

          {/* Guidelines Box */}
          <Card variant="subtle" padding="md" className="space-y-2 text-xs text-slate-400">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" /> Supported Anki Features:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 leading-relaxed">
              <li>Automatic SQLite <code className="font-mono text-sky-200">collection.anki2</code> schema decompression</li>
              <li>Fill-in-the-blank <code className="font-mono text-sky-200">[...]</code> brackets with interactive blank reveal</li>
              <li>Standard Anki cloze syntax <code className="font-mono text-sky-200">&#123;&#123;c1::answer&#125;&#125;</code></li>
              <li>Embedded images and diagrams with base64 data conversion</li>
              <li>Technical networking CLI syntax highlighting, CIDR notation, and tags</li>
            </ul>
          </Card>
        </div>
      )}

      {/* Import Preview Modal */}
      <ImportPreviewModal
        isOpen={previewOpen}
        preview={previewData}
        onClose={() => setPreviewOpen(false)}
        onConfirmImport={handleConfirmImport}
        importing={importing}
        onOpenDeck={(deckId) => {
          setPreviewOpen(false);
          setStudyingDeckId(deckId);
        }}
      />

      {/* Standalone AI Flashcard Generator Modal */}
      <GenerateStandaloneFlashcardModal
        isOpen={generateModalOpen}
        onClose={() => {
          setGenerateModalOpen(false);
          setEditingDeck(null);
          setEditingCards([]);
        }}
        existingDeck={editingDeck}
        existingCards={editingCards}
        onSaved={async () => {
          await loadData();
          setActiveTab('my-decks');
        }}
        onStudyNow={(newDeckId) => {
          setStudyingDeckId(newDeckId);
          setActiveTab('my-decks');
        }}
      />
    </div>
  );
};
