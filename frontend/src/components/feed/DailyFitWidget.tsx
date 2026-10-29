import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, Check, ArrowRight, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { WhyThisOutfitModal } from '../recommendation/WhyThisOutfitModal';

export const DailyFitWidget: React.FC = () => {
  const { dailyFit, weather, wearDailyFit, cycleDailyFit } = useApp();
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [wornAnim, setWornAnim] = useState(false);
  const navigate = useNavigate();

  if (!dailyFit) return null;

  const handleWearThis = () => {
    wearDailyFit();
    setWornAnim(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#18181B', '#71717A', '#E4E4E7'],
    });
    setTimeout(() => setWornAnim(false), 2000);
  };

  return (
    <>
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-5 sm:p-6 mb-7 transition-colors">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Today's Fit
              </h2>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {weather.city ? `${weather.temp}°C · ` : ''}{dailyFit.outfit.occasion} · {dailyFit.outfit.style}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhyModalOpen(true)}
              className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 font-medium bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 min-h-[36px]"
            >
              <Info className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="hidden sm:inline">Why this fit?</span>
            </button>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 min-h-[36px] flex items-center">
              {dailyFit.score}% Match
            </span>
          </div>
        </div>

        {/* Content Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          {/* Piece List */}
          <div className="sm:col-span-7 space-y-2">
            {dailyFit.outfit.pieces.map((piece) => (
              <div
                key={piece.id}
                onClick={() => navigate(`/wardrobe/${piece.id}`)}
                className="flex items-center gap-3 p-2 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
              >
                <img
                  src={piece.image}
                  alt={piece.name}
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {piece.category}
                  </p>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                    {piece.name}
                  </p>
                </div>
                <span className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-200/80 dark:bg-zinc-700/80 px-2 py-0.5 rounded">
                  {piece.color}
                </span>
              </div>
            ))}
          </div>

          {/* Outfit Hero Imagery Thumbnail */}
          <div className="sm:col-span-5 relative group cursor-pointer" onClick={() => navigate('/daily-fit')}>
            <div className="relative rounded-md overflow-hidden aspect-[4/5] border border-zinc-200 dark:border-zinc-800">
              <img
                src={dailyFit.outfit.image}
                alt={dailyFit.outfit.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-300">
                  AI Atelier Pick
                </span>
                <p className="text-white text-sm font-bold line-clamp-1">
                  {dailyFit.outfit.title}
                </p>
                <span className="text-zinc-300 text-xs flex items-center gap-1 mt-0.5">
                  View full breakdown <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleWearThis}
              className={wornAnim ? 'bg-emerald-700' : ''}
              icon={wornAnim ? <Check className="w-3.5 h-3.5 text-white" /> : undefined}
            >
              {wornAnim ? 'Logged as Worn!' : 'Wear This'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={cycleDailyFit}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Try Another
            </Button>
          </div>

          <button
            onClick={() => navigate('/daily-fit')}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 ml-auto min-h-[36px]"
          >
            <span>Open Dedicated Stylist</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <WhyThisOutfitModal
        isOpen={whyModalOpen}
        onClose={() => setWhyModalOpen(false)}
        recommendation={dailyFit}
      />
    </>
  );
};
