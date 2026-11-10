import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#18181B] rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
