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
          'inline-flex items-center p-1 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
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
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer select-none min-h-[36px]',
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200 dark:border-zinc-700'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
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
          'flex items-center justify-between p-2 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700',
          className
        )}
      >
        <div className="flex items-center gap-2 pl-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-zinc-100" />
          ) : (
            <Sun className="w-4 h-4 text-zinc-900" />
          )}
          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
            {resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 bg-zinc-300 dark:bg-zinc-600"
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
        'w-11 h-11 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-sm',
        className
      )}
      title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-zinc-100 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-zinc-900 transition-transform hover:-rotate-12" />
      )}
    </button>
  );
};
