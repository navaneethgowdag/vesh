import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Sparkles,
  Calendar as CalendarIcon,
  Compass,
  Shirt,
  PlusCircle,
  Bookmark,
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

  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles, badge: 'AI' },
    { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt, count: wardrobe.length },
    { name: 'Create', path: '/create', icon: PlusCircle, highlight: true },
    { name: 'Saved', path: '/saved', icon: Bookmark },
    { name: 'Notifications', path: '/notifications', icon: Bell, count: unreadNotifsCount },
    { name: 'Profile', path: '/profile', icon: UserIcon },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await logout();
      showToast('Signed out of StyleSphere', 'info');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-[#FFFFFF]/90 dark:bg-[#1E1E1B]/95 border-r border-[#E5DED3] dark:border-[#393832] px-6 py-7 justify-between select-none transition-colors">
      {/* Brand Header */}
      <div>
        <div
          onClick={() => navigate('/home')}
          className="cursor-pointer group flex items-center gap-3 px-2 py-1 mb-8"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#25211E] dark:bg-[#2A2A26] border border-[#C3A36B]/30 flex items-center justify-center text-[#F7F4EE] dark:text-[#F4F0E8] font-serif font-bold text-xl shadow-subtle group-hover:bg-[#C3A36B] transition-colors">
            S
          </div>
          <div>
            <span className="font-serif text-2xl font-bold tracking-tight text-[#25211E] dark:text-[#F4F0E8] group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
              StyleSphere
            </span>
            <span className="block text-[10px] tracking-[0.2em] uppercase font-semibold text-[#C3A36B] dark:text-[#D1B47A] -mt-1 font-sans">
              AI Atelier
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] font-semibold shadow-subtle'
                      : 'text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26]',
                    item.highlight && !isActive && 'text-[#C3A36B] dark:text-[#D1B47A] font-semibold bg-[#F7F4EE] dark:bg-[#2A2A26]/60 border border-[#E5DED3] dark:border-[#393832]'
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
                            ? 'text-[#C3A36B] dark:text-[#25211E]'
                            : item.highlight
                            ? 'text-[#C3A36B] dark:text-[#D1B47A]'
                            : 'text-[#82796F] dark:text-[#B2AA9E]'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                            isActive
                              ? 'bg-[#C3A36B] text-[#171715]'
                              : 'bg-[#C3A36B]/20 text-[#C3A36B] dark:text-[#D1B47A]'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}

                      {typeof item.count === 'number' && item.count > 0 && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-semibold',
                            isActive
                              ? 'bg-[#3D3732] dark:bg-[#E5DED3] text-[#F7F4EE] dark:text-[#171715]'
                              : 'bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#82796F] dark:text-[#B2AA9E]'
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

      {/* User Card at Bottom */}
      <div className="pt-4 border-t border-[#E5DED3] dark:border-[#393832]">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26] transition-colors group">
          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
          >
            <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" isVerified={currentUser.isVerified} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#25211E] dark:text-[#F4F0E8] truncate group-hover:text-[#C3A36B] dark:group-hover:text-[#D1B47A] transition-colors">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E] truncate">@{currentUser.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out of StyleSphere"
            aria-label="Log Out"
            className="p-2 text-[#82796F] dark:text-[#B2AA9E] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
