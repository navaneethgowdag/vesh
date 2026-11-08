import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  Bookmark,
  Share2,
  Info,
  CheckCircle,
  Calendar as CalendarIcon,
  Thermometer,
  Compass,
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  Palette,
  ShieldCheck,
  Heart,
  ThumbsDown,
  X,
  SlidersHorizontal,
  CloudSun,
  Layers,
  Sparkle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { WhyThisOutfitModal } from '../components/recommendation/WhyThisOutfitModal';
import { ShareModal } from '../components/social/ShareModal';
import { ScheduleOutfitModal } from '../components/recommendation/ScheduleOutfitModal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { Occasion, Post, CalendarEvent, Recommendation } from '../types';
import { api } from '../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

export const CONTROLLED_OCCASIONS = [
  'Office / Work',
  'Casual outing',
  'Date',
  'Party',
  'Wedding / Function',
  'Sports / Gym',
  'Travel',
  'College',
  'Traditional / Festival',
  'Dinner',
  'Interview',
  'Family gathering',
  'Custom occasion',
] as const;

type ControlledOccasionType = (typeof CONTROLLED_OCCASIONS)[number];

export const DailyFit: React.FC = () => {
  const {
    dailyFit,
    dailyFitHistory,
    weather,
    wearDailyFit,
    cycleDailyFit,
    showToast,
    currentUser,
    wardrobe,
  } = useApp();

  const navigate = useNavigate();

  // Navigation / Recommendation Paths
  // 'occasion' = Path B (Manual occasion)
  // 'general' = Path C ('Suggest an outfit for me')
  // 'calendar' = Path A (Calendar-assisted)
  const [recommendationPath, setRecommendationPath] = useState<'occasion' | 'general' | 'calendar'>('occasion');

  // Path B: Occasion & Context States
  const [chosenOccasion, setChosenOccasion] = useState<ControlledOccasionType>('Office / Work');
  const [customOccasionText, setCustomOccasionText] = useState<string>('');
  const [targetDateChoice, setTargetDateChoice] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [customDateValue, setCustomDateValue] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dressCode, setDressCode] = useState<string>('');
  const [outfitPreference, setOutfitPreference] = useState<string>('any');
  const [weatherPreference, setWeatherPreference] = useState<'automatic' | 'ignore'>('automatic');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Path A: Calendar Events States
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [calendarOccasionOverride, setCalendarOccasionOverride] = useState<string>('');
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);

  // Multi-candidate recommendation states
  const [candidateRecommendations, setCandidateRecommendations] = useState<Recommendation[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Acceptance & Action states
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState<boolean>(false);
  const [wornSuccess, setWornSuccess] = useState<boolean>(false);
  const [isLikedSuccess, setIsLikedSuccess] = useState<boolean>(false);

  // Modals & Feedback
  const [whyModalOpen, setWhyModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active outfit to display
  const currentRecommendation =
    candidateRecommendations.length > 0
      ? candidateRecommendations[activeCandidateIndex]
      : dailyFit;

  // Resolve target date string
  const getResolvedTargetDate = (): string => {
    if (targetDateChoice === 'today') {
      return new Date().toISOString().split('T')[0];
    } else if (targetDateChoice === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    return customDateValue || new Date().toISOString().split('T')[0];
  };

  // Load upcoming/today's calendar events on mount (non-blocking)
  const loadCalendarEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const events = await api.calendar.listEvents(todayStr, nextWeekStr);
      setCalendarEvents(events);

      const urlParams = new URLSearchParams(window.location.search);
      const targetEventId = urlParams.get('calendar_event_id');
      const targetOccasion = urlParams.get('occasion');

      if (targetOccasion && CONTROLLED_OCCASIONS.includes(targetOccasion as any)) {
        setChosenOccasion(targetOccasion as ControlledOccasionType);
      }

      if (targetEventId) {
        const found = events.find((e) => e.id === targetEventId);
        if (found) {
          setSelectedCalendarEvent(found);
          setRecommendationPath('calendar');
          return;
        }
      }

      if (events.length > 0 && !selectedCalendarEvent) {
        setSelectedCalendarEvent(events[0]);
      }
    } catch (err) {
      console.warn('Google / local calendar events unavailable (optional provider)', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [selectedCalendarEvent]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Master recommendation generator supporting all three paths
  const handleGenerate = async (overrideMode?: 'occasion' | 'general' | 'calendar') => {
    const activePath = overrideMode || recommendationPath;

    if (wardrobe.length === 0) {
      showToast('Your wardrobe is empty. Add clothing items to receive AI recommendations.', 'info');
      navigate('/wardrobe');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setAcceptedSuccess(false);

    try {
      let payload: any = {
        city: weather?.city || undefined,
        limit: 1,
        weatherPreference,
        outfitPreference: outfitPreference !== 'any' ? outfitPreference : undefined,
        dressCode: dressCode || undefined,
      };

      if (activePath === 'calendar') {
        if (!selectedCalendarEvent) {
          showToast('Please select a calendar event to style for.', 'info');
          setIsGenerating(false);
          return;
        }
        payload = {
          ...payload,
          recommendationMode: 'calendar',
          calendarEventId: selectedCalendarEvent.id,
          // Crucial: allow user to override the inferred calendar occasion
          occasion: calendarOccasionOverride || selectedCalendarEvent.occasion || undefined,
          targetDate: selectedCalendarEvent.eventDate,
        };
      } else if (activePath === 'general') {
        payload = {
          ...payload,
          recommendationMode: 'general',
          targetDate: getResolvedTargetDate(),
        };
      } else {
        // Path B: Occasion
        payload = {
          ...payload,
          recommendationMode: 'occasion',
          occasion: chosenOccasion,
          customOccasion: chosenOccasion === 'Custom occasion' ? customOccasionText : undefined,
          targetDate: getResolvedTargetDate(),
        };
      }

      const recs = await api.recommendations.generate(payload);

      if (recs && recs.length > 0) {
        setCandidateRecommendations(recs);
        setActiveCandidateIndex(0);
        const occasionLabel =
          activePath === 'calendar'
            ? calendarOccasionOverride || selectedCalendarEvent?.occasion || 'Calendar Event'
            : activePath === 'general'
            ? 'Daily Look'
            : chosenOccasion;
        showToast(
          recs.length === 1
            ? `Synthesized your personalized look for ${occasionLabel}!`
            : `Synthesized ${recs.length} personalized looks for ${occasionLabel}!`,
          'success'
        );
      } else {
        setGenerationError('No complete outfits could be synthesized. Add more tops, bottoms, or dresses to your wardrobe.');
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to generate recommendations.';
      setGenerationError(msg);
      showToast(msg, 'info');
    } finally {
      setIsGenerating(false);
    }
  };

  // Accept current recommendation and link to calendar
  const handleAcceptOutfit = async () => {
    if (!currentRecommendation) return;

    setIsAccepting(true);
    try {
      await api.recommendations.accept(
        currentRecommendation.id,
        selectedCalendarEvent?.id
      );

      setAcceptedSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#18181B', '#71717A', '#F43F5E', '#10B981'],
      });

      showToast(
        `Outfit accepted and scheduled for ${selectedCalendarEvent?.eventDate || getResolvedTargetDate()}!`,
        'success'
      );

      loadCalendarEvents();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to accept recommendation';
      showToast(msg, 'info');
    } finally {
      setIsAccepting(false);
    }
  };

  // Like outfit (positive feedback)
  const handleLikeOutfit = async () => {
    if (!currentRecommendation) return;
    try {
      await api.recommendations.sendFeedback(currentRecommendation.id, 'like');
      setIsLikedSuccess(true);
      showToast('Loved this outfit! Style preferences updated.', 'heart');
    } catch (err) {
      console.error('Failed to record like', err);
    }
  };

  // Save outfit (positive feedback)
  const handleSave = async () => {
    if (!currentRecommendation) return;
    try {
      await api.recommendations.sendFeedback(currentRecommendation.id, 'save');
      showToast(`Saved "${currentRecommendation.outfit.title}" to your Saved Outfits!`, 'save');
    } catch (err) {
      console.error('Failed to save outfit feedback', err);
    }
  };

  // Dismiss with explicit feedback
  const handleDismissWithReason = async (reason?: string) => {
    if (!currentRecommendation) return;

    try {
      if (reason) {
        await api.recommendations.sendFeedback(currentRecommendation.id, 'reject', reason);
        showToast('Feedback noted. Adjusting recommendation weights.', 'info');
      } else {
        await api.recommendations.dismiss(currentRecommendation.id);
        showToast('Outfit candidate dismissed', 'info');
      }
      setRejectModalOpen(false);

      if (candidateRecommendations.length > 1) {
        setActiveCandidateIndex((prev) => (prev + 1) % candidateRecommendations.length);
      } else {
        await handleGenerate();
      }
    } catch (err) {
      console.error('Failed to dismiss recommendation', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await handleGenerate();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWear = async () => {
    if (!currentRecommendation) return;
    try {
      await api.recommendations.markWorn(currentRecommendation.id);
      wearDailyFit();
      setWornSuccess(true);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#18181B', '#71717A', '#E4E4E7'],
      });
      setTimeout(() => setWornSuccess(false), 2500);
      showToast('Marked as worn! Wear history and garment rotation updated.', 'success');
    } catch (err) {
      console.error('Failed to record wear confirmation', err);
      wearDailyFit();
    }
  };

  const shareablePost: Post = currentRecommendation
    ? {
        id: currentRecommendation.outfit.id,
        user: {
          id: currentUser?.id || 'usr_me',
          name: currentUser?.name || 'My Style',
          username: currentUser?.username || 'me',
          avatar: currentUser?.avatar || '',
        },
        image: currentRecommendation.outfit.image || '',
        caption: `${currentRecommendation.outfit.title} · TailorBird Curated`,
        tags: currentRecommendation.outfit.tags,
        occasion: currentRecommendation.outfit.occasion,
        likesCount: 0,
        commentsCount: 0,
        savesCount: 0,
        isLiked: false,
        isSaved: false,
        createdAt: 'Today',
      }
    : ({} as Post);

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
                TailorBird Outfit Atelier
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Curate outfits exclusively from your actual wardrobe pieces with deterministic styling rules.
            </p>
          </div>

          {currentRecommendation && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isGenerating}
                title="Refresh Recommendations"
                className="p-2.5 min-h-[44px] min-w-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center"
                aria-label="Refresh fit"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing || isGenerating ? 'animate-spin' : ''}`} />
              </button>

              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2 min-h-[44px] rounded-md shadow-sm">
                <Sparkles className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 dark:text-zinc-400">
                    Compatibility
                  </span>
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                    {currentRecommendation.score}% Match
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* RECOMMENDATION MODE TABS */}
        {/* ------------------------------------------------------------- */}
        <div className="mb-6 p-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg flex items-center gap-1">
          <button
            type="button"
            onClick={() => setRecommendationPath('occasion')}
            className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              recommendationPath === 'occasion'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Dress for an Occasion</span>
          </button>

          <button
            type="button"
            onClick={() => setRecommendationPath('general')}
            className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              recommendationPath === 'general'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Suggest an Outfit for Me</span>
          </button>

          <button
            type="button"
            onClick={() => setRecommendationPath('calendar')}
            className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              recommendationPath === 'calendar'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Planned Events</span>
            {calendarEvents.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PATH B: OCCASION SELECTION INTERFACE */}
        {/* ------------------------------------------------------------- */}
        {recommendationPath === 'occasion' && (
          <div className="mb-8 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Compass className="w-4 h-4" />
                  What are you dressing for?
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Select an occasion to calibrate formality, silhouette balance, and styling rules.
                </p>
              </div>

              {/* Date Pills */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTargetDateChoice('today')}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                    targetDateChoice === 'today'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDateChoice('tomorrow')}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                    targetDateChoice === 'tomorrow'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDateChoice('custom')}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                    targetDateChoice === 'custom'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200'
                  }`}
                >
                  Pick Date
                </button>
              </div>
            </div>

            {targetDateChoice === 'custom' && (
              <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-md flex items-center gap-3">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Target Date:
                </label>
                <input
                  type="date"
                  value={customDateValue}
                  onChange={(e) => setCustomDateValue(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            )}

            {/* 13 Controlled Occasions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-4">
              {CONTROLLED_OCCASIONS.map((occ) => {
                const isSelected = chosenOccasion === occ;
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => setChosenOccasion(occ)}
                    className={`p-2.5 min-h-[44px] rounded-md text-xs font-medium text-left transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold shadow-sm'
                        : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="truncate">{occ}</span>
                    {isSelected && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* Custom Occasion Text Input */}
            {chosenOccasion === 'Custom occasion' && (
              <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Describe your custom occasion or event:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gallery opening night, High-tea with mentors, Yacht cruise..."
                  value={customOccasionText}
                  onChange={(e) => setCustomOccasionText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            )}

            {/* Advanced Filters Toggle & Drawer */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAdvancedFilters ? 'Hide Preferences' : 'Preferences (Weather, Style, Dress Code)'}</span>
              </button>

              <Button
                variant="primary"
                size="md"
                onClick={() => handleGenerate('occasion')}
                disabled={isGenerating}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {isGenerating ? 'Synthesizing Outfits...' : `Curate for ${chosenOccasion}`}
              </Button>
            </div>

            {/* Collapsible Advanced Preferences */}
            {showAdvancedFilters && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Style Preference
                  </label>
                  <select
                    value={outfitPreference}
                    onChange={(e) => setOutfitPreference(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="any">Any (Western, Indian & Fusion)</option>
                    <option value="western">Western Outfits Only</option>
                    <option value="indian">Indian Ethnic Only</option>
                    <option value="fusion">Fusion (Kurti + Denim, Blazer + Kurta)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Dress Code
                  </label>
                  <select
                    value={dressCode}
                    onChange={(e) => setDressCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">Standard for Occasion</option>
                    <option value="Smart Casual">Smart Casual</option>
                    <option value="Formal">Formal / Business</option>
                    <option value="Casual">Casual / Relaxed</option>
                    <option value="Black Tie">Black Tie / Gala</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Weather Calibration
                  </label>
                  <select
                    value={weatherPreference}
                    onChange={(e) => setWeatherPreference(e.target.value as 'automatic' | 'ignore')}
                    className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="automatic">Automatic (Weather-Calibrated)</option>
                    <option value="ignore">Ignore Weather (Climate Neutral)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PATH C: GENERAL OUTFIT PROMPT */}
        {/* ------------------------------------------------------------- */}
        {recommendationPath === 'general' && (
          <div className="mb-8 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100 mx-auto mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Suggest an Outfit for Me
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mt-1 mb-5">
              No occasion required. TailorBird styles an effortless look using your staple pieces, wear rotation balance, and current climate.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => handleGenerate('general')}
                disabled={isGenerating}
                icon={<Sparkles className="w-4 h-4" />}
              >
                {isGenerating ? 'Synthesizing Look...' : '✨ Curate My Outfit'}
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PATH A: OPTIONAL CALENDAR EVENT SELECTOR */}
        {/* ------------------------------------------------------------- */}
        {recommendationPath === 'calendar' && (
          <div className="mb-8 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  Planned Calendar Events
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Select an upcoming event from Google Calendar or TailorBird to style for.
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/calendar')}
                icon={<CalendarIcon className="w-3.5 h-3.5" />}
              >
                View Full Calendar
              </Button>
            </div>

            {isLoadingEvents ? (
              <div className="flex items-center gap-2 text-xs text-zinc-500 py-4">
                <div className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent animate-spin rounded-full" />
                Loading your scheduled events...
              </div>
            ) : calendarEvents.length > 0 ? (
              <div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2 font-medium">
                  Select an event to style for:
                </p>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
                  {calendarEvents.map((ev) => {
                    const isSelected = selectedCalendarEvent?.id === ev.id;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          setSelectedCalendarEvent(ev);
                          setCalendarOccasionOverride('');
                        }}
                        className={`px-3.5 py-2 min-h-[44px] rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-all border flex items-center gap-2 ${
                          isSelected
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold shadow-sm'
                            : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{ev.eventDate}</span>
                        <span className="opacity-75">· {ev.occasion || 'Event'}</span>
                        {ev.outfitId && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Has Planned Outfit" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedCalendarEvent && (
                  <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        Target Date: <strong className="text-zinc-900 dark:text-zinc-100">{selectedCalendarEvent.eventDate}</strong>
                        {selectedCalendarEvent.notes && ` (${selectedCalendarEvent.notes})`}
                      </div>

                      {/* Inferred occasion override selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Override Occasion:</span>
                        <select
                          value={calendarOccasionOverride || selectedCalendarEvent.occasion || ''}
                          onChange={(e) => setCalendarOccasionOverride(e.target.value)}
                          className="px-2.5 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="">{selectedCalendarEvent.occasion || 'Auto (Inferred)'}</option>
                          {CONTROLLED_OCCASIONS.map((occ) => (
                            <option key={occ} value={occ}>
                              {occ}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => handleGenerate('calendar')}
                        disabled={isGenerating}
                        icon={<Sparkles className="w-4 h-4" />}
                      >
                        {isGenerating ? 'Synthesizing Outfits...' : 'Generate Outfits for Event'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-md border border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  No upcoming calendar events scheduled
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-sm mx-auto mb-4">
                  Google Calendar integration is optional. You can generate outfits right now by clicking &quot;Dress for an Occasion&quot; or &quot;Suggest an Outfit for Me&quot; above.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setRecommendationPath('occasion')}
                  >
                    Dress for an Occasion
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/calendar')}
                  >
                    Open Calendar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* EMPTY WARDROBE OR ERROR NOTICES */}
        {/* ------------------------------------------------------------- */}
        {wardrobe.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-8">
            <Sparkles className="w-8 h-8 text-zinc-600 dark:text-zinc-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Your Wardrobe is Empty
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Add garments, ethnic pieces, or dresses to your digital wardrobe so the AI atelier can synthesize personalized looks.
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
        ) : isGenerating ? (
          <div className="text-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-full border-2 border-zinc-900/40 border-t-zinc-900 dark:border-zinc-100/40 dark:border-t-zinc-100 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Curating Your Look
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              Synthesizing category-aware combinations, CIELAB color harmony, and formality balance from your wardrobe...
            </p>
          </div>
        ) : generationError ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Styling Notice
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              {generationError}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="md"
                onClick={() => handleGenerate()}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Retry
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/wardrobe')}
              >
                Manage Wardrobe
              </Button>
            </div>
          </div>
        ) : currentRecommendation ? (
          /* ------------------------------------------------------------- */
          /* MAIN OUTFIT PRESENTATION CANVAS */
          /* ------------------------------------------------------------- */
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-8 shadow-sm">
            {/* Top Context & Multi-Candidate Carousel Navigation */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-zinc-900 dark:text-zinc-100">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Thermometer className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  {weatherPreference === 'ignore'
                    ? 'Weather Neutral'
                    : weather?.city
                    ? `${weather.city}: ${weather.temp}°C ${weather.condition}`
                    : 'Comfortable · 22°C'}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  {currentRecommendation.outfit.occasion}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {currentRecommendation.outfit.style}
                </span>
              </div>

              {/* Multi-Candidate Pagination Controls */}
              {candidateRecommendations.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Option {activeCandidateIndex + 1} of {candidateRecommendations.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCandidateIndex(
                        (prev) => (prev - 1 + candidateRecommendations.length) % candidateRecommendations.length
                      )
                    }
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    title="Previous Look"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCandidateIndex((prev) => (prev + 1) % candidateRecommendations.length)
                    }
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    title="Next Look"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setWhyModalOpen(true)}
                className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-100 hover:underline font-semibold cursor-pointer ml-auto sm:ml-0"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Stylist Breakdown</span>
              </button>
            </div>

            {/* Canvas Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Large Outfit Imagery */}
              <div className="lg:col-span-5 relative group">
                <div className="rounded-lg overflow-hidden aspect-[3/4] border border-zinc-200 dark:border-zinc-800 relative bg-zinc-100 dark:bg-zinc-950">
                  <img
                    src={resolveImageUrl(currentRecommendation.outfit.image) || FALLBACK_POST_IMAGE}
                    alt={currentRecommendation.outfit.title}
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                        e.currentTarget.src = FALLBACK_POST_IMAGE;
                      }
                    }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-300">
                      Curated Look
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {currentRecommendation.outfit.title}
                    </h3>
                    <p className="text-xs text-white/90 mt-1 line-clamp-2">
                      {currentRecommendation.outfit.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Individual Assembled Garments & Explainability Rationale */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Individual Garments Assembled
                  </h4>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {currentRecommendation.outfit.pieces.length} Pieces
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentRecommendation.outfit.pieces.map((piece) => (
                    <div
                      key={piece.id}
                      onClick={() => navigate(`/wardrobe/${piece.id}`)}
                      className="flex items-center gap-3 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer group"
                    >
                      <img
                        src={resolveImageUrl(piece.preferredImageUrl || piece.image) || FALLBACK_POST_IMAGE}
                        alt={piece.name}
                        onError={(e) => {
                          if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                            e.currentTarget.src = FALLBACK_POST_IMAGE;
                          }
                        }}
                        className="w-14 h-14 rounded object-cover flex-shrink-0 bg-zinc-200 dark:bg-zinc-700"
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

                {/* Deterministic Explanations */}
                <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-2 mt-4">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    Styling Rationale
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-start gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                      <span>{currentRecommendation.reasons[0] || 'Color harmony balanced'}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                      <span>{currentRecommendation.reasons[1] || 'Aligned for occasion'}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                      <span>{currentRecommendation.reasons[2] || 'Climate calibrated'}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 flex-shrink-0 mt-0.5" />
                      <span>{currentRecommendation.reasons[3] || 'Formality variance coherent'}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 pt-4">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleAcceptOutfit}
                    disabled={isAccepting}
                    className={acceptedSuccess ? '!bg-emerald-700 !text-white' : ''}
                    icon={acceptedSuccess ? <CheckCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  >
                    {isAccepting
                      ? 'Scheduling...'
                      : acceptedSuccess
                      ? '✓ Accepted & Scheduled'
                      : 'Accept & Schedule Outfit'}
                  </Button>

                  {acceptedSuccess && (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => navigate('/calendar')}
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      View in Calendar
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setRejectModalOpen(true)}
                    icon={<ThumbsDown className="w-4 h-4" />}
                  >
                    Feedback & Dismiss
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleLikeOutfit}
                    className={isLikedSuccess ? '!bg-rose-50 dark:!bg-rose-950/30 !text-rose-600 dark:!text-rose-400 !border-rose-200 dark:!border-rose-800' : ''}
                    icon={<Heart className={`w-4 h-4 ${isLikedSuccess ? 'fill-rose-600 text-rose-600' : ''}`} />}
                  >
                    {isLikedSuccess ? 'Loved' : 'Love Look'}
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleWear}
                    className={wornSuccess ? '!bg-emerald-700 !text-white' : ''}
                  >
                    {wornSuccess ? '✓ Marked as Worn' : 'Wear Today'}
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setScheduleModalOpen(true)}
                    icon={<CalendarIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
                  >
                    Custom Date
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleSave}
                    icon={<Bookmark className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
                  >
                    Save
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
        ) : (
          <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-2xl mx-auto my-8">
            <Sparkles className="w-8 h-8 text-zinc-600 dark:text-zinc-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Ready to Style Your Look
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-md mx-auto mb-6">
              Pick an occasion or tap below to synthesize outfits tailored from your wardrobe.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleGenerate()}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Curate Recommendations
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* RECOMMENDATION HISTORY SECTION */}
        {/* ------------------------------------------------------------- */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Logged Outfits & Wear History
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
                Click &quot;Wear Today&quot; or &quot;Accept & Schedule Outfit&quot; on any recommendation to start tracking your worn rotation!
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
                    src={resolveImageUrl(hist.outfit.image) || FALLBACK_POST_IMAGE}
                    alt={hist.outfit.title}
                    onError={(e) => {
                      if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                        e.currentTarget.src = FALLBACK_POST_IMAGE;
                      }
                    }}
                    className="w-16 h-16 rounded object-cover bg-zinc-200 dark:bg-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                      {hist.outfit.occasion}
                    </span>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {hist.outfit.title}
                    </h4>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {hist.score}% match · {hist.outfit.pieces.length} pieces
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      {/* Stylist Breakdown Modal */}
      {currentRecommendation && (
        <WhyThisOutfitModal
          isOpen={whyModalOpen}
          onClose={() => setWhyModalOpen(false)}
          recommendation={currentRecommendation}
        />
      )}

      {/* Share Modal */}
      {currentRecommendation && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          post={shareablePost}
        />
      )}

      {/* Schedule Custom Date Modal */}
      {currentRecommendation && (
        <ScheduleOutfitModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          recommendation={currentRecommendation}
          onScheduled={() => {
            showToast('Outfit scheduled into your calendar!', 'success');
            loadCalendarEvents();
          }}
        />
      )}

      {/* Feedback / Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Help Us Refine Your Style
              </h3>
              <button
                onClick={() => setRejectModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">
              Why wasn&apos;t this outfit right for you? This tunes your future recommendations.
            </p>
            <div className="space-y-2 mb-5">
              {[
                { label: 'Not my personal style', reason: 'not_my_style' },
                { label: "Don't like these color combinations", reason: 'dont_like_colors' },
                { label: 'Too formal for what I need', reason: 'too_formal' },
                { label: 'Too casual for the occasion', reason: 'too_casual' },
                { label: 'Not suitable for the weather', reason: 'not_weather_appropriate' },
              ].map((opt) => (
                <button
                  key={opt.reason}
                  type="button"
                  onClick={() => handleDismissWithReason(opt.reason)}
                  className="w-full text-left p-3 rounded-md text-xs font-medium bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 transition-all"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismissWithReason()}
              >
                Dismiss Without Feedback
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
