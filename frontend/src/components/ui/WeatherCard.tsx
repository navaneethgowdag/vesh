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
        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-md">
          <Loader2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400 animate-spin" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Updating Weather...</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">Checking Open-Meteo...</p>
          </div>
        </div>
      );
    }

    if (weatherStatus === 'available' && weather.city) {
      return (
        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-md">
          <span className="text-2xl" role="img" aria-label="weather icon">
            {getWeatherEmoji(weather.icon)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
              <span>{weather.temp}°C</span>
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 truncate">· {weather.condition}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              {isLiveLocation ? (
                <Navigation className="w-3 h-3 text-emerald-600 animate-pulse" />
              ) : (
                <MapPin className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
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
        className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 rounded-md cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <SunMedium className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Check Weather</p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            {selectedCity ? `Fetch for ${selectedCity}` : 'Tap to fetch live climate'}
          </p>
        </div>
      </div>
    );
  }

  // Full Weather Card
  return (
    <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 transition-colors">
      {/* City Switcher & GPS Controls Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 min-h-[36px] text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {isLiveLocation ? (
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            )}
            <span className="max-w-[140px] sm:max-w-none truncate">
              {displayLocation}{weather.country ? `, ${weather.country}` : ''}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 p-2 z-30 space-y-2 shadow-lg">
              {/* GPS Option */}
              <button
                type="button"
                onClick={() => {
                  handleToggleGps();
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold text-left transition-colors ${
                  isLiveLocation
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isLiveLocation ? 'text-emerald-600 animate-pulse' : 'text-zinc-500 dark:text-zinc-400'}`} />
                <span>{isLiveLocation ? 'Live GPS Active' : 'Enable Live GPS Location'}</span>
              </button>

              {/* Custom City Search Input */}
              <form onSubmit={handleCustomCitySubmit} className="relative">
                <input
                  type="text"
                  placeholder="Type city name..."
                  value={searchCityInput}
                  onChange={(e) => setSearchCityInput(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded pl-8 pr-3 py-2 text-base sm:text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                />
                <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-2.5 top-3" />
              </form>

              {/* Popular Curated Fashion Capitals */}
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 px-2 py-1">
                  Fashion Capitals
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleSelectCity(city)}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                        !isLiveLocation && city === selectedCity
                          ? 'text-zinc-900 dark:text-zinc-100 font-bold bg-zinc-100 dark:bg-zinc-800'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
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
            className={`flex items-center gap-1.5 px-2.5 py-1 min-h-[36px] rounded text-xs font-semibold transition-all border ${
              isLiveLocation
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-500/20'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {isTogglingGps ? (
              <Loader2 className="w-3 h-3 animate-spin text-zinc-500 dark:text-zinc-400" />
            ) : isLiveLocation ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <Navigation className="w-3 h-3 text-emerald-600" />
                <span>Live GPS</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
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
              className="p-2 min-h-[36px] min-w-[36px] rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isWeatherLoading ? 'animate-spin text-zinc-900 dark:text-zinc-100' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isWeatherLoading && (
        <div className="py-8 text-center">
          <Loader2 className="w-7 h-7 text-zinc-700 dark:text-zinc-300 animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
            Contacting Open-Meteo...
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Fetching atmospheric data for {displayLocation}
          </p>
        </div>
      )}

      {/* Permission Denied State */}
      {!isWeatherLoading && weatherStatus === 'permission_denied' && (
        <div className="py-5 px-3 text-center bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-md mb-2">
          <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">Location Permission Denied</h4>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 mb-3">
            Browser location access was blocked. You can pick any fashion capital manually.
          </p>
          <button
            type="button"
            onClick={() => setDropdownOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded hover:opacity-90 transition-opacity"
          >
            Select City
          </button>
        </div>
      )}

      {/* Provider Unavailable Error State */}
      {!isWeatherLoading && weatherStatus === 'provider_unavailable' && (
        <div className="py-5 px-3 text-center bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 rounded-md mb-2">
          <AlertCircle className="w-5 h-5 text-red-700 dark:text-red-400 mx-auto mb-2" />
          <h4 className="text-xs font-bold text-red-900 dark:text-red-200">Weather Service Unavailable</h4>
          <p className="text-xs text-red-800 dark:text-red-300 mt-1 mb-3">
            {weatherError || 'Could not connect to Open-Meteo climate provider.'}
          </p>
          <button
            type="button"
            onClick={handleCheckWeather}
            className="px-3.5 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded hover:opacity-90 transition-opacity"
          >
            Retry Weather
          </button>
        </div>
      )}

      {/* Idle State — User has not requested weather yet */}
      {!isWeatherLoading && weatherStatus === 'idle' && (
        <div className="text-center py-7 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800">
          <div className="w-10 h-10 mx-auto rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mb-2.5">
            <SunMedium className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
            Climate-Aware Styling
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 mb-4 max-w-[260px] mx-auto leading-relaxed">
            Check current temperature and weather conditions to adapt your outfit recommendations.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleCheckWeather}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <SunMedium className="w-3.5 h-3.5" />
              <span>Check Weather</span>
            </button>
            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="px-3.5 py-2 min-h-[40px] rounded text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 transition-colors"
            >
              Change City
            </button>
          </div>
        </div>
      )}

      {/* Location Unavailable State */}
      {!isWeatherLoading && weatherStatus === 'location_unavailable' && (
        <div className="text-center py-7 px-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800">
          <div className="w-10 h-10 mx-auto rounded-md bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mb-2.5">
            <MapPin className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </div>
          <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
            Location Not Set
          </h4>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 mb-4 max-w-[260px] mx-auto leading-relaxed">
            Select a city or enable GPS to fetch live climate data and generate matching outfits.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleToggleGps}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Enable GPS</span>
            </button>
            <button
              type="button"
              onClick={() => setDropdownOpen(true)}
              className="px-3.5 py-2 min-h-[40px] rounded text-xs font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 transition-colors"
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
                <span className="text-3xl" role="img" aria-label="weather icon">
                  {getWeatherEmoji(weather.icon)}
                </span>
                <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {weather.temp}°C
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{weather.condition}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">Feels like {weather.feelsLike}°C</p>
            </div>

            <div className="text-right">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                H: {weather.highTemp}° · L: {weather.lowTemp}°
              </div>
              <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium mt-1">
                UV Index: {weather.uvIndex}
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded">
              <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Humidity {weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded">
              <Wind className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Wind {weather.windSpeed} km/h</span>
            </div>
          </div>

          {weather.summary && (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 italic leading-snug">
              &ldquo;{weather.summary}&rdquo;
            </p>
          )}
        </>
      )}
    </div>
  );
};
