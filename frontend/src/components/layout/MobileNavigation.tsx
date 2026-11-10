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
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 dark:bg-[#1A1D1A]/95 backdrop-blur-md border-t border-[#E2DDD3] dark:border-[#2D342F] flex items-stretch justify-around transition-colors h-16 pb-safe"
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
                  ? 'text-[#202321] dark:text-[#F8F6F1] font-semibold'
                  : 'text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1]'
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
                <span className="text-[11px] font-medium leading-none tracking-tight">
                  {item.name}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#727D69] dark:bg-[#899783]" />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
