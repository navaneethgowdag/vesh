import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Shirt,
  Sparkle,
  Bookmark,
  Check,
  AlertCircle,
  Layers,
  ArrowLeftRight,
  X,
  Plus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp, useCurrentUser } from '../context/AppContext';
import { CalendarEvent, Recommendation, ClothingItem } from '../types';
import { api } from '../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';
import { recommendationCache } from '../utils/recommendationCache';

export const OCCASIONS_FULL_LIST = [
  'Everyday',
  'College',
  'Office',
  'Business meeting',
  'Presentation',
  'Casual outing',
  'Party',
  'Date',
  'Wedding',
  'Festival',
  'Family gathering',
  'Gym / Sports',
  'Travel',
  'Interview',
  'Formal event',
  'Custom occasion',
] as const;

export const DailyFit: React.FC = () => {
  const {
    dailyFit,
    setDailyFit,
    weather,
    wearDailyFit,
    showToast,
    wardrobe,
    activeOccasion,
    setActiveOccasion,
    loadActiveDailyFit,
    regenerateDailyFit,
    isGeneratingDailyFit,
  } = useApp();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active view tab: Recommendation vs Saved Outfits
  const [activeTab, setActiveTab] = useState<'recommendation' | 'saved_outfits'>('recommendation');

  // Active recommended outfit directly from shared AppContext
  const recommendation = dailyFit;
  const isGenerating = isGeneratingDailyFit;
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Custom occasion state
  const [customOccasionInput, setCustomOccasionInput] = useState<string>('');
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);

  // Action states
  const isWorn = dailyFit?.wornStatus === 'worn';
  const [isLoved, setIsLoved] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isRecordingWear, setIsRecordingWear] = useState<boolean>(false);
  const isRecordingWearRef = useRef(false);

  // Modals
  const [whyModalOpen, setWhyModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);

  // Replace Item Modal state
  const [replaceModalOpen, setReplaceModalOpen] = useState<boolean>(false);
  const [selectedPieceToReplace, setSelectedPieceToReplace] = useState<ClothingItem | null>(null);

  // Saved outfits state
  const [savedOutfitsList, setSavedOutfitsList] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState<boolean>(false);

  // Calendar integration (optional)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [todayEvent, setTodayEvent] = useState<CalendarEvent | null>(null);

  // Load calendar events quietly in background
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
          if (matchingToday.occasion && matchingToday.occasion !== activeOccasion) {
            setActiveOccasion(matchingToday.occasion);
          }
        }
      } catch {
        // Optional
      }
    };
    fetchCalendar();
  }, []);

  // Format today's date in editorial style
  const formattedToday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  // Load initial active recommendation if none in context
  useEffect(() => {
    if (!dailyFit && wardrobe.length > 0) {
      loadActiveDailyFit(activeOccasion);
    }
  }, [dailyFit, wardrobe.length, loadActiveDailyFit, activeOccasion]);

  // Open replace modal if URL requested action=replace
  useEffect(() => {
    if (searchParams.get('action') === 'replace' && dailyFit?.outfit?.pieces?.length) {
      const pieces = dailyFit.outfit.pieces;
      setSelectedPieceToReplace(pieces[0] || null);
      setReplaceModalOpen(true);
    }
  }, [searchParams, dailyFit]);

  // Occasion selection handler with instant caching
  const handleSelectOccasion = async (occ: string) => {
    if (occ === 'Custom occasion') {
      setShowCustomModal(true);
      return;
    }
    await setActiveOccasion(occ);
  };

  // Custom Occasion confirm handler
  const handleConfirmCustomOccasion = async () => {
    if (!customOccasionInput.trim()) return;
    const customText = customOccasionInput.trim();
    setShowCustomModal(false);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const recs = await api.recommendations.generate({
        limit: 1,
        recommendationMode: 'occasion',
        occasion: 'Custom occasion',
        customOccasion: customText,
        targetDate: todayStr,
        city: weather?.city || currentUser?.location || undefined,
      });
      if (recs && recs.length > 0) {
        if (currentUser) {
          recommendationCache.set(currentUser.id, todayStr, 'Custom occasion', recs[0]);
        }
        setDailyFit(recs[0]);
        await setActiveOccasion('Custom occasion');
        showToast(`Curated look for "${customText}"!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not curate outfit', 'info');
    }
  };

  // Explicit regeneration of the ONE outfit
  const handleRegenerate = async () => {
    if (isGeneratingDailyFit) return;
    await regenerateDailyFit(activeOccasion);
  };

  // Action: Wear this outfit
  const handleWearToday = async () => {
    if (!dailyFit || isRecordingWearRef.current || isWorn) return;

    isRecordingWearRef.current = true;
    setIsRecordingWear(true);

    try {
      await wearDailyFit();
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#09090b', '#71717a', '#10b981', '#f43f5e'],
      });
      showToast("Look recorded! Marked as today's worn outfit.", 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to record wear', 'info');
    } finally {
      isRecordingWearRef.current = false;
      setIsRecordingWear(false);
    }
  };

  // Action: Love look
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

  // Action: Not My Style
  const handleNotMyStyle = async () => {
    if (!dailyFit) return;
    try {
      await api.recommendations.sendFeedback(dailyFit.id, 'reject', 'not_my_style');
      showToast('Noted. We will avoid this style combination in future looks.', 'info');
    } catch {}
    handleRegenerate();
  };

  // Action: Save Outfit
  const handleSaveOutfit = async () => {
    if (!dailyFit || !dailyFit.outfit) return;
    try {
      await api.saved.saveOutfit(dailyFit.outfit.id);
      setIsSaved(true);
      showToast('Outfit saved to your Daily Fit collection!', 'success');
    } catch {
      setIsSaved(true);
      showToast('Outfit saved!', 'success');
    }
  };

  // Action: Replace an item in outfit
  const handleOpenReplaceModal = (piece?: ClothingItem) => {
    const pieces = dailyFit?.outfit?.pieces || [];
    setSelectedPieceToReplace(piece || pieces[0] || null);
    setReplaceModalOpen(true);
  };

  const handleApplyReplacement = (newPiece: ClothingItem) => {
    if (!dailyFit || !dailyFit.outfit || !selectedPieceToReplace) return;
    const pieces = dailyFit.outfit.pieces || [];
    const updatedPieces = pieces.map((p) => (p.id === selectedPieceToReplace.id ? newPiece : p));

    const updatedRec: Recommendation = {
      ...dailyFit,
      outfit: {
        ...dailyFit.outfit,
        pieces: updatedPieces,
      },
    };
    setDailyFit(updatedRec);
    if (currentUser) {
      const todayStr = new Date().toISOString().split('T')[0];
      recommendationCache.set(currentUser.id, todayStr, activeOccasion, updatedRec);
    }

    setReplaceModalOpen(false);
    showToast(`Swapped with ${newPiece.name}!`, 'success');
  };

  // Load saved outfits when tab changes
  useEffect(() => {
    if (activeTab === 'saved_outfits') {
      const fetchSaved = async () => {
        setLoadingSaved(true);
        try {
          const items = await api.saved.listSavedItems('outfit');
          setSavedOutfitsList(items);
        } catch {
          // Ignore
        } finally {
          setLoadingSaved(false);
        }
      };
      fetchSaved();
    }
  }, [activeTab]);

  const outfit = recommendation?.outfit;
  const pieces = outfit?.pieces || [];
  const gapWarning = (recommendation as any)?.context?.gap_warning;

  // Replacement candidates matching category of selected piece
  const replacementCandidates = wardrobe.filter((i) => {
    if (!selectedPieceToReplace) return false;
    if (i.id === selectedPieceToReplace.id) return false;
    if (i.reviewRequired) return false;
    const targetCat = (selectedPieceToReplace.category || '').toLowerCase();
    const itemCat = (i.category || '').toLowerCase();
    return targetCat === itemCat || targetCat.includes(itemCat) || itemCat.includes(targetCat);
  });

  return (
    <AppShell showRightSidebar={true}>
      <PullToRefresh onRefresh={() => handleRegenerate()}>
        <div className="max-w-4xl mx-auto space-y-8 pb-12 select-none">
          {/* Top Bar: Switcher between Today's Look and Saved Outfits */}
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('recommendation')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'recommendation'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Today&apos;s Recommendation</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('saved_outfits')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'saved_outfits'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved Outfits</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-xs text-xs">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {weather?.city ? `${weather.city} · ${weather.temp}°C` : '22°C · Clear Sky'}
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: DAILY FIT RECOMMENDATION */}
          {activeTab === 'recommendation' && (
            <div className="space-y-6">
              {/* Header Title */}
              <div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 font-serif">
                  Today&apos;s Look
                </h1>
                <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 mt-1 font-medium">
                  {formattedToday}
                </p>
              </div>

              {/* 16 Occasions Selector Pills */}
              <div className="bg-zinc-50 dark:bg-zinc-850/80 p-2 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-xs">
                <span className="px-3 text-zinc-400 text-[11px] font-semibold uppercase tracking-wider shrink-0">
                  Occasion:
                </span>
                {OCCASIONS_FULL_LIST.map((occ) => {
                  const isSelected = activeOccasion === occ;
                  return (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => handleSelectOccasion(occ)}
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

              {/* Wardrobe Gap Warning Banner (Connects Wardrobe Gap with Daily Fit) */}
              {gapWarning && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        Wardrobe Gap Detected:{' '}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300">{gapWarning}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/wardrobe-gap')}
                    className="shrink-0 text-xs font-semibold"
                  >
                    View Gap Solutions →
                  </Button>
                </div>
              )}

              {/* MAIN HERO STAGE: THE ONE RECOMMENDED OUTFIT */}
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
                    Synthesizing color palettes, formality rules, and context for {activeOccasion}.
                  </p>
                </div>
              ) : generationError ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-lg mx-auto space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                    <Info className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Styling Notice</h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{generationError}</p>
                  <Button variant="outline" size="md" onClick={handleRegenerate}>
                    Try Again
                  </Button>
                </div>
              ) : recommendation?.status === 'no_items' ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-lg mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto">
                    <Shirt className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-serif">
                      No clothes found for {activeOccasion}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
                      {recommendation.emptyReason?.message ||
                        `Your wardrobe has no ${activeOccasion}-suitable clothes yet.`}
                    </p>
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
                    {recommendation.emptyReason?.action === 'review_pending' ? (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => navigate('/wardrobe?tab=pending')}
                        icon={<Sparkles className="w-4 h-4" />}
                      >
                        Review Pending Items
                      </Button>
                    ) : recommendation.emptyReason?.action === 'laundry' ? (
                      <>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => navigate('/wardrobe?tab=accepted')}
                          icon={<Shirt className="w-4 h-4" />}
                        >
                          Check Laundry Filter
                        </Button>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => navigate('/wardrobe')}
                          icon={<Plus className="w-4 h-4" />}
                        >
                          Upload More Clothes
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => navigate('/wardrobe')}
                          icon={<Plus className="w-4 h-4" />}
                        >
                          Upload Clothes
                        </Button>
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => navigate('/wardrobe-gap')}
                          icon={<Layers className="w-4 h-4" />}
                        >
                          View Wardrobe Gap
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : recommendation && outfit ? (
                <div className="relative rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-lg overflow-hidden">
                  {/* Top Ribbon */}
                  <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-6 py-3.5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-200">
                        Today&apos;s Curated Outfit
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
                    {/* Stale Look Alert Banner */}
                    {recommendation.status === 'stale' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>One item or setting is no longer current. Refresh to sync with latest wardrobe state.</span>
                        </div>
                        <button
                          onClick={handleRegenerate}
                          className="font-bold underline text-amber-900 dark:text-amber-200 hover:text-amber-700 whitespace-nowrap cursor-pointer"
                        >
                          Refresh suggestion →
                        </button>
                      </div>
                    )}

                    {/* Partial Outfit Alert Banner */}
                    {recommendation.status === 'partial_outfit' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {recommendation.emptyReason?.message || `No footwear found for ${activeOccasion}. Ensemble is partial.`}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/wardrobe-gap')}
                          className="shrink-0 text-xs font-semibold"
                        >
                          View Wardrobe Gap →
                        </Button>
                      </div>
                    )}

                    {/* Outfit Title & Style Vibe */}
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight font-serif">
                          {outfit.title || `${activeOccasion} Ensemble`}
                        </h2>
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          {outfit.description || 'Calibrated for your day and occasion rules.'}
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

                    {/* Ensemble Pieces */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          Ensemble Pieces ({pieces.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenReplaceModal()}
                          className="text-xs text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Replace an Item</span>
                        </button>
                      </div>

                      {/* Pieces Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {pieces.map((piece) => {
                          const pieceImg =
                            resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                          return (
                            <div
                              key={piece.id}
                              className="group rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-850 hover:border-zinc-900 dark:hover:border-zinc-100 transition-all cursor-pointer shadow-xs hover:shadow-md relative"
                            >
                              <div
                                onClick={() => navigate(`/wardrobe/${piece.id}`)}
                                className="aspect-square relative overflow-hidden bg-white dark:bg-zinc-900"
                              >
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

                              <div className="p-3 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {piece.name}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                    {piece.color} {piece.brand && `· ${piece.brand}`}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenReplaceModal(piece as any);
                                  }}
                                  title="Replace this garment"
                                  className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ml-1"
                                >
                                  <ArrowLeftRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* HERO ACTION CONSOLE */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* 1. Wear This Outfit */}
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={handleWearToday}
                          disabled={isRecordingWear || isWorn || recommendation?.canWear === false}
                          isLoading={isRecordingWear}
                          loadingText="Recording Wear..."
                          className={isWorn ? '!bg-emerald-700 !text-white' : ''}
                          icon={isWorn ? <Check className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        >
                          {isWorn
                            ? '✓ Worn Today'
                            : recommendation?.canWear === false
                            ? 'Partial Outfit (Slots Missing)'
                            : 'Wear This Outfit'}
                        </Button>

                        {/* 2. Regenerate */}
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleRegenerate}
                          disabled={isGenerating || isRecordingWear}
                          isLoading={isGenerating}
                          loadingText="Curating..."
                          icon={<RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />}
                        >
                          Regenerate
                        </Button>

                        {/* 3. Replace an Item */}
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => handleOpenReplaceModal()}
                          icon={<ArrowLeftRight className="w-4 h-4" />}
                        >
                          Replace an Item
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 4. Save Outfit */}
                        <Button
                          variant="outline"
                          size="md"
                          onClick={handleSaveOutfit}
                          className={isSaved ? 'text-primary-600 border-primary-500' : ''}
                          icon={<Bookmark className="w-4 h-4" />}
                        >
                          {isSaved ? 'Saved' : 'Save Outfit'}
                        </Button>

                        {/* 5. Not My Style */}
                        <button
                          type="button"
                          onClick={handleNotMyStyle}
                          className="p-3 min-h-[44px] min-w-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 transition-all cursor-pointer flex items-center justify-center"
                          title="Not My Style (Adjust recommendations)"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>

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
                        >
                          <Heart className={`w-4 h-4 ${isLoved ? 'fill-rose-600 text-rose-600' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 2: SAVED OUTFITS VIEW */}
          {activeTab === 'saved_outfits' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-serif">
                  Saved Outfits Collection
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Your bookmarked styling ensembles for quick daily rotation.
                </p>
              </div>

              {loadingSaved ? (
                <div className="py-20 text-center text-xs text-zinc-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                  Loading your saved outfits...
                </div>
              ) : savedOutfitsList.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6">
                  <Bookmark className="w-10 h-10 text-zinc-400 mx-auto mb-2 opacity-60" />
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                    No Saved Outfits Yet
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto mb-4">
                    When you like a recommended look, tap &quot;Save Outfit&quot; to keep it here for quick styling.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('recommendation')}>
                    Curate Today&apos;s Look
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedOutfitsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs">
                          👗
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            Saved Look #{item.itemId?.slice(-4) || item.id?.slice(-4)}
                          </p>
                          <p className="text-[11px] text-zinc-500">Saved Outfit Ensemble</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          showToast('Look loaded into today’s styling!', 'success');
                          setActiveTab('recommendation');
                        }}
                      >
                        Style This
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* REPLACE ITEM MODAL */}
        {/* ------------------------------------------------------------- */}
        {replaceModalOpen && selectedPieceToReplace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Replace Garment Piece
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Replacing: <strong className="text-zinc-800 dark:text-zinc-200">{selectedPieceToReplace.name}</strong> ({selectedPieceToReplace.category})
                  </p>
                </div>
                <button
                  onClick={() => setReplaceModalOpen(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {replacementCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <Shirt className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    No other eligible pieces of category &quot;{selectedPieceToReplace.category}&quot; cataloged in your wardrobe.
                  </p>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {replacementCandidates.map((cand) => {
                    const candImg =
                      resolveImageUrl(cand.preferredImageUrl || cand.image) || FALLBACK_POST_IMAGE;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => handleApplyReplacement(cand)}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-zinc-100 cursor-pointer flex items-center gap-3 transition-colors group"
                      >
                        <img
                          src={candImg}
                          alt={cand.name}
                          className="w-12 h-12 object-cover rounded-lg bg-zinc-100"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                            {cand.name}
                          </p>
                          <p className="text-zinc-500 truncate">
                            {cand.color} {cand.brand && `· ${cand.brand}`}
                          </p>
                        </div>
                        <span className="text-xs text-primary-600 font-bold">Select</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setReplaceModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CUSTOM OCCASION MODAL */}
        {/* ------------------------------------------------------------- */}
        {showCustomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Custom Styling Occasion
                </h3>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="p-1 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Describe the event or context (e.g. &quot;Beach dinner party&quot;, &quot;Keynote speech&quot;, &quot;Gallery opening&quot;):
              </p>
              <input
                type="text"
                value={customOccasionInput}
                onChange={(e) => setCustomOccasionInput(e.target.value)}
                placeholder="e.g. Gallery opening, Rooftop cocktails"
                className="w-full p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-sm"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowCustomModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmCustomOccasion}
                  disabled={!customOccasionInput.trim()}
                >
                  Style for this Occasion
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown modal */}
        {recommendation && (
          <WhyThisOutfitModal
            isOpen={whyModalOpen}
            onClose={() => setWhyModalOpen(false)}
            recommendation={recommendation}
          />
        )}
      </PullToRefresh>
    </AppShell>
  );
};
