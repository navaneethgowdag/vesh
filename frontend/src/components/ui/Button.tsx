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
    'inline-flex items-center justify-center font-sans font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 rounded-full tracking-wide select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C3A36B] dark:focus-visible:ring-[#D1B47A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F4EE] dark:focus-visible:ring-offset-[#171715]';

  const variants = {
    primary:
      'bg-[#25211E] hover:bg-[#3D3732] dark:bg-[#F4F0E8] dark:hover:bg-white text-[#F7F4EE] dark:text-[#171715] shadow-subtle hover:shadow-soft font-semibold',
    champagne:
      'bg-[#C3A36B] hover:bg-[#A9874F] dark:bg-[#D1B47A] dark:hover:bg-[#C3A36B] text-[#171715] shadow-subtle hover:shadow-soft font-semibold',
    secondary:
      'bg-[#EFE9DF] hover:bg-[#E5DED3] dark:bg-[#2A2A26] dark:hover:bg-[#393832] text-[#25211E] dark:text-[#F4F0E8] border border-[#E5DED3] dark:border-[#393832]',
    outline:
      'border border-[#E5DED3] dark:border-[#393832] text-[#25211E] dark:text-[#F4F0E8] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26] hover:border-[#C3A36B] dark:hover:border-[#D1B47A]',
    ghost:
      'text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] hover:bg-[#EFE9DF]/50 dark:hover:bg-[#2A2A26]',
    danger:
      'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60',
  };

  const sizes = {
    sm: 'text-xs min-h-[36px] px-3.5 py-1.5 gap-1.5',
    md: 'text-sm min-h-[44px] px-5 py-2.5 gap-2',
    lg: 'text-base min-h-[48px] px-6 py-3 gap-2.5 font-semibold',
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
