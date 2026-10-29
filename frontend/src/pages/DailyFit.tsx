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
          <div className="text-center py-24 px-6 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border max-w-xl mx-auto my-12 shadow-soft">
            <div className="w-14 h-14 rounded-full border-2 border-luxury-champagne/40 border-t-luxury-champagne animate-spin mx-auto mb-4" />
            <h2 className="font-serif text-2xl font-bold text-luxury-text dark:text-luxury-dark-text">
              Curating Your Silhouette
            </h2>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-2 max-w-md mx-auto">
              Synthesizing your wardrobe pieces with {weather.city ? `${weather.city}’s weather` : 'local climate'} for {selectedOccasion}...
            </p>
          </div>
        </AppShell>
      );
    }

    if (dailyFitError) {
      return (
        <AppShell>
          <div className="text-center py-16 px-6 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border max-w-xl mx-auto my-12 shadow-soft">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-xl font-bold text-luxury-text dark:text-luxury-dark-text">
              Daily Fit Recommendation Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-2 max-w-md mx-auto">
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
          <div className="text-center py-20 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border max-w-xl mx-auto my-12 px-6">
            <Sparkles className="w-8 h-8 text-luxury-champagne dark:text-luxury-dark-champagne mx-auto mb-3" />
            <h2 className="font-serif text-xl font-bold text-luxury-text dark:text-luxury-dark-text">
              Your Wardrobe is Empty
            </h2>
            <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1 max-w-sm mx-auto">
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
        <div className="text-center py-16 px-6 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border max-w-2xl mx-auto my-8 shadow-soft">
          <div className="w-12 h-12 rounded-2xl bg-luxury-champagne/10 dark:bg-luxury-dark-champagne/10 border border-luxury-champagne/20 flex items-center justify-center text-luxury-champagne dark:text-luxury-dark-champagne mx-auto mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-luxury-champagne dark:text-luxury-dark-champagne">
            AI Stylist Atelier
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-medium text-luxury-text dark:text-luxury-dark-text mt-1 mb-2">
            Curate Today’s Look
          </h2>
          <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted max-w-md mx-auto mb-6">
            Get personalized clothing recommendations generated from your {wardrobe.length} wardrobe pieces, climate, and occasion.
          </p>

          {/* Occasion selector */}
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2">
              Select Occasion
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {OCCASIONS.map((occ) => (
                <button
                  key={occ}
                  type="button"
                  onClick={() => setSelectedOccasion(occ)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedOccasion === occ
                      ? 'bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso font-semibold shadow-subtle'
                      : 'bg-sand-100 dark:bg-charcoal-800 text-charcoal-700 dark:text-sand-300 hover:bg-sand-200 dark:hover:bg-charcoal-700'
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
            className="shadow-md"
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
      colors: ['#C3A36B', '#171715', '#F7F4EE'],
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
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-luxury-champagne/15 text-luxury-champagne dark:text-luxury-dark-champagne rounded-xl border border-luxury-champagne/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
                Your Daily Fit
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
              Real-time outfit synthesis based on your wardrobe, weather, and occasion.
            </p>
          </div>

          {/* Confidence Badge & Refresh Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Daily Fit"
              className="p-2.5 rounded-full border border-luxury-border dark:border-luxury-dark-border text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text bg-luxury-surface dark:bg-luxury-dark-surface hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle transition-all cursor-pointer shadow-soft-xs"
              aria-label="Refresh fit"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-luxury-champagne' : ''}`} />
            </button>

            <div className="flex items-center gap-2 bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-champagne/40 px-4 py-2 rounded-2xl shadow-soft-xs">
              <Sparkles className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne" />
              <div>
                <span className="block text-[10px] uppercase font-bold tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted">
                  Confidence Score
                </span>
                <span className="font-serif text-lg font-bold text-luxury-champagne dark:text-luxury-dark-champagne leading-none">
                  {dailyFit.score}% Match
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Occasion Selector Pill Row */}
        <div className="mb-6">
          <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-2">
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
        <div className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft overflow-hidden mb-8">
          {/* Top Context Strip */}
          <div className="bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 px-6 py-3 border-b border-luxury-border dark:border-luxury-dark-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-luxury-text dark:text-luxury-dark-text">
              <span className="flex items-center gap-1.5 font-semibold">
                <Thermometer className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne" />
                {weather.city ? `${weather.city}: ${weather.temp}°C ${weather.condition}` : 'Location not set'}
              </span>
              <span className="text-luxury-border dark:text-luxury-dark-border">·</span>
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne" />
                {dailyFit.outfit.occasion}
              </span>
              <span className="text-luxury-border dark:text-luxury-dark-border">·</span>
              <span className="font-medium text-luxury-champagne dark:text-luxury-dark-champagne">{dailyFit.outfit.style}</span>
            </div>

            <button
              onClick={() => setWhyModalOpen(true)}
              className="flex items-center gap-1.5 text-luxury-champagne dark:text-luxury-dark-champagne hover:underline font-semibold cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Why This Outfit?</span>
            </button>
          </div>

          {/* Canvas Body: Large Visualization + Individual Piece Breakdown */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Large Outfit Imagery */}
            <div className="lg:col-span-5 relative group">
              <div className="rounded-3xl overflow-hidden aspect-[3/4] shadow-soft-lg border border-luxury-border dark:border-luxury-dark-border relative bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle">
                <img
                  src={dailyFit.outfit.image}
                  alt={dailyFit.outfit.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-luxury-champagne">
                    Recommended Fit
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white">
                    {dailyFit.outfit.title}
                  </h3>
                  <p className="text-xs text-white/80 mt-1 line-clamp-2">
                    {dailyFit.outfit.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Individual Clothing Items */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-luxury-border dark:border-luxury-dark-border pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted">
                  Individual Garments Assembled
                </h4>
                <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted">
                  {dailyFit.outfit.pieces.length} Pieces
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dailyFit.outfit.pieces.map((piece) => (
                  <div
                    key={piece.id}
                    onClick={() => navigate(`/wardrobe/${piece.id}`)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-luxury-surfaceSubtle/70 dark:bg-luxury-dark-surfaceSubtle/70 border border-luxury-border dark:border-luxury-dark-border hover:border-luxury-champagne/50 dark:hover:border-luxury-dark-champagne/50 transition-all cursor-pointer group shadow-soft-xs"
                  >
                    <img
                      src={piece.image}
                      alt={piece.name}
                      className="w-14 h-14 rounded-xl object-cover shadow-sm flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-champagne dark:text-luxury-dark-champagne">
                        {piece.category}
                      </span>
                      <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text truncate group-hover:text-luxury-champagne">
                        {piece.name}
                      </p>
                      <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted">
                        {piece.color} · {piece.style}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI Explanation Micro-Card */}
              <div className="p-4 rounded-2xl bg-luxury-surfaceSubtle/80 dark:bg-luxury-dark-surfaceSubtle/80 border border-luxury-border dark:border-luxury-dark-border space-y-2 mt-4">
                <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne" />
                  AI Stylist Rationale
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted">
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne flex-shrink-0 mt-0.5" />
                    <span>{weather.city ? `Thermal comfort for ${weather.temp}°C ${weather.condition}` : 'Thermal comfort calibrated for current season'}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne flex-shrink-0 mt-0.5" />
                    <span>Aligned with your {dailyFit.outfit.style} aesthetic</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne flex-shrink-0 mt-0.5" />
                    <span>Utilizes capsule rotation staples</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-luxury-champagne dark:text-luxury-dark-champagne flex-shrink-0 mt-0.5" />
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
                  icon={<Calendar className="w-4 h-4 text-luxury-champagne" />}
                >
                  Schedule Outfit
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSave}
                  icon={<Bookmark className="w-4 h-4 text-luxury-champagne" />}
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
              <Calendar className="w-4 h-4 text-luxury-champagne dark:text-luxury-dark-champagne" />
              <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text">
                Recommendation History & Worn Outfits
              </h3>
            </div>
            <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted">
              {dailyFitHistory.length} Logged Looks
            </span>
          </div>

          {dailyFitHistory.length === 0 ? (
            <div className="p-8 rounded-3xl bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-border dark:border-luxury-dark-border text-center">
              <p className="text-xs font-semibold text-luxury-text dark:text-luxury-dark-text">No outfit history yet</p>
              <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
                Click &quot;Wear This Today&quot; on any recommendation to start tracking your worn rotation!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {dailyFitHistory.map((hist, idx) => (
                <div
                  key={hist.id || idx}
                  className="p-4 bg-luxury-surface dark:bg-luxury-dark-surface rounded-2xl border border-luxury-border dark:border-luxury-dark-border shadow-soft-xs flex items-center gap-3"
                >
                  <img
                    src={hist.outfit.image}
                    alt={hist.outfit.title}
                    className="w-16 h-16 rounded-xl object-cover shadow-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Worn
                    </span>
                    <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text truncate mt-1">
                      {hist.outfit.title}
                    </p>
                    <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted">
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
