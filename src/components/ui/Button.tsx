import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    // NetMentor refined variant mappings
    const variantStyles = {
      primary:
        'bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold shadow-md shadow-brand-600/25 border border-brand-400/30',
      secondary:
        'bg-surface-elevated/90 hover:bg-surface-interactive text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-sm',
      ghost:
        'bg-transparent hover:bg-surface-interactive/60 text-slate-300 hover:text-white border border-transparent',
      danger:
        'bg-danger/15 hover:bg-danger/25 text-red-200 border border-danger/30 hover:border-danger/50',
      success:
        'bg-success/15 hover:bg-success/25 text-emerald-200 border border-success/30 hover:border-success/50',
    };

    // Mobile-first sizing (with 44px min-height for touch on 'md' and 'lg')
    const sizeStyles = {
      sm: 'px-2.5 py-1.5 text-xs rounded-lg min-h-[32px] gap-1.5',
      md: 'px-3.5 py-2 text-xs sm:text-sm rounded-xl min-h-[42px] sm:min-h-[38px] gap-2',
      lg: 'px-5 py-2.5 text-sm sm:text-base rounded-xl min-h-[46px] gap-2.5 font-medium',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium select-none press-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : icon ? (
          <span className="flex-shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';
