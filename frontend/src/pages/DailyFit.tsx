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
  Thermometer,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
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
    wardrobe,
    isGeneratingDailyFit,
    generateDailyFit,
  } = useApp();

  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [wornSuccess, setWornSuccess] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await cycleDailyFit();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!dailyFit) {
    if (isGeneratingDailyFit) {
      return (
        <AppShell>
          <div className="text-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-12">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-900/40 border-t-zinc-900 dark:border-zinc-100/40 dark:border-t-zinc-100 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Curating Your Silhouette
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              Synthesizing your wardrobe pieces with {weather.city ? `${weather.city}’s weather` : 'local climate'} for {selectedOccasion}...
            </p>
          </div>
        </AppShell>
      );
    }

    if (dailyFitError) {
      return (
        <AppShell>
          <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-12">
            <div className="w-12 h-12 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Daily Fit Recommendation Unavailable
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              {dailyFitError}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="md"
                onClick={() => generateDailyFit()}
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

    if (wardrobe.length === 0) {
      return (
        <AppShell>
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-12 px-6">
            <Sparkles className="w-8 h-8 text-zinc-600 dark:text-zinc-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Your Wardrobe is Empty
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Add tops, bottoms, shoes, and outerwear to your wardrobe so the AI atelier can tailor daily outfits for you.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/wardrobe')}
              className="mt-5"
            >
              Add Pieces to Wardrobe
            </Button>
          </div>
        </AppShell>
      );
    }

    return (
      <AppShell>
        <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto my-8">
          <div className="w-12 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mx-auto mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400">
            AI Stylist
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 mb-2">
            Curate Today’s Look
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-6">
            Get personalized clothing recommendations generated from your {wardrobe.length} wardrobe pieces, climate, and occasion.
          </p>

          {/* Occasion selector */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-3">
              Select Occasion
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setSelectedOccasion(occ)}
                  className={`px-4 py-2.5 min-h-[44px] rounded-md text-xs sm:text-sm font-medium transition-all ${
                    selectedOccasion === occ
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {occ}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => generateDailyFit()}
            icon={<Sparkles className="w-4 h-4" />}
          >
            Get Outfit Recommendations
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
      colors: ['#18181B', '#71717A', '#E4E4E7'],
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
    caption: `${dailyFit.outfit.title} · Curated by StyleSphere`,
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
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md">
                <Sparkles className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Your Daily Fit
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Real-time outfit synthesis based on your wardrobe, weather, and occasion.
            </p>
          </div>

          {/* Confidence Badge & Refresh Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Daily Fit"
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Refresh fit"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 min-h-[44px] rounded-md">
              <Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                  Confidence Score
                </span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                  {dailyFit.score}% Match
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Occasion Selector Pill Row */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            Select Occasion / Context
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {OCCASIONS.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() => setSelectedOccasion(occ)}
                className={`px-3.5 py-2 min-h-[44px] rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
                  selectedOccasion === occ
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
        </div>

        {/* Main Stylist Visualization Canvas */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8">
          {/* Top Context Strip */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
              <span className="flex items-center gap-1.5 font-semibold">
                <Thermometer className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                {weather.city ? `${weather.city}: ${weather.temp}°C ${weather.condition}` : 'Location not set'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                {dailyFit.outfit.occasion}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{dailyFit.outfit.style}</span>
            </div>

            <button
              onClick={() => setWhyModalOpen(true)}
              className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 hover:underline font-semibold cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Why This Outfit?</span>
            </button>
          </div>

          {/* Canvas Body */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Large Outfit Imagery */}
            <div className="lg:col-span-5 relative group">
              <div className="rounded-lg overflow-hidden aspect-[3/4] border border-zinc-200 dark:border-zinc-800 relative bg-zinc-100 dark:bg-zinc-950">
                <img
                  src={dailyFit.outfit.image}
                  alt={dailyFit.outfit.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-300">
                    Recommended Fit
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {dailyFit.outfit.title}
                  </h3>
                  <p className="text-xs text-white/90 mt-1 line-clamp-2">
                    {dailyFit.outfit.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Individual Clothing Items */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Individual Garments Assembled
                </h4>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {dailyFit.outfit.pieces.length} Pieces
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dailyFit.outfit.pieces.map((piece) => (
                  <div
                    key={piece.id}
                    onClick={() => navigate(`/wardrobe/${piece.id}`)}
                    className="flex items-center gap-3 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer group"
                  >
                    <img
                      src={piece.image}
                      alt={piece.name}
                      className="w-14 h-14 rounded object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {piece.category}
                      </span>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                        {piece.name}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {piece.color} · {piece.style}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Explanation Micro-Card */}
              <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-2 mt-4">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  AI Stylist Rationale
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                    <span>{weather.city ? `Thermal comfort for ${weather.temp}°C ${weather.condition}` : 'Thermal comfort calibrated for current season'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                    <span>Aligned with your {dailyFit.outfit.style} aesthetic</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                    <span>Utilizes capsule rotation staples</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
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
                  className={wornSuccess ? '!bg-emerald-700 !text-white' : ''}
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
                  icon={<Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
                >
                  Schedule Outfit
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSave}
                  icon={<Bookmark className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
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
              <Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Recommendation History & Worn Outfits
              </h3>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {dailyFitHistory.length} Logged Looks
            </span>
          </div>

          {dailyFitHistory.length === 0 ? (
            <div className="p-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No outfit history yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Click &quot;Wear This Today&quot; on any recommendation to start tracking your worn rotation!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {dailyFitHistory.map((hist, idx) => (
                <div
                  key={hist.id || idx}
                  className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center gap-3"
                >
                  <img
                    src={hist.outfit.image}
                    alt={hist.outfit.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Worn
                    </span>
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-1">
                      {hist.outfit.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
      </PullToRefresh>
    </AppShell>
  );
};
