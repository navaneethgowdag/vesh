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
  Crown,
  Cpu,
  Bell,
  User as UserIcon,
  Settings,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const { unreadNotifsCount, wardrobe, logout, showToast } = useApp();
  const { resolvedTheme, toggleTheme } = useTheme();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const mainNavItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles, badge: 'AI' },
    { name: 'My Wardrobe', path: '/wardrobe', icon: Shirt, count: wardrobe.length },
    { name: 'Occasion Vault', path: '/vault', icon: Crown, badge: 'Vault' },
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
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-white dark:bg-[#1A1D1A] border-r border-[#E2DDD3] dark:border-[#2D342F] px-5 py-6 justify-between select-none transition-colors">
      {/* Brand Header & Nav */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/home')}
          className="cursor-pointer group flex items-center gap-3 px-2 py-1 mb-7"
        >
          <div className="w-10 h-10 rounded-xl bg-[#202321] dark:bg-[#F8F6F1] flex items-center justify-center text-[#F8F6F1] dark:text-[#202321] font-serif font-bold text-lg transition-transform group-hover:scale-105 shadow-sm">
            T
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1] font-serif transition-colors">
              TailorBird
            </span>
            <p className="text-[10px] text-[#727D69] dark:text-[#9EAB97] font-semibold tracking-widest uppercase">
              AI Wardrobe Stylist
            </p>
          </div>
        </div>

        {/* Main Navigation Section */}
        <div className="mb-7">
          <p className="px-3 mb-2 text-[11px] font-bold text-[#777C75] dark:text-[#8E968C] uppercase tracking-wider">
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
                      'group flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-[14px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] font-semibold shadow-subtle'
                        : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-transform group-hover:scale-110',
                            isActive
                              ? 'text-[#F8F6F1] dark:text-[#202321]'
                              : 'text-[#777C75] dark:text-[#8E968C]'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#202321]'
                                : 'bg-[#E9E6DE] dark:bg-[#2D342F] text-[#727D69] dark:text-[#B8C7B3] border border-[#D8D3C8] dark:border-[#38413A]'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}

                        {typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-mono font-semibold',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#202321]'
                                : 'bg-[#F1EEE7] dark:bg-[#252A26] text-[#777C75] dark:text-[#A3ABA0]'
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
          <p className="px-3 mb-2 text-[11px] font-bold text-[#777C75] dark:text-[#8E968C] uppercase tracking-wider">
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
                      'group flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-[14px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] font-semibold shadow-subtle'
                        : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-transform group-hover:scale-110',
                            isActive
                              ? 'text-[#F8F6F1] dark:text-[#202321]'
                              : 'text-[#777C75] dark:text-[#8E968C]'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      {typeof item.count === 'number' && item.count > 0 && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-mono font-semibold',
                            isActive
                              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#202321]'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
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
      <div className="pt-4 border-t border-[#E2DDD3] dark:border-[#2D342F]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] transition-colors group">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
          >
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" isVerified={currentUser.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#202321] dark:text-[#F8F6F1] truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] font-mono truncate">
                @{currentUser.username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              title="Log Out of TailorBird"
              aria-label="Log Out"
              className="p-2 text-[#777C75] dark:text-[#A3ABA0] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
