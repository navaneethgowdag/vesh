import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Crown,
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Layers,
  Settings,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  Clock,
  Shirt,
  Info,
  X,
  Check,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useApp } from '../context/AppContext';
import {
  ClothingItem,
  VaultAnalyticsResponse,
  VaultEventPrepResponse,
  VaultSettingsUpdate,
  CalendarEvent,
} from '../types';
import { api } from '../services/api';
import {
  CANONICAL_OCCASION_GROUPS,
  EVENT_ATTENDEE_ROLES,
  CARE_TYPE_OPTIONS,
  WEAR_TIER_OPTIONS,
  WARDROBE_COLLECTION_GROUPS,
} from '../constants/occasions';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../utils/imageUrl';

type VaultTab = 'all' | 'luxury_special' | 'elevated' | 'reserved';

export const OccasionVault: React.FC = () => {
  const { showToast, refreshData } = useApp();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<VaultTab>('all');
  const [vaultItems, setVaultItems] = useState<ClothingItem[]>([]);
  const [analytics, setAnalytics] = useState<VaultAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Event Prep State
  const [prepOccasion, setPrepOccasion] = useState<string>('Wedding');
  const [prepRole, setPrepRole] = useState<string>('guest');
  const [prepEventName, setPrepEventName] = useState<string>('Summer Wedding');
  const [prepDate, setPrepDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [isPrepping, setIsPrepping] = useState<boolean>(false);
  const [prepResult, setPrepResult] = useState<VaultEventPrepResponse | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);

  // Item Edit Modal State
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Form Fields for Item Edit Modal
  const [editWearTier, setEditWearTier] = useState<'daily' | 'elevated' | 'luxury_special'>('luxury_special');
  const [editIsLuxury, setEditIsLuxury] = useState<boolean>(true);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editCareType, setEditCareType] = useState<'machine_wash' | 'hand_wash' | 'dry_clean_only' | 'delicate'>('dry_clean_only');
  const [editRestriction, setEditRestriction] = useState<'none' | 'special_occasions_only' | 'custom_occasions_only'>('special_occasions_only');
  const [editWardrobeGroups, setEditWardrobeGroups] = useState<string[]>(['luxury_special']);
  const [editNotes, setEditNotes] = useState<string>('');

  // Fetch Vault Data
  const fetchVaultData = useCallback(async () => {
    try {
      const [items, stats] = await Promise.all([
        api.vault.getItems(),
        api.vault.getAnalytics().catch(() => null),
      ]);
      setVaultItems(items);
      if (stats) setAnalytics(stats);
    } catch (err: any) {
      showToast(err.message || 'Could not load Occasion Vault', 'info');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchVaultData();
  }, [fetchVaultData]);

  // Load upcoming events quietly
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const endStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    api.calendar
      .listEvents(todayStr, endStr)
      .then((events) => {
        setUpcomingEvents(events);
        if (events.length > 0) {
          const first = events[0];
          setPrepEventName(first.title || 'Special Occasion');
          if (first.occasion) setPrepOccasion(first.occasion);
          if (first.eventDate) setPrepDate(first.eventDate);
        }
      })
      .catch(() => {});
  }, []);

  // Filtered items by active tab
  const filteredItems = useMemo(() => {
    return vaultItems.filter((item) => {
      if (activeTab === 'luxury_special') {
        return item.wearTier === 'luxury_special' || item.wear_tier === 'luxury_special' || item.isLuxury || item.is_luxury;
      }
      if (activeTab === 'elevated') {
        return item.wearTier === 'elevated' || item.wear_tier === 'elevated';
      }
      if (activeTab === 'reserved') {
        const st = item.reservedStatus || item.reserved_status;
        return st === 'reserved';
      }
      return true;
    });
  }, [vaultItems, activeTab]);

  // Toggle Reservation
  const handleToggleReserve = async (item: ClothingItem) => {
    const isCurrentlyReserved = (item.reservedStatus || item.reserved_status) === 'reserved';
    const nextReserved = !isCurrentlyReserved;
    try {
      await api.vault.toggleReserve(item.id, {
        reserved: nextReserved,
        reserved_date: nextReserved ? new Date().toISOString().split('T')[0] : undefined,
      });
      showToast(
        nextReserved ? `"${item.name}" reserved for upcoming occasions` : `"${item.name}" is now available`,
        'success'
      );
      // Local state update
      setVaultItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                reservedStatus: nextReserved ? 'reserved' : 'available',
                reserved_status: nextReserved ? 'reserved' : 'available',
              }
            : i
        )
      );
      if (analytics) {
        setAnalytics({
          ...analytics,
          reserved_items_count: Math.max(0, analytics.reserved_items_count + (nextReserved ? 1 : -1)),
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update reservation', 'info');
    }
  };

  // Open Edit Modal
  const openEditModal = (item: ClothingItem) => {
    setSelectedItem(item);
    setEditWearTier((item.wearTier || item.wear_tier || 'luxury_special') as any);
    setEditIsLuxury(item.isLuxury ?? item.is_luxury ?? true);
    setEditPrice(item.purchasePrice !== undefined ? String(item.purchasePrice) : item.purchase_price !== undefined ? String(item.purchase_price) : '');
    setEditDate(item.purchaseDate || item.purchase_date || '');
    setEditCareType((item.careType || item.care_type || 'dry_clean_only') as any);
    setEditRestriction((item.specialUseRestriction || item.special_use_restriction || 'special_occasions_only') as any);
    setEditWardrobeGroups(item.wardrobeGroups || item.wardrobe_groups || ['luxury_special']);
    setEditNotes(item.notes || '');
    setEditModalOpen(true);
  };

  // Save Settings Modal
  const handleSaveSettings = async () => {
    if (!selectedItem) return;
    setIsSavingSettings(true);
    try {
      const updates: VaultSettingsUpdate = {
        wear_tier: editWearTier,
        is_luxury: editIsLuxury,
        purchase_price: editPrice ? parseFloat(editPrice) : undefined,
        purchase_date: editDate || undefined,
        care_type: editCareType,
        special_use_restriction: editRestriction,
        wardrobe_groups: editWardrobeGroups,
        notes: editNotes.trim() || undefined,
      };

      const updatedItem = await api.vault.updateSettings(selectedItem.id, updates);
      showToast(`Updated vault settings for "${selectedItem.name}"`, 'success');

      setVaultItems((prev) =>
        prev.map((i) => (i.id === selectedItem.id ? { ...i, ...updatedItem } : i))
      );
      setEditModalOpen(false);
      fetchVaultData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update item settings', 'info');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Run Event Preparation Check
  const handleRunEventPrep = async () => {
    setIsPrepping(true);
    try {
      const res = await api.vault.eventPrep({
        event_name: prepEventName.trim() || 'Special Occasion',
        occasion: prepOccasion,
        attendee_role: prepRole,
        event_date: prepDate,
      });
      setPrepResult(res);
      showToast(`Event readiness calculated for ${prepOccasion}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Event preparation analysis failed', 'info');
    } finally {
      setIsPrepping(false);
    }
  };

  const toggleGroupSelection = (grp: string) => {
    setEditWardrobeGroups((prev) =>
      prev.includes(grp) ? prev.filter((g) => g !== grp) : [...prev, grp]
    );
  };

  return (
    <AppShell showRightSidebar={true}>
      <div className="max-w-5xl mx-auto space-y-8 pb-16 select-none">
        {/* Header Banner */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-zinc-900 via-neutral-900 to-amber-950 text-white overflow-hidden shadow-xl border border-amber-500/20">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold tracking-wide uppercase">
                <Crown className="w-3.5 h-3.5" />
                <span>Occasion Vault & Wardrobe Protection</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-serif text-white">
                Occasion Vault
              </h1>
              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                Protect special-occasion and luxury attire from inappropriate casual rotations. Prepare
                curated outfits for galas, weddings, and milestone ceremonies, and track wear cost efficiency.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
                onClick={() => {
                  setIsRefreshing(true);
                  fetchVaultData();
                }}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-amber-400 text-neutral-950 hover:bg-amber-300 font-bold"
                onClick={() => navigate('/wardrobe')}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Garments
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          {analytics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
              <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-zinc-400 block text-[11px]">Vault Valuation</span>
                <span className="text-lg font-bold text-amber-300">
                  ${analytics.total_valuation.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-zinc-400 block text-[11px]">Avg. Cost Per Wear</span>
                <span className="text-lg font-bold text-white">
                  ${Math.round(analytics.average_cost_per_wear)} / wear
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-zinc-400 block text-[11px]">Luxury & Special</span>
                <span className="text-lg font-bold text-white">
                  {analytics.luxury_items_count} items
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3 rounded-2xl border border-white/10">
                <span className="text-zinc-400 block text-[11px]">Reserved Garments</span>
                <span className="text-lg font-bold text-emerald-400">
                  {analytics.reserved_items_count} locked
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 1: Event Readiness Preparation Tool */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Occasion Readiness & Event Preparation
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Pre-flight check for upcoming weddings, galas, and celebrations with care reminders.
                </p>
              </div>
            </div>
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Event Name */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={prepEventName}
                onChange={(e) => setPrepEventName(e.target.value)}
                placeholder="e.g. Maya & Arjun Wedding"
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Occasion Selection */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Occasion Type
              </label>
              <select
                value={prepOccasion}
                onChange={(e) => setPrepOccasion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {CANONICAL_OCCASION_GROUPS.map((grp) => (
                  <optgroup key={grp.categoryKey} label={grp.name}>
                    {grp.occasions.map((occ) => (
                      <option key={occ.id} value={occ.name}>
                        {occ.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Attendee Role */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Your Role
              </label>
              <select
                value={prepRole}
                onChange={(e) => setPrepRole(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {EVENT_ATTENDEE_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={prepDate}
                onChange={(e) => setPrepDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunEventPrep}
              disabled={isPrepping}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
              icon={<Sparkles className={`w-3.5 h-3.5 ${isPrepping ? 'animate-spin' : ''}`} />}
            >
              {isPrepping ? 'Evaluating Wardrobe...' : 'Evaluate Event Readiness'}
            </Button>
          </div>

          {/* Prep Results Display */}
          {prepResult && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      prepResult.readiness_score >= 80
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : prepResult.readiness_score >= 50
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {prepResult.readiness_score}%
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Readiness Status:{' '}
                      <span className="capitalize">{prepResult.status.replace('_', ' ')}</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Evaluated for {prepResult.event_name} ({prepResult.occasion})
                    </p>
                  </div>
                </div>
              </div>

              {/* Care Reminders */}
              {prepResult.care_reminders && prepResult.care_reminders.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Garment Care & Dry Cleaning Reminders</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200 pl-6 list-disc">
                    {prepResult.care_reminders.map((care, idx) => (
                      <li key={idx}>
                        <span className="font-semibold">{care.item_name}</span>: {care.action} ({care.care_type.replace('_', ' ')})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Components */}
              {prepResult.missing_components && prepResult.missing_components.length > 0 && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Missing Wardrobe Elements for this Occasion</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-rose-900 dark:text-rose-200 pl-6 list-disc">
                    {prepResult.missing_components.map((comp, idx) => (
                      <li key={idx}>
                        <span className="font-semibold uppercase tracking-wider text-[11px]">{comp.slot}</span>: {comp.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Combinations */}
              {prepResult.recommended_combinations && prepResult.recommended_combinations.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Curated Vault Combinations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {prepResult.recommended_combinations.map((comb, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-3"
                      >
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium italic">
                          &ldquo;{comb.style_notes}&rdquo;
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {comb.pieces.map((p) => (
                            <div
                              key={p.id}
                              className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 relative group"
                            >
                              <img
                                src={resolveImageUrl(p.image)}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = FALLBACK_POST_IMAGE;
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-[9px] text-white text-center font-medium">
                                {p.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: Vault Garments & Filtering */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                All Vault Items ({vaultItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('luxury_special')}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                  activeTab === 'luxury_special'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Luxury & Special
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('elevated')}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                  activeTab === 'elevated'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Elevated Wear
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reserved')}
                className={`px-4 py-1.5 rounded-xl font-medium transition-all cursor-pointer shrink-0 ${
                  activeTab === 'reserved'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                Reserved Garments
              </button>
            </div>
          </div>

          {/* Grid of Garments */}
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">Opening Occasion Vault...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 px-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                No garments in this Vault view
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                You can tag any wardrobe item as Special, Luxury, or Elevated to keep it protected in the Vault.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/wardrobe')}
                icon={<Shirt className="w-3.5 h-3.5" />}
              >
                Browse My Wardrobe
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isReserved = (item.reservedStatus || item.reserved_status) === 'reserved';
                const isLux = item.isLuxury || item.is_luxury || item.wearTier === 'luxury_special' || item.wear_tier === 'luxury_special';
                const cpw = item.costPerWear ?? item.cost_per_wear;
                const price = item.purchasePrice ?? item.purchase_price;

                return (
                  <div
                    key={item.id}
                    className="group relative rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md"
                  >
                    {/* Image Thumbnail */}
                    <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <img
                        src={resolveImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_POST_IMAGE;
                        }}
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                        {isLux && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-zinc-950 font-extrabold text-[10px] shadow-sm flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            LUXURY
                          </span>
                        )}
                        {item.wearTier === 'elevated' && !isLux && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900/90 text-white font-bold text-[10px] backdrop-blur-xs">
                            ELEVATED
                          </span>
                        )}
                      </div>

                      {/* Reserved Status Overlay */}
                      <div className="absolute top-2 right-2">
                        {isReserved ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-bold text-[10px] shadow-sm flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            RESERVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-900/70 text-zinc-200 font-medium text-[10px] backdrop-blur-xs">
                            Available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Garment Details */}
                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                          <span>{item.category}</span>
                          {item.brand && <span className="font-semibold truncate max-w-[90px]">{item.brand}</span>}
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                          {item.name}
                        </h4>
                      </div>

                      {/* Valuation / Cost Per Wear stats */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-zinc-400 block text-[10px]">Price</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {price ? `$${price}` : '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-400 block text-[10px]">Cost / Wear</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {cpw ? `$${Math.round(cpw)}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Care Instruction Tag */}
                      {(item.careType || item.care_type) && (
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg truncate">
                          Care: {(item.careType || item.care_type || '').replace('_', ' ')}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleReserve(item)}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                            isReserved
                              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-200'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {isReserved ? (
                            <>
                              <Unlock className="w-3 h-3" /> Free Item
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> Reserve
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                          title="Edit Vault Settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: Edit Garment Vault Settings */}
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Vault Settings: ${selectedItem?.name || 'Garment'}`}
        >
          {selectedItem && (
            <div className="space-y-5 text-xs text-zinc-800 dark:text-zinc-200">
              {/* Wear Tier */}
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Wear Tier & Protection Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WEAR_TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setEditWearTier(tier.key as any)}
                      className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                        editWearTier === tier.key
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold'
                          : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{tier.label}</span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        {tier.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Luxury Flag Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <div>
                  <span className="font-semibold block text-zinc-900 dark:text-zinc-100">
                    High-Value / Luxury Garment
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Strictly isolates item from everyday casual recommendations.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsLuxury}
                  onChange={(e) => setEditIsLuxury(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Price and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Care Instructions */}
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Care Type
                </label>
                <select
                  value={editCareType}
                  onChange={(e) => setEditCareType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {CARE_TYPE_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wardrobe Group Collections */}
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Wardrobe Collections
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WARDROBE_COLLECTION_GROUPS.map((grp) => {
                    const isChecked = editWardrobeGroups.includes(grp.key);
                    return (
                      <button
                        key={grp.key}
                        type="button"
                        onClick={() => toggleGroupSelection(grp.key)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-200 font-semibold'
                            : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="text-xs">{grp.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Special Restriction */}
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Usage Restriction
                </label>
                <select
                  value={editRestriction}
                  onChange={(e) => setEditRestriction(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="none">No Restriction (Available anywhere)</option>
                  <option value="special_occasions_only">Special Occasions Only (Weddings/Galas)</option>
                  <option value="custom_occasions_only">Explicitly Chosen Occasions Only</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Garment Preservation Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Silk garment; store in garment bag with cedar blocks."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSavingSettings}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  {isSavingSettings ? 'Saving...' : 'Save Vault Settings'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppShell>
  );
};
