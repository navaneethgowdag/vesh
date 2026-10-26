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
      colors: ['#A8764B', '#DCBDA1', '#1C1B1A', '#FAF7F2'],
    });
    setTimeout(() => setWornAnim(false), 2000);
  };

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-cream-50 via-sand-50 to-sand-100/90 border border-sand-300/80 rounded-3xl p-5 sm:p-6 shadow-soft transition-all duration-300 hover:shadow-soft-lg mb-8">
        {/* Subtle decorative watermark */}
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-36 h-36 bg-cognac-100/40 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cognac-600 text-cream-50 rounded-xl shadow-soft-sm">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-400">
                Today's Fit
              </h2>
              <p className="text-xs font-semibold text-charcoal-800">
                {weather.city ? `${weather.temp}°C · ` : ''}{dailyFit.outfit.occasion} · {dailyFit.outfit.style}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWhyModalOpen(true)}
              className="text-xs text-charcoal-500 hover:text-charcoal-900 flex items-center gap-1 font-medium bg-cream-50/80 px-2.5 py-1 rounded-full border border-sand-200"
            >
              <Info className="w-3.5 h-3.5 text-cognac-600" />
              <span className="hidden sm:inline">Why this fit?</span>
            </button>
            <span className="text-xs font-bold text-cognac-800 bg-cognac-100/80 px-2.5 py-1 rounded-full border border-cognac-200">
              {dailyFit.score}% Match
            </span>
          </div>
        </div>

        {/* Content Columns: Visual on Left/Right & Piece List */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          {/* Piece List */}
          <div className="sm:col-span-7 space-y-2">
            {dailyFit.outfit.pieces.map((piece) => (
              <div
                key={piece.id}
                onClick={() => navigate(`/wardrobe/${piece.id}`)}
                className="flex items-center gap-3 p-2 rounded-2xl bg-cream-50/70 border border-sand-200/60 hover:bg-cream-50 transition-colors cursor-pointer group"
              >
                <img
                  src={piece.image}
                  alt={piece.name}
                  className="w-10 h-10 rounded-xl object-cover shadow-sm flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cognac-700">
                    {piece.category}
                  </p>
                  <p className="text-xs font-semibold text-charcoal-900 truncate group-hover:text-cognac-800">
                    {piece.name}
                  </p>
                </div>
                <span className="text-[10px] text-charcoal-400 bg-sand-100 px-2 py-0.5 rounded-full">
                  {piece.color}
                </span>
              </div>
            ))}
          </div>

          {/* Outfit Hero Imagery Thumbnail */}
          <div className="sm:col-span-5 relative group cursor-pointer" onClick={() => navigate('/daily-fit')}>
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] shadow-soft border border-sand-200">
              <img
                src={dailyFit.outfit.image}
                alt={dailyFit.outfit.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent flex flex-col justify-end p-3.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cognac-300">
                  AI Atelier Pick
                </span>
                <p className="text-white font-serif text-sm font-bold line-clamp-1">
                  {dailyFit.outfit.title}
                </p>
                <span className="text-cream-200 text-[11px] flex items-center gap-1 mt-0.5">
                  View full breakdown <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-sand-200/80">
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
            className="text-xs font-semibold text-cognac-700 hover:text-cognac-900 flex items-center gap-1 ml-auto"
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

