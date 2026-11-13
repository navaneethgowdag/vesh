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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#DCD4CC] dark:border-[#392F3E]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-[#743C49] dark:text-[#D5A6A0]">
                  Personal Atelier Stylist
                </span>
                <span className="text-[#B49B82]">·</span>
                <span className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] font-sans">
                  {formattedDate}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight leading-tight">
                <span>{getGreeting()},</span>{' '}
                <span className="italic font-normal font-serif text-[#743C49] dark:text-[#D5A6A0]">
                  {currentUser?.name?.split(' ')[0] || 'Member'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1.5 font-sans">
                Your bespoke daily wardrobe recommendation is calibrated and ready.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Weather Chip */}
              <div className="flex items-center gap-2.5 bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] px-3.5 py-1.5 rounded-[2px] shadow-xs text-xs font-sans">
                <CloudSun className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                <span className="font-semibold text-[#29202B] dark:text-[#F3EEE8] font-mono">
                  {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Clear'}
                </span>
              </div>

              {/* Notification Bell */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] bg-[#FFFFFF] dark:bg-[#241D27] text-[#6D7068] dark:text-[#A89E9B] hover:text-[#29202B] dark:hover:text-[#F3EEE8] transition-colors cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#A33D42] ring-2 ring-white dark:ring-[#241D27]" />
                )}
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* 2. PRIMARY HERO: TODAY'S CURATED LOOK (CENTERPIECE) */}
          {/* ----------------------------------------------------------- */}
          <div className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-sm overflow-hidden transition-all">
            {/* Editorial Header Ribbon */}
            <div className="bg-[#29202B] dark:bg-[#1A151C] px-6 sm:px-8 py-3.5 text-[#F3EEE8] flex items-center justify-between border-b border-[#392F3E]">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#743C49] animate-pulse" />
                <span className="text-[10px] font-sans font-semibold uppercase tracking-[0.2em] text-[#F3EEE8]">
                  Today's Curated Look
                </span>
                <span className="text-[#6D7068]">·</span>
                <span className="text-xs text-[#DCD4CC] font-serif italic">
                  {activeOccasion || outfit?.occasion || 'Everyday Capsule'}
                </span>
              </div>
              {dailyFit && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[2px] bg-white/10 dark:bg-white/10 text-[#F3EEE8] border border-white/20">
                  {dailyFit.score}% Affinity Match
                </span>
              )}
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {wardrobe.length === 0 ? (
                <div className="text-center py-12 space-y-3.5">
                  <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto text-[#743C49] dark:text-[#D5A6A0]">
                    <Shirt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl text-[#29202B] dark:text-[#F3EEE8]">
                      Your Wardrobe is Waiting
                    </h3>
                    <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] max-w-sm mx-auto mt-1 font-sans">
                      Upload your clothing pieces to activate personal AI daily styling recommendations.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => navigate('/wardrobe')}
                    className="font-sans uppercase tracking-[0.14em] text-xs"
                  >
                    Upload Your First Piece
                  </Button>
                </div>
              ) : isGeneratingDailyFit && !dailyFit ? (
                <div className="text-center py-14 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-[#743C49] border-t-transparent animate-spin mx-auto" />
                  <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans uppercase tracking-[0.14em]">
                    Art-directing your personal ensemble...
                  </p>
                </div>
              ) : dailyFit?.status === 'no_items' ? (
                <div className="text-center py-12 space-y-3.5">
                  <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto text-[#743C49] dark:text-[#D5A6A0]">
                    <Shirt className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl text-[#29202B] dark:text-[#F3EEE8]">
                      No suitable pieces found for {activeOccasion || 'Everyday'}
                    </h3>
                    <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] max-w-sm mx-auto mt-1 font-sans">
                      {dailyFit.emptyReason?.message ||
                        `Your wardrobe has no verified items suitable for ${activeOccasion || 'Everyday'} yet.`}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    {dailyFit.emptyReason?.action === 'review_pending' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/wardrobe?tab=pending')}
                        className="font-sans uppercase tracking-[0.12em] text-xs"
                      >
                        Review Pending Garments
                      </Button>
                    ) : dailyFit.emptyReason?.action === 'laundry' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/wardrobe?tab=accepted')}
                        className="font-sans uppercase tracking-[0.12em] text-xs"
                      >
                        Check Clean / Laundry Status
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate('/wardrobe')}
                          className="font-sans uppercase tracking-[0.12em] text-xs"
                        >
                          Add Clothing Pieces
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/wardrobe-gap')}
                          className="font-sans uppercase tracking-[0.12em] text-xs"
                        >
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
                    <div className="p-3.5 bg-[#FAF6F0] dark:bg-[#1A151C] border border-amber-500/40 rounded-[2px] flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-900 dark:text-amber-200 font-sans">
                        Wardrobe or preferences updated since this look was generated.
                      </span>
                      <button
                        onClick={handleRegenerate}
                        className="font-semibold underline text-[#743C49] dark:text-[#D5A6A0] hover:text-[#5E303B] whitespace-nowrap cursor-pointer font-sans"
                      >
                        Refresh Look →
                      </button>
                    </div>
                  )}

                  {dailyFit?.status === 'partial_outfit' && (
                    <div className="p-3.5 bg-[#FAF6F0] dark:bg-[#1A151C] border border-amber-500/40 rounded-[2px] flex items-center justify-between gap-3 text-xs">
                      <span className="text-amber-900 dark:text-amber-200 font-sans">
                        {dailyFit.emptyReason?.message || `No footwear found for ${activeOccasion}. Ensemble is partial.`}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/wardrobe-gap')}
                        className="shrink-0 text-xs font-semibold font-sans uppercase tracking-[0.12em]"
                      >
                        View Gap Essentials →
                      </Button>
                    </div>
                  )}

                  {/* Look Header & Stylist Note */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
                        <span>{outfit.title || "Curated Contemporary Look"}</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] mt-1 leading-relaxed font-sans">
                        {dailyFit?.reasons?.[0] || 'Color-coordinated palette tailored for your lifestyle and ambient temperature.'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-semibold self-start sm:self-auto text-[#743C49] dark:text-[#D5A6A0] font-sans"
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
                          className="rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] overflow-hidden bg-[#FAF6F0] dark:bg-[#1A151C] cursor-pointer group hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-all duration-200 shadow-xs"
                        >
                          <div className="aspect-[3/4] bg-[#F3EEE8] dark:bg-[#1A151C] overflow-hidden relative">
                            <img
                              src={pieceImg}
                              alt={piece.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                            />
                            {piece.color && (
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-[1px] bg-black/70 backdrop-blur-xs text-[9px] font-sans uppercase tracking-[0.14em] text-white">
                                {piece.color}
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[10px] font-sans font-semibold uppercase tracking-[0.14em] text-[#743C49] dark:text-[#D5A6A0] truncate">
                              {piece.category || 'Piece'}
                            </p>
                            <p className="text-xs font-semibold text-[#29202B] dark:text-[#F3EEE8] truncate mt-0.5 font-sans">
                              {piece.name}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Toolbar */}
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#DCD4CC] dark:border-[#392F3E]">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={handleWearToday}
                        disabled={isRecordingWear || isWorn || dailyFit?.canWear === false}
                        className={`${isWorn ? '!bg-emerald-700 !text-white' : ''} font-sans uppercase tracking-[0.14em] text-xs`}
                        icon={isWorn ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                      >
                        {isWorn ? '✓ Worn Today' : dailyFit?.canWear === false ? 'Partial Look' : 'Wear This Outfit'}
                      </Button>

                      <Button
                        variant="secondary"
                        size="md"
                        onClick={handleRegenerate}
                        disabled={isGeneratingDailyFit}
                        className="font-sans uppercase tracking-[0.12em] text-xs"
                        icon={<RefreshCw className={`w-3.5 h-3.5 ${isGeneratingDailyFit ? 'animate-spin' : ''}`} />}
                      >
                        Regenerate
                      </Button>

                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => navigate('/daily-fit')}
                        className="font-sans uppercase tracking-[0.12em] text-xs"
                        icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
                      >
                        Swap a Piece
                      </Button>
                    </div>

                    <button
                      onClick={() => navigate('/daily-fit')}
                      className="text-xs font-sans font-semibold text-[#743C49] dark:text-[#D5A6A0] hover:underline flex items-center gap-1 cursor-pointer"
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
          <div className="rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                  24-Hour Moments
                </h3>
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded-[1px] bg-[#FAF6F0] dark:bg-[#1A151C] text-[#743C49] dark:text-[#D5A6A0] border border-[#DCD4CC] dark:border-[#392F3E] uppercase tracking-[0.12em]">
                  Ephemeral
                </span>
              </div>
              <button
                onClick={() => setIsAddMomentOpen(true)}
                className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-sans font-semibold hover:underline flex items-center gap-1 cursor-pointer uppercase tracking-[0.1em]"
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
                    className={`w-16 h-16 rounded-[4px] p-0.5 ${
                      myMoments.length > 0
                        ? 'bg-[#743C49] dark:bg-[#D5A6A0]'
                        : 'border-2 border-dashed border-[#DCD4CC] dark:border-[#392F3E]'
                    }`}
                  >
                    <div className="w-full h-full rounded-[2px] bg-white dark:bg-[#241D27] overflow-hidden flex items-center justify-center">
                      {myMoments.length > 0 ? (
                        <img
                          src={resolveImageUrl(myMoments[0].imageUrl) || FALLBACK_POST_IMAGE}
                          alt="Your Moment"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : currentUser?.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-6 h-6 text-[#6D7068]" />
                      )}
                    </div>
                  </div>
                  {myMoments.length === 0 ? (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-[2px] bg-[#29202B] dark:bg-[#F3EEE8] text-white dark:text-[#29202B] flex items-center justify-center shadow-xs">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-[1px] bg-[#29202B]/90 text-[9px] font-sans font-bold text-white uppercase">
                      You
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-sans font-medium text-[#6D7068] dark:text-[#A89E9B] max-w-[68px] truncate text-center">
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
                      <div className="w-16 h-16 rounded-[4px] p-0.5 bg-[#DCD4CC] dark:bg-[#392F3E] group-hover:bg-[#743C49] transition-colors shadow-xs">
                        <div className="w-full h-full rounded-[2px] bg-white dark:bg-[#241D27] overflow-hidden">
                          <img
                            src={resolveImageUrl(m.imageUrl) || FALLBACK_POST_IMAGE}
                            alt={m.user.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-[1px] bg-[#29202B]/90 text-[9px] font-mono font-bold text-white shadow-xs">
                        {hoursLeft}h
                      </div>
                    </div>
                    <span className="text-[11px] font-sans font-medium text-[#6D7068] dark:text-[#A89E9B] max-w-[68px] truncate text-center">
                      {m.user.name.split(' ')[0]}
                    </span>
                  </div>
                );
              })}

              {moments.length === 0 && myMoments.length === 0 && (
                <div className="flex items-center gap-2 pl-2 text-xs text-[#6D7068] dark:text-[#A89E9B] italic font-serif">
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
            <div className="p-6 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                  <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                    Upcoming Events
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/calendar')}
                  className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-sans font-semibold hover:underline cursor-pointer uppercase tracking-[0.1em]"
                >
                  View Calendar →
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
                  <Calendar className="w-6 h-6 mx-auto mb-1 opacity-40 text-[#743C49]" />
                  <p>No calendar events scheduled this week.</p>
                  <button
                    onClick={() => navigate('/calendar')}
                    className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-semibold hover:underline mt-1 block mx-auto cursor-pointer"
                  >
                    + Schedule an Event
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#29202B] dark:text-[#F3EEE8] font-sans">{evt.title}</p>
                        <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] font-sans mt-0.5">
                          {evt.eventDate} · {evt.occasion || 'General'}
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-[1px] font-sans font-semibold uppercase tracking-[0.1em] bg-[#FFFFFF] dark:bg-[#241D27] text-[#743C49] dark:text-[#D5A6A0] border border-[#DCD4CC] dark:border-[#392F3E]">
                        {evt.outfitId ? 'Outfit Ready' : 'Styling Auto'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Styling Preview Strip */}
            <div className="p-6 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                  <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                    Weekly Outfit Planner
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/planner')}
                  className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-sans font-semibold hover:underline cursor-pointer uppercase tracking-[0.1em]"
                >
                  Open Planner →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    onClick={() => navigate('/planner')}
                    className="p-2.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] cursor-pointer hover:border-[#743C49] transition-colors"
                  >
                    <span className="text-[10px] font-sans font-semibold text-[#6D7068] dark:text-[#A89E9B] uppercase tracking-[0.1em]">
                      {day}
                    </span>
                    <div className="w-7 h-7 rounded-[2px] bg-white dark:bg-[#241D27] border border-[#DCD4CC]/60 dark:border-[#392F3E] mx-auto my-1.5 flex items-center justify-center text-[#743C49] dark:text-[#D5A6A0]">
                      <Shirt className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[9px] font-sans text-[#6D7068] dark:text-[#A89E9B] block truncate">
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
            <div className="p-5 rounded-[4px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[2px] bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center font-bold text-sm shrink-0 border border-[#743C49]/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                    You have {pendingReviewItems.length} clothing piece(s) awaiting AI review
                  </h3>
                  <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] mt-0.5 font-sans">
                    Our EfficientNet-B0 fashion model analyzed your garments. Confirm predictions to unlock them in recommendations.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/wardrobe?tab=pending')}
                className="shrink-0 text-xs self-start sm:self-auto font-sans uppercase tracking-[0.14em]"
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
            <div className="p-6 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                  <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                    Wardrobe Balance
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/insights')}
                  className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-sans font-semibold hover:underline cursor-pointer uppercase tracking-[0.1em]"
                >
                  Full Analytics →
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-sans">
                <div className="p-3 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                  <span className="text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-semibold uppercase tracking-[0.1em]">Total Pieces</span>
                  <p className="text-xl font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] mt-1">
                    {acceptedItems.length}
                  </p>
                </div>
                <div className="p-3 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                  <span className="text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-semibold uppercase tracking-[0.1em]">Tops / Bottoms</span>
                  <p className="text-xl font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] mt-1">
                    {acceptedItems.filter((i) => /top|shirt|tee/i.test(i.category || '')).length} /{' '}
                    {acceptedItems.filter((i) => /jean|bottom|trouser/i.test(i.category || '')).length}
                  </p>
                </div>
                <div className="p-3 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E]">
                  <span className="text-[10px] text-[#6D7068] dark:text-[#A89E9B] font-semibold uppercase tracking-[0.1em]">Capsule Health</span>
                  <p className="text-xl font-serif font-bold text-[#743C49] dark:text-[#D5A6A0] mt-1">
                    {acceptedItems.length >= 10 ? '88/100' : '65/100'}
                  </p>
                </div>
              </div>
            </div>

            {/* Shopping Discovery Card */}
            <div className="p-6 rounded-[4px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#743C49] dark:text-[#D5A6A0]" />
                  <h3 className="text-sm font-serif font-bold text-[#29202B] dark:text-[#F3EEE8]">
                    Wardrobe Gap Essentials
                  </h3>
                </div>
                <button
                  onClick={() => navigate('/wardrobe-gap')}
                  className="text-xs text-[#743C49] dark:text-[#D5A6A0] font-sans font-semibold hover:underline cursor-pointer uppercase tracking-[0.1em]"
                >
                  Gap Analysis →
                </button>
              </div>

              {topShoppingProduct ? (
                <div
                  onClick={() => navigate('/wardrobe-gap')}
                  className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-3.5 cursor-pointer hover:border-[#743C49] transition-colors"
                >
                  <img
                    src={topShoppingProduct.image_url}
                    alt={topShoppingProduct.title}
                    className="w-14 h-14 rounded-[2px] object-cover bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC]"
                  />
                  <div className="flex-1 min-w-0 text-xs font-sans">
                    <p className="font-semibold text-[#29202B] dark:text-[#F3EEE8] truncate">
                      {topShoppingProduct.title}
                    </p>
                    <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] font-mono truncate mt-0.5">
                      {topShoppingProduct.brand} · {topShoppingProduct.currency === 'INR' ? '₹' : '$'}
                      {topShoppingProduct.price?.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[#743C49] dark:text-[#D5A6A0] font-semibold truncate mt-1 uppercase tracking-[0.08em]">
                      Recommended to resolve missing capsule essentials
                    </p>
                  </div>
                </div>
              ) : topGap ? (
                <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#1A151C] text-xs space-y-1 border border-[#DCD4CC] dark:border-[#392F3E] font-sans">
                  <p className="font-semibold text-[#29202B] dark:text-[#F3EEE8]">{topGap.title}</p>
                  <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B]">{topGap.reason}</p>
                </div>
              ) : (
                <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] py-4 text-center font-sans">
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
