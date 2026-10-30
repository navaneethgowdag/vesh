import React, { useState, useEffect, useCallback } from 'react';
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
  Plus,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  Palette,
  ShieldCheck,
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
    wardrobe,
  } = useApp();

  const navigate = useNavigate();

  // Calendar prerequisite states
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);

  // Quick event creation states
  const [newEventDate, setNewEventDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newEventOccasion, setNewEventOccasion] = useState<Occasion>('Work & Office');
  const [newEventNotes, setNewEventNotes] = useState<string>('');
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);

  // Multi-candidate recommendation states
  const [candidateRecommendations, setCandidateRecommendations] = useState<Recommendation[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Acceptance states
  const [isAccepting, setIsAccepting] = useState<boolean>(false);
  const [acceptedSuccess, setAcceptedSuccess] = useState<boolean>(false);
  const [wornSuccess, setWornSuccess] = useState<boolean>(false);

  // Modals
  const [whyModalOpen, setWhyModalOpen] = useState<boolean>(false);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active outfit to display: preferred multi-candidate or legacy dailyFit
  const currentRecommendation = candidateRecommendations.length > 0
    ? candidateRecommendations[activeCandidateIndex]
    : dailyFit;

  // Load upcoming/today's calendar events on mount
  const loadCalendarEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 14);
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const events = await api.calendar.listEvents(todayStr, nextWeekStr);
      setCalendarEvents(events);
      if (events.length > 0 && !selectedCalendarEvent) {
        setSelectedCalendarEvent(events[0]);
      }
    } catch (err) {
      console.error('Failed to load calendar events', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [selectedCalendarEvent]);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // Generate recommendations for the selected calendar event
  const handleGenerateForEvent = async (eventToUse?: CalendarEvent) => {
    const targetEvent = eventToUse || selectedCalendarEvent;
    if (!targetEvent) {
      showToast('Please select or plan a calendar event first.', 'info');
      return;
    }

    if (wardrobe.length === 0) {
      showToast('Your wardrobe is empty. Add clothing items to receive AI recommendations.', 'info');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setAcceptedSuccess(false);

    try {
      const recs = await api.recommendations.generate({
        calendarEventId: targetEvent.id,
        occasion: (targetEvent.occasion as Occasion) || selectedOccasion,
        city: weather.city || undefined,
        limit: 5,
      });

      if (recs && recs.length > 0) {
        setCandidateRecommendations(recs);
        setActiveCandidateIndex(0);
        showToast(`Synthesized ${recs.length} personalized looks for ${targetEvent.occasion || 'your event'}!`, 'success');
      } else {
        setGenerationError('No outfit combinations could be formed. Add more matching tops, bottoms, or footwear.');
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to generate recommendations.';
      setGenerationError(msg);
      showToast(msg, 'info');
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick event creation & immediate generation
  const handleCreateQuickEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventDate) {
      showToast('Please select an event date', 'info');
      return;
    }

    setIsCreatingEvent(true);
    try {
      const createdEvent = await api.calendar.createEvent({
        event_date: newEventDate,
        occasion: newEventOccasion,
        notes: newEventNotes.trim() || undefined,
        event_type: 'planned_outfit',
      });

      setCalendarEvents((prev) => [createdEvent, ...prev]);
      setSelectedCalendarEvent(createdEvent);
      showToast(`Event planned for ${createdEvent.eventDate} (${newEventOccasion})! Curating outfits...`, 'success');

      // Immediately generate recommendations for the new event
      await handleGenerateForEvent(createdEvent);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to create calendar event';
      showToast(msg, 'info');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // Accept current recommendation and link to calendar
  const handleAcceptOutfit = async () => {
    if (!currentRecommendation) return;

    setIsAccepting(true);
    try {
      const res = await api.recommendations.accept(
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
        `Outfit accepted and scheduled for ${selectedCalendarEvent?.eventDate || 'your event'}!`,
        'success'
      );

      // Refresh calendar events
      loadCalendarEvents();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to accept recommendation';
      showToast(msg, 'info');
    } finally {
      setIsAccepting(false);
    }
  };

  // Dismiss current recommendation
  const handleDismissOutfit = async () => {
    if (!currentRecommendation) return;

    try {
      await api.recommendations.dismiss(currentRecommendation.id);
      showToast('Outfit candidate dismissed', 'info');

      if (candidateRecommendations.length > 1) {
        // Cycle to next candidate
        setActiveCandidateIndex((prev) => (prev + 1) % candidateRecommendations.length);
      } else {
        cycleDailyFit();
      }
    } catch (err) {
      console.error('Failed to dismiss recommendation', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (selectedCalendarEvent) {
        await handleGenerateForEvent(selectedCalendarEvent);
      } else {
        await cycleDailyFit();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

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
    if (currentRecommendation) {
      showToast(`Saved "${currentRecommendation.outfit.title}" to your Saved Outfits!`, 'save');
    }
  };

  // Shareable post conversion
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
        caption: `${currentRecommendation.outfit.title} · Curated by StyleSphere`,
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
                AI Outfit Recommendation Atelier
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Purpose-calibrated outfit synthesis tailored for your calendar events and wardrobe pieces.
            </p>
          </div>

          {/* Confidence Badge & Quick Actions */}
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
                    Confidence Score
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
        {/* MANDATORY CALENDAR PREREQUISITE SELECTOR / EVENT CREATOR */}
        {/* ------------------------------------------------------------- */}
        <div className="mb-8 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                1. Target Calendar Event Prerequisite
              </h2>
            </div>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Recommendations are mathematically calibrated to event date, context & climate
            </span>
          </div>

          {isLoadingEvents ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-3">
              <div className="w-3.5 h-3.5 border-2 border-zinc-900 border-t-transparent animate-spin rounded-full" />
              Loading your scheduled events...
            </div>
          ) : calendarEvents.length > 0 ? (
            <div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2.5 font-medium">
                Select an upcoming planned date to style for:
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
                        if (ev.occasion) setSelectedOccasion(ev.occasion as Occasion);
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
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Targeting: <strong className="text-zinc-900 dark:text-zinc-100">{selectedCalendarEvent.occasion || 'General'}</strong> on{' '}
                    <strong className="text-zinc-900 dark:text-zinc-100">{selectedCalendarEvent.eventDate}</strong>
                    {selectedCalendarEvent.notes && ` (${selectedCalendarEvent.notes})`}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleGenerateForEvent()}
                    disabled={isGenerating}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    {isGenerating ? 'Synthesizing Outfits...' : 'Generate Outfits for Event'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // No Calendar Events: Inline Quick Event Creator
            <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-md p-4 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    No Calendar Events Found — Schedule Your First Event
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    StyleSphere AI requires an active calendar event to accurately calibrate thermal comfort, formality delta, and occasion rules.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateQuickEvent} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Occasion / Context
                  </label>
                  <select
                    value={newEventOccasion}
                    onChange={(e) => setNewEventOccasion(e.target.value as Occasion)}
                    className="w-full px-3 py-2 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  >
                    {OCCASIONS.map((occ) => (
                      <option key={occ} value={occ}>
                        {occ}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={isCreatingEvent}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    {isCreatingEvent ? 'Planning...' : 'Plan Event & Curate Outfits'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

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
              Add garments, ethnic pieces, and footwear to your digital wardrobe so the AI atelier can tailor personalized looks for you.
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
              Curating Your Silhouette
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              Running category-aware ensemble rules, CIELAB color harmony, and formality delta checks for{' '}
              {selectedCalendarEvent?.occasion || selectedOccasion}...
            </p>
          </div>
        ) : generationError ? (
          <div className="text-center py-16 px-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 mx-auto mb-3">
              <Info className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Recommendation Notice
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-md mx-auto">
              {generationError}
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline"
                size="md"
                onClick={() => handleGenerateForEvent()}
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
                  {weather.city ? `${weather.city}: ${weather.temp}°C ${weather.condition}` : 'Pleasant · 22°C'}
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
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Previous Silhouette"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveCandidateIndex((prev) => (prev + 1) % candidateRecommendations.length)
                    }
                    className="p-1.5 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Next Silhouette"
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

                {/* Deterministic Natural Language Explanations */}
                <div className="p-4 rounded-md bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-2 mt-4">
                  <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    AI Atelier Rationale
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
                      ? 'Linking to Calendar...'
                      : acceptedSuccess
                      ? '✓ Outfit Accepted & Scheduled'
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
                    onClick={handleDismissOutfit}
                    icon={<RefreshCw className="w-4 h-4" />}
                  >
                    Dismiss & Try Next
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleWear}
                    className={wornSuccess ? '!bg-emerald-700 !text-white' : ''}
                  >
                    {wornSuccess ? '✓ Logged as Worn' : 'Wear Today'}
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setScheduleModalOpen(true)}
                    icon={<Calendar className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />}
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
              Ready to Curate Your Look
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-md mx-auto mb-6">
              Select an existing calendar event above or plan a new event to generate AI outfit recommendations calibrated to your schedule.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleGenerateForEvent()}
              disabled={!selectedCalendarEvent}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Generate AI Recommendations
            </Button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* RECOMMENDATION HISTORY SECTION */}
        {/* ------------------------------------------------------------- */}
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
        {currentRecommendation && (
          <>
            <WhyThisOutfitModal
              isOpen={whyModalOpen}
              onClose={() => setWhyModalOpen(false)}
              recommendation={currentRecommendation}
            />

            <ShareModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              post={shareablePost}
            />

            <ScheduleOutfitModal
              isOpen={scheduleModalOpen}
              onClose={() => setScheduleModalOpen(false)}
              recommendation={currentRecommendation}
              onScheduled={(event) => {
                showToast(`Outfit scheduled for ${event.eventDate}!`, 'success');
                loadCalendarEvents();
              }}
            />
          </>
        )}
      </PullToRefresh>
    </AppShell>
  );
};
