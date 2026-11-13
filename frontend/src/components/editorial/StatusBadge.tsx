import React, { ReactNode } from 'react';

export type StatusVariant =
  | 'oxblood'
  | 'aubergine'
  | 'rose'
  | 'camel'
  | 'olive'
  | 'neutral'
  | 'amber'
  | 'emerald'
  | 'roseAlert';

interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  size = 'sm',
  className = '',
}) => {
  const variantStyles: Record<StatusVariant, string> = {
    oxblood: 'bg-[#743C49] text-white border-[#743C49]',
    aubergine: 'bg-[#29202B] text-white border-[#29202B] dark:bg-[#F3EEE8] dark:text-[#29202B] dark:border-[#F3EEE8]',
    rose: 'bg-[#D5A6A0]/20 text-[#743C49] border-[#D5A6A0] dark:bg-[#D5A6A0]/10 dark:text-[#D5A6A0]',
    camel: 'bg-[#B49B82]/20 text-[#544131] border-[#B49B82]/50 dark:bg-[#B49B82]/10 dark:text-[#DCD4CC]',
    olive: 'bg-[#6D7068]/15 text-[#29202B] border-[#6D7068]/40 dark:bg-[#6D7068]/20 dark:text-[#DCD4CC]',
    neutral: 'bg-[#FFFFFF] text-[#29202B] border-[#DCD4CC] dark:bg-[#241D27] dark:text-[#F3EEE8] dark:border-[#392F3E]',
    amber: 'bg-amber-900/15 text-amber-900 border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/50',
    emerald: 'bg-emerald-900/15 text-emerald-900 border-emerald-600/40 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/50',
    roseAlert: 'bg-rose-900/15 text-rose-900 border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-700/50',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 tracking-[0.08em]',
    md: 'text-xs px-2.5 py-1 tracking-[0.06em]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-sans font-medium uppercase rounded-[2px] border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </span>
  );
};
