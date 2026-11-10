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
    'inline-flex items-center justify-center font-sans font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none rounded-xl tracking-normal select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#727D69] dark:focus-visible:ring-[#9EAB97] focus-visible:ring-offset-2 cursor-pointer';

  const variants = {
    primary:
      'bg-[#202321] hover:bg-[#323833] dark:bg-[#F8F6F1] dark:hover:bg-[#E9E6DE] text-[#F8F6F1] dark:text-[#202321] font-semibold border border-transparent shadow-subtle',
    champagne:
      'bg-[#727D69] hover:bg-[#5C6554] text-[#F8F6F1] font-semibold border border-transparent shadow-subtle',
    secondary:
      'bg-[#F1EEE7] hover:bg-[#E9E6DE] dark:bg-[#252A26] dark:hover:bg-[#2F3630] text-[#202321] dark:text-[#F8F6F1] border border-[#E2DDD3] dark:border-[#2D342F] font-medium',
    outline:
      'border border-[#D8D3C8] dark:border-[#38413A] text-[#202321] dark:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] font-medium',
    ghost:
      'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] font-medium',
    danger:
      'bg-rose-700 text-white hover:bg-rose-800 border border-transparent font-medium shadow-subtle',
  };

  const sizes = {
    sm: 'text-xs min-h-[36px] px-3.5 py-1.5 gap-1.5 rounded-lg',
    md: 'text-sm min-h-[44px] px-4 py-2 gap-2 rounded-xl',
    lg: 'text-base min-h-[48px] px-6 py-2.5 gap-2.5 font-semibold rounded-xl',
    icon: 'min-h-[44px] min-w-[44px] p-2.5 rounded-xl',
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
