import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sparkles } from 'lucide-react';
import { useApp, useCurrentUser } from '../../context/AppContext';
import { Avatar } from '../ui/Avatar';

const getWeatherEmoji = (icon: string) => {
  if (icon === 'sun') return '☀️';
  if (icon === 'cloud-sun') return '⛅';
  if (icon === 'cloud-rain') return '🌧️';
  if (icon === 'cloud-snow') return '❄️';
  if (icon === 'cloud-lightning') return '⛈️';
  if (icon === 'cloud') return '☁️';
  return '⛅';
};

export const TopBar: React.FC = () => {
  const { unreadNotifsCount, weather } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-cream-50/90 backdrop-blur-md border-b border-sand-200/80 px-4 py-3 flex items-center justify-between">
      {/* Brand */}
      <div
        onClick={() => navigate('/home')}
        className="flex items-center gap-2.5 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-xl bg-charcoal-900 flex items-center justify-center text-cream-50 font-serif font-bold text-sm shadow-soft">
          S
        </div>
        <span className="font-serif text-lg font-bold tracking-tight text-charcoal-900">
          StyleSphere
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Weather chip */}
        <button
          onClick={() => navigate('/daily-fit')}
          className="flex items-center gap-1.5 bg-sand-100 text-charcoal-700 px-2.5 py-1 rounded-full text-xs font-medium border border-sand-200"
        >
          <span>{getWeatherEmoji(weather.icon)}</span>
          <span>{weather.temp}°C</span>
        </button>

        {/* Search */}
        <button
          onClick={() => navigate('/explore')}
          className="p-2 text-charcoal-600 hover:text-charcoal-900 rounded-full hover:bg-sand-200 transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-charcoal-600 hover:text-charcoal-900 rounded-full hover:bg-sand-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cognac-600 rounded-full ring-2 ring-cream-50" />
          )}
        </button>

        {/* Profile Avatar */}
        <button
          onClick={() => navigate('/profile')}
          className="p-0.5 rounded-full ring-1 ring-sand-300"
        >
          <Avatar src={currentUser.avatar} alt={currentUser.name} size="sm" />
        </button>
      </div>
    </header>
  );
};

