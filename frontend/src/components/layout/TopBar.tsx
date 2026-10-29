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
    <header className="lg:hidden sticky top-0 z-30 bg-[#F7F4EE]/95 dark:bg-[#171715]/95 backdrop-blur-md border-b border-[#E5DED3] dark:border-[#393832] px-4 py-3 flex items-center justify-between transition-colors">
      {/* Brand */}
      <div
        onClick={() => navigate('/home')}
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-xl bg-[#25211E] dark:bg-[#22221F] border border-[#C3A36B]/30 flex items-center justify-center text-[#F7F4EE] dark:text-[#F4F0E8] font-serif font-bold text-sm shadow-subtle group-hover:bg-[#C3A36B] transition-colors">
          S
        </div>
        <span className="font-serif text-lg font-bold tracking-tight text-[#25211E] dark:text-[#F4F0E8]">
          StyleSphere
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Weather chip */}
        <button
          onClick={() => navigate('/daily-fit')}
          className="flex items-center gap-1.5 bg-[#FFFFFF] dark:bg-[#22221F] hover:bg-[#EFE9DF] dark:hover:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] px-2.5 py-1.5 rounded-full text-xs font-medium border border-[#E5DED3] dark:border-[#393832] shadow-subtle transition-colors"
          title={weather.city ? `${weather.city} · ${weather.temp}°C ${weather.condition}` : 'Check Weather & Recommendations'}
        >
          {isWeatherLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#96633B]" />
              <span className="text-[11px]">Updating...</span>
            </>
          ) : weather.city && weatherStatus === 'available' ? (
            <>
              <span className="text-sm">{getWeatherEmoji(weather.icon)}</span>
              <span className="font-semibold">{weather.temp}°C</span>
            </>
          ) : (
            <>
              <span>🌤️</span>
              <span className="text-[11px]">Weather</span>
            </>
          )}
        </button>

        {/* Search */}
        <button
          onClick={() => navigate('/explore')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] hover:bg-[#EFE9DF]/60 dark:hover:bg-[#2A2A26] transition-colors"
          aria-label="Explore and Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-9 h-9 rounded-xl flex items-center justify-center text-[#82796F] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] hover:bg-[#EFE9DF]/60 dark:hover:bg-[#2A2A26] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#C3A36B] dark:bg-[#D1B47A] ring-2 ring-[#F7F4EE] dark:ring-[#171715]" />
          )}
        </button>
      </div>
    </header>
  );
};
