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
          'inline-flex items-center p-1 rounded-xl bg-[#F1EEE7] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F]',
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
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none min-h-[36px]',
                isActive
                  ? 'bg-white dark:bg-[#1A1D1A] text-[#202321] dark:text-[#F8F6F1] shadow-subtle border border-[#E2DDD3] dark:border-[#2D342F]'
                  : 'text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1]'
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
          'flex items-center justify-between p-2.5 rounded-xl bg-[#F1EEE7] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F]',
          className
        )}
      >
        <div className="flex items-center gap-2 pl-2">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-[#F8F6F1]" />
          ) : (
            <Sun className="w-4 h-4 text-[#202321]" />
          )}
          <span className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1]">
            {resolvedTheme === 'dark' ? 'Dark' : 'Light'} Mode
          </span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#727D69]',
            resolvedTheme === 'dark' ? 'bg-[#727D69]' : 'bg-[#D8D3C8]'
          )}
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
};
