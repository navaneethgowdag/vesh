import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Search, Compass, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WeatherCard } from '../ui/WeatherCard';
import { Button } from '../ui/Button';

export const RightSidebar: React.FC = () => {
  const { dailyFit } = useApp();
  const navigate = useNavigate();

  return (
    <aside className="hidden xl:flex flex-col w-80 2xl:w-96 h-screen sticky top-0 p-6 overflow-y-auto space-y-6 select-none border-l border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#1A151C] transition-colors">
      {/* Weather Widget */}
      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6D7068] dark:text-[#A89E9B] mb-2.5 font-mono">
          Atmospheric Context
        </h4>
        <WeatherCard />
      </div>

      {/* Daily Fit Highlight Teaser */}
      {dailyFit && (
        <div className="bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-[2px] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0]">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#29202B] dark:text-[#F3EEE8] font-mono">
                Daily Curation
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-[#743C49] dark:text-[#D5A6A0] bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] px-2 py-0.5 rounded-[2px]">
              {dailyFit.score}% Match
            </span>
          </div>

          <p className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] line-clamp-1 mb-1">
            {dailyFit.outfit?.title || 'Calibrated Editorial Fit'}
          </p>
          <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] line-clamp-2 mb-3 font-sans">
            {dailyFit.explanation?.weatherMatch || dailyFit.explanation?.styleMatch || dailyFit.outfit?.description || 'Composed specifically for today’s temperature and occasion profile.'}
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate('/daily-fit')}
            className="w-full text-xs min-h-[38px] uppercase tracking-[0.12em]"
          >
            Inspect Ensemble →
          </Button>
        </div>
      )}

      {/* Intentional Discovery Search Card (replaces intrusive follow suggestions) */}
      <div className="bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
            <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6D7068] dark:text-[#A89E9B] font-mono">
              Search Tastemakers
            </h4>
          </div>
        </div>

        <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] leading-relaxed font-sans">
          Discover other members and style curators through intentional search.
        </p>

        <button
          onClick={() => navigate('/discover')}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-[2px] bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49] dark:hover:border-[#D5A6A0] text-xs font-sans text-[#6D7068] dark:text-[#A89E9B] transition-colors cursor-pointer group"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#6D7068] dark:text-[#A89E9B]" />
            <span>Search people...</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </aside>
  );
};
