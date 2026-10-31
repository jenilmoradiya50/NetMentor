import React, { useState, useEffect } from 'react';
import type { FlashcardDeck, CatalogDeck, DeckImportPreview } from '../../types/flashcards';
import { flashcardsApi } from '../../lib/api';
import { ImportPreviewModal } from './ImportPreviewModal';
import { StudyDeckView } from './StudyDeckView';
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
} from 'lucide-react';

export const FlashcardsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'my-decks' | 'catalog' | 'upload'>('my-decks');
  const [myDecks, setMyDecks] = useState<FlashcardDeck[]>([]);
  const [catalogDecks, setCatalogDecks] = useState<CatalogDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active study deck
  const [studyingDeckId, setStudyingDeckId] = useState<string | null>(null);

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
      }
    } catch (err: any) {
      setError('Failed to load flashcard decks.');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Preview a catalog deck
  const handlePreviewCatalogDeck = async (deck: CatalogDeck) => {
    setPreviewLoadingId(deck.id);
    setError(null);
    try {
      const res = await flashcardsApi.preview({ catalogId: deck.id });
      if (res.data?.preview) {
        setPreviewData(res.data.preview);
        setPreviewOpen(true);
      } else {
        setError(res.message || 'Failed to preview deck.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error downloading deck for preview.');
    }
    setPreviewLoadingId(null);
  };

  // Preview an uploaded custom .apkg file
  const handlePreviewCustomFile = async (file: File) => {
    setUploadError(null);
    if (!file.name.endsWith('.apkg')) {
      setUploadError('Invalid format: Only Anki deck (.apkg) files are supported.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File exceeds maximum upload limit of 50 MB.');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
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
      // If previewData was from a catalog deck
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
      setError(err?.message || 'Import failed.');
    }
    setImporting(false);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Delete Deck
  const handleDeleteDeck = async (deckId: string, deckTitle: string) => {
    if (!window.confirm(`Are you sure you want to remove "${deckTitle}"? Your learning review progress for this deck will be deleted.`)) {
      return;
    }

    try {
      const res = await flashcardsApi.deleteDeck(deckId);
      if (res.data?.success) {
        setMyDecks((prev) => prev.filter((d) => d.id !== deckId));
      } else {
        alert(res.message || 'Failed to delete deck.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error deleting deck.');
    }
  };

  // Filter catalog decks
  const categories = ['all', ...Array.from(new Set(catalogDecks.map((d) => d.category)))];
  const filteredCatalog = catalogDecks.filter((deck) => {
    const matchesCategory = selectedCategory === 'all' || deck.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.cleanTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `day ${deck.day}`.includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // If currently studying a deck
  if (studyingDeckId) {
    return <StudyDeckView deckId={studyingDeckId} onBack={() => setStudyingDeckId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-950/30 to-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Jeremy's IT Lab CCNA Flashcards
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-950 text-brand-300 border border-brand-800/60 font-semibold">
                61 Modules
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Interactive flashcard study system with fill-in-the-blank brackets, cloze deletions, and persistent progress.
            </p>
          </div>
        </div>

        {/* Global Stats or Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Import from CCNA Catalog
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-px">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('my-decks')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'my-decks'
                ? 'border-brand-500 text-brand-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>My Study Decks</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {myDecks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'border-brand-500 text-brand-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>CCNA Catalog (Jeremy's IT Lab)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
              {catalogDecks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-brand-500 text-brand-300 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Upload Custom .apkg</span>
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-200"
          title="Refresh decks"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-200 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: MY DECKS */}
      {activeTab === 'my-decks' && (
        <div>
          {loading ? (
            <div className="p-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
              <p className="text-xs text-slate-400">Loading your flashcard collection...</p>
            </div>
          ) : myDecks.length === 0 ? (
            /* Empty State */
            <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl max-w-lg mx-auto space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-brand-600/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">No Flashcard Decks Imported Yet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Import official CCNA modules from Jeremy's IT Lab collection or upload your own custom Anki (.apkg) files to start practicing.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" /> Browse 61 CCNA Decks
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" /> Upload .apkg
                </button>
              </div>
            </div>
          ) : (
            /* Decks Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myDecks.map((deck) => {
                const studiedCount = deck.studiedCount || 0;
                const masteredCount = deck.masteredCount || 0;
                const percent = deck.cardCount > 0 ? Math.round((masteredCount / deck.cardCount) * 100) : 0;

                return (
                  <div
                    key={deck.id}
                    className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider px-2 py-0.5 rounded bg-brand-950/60 border border-brand-800/40 font-mono">
                          {deck.deckName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeck(deck.id, deck.title)}
                          className="p-1 text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                          title="Delete Deck"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-300 transition-colors line-clamp-2">
                        {deck.title}
                      </h3>

                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Mastery Progress</span>
                          <span className="font-semibold text-slate-200">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>{deck.cardCount} cards total</span>
                          <span>{masteredCount} mastered</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {studiedCount > 0 ? `${studiedCount} reviewed` : 'Not started'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStudyingDeckId(deck.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition-all active:scale-[0.98]"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Study Deck</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: JEREMY'S IT LAB CCNA CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-5">
          {/* Search & Domain Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CCNA decks (e.g. OSPF, VLAN, Subnetting, ACL, BGP)..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Exam Domains' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Decks List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((deck) => {
              const alreadyImported = myDecks.some(
                (d) => d.deckName.toLowerCase() === deck.cleanTitle.toLowerCase().replace(/\s+/g, '') || d.sourceName === deck.filename
              );
              const isLoading = previewLoadingId === deck.id;

              return (
                <div
                  key={deck.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-brand-400 uppercase tracking-wider px-2 py-0.5 rounded bg-brand-950/60 border border-brand-800/40 font-mono">
                        Day {deck.day < 10 ? `0${deck.day}` : deck.day}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{deck.category}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100 group-hover:text-brand-300 transition-colors line-clamp-2">
                      {deck.cleanTitle}
                    </h3>

                    {deck.labs.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 mt-2">
                        <CheckCircle2 className="w-3 h-3" /> Includes Packet Tracer Lab
                      </span>
                    )}
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                    {alreadyImported ? (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> In Library
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Official Jeremy Deck</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handlePreviewCatalogDeck(deck)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-brand-500 transition-all shadow-sm disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{alreadyImported ? 'Review / Study' : 'Preview & Import'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM .APKG UPLOAD */}
      {activeTab === 'upload' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="p-8 rounded-2xl bg-slate-900/60 border-2 border-dashed border-slate-700 hover:border-brand-500/60 transition-all text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-brand-600/10 text-brand-400 border border-brand-500/20 flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">Upload Anki Flashcard Package (.apkg)</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Select an Anki collection package exported from your desktop or Jeremy's IT Lab archive. Up to 50 MB supported.
              </p>
            </div>

            <label className="inline-block cursor-pointer">
              <span className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white shadow-md shadow-brand-600/20 transition-all inline-flex items-center gap-2">
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
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300">
                {uploadError}
              </div>
            )}
          </div>

          {/* Guidelines Box */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Supported Anki Features:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
              <li>Automatic SQLite <code className="font-mono text-slate-300">collection.anki2</code> schema decompression</li>
              <li>Fill-in-the-blank <code className="font-mono text-slate-300">[...]</code> brackets with interactive blank reveal</li>
              <li>Standard Anki cloze syntax <code className="font-mono text-slate-300">&#123;&#123;c1::answer&#125;&#125;</code></li>
              <li>Embedded images and diagrams with base64 data conversion</li>
              <li>Technical networking CLI syntax highlighting, CIDR notation, and tags</li>
            </ul>
          </div>
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
    </div>
  );
};
