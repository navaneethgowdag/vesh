import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Sparkles,
  Shirt,
  Calendar as CalendarIcon,
  CalendarDays,
  BarChart2,
  Layers,
  Bell,
  User as UserIcon,
  Settings,
  LogOut,
} from 'lucide-react';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const { unreadNotifsCount, wardrobe, logout, showToast } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const mainNavItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles, badge: 'AI' },
    { name: 'My Wardrobe', path: '/wardrobe', icon: Shirt, count: wardrobe.length },
    { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { name: 'Weekly Planner', path: '/planner', icon: CalendarDays },
    { name: 'Wardrobe Insights', path: '/insights', icon: BarChart2 },
    { name: 'Wardrobe Gap', path: '/wardrobe-gap', icon: Layers },
  ];

  const accountNavItems = [
    { name: 'Notifications', path: '/notifications', icon: Bell, count: unreadNotifsCount },
    { name: 'Profile', path: '/profile', icon: UserIcon },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await logout();
      showToast('Signed out of TailorBird', 'info');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-white dark:bg-[#18181B] border-r border-zinc-200 dark:border-zinc-800 px-5 py-6 justify-between select-none transition-colors">
      {/* Brand Header & Nav */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/home')}
          className="cursor-pointer group flex items-center gap-3 px-2 py-1 mb-6"
        >
          <div className="w-9 h-9 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-base transition-colors shadow-sm">
            T
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 transition-colors">
              TailorBird
            </span>
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium tracking-wide">
              AI Wardrobe Stylist
            </p>
          </div>
        </div>

        {/* Main Navigation Section */}
        <div className="mb-6">
          <p className="px-3 mb-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Stylist & Wardrobe
          </p>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-md text-[14px] font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-transform group-hover:scale-105',
                            isActive
                              ? 'text-white dark:text-zinc-900'
                              : 'text-zinc-500 dark:text-zinc-400'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}

                        {typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded font-semibold',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            )}
                          >
                            {item.count}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Account Navigation Section */}
        <div>
          <p className="px-3 mb-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
            Account
          </p>
          <nav className="space-y-1">
            {accountNavItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-md text-[14px] font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-transform group-hover:scale-105',
                            isActive
                              ? 'text-white dark:text-zinc-900'
                              : 'text-zinc-500 dark:text-zinc-400'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      {typeof item.count === 'number' && item.count > 0 && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded font-semibold',
                            isActive
                              ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Card at Bottom */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors group">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
          >
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" isVerified={currentUser.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{currentUser.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out of TailorBird"
            aria-label="Log Out"
            className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
