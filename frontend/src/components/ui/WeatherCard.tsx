import React, { useState } from 'react';
import {
  Wind,
  Droplets,
  MapPin,
  ChevronDown,
  Navigation,
  Radio,
  Search,
  Loader2,
  RefreshCw,
  SunMedium,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { weatherService } from '../../services/weather';

interface WeatherCardProps {
  compact?: boolean;
}

const getWeatherEmoji = (icon: string) => {
  if (icon === 'sun') return '☀️';
  if (icon === 'cloud-sun') return '⛅';
  if (icon === 'cloud-rain') return '🌧️';
  if (icon === 'cloud-snow') return '❄️';
  if (icon === 'cloud-lightning') return '⛈️';
  if (icon === 'cloud') return '☁️';
  return icon || '⛅';
};

export const WeatherCard: React.FC<WeatherCardProps> = ({ compact = false }) => {
  const {
    weather,
    weatherStatus,
    selectedCity,
    setSelectedCity,
    isLiveLocation,
    toggleLiveLocation,
    isWeatherLoading,
    weatherError,
    requestWeather,
  } = useApp();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchCityInput, setSearchCityInput] = useState('');
  const [isTogglingGps, setIsTogglingGps] = useState(false);
  const cities = weatherService.getAllCities();

  const handleToggleGps = async () => {
    setIsTogglingGps(true);
    try {
      await toggleLiveLocation();
    } finally {
      setIsTogglingGps(false);
    }
  };

  const handleCustomCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchCityInput.trim()) {
      if (isLiveLocation) {
        toggleLiveLocation(false);
      }
      const city = searchCityInput.trim();
      setSelectedCity(city);
      setSearchCityInput('');
      setDropdownOpen(false);
      requestWeather({ force: true, city });
    }
  };

  const handleSelectCity = (city: string) => {
    if (isLiveLocation) {
      toggleLiveLocation(false);
    }
    setSelectedCity(city);
    setDropdownOpen(false);
    requestWeather({ force: true, city });
  };

  const handleCheckWeather = () => {
    requestWeather({ force: true });
  };

  const displayLocation = weather.city || selectedCity || 'Choose Location';

  // Compact variant (e.g. used in headers or sidebars)
  if (compact) {
    if (isWeatherLoading) {
      return (
        <div className="flex items-center gap-3 bg-sand-100/80 dark:bg-[#1E1E1C] border border-sand-200/80 dark:border-[#33322E] px-3.5 py-2 rounded-2xl">
          <Loader2 className="w-4 h-4 text-cognac-600 dark:text-[#C3A36B] animate-spin" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-charcoal-900 dark:text-[#F4F0E8]">Updating Weather...</p>
            <p className="text-[10px] text-charcoal-500 dark:text-[#82796F] truncate">Checking Open-Meteo...</p>
          </div>
        </div>
      );
    }

    if (weatherStatus === 'available' && weather.city) {
      return (
        <div className="flex items-center gap-3 bg-sand-100/80 dark:bg-[#1E1E1C] border border-sand-200/80 dark:border-[#33322E] px-3.5 py-2 rounded-2xl">
          <span className="text-2xl" role="img" aria-label="weather icon">
            {getWeatherEmoji(weather.icon)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold text-charcoal-900 dark:text-[#F4F0E8] text-sm">
              <span>{weather.temp}°C</span>
              <span className="text-xs font-normal text-charcoal-500 dark:text-[#82796F] truncate">· {weather.condition}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-charcoal-400 dark:text-[#82796F]">
              {isLiveLocation ? (
                <Navigation className="w-3 h-3 text-emerald-600 animate-pulse" />
              ) : (
                <MapPin className="w-3 h-3 text-cognac-600" />
              )}
              <span className="truncate">{weather.city || selectedCity}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={handleCheckWeather}
        className="flex items-center gap-3 bg-sand-100/80 dark:bg-[#1E1E1C] border border-sand-200/80 dark:border-[#33322E] px-3.5 py-2 rounded-2xl cursor-pointer hover:bg-sand-200/70 dark:hover:bg-[#2A2A26] transition-colors"
      >
        <SunMedium className="w-4 h-4 text-cognac-600 dark:text-[#C3A36B]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-charcoal-900 dark:text-[#F4F0E8]">Check Weather</p>
          <p className="text-[10px] text-charcoal-500 dark:text-[#82796F] truncate">
            {selectedCity ? `Fetch for ${selectedCity}` : 'Tap to fetch live climate'}
          </p>
        </div>
      </div>
    );
  }

  // Full Weather Card
  return (
    <div className="relative bg-[#FFFFFF] dark:bg-[#1E1E1C] border border-[#E5DED3] dark:border-[#393832] rounded-3xl p-5 shadow-soft transition-colors">
      {/* City Switcher & GPS Controls Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#544D45] dark:text-[#B2AA9E] hover:text-[#25211E] dark:hover:text-[#F4F0E8] transition-colors"
          >
            {isLiveLocation ? (
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-cognac-600 dark:text-[#C3A36B]" />
            )}
            <span className="max-w-[140px] sm:max-w-none truncate">
              {displayLocation}{weather.country ? `, ${weather.country}` : ''}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#82796F]" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-[#FFFFFF] dark:bg-[#22221F] rounded-2xl shadow-soft-xl border border-[#E5DED3] dark:border-[#393832] p-2 z-30 space-y-2">
              {/* GPS Option */}
              <button
                type="button"
                onClick={() => {
                  handleToggleGps();
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                  isLiveLocation
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-[#F7F4EE] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] hover:bg-[#EFE9DF] dark:hover:bg-[#33322E]'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isLiveLocation ? 'text-emerald-600 animate-pulse' : 'text-[#82796F]'}`} />
                <span>{isLiveLocation ? 'Live GPS Active' : 'Enable Live GPS Location'}</span>
              </button>

              {/* Custom City Search Input */}
              <form onSubmit={handleCustomCitySubmit} className="relative">
                <input
                  type="text"
                  placeholder="Type city name..."
                  value={searchCityInput}
                  onChange={(e) => setSearchCityInput(e.target.value)}
                  className="w-full bg-[#F7F4EE] dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#25211E] dark:text-[#F4F0E8] focus:outline-none focus:ring-1 focus:ring-[#C3A36B]"
                />
                <Search className="w-3.5 h-3.5 text-[#82796F] absolute left-2.5 top-2.5" />
              </form>

              {/* Popular Curated Fashion Capitals */}
              <div className="pt-1 border-t border-[#E5DED3] dark:border-[#393832]">
                <p className="text-[10px] uppercase font-bold text-[#82796F] dark:text-[#7E786E] px-2 py-1">
                  Fashion Capitals
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCity(city)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        !isLiveLocation && city === selectedCity
                          ? 'text-[#C3A36B] dark:text-[#D1B47A] font-bold bg-[#FAF8F5] dark:bg-[#2A2A26]'
                          : 'text-[#25211E] dark:text-[#F4F0E8] hover:bg-[#F7F4EE] dark:hover:bg-[#2A2A26]'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live GPS / Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleGps}
            disabled={isTogglingGps || isWeatherLoading}
            title={isLiveLocation ? 'Click to disable live GPS' : 'Click to enable live GPS'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shadow-soft-xs border ${
              isLiveLocation
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-500/20'
                : 'bg-[#F7F4EE] dark:bg-[#2A2A26] text-[#544D45] dark:text-[#B2AA9E] border-[#E5DED3] dark:border-[#393832] hover:bg-[#EFE9DF] dark:hover:bg-[#33322E]'
            }`}
          >
            {isTogglingGps ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#82796F]" />
            ) : isLiveLocation ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <Navigation className="w-3 h-3 text-emerald-600" />
                <span>Live GPS</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-[#82796F]" />
                <span>GPS</span>
              </>
            )}
          </button>

          {weatherStatus === 'available' && (
            <button
              type="button"
              onClick={handleCheckWeather}
              disabled={isWeatherLoading}
              title="Refresh weather"
              className="p-1.5 rounded-full bg-[#F7F4EE] dark:bg-[#2A2A26] border border-[#E5DED3] dark:border-[#393832] text-[#82796F] hover:text-[#25211E] dark:hover:text-[#F4F0E8] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isWeatherLoading ? 'animate-spin text-[#C3A36B]' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isWeatherLoading && (
        <div className="py-8 text-center">
          <Loader2 className="w-7 h-7 text-[#C3A36B] dark:text-[#D1B47A] animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium text-[#25211E] dark:text-[#F4F0E8]">
            Contacting Open-Meteo...
          </p>
          <p className="text-[11px] text-[#82796F] dark:text-[#B2AA9E] mt-0.5">
            Fetching atmospheric data for {displayLocation}
          </p>
        </div>
      )}

      {/* Permission Denied State */}
      {!isWeatherLoading && weatherStatus === 'permission_denied' && (
        <div className="py-6 px-3 text-center bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/20 rounded-2xl mb-2">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">Location Permission Denied</h4>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-1 mb-3">
            Browser location access was blocked. You can pick any fashion capital manually.
          </p>
          <button
            type="button"
            onClick={() => setDropdownOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] rounded-xl hover:opacity-90 transition-opacity"
          >
            Select City
          </button>
        </div>
      )}

      {/* Provider Unavailable Error State */}
      {!isWeatherLoading && weatherStatus === 'provider_unavailable' && (
        <div className="py-6 px-3 text-center bg-red-500/10 dark:bg-red-950/20 border border-red-500/20 rounded-2xl mb-2">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-red-900 dark:text-red-300">Weather Service Unavailable</h4>
          <p className="text-[11px] text-red-800/80 dark:text-red-400/80 mt-1 mb-3">
            {weatherError || 'Could not connect to Open-Meteo climate provider.'}
          </p>
          <button
            type="button"
            onClick={handleCheckWeather}
            className="px-3 py-1.5 text-xs font-semibold bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] rounded-xl hover:opacity-90 transition-opacity"
          >
            Retry Weather
          </button>
        </div>
      )}

      {/* Idle State — User has not requested weather yet */}
      {!isWeatherLoading && weatherStatus === 'idle' && (
        <div className="text-center py-7 px-3 bg-[#FAF8F5] dark:bg-[#22221F] rounded-2xl border border-dashed border-[#E5DED3] dark:border-[#393832]">
          <div className="w-10 h-10 mx-auto rounded-full bg-[#EFE9DF] dark:bg-[#2A2A26] flex items-center justify-center mb-2.5">
            <SunMedium className="w-5 h-5 text-[#C3A36B] dark:text-[#D1B47A]" />
          </div>
          <h4 className="font-serif font-bold text-sm text-[#25211E] dark:text-[#F4F0E8]">
            Climate-Aware Styling
          </h4>
          <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-1 mb-4 max-w-[260px] mx-auto leading-relaxed">
            Check current temperature and weather conditions to adapt your outfit recommendations.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCheckWeather}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] hover:bg-[#C3A36B] dark:hover:bg-[#D1B47A] transition-colors shadow-subtle"
            >
              <SunMedium className="w-3.5 h-3.5" />
              <span>Check Weather</span>
            </button>
            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#EFE9DF] dark:bg-[#2A2A26] hover:bg-[#E5DED3] text-[#25211E] dark:text-[#F4F0E8] transition-colors"
            >
              Change City
            </button>
          </div>
        </div>
      )}

      {/* Location Unavailable State */}
      {!isWeatherLoading && weatherStatus === 'location_unavailable' && (
        <div className="text-center py-7 px-3 bg-[#FAF8F5] dark:bg-[#22221F] rounded-2xl border border-dashed border-[#E5DED3] dark:border-[#393832]">
          <div className="w-10 h-10 mx-auto rounded-full bg-[#EFE9DF] dark:bg-[#2A2A26] flex items-center justify-center mb-2.5">
            <MapPin className="w-5 h-5 text-[#C3A36B] dark:text-[#D1B47A]" />
          </div>
          <h4 className="font-serif font-bold text-sm text-[#25211E] dark:text-[#F4F0E8]">
            Location Not Set
          </h4>
          <p className="text-xs text-[#82796F] dark:text-[#B2AA9E] mt-1 mb-4 max-w-[260px] mx-auto leading-relaxed">
            Select a city or enable GPS to fetch live climate data and generate matching outfits.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleToggleGps}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#25211E] dark:bg-[#F4F0E8] text-[#F7F4EE] dark:text-[#171715] hover:bg-[#C3A36B] transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Enable GPS</span>
            </button>
            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#EFE9DF] dark:bg-[#2A2A26] text-[#25211E] dark:text-[#F4F0E8] transition-colors"
            >
              Select City
            </button>
          </div>
        </div>
      )}

      {/* Available State — Live Weather Loaded */}
      {!isWeatherLoading && weatherStatus === 'available' && weather.city && (
        <>
          {/* Main Temperature & Condition */}
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-4xl" role="img" aria-label="weather icon">
                  {getWeatherEmoji(weather.icon)}
                </span>
                <span className="text-4xl font-serif font-bold text-[#25211E] dark:text-[#F4F0E8]">
                  {weather.temp}°C
                </span>
              </div>
              <p className="text-sm font-medium text-[#25211E] dark:text-[#F4F0E8] mt-1">{weather.condition}</p>
              <p className="text-xs text-[#82796F] dark:text-[#B2AA9E]">Feels like {weather.feelsLike}°C</p>
            </div>

            <div className="text-right">
              <div className="text-xs text-[#82796F] dark:text-[#B2AA9E]">
                H: {weather.highTemp}° · L: {weather.lowTemp}°
              </div>
              <div className="text-[11px] text-[#C3A36B] dark:text-[#D1B47A] font-medium mt-1">
                UV Index: {weather.uvIndex}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#E5DED3] dark:border-[#393832] text-xs text-[#544D45] dark:text-[#B2AA9E]">
            <div className="flex items-center gap-2 bg-[#F7F4EE] dark:bg-[#2A2A26] p-2 rounded-xl">
              <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Humidity {weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-2 bg-[#F7F4EE] dark:bg-[#2A2A26] p-2 rounded-xl">
              <Wind className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Wind {weather.windSpeed} km/h</span>
            </div>
          </div>

          {weather.summary && (
            <p className="mt-3 text-[11px] text-[#82796F] dark:text-[#B2AA9E] italic leading-snug">
              &ldquo;{weather.summary}&rdquo;
            </p>
          )}
        </>
      )}
    </div>
  );
};
