import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { EditorialPageHeader } from '../components/editorial/EditorialPageHeader';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { WeeklyPlan, WeeklyPlanDay, WeeklyDayStatus, Outfit, ClothingItem } from '../types';
import { resolveImageUrl } from '../utils/imageUrl';
import { cn } from '../utils/cn';

export const WeeklyPlanner: React.FC = () => {
  const { wardrobe, showToast } = useApp();

  const [currentWeekStart, setCurrentWeekStart] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [regeneratingDayId, setRegeneratingDayId] = useState<string | null>(null);
  const [updatingDayId, setUpdatingDayId] = useState<string | null>(null);

  // Manual outfit selection modal state
  const [manualModalDay, setManualModalDay] = useState<WeeklyPlanDay | null>(null);
  const [selectedTopId, setSelectedTopId] = useState<string>('');
  const [selectedBottomId, setSelectedBottomId] = useState<string>('');

  const loadPlan = useCallback(async (weekStart: string) => {
    setLoading(true);
    try {
      const data = await api.planner.getWeeklyPlan(weekStart);
      setPlan(data);
    } catch (err: any) {
      console.error('Failed to load weekly plan:', err);
      showToast('Could not load weekly plan', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPlan(currentWeekStart);
  }, [currentWeekStart, loadPlan]);

  const handleGeneratePlan = async (force: boolean = false) => {
    setGenerating(true);
    try {
      const data = await api.planner.generateWeeklyPlan(currentWeekStart, force);
      setPlan(data);
      showToast(force ? 'Weekly plan regenerated!' : 'Weekly plan ready!', 'success');
    } catch (err: any) {
      console.error('Error generating weekly plan:', err);
      showToast(err.message || 'Failed to generate weekly plan', 'error');
    } finally {
      setGenerating(false);
    }
  };

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
      showToast('Day outfit updated!', 'success');
    } catch (err: any) {
      console.error('Failed to regenerate day:', err);
      showToast(err.message || 'Could not regenerate outfit', 'error');
    } finally {
      setRegeneratingDayId(null);
    }
  };

  const handleStatusChange = async (dayId: string, newStatus: WeeklyDayStatus) => {
    if (!plan) return;
    setUpdatingDayId(dayId);
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
        showToast('Marked as worn today! Wear count logged.', 'success');
      } else if (newStatus === 'accepted') {
        showToast('Outfit accepted for this day', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    } finally {
      setUpdatingDayId(null);
    }
  };

  const handleSaveManualOutfit = async () => {
    if (!plan || !manualModalDay) return;
    if (!selectedTopId && !selectedBottomId) {
      showToast('Please select at least one garment', 'error');
      return;
    }
    const clothingIds = [selectedTopId, selectedBottomId].filter(Boolean);
    try {
      const updatedDay = await api.planner.updateDayOutfit(plan.id, manualModalDay.id, {
        clothingItemIds: clothingIds,
      });
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) => (d.id === manualModalDay.id ? updatedDay : d)),
        };
      });
      setManualModalDay(null);
      setSelectedTopId('');
      setSelectedBottomId('');
      showToast('Custom outfit assigned to day!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not assign outfit', 'error');
    }
  };

  const shiftWeek = (offsetWeeks: number) => {
    const current = new Date(currentWeekStart);
    current.setDate(current.getDate() + offsetWeeks * 7);
    setCurrentWeekStart(current.toISOString().split('T')[0]);
  };

  const formatWeekRange = (startStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const optMonth: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${start.toLocaleDateString(undefined, optMonth)} – ${end.toLocaleDateString(undefined, { ...optMonth, year: 'numeric' })}`;
    } catch {
      return startStr;
    }
  };

  const formatDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return {
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dateFormatted: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isToday: new Date().toISOString().split('T')[0] === dateStr,
      };
    } catch {
      return { weekday: 'Day', dateFormatted: dateStr, isToday: false };
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-8 select-none">
        {/* Editorial Page Header */}
        <EditorialPageHeader
          eyebrow="AI Wardrobe Intelligence"
          title="Weekly Outfit"
          italicTitle="Planner."
          description="Coordinated 7-day looks powered by calendar events, weather forecasts & colour harmony."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white dark:bg-[#1F1922] rounded-[2px] p-1 border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs">
                <button
                  onClick={() => shiftWeek(-1)}
                  className="p-1.5 rounded-[2px] hover:bg-[#FAF6F0] dark:hover:bg-[#201824] text-[#29202B] dark:text-[#F3EEE8] transition-colors cursor-pointer"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-xs font-mono font-medium text-[#29202B] dark:text-[#F3EEE8] min-w-[130px] text-center">
                  {formatWeekRange(currentWeekStart)}
                </span>
                <button
                  onClick={() => shiftWeek(1)}
                  className="p-1.5 rounded-[2px] hover:bg-[#FAF6F0] dark:hover:bg-[#201824] text-[#29202B] dark:text-[#F3EEE8] transition-colors cursor-pointer"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <Button
                onClick={() => handleGeneratePlan(plan !== null)}
                isLoading={generating}
                variant="primary"
                className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold px-4 py-2"
              >
                {generating ? (
                  <span>Generating...</span>
                ) : plan ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    <span>Regenerate Week</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    <span>Generate Plan</span>
                  </>
                )}
              </Button>
            </div>
          }
        />

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#DCD4CC] dark:border-[#392F3E] border-t-[#743C49] rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-[#777078] dark:text-[#DCD4CC]">
              Loading your weekly schedule & outfits...
            </p>
          </div>
        ) : !plan || plan.days.length === 0 ? (
          /* Empty / Unplanned State */
          <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-12 border border-[#DCD4CC] dark:border-[#392F3E] text-center max-w-xl mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-[2px] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto mb-5 text-[#743C49] dark:text-[#D5A6A0]">
              <CalendarIcon className="w-8 h-8 text-[#743C49]" />
            </div>
            <h3 className="text-2xl font-normal font-serif text-[#29202B] dark:text-[#F3EEE8] mb-2">
              No Plan for {formatWeekRange(currentWeekStart)}
            </h3>
            <p className="text-xs md:text-sm text-[#777078] dark:text-[#DCD4CC] mb-6 max-w-sm mx-auto leading-relaxed font-sans">
              Generate a tailored seven-day plan matched to your calendar events, local weather, and rotation history.
            </p>
            <Button
              onClick={() => handleGeneratePlan(false)}
              isLoading={generating}
              variant="primary"
              className="rounded-[2px] bg-[#743C49] hover:bg-[#5b2f3a] text-white uppercase tracking-[0.14em] text-xs font-semibold px-6"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate 7-Day Plan
            </Button>
          </div>
        ) : (
          /* 7-Day Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3.5">
            {plan.days.map((day) => {
              const { weekday, dateFormatted, isToday } = formatDayName(day.plan_date);
              const isRegenerating = regeneratingDayId === day.id;
              const isUpdating = updatingDayId === day.id;
              const exp = day.explanation_data || {};
              const context = exp.context || {};
              const swatches = context.color_swatches || [];

              return (
                <div
                  key={day.id}
                  className={cn(
                    'flex flex-col bg-white dark:bg-[#1F1922] rounded-[3px] border transition-all duration-300 overflow-hidden shadow-xs',
                    isToday
                      ? 'border-[#743C49] ring-1 ring-[#743C49]/30'
                      : 'border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
                  )}
                >
                  {/* Card Header: Day & Date */}
                  <div className={cn(
                    'p-3.5 border-b flex items-center justify-between',
                    isToday
                      ? 'bg-[#FAF6F0] dark:bg-[#201824] border-[#743C49]/30'
                      : 'bg-[#FAF6F0]/50 dark:bg-[#201824]/40 border-[#DCD4CC] dark:border-[#392F3E]'
                  )}>
                    <div>
                      <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#777078] dark:text-[#D5A6A0]">
                        {weekday}
                      </span>
                      <div className="text-xs font-serif font-normal text-[#29202B] dark:text-[#F3EEE8]">
                        {dateFormatted}
                      </div>
                    </div>

                    {/* Status Pill */}
                    {day.status === 'worn' ? (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono font-medium uppercase tracking-[0.1em] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                        Worn
                      </span>
                    ) : day.status === 'accepted' ? (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono font-medium uppercase tracking-[0.1em] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                        Accepted
                      </span>
                    ) : day.status === 'needs_manual_selection' ? (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono font-medium uppercase tracking-[0.1em] bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                        Manual
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-[2px] text-[9px] font-mono font-medium uppercase tracking-[0.1em] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8]">
                        Planned
                      </span>
                    )}
                  </div>

                  {/* Context Pills (Event & Weather) */}
                  <div className="px-3 pt-2.5 flex flex-col gap-1">
                    {context.dress_code && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#777C75] dark:text-[#A3ABA0] truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#727D69] flex-shrink-0" />
                        <span className="truncate font-medium">{context.dress_code}</span>
                      </div>
                    )}
                    {context.weather && (
                      <div className="flex items-center gap-1 text-[10px] text-[#777C75] dark:text-[#A3ABA0]">
                        <Sun className="w-3 h-3 text-amber-500 flex-shrink-0" />
                        <span>{context.temperature ? `${Math.round(context.temperature)}°C ` : ''}{context.weather}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Body: Outfit Visualization */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    {day.status === 'needs_manual_selection' || !day.outfit ? (
                      <div className="py-6 px-2 text-center flex flex-col items-center justify-center border border-dashed border-[#E2DDD3] dark:border-[#2D342F] rounded-xl my-2">
                        <AlertCircle className="w-6 h-6 text-amber-500 mb-1.5" />
                        <p className="text-[11px] font-medium text-[#202321] dark:text-[#F8F6F1] line-clamp-2 mb-3">
                          {exp.summary || 'Select an outfit manually'}
                        </p>
                        <button
                          onClick={() => setManualModalDay(day)}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                        >
                          Choose Outfit
                        </button>
                      </div>
                    ) : (
                      <div>
                        {/* Garment Images Collage */}
                        <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden bg-[#F1EEE7] dark:bg-[#242A25] p-1 mb-2.5 aspect-square">
                          {(day.outfit.clothing_items || day.outfit.pieces || []).slice(0, 4).map((item: any, idx: number) => {
                            const imgSrc = resolveImageUrl(item.preferred_image_url || item.image_url || item.image);
                            return (
                              <div
                                key={item.id || idx}
                                className="relative rounded-lg overflow-hidden bg-white dark:bg-[#1C201D] flex items-center justify-center border border-[#E2DDD3] dark:border-[#2D342F]"
                              >
                                {imgSrc ? (
                                  <img
                                    src={imgSrc}
                                    alt={item.name || 'Garment'}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Shirt className="w-4 h-4 text-[#899783]" />
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Outfit Title */}
                        <h4 className="text-xs font-semibold text-[#202321] dark:text-[#F8F6F1] truncate mb-1" title={day.outfit.name || day.outfit.title}>
                          {day.outfit.name || day.outfit.title || 'Daily Ensemble'}
                        </h4>

                        {/* Colour Swatches Palette Bar */}
                        {swatches.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              {swatches.map((sw: any, sIdx: number) => (
                                <span
                                  key={sIdx}
                                  className="w-3 h-3 rounded-full border border-black/10 dark:border-white/10 shadow-xs flex-shrink-0"
                                  style={{ backgroundColor: sw.hex }}
                                  title={`${sw.color_name} (${sw.category})`}
                                  aria-label={sw.color_name}
                                />
                              ))}
                              {context.color_harmony && (
                                <span className="text-[10px] text-[#777C75] dark:text-[#A3ABA0] font-medium truncate max-w-[100px]">
                                  {context.color_harmony.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Explanation Reason */}
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                          {exp.summary || (exp.reasons && exp.reasons[0]) || 'Curated tailored look.'}
                        </p>
                      </div>
                    )}

                    {/* Actions Toolbar */}
                    <div className="pt-2.5 border-t border-[#E2DDD3] dark:border-[#2D342F] flex items-center justify-between gap-1">
                      {/* Regenerate Single Day */}
                      <button
                        onClick={() => handleRegenerateDay(day.id)}
                        disabled={isRegenerating || isUpdating}
                        className="p-1.5 rounded-lg text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25] transition-colors disabled:opacity-50 cursor-pointer"
                        title="Regenerate this day's outfit"
                      >
                        <RefreshCw className={cn('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
                      </button>

                      {/* Manual Pick / Edit */}
                      <button
                        onClick={() => setManualModalDay(day)}
                        className="p-1.5 rounded-lg text-[#777C75] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25] transition-colors cursor-pointer"
                        title="Manually choose alternative"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>

                      {/* Accept Outfit */}
                      {day.status !== 'accepted' && day.status !== 'worn' && day.outfit && (
                        <button
                          onClick={() => handleStatusChange(day.id, 'accepted')}
                          disabled={isUpdating}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          title="Accept Outfit"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Mark as Worn */}
                      {day.status !== 'worn' && day.outfit && (
                        <button
                          onClick={() => handleStatusChange(day.id, 'worn')}
                          disabled={isUpdating}
                          className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                        >
                          Worn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Manual Outfit Selection Modal */}
        <Modal
          isOpen={Boolean(manualModalDay)}
          onClose={() => setManualModalDay(null)}
          title={manualModalDay ? `Select Outfit for ${formatDayName(manualModalDay.plan_date).dateFormatted}` : ''}
          subtitle="Choose garments from your wardrobe to build this day's look."
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* Select Top */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#777C75] dark:text-[#A3ABA0] uppercase tracking-wider mb-2">
                  Top / Upper Garment
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {wardrobe
                    .filter((i) => ['Tops', 'Dresses'].includes(i.category))
                    .slice(0, 9)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedTopId(item.id)}
                        className={cn(
                          'p-2.5 rounded-2xl border text-left flex flex-col items-center gap-1.5 transition-all cursor-pointer',
                          selectedTopId === item.id
                            ? 'border-[#727D69] bg-[#899783]/15'
                            : 'border-[#E2DDD3] dark:border-[#2D342F] hover:border-[#899783]'
                        )}
                      >
                        <div className="w-14 h-14 rounded-xl bg-[#F1EEE7] dark:bg-[#242A25] overflow-hidden">
                          <img
                            src={resolveImageUrl(item.image)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[#202321] dark:text-[#F8F6F1] truncate w-full text-center">
                          {item.name}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Select Bottom */}
              <div>
                <label className="block text-xs font-mono font-bold text-[#777C75] dark:text-[#A3ABA0] uppercase tracking-wider mb-2">
                  Bottom / Lower Garment
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {wardrobe
                    .filter((i) => i.category === 'Bottoms')
                    .slice(0, 9)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedBottomId(item.id)}
                        className={cn(
                          'p-2.5 rounded-2xl border text-left flex flex-col items-center gap-1.5 transition-all cursor-pointer',
                          selectedBottomId === item.id
                            ? 'border-[#727D69] bg-[#899783]/15'
                            : 'border-[#E2DDD3] dark:border-[#2D342F] hover:border-[#899783]'
                        )}
                      >
                        <div className="w-14 h-14 rounded-xl bg-[#F1EEE7] dark:bg-[#242A25] overflow-hidden">
                          <img
                            src={resolveImageUrl(item.image)}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[#202321] dark:text-[#F8F6F1] truncate w-full text-center">
                          {item.name}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#E2DDD3] dark:border-[#2D342F] flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setManualModalDay(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveManualOutfit}>
                Assign Look
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
};
