import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={`w-full ${maxWidthStyles[maxWidth]} bg-surface-elevated/95 border border-white/10 rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden glass-card-elevated animate-in slide-in-from-bottom duration-250 ease-out`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            {title && <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors press-scale"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-sm text-slate-200 safe-bottom">
          {children}
        </div>
      </div>
    </div>
  );
};
