import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      className = '',
      ...props
    },
    ref,
  ) => {
    const variantStyles = {
      default: 'bg-surface/90 border border-border-hairline shadow-sm text-slate-100',
      elevated: 'bg-surface-elevated/95 border border-border-hairline shadow-md shadow-black/30 text-slate-100',
      subtle: 'bg-surface-subtle/80 border border-border-hairline text-slate-200',
      interactive:
        'bg-surface/90 hover:bg-surface border border-border-hairline hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all cursor-pointer press-scale-subtle text-slate-100',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-3 sm:p-4',
      md: 'p-4 sm:p-6',
      lg: 'p-6 sm:p-8',
    };

    return (
      <div
        ref={ref}
        className={`rounded-2xl relative overflow-hidden ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
