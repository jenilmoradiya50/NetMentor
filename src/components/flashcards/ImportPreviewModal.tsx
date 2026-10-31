import React, { useState } from 'react';
import type { DeckImportPreview } from '../../types/flashcards';
import {
  X,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  Eye,
  Info,
} from 'lucide-react';

interface ImportPreviewModalProps {
  preview: DeckImportPreview | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: () => Promise<void>;
  importing: boolean;
  onOpenDeck?: (deckId: string) => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  preview,
  isOpen,
  onClose,
  onConfirmImport,
  importing,
  onOpenDeck,
}) => {
  if (!isOpen || !preview) return null;

  const [sampleIdx, setSampleIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const currentSample = preview.sampleCards[sampleIdx];

  const handleNextSample = () => {
    setFlipped(false);
    setSampleIdx((prev) => (prev + 1) % preview.sampleCards.length);
  };

  const handlePrevSample = () => {
    setFlipped(false);
    setSampleIdx((prev) => (prev - 1 + preview.sampleCards.length) % preview.sampleCards.length);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {preview.title}
                {preview.alreadyImported && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-medium">
                    Already in Library
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Verified Anki format: <span className="font-mono text-slate-300">collection.anki2</span> (SQLite schema)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-sm text-slate-300">
          {/* Deck Stats Bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-0.5">Total Flashcards</span>
              <span className="text-lg font-bold text-brand-300">{preview.cardCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-0.5">Media Assets</span>
              <span className="text-lg font-bold text-slate-200">{preview.mediaCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 block mb-0.5">Internal Slug</span>
              <span className="text-xs font-mono text-slate-300 truncate block mt-1" title={preview.deckName}>
                {preview.deckName}
              </span>
            </div>
          </div>

          {/* Warnings / Media Notes */}
          {preview.warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Format Adaptation Notes:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80 pl-1">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sample Cards Carousel */}
          {currentSample && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-brand-400" />
                  Interactive Sample Preview ({sampleIdx + 1} of {preview.sampleCards.length})
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                  Type: {currentSample.cardType}
                </span>
              </div>

              {/* Flip Card Preview Box */}
              <div
                onClick={() => setFlipped(!flipped)}
                className="cursor-pointer min-h-[160px] p-5 rounded-xl border border-slate-700 bg-slate-800/90 hover:border-brand-500/50 transition-all flex flex-col justify-between shadow-inner group"
              >
                <div>
                  <div className="text-[11px] font-semibold tracking-wider uppercase text-brand-400 mb-2 flex items-center justify-between">
                    <span>{flipped ? 'Answer (Back)' : 'Question (Front)'}</span>
                    <span className="text-slate-500 text-[10px] group-hover:text-slate-400 transition-colors">
                      Click to flip ↷
                    </span>
                  </div>

                  <div className="text-slate-100 font-medium leading-relaxed select-text">
                    {flipped ? (
                      <div
                        className="prose prose-invert max-w-none text-emerald-300 font-mono text-sm"
                        dangerouslySetInnerHTML={{ __html: currentSample.backMarkdown }}
                      />
                    ) : (
                      <div
                        className="prose prose-invert max-w-none text-slate-100"
                        dangerouslySetInnerHTML={{ __html: currentSample.frontMarkdown }}
                      />
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Click anywhere on card to toggle question / answer</span>
                  {currentSample.tags && currentSample.tags.length > 0 && (
                    <span className="text-slate-500">Tags: {currentSample.tags.join(', ')}</span>
                  )}
                </div>
              </div>

              {/* Sample Navigation Buttons */}
              {preview.sampleCards.length > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handlePrevSample}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous Sample
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSample}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    Next Sample <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {preview.alreadyImported && (
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Note:</strong> Re-confirming import will verify card integrity without duplicating cards or resetting your existing study review progress.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Cancel
          </button>

          {preview.alreadyImported && preview.existingDeckId && onOpenDeck ? (
            <button
              type="button"
              onClick={() => onOpenDeck(preview.existingDeckId!)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Open in Study Mode
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirmImport}
              disabled={importing}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing Cards...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Confirm & Import Deck ({preview.cardCount} Cards)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
