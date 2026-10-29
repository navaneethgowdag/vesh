import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemePreference } from '../../context/ThemeContext';
import { cn } from '../../utils/cn';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented' | 'pill';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { themePreference, resolvedTheme, setThemePreference, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    const options: { id: ThemePreference; label: string; icon: React.ReactNode }[] = [
      { id: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
      { id: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
      { id: 'system', label: 'System', icon: <Monitor className="w-3.5 h-3.5" /> },
    ];

    return (
      <div
        className={cn(
          'inline-flex items-center p-1 rounded-2xl bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border',
          className
        )}
        role="group"
        aria-label="Theme preference selector"
      >
        {options.map((opt) => {
          const isActive = themePreference === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setThemePreference(opt.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none',
                isActive
                  ? 'bg-luxury-surface dark:bg-luxury-dark-surface text-luxury-text dark:text-luxury-dark-text shadow-soft-xs border border-luxury-border/60 dark:border-luxury-dark-border/60'
                  : 'text-luxury-textMuted dark:text-luxury-dark-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text'
              )}
              aria-pressed={isActive}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div
        className={cn(
          'flex items-center justify-between p-2 rounded-2xl bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border',
          className
        )}
      >
        <div className="flex items-center gap-2 pl-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne" />
          ) : (
            <Sun className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne" />
          )}
          <span className="text-xs font-medium text-luxury-text dark:text-luxury-dark-text">
            {resolvedTheme === 'dark' ? 'Obsidian' : 'Ivory'} Mode
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-luxury-champagne bg-luxury-border dark:bg-luxury-dark-champagne"
          role="switch"
          aria-checked={resolvedTheme === 'dark'}
          aria-label="Toggle dark mode"
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              resolvedTheme === 'dark' ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>
    );
  }

  // Compact variant (Header / TopBar icon button)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'p-2 rounded-full border border-luxury-border dark:border-luxury-dark-border bg-luxury-surface dark:bg-luxury-dark-surface text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle transition-all cursor-pointer shadow-soft-xs',
        className
      )}
      title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};
