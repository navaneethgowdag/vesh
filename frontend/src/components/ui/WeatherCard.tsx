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
    selectedCity,
    setSelectedCity,
    isLiveLocation,
    toggleLiveLocation,
    isWeatherLoading,
    weatherError,
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
      setSelectedCity(searchCityInput.trim());
      setSearchCityInput('');
      setDropdownOpen(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-sand-100/80 border border-sand-200/80 px-3.5 py-2 rounded-2xl">
        <span className="text-2xl" role="img" aria-label="weather icon">
          {getWeatherEmoji(weather.icon)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold text-charcoal-900 text-sm">
            <span>{weather.temp}°C</span>
            <span className="text-xs font-normal text-charcoal-500 truncate">· {weather.condition}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-charcoal-400">
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
    <div className="relative bg-gradient-to-br from-cream-50 via-sand-50 to-sand-100/70 border border-sand-200/90 rounded-3xl p-5 shadow-soft">
      {/* City Switcher & GPS Controls Header */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal-600 hover:text-charcoal-900 transition-colors"
          >
            {isLiveLocation ? (
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-cognac-600" />
            )}
            <span className="max-w-[140px] sm:max-w-none truncate">
              {weather.city || selectedCity}{weather.country ? `, ${weather.country}` : ''}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-charcoal-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-cream-50 rounded-2xl shadow-soft-xl border border-sand-200 p-2 z-30 space-y-2">
              {/* GPS Option */}
              <button
                type="button"
                onClick={() => {
                  handleToggleGps();
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors ${
                  isLiveLocation
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-sand-100 text-charcoal-700 hover:bg-sand-200'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${isLiveLocation ? 'text-emerald-600 animate-pulse' : 'text-charcoal-500'}`} />
                <span>{isLiveLocation ? 'Live GPS Active (Click to disable)' : 'Enable Live GPS Location'}</span>
              </button>

              {/* Custom City Search Input */}
              <form onSubmit={handleCustomCitySubmit} className="relative">
                <input
                  type="text"
                  placeholder="Type any city name..."
                  value={searchCityInput}
                  onChange={(e) => setSearchCityInput(e.target.value)}
                  className="w-full bg-cream-100 border border-sand-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-charcoal-900 focus:outline-none focus:ring-1 focus:ring-cognac-600"
                />
                <Search className="w-3.5 h-3.5 text-charcoal-400 absolute left-2.5 top-2.5" />
              </form>

              {/* Popular Curated Fashion Capitals */}
              <div className="pt-1 border-t border-sand-200">
                <p className="text-[10px] uppercase font-bold text-charcoal-400 px-2 py-1">
                  Fashion Capitals
                </p>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {cities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        if (isLiveLocation) {
                          toggleLiveLocation(false);
                        }
                        setSelectedCity(city);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        !isLiveLocation && city === selectedCity
                          ? 'text-cognac-700 font-bold bg-sand-200'
                          : 'text-charcoal-700 hover:bg-sand-100'
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

        {/* Live GPS / Climate Status Indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleGps}
            disabled={isTogglingGps || isWeatherLoading}
            title={isLiveLocation ? 'Click to disable live GPS location' : 'Click to enable live GPS location'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shadow-soft-xs border ${
              isLiveLocation
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20'
                : 'bg-sand-200/80 text-charcoal-600 border-sand-300 hover:bg-sand-300'
            }`}
          >
            {isTogglingGps || isWeatherLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-charcoal-500" />
            ) : isLiveLocation ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <Navigation className="w-3 h-3 text-emerald-600" />
                <span>Live GPS</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-charcoal-400" />
                <span>Enable GPS</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Temperature & Condition */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-4xl" role="img" aria-label="weather icon">
              {getWeatherEmoji(weather.icon)}
            </span>
            <span className="text-4xl font-serif font-bold text-charcoal-900">
              {weather.temp}°C
            </span>
          </div>
          <p className="text-sm font-medium text-charcoal-800 mt-1">{weather.condition}</p>
          <p className="text-xs text-charcoal-500">Feels like {weather.feelsLike}°C</p>
        </div>

        <div className="text-right">
          <div className="text-xs text-charcoal-500">H: {weather.highTemp}° · L: {weather.lowTemp}°</div>
          <div className="text-[11px] text-cognac-700 font-medium mt-1">UV Index: {weather.uvIndex}</div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-sand-200/70 text-xs text-charcoal-600">
        <div className="flex items-center gap-2 bg-cream-50/70 p-2 rounded-xl">
          <Droplets className="w-3.5 h-3.5 text-sky-600" />
          <span>Humidity {weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-2 bg-cream-50/70 p-2 rounded-xl">
          <Wind className="w-3.5 h-3.5 text-teal-600" />
          <span>Wind {weather.windSpeed} km/h</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-charcoal-500 italic leading-snug">
        "{weather.summary}"
      </p>
    </div>
  );
};
