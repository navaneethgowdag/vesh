import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Sun,
  Shirt,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  Bell,
  ArrowLeftRight,
  Check,
  ShoppingBag,
  BarChart2,
  Clock,
  Plus,
  Camera,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { MomentViewerModal } from '../components/feed/MomentViewerModal';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../services/api';
import { CalendarEvent, OutfitMoment } from '../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const {
    wardrobe,
    weather,
    dailyFit,
    activeOccasion,
    loadActiveDailyFit,
    regenerateDailyFit,
    wearDailyFit,
    isGeneratingDailyFit,
    showToast,
    unreadNotifsCount,
  } = useApp();

  // State
  const [isRecordingWear, setIsRecordingWear] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [topGap, setTopGap] = useState<any>(null);
  const [topShoppingProduct, setTopShoppingProduct] = useState<any>(null);

  // Moments state
  const [moments, setMoments] = useState<OutfitMoment[]>([]);
  const [myMoments, setMyMoments] = useState<OutfitMoment[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeMomentIndex, setActiveMomentIndex] = useState(0);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  // Count pending items requiring review
  const pendingReviewItems = wardrobe.filter((item) => {
    return (
      item.reviewRequired ||
      item.isFinalized === false ||
      item.processingStatus === 'ready_for_review' ||
      item.processingStatus === 'predictions_ready'
    );
  });

  const acceptedItems = wardrobe.filter((i) => !i.reviewRequired && i.isFinalized !== false);

  // Load dashboard secondary data
  const loadDashboardData = useCallback(async () => {
    try {
      // 1. Fetch upcoming events (next 7 days)
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const events = await api.calendar.listEvents(todayStr, nextWeek.toISOString().split('T')[0]);
      setUpcomingEvents(events.slice(0, 3));

      // 2. Fetch current weekly plan
      try {
        const plan = await api.planner.getWeeklyPlan();
        setWeeklyPlan(plan);
      } catch {
        // Optional
      }

      // 3. Fetch top wardrobe gap & shopping recommendations
      try {
        const gapData = await api.wardrobeGap.getAnalysis();
        if (gapData?.gaps && gapData.gaps.length > 0) {
          setTopGap(gapData.gaps[0]);
        }
        const shopData = await api.wardrobeGap.getShoppingRecommendations(2);
        if (shopData?.recommendations && shopData.recommendations.length > 0) {
          setTopShoppingProduct(shopData.recommendations[0]);
        }
      } catch {
        // Optional
      }

      // 4. Fetch 24-Hour Moments
      try {
        const [feedMoments, mine] = await Promise.all([
          api.moments.listFeed(20).catch(() => []),
          api.moments.listMine().catch(() => []),
        ]);
        setMoments(feedMoments);
        setMyMoments(mine);
      } catch {
        // Optional
      }

      // 5. Check/load active dailyFit if not yet in state
      if (!dailyFit && wardrobe.length > 0) {
        await loadActiveDailyFit();
      }
    } catch (err: any) {
      console.warn('Dashboard load error:', err);
    }
  }, [dailyFit, wardrobe.length, loadActiveDailyFit]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Wear Today Action
  const isWorn = dailyFit?.wornStatus === 'worn';
  const handleWearToday = async () => {
    if (!dailyFit || isRecordingWear || isWorn) return;
    setIsRecordingWear(true);
    try {
      await wearDailyFit();
      confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
    } catch {
      showToast('Could not record wear.', 'info');
    } finally {
      setIsRecordingWear(false);
    }
  };

  // Regenerate Action
  const handleRegenerate = async () => {
    if (isGeneratingDailyFit) return;
    await regenerateDailyFit(activeOccasion);
  };

  const outfit = dailyFit?.outfit;
  const pieces = outfit?.pieces || [];
  const allMomentsList = [...myMoments, ...moments];

  const handleLikeMoment = async (m: OutfitMoment) => {
    try {
      await api.moments.like(m.id);
      setMoments((prev) =>
        prev.map((item) =>
          item.id === m.id ? { ...item, isLiked: true, likesCount: item.likesCount + 1 } : item
        )
      );
    } catch {
      // quiet
    }
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={loadDashboardData}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20 space-y-6 select-none">
          {/* ----------------------------------------------------------- */}
          {/* 1. TOP BAR: GREETING + WEATHER + DATE + NOTIFICATIONS */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 font-serif">
                {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Friend'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                {formattedDate} · Your personalized AI wardrobe briefing is ready.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Weather Badge */}
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 rounded-xl shadow-xs text-xs">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Clear'}
                </span>
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
                )}
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 2. PRIMARY HERO SECTION: TODAY'S OUTFIT CARD */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md overflow-hidden">
            {/* Card Ribbon */}
            <div className="bg-zinc-900 dark:bg-zinc-950 px-6 py-3.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Today&apos;s Outfit
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-xs text-zinc-300 font-medium">
                  {activeOccasion || outfit?.occasion || 'Everyday Capsule'}
                </span>
              </div>
              {dailyFit && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-100">
                  {dailyFit.score}% Match
                </span>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {wardrobe.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Shirt className="w-10 h-10 text-zinc-400 mx-auto" />
                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                    Your Wardrobe is Empty
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Add your clothing items to activate daily AI styling recommendations.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => navigate('/wardrobe')}>
                    Upload First Piece
                  </Button>
                </div>
              ) : isGeneratingDailyFit && !dailyFit ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100 dark:border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-zinc-500">Curating your outfit...</p>
                </div>
              ) : dailyFit?.status === 'no_items' ? (
                <div className="text-center py-10 space-y-3">
                  <Shirt className="w-10 h-10 text-zinc-400 mx-auto" />
                  <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                    No clothes found for {activeOccasion || 'Everyday'}
                  </p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {dailyFit.emptyReason?.message ||
                      `Your wardrobe has no ${activeOccasion || 'Everyday'}-suitable clothes yet.`}
                  </p>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    {dailyFit.emptyReason?.action === 'review_pending' ? (
                      <Button variant="primary" size="sm" onClick={() => navigate('/wardrobe?tab=pending')}>
                        Review Pending Items
                      </Button>
                    ) : dailyFit.emptyReason?.action === 'laundry' ? (
                      <Button variant="outline" size="sm" onClick={() => navigate('/wardrobe?tab=accepted')}>
                        Check Laundry Filter
                      </Button>
                    ) : (
                      <>
                        <Button variant="primary" size="sm" onClick={() => navigate('/wardrobe')}>
                          Upload Clothes
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/wardrobe-gap')}>
                          View Wardrobe Gap
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : outfit && pieces.length > 0 ? (
                <>
                  {dailyFit?.status === 'stale' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-800 dark:text-amber-300">
                        Wardrobe or settings updated since this look was generated.
                      </span>
                      <button
                        onClick={handleRegenerate}
                        className="font-bold underline text-amber-900 dark:text-amber-200 hover:text-amber-700 whitespace-nowrap cursor-pointer"
                      >
                        Refresh →
                      </button>
                    </div>
                  )}

                  {dailyFit?.status === 'partial_outfit' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-800 dark:text-amber-300">
                        {dailyFit.emptyReason?.message || `No footwear found for ${activeOccasion}. Ensemble is partial.`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/wardrobe-gap')}
                        className="shrink-0 text-xs font-semibold"
                      >
                        View Gap →
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-serif">
                        {outfit.title || "Today's Curated Ensemble"}
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {dailyFit?.reasons?.[0] || 'Harmonized for your routine and current weather.'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-semibold self-start sm:self-auto text-primary-600"
                    >
                      View in Daily Fit →
                    </Button>
                  </div>

                  {/* Garment Thumbnails Row — only renders existing categories without blank gaps */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {pieces.map((piece) => {
                      const pieceImg =
                        resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                      return (
                        <div
                          key={piece.id}
                          onClick={() => navigate('/daily-fit')}
                          className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-zinc-50 dark:bg-zinc-850 cursor-pointer group"
                        >
                          <div className="aspect-square bg-white dark:bg-zinc-900 overflow-hidden">
                            <img
                              src={pieceImg}
                              alt={piece.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {piece.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 uppercase font-semibold truncate">
                              {piece.category}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hero Actions */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleWearToday}
                        disabled={isRecordingWear || isWorn || dailyFit?.canWear === false}
                        className={isWorn ? '!bg-emerald-700 !text-white' : ''}
                        icon={isWorn ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      >
                        {isWorn ? '✓ Worn Today' : dailyFit?.canWear === false ? 'Partial Outfit' : 'Wear This Outfit'}
                      </Button>

                      <Button
                        variant="outline"
                        size="md"
                        onClick={handleRegenerate}
                        disabled={isGeneratingDailyFit}
                        icon={<RefreshCw className={`w-3.5 h-3.5 ${isGeneratingDailyFit ? 'animate-spin' : ''}`} />}
                      >
                        Regenerate
                      </Button>

                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => navigate('/daily-fit')}
                        icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                      >
                        Replace an Item
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-semibold"
                    >
                      Open Full Daily Fit Studio
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 3. 24-HOUR MOMENTS TRAY (SECONDARY SOCIAL FEATURE) */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  24-Hour Moments
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  Live
                </span>
              </div>
              <button
                onClick={() => navigate('/create?type=moment')}
                className="text-xs text-primary-600 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Share Moment
              </button>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1 no-scrollbar scroll-smooth">
              {/* User's Own Moment Tile */}
              <div
                onClick={() => {
                  if (myMoments.length > 0) {
                    setActiveMomentIndex(0);
                    setViewerOpen(true);
                  } else {
                    navigate('/create?type=moment');
                  }
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-2xl p-0.5 ${
                      myMoments.length > 0
                        ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600'
                        : 'border-2 border-dashed border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                      {myMoments.length > 0 ? (
                        <img
                          src={resolveImageUrl(myMoments[0].imageUrl) || FALLBACK_POST_IMAGE}
                          alt="Your Moment"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : currentUser?.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                  </div>
                  {myMoments.length === 0 ? (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xs">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 px-1 rounded-full bg-zinc-900/80 text-[9px] font-bold text-white backdrop-blur-xs">
                      You
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 max-w-[68px] truncate text-center">
                  {myMoments.length > 0 ? 'Your Moment' : 'Add Moment'}
                </span>
              </div>

              {/* Creator Moments */}
              {moments.map((m, idx) => {
                const hoursLeft = Math.max(1, Math.round((m.timeRemainingSeconds || 3600) / 3600));
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setActiveMomentIndex(myMoments.length + idx);
                      setViewerOpen(true);
                    }}
                    className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-rose-500 to-amber-500 shadow-xs">
                        <div className="w-full h-full rounded-[14px] bg-white dark:bg-zinc-800 overflow-hidden">
                          <img
                            src={resolveImageUrl(m.imageUrl) || FALLBACK_POST_IMAGE}
                            alt={m.user.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-zinc-950/85 text-[9px] font-bold text-white shadow-xs">
                        {hoursLeft}h
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 max-w-[68px] truncate text-center">
                      {m.user.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}

              {moments.length === 0 && myMoments.length === 0 && (
                <div className="flex items-center gap-2 pl-2 text-xs text-zinc-500 italic">
                  <span>No active moments in the past 24 hours. Be the first to share!</span>
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 4. UPCOMING EVENTS & 5. WEEKLY STYLING PREVIEW */}
          {/* ----------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upcoming Events Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Upcoming Events
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="text-xs text-primary-600 font-semibold hover:underline"
                >
                  View Calendar
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  <Calendar className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p>No calendar events scheduled this week.</p>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="text-xs text-primary-600 font-semibold hover:underline mt-1 block mx-auto"
                  >
                    + Schedule an Event
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{evt.title}</p>
                        <p className="text-[11px] text-zinc-500">
                          {evt.eventDate} · {evt.occasion || 'General'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                        {evt.outfitId ? 'Outfit Ready' : 'Styling Auto'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Styling Preview Strip */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Weekly Outfit Plan
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/planner')}
                  className="text-xs text-primary-600 font-semibold hover:underline"
                >
                  Open Planner
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    onClick={() => navigate('/planner')}
                    className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/60 cursor-pointer hover:border-zinc-400 transition-colors"
                  >
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{day}</span>
                    <div className="w-6 h-6 rounded-md bg-zinc-200 dark:bg-zinc-700 mx-auto my-1 flex items-center justify-center text-[10px]">
                      👕
                    </div>
                    <span className="text-[9px] text-zinc-400 block truncate">Ready</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 6. PENDING AI WARDROBE REVIEW BANNER */}
          {/* ----------------------------------------------------------- */}
          {pendingReviewItems.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    You have {pendingReviewItems.length} clothing item(s) waiting for AI review
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Our EfficientNet-B0 fashion model analyzed your garments. Confirm predictions to unlock them in recommendations.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/wardrobe?tab=pending')}
                className="shrink-0 text-xs self-start sm:self-auto bg-amber-600 hover:bg-amber-700 text-white"
              >
                Review Clothing ({pendingReviewItems.length})
              </Button>
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* 7. WARDROBE INSIGHTS & SMART SHOPPING DISCOVERY */}
          {/* ----------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wardrobe Insights Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Wardrobe Insights
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/insights')}
                  className="text-xs text-primary-600 font-semibold hover:underline"
                >
                  Full Analytics →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold">Total Items</span>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {acceptedItems.length}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold">Tops / Bottoms</span>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {acceptedItems.filter((i) => /top|shirt|tee/i.test(i.category || '')).length} /{' '}
                    {acceptedItems.filter((i) => /jean|bottom|trouser/i.test(i.category || '')).length}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <span className="text-[10px] text-zinc-500 font-semibold">Health Score</span>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    {acceptedItems.length >= 10 ? '88/100' : '65/100'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shopping Discovery Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Smart Shopping Discovery
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/wardrobe-gap')}
                  className="text-xs text-primary-600 font-semibold hover:underline"
                >
                  Wardrobe Gap →
                </button>
              </div>

              {topShoppingProduct ? (
                <div
                  onClick={() => navigate('/wardrobe-gap')}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center gap-3 cursor-pointer hover:border-zinc-400 transition-colors"
                >
                  <img
                    src={topShoppingProduct.image_url}
                    alt={topShoppingProduct.title}
                    className="w-12 h-12 rounded-lg object-cover bg-zinc-200"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {topShoppingProduct.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {topShoppingProduct.brand} · {topShoppingProduct.currency === 'INR' ? '₹' : '$'}
                      {topShoppingProduct.price?.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate mt-0.5">
                      Recommended to resolve missing wardrobe essentials
                    </p>
                  </div>
                </div>
              ) : topGap ? (
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-xs space-y-1">
                  <p className="font-bold text-zinc-900 dark:text-zinc-100">{topGap.title}</p>
                  <p className="text-[11px] text-zinc-500">{topGap.reason}</p>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-3 text-center">
                  Your capsule wardrobe has no critical gaps detected.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 24-Hour Moments Viewer Modal */}
        <MomentViewerModal
          isOpen={viewerOpen}
          moments={allMomentsList}
          initialIndex={activeMomentIndex}
          onClose={() => setViewerOpen(false)}
          onLike={handleLikeMoment}
        />
      </PullToRefresh>
    </AppShell>
  );
};
