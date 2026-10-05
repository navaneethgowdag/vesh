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
      {/* Floating Action Button for Create Post */}
      <button
        onClick={() => navigate('/create')}
        aria-label="Create outfit post"
        className="fixed bottom-20 right-5 z-40 lg:hidden w-14 h-14 bg-charcoal-900 text-cream-50 rounded-full shadow-soft-xl flex items-center justify-center hover:bg-cognac-700 active:scale-95 transition-all border-2 border-cream-100"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-cream-50/95 backdrop-blur-md border-t border-sand-200/80 px-4 py-2 flex items-center justify-around shadow-soft-lg">
        {mobileNav.slice(0, 2).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-medium transition-colors',
                  isActive ? 'text-charcoal-950 font-bold' : 'text-charcoal-400 hover:text-charcoal-700'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-5 h-5', isActive && 'text-cognac-700')} />
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
              'flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-medium transition-colors relative',
              isActive ? 'text-cognac-700 font-bold' : 'text-charcoal-500'
            )
          }
        >
          {({ isActive }) => (
            <>
              <div
                className={cn(
                  'w-9 h-9 rounded-2xl flex items-center justify-center -mt-3 shadow-soft transition-transform active:scale-95',
                  isActive
                    ? 'bg-cognac-700 text-white'
                    : 'bg-sand-200 text-charcoal-800 border border-sand-300'
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
                  'flex flex-col items-center gap-1 py-1 px-3 text-[11px] font-medium transition-colors',
                  isActive ? 'text-charcoal-950 font-bold' : 'text-charcoal-400 hover:text-charcoal-700'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-5 h-5', isActive && 'text-cognac-700')} />
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

