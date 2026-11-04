import React, { useRef } from 'react';

export interface SegmentOption<T extends string = string> {
  id: T;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  fullWidth = false,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`inline-flex items-center p-1 rounded-xl bg-surface-subtle/90 border border-slate-800 backdrop-blur-md relative max-w-full overflow-x-auto no-scrollbar ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.id === value;

        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isSelected}
            type="button"
            onClick={() => onChange(opt.id)}
            ref={(node) => {
              if (isSelected && node && containerRef.current) {
                // Ensure active tab is within visible scroll area of the control without shifting whole page
                const container = containerRef.current;
                const nodeLeft = node.offsetLeft;
                const nodeRight = nodeLeft + node.offsetWidth;
                if (nodeLeft < container.scrollLeft) {
                  container.scrollTo({ left: nodeLeft, behavior: 'smooth' });
                } else if (nodeRight > container.scrollLeft + container.clientWidth) {
                  container.scrollTo({ left: nodeRight - container.clientWidth, behavior: 'smooth' });
                }
              }
            }}
            className={`flex-1 sm:flex-initial shrink-0 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-150 relative select-none min-h-[38px] press-scale-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
              isSelected
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30 border border-brand-400/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
            <span className="whitespace-nowrap">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-brand-950/80 text-brand-200 border-brand-400/40'
                    : 'bg-white/[0.06] text-slate-400 border-white/5'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
