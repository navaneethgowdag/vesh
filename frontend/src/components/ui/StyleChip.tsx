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
        'inline-flex items-center gap-1.5 rounded-full transition-all duration-200 font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs md:text-sm',
        selected
          ? 'bg-charcoal-900 text-cream-50 shadow-soft-sm'
          : 'bg-sand-100 text-charcoal-700 border border-sand-200/80 hover:bg-sand-200 hover:border-sand-300',
        !isInteractive && 'cursor-default hover:bg-sand-100 hover:border-sand-200/80',
        className
      )}
    >
      {icon && <span className="opacity-80 text-xs">{icon}</span>}
      <span>{label}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
            selected ? 'bg-cream-100 text-charcoal-900' : 'bg-sand-200 text-charcoal-600'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
};

