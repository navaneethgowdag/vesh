import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  Share2,
  Info,
  CheckCircle,
  Calendar as CalendarIcon,
  Thermometer,
  Compass,
  ArrowRight,
  Clock,
  Palette,
  ShieldCheck,
  Heart,
  ThumbsDown,
  Sun,
  CloudSun,
  Shirt,
  Sparkle,
  SlidersHorizontal,
  ChevronRight,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { CalendarEvent, Recommendation, Post } from '../types';
import { api } from '../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

export const OCCASION_SHORTLIST = [
  'Office / Work',
  'Casual outing',
  'Date',
  'Dinner',
  'Party',
  'Travel',
  'Sports / Gym',
  'Wedding / Function',
] as const;

export const DailyFit: React.FC = () => {
  const {
    dailyFit,
    weather,
    wearDailyFit,
    showToast,
    wardrobe,
  } = useApp();

  const navigate = useNavigate();

  // Active recommended outfit (focus strictly on ONE outfit)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(dailyFit || null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Styling Context State
  const [activeOccasion, setActiveOccasion] = useState<string>('Casual outing');
  const [showOccasionPicker, setShowOccasionPicker] = useState<boolean>(false);

  // Action states
  const [isWorn, setIsWorn] = useState<boolean>(false);
  const [isLoved, setIsLoved] = useState<boolean>(false);
  const [isAccepting, setIsAccepting] = useState<boolean>(false);

  // Modals
  const [whyModalOpen, setWhyModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);

  // Calendar integration (optional)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [todayEvent, setTodayEvent] = useState<CalendarEvent | null>(null);

  // Synchronize initial dailyFit if available
  useEffect(() => {
    if (dailyFit && !recommendation) {
      setRecommendation(dailyFit);
    }
  }, [dailyFit, recommendation]);

  // Load calendar events quietly in background (optional context provider)
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const events = await api.calendar.listEvents(todayStr, nextWeek.toISOString().split('T')[0]);
        setCalendarEvents(events);
        const matchingToday = events.find((e) => e.eventDate === todayStr);
        if (matchingToday) {
          setTodayEvent(matchingToday);
          if (matchingToday.occasion) {
            setActiveOccasion(matchingToday.occasion);
          }
        }
      } catch {
        // Optional calendar provider failure is non-blocking
      }
    };
    fetchCalendar();
  }, []);

  // Format today's date in editorial style: e.g. "Monday, November 9, 2026"
  const formattedToday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  // Generate or Regenerate the ONE outfit
  const handleCurateOutfit = async (targetOccasion?: string) => {
    if (wardrobe.length === 0) {
      showToast('Your wardrobe is empty. Add clothing items to receive AI recommendations.', 'info');
      navigate('/wardrobe');
      return;
    }

    const occ = targetOccasion || activeOccasion;
    setIsGenerating(true);
    setGenerationError(null);
    setIsWorn(false);

    try {
      const payload: any = {
        city: weather?.city || undefined,
        limit: 1, // Focus on ONE outfit
        recommendationMode: 'occasion',
        occasion: occ,
        targetDate: new Date().toISOString().split('T')[0],
      };

      if (todayEvent) {
        payload.calendarEventId = todayEvent.id;
      }

      const recs = await api.recommendations.generate(payload);

      if (recs && recs.length > 0) {
        setRecommendation(recs[0]);
        setActiveOccasion(occ);
        showToast(`Curated today's look for ${occ}!`, 'success');
      } else {
        setGenerationError('No complete outfits could be synthesized. Add more tops, bottoms, or dresses to your wardrobe.');
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to curate recommendation.';
      setGenerationError(msg);
      showToast(msg, 'info');
    } finally {
      setIsGenerating(false);
    }
  };

  // Initial generation on first visit if none loaded yet
  useEffect(() => {
    if (!recommendation && wardrobe.length > 0 && !isGenerating) {
      handleCurateOutfit();
    }
  }, [wardrobe.length]);

  // Action: Wear this outfit
  const handleWearToday = async () => {
    if (!recommendation) return;

    try {
      if (wearDailyFit) {
        await wearDailyFit();
      } else {
        await api.recommendations.markWorn(recommendation.id);
      }

      setIsWorn(true);

      // Celebratory Confetti Burst
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#09090b', '#71717a', '#10b981', '#f43f5e'],
      });

      showToast("Look recorded! Marked as today's worn outfit.", 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to record wear', 'info');
    }
  };

  // Action: Love / Like outfit
  const handleLoveLook = async () => {
    if (!recommendation) return;
    try {
      await api.recommendations.sendFeedback(recommendation.id, 'like');
      setIsLoved(true);
      showToast('Loved this outfit! Style preferences updated.', 'heart');
    } catch {
      setIsLoved(true);
    }
  };

  // Action: Feedback & Request another look
  const handleDismissLook = async () => {
    if (!recommendation) return;
    try {
      await api.recommendations.sendFeedback(recommendation.id, 'reject');
      showToast('Preference noted. Synthesizing a fresh look...', 'info');
    } catch {}
    handleCurateOutfit();
  };

  const outfit = recommendation?.outfit;
  const pieces = outfit?.pieces || [];

  return (
    <AppShell showRightSidebar={true}>
      <PullToRefresh onRefresh={() => handleCurateOutfit()}>
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {/* ----------------------------------------------------------- */}
          {/* EDITORIAL HEADER: Bold, elegant heading & context bar */}
          {/* ----------------------------------------------------------- */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-[11px] font-semibold tracking-wider uppercase text-zinc-700 dark:text-zinc-300 mb-3 border border-zinc-200/60 dark:border-zinc-700/60">
              <Sparkle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
              <span>Personal Stylist Edit</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-serif">
                  Today&apos;s Look
                </h1>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-1 font-medium">
                  {formattedToday}
                </p>
              </div>

              {/* Weather & Context Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 rounded-xl shadow-xs text-xs">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Clear Sky'}
                  </span>
                </div>

                {todayEvent && (
                  <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    <span>{todayEvent.occasion || 'Scheduled Event'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* OCCASION QUICK SWITCHER PILLS */}
          {/* ----------------------------------------------------------- */}
          <div className="bg-zinc-50 dark:bg-zinc-850/80 p-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-xs">
            <span className="px-3 text-zinc-400 text-[11px] font-semibold uppercase tracking-wider shrink-0">
              Occasion:
            </span>
            {OCCASION_SHORTLIST.map((occ) => {
              const isSelected = activeOccasion === occ;
              return (
                <button
                  key={occ}
                  type="button"
                  onClick={() => handleCurateOutfit(occ)}
                  className={`px-3.5 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60'
                  }`}
                >
                  {occ}
                </button>
              );
            })}
          </div>

          {/* ----------------------------------------------------------- */}
          {/* MAIN HERO STAGE: THE ONE RECOMMENDED OUTFIT */}
          {/* ----------------------------------------------------------- */}
          {wardrobe.length === 0 ? (
            <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-lg mx-auto">
              <Shirt className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Your Wardrobe is Empty
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto mb-5">
                Upload your shirts, pants, dresses, or shoes. TailorBird styles personalized looks strictly from your actual garments.
              </p>
              <Button variant="primary" size="md" onClick={() => navigate('/wardrobe')}>
                Add Pieces to Wardrobe
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="text-center py-24 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="w-14 h-14 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 dark:border-zinc-100/30 dark:border-t-zinc-100 animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-serif">
                Styling Your Look...
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                Harmonizing CIELAB color palettes, formality balance, and climate calibration from your wardrobe.
              </p>
            </div>
          ) : generationError ? (
            <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Styling Notice
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {generationError}
              </p>
              <Button variant="outline" size="md" onClick={() => handleCurateOutfit()}>
                Try Again
              </Button>
            </div>
          ) : recommendation && outfit ? (
            <div className="relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-lg overflow-hidden">
              {/* Top Banner Ribbon */}
              <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-6 py-3.5 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-200">
                    Your Outfit for Today
                  </span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-xs font-medium text-zinc-300">
                    {outfit.occasion || activeOccasion}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-zinc-100 border border-white/20">
                    {recommendation.score}% Match
                  </span>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="p-6 sm:p-8 space-y-8">
                {/* Outfit Title & Style Vibe */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight font-serif">
                      {outfit.title || `${activeOccasion} Ensemble`}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {outfit.description || 'A balanced, cohesive combination calibrated for your day.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setWhyModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Stylist Breakdown</span>
                  </button>
                </div>

                {/* ------------------------------------------------------- */}
                {/* FLAT-LAY VISUAL SHOWCASE: REAL WARDROBE PIECES */}
                {/* ------------------------------------------------------- */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Ensemble Pieces ({pieces.length})
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Tap any piece to view details in wardrobe
                    </span>
                  </div>

                  {/* Assembled Pieces Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pieces.map((piece) => {
                      const pieceImg = resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                      return (
                        <div
                          key={piece.id}
                          onClick={() => navigate(`/wardrobe/${piece.id}`)}
                          className="group rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850 hover:border-zinc-900 dark:hover:border-zinc-100 transition-all cursor-pointer shadow-xs hover:shadow-md"
                        >
                          <div className="aspect-square relative overflow-hidden bg-white dark:bg-zinc-900">
                            <img
                              src={pieceImg}
                              alt={piece.name}
                              onError={(e) => {
                                if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                                  e.currentTarget.src = FALLBACK_POST_IMAGE;
                                }
                              }}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute top-2 left-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white border border-white/20">
                                {piece.category}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 space-y-1">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                              {piece.name}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                              <span>{piece.color}</span>
                              {piece.brand && <span className="truncate max-w-[80px]">· {piece.brand}</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ------------------------------------------------------- */}
                {/* WHY THIS OUTFIT? STYLING RATIONALE BOX */}
                {/* ------------------------------------------------------- */}
                <div className="rounded-2xl p-5 bg-zinc-50/80 dark:bg-zinc-850/80 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                      Why this outfit?
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-start gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                      <Palette className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Color Harmony</span>
                        <span className="text-[11px]">{recommendation.reasons[0] || 'Complementary contrast with balanced undertones.'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                      <ShieldCheck className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Occasion Suitability</span>
                        <span className="text-[11px]">{recommendation.reasons[1] || `Tailored for ${activeOccasion} formality rules.`}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                      <Thermometer className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Climate Calibration</span>
                        <span className="text-[11px]">{recommendation.reasons[2] || 'Optimal comfort for local ambient temperature.'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                      <CheckCircle className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 block">Rotation Balance</span>
                        <span className="text-[11px]">{recommendation.reasons[3] || 'Incorporates unworn pieces to maintain fresh rotation.'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------- */}
                {/* HERO ACTION CONSOLE: Wear, Regenerate, Feedback */}
                {/* ------------------------------------------------------- */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Primary Hero Action */}
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleWearToday}
                      className={isWorn ? '!bg-emerald-700 !text-white' : ''}
                      icon={isWorn ? <Check className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    >
                      {isWorn ? "✓ Worn Today" : "Wear This Outfit"}
                    </Button>

                    {/* Regenerate Action */}
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleCurateOutfit()}
                      disabled={isGenerating}
                      icon={<RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />}
                    >
                      Try Another Look
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Love Feedback */}
                    <button
                      type="button"
                      onClick={handleLoveLook}
                      className={`p-3 min-h-[44px] min-w-[44px] rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        isLoved
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                      title="Love this look"
                      aria-label="Love this look"
                    >
                      <Heart className={`w-4 h-4 ${isLoved ? 'fill-rose-600 text-rose-600' : ''}`} />
                    </button>

                    {/* Dislike & Refresh Feedback */}
                    <button
                      type="button"
                      onClick={handleDismissLook}
                      className="p-3 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer flex items-center justify-center"
                      title="Not feeling this look"
                      aria-label="Not feeling this look"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>

                    {/* Schedule on calendar */}
                    <button
                      type="button"
                      onClick={() => setScheduleModalOpen(true)}
                      className="p-3 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer flex items-center justify-center"
                      title="Schedule for date"
                      aria-label="Schedule for date"
                    >
                      <CalendarIcon className="w-4 h-4" />
                    </button>

                    {/* Share Modal */}
                    <button
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      className="p-3 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer flex items-center justify-center"
                      title="Share outfit"
                      aria-label="Share outfit"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MODALS */}
        {/* ------------------------------------------------------------- */}
        {recommendation && (
          <>
            <WhyThisOutfitModal
              isOpen={whyModalOpen}
              onClose={() => setWhyModalOpen(false)}
              recommendation={recommendation}
            />

            <ShareModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              post={
                {
                  id: recommendation.id,
                  user: { id: '', name: 'You', username: 'you', avatar: '' },
                  image: recommendation.outfit.image,
                  caption: `My curated look for ${activeOccasion}`,
                  likesCount: 0,
                  commentsCount: 0,
                  savesCount: 0,
                  isLiked: false,
                  isSaved: false,
                  createdAt: 'Today',
                } as Post
              }
            />

            <ScheduleOutfitModal
              isOpen={scheduleModalOpen}
              onClose={() => setScheduleModalOpen(false)}
              recommendation={recommendation}
              onScheduled={() => {
                showToast('Outfit scheduled on your calendar!', 'success');
                setScheduleModalOpen(false);
              }}
            />
          </>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
