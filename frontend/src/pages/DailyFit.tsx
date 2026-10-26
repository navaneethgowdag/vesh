import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  Bookmark,
  Share2,
  Info,
  CheckCircle,
  Calendar,
  Layers,
  Thermometer,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { StyleChip } from '../components/ui/StyleChip';
import { WeatherCard } from '../components/ui/WeatherCard';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { useApp } from '../context/AppContext';
import { Occasion, Post } from '../types';

const OCCASIONS: Occasion[] = [
  'Casual Daily',
  'Work & Office',
  'Date Night',
  'Weekend Outing',
  'Party & Evening',
  'Travel & Airport',
];

export const DailyFit: React.FC = () => {
  const {
    dailyFit,
    dailyFitHistory,
    weather,
    selectedOccasion,
    setSelectedOccasion,
    wearDailyFit,
    cycleDailyFit,
    showToast,
    currentUser,
    dailyFitError,
  } = useApp();

  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [wornSuccess, setWornSuccess] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const navigate = useNavigate();

  if (!dailyFit) {
    if (dailyFitError) {
      return (
        <AppShell>
          <div className="text-center py-16 px-6 bg-cream-50 rounded-3xl border border-sand-200 max-w-xl mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto mb-3">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-xl font-bold text-charcoal-900">
              Daily Fit Recommendation Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-charcoal-600 mt-2 max-w-md mx-auto">
              {dailyFitError}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="md"
                onClick={() => cycleDailyFit()}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Retry
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/wardrobe')}
              >
                Go to Wardrobe
              </Button>
            </div>
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell>
        <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
          <Sparkles className="w-8 h-8 text-cognac-600 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-bold text-charcoal-900">
            Curating your digital wardrobe...
          </h2>
          <p className="text-xs text-charcoal-500 mt-1">
            Add items to your wardrobe to generate AI recommendations.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/wardrobe')}
            className="mt-4"
          >
            Go to Wardrobe
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleWear = () => {
    wearDailyFit();
    setWornSuccess(true);
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#A8764B', '#1C1B1A', '#FAF7F2'],
    });
    setTimeout(() => setWornSuccess(false), 2500);
  };

  const handleSave = () => {
    showToast(`Saved "${dailyFit.outfit.title}" to your Saved Outfits!`, 'save');
  };

  // Convert outfit to pseudo post for sharing
  const shareablePost: Post = {
    id: dailyFit.outfit.id,
    user: {
      id: currentUser?.id || 'usr_me',
      name: currentUser?.name || 'My Style',
      username: currentUser?.username || 'me',
      avatar: currentUser?.avatar || '',
    },
    image: dailyFit.outfit.image || '',
    caption: `${dailyFit.outfit.title} · Curated by StyleSphere AI Atelier`,
    tags: dailyFit.outfit.tags,
    occasion: dailyFit.outfit.occasion,
    likesCount: 0,
    commentsCount: 0,
    savesCount: 0,
    isLiked: false,
    isSaved: false,
    createdAt: 'Today',
  };

  return (
    <AppShell showRightSidebar={true}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cognac-600 text-cream-50 rounded-xl shadow-soft">
              <Sparkles className="w-4 h-4" />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
              Your Daily Fit
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Real-time outfit synthesis based on your wardrobe, weather, and occasion.
          </p>
        </div>

        {/* Confidence Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-cognac-100 to-sand-200 border border-cognac-300 px-4 py-2 rounded-2xl w-max">
          <Sparkles className="w-4 h-4 text-cognac-700" />
          <div>
            <span className="block text-[10px] uppercase font-bold tracking-wider text-charcoal-500">
              Confidence Score
            </span>
            <span className="font-serif text-lg font-bold text-cognac-900 leading-none">
              {dailyFit.score}% Match
            </span>
          </div>
        </div>
      </div>

      {/* Occasion Selector Pill Row */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
          Select Occasion / Context
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {OCCASIONS.map((occ) => (
            <StyleChip
              key={occ}
              label={occ}
              selected={selectedOccasion === occ}
              onClick={() => setSelectedOccasion(occ)}
            />
          ))}
        </div>
      </div>

      {/* Main Stylist Visualization Canvas */}
      <div className="bg-cream-50 rounded-3xl border border-sand-200/90 shadow-soft overflow-hidden mb-8">
        {/* Top Context Strip */}
        <div className="bg-sand-100/80 px-6 py-3 border-b border-sand-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-charcoal-700">
            <span className="flex items-center gap-1 font-semibold">
              <Thermometer className="w-3.5 h-3.5 text-cognac-700" />
              {weather.city ? `${weather.city}: ${weather.temp}°C ${weather.condition}` : 'Location not set'}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cognac-700" />
              {dailyFit.outfit.occasion}
            </span>
            <span>·</span>
            <span className="font-medium text-cognac-800">{dailyFit.outfit.style}</span>
          </div>

          <button
            onClick={() => setWhyModalOpen(true)}
            className="flex items-center gap-1 text-cognac-700 hover:text-cognac-900 font-semibold cursor-pointer underline"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Why This Outfit?</span>
          </button>
        </div>

        {/* Canvas Body: Large Visualization + Individual Piece Breakdown */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Large Outfit Imagery */}
          <div className="lg:col-span-5 relative group">
            <div className="rounded-3xl overflow-hidden aspect-[3/4] shadow-soft-lg border border-sand-300 relative bg-sand-200">
              <img
                src={dailyFit.outfit.image}
                alt={dailyFit.outfit.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent flex flex-col justify-end p-5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-cognac-300">
                  Recommended Fit
                </span>
                <h3 className="font-serif text-lg font-bold text-white">
                  {dailyFit.outfit.title}
                </h3>
                <p className="text-xs text-cream-200 mt-1 line-clamp-2">
                  {dailyFit.outfit.description}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Individual Clothing Items */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-sand-200 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal-500">
                Individual Garments Assembled
              </h4>
              <span className="text-xs text-charcoal-400">
                {dailyFit.outfit.pieces.length} Pieces
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dailyFit.outfit.pieces.map((piece) => (
                <div
                  key={piece.id}
                  onClick={() => navigate(`/wardrobe/${piece.id}`)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-sand-50/80 border border-sand-200 hover:bg-cream-50 hover:border-sand-300 transition-all cursor-pointer group shadow-soft-sm"
                >
                  <img
                    src={piece.image}
                    alt={piece.name}
                    className="w-14 h-14 rounded-xl object-cover shadow-sm flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cognac-700">
                      {piece.category}
                    </span>
                    <p className="text-xs font-bold text-charcoal-900 truncate group-hover:text-cognac-800">
                      {piece.name}
                    </p>
                    <p className="text-[11px] text-charcoal-400">
                      {piece.color} · {piece.style}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Explanation Micro-Card */}
            <div className="p-4 rounded-2xl bg-sand-100/80 border border-sand-200/80 space-y-2 mt-4">
              <p className="text-xs font-bold text-charcoal-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cognac-600" />
                AI Stylist Rationale
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-charcoal-600">
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-cognac-600 flex-shrink-0 mt-0.5" />
                  <span>{weather.city ? `Thermal comfort for ${weather.temp}°C ${weather.condition}` : 'Thermal comfort calibrated for current season'}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-cognac-600 flex-shrink-0 mt-0.5" />
                  <span>Aligned with your {dailyFit.outfit.style} aesthetic</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-cognac-600 flex-shrink-0 mt-0.5" />
                  <span>Utilizes capsule rotation staples</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-cognac-600 flex-shrink-0 mt-0.5" />
                  <span>Calibrated for {dailyFit.outfit.occasion}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={handleWear}
                className={wornSuccess ? 'bg-emerald-700' : ''}
              >
                {wornSuccess ? '✓ Outfit Logged as Worn' : 'Wear This Today'}
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={cycleDailyFit}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Try Another
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => setScheduleModalOpen(true)}
                icon={<Calendar className="w-4 h-4 text-cognac-700" />}
              >
                Schedule Outfit
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={handleSave}
                icon={<Bookmark className="w-4 h-4 text-cognac-700" />}
              >
                Save Outfit
              </Button>

              <Button
                variant="ghost"
                size="md"
                onClick={() => setShareModalOpen(true)}
                icon={<Share2 className="w-4 h-4" />}
              >
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation History Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cognac-700" />
            <h3 className="font-serif text-lg font-bold text-charcoal-900">
              Recommendation History & Worn Outfits
            </h3>
          </div>
          <span className="text-xs text-charcoal-400">
            {dailyFitHistory.length} Logged Looks
          </span>
        </div>

        {dailyFitHistory.length === 0 ? (
          <div className="p-8 rounded-3xl bg-cream-50 border border-sand-200 text-center">
            <p className="text-xs font-semibold text-charcoal-700">No outfit history yet</p>
            <p className="text-[11px] text-charcoal-400 mt-1">
              Click "Wear This Today" on any recommendation to start tracking your worn rotation!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {dailyFitHistory.map((hist, idx) => (
              <div
                key={hist.id || idx}
                className="p-4 bg-cream-50 rounded-2xl border border-sand-200 shadow-soft-sm flex items-center gap-3"
              >
                <img
                  src={hist.outfit.image}
                  alt={hist.outfit.title}
                  className="w-16 h-16 rounded-xl object-cover shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full">
                    Worn
                  </span>
                  <p className="text-xs font-bold text-charcoal-900 truncate mt-1">
                    {hist.outfit.title}
                  </p>
                  <p className="text-[11px] text-charcoal-400">
                    {hist.outfit.occasion} · {hist.score}% Match
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <WhyThisOutfitModal
        isOpen={whyModalOpen}
        onClose={() => setWhyModalOpen(false)}
        recommendation={dailyFit}
      />

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        post={shareablePost}
      />
      <ScheduleOutfitModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        recommendation={dailyFit}
        onScheduled={(event) => {
          showToast(`Outfit scheduled for ${event.eventDate}!`, 'success');
        }}
      />
    </AppShell>
  );
};

