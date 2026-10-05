import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
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
    'inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 rounded-full tracking-wide focus:outline-none focus:ring-2 focus:ring-cognac-500/30';

  const variants = {
    primary:
      'bg-charcoal-900 text-cream-50 hover:bg-cognac-700 shadow-soft hover:shadow-soft-lg',
    secondary:
      'bg-sand-200 text-charcoal-800 hover:bg-sand-300 shadow-soft-sm',
    outline:
      'border border-sand-300 text-charcoal-800 hover:bg-sand-100/70 hover:border-charcoal-700',
    ghost:
      'text-charcoal-700 hover:bg-sand-200/50 hover:text-charcoal-900',
    danger:
      'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5 font-semibold',
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
      <span>{children}</span>
    </button>
  );
};

