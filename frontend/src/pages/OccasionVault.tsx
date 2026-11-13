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
        <div className="relative rounded-[4px] p-6 sm:p-8 bg-[#29202B] text-[#F3EEE8] overflow-hidden shadow-xs border border-[#392F3E]">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[2px] bg-[#743C49]/40 border border-[#D5A6A0]/40 text-[#D5A6A0] text-[10px] font-medium tracking-[0.16em] uppercase font-mono">
                <Crown className="w-3.5 h-3.5 text-[#D5A6A0]" />
                <span>Occasion Vault & Wardrobe Protection</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-normal tracking-tight font-serif text-[#F3EEE8]">
                Occasion Vault
              </h1>
              <p className="text-[#DCD4CC] text-xs sm:text-sm leading-relaxed font-sans">
                Protect special-occasion and luxury attire from inappropriate casual rotations. Prepare
                curated outfits for galas, weddings, and milestone ceremonies, and track wear cost efficiency.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 cursor-pointer rounded-[2px] uppercase tracking-[0.1em] text-xs"
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
                className="bg-[#743C49] hover:bg-[#5b2f3a] text-white rounded-[2px] uppercase tracking-[0.14em] text-xs font-semibold"
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
              <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-[2px] border border-white/10">
                <span className="text-[#DCD4CC] block text-[10px] uppercase tracking-[0.14em] font-mono">Vault Valuation</span>
                <span className="text-2xl font-light font-serif text-[#D5A6A0] mt-0.5 block">
                  ${analytics.total_valuation.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-[2px] border border-white/10">
                <span className="text-[#DCD4CC] block text-[10px] uppercase tracking-[0.14em] font-mono">Avg. Cost Per Wear</span>
                <span className="text-2xl font-light font-serif text-[#F3EEE8] mt-0.5 block">
                  ${Math.round(analytics.average_cost_per_wear)} <span className="text-xs text-[#DCD4CC] font-sans">/ wear</span>
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-[2px] border border-white/10">
                <span className="text-[#DCD4CC] block text-[10px] uppercase tracking-[0.14em] font-mono">Luxury & Special</span>
                <span className="text-2xl font-light font-serif text-[#F3EEE8] mt-0.5 block">
                  {analytics.luxury_items_count} <span className="text-xs text-[#DCD4CC] font-sans">pieces</span>
                </span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-3.5 rounded-[2px] border border-white/10">
                <span className="text-[#DCD4CC] block text-[10px] uppercase tracking-[0.14em] font-mono">Reserved Garments</span>
                <span className="text-2xl font-light font-serif text-emerald-400 mt-0.5 block">
                  {analytics.reserved_items_count} <span className="text-xs text-[#DCD4CC] font-sans">locked</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 1: Event Readiness Preparation Tool */}
        <div className="bg-white dark:bg-[#1F1922] rounded-[3px] p-6 border border-[#DCD4CC] dark:border-[#392F3E] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#DCD4CC] dark:border-[#392F3E] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[2px] bg-[#FAF6F0] dark:bg-[#201824] text-[#743C49] dark:text-[#D5A6A0] flex items-center justify-center border border-[#DCD4CC] dark:border-[#392F3E]">
                <Sparkles className="w-5 h-5 text-[#743C49] dark:text-[#D5A6A0]" />
              </div>
              <div>
                <h2 className="text-xl font-serif font-normal text-[#29202B] dark:text-[#F3EEE8]">
                  Occasion Readiness & Event Preparation
                </h2>
                <p className="text-xs text-[#777078] dark:text-[#DCD4CC] mt-0.5 font-sans">
                  Pre-flight check for upcoming weddings, galas, and celebrations with care reminders.
                </p>
              </div>
            </div>
          </div>

          {/* Form controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Event Name */}
            <div>
              <label className="block font-semibold text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Event Name
              </label>
              <input
                type="text"
                value={prepEventName}
                onChange={(e) => setPrepEventName(e.target.value)}
                placeholder="e.g. Maya & Arjun Wedding"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69]"
              />
            </div>

            {/* Occasion Selection */}
            <div>
              <label className="block font-semibold text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Occasion Type
              </label>
              <select
                value={prepOccasion}
                onChange={(e) => setPrepOccasion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69] cursor-pointer"
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
              <label className="block font-semibold text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Your Role
              </label>
              <select
                value={prepRole}
                onChange={(e) => setPrepRole(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69] cursor-pointer"
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
              <label className="block font-semibold text-[#777C75] dark:text-[#A3ABA0] mb-1">
                Target Date
              </label>
              <input
                type="date"
                value={prepDate}
                onChange={(e) => setPrepDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#242A25] border border-[#E2DDD3] dark:border-[#2D342F] text-[#202321] dark:text-[#F8F6F1] focus:outline-none focus:ring-1 focus:ring-[#727D69] font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunEventPrep}
              disabled={isPrepping}
              className="bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] font-bold shadow-xs cursor-pointer"
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
                        className="p-4 rounded-[3px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] space-y-3"
                      >
                        <p className="text-xs text-[#29202B]/80 dark:text-[#F3EEE8]/80 font-serif italic">
                          &ldquo;{comb.style_notes}&rdquo;
                        </p>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                          {comb.pieces.map((p) => (
                            <div
                              key={p.id}
                              className="w-16 h-20 rounded-[2px] overflow-hidden bg-[#FAF6F0] dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] shrink-0 relative group"
                            >
                              <img
                                src={resolveImageUrl(p.image)}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = FALLBACK_POST_IMAGE;
                                }}
                              />
                              <div className="absolute inset-0 bg-[#29202B]/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1 text-[9px] text-[#F3EEE8] text-center font-mono uppercase tracking-[0.08em]">
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
            <div className="flex items-center gap-1.5 p-1 rounded-[2px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] text-xs overflow-x-auto hide-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-[2px] font-mono uppercase tracking-[0.14em] text-[10px] transition-all cursor-pointer shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                    : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                }`}
              >
                All Vault Items ({vaultItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('luxury_special')}
                className={`px-3.5 py-1.5 rounded-[2px] font-mono uppercase tracking-[0.14em] text-[10px] transition-all cursor-pointer shrink-0 ${
                  activeTab === 'luxury_special'
                    ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                    : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                }`}
              >
                Luxury & Special
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('elevated')}
                className={`px-3.5 py-1.5 rounded-[2px] font-mono uppercase tracking-[0.14em] text-[10px] transition-all cursor-pointer shrink-0 ${
                  activeTab === 'elevated'
                    ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                    : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                }`}
              >
                Elevated Wear
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reserved')}
                className={`px-3.5 py-1.5 rounded-[2px] font-mono uppercase tracking-[0.14em] text-[10px] transition-all cursor-pointer shrink-0 ${
                  activeTab === 'reserved'
                    ? 'bg-[#29202B] text-[#F3EEE8] dark:bg-[#F3EEE8] dark:text-[#29202B] font-semibold'
                    : 'text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8]'
                }`}
              >
                Reserved Garments
              </button>
            </div>
          </div>

          {/* Grid of Garments */}
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#743C49] animate-spin mx-auto" />
              <p className="text-xs font-mono tracking-[0.12em] uppercase text-[#777078]">Opening Occasion Vault...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 px-4 bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#743C49] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center mx-auto">
                <Crown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-serif font-normal text-[#29202B] dark:text-[#F3EEE8]">
                No garments in this Vault view
              </h3>
              <p className="text-xs text-[#777078] dark:text-[#D5A6A0]">
                Tag any wardrobe piece as Special, Luxury, or Elevated to keep it protected in the Vault.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/wardrobe')}
                icon={<Shirt className="w-3.5 h-3.5" />}
                className="rounded-[2px] font-mono uppercase tracking-[0.14em] text-[10px]"
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
                    className="group relative rounded-[3px] bg-white dark:bg-[#1F1922] border border-[#DCD4CC] dark:border-[#392F3E] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#743C49] duration-300"
                  >
                    {/* Image Thumbnail */}
                    <div className="relative aspect-[3/4] bg-[#FAF6F0] dark:bg-[#241D27] overflow-hidden">
                      <img
                        src={resolveImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500 ease-out"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_POST_IMAGE;
                        }}
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                        {isLux && (
                          <span className="px-2 py-0.5 rounded-[2px] bg-[#B49B82] text-[#29202B] font-mono font-semibold text-[9px] tracking-[0.14em] uppercase flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" />
                            LUXURY
                          </span>
                        )}
                        {item.wearTier === 'elevated' && !isLux && (
                          <span className="px-2 py-0.5 rounded-[2px] bg-[#29202B] text-[#F3EEE8] font-mono font-semibold text-[9px] tracking-[0.14em] uppercase border border-white/10">
                            ELEVATED
                          </span>
                        )}
                      </div>

                      {/* Reserved Status Overlay */}
                      <div className="absolute top-2.5 right-2.5">
                        {isReserved ? (
                          <span className="px-2 py-0.5 rounded-[2px] bg-[#743C49] text-white font-mono font-semibold text-[9px] tracking-[0.14em] uppercase flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            RESERVED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-[2px] bg-[#29202B]/80 text-[#F3EEE8] font-mono text-[9px] tracking-[0.14em] uppercase backdrop-blur-xs">
                            Available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Garment Details */}
                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-[#777078] dark:text-[#D5A6A0] uppercase tracking-[0.14em] font-mono">
                          <span>{item.category}</span>
                          {item.brand && <span className="text-[#29202B] dark:text-[#F3EEE8] truncate max-w-[90px] font-sans">{item.brand}</span>}
                        </div>
                        <h4 className="text-sm font-serif font-normal text-[#29202B] dark:text-[#F3EEE8] truncate mt-1">
                          {item.name}
                        </h4>
                      </div>

                      {/* Valuation / Cost Per Wear stats */}
                      <div className="pt-2 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-[#777078] block text-[9px] font-mono uppercase tracking-[0.12em]">Price</span>
                          <span className="font-semibold font-mono text-xs text-[#29202B] dark:text-[#F3EEE8]">
                            {price ? `$${price}` : '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#777078] block text-[9px] font-mono uppercase tracking-[0.12em]">Cost / Wear</span>
                          <span className="font-semibold font-mono text-xs text-[#29202B] dark:text-[#F3EEE8]">
                            {cpw ? `$${Math.round(cpw)}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Care Instruction Tag */}
                      {(item.careType || item.care_type) && (
                        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-[#6D7068] dark:text-[#D5A6A0] bg-[#FAF6F0] dark:bg-[#2A222D] px-2 py-1 rounded-[2px] border border-[#DCD4CC] dark:border-[#392F3E] truncate">
                          Care: {(item.careType || item.care_type || '').replace('_', ' ')}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleReserve(item)}
                          className={`flex-1 py-1.5 px-2 rounded-[2px] text-[10px] font-mono uppercase tracking-[0.12em] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                            isReserved
                              ? 'bg-[#743C49]/15 text-[#743C49] dark:text-[#D5A6A0] hover:bg-[#743C49]/25 border border-[#743C49]/30'
                              : 'bg-[#FAF6F0] dark:bg-[#2A222D] text-[#29202B] dark:text-[#F3EEE8] border border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49]'
                          }`}
                        >
                          {isReserved ? (
                            <>
                              <Unlock className="w-3 h-3" /> Free
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
                          className="p-1.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#2A222D] text-[#777078] hover:text-[#29202B] dark:hover:text-[#F3EEE8] border border-[#DCD4CC] dark:border-[#392F3E] cursor-pointer"
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
            <div className="space-y-4 text-xs text-[#29202B] dark:text-[#F3EEE8]">
              {/* Wear Tier */}
              <div>
                <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1.5">
                  Wear Tier & Protection Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {WEAR_TIER_OPTIONS.map((tier) => (
                    <button
                      key={tier.key}
                      type="button"
                      onClick={() => setEditWearTier(tier.key as any)}
                      className={`p-2.5 rounded-[2px] border text-left cursor-pointer transition-all ${
                        editWearTier === tier.key
                          ? 'border-[#743C49] bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0]'
                          : 'border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#241D27] hover:border-[#743C49]'
                      }`}
                    >
                      <span className="block text-xs font-serif font-medium">{tier.label}</span>
                      <span className="text-[10px] text-[#777078] dark:text-[#A3ABA0]">
                        {tier.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Luxury Flag Toggle */}
              <div className="flex items-center justify-between p-3 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E]">
                <div>
                  <span className="font-serif text-sm block text-[#29202B] dark:text-[#F3EEE8]">
                    High-Value / Luxury Garment
                  </span>
                  <span className="text-[11px] text-[#777078] dark:text-[#A3ABA0]">
                    Strictly isolates item from everyday casual recommendations.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsLuxury}
                  onChange={(e) => setEditIsLuxury(e.target.checked)}
                  className="w-4 h-4 accent-[#743C49] rounded-[2px] cursor-pointer"
                />
              </div>

              {/* Price and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
                    Purchase Price ($)
                  </label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-3 py-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                  />
                </div>
              </div>

              {/* Care Instructions */}
              <div>
                <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
                  Care Type
                </label>
                <select
                  value={editCareType}
                  onChange={(e) => setEditCareType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
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
                <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
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
                        className={`p-2.5 rounded-[2px] border text-left cursor-pointer transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-[#743C49] bg-[#743C49]/10 text-[#743C49] dark:text-[#D5A6A0]'
                            : 'border-[#DCD4CC] dark:border-[#392F3E] bg-[#FAF6F0] dark:bg-[#241D27] hover:border-[#743C49]'
                        }`}
                      >
                        <span className="text-xs font-mono">{grp.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-[#743C49]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Special Restriction */}
              <div>
                <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
                  Usage Restriction
                </label>
                <select
                  value={editRestriction}
                  onChange={(e) => setEditRestriction(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49]"
                >
                  <option value="none">No Restriction (Available anywhere)</option>
                  <option value="special_occasions_only">Special Occasions Only (Weddings/Galas)</option>
                  <option value="custom_occasions_only">Explicitly Chosen Occasions Only</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-mono uppercase tracking-[0.14em] text-[10px] text-[#777078] mb-1">
                  Garment Preservation Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Silk garment; store in garment bag with cedar blocks."
                  rows={2}
                  className="w-full px-3 py-2 rounded-[2px] bg-[#FAF6F0] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] focus:outline-none focus:border-[#743C49] text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCD4CC] dark:border-[#392F3E]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isSavingSettings}
                  className="rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-[#743C49] hover:bg-[#5C2F3A] text-white rounded-[2px] font-mono text-[10px] uppercase tracking-[0.14em]"
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
