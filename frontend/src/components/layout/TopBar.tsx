import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun,
  Moon,
  Bell,
  Loader2,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Cloud,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

const renderWeatherIcon = (iconName: string) => {
  const iconClass = "w-3.5 h-3.5 text-[#727D69] dark:text-[#9EAB97]";
  if (iconName === 'sun') return <Sun className={iconClass} />;
  if (iconName === 'cloud-sun') return <CloudSun className={iconClass} />;
  if (iconName === 'cloud-rain') return <CloudRain className={iconClass} />;
  if (iconName === 'cloud-snow') return <CloudSnow className={iconClass} />;
  if (iconName === 'cloud-lightning') return <CloudLightning className={iconClass} />;
  if (iconName === 'cloud') return <Cloud className={iconClass} />;
  return <CloudSun className={iconClass} />;
};

export const TopBar: React.FC = () => {
  const { unreadNotifsCount, weather, weatherStatus, isWeatherLoading } = useApp();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-[#1A1D1A]/95 backdrop-blur-md border-b border-[#E2DDD3] dark:border-[#2D342F] px-4 py-2.5 flex items-center justify-between transition-colors">
      {/* Brand */}
      <div
        onClick={() => navigate('/home')}
        className="flex items-center gap-2.5 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-lg bg-[#202321] dark:bg-[#F8F6F1] flex items-center justify-center text-[#F8F6F1] dark:text-[#202321] font-serif font-bold text-sm transition-transform group-hover:scale-105 shadow-sm">
          T
        </div>
        <span className="text-lg font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1] font-serif">
          TailorBird
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Weather chip */}
        <button
          onClick={() => navigate('/daily-fit')}
          className="flex items-center gap-1.5 min-h-[38px] bg-[#F8F6F1] dark:bg-[#252A26] hover:bg-[#EFECE4] dark:hover:bg-[#2F3630] text-[#202321] dark:text-[#F8F6F1] px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#E2DDD3] dark:border-[#2D342F] transition-colors cursor-pointer"
          title={weather.city ? `${weather.city} · ${weather.temp}°C ${weather.condition}` : 'Check Weather & Recommendations'}
        >
          {isWeatherLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#777C75] dark:text-[#A3ABA0]" />
              <span className="text-[11px] font-mono">Syncing...</span>
            </>
          ) : weather.city && weatherStatus === 'available' ? (
            <>
              {renderWeatherIcon(weather.icon)}
              <span className="font-mono font-semibold text-xs">{weather.temp}°C</span>
            </>
          ) : (
            <>
              <CloudSun className="w-3.5 h-3.5 text-[#727D69]" />
              <span className="text-[11px] font-mono">Weather</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] transition-colors cursor-pointer"
          aria-label="Toggle Theme"
        >
          {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#1A1D1A]" />
          )}
        </button>

        {/* Profile */}
        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] transition-colors cursor-pointer"
          aria-label="Profile"
        >
          <User className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
