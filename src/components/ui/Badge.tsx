import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'amber' | 'red' | 'slate' | 'purple';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  size = 'md',
  icon,
  className = '',
}) => {
  const variantStyles = {
    blue: 'bg-brand-950/80 text-brand-300 border-brand-800/60 font-semibold',
    green: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50 font-semibold',
    amber: 'bg-amber-950/70 text-amber-300 border-amber-800/50 font-semibold',
    red: 'bg-red-950/70 text-red-300 border-red-800/50 font-semibold',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
    purple: 'bg-purple-950/70 text-purple-300 border-purple-800/50',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-[11px] px-2 py-0.5 gap-1.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide font-sans ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
