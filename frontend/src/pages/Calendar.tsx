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
  MapPin,
  SlidersHorizontal,
  Layers,
  Unlink,
  CalendarCheck,
  Filter,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import {
  CalendarEvent,
  Occasion,
  GoogleCalendarStatus,
  GoogleCalendarItem,
  DayAgendaSummary,
} from '../types';
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

const DRESS_CODES = [
  'Casual',
  'Smart Casual',
  'Business Casual',
  'Business Formal',
  'Cocktail',
  'Black Tie',
  'Athletic',
  'Outdoor Casual',
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

  // Filter state: 'all' | 'google' | 'tailorbird'
  const [sourceFilter, setSourceFilter] = useState<'all' | 'google' | 'tailorbird'>('all');

  // Google Calendar Integration State
  const [calStatus, setCalStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState<boolean>(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState<boolean>(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState<boolean>(false);

  // Calendars management modal
  const [isManageCalendarsOpen, setIsManageCalendarsOpen] = useState<boolean>(false);
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendarItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState<boolean>(false);
  const [isSavingCalendars, setIsSavingCalendars] = useState<boolean>(false);

  // Day Agenda & Harmonizer State
  const [dayAgenda, setDayAgenda] = useState<DayAgendaSummary | null>(null);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState<boolean>(false);

  // Edit Event Context Modal State
  const [editingContextEvent, setEditingContextEvent] = useState<CalendarEvent | null>(null);
  const [editOccasion, setEditOccasion] = useState<string>('Work & Office');
  const [editDressCode, setEditDressCode] = useState<string>('Business Casual');
  const [editFormality, setEditFormality] = useState<number>(0.5);
  const [isSavingContext, setIsSavingContext] = useState<boolean>(false);

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

  // Load Google Calendar connection status
  const loadCalendarStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const status = await api.calendar.getGoogleCalendarStatus();
      setCalStatus(status);
    } catch {
      // Non-critical; status remains null
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // Load Day Agenda for selected date
  const loadDayAgenda = useCallback(async (dateStr: string) => {
    setIsLoadingAgenda(true);
    try {
      const summary = await api.calendar.getDayAgenda(dateStr);
      setDayAgenda(summary);
    } catch {
      setDayAgenda(null);
    } finally {
      setIsLoadingAgenda(false);
    }
  }, []);

  // Load events for the current month range
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
      const srcParam = sourceFilter === 'all' ? undefined : sourceFilter;
      const data = await api.calendar.listEvents(startStr, endStr, undefined, srcParam);
      setEvents(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load calendar events');
    } finally {
      setIsLoading(false);
    }
  }, [year, month, totalDays, sourceFilter]);

  // Initial mount & URL query handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar_connected') === 'true') {
      showToast('Google Calendar connected! Your events have been synchronized.', 'success');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      const msg = params.get('message') || params.get('error');
      showToast(`Google Calendar: ${msg}`, 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }

    loadCalendarStatus();
  }, [loadCalendarStatus, showToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    loadDayAgenda(selectedDate);
  }, [selectedDate, loadDayAgenda]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadEvents(), loadCalendarStatus(), loadDayAgenda(selectedDate)]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { authorization_url } = await api.calendar.getGoogleCalendarConnectUrl('/calendar');
      window.location.href = authorization_url;
    } catch (err: any) {
      showToast(err?.message || 'Failed to initialize Google Calendar connection', 'info');
      setIsConnectingGoogle(false);
    }
  };

  const handleSyncGoogle = async () => {
    setIsSyncingGoogle(true);
    try {
      const res = await api.calendar.syncGoogleCalendar(30, 90);
      showToast(
        `Calendar synced: ${res.events_imported} imported, ${res.events_updated} updated.`,
        'success'
      );
      await Promise.all([loadEvents(), loadCalendarStatus(), loadDayAgenda(selectedDate)]);
    } catch (err: any) {
      showToast(err?.message || 'Google Calendar sync failed', 'info');
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google Calendar? Synced events will remain in your TailorBird wardrobe calendar.')) {
      return;
    }
    setIsDisconnectingGoogle(true);
    try {
      await api.calendar.disconnectGoogleCalendar();
      showToast('Google Calendar disconnected.', 'info');
      await Promise.all([loadCalendarStatus(), loadEvents()]);
    } catch (err: any) {
      showToast(err?.message || 'Failed to disconnect Google Calendar', 'info');
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const handleOpenManageCalendars = async () => {
    setIsManageCalendarsOpen(true);
    setIsLoadingCalendars(true);
    try {
      const list = await api.calendar.getGoogleCalendars();
      setGoogleCalendars(list);
      if (calStatus?.selected_calendars && calStatus.selected_calendars.length > 0) {
        setSelectedCalendarIds(calStatus.selected_calendars);
      } else {
        setSelectedCalendarIds(list.filter((c) => c.primary).map((c) => c.id));
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not fetch Google Calendars list', 'info');
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleSaveCalendars = async () => {
    if (selectedCalendarIds.length === 0) {
      showToast('Please select at least one calendar to sync', 'info');
      return;
    }
    setIsSavingCalendars(true);
    try {
      await api.calendar.updateGoogleCalendars(selectedCalendarIds);
      showToast('Calendar preferences saved. Synchronizing...', 'success');
      setIsManageCalendarsOpen(false);
      await handleSyncGoogle();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save calendar selection', 'info');
    } finally {
      setIsSavingCalendars(false);
    }
  };

  const toggleCalendarSelection = (calId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calId) ? prev.filter((id) => id !== calId) : [...prev, calId]
    );
  };

  // Context editing
  const handleOpenEditContext = (event: CalendarEvent) => {
    setEditingContextEvent(event);
    setEditOccasion(event.inferredOccasion || event.occasion || 'Casual Daily');
    setEditDressCode(event.inferredDressCode || 'Smart Casual');
    setEditFormality(
      typeof event.inferredFormality === 'number' ? event.inferredFormality : 0.5
    );
  };

  const handleSaveContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContextEvent) return;
    setIsSavingContext(true);
    try {
      const updated = await api.calendar.updateEventContext(editingContextEvent.id, {
        occasion: editOccasion,
        dress_code: editDressCode,
        formality: editFormality,
      });
      setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
      setEditingContextEvent(null);
      showToast('Event dress code and context updated!', 'success');
      await loadDayAgenda(selectedDate);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update event context', 'info');
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleCurateForEvent = (event: CalendarEvent) => {
    const occ = event.inferredOccasion || event.occasion || 'Casual Daily';
    const loc = event.location || '';
    const params = new URLSearchParams({
      occasion: occ,
      calendar_event_id: event.id,
      date: event.eventDate || selectedDate,
    });
    if (loc) {
      params.set('location', loc);
    }
    navigate(`/daily-fit?${params.toString()}`);
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
      await loadDayAgenda(selectedDate);
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
        nextStatus === 'cancelled' ? 'Outfit schedule cancelled' : 'Outfit schedule restored',
        'info'
      );
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
      await loadDayAgenda(planDate);
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
      const d = evt.eventDate || (evt as any).event_date;
      if (!d) continue;
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
                Wardrobe Calendar
              </h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Synchronize your Google schedule, plan outfits, and harmonize your daily looks.
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
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Prev
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <span className="px-2 text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 min-w-[120px] text-center">
                {monthNames[month]} {year}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        {/* Google Calendar Connection Status Banner */}
        <div className="mb-6">
          {calStatus?.is_connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Google Calendar Connected
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Sync
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {calStatus.google_email && <span>{calStatus.google_email}</span>}
                    <span>•</span>
                    <span>
                      {calStatus.event_count || 0} events tracked
                    </span>
                    {calStatus.last_sync_time && (
                      <>
                        <span>•</span>
                        <span>
                          Synced {new Date(calStatus.last_sync_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncGoogle}
                  isLoading={isSyncingGoogle}
                  icon={<RefreshCw className={cn('w-3.5 h-3.5', isSyncingGoogle && 'animate-spin')} />}
                >
                  Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenManageCalendars}
                  icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                >
                  Calendars
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectGoogle}
                  isLoading={isDisconnectingGoogle}
                  title="Disconnect Google Calendar"
                  className="!text-zinc-400 hover:!text-red-600"
                  icon={<Unlink className="w-3.5 h-3.5" />}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-lg bg-gradient-to-r from-zinc-50 via-zinc-100/60 to-zinc-50 dark:from-zinc-900 dark:via-zinc-800/40 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Connect Your Google Calendar
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 max-w-xl">
                    Import meetings, flights, and dinners into TailorBird. Get personalized outfit recommendations automatically tuned to each event&apos;s dress code, formality, and local weather.
                  </p>
                </div>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectGoogle}
                isLoading={isConnectingGoogle || isLoadingStatus}
                icon={<CalendarCheck className="w-4 h-4" />}
                className="self-start sm:self-auto flex-shrink-0"
              >
                Connect Calendar
              </Button>
            </div>
          )}
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Source:
          </span>
          {(['all', 'google', 'tailorbird'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSourceFilter(filter)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                sourceFilter === filter
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              )}
            >
              {filter === 'all'
                ? 'All Events'
                : filter === 'google'
                  ? 'Google Calendar'
                  : 'TailorBird Fits'}
            </button>
          ))}
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

        {/* Main Grid: Calendar Matrix (Left) + Selected Day Agenda (Right) */}
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

                const hasGoogle = dayEvts.some((e) => e.eventSource === 'google' || e.event_source === 'google');

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
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          isSelected
                            ? 'text-white dark:text-zinc-900'
                            : 'text-zinc-900 dark:text-zinc-100'
                        )}
                      >
                        {dayNum}
                      </span>
                      {hasGoogle && (
                        <span
                          className={cn(
                            'text-[9px] font-bold px-1 rounded',
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                          )}
                          title="Imported from Google Calendar"
                        >
                          G
                        </span>
                      )}
                    </div>

                    {/* Outfit / Event indicators */}
                    {dayEvts.length > 0 && (
                      <div className="flex items-center gap-1 mt-auto">
                        {dayEvts.slice(0, 3).map((ev, idx) => {
                          const isGoogle = ev.eventSource === 'google' || ev.event_source === 'google';
                          return (
                            <div
                              key={ev.id || idx}
                              className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                isGoogle
                                  ? isSelected
                                    ? 'bg-blue-200'
                                    : 'bg-blue-500'
                                  : ev.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : isSelected
                                      ? 'bg-white dark:bg-zinc-900'
                                      : 'bg-zinc-900 dark:bg-zinc-100'
                              )}
                              title={`${ev.title || ev.occasion || 'Event'}: ${ev.status}`}
                            />
                          );
                        })}
                        {dayEvts.length > 3 && (
                          <span
                            className={cn(
                              'text-[10px] font-bold',
                              isSelected
                                ? 'text-white dark:text-zinc-900'
                                : 'text-zinc-500 dark:text-zinc-400'
                            )}
                          >
                            +{dayEvts.length - 3}
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
                    onClick={() => navigate(`/daily-fit?date=${selectedDate}`)}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Curate
                  </Button>
                </div>
              </div>

              {/* Day Harmonizer: Multi-Event Analysis Card */}
              {dayAgenda && dayAgenda.event_count > 1 && (
                <div className="mb-4 p-3.5 rounded-lg border bg-zinc-50/80 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 mt-0.5 flex-shrink-0">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                          Day Harmonizer ({dayAgenda.event_count} Events)
                        </span>
                        {dayAgenda.is_outfit_change_recommended ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            Outfit Change Recommended
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            Single Versatile Look
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                        {dayAgenda.reason}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>Target: <strong className="text-zinc-800 dark:text-zinc-200">{dayAgenda.suggested_overall_occasion}</strong></span>
                        <span>•</span>
                        <span>Style: <strong className="text-zinc-800 dark:text-zinc-200">{dayAgenda.suggested_dress_code}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* List of Events for Selected Day */}
              {isLoading ? (
                <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  Loading scheduled fits...
                </div>
              ) : dayEvents.length === 0 ? (
                <div className="py-10 text-center rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                  <Shirt className="w-8 h-8 text-zinc-400 dark:text-zinc-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    No Outfits or Events
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[220px] mx-auto">
                    Schedule a look manually or let TailorBird synthesize recommendations for this day.
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
                      onClick={() => navigate(`/daily-fit?date=${selectedDate}`)}
                    >
                      Recommendations
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {dayEvents.map((event) => {
                    const isGoogleEvent =
                      event.eventSource === 'google' || event.event_source === 'google';
                    const hasOutfit = !!event.outfit;
                    const eventTitle =
                      event.title ||
                      event.outfit?.title ||
                      event.notes ||
                      (isGoogleEvent ? 'Google Calendar Event' : 'Custom Planned Fit');
                    const formalityPercent =
                      typeof event.inferredFormality === 'number'
                        ? Math.round(event.inferredFormality * 100)
                        : typeof event.inferred_formality === 'number'
                          ? Math.round(event.inferred_formality * 100)
                          : null;

                    return (
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
                          {hasOutfit && event.outfit?.image ? (
                            <img
                              src={event.outfit.image}
                              alt={event.outfit.title}
                              className="w-16 h-16 rounded object-cover shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 flex-shrink-0">
                              <Shirt className="w-6 h-6" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            {/* Badges: Source + Status */}
                            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5">
                                {isGoogleEvent ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    Google Calendar
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                                    TailorBird
                                  </span>
                                )}

                                {(event.inferredOccasion || event.occasion) && (
                                  <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                                    {event.inferredOccasion || event.occasion}
                                  </span>
                                )}
                              </div>

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

                            {/* Event Title */}
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {eventTitle}
                            </h4>

                            {/* Time & Location details */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                              {event.isAllDay || event.is_all_day ? (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>All Day</span>
                                </div>
                              ) : event.startTime || event.start_time ? (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {(event.startTime || event.start_time || '').slice(0, 5)}
                                    {event.endTime || event.end_time
                                      ? ` – ${(event.endTime || event.end_time || '').slice(0, 5)}`
                                      : ''}
                                  </span>
                                </div>
                              ) : null}

                              {event.location && (
                                <div className="flex items-center gap-1 truncate max-w-[180px]">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{event.location}</span>
                                </div>
                              )}
                            </div>

                            {/* Inferred Context Badges */}
                            {(event.inferredDressCode || event.inferred_dress_code || formalityPercent !== null) && (
                              <div className="flex items-center gap-2 mt-1.5">
                                {(event.inferredDressCode || event.inferred_dress_code) && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    {event.inferredDressCode || event.inferred_dress_code}
                                  </span>
                                )}
                                {formalityPercent !== null && (
                                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                    {formalityPercent}% Formality
                                  </span>
                                )}
                              </div>
                            )}

                            {event.notes && event.outfit?.title && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2 italic">
                                &ldquo;{event.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Outfit Pieces Thumbnails */}
                        {event.outfit && event.outfit.pieces && event.outfit.pieces.length > 0 && (
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
                        <div className="flex flex-wrap items-center justify-end gap-1.5 mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          {/* If no outfit attached, show prominent Curate Outfit button */}
                          {!hasOutfit && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleCurateForEvent(event)}
                              className="text-xs h-7 px-2.5"
                              icon={<Sparkles className="w-3 h-3" />}
                            >
                              Curate Look
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditContext(event)}
                            className="text-xs h-7 px-2"
                            title="Edit dress code & formality"
                          >
                            Edit Context
                          </Button>

                          {hasOutfit && event.status !== 'completed' && event.status !== 'cancelled' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsWorn(event)}
                              className="text-xs h-7 px-2 !text-emerald-700 dark:!text-emerald-400 !border-emerald-500/30"
                              icon={<CheckCircle className="w-3 h-3" />}
                            >
                              Worn
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelStatus(event)}
                            className="text-xs h-7 px-2"
                          >
                            {event.status === 'cancelled' ? 'Restore' : 'Cancel'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-xs h-7 px-2 !text-red-600 hover:!text-red-700"
                            icon={<Trash2 className="w-3 h-3" />}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manage Google Calendars Modal */}
        <Modal
          isOpen={isManageCalendarsOpen}
          onClose={() => setIsManageCalendarsOpen(false)}
          title="Synchronized Calendars"
          subtitle="Choose which Google Calendars should be included in your TailorBird wardrobe schedule."
          maxWidth="md"
        >

              {isLoadingCalendars ? (
                <div className="py-8 text-center text-xs text-zinc-500">Loading calendars...</div>
              ) : googleCalendars.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500">
                  No calendars found. Try refreshing or re-connecting.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {googleCalendars.map((cal) => {
                    const isChecked = selectedCalendarIds.includes(cal.id);
                    return (
                      <label
                        key={cal.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded border cursor-pointer transition-colors',
                          isChecked
                            ? 'bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600'
                            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCalendarSelection(cal.id)}
                            className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {cal.summary}
                          </span>
                        </div>
                        {cal.primary && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex-shrink-0">
                            Primary
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsManageCalendarsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingCalendars}
                  onClick={handleSaveCalendars}
                >
                  Save Selection
                </Button>
              </div>
            </div>
        </Modal>

        {/* Edit Event Context & Dress Code Modal */}
        <Modal
          isOpen={Boolean(editingContextEvent)}
          onClose={() => setEditingContextEvent(null)}
          title="Adjust Event Styling Context"
          subtitle={editingContextEvent?.title}
          maxWidth="md"
        >
          <form onSubmit={handleSaveContext} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                    Occasion Category
                  </label>
                  <select
                    value={editOccasion}
                    onChange={(e) => setEditOccasion(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
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
                    Dress Code
                  </label>
                  <select
                    value={editDressCode}
                    onChange={(e) => setEditDressCode(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 cursor-pointer"
                  >
                    {DRESS_CODES.map((dc) => (
                      <option key={dc} value={dc}>
                        {dc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Formality Rating
                    </label>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {Math.round(editFormality * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={editFormality}
                    onChange={(e) => setEditFormality(parseFloat(e.target.value))}
                    className="w-full accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                    <span>Ultra Casual</span>
                    <span>Smart Casual</span>
                    <span>Formal / Black Tie</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingContextEvent(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingContext}
                  >
                    Apply Changes
                  </Button>
                </div>
              </form>
        </Modal>

        {/* Plan Outfit Modal */}
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          title="Plan Outfit Look"
          subtitle="Schedule an outfit for a specific upcoming calendar day."
          maxWidth="md"
        >
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
        </Modal>
      </PullToRefresh>
    </AppShell>
  );
};

export default Calendar;
