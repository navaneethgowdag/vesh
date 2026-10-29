import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Sparkles, Plus, User as UserIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export const MobileNavigation: React.FC = () => {
  const navigate = useNavigate();

  const mobileNav = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles, isAi: true },
    { name: 'Profile', path: '/profile', icon: UserIcon },
  ];

  return (
    <>
      {/* Floating Action Button for Create Post with safe area */}
      <button
        onClick={() => navigate('/create')}
        aria-label="Create outfit post"
        title="Create Post"
        className="fixed bottom-20 right-4 z-40 lg:hidden w-12 h-12 bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] rounded-full shadow-soft flex items-center justify-center hover:bg-[#C3A36B] dark:hover:bg-[#D1B47A] active:scale-95 transition-all border border-[#E5DED3] dark:border-[#393832]"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-[#FFFFFF]/95 dark:bg-[#1E1E1B]/95 backdrop-blur-md border-t border-[#E5DED3] dark:border-[#393832] px-3 py-1.5 flex items-center justify-around shadow-soft transition-colors">
        {mobileNav.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-1 px-3 text-[10px] tracking-wide font-medium transition-colors',
                  isActive
                    ? 'text-[#25211E] dark:text-[#F4F0E8] font-bold'
                    : 'text-[#82796F] dark:text-[#B2AA9E]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isActive ? 'text-[#C3A36B] dark:text-[#D1B47A]' : 'text-[#82796F] dark:text-[#B2AA9E]'
                    )}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* Center Daily Fit Highlight */}
        <NavLink
          to="/daily-fit"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 py-1 px-3 text-[10px] tracking-wide font-medium transition-colors relative',
              isActive
                ? 'text-[#C3A36B] dark:text-[#D1B47A] font-bold'
                : 'text-[#82796F] dark:text-[#B2AA9E]'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center -mt-3 shadow-subtle transition-transform active:scale-95 border',
                  isActive
                    ? 'bg-[#C3A36B] text-[#171715] border-[#C3A36B]'
                    : 'bg-[#F7F4EE] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] border-[#E5DED3] dark:border-[#393832]'
                )}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="mt-0.5">Daily Fit</span>
            </>
          )}
        </NavLink>

        {mobileNav.slice(2).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-1 px-3 text-[10px] tracking-wide font-medium transition-colors',
                  isActive
                    ? 'text-[#25211E] dark:text-[#F4F0E8] font-bold'
                    : 'text-[#82796F] dark:text-[#B2AA9E]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isActive ? 'text-[#C3A36B] dark:text-[#D1B47A]' : 'text-[#82796F] dark:text-[#B2AA9E]'
                    )}
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};
