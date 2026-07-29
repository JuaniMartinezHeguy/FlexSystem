import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
      <div className="p-4 bg-zinc-900 rounded-2xl text-red-500 mb-4 border border-zinc-800 shadow-inner">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-zinc-200 mb-1">{title}</h4>
      {description && <p className="text-xs text-zinc-400 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
};
