import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
  const { unreadNotifsCount, weather, weatherStatus, isWeatherLoading } = useApp();
  const navigate = useNavigate();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-2.5 flex items-center justify-between transition-colors">
      {/* Brand */}
      <div
        onClick={() => navigate('/home')}
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-md bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-bold text-sm transition-colors">
          S
        </div>
        <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          StyleSphere
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Weather chip */}
        <button
          onClick={() => navigate('/daily-fit')}
          className="flex items-center gap-1.5 min-h-[44px] bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 px-3 py-2 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-700 transition-colors"
          title={weather.city ? `${weather.city} · ${weather.temp}°C ${weather.condition}` : 'Check Weather & Recommendations'}
        >
          {isWeatherLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600 dark:text-zinc-400" />
              <span className="text-xs">Updating...</span>
            </>
          ) : weather.city && weatherStatus === 'available' ? (
            <>
              <span className="text-sm">{getWeatherEmoji(weather.icon)}</span>
              <span className="font-semibold">{weather.temp}°C</span>
            </>
          ) : (
            <>
              <span>🌤️</span>
              <span className="text-xs">Weather</span>
            </>
          )}
        </button>

        {/* Search */}
        <button
          onClick={() => navigate('/explore')}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Explore and Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100 ring-2 ring-white dark:ring-[#18181B]" />
          )}
        </button>
      </div>
    </header>
  );
};
