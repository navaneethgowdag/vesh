import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  Sparkles,
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
  const { unreadNotifsCount, wardrobe } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Daily Fit', path: '/daily-fit', icon: Sparkles, badge: 'AI' },
    { name: 'Explore', path: '/explore', icon: Compass },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt, count: wardrobe.length },
    { name: 'Create', path: '/create', icon: PlusCircle, highlight: true },
    { name: 'Saved', path: '/saved', icon: Bookmark },
    { name: 'Notifications', path: '/notifications', icon: Bell, count: unreadNotifsCount },
    { name: 'Profile', path: '/profile', icon: UserIcon },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-screen sticky top-0 bg-cream-50/90 border-r border-sand-200/80 px-6 py-7 justify-between select-none">
      {/* Brand Header */}
      <div>
        <div
          onClick={() => navigate('/home')}
          className="cursor-pointer group flex items-center gap-3 px-2 py-1 mb-8"
        >
          <div className="w-10 h-10 rounded-2xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-xl shadow-soft group-hover:bg-cognac-700 transition-colors">
            S
          </div>
          <div>
            <span className="font-serif text-2xl font-bold tracking-tight text-charcoal-900 group-hover:text-cognac-800 transition-colors">
              StyleSphere
            </span>
            <span className="block text-[10px] tracking-widest uppercase font-semibold text-cognac-600 -mt-1">
              AI Atelier
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-charcoal-900 text-cream-50 font-semibold shadow-soft-sm'
                      : 'text-charcoal-600 hover:text-charcoal-950 hover:bg-sand-100/90',
                    item.highlight && !isActive && 'text-cognac-700 font-semibold bg-sand-100/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3.5">
                      <Icon
                        className={cn(
                          'w-5 h-5 transition-transform group-hover:scale-110',
                          isActive ? 'text-cream-50' : item.highlight ? 'text-cognac-600' : 'text-charcoal-500'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                        isActive ? 'bg-cognac-500 text-white' : 'bg-cognac-100 text-cognac-800'
                      )}>
                        {item.badge}
                      </span>
                    )}

                    {typeof item.count === 'number' && item.count > 0 && (
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-semibold',
                          isActive ? 'bg-cream-100 text-charcoal-900' : 'bg-sand-200 text-charcoal-700'
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

      {/* User Card at Bottom */}
      <div className="pt-6 border-t border-sand-200/80">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-sand-100/90 transition-colors group"
        >
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="md" isVerified={currentUser.isVerified} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-charcoal-900 truncate group-hover:text-cognac-700 transition-colors">
              {currentUser.name}
            </p>
            <p className="text-xs text-charcoal-400 truncate">@{currentUser.username}</p>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}
            title="Log Out / Switch Account"
            className="p-1.5 text-charcoal-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </NavLink>
      </div>
    </aside>
  );
};

