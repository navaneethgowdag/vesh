import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCw,
  CheckCircle,
  Check,
  Clock,
  Sun,
  Shirt,
  AlertCircle,
  Palette,
  ExternalLink,
  Plus,
  X,
  Layers,
  MapPin,
  Tag,
  ArrowRight,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyDayStatus,
  Outfit,
  ClothingItem,
  CalendarEvent,
} from '../types';
import { resolveImageUrl } from '../utils/imageUrl';
import { cn } from '../utils/cn';

export const WeeklyPlanner: React.FC = () => {
  const { wardrobe, showToast } = useApp();

  // Calculate current week Monday
  const getMonday = (d: Date): string => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => getMonday(new Date()));

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string>(todayStr);

  const [regeneratingDayId, setRegeneratingDayId] = useState<string | null>(null);
  const [actionDayId, setActionDayId] = useState<string | null>(null);

  // Manual outfit selection modal state
  const [changeOutfitModalDay, setChangeOutfitModalDay] = useState<WeeklyPlanDay | null>(null);
  const [selectedTopId, setSelectedTopId] = useState<string>('');
  const [selectedBottomId, setSelectedBottomId] = useState<string>('');
  const [selectedShoesId, setSelectedShoesId] = useState<string>('');

  // Load weekly plan and events
  const loadWeekData = useCallback(async (weekStart: string) => {
    setLoading(true);
    try {
      const endD = new Date(weekStart);
      endD.setDate(endD.getDate() + 6);
      const weekEnd = endD.toISOString().split('T')[0];

      const [planData, eventsData] = await Promise.all([
        api.planner.getWeeklyPlan(weekStart).catch(() => null),
        api.calendar.listEvents(weekStart, weekEnd).catch(() => []),
      ]);

      setPlan(planData);
      setCalendarEvents(eventsData || []);

      // If selected day is outside this week, select the first day or today if in range
      const inRange = todayStr >= weekStart && todayStr <= weekEnd;
      setSelectedDayDate(inRange ? todayStr : weekStart);
    } catch (err: any) {
      console.error('Failed to load weekly planner:', err);
      showToast('Could not load weekly schedule.', 'error');
    } finally {
      setLoading(false);
    }
  }, [todayStr, showToast]);

  useEffect(() => {
    loadWeekData(currentWeekStart);
  }, [currentWeekStart, loadWeekData]);

  // Navigate weeks
  const shiftWeek = (offsetWeeks: number) => {
    const current = new Date(currentWeekStart + 'T00:00:00');
    current.setDate(current.getDate() + offsetWeeks * 7);
    setCurrentWeekStart(current.toISOString().split('T')[0]);
  };

  const jumpToToday = () => {
    const currentMon = getMonday(new Date());
    setCurrentWeekStart(currentMon);
    setSelectedDayDate(todayStr);
  };

  const formatWeekRange = (startStr: string) => {
    try {
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${start.toLocaleDateString(undefined, opt)} – ${end.toLocaleDateString(undefined, { ...opt, year: 'numeric' })}`;
    } catch {
      return startStr;
    }
  };

  // Generate / Regenerate Week
  const handleGeneratePlan = async (force: boolean = false) => {
    setGenerating(true);
    try {
      const data = await api.planner.generateWeeklyPlan(currentWeekStart, force);
      setPlan(data);
      showToast(force ? 'Weekly schedule regenerated!' : '7-day ensemble plan ready!', 'success');
    } catch (err: any) {
      console.error('Error generating weekly plan:', err);
      showToast(err?.message || 'Failed to generate weekly plan', 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate single day look
  const handleRegenerateDay = async (dayId: string) => {
    if (!plan) return;
    setRegeneratingDayId(dayId);
    try {
      const updatedDay = await api.planner.regenerateDay(plan.id, dayId);
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.id === dayId ? updatedDay : d)),
        };
      });
      showToast('Ensemble refreshed for this day!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not regenerate day look', 'error');
    } finally {
      setRegeneratingDayId(null);
    }
  };

  // Explicit status change (e.g. Wear This Outfit)
  const handleUpdateStatus = async (dayId: string, newStatus: WeeklyDayStatus) => {
    if (!plan) return;
    setActionDayId(dayId);
    try {
      const updatedDay = await api.planner.updateDayStatus(plan.id, dayId, newStatus);
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.id === dayId ? updatedDay : d)),
        };
      });
      if (newStatus === 'worn') {
        showToast('Ensemble logged as worn. Wear tracking updated.', 'success');
      } else if (newStatus === 'accepted') {
        showToast('Ensemble confirmed for this day.', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not update status', 'error');
    } finally {
      setActionDayId(null);
    }
  };

  // Manual Outfit Selection Save
  const handleSaveManualOutfit = async () => {
    if (!plan || !changeOutfitModalDay) return;
    const clothingIds = [selectedTopId, selectedBottomId, selectedShoesId].filter(Boolean);
    if (clothingIds.length === 0) {
      showToast('Please select at least one garment from your wardrobe', 'error');
      return;
    }
    setActionDayId(changeOutfitModalDay.id);
    try {
      const updatedDay = await api.planner.updateDayOutfit(plan.id, changeOutfitModalDay.id, {
        clothingItemIds: clothingIds,
      });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.id === changeOutfitModalDay.id ? updatedDay : d)),
        };
      });
      setChangeOutfitModalDay(null);
      setSelectedTopId('');
      setSelectedBottomId('');
      setSelectedShoesId('');
      showToast('Custom look assigned to day!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not update outfit', 'error');
    } finally {
      setActionDayId(null);
    }
  };

  // Open outfit picker modal
  const openOutfitPicker = (day: WeeklyPlanDay) => {
    setChangeOutfitModalDay(day);
    const existingIds = day.outfit?.clothing_items?.map((i) => i.id) || [];
    // Pre-populate if existing
    const tops = wardrobe.filter((w) => ['top', 'shirt', 't_shirt', 'sweater', 'blazer', 'kurta'].some((c) => (w.category || '').toLowerCase().includes(c)));
    const bottoms = wardrobe.filter((w) => ['bottom', 'pant', 'jean', 'trouser', 'skirt', 'shorts'].some((c) => (w.category || '').toLowerCase().includes(c)));
    const shoes = wardrobe.filter((w) => ['shoe', 'footwear', 'sneaker', 'loafer'].some((c) => (w.category || '').toLowerCase().includes(c)));

    const curTop = tops.find((t) => existingIds.includes(t.id));
    const curBot = bottoms.find((b) => existingIds.includes(b.id));
    const curSho = shoes.find((s) => existingIds.includes(s.id));

    setSelectedTopId(curTop?.id || (tops[0]?.id || ''));
    setSelectedBottomId(curBot?.id || (bottoms[0]?.id || ''));
    setSelectedShoesId(curSho?.id || (shoes[0]?.id || ''));
  };

  // Find currently selected day object
  const selectedDayObj: WeeklyPlanDay | undefined = useMemo(() => {
    return plan?.days.find((d) => d.plan_date === selectedDayDate);
  }, [plan, selectedDayDate]);

  // Calendar events matching the selected day
  const selectedDayEvents = useMemo(() => {
    return calendarEvents.filter((e) => e.event_date === selectedDayDate);
  }, [calendarEvents, selectedDayDate]);

  // Wardrobe items grouped for picker modal
  const wardrobeTops = useMemo(() => wardrobe.filter((i) => !i.reviewRequired && ['top', 'shirt', 't_shirt', 'sweater', 'blazer', 'kurta', 'dress'].some((k) => (i.category || '').toLowerCase().includes(k))), [wardrobe]);
  const wardrobeBottoms = useMemo(() => wardrobe.filter((i) => !i.reviewRequired && ['bottom', 'pant', 'jean', 'trouser', 'skirt', 'shorts'].some((k) => (i.category || '').toLowerCase().includes(k))), [wardrobe]);
  const wardrobeShoes = useMemo(() => wardrobe.filter((i) => !i.reviewRequired && ['shoe', 'footwear', 'sneaker', 'loafer', 'boot'].some((k) => (i.category || '').toLowerCase().includes(k))), [wardrobe]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10 select-none">
        {/* ----------------------------------------------------------- */}
        {/* HEADER: Cormorant Garamond Editorial Workspace             */}
        {/* ----------------------------------------------------------- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#DCD4CC] dark:border-[#392F3E]">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-[#743C49] dark:text-[#D5A6A0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#743C49] animate-pulse" />
              <span>Weekly Wardrobe Workspace</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
              Your Week,{' '}
              <span className="italic font-normal text-[#743C49] dark:text-[#D5A6A0]">
                Styled.
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] max-w-xl font-sans leading-relaxed">
              Plan your outfits and make every day feel effortless. Synced with local microclimate and calendar events.
            </p>
          </div>

          {/* Navigation Controls & Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Week navigation strip */}
            <div className="flex items-center bg-white dark:bg-[#1A151C] rounded-[2px] p-1 border border-[#DCD4CC] dark:border-[#392F3E] shadow-2xs">
              <button
                onClick={() => shiftWeek(-1)}
                className="p-2 rounded-[2px] hover:bg-[#FAF6F0] dark:hover:bg-[#241D27] text-[#29202B] dark:text-[#F3EEE8] transition-colors cursor-pointer"
                title="Previous Week"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3.5 text-xs font-mono font-semibold text-[#29202B] dark:text-[#F3EEE8] min-w-[140px] text-center">
                {formatWeekRange(currentWeekStart)}
              </span>

              <button
                onClick={() => shiftWeek(1)}
                className="p-2 rounded-[2px] hover:bg-[#FAF6F0] dark:hover:bg-[#241D27] text-[#29202B] dark:text-[#F3EEE8] transition-colors cursor-pointer"
                title="Next Week"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Today shortcut */}
            <button
              onClick={jumpToToday}
              className="px-3.5 py-2.5 rounded-[2px] bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] text-xs font-sans font-semibold uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-colors cursor-pointer shadow-2xs"
            >
              Today
            </button>

            {/* Generate / Regenerate Week CTA */}
            <Button
              onClick={() => handleGeneratePlan(plan !== null)}
              isLoading={generating}
              variant="primary"
              className="rounded-[2px] bg-[#29202B] hover:bg-[#743C49] dark:bg-[#F3EEE8] dark:text-[#29202B] dark:hover:bg-[#FFFFFF] text-white uppercase tracking-[0.16em] text-xs font-semibold px-5 py-2.5 shadow-sm"
            >
              {generating ? (
                <span>Composing...</span>
              ) : plan ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Week</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Week Plan</span>
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* MAIN BODY: 7-DAY OVERVIEW + SELECTED DAY DETAIL PANEL       */}
        {/* ----------------------------------------------------------- */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 text-center space-y-4">
            <div className="w-8 h-8 border-2 border-[#DCD4CC] dark:border-[#392F3E] border-t-[#743C49] rounded-full animate-spin" />
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#6D7068] dark:text-[#A89E9B]">
              Calibrating 7-day capsule & schedule...
            </p>
          </div>
        ) : !plan || plan.days.length === 0 ? (
          /* Empty Week Plan State */
          <div className="bg-white dark:bg-[#1A151C] rounded-[2px] p-12 sm:p-16 border border-[#DCD4CC] dark:border-[#392F3E] text-center max-w-xl mx-auto shadow-xs space-y-6">
            <div className="w-16 h-16 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto text-[#743C49] dark:text-[#D5A6A0]">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                No Outfits Planned for {formatWeekRange(currentWeekStart)}
              </h3>
              <p className="text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] max-w-sm mx-auto leading-relaxed font-sans">
                Generate a tailored seven-day plan matched to your agenda, local weather forecast, and garment rotation history.
              </p>
            </div>
            <Button
              onClick={() => handleGeneratePlan(false)}
              isLoading={generating}
              variant="primary"
              className="rounded-[2px] bg-[#29202B] hover:bg-[#743C49] dark:bg-[#F3EEE8] dark:text-[#29202B] text-white uppercase tracking-[0.16em] text-xs font-semibold px-8 py-3"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate 7-Day Looks
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* ------------------------------------------------------- */}
            {/* HORIZONTAL 7-DAY OVERVIEW STRIP / GRID                 */}
            {/* ------------------------------------------------------- */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1 text-xs font-mono uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
                <span>Weekly Schedule</span>
                <span>Select a day to inspect</span>
              </div>

              {/* Responsive 7-Day Grid on Desktop, Horizontal Scroll on Mobile */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {plan.days.map((day) => {
                  const dObj = new Date(day.plan_date + 'T00:00:00');
                  const weekdayShort = dObj.toLocaleDateString(undefined, { weekday: 'short' });
                  const dateShort = dObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  const isToday = day.plan_date === todayStr;
                  const isSelected = day.plan_date === selectedDayDate;

                  const exp = day.explanation_data || {};
                  const context = exp.context || {};
                  const outfit = day.outfit;
                  const items = outfit?.clothing_items || [];
                  const topPiece = items[0];
                  const dayEvents = calendarEvents.filter((e) => e.event_date === day.plan_date);

                  return (
                    <div
                      key={day.id}
                      onClick={() => setSelectedDayDate(day.plan_date)}
                      className={cn(
                        'flex flex-col bg-white dark:bg-[#1A151C] rounded-[2px] border transition-all duration-200 cursor-pointer overflow-hidden group select-none shadow-2xs relative text-left',
                        isSelected
                          ? 'border-[#743C49] dark:border-[#D5A6A0] ring-1 ring-[#743C49] dark:ring-[#D5A6A0] shadow-sm'
                          : isToday
                          ? 'border-[#B49B82] hover:border-[#743C49]'
                          : 'border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49] dark:hover:border-[#D5A6A0]'
                      )}
                    >
                      {/* Day Header */}
                      <div
                        className={cn(
                          'p-3 border-b flex items-center justify-between',
                          isSelected
                            ? 'bg-[#743C49] text-white'
                            : isToday
                            ? 'bg-[#FAF6F0] dark:bg-[#241D27] border-[#B49B82] text-[#29202B] dark:text-[#F3EEE8]'
                            : 'bg-[#FAF6F0]/60 dark:bg-[#201824]/40 border-[#DCD4CC] dark:border-[#392F3E]'
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'text-[10px] font-mono font-bold uppercase tracking-[0.18em]',
                              isSelected ? 'text-white' : 'text-[#743C49] dark:text-[#D5A6A0]'
                            )}>
                              {weekdayShort}
                            </span>
                            {isToday && (
                              <span className={cn(
                                'text-[9px] px-1.5 py-0.2 rounded-[1px] font-mono font-bold uppercase',
                                isSelected ? 'bg-white text-[#743C49]' : 'bg-[#743C49] text-white'
                              )}>
                                Today
                              </span>
                            )}
                          </div>
                          <p className={cn(
                            'text-xs font-serif font-medium mt-0.5',
                            isSelected ? 'text-white' : 'text-[#29202B] dark:text-[#F3EEE8]'
                          )}>
                            {dateShort}
                          </p>
                        </div>

                        {/* Status Icon */}
                        {day.status === 'worn' ? (
                          <span
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
                              isSelected ? 'bg-white text-[#743C49]' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            )}
                            title="Marked as Worn"
                          >
                            ✓
                          </span>
                        ) : day.status === 'accepted' ? (
                          <span
                            className={cn(
                              'w-2 h-2 rounded-full',
                              isSelected ? 'bg-white' : 'bg-emerald-500'
                            )}
                            title="Accepted Look"
                          />
                        ) : null}
                      </div>

                      {/* Outfit Thumbnail Preview */}
                      <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-between">
                        {outfit && items.length > 0 ? (
                          <div className="space-y-2">
                            <div className="aspect-[4/5] rounded-[2px] overflow-hidden bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] relative">
                              <img
                                src={resolveImageUrl(topPiece?.preferred_image_url || topPiece?.image_url)}
                                alt={topPiece?.name || 'Garment'}
                                className="w-full h-full object-cover"
                              />
                              {items.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/70 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-[1px]">
                                  +{items.length - 1}
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] line-clamp-1">
                              {outfit.name || context.occasion || 'Curated Ensemble'}
                            </p>
                          </div>
                        ) : (
                          <div className="aspect-[4/5] rounded-[2px] border border-dashed border-[#DCD4CC] dark:border-[#392F3E] flex flex-col items-center justify-center text-center p-2 text-[#6D7068] dark:text-[#A89E9B]">
                            <Shirt className="w-5 h-5 mb-1 opacity-40" />
                            <span className="text-[10px] font-mono">Unassigned</span>
                          </div>
                        )}

                        {/* Calendar event chip indicator */}
                        {dayEvents.length > 0 && (
                          <div className="pt-1.5 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-1.5 text-[10px] font-sans text-[#743C49] dark:text-[#D5A6A0] truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#743C49] shrink-0" />
                            <span className="truncate font-medium">{dayEvents[0].display_title}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------- */}
            {/* SELECTED DAY DETAIL PANEL (The Core Planning Workspace) */}
            {/* ------------------------------------------------------- */}
            {selectedDayObj && (
              <div className="bg-white dark:bg-[#1A151C] rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] p-6 sm:p-8 space-y-8 shadow-xs">
                {/* Panel Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#DCD4CC] dark:border-[#392F3E]">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#743C49] dark:text-[#D5A6A0]">
                        Selected Day Blueprint
                      </span>
                      {selectedDayObj.plan_date === todayStr && (
                        <span className="px-2 py-0.5 rounded-[1px] bg-[#743C49] text-white text-[9px] font-mono font-bold uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-serif text-[#29202B] dark:text-[#F3EEE8]">
                      {new Date(selectedDayObj.plan_date + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </h2>
                  </div>

                  {/* Actions for this specific day */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Wear This Outfit action */}
                    {selectedDayObj.outfit && selectedDayObj.status !== 'worn' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedDayObj.id, 'worn')}
                        disabled={actionDayId === selectedDayObj.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[2px] bg-[#29202B] hover:bg-[#743C49] dark:bg-[#F3EEE8] dark:text-[#29202B] text-white text-xs font-sans font-semibold uppercase tracking-[0.14em] transition-colors cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Wear This Outfit</span>
                      </button>
                    )}

                    {selectedDayObj.status === 'worn' && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[2px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold uppercase tracking-[0.12em]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ensemble Worn</span>
                      </span>
                    )}

                    {/* Change / Customize Outfit */}
                    <button
                      onClick={() => openOutfitPicker(selectedDayObj)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-xs font-sans font-semibold uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-colors cursor-pointer"
                    >
                      <Shirt className="w-3.5 h-3.5" />
                      <span>Change Outfit</span>
                    </button>

                    {/* Regenerate AI look */}
                    <button
                      onClick={() => handleRegenerateDay(selectedDayObj.id)}
                      disabled={regeneratingDayId === selectedDayObj.id}
                      className="p-2.5 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-colors cursor-pointer"
                      title="Regenerate this day with AI"
                      aria-label="Regenerate look"
                    >
                      <RefreshCw className={cn('w-4 h-4', regeneratingDayId === selectedDayObj.id && 'animate-spin text-[#743C49]')} />
                    </button>
                  </div>
                </div>

                {/* Day Details: Left Column (Events & Rationale), Right Column (Garment Pieces) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Context, Events & Styling Explanation */}
                  <div className="lg:col-span-5 space-y-6">
                    {/* Calendar Events Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Scheduled Events ({selectedDayEvents.length})</span>
                      </div>

                      {selectedDayEvents.length === 0 ? (
                        <div className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
                          No calendar events scheduled for this day. Styled for flexible everyday wear.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedDayEvents.map((evt) => (
                            <div
                              key={evt.id}
                              className="p-3.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] flex items-start justify-between gap-3 text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                                  {evt.display_title}
                                </p>
                                <p className="text-[11px] text-[#6D7068] dark:text-[#A89E9B] mt-0.5">
                                  {evt.is_all_day ? 'All Day' : evt.start_time ? `${evt.start_time.slice(0, 5)} - ${evt.end_time?.slice(0, 5) || ''}` : 'Scheduled'}
                                </p>
                              </div>
                              {evt.occasion && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[1px] bg-white dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] text-[#743C49] dark:text-[#D5A6A0]">
                                  {evt.occasion}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Styling Rationale */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
                        <Sparkles className="w-3.5 h-3.5 text-[#743C49] dark:text-[#D5A6A0]" />
                        <span>Styling Curation Rationale</span>
                      </div>

                      <div className="p-4 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-2 text-xs font-sans">
                        <p className="font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                          {selectedDayObj.explanation_data?.summary || 'TailorBird Coordinated Look'}
                        </p>
                        {selectedDayObj.explanation_data?.reasons?.map((reason, i) => (
                          <div key={i} className="flex items-start gap-2 text-[#6D7068] dark:text-[#A89E9B] text-xs">
                            <span className="text-[#743C49] dark:text-[#D5A6A0] font-bold">•</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Garment Pieces Cards Grid */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between text-xs font-mono font-bold uppercase tracking-[0.16em] text-[#6D7068] dark:text-[#A89E9B]">
                      <span>Ensemble Pieces ({selectedDayObj.outfit?.clothing_items?.length || 0})</span>
                      <span>Verified Wardrobe Items</span>
                    </div>

                    {!selectedDayObj.outfit || !selectedDayObj.outfit.clothing_items || selectedDayObj.outfit.clothing_items.length === 0 ? (
                      <div className="p-10 text-center rounded-[2px] border border-dashed border-[#DCD4CC] dark:border-[#392F3E] space-y-3">
                        <Shirt className="w-8 h-8 mx-auto text-[#6D7068] opacity-40" />
                        <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
                          No ensemble assigned to this date yet.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOutfitPicker(selectedDayObj)}
                          className="text-xs uppercase tracking-[0.12em]"
                        >
                          Select Clothes
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {selectedDayObj.outfit.clothing_items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px] overflow-hidden group shadow-2xs"
                          >
                            <div className="aspect-[4/5] bg-white dark:bg-[#1A151C] overflow-hidden relative">
                              <img
                                src={resolveImageUrl(item.preferred_image_url || item.image_url)}
                                alt={item.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="p-3.5 space-y-1">
                              <p className="text-xs font-serif font-bold text-[#29202B] dark:text-[#F3EEE8] truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center justify-between text-[11px] text-[#6D7068] dark:text-[#A89E9B] font-sans">
                                <span>{item.category}</span>
                                <span>{item.color}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* MANUAL OUTFIT PICKER MODAL                                  */}
        {/* ----------------------------------------------------------- */}
        {changeOutfitModalDay && (
          <Modal
            isOpen={true}
            onClose={() => setChangeOutfitModalDay(null)}
            title="Customize Day Look"
          >
            <div className="space-y-6 select-none max-h-[75vh] overflow-y-auto px-1">
              <p className="text-xs text-[#6D7068] dark:text-[#A89E9B] font-sans">
                Choose garments from your verified wardrobe to assign to{' '}
                <span className="font-semibold text-[#29202B] dark:text-[#F3EEE8]">
                  {new Date(changeOutfitModalDay.plan_date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                .
              </p>

              {/* Top Piece Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] block">
                  1. Select Top Piece
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px]">
                  {wardrobeTops.map((top) => (
                    <div
                      key={top.id}
                      onClick={() => setSelectedTopId(top.id)}
                      className={cn(
                        'aspect-[3/4] rounded-[2px] overflow-hidden border cursor-pointer relative',
                        selectedTopId === top.id
                          ? 'border-[#743C49] ring-2 ring-[#743C49]'
                          : 'border-[#DCD4CC] dark:border-[#392F3E] opacity-75 hover:opacity-100'
                      )}
                    >
                      <img
                        src={resolveImageUrl(top.preferredImageUrl || top.imageUrl)}
                        alt={top.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedTopId === top.id && (
                        <span className="absolute top-1 right-1 bg-[#743C49] text-white text-[9px] px-1 rounded-full">
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Piece Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] block">
                  2. Select Bottom Piece
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px]">
                  {wardrobeBottoms.map((bot) => (
                    <div
                      key={bot.id}
                      onClick={() => setSelectedBottomId(bot.id)}
                      className={cn(
                        'aspect-[3/4] rounded-[2px] overflow-hidden border cursor-pointer relative',
                        selectedBottomId === bot.id
                          ? 'border-[#743C49] ring-2 ring-[#743C49]'
                          : 'border-[#DCD4CC] dark:border-[#392F3E] opacity-75 hover:opacity-100'
                      )}
                    >
                      <img
                        src={resolveImageUrl(bot.preferredImageUrl || bot.imageUrl)}
                        alt={bot.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedBottomId === bot.id && (
                        <span className="absolute top-1 right-1 bg-[#743C49] text-white text-[9px] px-1 rounded-full">
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Shoes Selection */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-[#29202B] dark:text-[#F3EEE8] block">
                  3. Select Footwear
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1 border border-[#DCD4CC] dark:border-[#392F3E] rounded-[2px]">
                  {wardrobeShoes.map((sho) => (
                    <div
                      key={sho.id}
                      onClick={() => setSelectedShoesId(sho.id)}
                      className={cn(
                        'aspect-[3/4] rounded-[2px] overflow-hidden border cursor-pointer relative',
                        selectedShoesId === sho.id
                          ? 'border-[#743C49] ring-2 ring-[#743C49]'
                          : 'border-[#DCD4CC] dark:border-[#392F3E] opacity-75 hover:opacity-100'
                      )}
                    >
                      <img
                        src={resolveImageUrl(sho.preferredImageUrl || sho.imageUrl)}
                        alt={sho.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedShoesId === sho.id && (
                        <span className="absolute top-1 right-1 bg-[#743C49] text-white text-[9px] px-1 rounded-full">
                          ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangeOutfitModalDay(null)}
                  className="text-xs uppercase tracking-[0.12em]"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveManualOutfit}
                  isLoading={actionDayId === changeOutfitModalDay.id}
                  className="text-xs uppercase tracking-[0.14em] bg-[#29202B] hover:bg-[#743C49] text-white"
                >
                  Assign Look
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppShell>
  );
};
