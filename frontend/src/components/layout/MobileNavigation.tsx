import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Sparkles, Shirt, CalendarDays, User as UserIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export const MobileNavigation: React.FC = () => {
  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt },
    { name: 'Planner', path: '/planner', icon: CalendarDays },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white dark:bg-[#18181B] border-t border-neutral-200 dark:border-neutral-800 flex items-stretch justify-around transition-colors h-14"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 transition-colors select-none focus:outline-none',
                isActive
                  ? 'text-neutral-900 dark:text-neutral-50 font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-5 h-5 mb-0.5',
                    isActive
                      ? 'text-neutral-900 dark:text-neutral-50 stroke-[2.2]'
                      : 'text-neutral-500 dark:text-neutral-400 stroke-[1.8]'
                  )}
                />
                <span className="text-[11px] leading-none tracking-tight">{item.name}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
