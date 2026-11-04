import React, { useState } from 'react';
import type { DeckImportPreview } from '../../types/flashcards';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  X,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !importing) onClose();
      }}
    >
      <div className="glass-card-elevated rounded-t-3xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-white/10">
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center flex-shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white heading-title">
                  {preview.title}
                </h2>
                {preview.alreadyImported && (
                  <Badge variant="green" size="sm">
                    In Library
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Verified Anki format: <span className="font-mono text-slate-300">collection.anki2</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors press-scale"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-sm text-slate-300">
          {/* Deck Stats Bar */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06] text-center">
              <span className="text-[10px] sm:text-xs text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                Flashcards
              </span>
              <span className="text-base sm:text-lg font-bold text-sky-300">{preview.cardCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06] text-center">
              <span className="text-[10px] sm:text-xs text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                Media Assets
              </span>
              <span className="text-base sm:text-lg font-bold text-white">{preview.mediaCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-subtle/80 border border-white/[0.06] text-center">
              <span className="text-[10px] sm:text-xs text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                Deck Slug
              </span>
              <span className="text-xs font-mono text-slate-300 truncate block mt-0.5" title={preview.deckName}>
                {preview.deckName}
              </span>
            </div>
          </div>

          {/* Warnings / Media Notes */}
          {preview.warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-warning/15 border border-warning/30 text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-warning">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Format Adaptation Notes:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80 pl-1 leading-relaxed">
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
                  <Eye className="w-3.5 h-3.5 text-accent" />
                  Interactive Sample ({sampleIdx + 1} of {preview.sampleCards.length})
                </span>
                <Badge variant="slate" size="sm">
                  {currentSample.cardType}
                </Badge>
              </div>

              {/* Flip Card Preview Box */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setFlipped(!flipped)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setFlipped(!flipped);
                }}
                className="cursor-pointer min-h-[160px] p-4 sm:p-5 rounded-2xl border border-white/10 bg-surface-subtle hover:border-white/20 transition-all flex flex-col justify-between shadow-inner press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 select-none"
              >
                <div>
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-accent mb-2 flex items-center justify-between">
                    <span>{flipped ? 'Answer (Back)' : 'Question (Front)'}</span>
                    <span className="text-slate-500 text-[10px]">Tap to flip ↷</span>
                  </div>

                  <div className="text-slate-100 font-medium leading-relaxed select-text">
                    {flipped ? (
                      <div
                        className="text-emerald-300 font-mono text-xs sm:text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: currentSample.backMarkdown }}
                      />
                    ) : (
                      <div
                        className="text-slate-100 text-xs sm:text-sm leading-relaxed font-sans"
                        dangerouslySetInnerHTML={{ __html: currentSample.frontMarkdown }}
                      />
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
                  <span>Tap anywhere on card to flip</span>
                  {currentSample.tags && currentSample.tags.length > 0 && (
                    <span className="text-slate-500 font-mono">Tags: {currentSample.tags.join(', ')}</span>
                  )}
                </div>
              </div>

              {/* Sample Navigation Buttons */}
              {preview.sampleCards.length > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrevSample}
                    icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleNextSample}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {preview.alreadyImported && (
            <div className="p-3.5 rounded-xl bg-surface-subtle/80 border border-white/[0.08] text-xs text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Note:</strong> Re-confirming import will verify card integrity without duplicating cards or resetting existing study progress.
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end gap-2.5 safe-bottom">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={importing}
          >
            Cancel
          </Button>

          {preview.alreadyImported && preview.existingDeckId && onOpenDeck ? (
            <Button
              variant="success"
              size="md"
              onClick={() => onOpenDeck(preview.existingDeckId!)}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              Open in Study Mode
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              loading={importing}
              onClick={onConfirmImport}
              icon={!importing ? <Sparkles className="w-4 h-4" /> : undefined}
            >
              <span>{importing ? 'Importing Cards...' : `Confirm & Import (${preview.cardCount} Cards)`}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
