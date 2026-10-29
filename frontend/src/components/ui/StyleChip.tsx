import React from 'react';
import { cn } from '../../utils/cn';

interface StyleChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export const StyleChip: React.FC<StyleChipProps> = ({
  label,
  selected = false,
  onClick,
  icon,
  count,
  size = 'md',
  className,
}) => {
  const isInteractive = Boolean(onClick);

  return (
    <button
      type={isInteractive ? 'button' : undefined}
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md transition-all duration-150 font-medium whitespace-nowrap border',
        size === 'sm' ? 'px-2.5 py-1 min-h-[36px] text-xs' : 'px-3.5 py-2 min-h-[44px] text-xs sm:text-sm',
        selected
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700',
        !isInteractive && 'cursor-default hover:bg-white dark:hover:bg-zinc-800',
        className
      )}
    >
      {icon && <span className="opacity-80 text-xs">{icon}</span>}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded font-semibold',
            selected
              ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
};
