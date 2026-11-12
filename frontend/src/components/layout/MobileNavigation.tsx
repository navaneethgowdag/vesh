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
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[#FFFFFF]/95 dark:bg-[#1A151C]/95 backdrop-blur-md border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-stretch justify-around transition-colors h-16 pb-safe"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center min-h-[48px] py-1.5 px-1 transition-all select-none focus:outline-none relative',
                isActive
                  ? 'text-[#743C49] dark:text-[#D5A6A0] font-semibold'
                  : 'text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'w-5 h-5 mb-1 transition-transform',
                    isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'
                  )}
                />
                <span className="text-[11px] font-medium leading-none tracking-tight font-sans">
                  {item.name}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1.5 h-0.5 rounded-[1px] bg-[#743C49] dark:bg-[#D5A6A0]" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
