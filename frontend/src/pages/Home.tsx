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
  CloudSun,
  Crown,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { MomentViewerModal } from '../components/feed/MomentViewerModal';
import { AddMomentModal } from '../components/feed/AddMomentModal';
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
  const [isAddMomentOpen, setIsAddMomentOpen] = useState(false);
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

  const handleMomentCreated = (newMoment: OutfitMoment) => {
    setMyMoments((prev) => [newMoment, ...prev]);
    showToast('24-Hour Moment published successfully!', 'success');
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={loadDashboardData}>
        <div className="max-w-5xl mx-auto space-y-8 select-none">
          {/* ----------------------------------------------------------- */}
          {/* 1. EDITORIAL HEADER & BRIEFING */}
          {/* ----------------------------------------------------------- */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E2DDD3] dark:border-[#2D342F]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#727D69] dark:text-[#9EAB97] font-mono">
                  Personal Wardrobe Stylist
                </span>
                <span className="text-[#B5AA99]">·</span>
                <span className="text-[11px] text-[#777C75] dark:text-[#A3ABA0] font-mono">
                  {formattedDate}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1] font-serif">
                {getGreeting()}, {currentUser?.name?.split(' ')[0] || 'Friend'}
              </h1>
              <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1">
                Your bespoke daily wardrobe recommendation is curated and ready.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Weather Chip */}
              <div className="flex items-center gap-2.5 bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] px-4 py-2 rounded-xl shadow-subtle text-xs">
                <CloudSun className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                <span className="font-semibold text-[#202321] dark:text-[#F8F6F1] font-mono">
                  {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Clear'}
                </span>
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2.5 rounded-xl border border-[#E2DDD3] dark:border-[#2D342F] bg-white dark:bg-[#1C201D] text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] transition-colors cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#1C201D]" />
                )}
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 2. PRIMARY HERO: TODAY'S CURATED LOOK (CENTERPIECE) */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-3xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-soft-md overflow-hidden transition-all">
            {/* Editorial Header Ribbon */}
            <div className="bg-[#202321] dark:bg-[#141715] px-6 sm:px-8 py-3.5 text-[#F8F6F1] flex items-center justify-between border-b border-[#2E3530]">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#899783] animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#F8F6F1] font-mono">
                  Today's Curated Look
                </span>
                <span className="text-[#777C75]">·</span>
                <span className="text-xs text-[#D8D3C8] font-medium">
                  {activeOccasion || outfit?.occasion || 'Everyday Capsule'}
                </span>
              </div>
              {dailyFit && (
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 dark:bg-white/10 text-[#F8F6F1] border border-white/20">
                  {dailyFit.score}% Affinity Match
                </span>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {wardrobe.length === 0 ? (
                <div className="text-center py-12 space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F1EEE7] dark:bg-[#252A26] flex items-center justify-center mx-auto text-[#727D69]">
                    <Shirt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#202321] dark:text-[#F8F6F1]">
                      Your Wardrobe is Waiting
                    </h3>
                    <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] max-w-sm mx-auto mt-1">
                      Upload your clothing pieces to activate personal AI daily styling recommendations.
                    </p>
                  </div>
                  <Button variant="primary" size="md" onClick={() => navigate('/wardrobe')}>
                    Upload Your First Piece
                  </Button>
                </div>
              ) : isGeneratingDailyFit && !dailyFit ? (
                <div className="text-center py-14 space-y-3">
                  <div className="w-9 h-9 rounded-full border-2 border-[#202321] border-t-transparent dark:border-[#F8F6F1] dark:border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] font-mono">
                    Art-directing your personal ensemble...
                  </p>
                </div>
              ) : dailyFit?.status === 'no_items' ? (
                <div className="text-center py-12 space-y-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#F1EEE7] dark:bg-[#252A26] flex items-center justify-center mx-auto text-[#727D69]">
                    <Shirt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-[#202321] dark:text-[#F8F6F1]">
                      No suitable pieces found for {activeOccasion || 'Everyday'}
                    </h3>
                    <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] max-w-sm mx-auto mt-1">
                      {dailyFit.emptyReason?.message ||
                        `Your wardrobe has no verified items suitable for ${activeOccasion || 'Everyday'} yet.`}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    {dailyFit.emptyReason?.action === 'review_pending' ? (
                      <Button variant="primary" size="sm" onClick={() => navigate('/wardrobe?tab=pending')}>
                        Review Pending Garments
                      </Button>
                    ) : dailyFit.emptyReason?.action === 'laundry' ? (
                      <Button variant="outline" size="sm" onClick={() => navigate('/wardrobe?tab=accepted')}>
                        Check Clean / Laundry Status
                      </Button>
                    ) : (
                      <>
                        <Button variant="primary" size="sm" onClick={() => navigate('/wardrobe')}>
                          Add Clothing Pieces
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
                  {/* Status Banners */}
                  {dailyFit?.status === 'stale' && (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-900 dark:text-amber-200">
                        Wardrobe or preferences updated since this look was generated.
                      </span>
                      <button
                        onClick={handleRegenerate}
                        className="font-bold underline text-amber-950 dark:text-amber-100 hover:text-amber-700 whitespace-nowrap cursor-pointer"
                      >
                        Refresh Look →
                      </button>
                    </div>
                  )}

                  {dailyFit?.status === 'partial_outfit' && (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-900 dark:text-amber-200">
                        {dailyFit.emptyReason?.message || `No footwear found for ${activeOccasion}. Ensemble is partial.`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/wardrobe-gap')}
                        className="shrink-0 text-xs font-semibold"
                      >
                        View Gap Essentials →
                      </Button>
                    </div>
                  )}

                  {/* Look Header & Stylist Note */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-[#202321] dark:text-[#F8F6F1] font-serif tracking-tight">
                        {outfit.title || "Curated Contemporary Look"}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1 leading-relaxed">
                        {dailyFit?.reasons?.[0] || 'Color-coordinated palette tailored for your lifestyle and ambient temperature.'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-semibold self-start sm:self-auto text-[#727D69] dark:text-[#9EAB97]"
                    >
                      View in Daily Fit Studio →
                    </Button>
                  </div>

                  {/* Garment Composition Gallery (Editorial Cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    {pieces.map((piece) => {
                      const pieceImg =
                        resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                      return (
                        <div
                          key={piece.id}
                          onClick={() => navigate('/daily-fit')}
                          className="rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] overflow-hidden bg-[#F8F6F1] dark:bg-[#242A25] cursor-pointer group hover:border-[#727D69] transition-all duration-200 shadow-subtle"
                        >
                          <div className="aspect-[3/4] bg-[#E9E6DE] dark:bg-[#1E2320] overflow-hidden relative">
                            <img
                              src={pieceImg}
                              alt={piece.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {piece.color && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white">
                                {piece.color}
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#727D69] dark:text-[#9EAB97] truncate font-mono">
                              {piece.category || 'Piece'}
                            </p>
                            <p className="text-xs font-bold text-[#202321] dark:text-[#F8F6F1] truncate mt-0.5">
                              {piece.name}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Toolbar */}
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DDD3] dark:border-[#2D342F]">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleWearToday}
                        disabled={isRecordingWear || isWorn || dailyFit?.canWear === false}
                        className={isWorn ? '!bg-emerald-700 !text-white' : ''}
                        icon={isWorn ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      >
                        {isWorn ? '✓ Worn Today' : dailyFit?.canWear === false ? 'Partial Look' : 'Wear This Outfit'}
                      </Button>

                      <Button
                        variant="secondary"
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
                        Swap a Piece
                      </Button>
                    </div>

                    <button
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-semibold text-[#727D69] dark:text-[#9EAB97] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Custom Occasions</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 3. 24-HOUR MOMENTS TRAY (SECONDARY SOCIAL TRAY) */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] p-5 shadow-subtle space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                  24-Hour Moments
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#E9E6DE] dark:bg-[#252A26] text-[#727D69] dark:text-[#B8C7B3] border border-[#D8D3C8] dark:border-[#38413A]">
                  Ephemeral Feed
                </span>
              </div>
              <button
                onClick={() => setIsAddMomentOpen(true)}
                className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Share Moment
              </button>
            </div>

            <div className="flex items-center gap-3.5 overflow-x-auto pb-1 pt-1 no-scrollbar scroll-smooth">
              {/* User's Own Moment Tile */}
              <div
                onClick={() => {
                  if (myMoments.length > 0) {
                    setActiveMomentIndex(0);
                    setViewerOpen(true);
                  } else {
                    setIsAddMomentOpen(true);
                  }
                }}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
              >
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-2xl p-0.5 ${
                      myMoments.length > 0
                        ? 'bg-gradient-to-tr from-[#899783] via-[#B5AA99] to-[#727D69]'
                        : 'border-2 border-dashed border-[#D8D3C8] dark:border-[#38413A]'
                    }`}
                  >
                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#242A25] overflow-hidden flex items-center justify-center">
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
                        <Camera className="w-6 h-6 text-[#777C75]" />
                      )}
                    </div>
                  </div>
                  {myMoments.length === 0 ? (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#202321] dark:bg-[#F8F6F1] text-white dark:text-[#202321] flex items-center justify-center shadow-xs">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#202321]/90 text-[9px] font-mono font-bold text-white backdrop-blur-xs">
                      You
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-medium text-[#50564E] dark:text-[#A3ABA0] max-w-[68px] truncate text-center">
                  {myMoments.length > 0 ? 'Your Look' : 'Post Look'}
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
                      <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-tr from-[#727D69] to-[#899783] shadow-xs">
                        <div className="w-full h-full rounded-[14px] bg-white dark:bg-[#242A25] overflow-hidden">
                          <img
                            src={resolveImageUrl(m.imageUrl) || FALLBACK_POST_IMAGE}
                            alt={m.user.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#202321]/90 text-[9px] font-mono font-bold text-white shadow-xs">
                        {hoursLeft}h
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-[#50564E] dark:text-[#A3ABA0] max-w-[68px] truncate text-center">
                      {m.user.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}

              {moments.length === 0 && myMoments.length === 0 && (
                <div className="flex items-center gap-2 pl-2 text-xs text-[#777C75] dark:text-[#A3ABA0] italic font-serif">
                  <span>No active moments in the past 24 hours. Be the first to share your look!</span>
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 4. UPCOMING EVENTS & 5. WEEKLY STYLING PREVIEW */}
          {/* ----------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Upcoming Events Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                  <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                    Upcoming Events
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline cursor-pointer"
                >
                  View Calendar →
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#777C75] dark:text-[#A3ABA0]">
                  <Calendar className="w-6 h-6 mx-auto mb-1 opacity-40 text-[#727D69]" />
                  <p>No calendar events scheduled this week.</p>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline mt-1 block mx-auto cursor-pointer"
                  >
                    + Schedule an Event
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-[#202321] dark:text-[#F8F6F1]">{evt.title}</p>
                        <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0] font-mono mt-0.5">
                          {evt.eventDate} · {evt.occasion || 'General'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-[#E9E6DE] dark:bg-[#323833] text-[#50564E] dark:text-[#D8D3C8]">
                        {evt.outfitId ? 'Outfit Ready' : 'Styling Auto'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Styling Preview Strip */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                  <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                    Weekly Outfit Planner
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/planner')}
                  className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline cursor-pointer"
                >
                  Open Planner →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    onClick={() => navigate('/planner')}
                    className="p-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F] cursor-pointer hover:border-[#727D69] transition-colors"
                  >
                    <span className="text-[10px] font-bold text-[#777C75] dark:text-[#A3ABA0] uppercase font-mono">
                      {day}
                    </span>
                    <div className="w-7 h-7 rounded-lg bg-[#E9E6DE] dark:bg-[#323833] mx-auto my-1.5 flex items-center justify-center text-[#727D69]">
                      <Shirt className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] font-mono text-[#50564E] dark:text-[#D8D3C8] block truncate">
                      Planned
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 6. PENDING AI WARDROBE REVIEW BANNER */}
          {/* ----------------------------------------------------------- */}
          {pendingReviewItems.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#D8D3C8] dark:border-[#38413A] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#727D69]/15 text-[#727D69] dark:text-[#9EAB97] flex items-center justify-center font-bold text-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                    You have {pendingReviewItems.length} clothing piece(s) awaiting AI review
                  </h3>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">
                    Our EfficientNet-B0 fashion model analyzed your garments. Confirm predictions to unlock them in recommendations.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/wardrobe?tab=pending')}
                className="shrink-0 text-xs self-start sm:self-auto"
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
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                  <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                    Wardrobe Balance
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/insights')}
                  className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline cursor-pointer"
                >
                  Full Analytics →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                <div className="p-3 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F]">
                  <span className="text-[10px] text-[#777C75] dark:text-[#A3ABA0] font-semibold uppercase font-mono">Total Pieces</span>
                  <p className="text-xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1] mt-1">
                    {acceptedItems.length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F]">
                  <span className="text-[10px] text-[#777C75] dark:text-[#A3ABA0] font-semibold uppercase font-mono">Tops / Bottoms</span>
                  <p className="text-xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1] mt-1">
                    {acceptedItems.filter((i) => /top|shirt|tee/i.test(i.category || '')).length} /{' '}
                    {acceptedItems.filter((i) => /jean|bottom|trouser/i.test(i.category || '')).length}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F]">
                  <span className="text-[10px] text-[#777C75] dark:text-[#A3ABA0] font-semibold uppercase font-mono">Capsule Health</span>
                  <p className="text-xl font-bold font-mono text-[#727D69] dark:text-[#9EAB97] mt-1">
                    {acceptedItems.length >= 10 ? '88/100' : '65/100'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shopping Discovery Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                  <h3 className="text-sm font-bold text-[#202321] dark:text-[#F8F6F1]">
                    Wardrobe Gap Essentials
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/wardrobe-gap')}
                  className="text-xs text-[#727D69] dark:text-[#9EAB97] font-semibold hover:underline cursor-pointer"
                >
                  Gap Analysis →
                </button>
              </div>

              {topShoppingProduct ? (
                <div
                  onClick={() => navigate('/wardrobe-gap')}
                  className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] border border-[#E2DDD3] dark:border-[#2D342F] flex items-center gap-3.5 cursor-pointer hover:border-[#727D69] transition-colors"
                >
                  <img
                    src={topShoppingProduct.image_url}
                    alt={topShoppingProduct.title}
                    className="w-14 h-14 rounded-xl object-cover bg-[#E9E6DE] dark:bg-[#323833]"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-[#202321] dark:text-[#F8F6F1] truncate">
                      {topShoppingProduct.title}
                    </p>
                    <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0] font-mono truncate mt-0.5">
                      {topShoppingProduct.brand} · {topShoppingProduct.currency === 'INR' ? '₹' : '$'}
                      {topShoppingProduct.price?.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#727D69] dark:text-[#9EAB97] font-semibold truncate mt-1">
                      Recommended to resolve missing capsule essentials
                    </p>
                  </div>
                </div>
              ) : topGap ? (
                <div className="p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] text-xs space-y-1 border border-[#E2DDD3] dark:border-[#2D342F]">
                  <p className="font-bold text-[#202321] dark:text-[#F8F6F1]">{topGap.title}</p>
                  <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0]">{topGap.reason}</p>
                </div>
              ) : (
                <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] py-4 text-center">
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

        {/* 24-Hour Moments Add / Upload Modal */}
        <AddMomentModal
          isOpen={isAddMomentOpen}
          onClose={() => setIsAddMomentOpen(false)}
          onSuccess={handleMomentCreated}
        />
      </PullToRefresh>
    </AppShell>
  );
};
