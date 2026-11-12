import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';
import { isReducedMotion } from '../../utils/animations';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'champagne';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  loadingText?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  isLoading = false,
  loadingText,
  className,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-sans font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none rounded-[3px] tracking-normal select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#743C49] dark:focus-visible:ring-[#D5A6A0] focus-visible:ring-offset-1 cursor-pointer';

  const variants = {
    primary:
      'bg-[#743C49] hover:bg-[#5E303B] dark:bg-[#743C49] dark:hover:bg-[#8A4A58] text-[#FFFFFF] font-medium border border-transparent shadow-xs',
    champagne:
      'bg-[#29202B] hover:bg-[#3D3040] dark:bg-[#F3EEE8] dark:hover:bg-[#E4DDD4] text-[#F3EEE8] dark:text-[#29202B] font-medium border border-transparent shadow-xs',
    secondary:
      'bg-[#FFFFFF] hover:bg-[#F3EEE8] dark:bg-[#241D27] dark:hover:bg-[#2E2532] text-[#29202B] dark:text-[#F3EEE8] border border-[#DCD4CC] dark:border-[#392F3E] font-medium',
    outline:
      'border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] hover:bg-[#F3EEE8] dark:hover:bg-[#241D27] font-medium',
    ghost:
      'text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] hover:bg-[#F3EEE8]/60 dark:hover:bg-[#241D27]/60 font-medium',
    danger:
      'bg-[#A33D42] text-white hover:bg-[#893237] border border-transparent font-medium shadow-xs',
  };

  const sizes = {
    sm: 'text-xs min-h-[34px] px-3 py-1.5 gap-1.5 rounded-[2px]',
    md: 'text-sm min-h-[42px] px-4 py-2 gap-2 rounded-[3px]',
    lg: 'text-base min-h-[46px] px-6 py-2.5 gap-2.5 font-medium rounded-[3px]',
    icon: 'min-h-[40px] min-w-[40px] p-2 rounded-[3px]',
  };

  const isDisabled = disabled || isLoading;
  const reducedMotion = isReducedMotion();

  return (
    <motion.button
      whileTap={isDisabled || reducedMotion ? undefined : { scale: 0.98 }}
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={isDisabled}
      aria-busy={isLoading}
      {...(props as HTMLMotionProps<'button'>)}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {isLoading && loadingText ? (
        <span>{loadingText}</span>
      ) : (
        children && <span>{children}</span>
      )}
    </motion.button>
  );
};
