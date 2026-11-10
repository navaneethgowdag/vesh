import React from 'react';
import { cn } from '../../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = 'default',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-soft',
    subtle: 'bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F]',
    elevated: 'bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-soft-md',
  };

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-150',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
