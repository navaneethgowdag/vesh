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
    { name: '24h Moments', path: '/moments', icon: Sparkles, badge: 'Swipe' },
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
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-[#FFFFFF] dark:bg-[#1A151C] border-r border-[#DCD4CC] dark:border-[#392F3E] px-5 py-6 justify-between select-none transition-colors">
      {/* Brand Header & Nav */}
      <div className="flex flex-col flex-1 overflow-y-auto no-scrollbar">
        {/* Brand Header */}
        <div
          onClick={() => navigate('/home')}
          className="cursor-pointer group flex items-center gap-3 px-2 py-1 mb-7"
        >
          <div className="w-9 h-9 rounded-[3px] bg-[#29202B] dark:bg-[#F3EEE8] flex items-center justify-center text-[#FFFFFF] dark:text-[#29202B] font-serif font-bold text-lg transition-transform group-hover:scale-105 shadow-xs">
            T
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-[#29202B] dark:text-[#F3EEE8] font-serif transition-colors">
              TailorBird
            </span>
            <p className="text-[10px] text-[#743C49] dark:text-[#D5A6A0] font-mono tracking-widest uppercase">
              Atelier & Stylist
            </p>
          </div>
        </div>

        {/* Main Navigation Section */}
        <div className="mb-7">
          <p className="px-3 mb-2 text-[10px] font-mono font-bold text-[#6D7068] dark:text-[#A89E9B] uppercase tracking-wider">
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
                      'group flex items-center justify-between px-3 py-2 min-h-[40px] rounded-[3px] text-[13px] font-sans font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] font-semibold shadow-xs'
                        : 'text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] hover:bg-[#F3EEE8] dark:hover:bg-[#241D27]'
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
                              ? 'text-[#FFFFFF] dark:text-[#29202B]'
                              : 'text-[#6D7068] dark:text-[#A89E9B]'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.2 rounded-[2px] font-mono font-bold uppercase tracking-wider',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#29202B]'
                                : 'bg-[#F3EEE8] dark:bg-[#241D27] text-[#743C49] dark:text-[#D5A6A0] border border-[#DCD4CC] dark:border-[#392F3E]'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}

                        {typeof item.count === 'number' && item.count > 0 && (
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-[2px] font-mono font-semibold',
                              isActive
                                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#29202B]'
                                : 'bg-[#F3EEE8] dark:bg-[#241D27] text-[#6D7068] dark:text-[#A89E9B]'
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
          <p className="px-3 mb-2 text-[10px] font-mono font-bold text-[#6D7068] dark:text-[#A89E9B] uppercase tracking-wider">
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
                      'group flex items-center justify-between px-3 py-2 min-h-[40px] rounded-[3px] text-[13px] font-sans font-medium transition-all duration-150',
                      isActive
                        ? 'bg-[#29202B] dark:bg-[#F3EEE8] text-[#FFFFFF] dark:text-[#29202B] font-semibold shadow-xs'
                        : 'text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] hover:bg-[#F3EEE8] dark:hover:bg-[#241D27]'
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
                              ? 'text-[#FFFFFF] dark:text-[#29202B]'
                              : 'text-[#6D7068] dark:text-[#A89E9B]'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      {typeof item.count === 'number' && item.count > 0 && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-[2px] font-mono font-semibold',
                            isActive
                              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#29202B]'
                              : 'bg-[#A33D42]/10 text-[#A33D42] dark:text-[#D5A6A0]'
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
      <div className="pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E]">
        <div className="flex items-center justify-between p-2 rounded-[3px] hover:bg-[#F3EEE8] dark:hover:bg-[#241D27] transition-colors group">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
          >
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" isVerified={currentUser.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#29202B] dark:text-[#F3EEE8] truncate">
                {currentUser.name}
              </p>
              <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-mono truncate">
                @{currentUser.username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              title="Log Out of TailorBird"
              aria-label="Log Out"
              className="p-2 text-[#6D7068] dark:text-[#A89E9B] hover:text-[#A33D42] dark:hover:text-[#D5A6A0] rounded-[2px] hover:bg-[#F3EEE8] dark:hover:bg-[#241D27] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
