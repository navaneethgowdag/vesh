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
      showToast(
        nextStatus === 'cancelled' ? 'Outfit marked as cancelled' : 'Outfit restored to scheduled',
        'info'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update status', 'info');
    }
  };

  const handleOpenPlanModal = (targetDate?: string) => {
    setPlanDate(targetDate || selectedDate);
    setPlanNotes('');
    setPlanTime('');
    setIsPlanModalOpen(true);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planDate) {
      showToast('Please select a date', 'info');
      return;
    }

    setIsSavingPlan(true);
    try {
      const newEvent = await api.calendar.createEvent({
        event_date: planDate,
        start_time: planTime ? `${planTime}:00` : undefined,
        occasion: planOccasion,
        notes: planNotes.trim() || undefined,
        event_type: 'planned_outfit',
      });
      setEvents((prev) => [...prev, newEvent]);
      setIsPlanModalOpen(false);
      setSelectedDate(planDate);
      showToast('Outfit planned and added to calendar!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to plan outfit', 'info');
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Filter events scheduled on the selected day
  const dayEvents = events.filter((e) => e.eventDate === selectedDate);

  // Group events by date for rendering calendar indicators
  const eventDateMap: { [dateStr: string]: CalendarEvent[] } = {};
  events.forEach((e) => {
    if (!eventDateMap[e.eventDate]) {
      eventDateMap[e.eventDate] = [];
    }
    eventDateMap[e.eventDate].push(e);
  });

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
              <span className="p-1.5 bg-luxury-champagne/15 text-luxury-champagne dark:text-luxury-dark-champagne rounded-xl border border-luxury-champagne/30">
                <CalendarIcon className="w-4 h-4" />
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
                Outfit Calendar
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
              Plan, organize, and track your daily wardrobe rotation.
            </p>
          </div>

          {/* Action Controls & Month Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh calendar"
              className="p-2.5 rounded-full border border-luxury-border dark:border-luxury-dark-border text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text bg-luxury-surface dark:bg-luxury-dark-surface hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle transition-all cursor-pointer shadow-soft-xs"
              aria-label="Refresh calendar"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-luxury-champagne' : ''}`} />
            </button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenPlanModal()}
              icon={<Plus className="w-4 h-4" />}
            >
              Plan Outfit
            </Button>

            <div className="flex items-center gap-1.5 bg-luxury-surface dark:bg-luxury-dark-surface border border-luxury-border dark:border-luxury-dark-border rounded-2xl p-1.5 shadow-soft-xs">
              <Button variant="ghost" size="sm" onClick={handlePrevMonth} icon={<ChevronLeft className="w-4 h-4" />}>
                Prev
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <span className="px-2 text-xs sm:text-sm font-bold text-luxury-text dark:text-luxury-dark-text min-w-[120px] text-center font-serif">
                {monthNames[month]} {year}
              </span>
              <Button variant="ghost" size="sm" onClick={handleNextMonth} icon={<ChevronRight className="w-4 h-4" />}>
                Next
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400">
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
          <div className="lg:col-span-7 xl:col-span-8 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border p-5 shadow-soft">
            {/* Day of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2 pb-2 border-b border-luxury-border dark:border-luxury-dark-border text-[11px] font-bold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted">
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
                <div key={`empty-${i}`} className="aspect-square rounded-2xl opacity-0" />
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
                      'aspect-square rounded-2xl p-2 flex flex-col justify-between transition-all duration-150 border text-left relative group cursor-pointer',
                      isSelected
                        ? 'bg-luxury-espresso dark:bg-luxury-dark-champagne text-white dark:text-luxury-dark-espresso border-transparent shadow-soft-sm'
                        : isToday
                          ? 'bg-luxury-champagne/15 text-luxury-text dark:text-luxury-dark-text border-luxury-champagne font-bold'
                          : 'bg-luxury-surfaceSubtle/40 dark:bg-luxury-dark-surfaceSubtle/40 text-luxury-text dark:text-luxury-dark-text border-luxury-border/70 dark:border-luxury-dark-border/70 hover:border-luxury-champagne/50'
                    )}
                  >
                    <span className={cn('text-xs font-semibold', isSelected ? 'text-white dark:text-luxury-dark-espresso font-bold' : 'text-luxury-text dark:text-luxury-dark-text')}>
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
                                    ? 'bg-luxury-champagneLight dark:bg-luxury-dark-espresso'
                                    : 'bg-luxury-champagne'
                            )}
                            title={`${ev.occasion || 'Outfit'}: ${ev.status}`}
                          />
                        ))}
                        {dayEvts.length > 2 && (
                          <span className={cn('text-[9px] font-bold', isSelected ? 'text-white/80 dark:text-luxury-dark-espresso/80' : 'text-luxury-textMuted dark:text-luxury-dark-textMuted')}>
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
            <div className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border p-5 shadow-soft">
              <div className="flex items-center justify-between border-b border-luxury-border dark:border-luxury-dark-border pb-3 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-champagne dark:text-luxury-dark-champagne">
                    Agenda for
                  </span>
                  <h3 className="font-serif text-lg font-bold text-luxury-text dark:text-luxury-dark-text">
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
                <div className="py-12 text-center text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted">Loading scheduled fits...</div>
              ) : dayEvents.length === 0 ? (
                <div className="py-10 text-center rounded-2xl bg-luxury-surfaceSubtle/50 dark:bg-luxury-dark-surfaceSubtle/50 border border-dashed border-luxury-border dark:border-luxury-dark-border p-6">
                  <Shirt className="w-8 h-8 text-luxury-champagne/40 mx-auto mb-2" />
                  <p className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text">No Outfit Planned</p>
                  <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1 max-w-[200px] mx-auto">
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
                        'p-4 rounded-2xl border transition-all shadow-soft-xs bg-luxury-surfaceSubtle/30 dark:bg-luxury-dark-surfaceSubtle/30',
                        event.status === 'cancelled'
                          ? 'border-luxury-border dark:border-luxury-dark-border opacity-60'
                          : 'border-luxury-border dark:border-luxury-dark-border hover:border-luxury-champagne/50'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {event.outfit?.image ? (
                          <img
                            src={event.outfit.image}
                            alt={event.outfit.title}
                            className="w-16 h-16 rounded-xl object-cover shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle flex items-center justify-center text-luxury-textMuted flex-shrink-0">
                            <Shirt className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-luxury-champagne dark:text-luxury-dark-champagne">
                              {event.occasion || 'Planned Outfit'}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1',
                                event.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : event.status === 'cancelled'
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                    : 'bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text border border-luxury-border dark:border-luxury-dark-border'
                              )}
                            >
                              {event.status === 'completed' && <Check className="w-2.5 h-2.5" />}
                              {event.status === 'completed' ? 'Worn' : event.status}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text truncate mt-0.5">
                            {event.outfit?.title || event.notes || 'Custom Outfit'}
                          </h4>

                          {event.startTime && (
                            <div className="flex items-center gap-1 text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{event.startTime.slice(0, 5)}</span>
                            </div>
                          )}

                          {event.notes && event.outfit?.title && (
                            <p className="text-[11px] text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1 line-clamp-2 italic">
                              &quot;{event.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Outfit Pieces Thumbnails */}
                      {event.outfit && event.outfit.pieces.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-luxury-border dark:border-luxury-dark-border">
                          {event.outfit.pieces.slice(0, 4).map((p) => (
                            <img
                              key={p.id}
                              src={p.image}
                              alt={p.name}
                              title={`${p.name} (${p.category})`}
                              className="w-8 h-8 rounded-lg object-cover border border-luxury-border dark:border-luxury-dark-border"
                            />
                          ))}
                          {event.outfit.pieces.length > 4 && (
                            <span className="text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted font-medium">
                              +{event.outfit.pieces.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center justify-end gap-1.5 mt-3 pt-2 border-t border-luxury-border dark:border-luxury-dark-border">
                        {event.status !== 'completed' && event.status !== 'cancelled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsWorn(event)}
                            className="text-[11px] h-7 px-2.5 !text-emerald-600 dark:!text-emerald-400 !border-emerald-500/30"
                            icon={<CheckCircle className="w-3 h-3" />}
                          >
                            Mark as Worn
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelStatus(event)}
                          className="text-[11px] h-7 px-2"
                        >
                          {event.status === 'cancelled' ? 'Restore' : 'Cancel'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-[11px] h-7 px-2 !text-red-500 hover:!text-red-600"
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
            <div className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft-xl max-w-md w-full p-6 animate-scale-up">
              <div className="flex items-center justify-between pb-3 border-b border-luxury-border dark:border-luxury-dark-border mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-luxury-champagne/15 text-luxury-champagne dark:text-luxury-dark-champagne rounded-xl border border-luxury-champagne/30">
                    <CalendarIcon className="w-4 h-4" />
                  </span>
                  <h3 className="font-serif font-bold text-lg text-luxury-text dark:text-luxury-dark-text">
                    Plan Outfit Look
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-luxury-surfaceSubtle dark:hover:bg-luxury-dark-surfaceSubtle text-luxury-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-xl px-3 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1">
                    Occasion
                  </label>
                  <select
                    value={planOccasion}
                    onChange={(e) => setPlanOccasion(e.target.value)}
                    className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-xl px-3 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                  >
                    {OCCASIONS.map((occ) => (
                      <option key={occ} value={occ}>
                        {occ}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-xl px-3 py-2 text-xs text-luxury-text dark:text-luxury-dark-text focus:outline-none focus:ring-1 focus:ring-luxury-champagne"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-luxury-textMuted dark:text-luxury-dark-textMuted mb-1">
                    Notes / Outfit Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Linen blazer look, dinner reservation, presentation fit..."
                    value={planNotes}
                    onChange={(e) => setPlanNotes(e.target.value)}
                    className="w-full bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 border border-luxury-border dark:border-luxury-dark-border rounded-xl p-3 text-xs text-luxury-text dark:text-luxury-dark-text placeholder:text-luxury-textMuted/60 focus:outline-none focus:ring-1 focus:ring-luxury-champagne resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-luxury-border dark:border-luxury-dark-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPlanModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingPlan}
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
