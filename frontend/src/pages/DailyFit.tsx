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
  Crown,
  ChevronDown,
  CloudSun,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp, useCurrentUser } from '../context/AppContext';
import { CalendarEvent, Recommendation, ClothingItem } from '../types';
import { api } from '../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';
import { recommendationCache } from '../utils/recommendationCache';
import { CANONICAL_OCCASION_GROUPS, ALL_CANONICAL_OCCASIONS } from '../constants/occasions';

export const OCCASIONS_FULL_LIST = [
  'Everyday',
  'Office',
  'Business Meeting',
  'Presentation',
  'Casual Outing',
  'Weekend Outing',
  'College',
  'Date Night',
  'Dinner',
  'Party & Night Out',
  'Wedding',
  'Gala & Black Tie',
  'Festival & Cultural',
  'Family Gathering',
  'Gym & Workout',
  'Travel & Airport',
  'Custom Occasion',
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

  // Luxury pieces inclusion toggle
  const [includeLuxury, setIncludeLuxury] = useState<boolean>(false);
  const [showAllOccasionsModal, setShowAllOccasionsModal] = useState<boolean>(false);

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
    if (occ === 'Custom occasion' || occ === 'Custom Occasion') {
      setShowCustomModal(true);
      return;
    }
    setShowAllOccasionsModal(false);
    await loadActiveDailyFit(occ, { includeLuxury });
  };

  const handleToggleLuxury = async () => {
    const nextVal = !includeLuxury;
    setIncludeLuxury(nextVal);
    showToast(
      nextVal
        ? 'Special & luxury pieces now eligible for curation.'
        : 'Special & luxury pieces protected in Occasion Vault.',
      'info'
    );
    await regenerateDailyFit(activeOccasion, undefined, { includeLuxury: nextVal });
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
        occasion: 'Custom Occasion',
        customOccasion: customText,
        targetDate: todayStr,
        city: weather?.city || currentUser?.location || undefined,
        includeLuxury,
      });
      if (recs && recs.length > 0) {
        setDailyFit(recs[0]);
        await setActiveOccasion('Custom Occasion');
        showToast(`Curated look for "${customText}"!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Could not curate outfit', 'info');
    }
  };

  // Explicit regeneration of the ONE outfit
  const handleRegenerate = async () => {
    if (isGeneratingDailyFit) return;
    await regenerateDailyFit(activeOccasion, undefined, { includeLuxury });
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
        colors: ['#202321', '#899783', '#727D69', '#E9E6DE'],
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
          <div className="flex items-center justify-between border-b border-[#E2DDD3] dark:border-[#2D342F] pb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('recommendation')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'recommendation'
                    ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] shadow-subtle'
                    : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Today's Recommendation</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('saved_outfits')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'saved_outfits'
                    ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] shadow-subtle'
                    : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26]'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved Looks</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] px-3.5 py-1.5 rounded-xl shadow-subtle text-xs">
                <CloudSun className="w-4 h-4 text-[#727D69] dark:text-[#9EAB97]" />
                <span className="font-semibold font-mono text-[#202321] dark:text-[#F8F6F1]">
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
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1] font-serif">
                  Daily Fit Studio
                </h1>
                <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1 font-mono">
                  {formattedToday} · Calibrated for your routine and lifestyle.
                </p>
              </div>

              {/* Canonical Occasions Selector Pills & Luxury Toggle */}
              <div className="space-y-2">
                <div className="bg-[#F8F6F1] dark:bg-[#242A25] p-2 rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-xs">
                  {/* Luxury Protection Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleLuxury}
                    className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                      includeLuxury
                        ? 'bg-[#899783] text-[#F8F6F1] font-bold shadow-subtle'
                        : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] bg-[#E9E6DE] dark:bg-[#2D342F]'
                    }`}
                    title="Allow special-occasion and luxury attire from Occasion Vault to be recommended"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>{includeLuxury ? 'Vault Unlocked' : 'Vault Shielded'}</span>
                  </button>

                  <div className="h-4 w-px bg-[#D8D3C8] dark:border-[#38413A] mx-1 shrink-0" />

                  <span className="px-1 text-[#777C75] dark:text-[#8E968C] text-[11px] font-bold uppercase tracking-wider shrink-0 font-mono">
                    Occasion:
                  </span>

                  {OCCASIONS_FULL_LIST.map((occ) => {
                    const isSelected = activeOccasion.toLowerCase() === occ.toLowerCase();
                    return (
                      <button
                        key={occ}
                        type="button"
                        onClick={() => handleSelectOccasion(occ)}
                        className={`px-3.5 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] font-semibold shadow-subtle'
                            : 'text-[#50564E] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#E9E6DE] dark:hover:bg-[#2D342F]'
                        }`}
                      >
                        {occ}
                      </button>
                    );
                  })}

                  {/* All Occasions Dialog Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowAllOccasionsModal(true)}
                    className="px-3 py-1.5 rounded-xl font-medium shrink-0 transition-all cursor-pointer text-[#727D69] dark:text-[#9EAB97] bg-[#E9E6DE] dark:bg-[#2D342F] hover:bg-[#D8D3C8] flex items-center gap-1 font-semibold"
                  >
                    <span>Browse All</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Structured Missing Component Alert */}
              {((recommendation?.missingComponents && recommendation.missingComponents.length > 0) ||
                (recommendation?.missing_components && recommendation.missing_components.length > 0)) && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-200">
                        Missing Outfit Component:{' '}
                      </span>
                      <span className="text-amber-800 dark:text-amber-300">
                        {(recommendation.missingComponents || recommendation.missing_components || [])
                          .map((mc) => `${mc.slot.toUpperCase()}: ${mc.reason}`)
                          .join(' · ')}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/wardrobe-gap')}
                    className="shrink-0 text-xs font-semibold"
                  >
                    Explore Gap Solutions →
                  </Button>
                </div>
              )}

              {/* Wardrobe Gap Warning Banner */}
              {gapWarning && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <span className="font-bold text-[#202321] dark:text-[#F8F6F1]">
                        Wardrobe Gap Detected:{' '}
                      </span>
                      <span className="text-[#50564E] dark:text-[#A3ABA0]">{gapWarning}</span>
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
                <div className="text-center py-16 px-6 bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle max-w-lg mx-auto">
                  <Shirt className="w-12 h-12 text-[#777C75] mx-auto mb-3" />
                  <h2 className="text-xl font-bold font-serif text-[#202321] dark:text-[#F8F6F1]">
                    Your Wardrobe is Empty
                  </h2>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1 max-w-sm mx-auto mb-5 leading-relaxed">
                    Upload your shirts, pants, dresses, or shoes. TailorBird styles personalized looks strictly from your actual garments.
                  </p>
                  <Button variant="primary" size="md" onClick={() => navigate('/wardrobe')}>
                    Add Pieces to Wardrobe
                  </Button>
                </div>
              ) : isGenerating ? (
                <div className="text-center py-24 px-6 bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle">
                  <div className="w-12 h-12 rounded-full border-2 border-[#202321]/30 border-t-[#202321] dark:border-[#F8F6F1]/30 dark:border-t-[#F8F6F1] animate-spin mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-[#202321] dark:text-[#F8F6F1] font-serif">
                    Art-Directing Your Look...
                  </h2>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1.5 font-mono">
                    Balancing hue harmony, formality delta, and climate rules for {activeOccasion}.
                  </p>
                </div>
              ) : generationError ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle max-w-lg mx-auto space-y-4">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                    <Info className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold font-serif text-[#202321] dark:text-[#F8F6F1]">Styling Notice</h2>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0]">{generationError}</p>
                  <Button variant="outline" size="md" onClick={handleRegenerate}>
                    Try Again
                  </Button>
                </div>
              ) : recommendation?.status === 'no_items' ? (
                <div className="text-center py-16 px-6 bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle max-w-lg mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#F1EEE7] dark:bg-[#252A26] text-[#727D69] flex items-center justify-center mx-auto">
                    <Shirt className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#202321] dark:text-[#F8F6F1] font-serif">
                      No garments found for {activeOccasion}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-2 max-w-md mx-auto leading-relaxed">
                      {recommendation.emptyReason?.message ||
                        `Your wardrobe has no verified garments matching ${activeOccasion} criteria.`}
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
                        Review Pending Garments
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
                          Upload More Pieces
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
                          Upload Garments
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
                <div className="relative rounded-3xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-soft-lg overflow-hidden">
                  {/* Top Ribbon */}
                  <div className="bg-[#202321] dark:bg-[#141715] px-6 sm:px-8 py-3.5 text-[#F8F6F1] flex items-center justify-between border-b border-[#2E3530]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#899783] animate-pulse" />
                      <span className="text-[11px] font-mono uppercase font-bold tracking-widest text-[#F8F6F1]">
                        Curated Look
                      </span>
                      <span className="text-[#777C75]">·</span>
                      <span className="text-xs text-[#D8D3C8] font-medium">
                        {outfit.occasion || activeOccasion}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-[#F8F6F1] border border-white/20">
                        {recommendation.score}% Affinity Match
                      </span>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="p-6 sm:p-8 space-y-8">
                    {/* Stale Look Alert Banner */}
                    {recommendation.status === 'stale' && (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>One item or setting is no longer current. Refresh to sync with latest wardrobe state.</span>
                        </div>
                        <button
                          onClick={handleRegenerate}
                          className="font-bold underline text-amber-950 dark:text-amber-100 hover:text-amber-700 whitespace-nowrap cursor-pointer"
                        >
                          Refresh suggestion →
                        </button>
                      </div>
                    )}

                    {/* Partial Outfit Alert Banner */}
                    {recommendation.status === 'partial_outfit' && (
                      <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
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
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-5 border-b border-[#E2DDD3] dark:border-[#2D342F]">
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-[#202321] dark:text-[#F8F6F1] tracking-tight font-serif">
                          {outfit.title || `${activeOccasion} Ensemble`}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1">
                          {outfit.description || 'Color-coordinated palette tailored for your day and occasion rules.'}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setWhyModalOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#727D69] dark:text-[#9EAB97] hover:underline cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Why This Look?</span>
                      </button>
                    </div>

                    {/* GARMENT TILES (EDITORIAL CANVASES) */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] font-mono">
                          Outfit Garments ({pieces.length})
                        </span>
                        <span className="text-xs text-[#727D69] dark:text-[#9EAB97] font-mono">
                          Tap card to view garment details
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {pieces.map((piece) => {
                          const pieceImg =
                            resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE;
                          return (
                            <div
                              key={piece.id}
                              className="group rounded-2xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] overflow-hidden hover:border-[#727D69] transition-all cursor-pointer shadow-subtle hover:shadow-soft relative"
                            >
                              <div
                                onClick={() => navigate(`/wardrobe/${piece.id}`)}
                                className="aspect-[3/4] relative overflow-hidden bg-[#E9E6DE] dark:bg-[#1E2320]"
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
                                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white border border-white/20 font-mono">
                                    {piece.category}
                                  </span>
                                </div>
                              </div>

                              <div className="p-3 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-[#202321] dark:text-[#F8F6F1] truncate">
                                    {piece.name}
                                  </p>
                                  <p className="text-[11px] text-[#777C75] dark:text-[#A3ABA0] truncate font-mono">
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
                                  className="p-1.5 rounded-lg hover:bg-[#E9E6DE] dark:hover:bg-[#2D342F] text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] transition-colors ml-1 cursor-pointer"
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
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DDD3] dark:border-[#2D342F]">
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
                            ? 'Partial Outfit'
                            : 'Wear This Outfit'}
                        </Button>

                        {/* 2. Regenerate */}
                        <Button
                          variant="secondary"
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
                          className={isSaved ? 'text-[#727D69] border-[#727D69]' : ''}
                          icon={<Bookmark className="w-4 h-4" />}
                        >
                          {isSaved ? 'Saved' : 'Save Look'}
                        </Button>

                        {/* 5. Not My Style */}
                        <button
                          type="button"
                          onClick={handleNotMyStyle}
                          className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-[#E2DDD3] dark:border-[#2D342F] bg-white dark:bg-[#1C201D] text-[#777C75] dark:text-[#A3ABA0] hover:text-rose-600 transition-all cursor-pointer flex items-center justify-center"
                          title="Not My Style (Adjust recommendations)"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>

                        {/* Love Feedback */}
                        <button
                          type="button"
                          onClick={handleLoveLook}
                          className={`p-2.5 min-h-[44px] min-w-[44px] rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                            isLoved
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600'
                              : 'bg-white dark:bg-[#1C201D] border-[#E2DDD3] dark:border-[#2D342F] text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1]'
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
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#202321] dark:text-[#F8F6F1] font-serif">
                  Saved Outfits Collection
                </h2>
                <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1 font-mono">
                  Your bookmarked styling ensembles for quick daily rotation.
                </p>
              </div>

              {loadingSaved ? (
                <div className="py-20 text-center text-xs text-[#777C75] dark:text-[#A3ABA0]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#727D69]" />
                  Loading your saved outfits...
                </div>
              ) : savedOutfitsList.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] p-6 shadow-subtle">
                  <Bookmark className="w-10 h-10 text-[#777C75] mx-auto mb-2 opacity-50" />
                  <h3 className="font-bold text-[#202321] dark:text-[#F8F6F1] text-base font-serif">
                    No Saved Outfits Yet
                  </h3>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1 max-w-sm mx-auto mb-4 leading-relaxed">
                    When you like a recommended look, tap "Save Look" to keep it here for quick styling.
                  </p>
                  <Button variant="primary" size="sm" onClick={() => setActiveTab('recommendation')}>
                    Curate Today's Look
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedOutfitsList.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] shadow-subtle flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-[#F8F6F1] dark:bg-[#252A26] flex items-center justify-center text-[#727D69]">
                          <Shirt className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#202321] dark:text-[#F8F6F1]">
                            {item.title || 'Saved Ensemble'}
                          </p>
                          <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] font-mono mt-0.5">
                            {item.pieces_count || 3} Pieces · Saved look
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setActiveTab('recommendation');
                          showToast('Loaded saved outfit look!', 'info');
                        }}
                      >
                        Wear Look
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* REPLACE PIECE MODAL */}
        {/* ------------------------------------------------------------- */}
        {replaceModalOpen && selectedPieceToReplace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#202321] dark:text-[#F8F6F1] font-serif">
                    Replace {selectedPieceToReplace.category}
                  </h3>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5 font-mono">
                    Currently: {selectedPieceToReplace.name}
                  </p>
                </div>
                <button
                  onClick={() => setReplaceModalOpen(false)}
                  className="p-1 rounded-full text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {replacementCandidates.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#777C75] dark:text-[#A3ABA0]">
                  No other clean items found in your wardrobe matching category "{selectedPieceToReplace.category}".
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
                  {replacementCandidates.map((cand) => {
                    const candImg =
                      resolveImageUrl(cand.preferredImageUrl || cand.image) || FALLBACK_POST_IMAGE;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => handleApplyReplacement(cand)}
                        className="p-3 rounded-xl border border-[#E2DDD3] dark:border-[#2D342F] hover:border-[#727D69] cursor-pointer flex items-center gap-3 transition-colors group bg-[#F8F6F1] dark:bg-[#242A25]"
                      >
                        <img
                          src={candImg}
                          alt={cand.name}
                          className="w-12 h-12 object-cover rounded-lg bg-[#E9E6DE] dark:bg-[#2D342F]"
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-bold text-[#202321] dark:text-[#F8F6F1] truncate group-hover:underline">
                            {cand.name}
                          </p>
                          <p className="text-[#777C75] dark:text-[#A3ABA0] font-mono truncate">
                            {cand.color} {cand.brand && `· ${cand.brand}`}
                          </p>
                        </div>
                        <span className="text-xs text-[#727D69] dark:text-[#9EAB97] font-bold">Select</span>
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
            <div className="bg-white dark:bg-[#1C201D] rounded-3xl border border-[#E2DDD3] dark:border-[#2D342F] max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#202321] dark:text-[#F8F6F1] font-serif">
                  Custom Styling Occasion
                </h3>
                <button
                  onClick={() => setShowCustomModal(false)}
                  className="p-1 rounded-full text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-[#777C75] dark:text-[#A3ABA0]">
                Describe the event or context (e.g. "Gallery opening", "Rooftop dinner", "Keynote speech"):
              </p>
              <input
                type="text"
                value={customOccasionInput}
                onChange={(e) => setCustomOccasionInput(e.target.value)}
                placeholder="e.g. Gallery opening, Rooftop cocktails"
                className="w-full p-3 rounded-xl border border-[#E2DDD3] dark:border-[#2D342F] bg-[#F8F6F1] dark:bg-[#242A25] text-sm text-[#202321] dark:text-[#F8F6F1] font-sans focus:outline-none focus:border-[#727D69]"
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

        {/* ------------------------------------------------------------- */}
        {/* ALL CANONICAL OCCASIONS MODAL */}
        {/* ------------------------------------------------------------- */}
        <Modal
          isOpen={showAllOccasionsModal}
          onClose={() => setShowAllOccasionsModal(false)}
          title="Browse All Styling Occasions"
        >
          <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
            {CANONICAL_OCCASION_GROUPS.map((group) => (
              <div key={group.categoryKey} className="space-y-2">
                <h4 className="text-[11px] font-bold text-[#777C75] dark:text-[#A3ABA0] uppercase tracking-wider font-mono">
                  {group.name}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.occasions.map((occ) => {
                    const isSelected =
                      activeOccasion.toLowerCase() === occ.name.toLowerCase() ||
                      activeOccasion.toLowerCase() === occ.id;
                    return (
                      <button
                        key={occ.id}
                        type="button"
                        onClick={() => handleSelectOccasion(occ.name)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] border-transparent shadow-subtle'
                            : 'bg-[#F8F6F1] dark:bg-[#242A25] border-[#E2DDD3] dark:border-[#2D342F] hover:bg-[#E9E6DE] text-[#202321] dark:text-[#F8F6F1]'
                        }`}
                      >
                        <span className="font-bold text-xs">{occ.name}</span>
                        <span
                          className={`text-[10px] mt-1 line-clamp-2 ${
                            isSelected
                              ? 'text-[#D8D3C8] dark:text-[#50564E]'
                              : 'text-[#777C75] dark:text-[#A3ABA0]'
                          }`}
                        >
                          {occ.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Modal>

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
