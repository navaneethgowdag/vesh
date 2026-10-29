import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Sparkles, Shirt, User as UserIcon, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

export const MobileNavigation: React.FC = () => {
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <>
      {/* Action Button for Create Post with safe area */}
      <button
        onClick={() => navigate('/create')}
        aria-label="Create post"
        title="Create post"
        className="fixed bottom-16 right-4 z-40 lg:hidden w-11 h-11 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md shadow-md flex items-center justify-center hover:bg-neutral-800 dark:hover:bg-white active:scale-95 transition-all border border-neutral-700 dark:border-neutral-300"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Bottom Bar: 5 distinct items with comfortable touch targets */}
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
    </>
  );
};
