import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'champagne';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  children?: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-sans font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none rounded-md tracking-normal select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-neutral-100 focus-visible:ring-offset-2';

  const variants = {
    primary:
      'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-medium border border-transparent shadow-subtle',
    champagne:
      'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-medium border border-transparent shadow-subtle',
    secondary:
      'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700',
    outline:
      'border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800',
    ghost:
      'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 border border-transparent',
  };

  const sizes = {
    sm: 'text-xs min-h-[36px] px-3 py-1.5 gap-1.5',
    md: 'text-sm min-h-[44px] px-4 py-2.5 gap-2',
    lg: 'text-base min-h-[48px] px-5 py-3 gap-2.5 font-medium',
    icon: 'min-h-[44px] min-w-[44px] p-2.5',
  };

  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
    </button>
  );
};
