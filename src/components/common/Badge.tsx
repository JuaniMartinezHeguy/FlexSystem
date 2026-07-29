import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  className = ''
}) => {
  const variantStyles = {
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    danger: 'bg-red-950/60 text-red-400 border-red-800/60',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    info: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
    neutral: 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variantStyles[variant]} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
