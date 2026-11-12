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
    default: 'bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]',
    subtle: 'bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]',
    elevated: 'bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs',
  };

  return (
    <div
      className={cn(
        'rounded-[4px] transition-all duration-150',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
