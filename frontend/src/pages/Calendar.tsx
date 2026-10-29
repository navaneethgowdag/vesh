import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Sparkles,
  CheckCircle,
  Trash2,
  AlertCircle,
  Shirt,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { CalendarEvent, Occasion } from '../types';
import { api } from '../services/api';
import { cn } from '../utils/cn';

const OCCASIONS: Occasion[] = [
  'Casual Daily',
  'Work & Office',
  'Date Night',
  'Weekend Outing',
  'Party & Evening',
  'Travel & Airport',
  'Formal Event',
];

export const Calendar: React.FC = () => {
  const { showToast } = useApp();
  const navigate = useNavigate();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Plan Outfit Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planDate, setPlanDate] = useState(selectedDate);
  const [planOccasion, setPlanOccasion] = useState<string>('Work & Office');
  const [planNotes, setPlanNotes] = useState('');
  const [planTime, setPlanTime] = useState('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Month boundary calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayIndex = firstDayOfMonth.getDay(); // 0 is Sunday
  const totalDays = lastDayOfMonth.getDate();

  // Load events for the current month range
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
      const data = await api.calendar.listEvents(startStr, endStr);
      setEvents(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [year, month, totalDays]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadEvents();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await api.calendar.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      if (selectedEvent?.id === id) {
        setSelectedEvent(null);
      }
      showToast('Calendar event removed', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove event', 'info');
    }
  };

  const handleMarkAsWorn = async (event: CalendarEvent) => {
    try {
      const updated = await api.calendar.updateEvent(event.id, { status: 'completed' });
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(updated);
      }
      showToast('Outfit marked as worn!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update event', 'info');
    }
  };

  const handleCancelStatus = async (event: CalendarEvent) => {
    try {
      const nextStatus = event.status === 'cancelled' ? 'scheduled' : 'cancelled';
      const updated = await api.calendar.updateEvent(event.id, { status: nextStatus });
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      if (selectedEvent?.id === event.id) {
        setSelectedEvent(updated);
      }
      showToast(nextStatus === 'cancelled' ? 'Outfit schedule cancelled' : 'Outfit schedule restored', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update event', 'info');
    }
  };

  const handleOpenPlanModal = (targetDate?: string) => {
    setPlanDate(targetDate || selectedDate);
    setPlanOccasion('Work & Office');
    setPlanNotes('');
    setPlanTime('');
    setIsPlanModalOpen(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDate) return;

    setIsSavingPlan(true);
    try {
      const newEvt = await api.calendar.createEvent({
        event_date: planDate,
        occasion: planOccasion,
        notes: planNotes.trim() || undefined,
        start_time: planTime ? `${planTime}:00` : undefined,
      });
      setEvents((prev) => [...prev, newEvt]);
      setSelectedDate(planDate);
      setIsPlanModalOpen(false);
      showToast('Outfit scheduled on calendar!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to schedule outfit', 'info');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Build map of date -> events[]
  const eventDateMap = React.useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const evt of events) {
      const d = evt.eventDate;
      if (!map[d]) map[d] = [];
      map[d].push(evt);
    }
    return map;
  }, [events]);

  const dayEvents = eventDateMap[selectedDate] || [];

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <AppShell>
      <PullToRefresh onRefresh={handleRefresh}>
        {/* Page Title & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md">
                <CalendarIcon className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Outfit Calendar
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Plan, organize, and track your daily wardrobe rotation.
            </p>
          </div>

          {/* Action Controls & Month Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh calendar"
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center"
              aria-label="Refresh calendar"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenPlanModal()}
              icon={<Plus className="w-4 h-4" />}
            >
              Plan Outfit
            </Button>

            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 min-h-[44px]">
              <Button variant="ghost" size="sm" onClick={handlePrevMonth} icon={<ChevronLeft className="w-4 h-4" />}>
                Prev
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <span className="px-2 text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 min-w-[120px] text-center">
                {monthNames[month]} {year}
              </span>
              <Button variant="ghost" size="sm" onClick={handleNextMonth} icon={<ChevronRight className="w-4 h-4" />}>
                Next
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-6 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={loadEvents} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        {/* Main Grid: Calendar Grid (Left) + Selected Day Agenda (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Calendar Monthly Matrix (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            {/* Day of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Empty offset slots */}
              {Array.from({ length: startDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square rounded opacity-0" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: totalDays }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = selectedDate === dateStr;
                const isToday = new Date().toISOString().split('T')[0] === dateStr;
                const dayEvts = eventDateMap[dateStr] || [];

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      'aspect-square rounded p-2 flex flex-col justify-between transition-colors border text-left relative group cursor-pointer',
                      isSelected
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-bold'
                        : isToday
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-400 dark:border-zinc-500 font-bold'
                          : 'bg-zinc-50/50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                    )}
                  >
                    <span className={cn('text-xs font-semibold', isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100')}>
                      {dayNum}
                    </span>

                    {/* Outfit indicators */}
                    {dayEvts.length > 0 && (
                      <div className="flex items-center gap-1 mt-auto">
                        {dayEvts.slice(0, 2).map((ev, idx) => (
                          <div
                            key={ev.id || idx}
                            className={cn(
                              'w-2 h-2 rounded-full',
                              ev.status === 'cancelled'
                                ? 'bg-red-400'
                                : ev.status === 'completed'
                                  ? 'bg-emerald-500'
                                  : isSelected
                                    ? 'bg-white dark:bg-zinc-900'
                                    : 'bg-zinc-900 dark:bg-zinc-100'
                            )}
                            title={`${ev.occasion || 'Outfit'}: ${ev.status}`}
                          />
                        ))}
                        {dayEvts.length > 2 && (
                          <span className={cn('text-[10px] font-bold', isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400')}>
                            +{dayEvts.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Agenda for
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenPlanModal(selectedDate)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Plan
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/daily-fit')}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Curate
                  </Button>
                </div>
              </div>

              {/* List of Outfits for Selected Day */}
              {isLoading ? (
                <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">Loading scheduled fits...</div>
              ) : dayEvents.length === 0 ? (
                <div className="py-10 text-center rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <Shirt className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">No Outfit Planned</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px] mx-auto">
                    Pick a look from your Daily Fit recommendations or schedule your styling directly.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenPlanModal(selectedDate)}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Plan Outfit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/daily-fit')}
                    >
                      Recommendations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        'p-4 rounded-md border transition-all bg-zinc-50 dark:bg-zinc-800/40',
                        event.status === 'cancelled'
                          ? 'border-zinc-200 dark:border-zinc-800 opacity-60'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {event.outfit?.image ? (
                          <img
                            src={event.outfit.image}
                            alt={event.outfit.title}
                            className="w-16 h-16 rounded object-cover shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 flex-shrink-0">
                            <Shirt className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                              {event.occasion || 'Planned Outfit'}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1',
                                event.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : event.status === 'cancelled'
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                              )}
                            >
                              {event.status === 'completed' && <Check className="w-2.5 h-2.5" />}
                              {event.status === 'completed' ? 'Worn' : event.status}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                            {event.outfit?.title || event.notes || 'Custom Outfit'}
                          </h4>

                          {event.startTime && (
                            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{event.startTime.slice(0, 5)}</span>
                            </div>
                          )}

                          {event.notes && event.outfit?.title && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2 italic">
                              &ldquo;{event.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Outfit Pieces Thumbnails */}
                      {event.outfit && event.outfit.pieces.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-zinc-200 dark:border-zinc-800">
                          {event.outfit.pieces.slice(0, 4).map((p) => (
                            <img
                              key={p.id}
                              src={p.image}
                              alt={p.name}
                              title={`${p.name} (${p.category})`}
                              className="w-8 h-8 rounded object-cover border border-zinc-200 dark:border-zinc-700"
                            />
                          ))}
                          {event.outfit.pieces.length > 4 && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              +{event.outfit.pieces.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        {event.status !== 'completed' && event.status !== 'cancelled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsWorn(event)}
                            className="text-xs h-8 px-2.5 !text-emerald-700 dark:!text-emerald-400 !border-emerald-500/30"
                            icon={<CheckCircle className="w-3 h-3" />}
                          >
                            Mark as Worn
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelStatus(event)}
                          className="text-xs h-8 px-2"
                        >
                          {event.status === 'cancelled' ? 'Restore' : 'Cancel'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-xs h-8 px-2 !text-red-600 hover:!text-red-700"
                          icon={<Trash2 className="w-3 h-3" />}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Outfit Modal */}
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded">
                    <CalendarIcon className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                    Plan Outfit Look
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                    Occasion
                  </label>
                  <select
                    value={planOccasion}
                    onChange={(e) => setPlanOccasion(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
                  >
                    {OCCASIONS.map((occ) => (
                      <option key={occ} value={occ}>
                        {occ}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2.5 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                    Notes / Outfit Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Linen blazer look, dinner reservation, presentation fit..."
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded p-3 text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingPlan}
                    className="min-h-[44px]"
                  >
                    Schedule Outfit
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </PullToRefresh>
    </AppShell>
  );
};

export default Calendar;
