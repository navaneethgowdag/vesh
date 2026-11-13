import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Shirt,
  Search,
  ArrowUpDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Check,
  AlertCircle,
  RefreshCw,
  Heart,
  Crown,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { PendingReviewCard } from '../components/wardrobe/PendingReviewCard';
import { ClothingReviewModal } from '../components/wardrobe/ClothingReviewModal';
import { AddClothingModal } from '../components/wardrobe/AddClothingModal';
import { BatchUploadModal } from '../components/wardrobe/BatchUploadModal';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { ClothingItem } from '../types';
import { api } from '../services/api';

const CATEGORIES = [
  'All',
  'Tops & Shirts',
  'Bottoms & Jeans',
  'Indian Ethnic',
  'Dresses & Skirts',
  'Outerwear & Blazers',
  'Footwear',
  'Accessories',
] as const;

type CategoryFilter = typeof CATEGORIES[number];
type WardrobeSection = 'accepted' | 'pending' | 'all';

export const Wardrobe: React.FC = () => {
  const { wardrobe, refreshData, showToast } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Section Tab: default to URL param or 'accepted' (or 'pending' if items exist and param set)
  const initialSection = (searchParams.get('tab') as WardrobeSection) || 'accepted';
  const [wardrobeSection, setWardrobeSection] = useState<WardrobeSection>(initialSection);

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [selectedWardrobeGroup, setSelectedWardrobeGroup] = useState<string>('all');
  const [laundryFilter, setLaundryFilter] = useState<'all' | 'clean' | 'in_laundry' | 'unavailable'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'wears' | 'name'>('recent');

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalIndex, setReviewModalIndex] = useState(0);
  const [isBulkAccepting, setIsBulkAccepting] = useState(false);

  // Sync tab state with URL search param
  useEffect(() => {
    const tabParam = searchParams.get('tab') as WardrobeSection;
    if (tabParam && ['accepted', 'pending', 'all'].includes(tabParam) && tabParam !== wardrobeSection) {
      setWardrobeSection(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (sec: WardrobeSection) => {
    setWardrobeSection(sec);
    setSearchParams({ tab: sec });
  };

  // Segregate items by lifecycle: Pending Review vs Accepted Clothing
  const pendingItems = useMemo(() => {
    return wardrobe.filter((item) => {
      const isFailed = item.processingStatus === 'failed' || item.processingStage === 'failed';
      const isProcessing =
        item.processingStatus === 'queued' ||
        item.processingStatus === 'processing' ||
        item.processingStage === 'queued' ||
        item.processingStage === 'analyzing_clothing';
      const isReadyForReview =
        item.reviewRequired ||
        item.processingStatus === 'ready_for_review' ||
        item.processingStatus === 'manual_review_required' ||
        item.processingStatus === 'predictions_ready';
      const isNotFinalized = item.isFinalized === false;

      return isFailed || isProcessing || isReadyForReview || isNotFinalized;
    });
  }, [wardrobe]);

  const acceptedItems = useMemo(() => {
    return wardrobe.filter((item) => {
      const isPending =
        item.reviewRequired ||
        item.isFinalized === false ||
        ['predictions_ready', 'ready_for_review', 'manual_review_required', 'queued', 'processing', 'failed'].includes(
          item.processingStatus || ''
        );
      return !isPending;
    });
  }, [wardrobe]);

  const readyToReviewItems = useMemo(() => {
    return pendingItems.filter(
      (item) =>
        item.processingStatus !== 'failed' &&
        item.processingStage !== 'failed' &&
        item.processingStatus !== 'queued' &&
        item.processingStatus !== 'processing'
    );
  }, [pendingItems]);

  // Active polling: auto-refresh while any garment is actively queued or processing
  const hasActiveProcessingItems = useMemo(() => {
    return wardrobe.some(
      (item) =>
        item.processingStatus === 'queued' ||
        item.processingStatus === 'processing' ||
        item.processingStage === 'queued' ||
        item.processingStage === 'analyzing_clothing'
    );
  }, [wardrobe]);

  useEffect(() => {
    if (!hasActiveProcessingItems) return;
    const interval = setInterval(() => {
      refreshData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [hasActiveProcessingItems, refreshData]);

  const totalItems = wardrobe.length;
  const topsCount = acceptedItems.filter((i) =>
    ['tops', 'shirt', 't_shirt', 't-shirt'].includes((i.category || '').toLowerCase())
  ).length;
  const bottomsCount = acceptedItems.filter((i) =>
    ['bottoms', 'jeans', 'pants', 'salwar', 'churidar'].includes((i.category || '').toLowerCase())
  ).length;
  const ethnicCount = acceptedItems.filter((i) =>
    ['saree', 'blouse', 'kurta', 'kurti', 'lehenga', 'sherwani', 'dupatta'].includes(
      (i.category || '').toLowerCase()
    )
  ).length;
  const othersCount = acceptedItems.length - (topsCount + bottomsCount + ethnicCount);

  // Laundry Status Counts
  const cleanCount = acceptedItems.filter(
    (i) => !(i.laundryStatus || i.laundry_status) || (i.laundryStatus || i.laundry_status) === 'clean'
  ).length;
  const inLaundryCount = acceptedItems.filter(
    (i) => (i.laundryStatus || i.laundry_status) === 'in_laundry'
  ).length;
  const unavailableCount = acceptedItems.filter(
    (i) => (i.laundryStatus || i.laundry_status) === 'unavailable'
  ).length;

  // Filter items based on current section, category, search, and sort
  const displayItems = useMemo(() => {
    const baseList =
      wardrobeSection === 'pending'
        ? pendingItems
        : wardrobeSection === 'accepted'
          ? acceptedItems
          : wardrobe;

    return baseList
      .filter((item) => {
        if (favoritesOnly && !item.isFavorite) {
          return false;
        }

        // Laundry status matching (applies to accepted and all tabs)
        if (wardrobeSection !== 'pending' && laundryFilter !== 'all') {
          const st = item.laundryStatus || item.laundry_status || 'clean';
          if (laundryFilter === 'clean' && st !== 'clean') return false;
          if (laundryFilter === 'in_laundry' && st !== 'in_laundry') return false;
          if (laundryFilter === 'unavailable' && st !== 'unavailable') return false;
        }

        // Wardrobe Collection Group filter
        if (wardrobeSection !== 'pending' && selectedWardrobeGroup !== 'all') {
          const groups = item.wardrobeGroups || item.wardrobe_groups || [];
          const wearTier = item.wearTier || item.wear_tier;
          const isLux = item.isLuxury || item.is_luxury;
          const cat = (item.category || '').toLowerCase();
          if (selectedWardrobeGroup === 'luxury_special') {
            if (!groups.includes('luxury_special') && wearTier !== 'luxury_special' && !isLux) {
              return false;
            }
          } else if (selectedWardrobeGroup === 'traditional_festive') {
            const isEthnic = ['saree', 'blouse', 'kurta', 'kurti', 'salwar', 'churidar', 'lehenga', 'sherwani', 'dupatta'].includes(cat);
            if (!groups.includes('traditional_festive') && !isEthnic) {
              return false;
            }
          } else if (selectedWardrobeGroup === 'party_evening') {
            if (!groups.includes('party_evening') && wearTier !== 'elevated' && !item.style?.toLowerCase().includes('party')) {
              return false;
            }
          } else if (selectedWardrobeGroup === 'daily_work') {
            if (!groups.includes('daily_work') && wearTier === 'luxury_special' && isLux) {
              return false;
            }
          }
        }

        const cat = (item.category || '').toLowerCase();

        // Category filter matching (applies to accepted and all tabs)
        if (wardrobeSection !== 'pending' && activeCategory !== 'All') {
          if (
            activeCategory === 'Tops & Shirts' &&
            !['tops', 'shirt', 't_shirt', 't-shirt'].includes(cat)
          ) {
            return false;
          }
          if (
            activeCategory === 'Bottoms & Jeans' &&
            !['bottoms', 'jeans', 'pants', 'salwar', 'churidar'].includes(cat)
          ) {
            return false;
          }
          if (
            activeCategory === 'Indian Ethnic' &&
            !['saree', 'blouse', 'kurta', 'kurti', 'salwar', 'churidar', 'lehenga', 'sherwani', 'dupatta'].includes(
              cat
            )
          ) {
            return false;
          }
          if (
            activeCategory === 'Dresses & Skirts' &&
            !['dresses', 'western_dress', 'skirt', 'dress'].includes(cat)
          ) {
            return false;
          }
          if (
            activeCategory === 'Outerwear & Blazers' &&
            !['outerwear', 'jacket', 'blazer', 'coat'].includes(cat)
          ) {
            return false;
          }
          if (
            activeCategory === 'Footwear' &&
            !['shoes', 'sneakers', 'sandals', 'heels', 'flats', 'formal_shoes', 'boots'].includes(cat)
          ) {
            return false;
          }
          if (
            activeCategory === 'Accessories' &&
            !['accessories', 'bags', 'handbag', 'backpack', 'belt', 'watch', 'scarf', 'other_accessory'].includes(
              cat
            )
          ) {
            return false;
          }
        }

        // Search Query matching
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = (item.name || '').toLowerCase().includes(q);
          const matchesCategory = cat.includes(q);
          const matchesBrand = (item.brand || '').toLowerCase().includes(q);
          const matchesColor = (item.color || '').toLowerCase().includes(q);
          const matchesSecColor = (item.secondaryColor || '').toLowerCase().includes(q);
          const matchesPattern = (item.pattern || '').toLowerCase().includes(q);
          const matchesMaterial = (item.material || '').toLowerCase().includes(q);
          const matchesStyle = (item.style || '').toLowerCase().includes(q);

          if (
            !matchesName &&
            !matchesCategory &&
            !matchesBrand &&
            !matchesColor &&
            !matchesSecColor &&
            !matchesPattern &&
            !matchesMaterial &&
            !matchesStyle
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wears') return (b.timesWorn || 0) - (a.timesWorn || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [wardrobeSection, pendingItems, acceptedItems, wardrobe, activeCategory, searchQuery, sortBy]);

  // Handle opening review modal for an item
  const handleOpenReview = (item: ClothingItem) => {
    const idx = pendingItems.findIndex((p) => p.id === item.id);
    setReviewModalIndex(idx >= 0 ? idx : 0);
    setReviewModalOpen(true);
  };

  // Handle reviewing all pending items sequentially
  const handleReviewAllPending = () => {
    if (readyToReviewItems.length === 0) return;
    const firstReadyIdx = pendingItems.findIndex(
      (p) => p.id === readyToReviewItems[0].id
    );
    setReviewModalIndex(firstReadyIdx >= 0 ? firstReadyIdx : 0);
    setReviewModalOpen(true);
  };

  // Bulk accept all items whose AI predictions are completed
  const handleBulkAcceptAll = async () => {
    if (readyToReviewItems.length === 0) return;
    const count = readyToReviewItems.length;
    if (
      !confirm(
        `Accept all ${count} AI-analyzed garments with their predicted attributes and add them to your closet?`
      )
    ) {
      return;
    }

    setIsBulkAccepting(true);
    try {
      const itemIds = readyToReviewItems.map((i) => i.id);
      const res = await api.clothing.bulkFinalize(itemIds);
      showToast(res.message || `Successfully accepted ${res.finalizedCount} garments!`, 'success');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Bulk acceptance failed.', 'info');
    } finally {
      setIsBulkAccepting(false);
    }
  };

  return (
    <AppShell>
      <PullToRefresh onRefresh={refreshData}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs uppercase tracking-widest font-semibold text-[#777C75] dark:text-[#A3ABA0] block mb-1">
              Personal Collection
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#202321] dark:text-[#F8F6F1] tracking-tight">
              Capsule Wardrobe
            </h1>
            <p className="text-sm text-[#777C75] dark:text-[#A3ABA0] mt-1 font-sans">
              <span className="font-semibold text-[#202321] dark:text-[#F8F6F1]">{acceptedItems.length}</span> active garments in closet
              {pendingItems.length > 0 && (
                <>
                  {' · '}
                  <span className="text-[#899783] font-semibold">{pendingItems.length} pending AI review</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/wardrobe-gap')}
              icon={<Layers className="w-4 h-4 text-[#727D69]" />}
            >
              Gap Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchModalOpen(true)}
              icon={<Layers className="w-4 h-4" />}
            >
              Batch Upload
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              icon={<Plus className="w-4 h-4" />}
            >
              Add New Piece
            </Button>
          </div>
        </div>

        {/* Section Navigation Tabs: Accepted Closet | Pending AI Review | All Clothing */}
        <div className="flex items-center gap-2 mb-6 border-b border-[#E2DDD3] dark:border-[#2D342F] pb-3 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => handleTabChange('accepted')}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              wardrobeSection === 'accepted'
                ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] shadow-xs'
                : 'text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#E9E6DE]/50 dark:hover:bg-[#242A25]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Accepted Closet</span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                wardrobeSection === 'accepted'
                  ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#202321]'
                  : 'bg-[#E9E6DE] dark:bg-[#2D342F] text-[#292D29] dark:text-[#F8F6F1]'
              }`}
            >
              {acceptedItems.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('pending')}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              wardrobeSection === 'pending'
                ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] shadow-xs'
                : 'text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#E9E6DE]/50 dark:hover:bg-[#242A25]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B5AA99]" />
            <span>Pending AI Review</span>
            {pendingItems.length > 0 && (
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  wardrobeSection === 'pending'
                    ? 'bg-[#B5AA99] text-[#202321]'
                    : 'bg-[#B5AA99]/20 text-[#202321] dark:text-[#F8F6F1]'
                }`}
              >
                {pendingItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('all')}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              wardrobeSection === 'all'
                ? 'bg-[#202321] text-[#F8F6F1] dark:bg-[#F8F6F1] dark:text-[#202321] shadow-xs'
                : 'text-[#777C75] dark:text-[#A3ABA0] hover:text-[#202321] dark:hover:text-[#F8F6F1] hover:bg-[#E9E6DE]/50 dark:hover:bg-[#242A25]'
            }`}
          >
            <span>All Clothing</span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                wardrobeSection === 'all'
                  ? 'bg-white/20 text-white dark:bg-black/15 dark:text-[#202321]'
                  : 'bg-[#E9E6DE] dark:bg-[#2D342F] text-[#292D29] dark:text-[#F8F6F1]'
              }`}
            >
              {totalItems}
            </span>
          </button>
        </div>

        {/* Quick Metrics Bar (Shown for Accepted & All Views) */}
        {wardrobeSection !== 'pending' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {[
              { label: 'Tops & Shirts', count: topsCount },
              { label: 'Bottoms & Jeans', count: bottomsCount },
              { label: 'Indian Ethnic', count: ethnicCount },
              { label: 'Other Pieces', count: othersCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white dark:bg-[#1C201D] p-4 rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] text-center sm:text-left shadow-xs"
              >
                <p className="text-[11px] uppercase font-semibold tracking-wider text-[#777C75] dark:text-[#A3ABA0]">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold font-mono text-[#202321] dark:text-[#F8F6F1] mt-0.5">
                  {stat.count}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Pending Review Action Banner (Only in Pending Review Tab) */}
        {wardrobeSection === 'pending' && pendingItems.length > 0 && (
          <div className="mb-6 p-5 rounded-2xl bg-[#F1EEE7] dark:bg-[#1C201D] border border-[#B5AA99]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#727D69]" />
                <h3 className="text-sm font-serif font-bold text-[#202321] dark:text-[#F8F6F1]">
                  {readyToReviewItems.length} Garment(s) Ready for Your Verification
                </h3>
              </div>
              <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1">
                Our EfficientNet-B0 fashion model analyzed your garments. Review and confirm predictions so they appear in your Daily Fits.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {readyToReviewItems.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkAcceptAll}
                    isLoading={isBulkAccepting}
                    loadingText="Accepting All..."
                    icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                  >
                    Accept All ({readyToReviewItems.length})
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleReviewAllPending}
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Review Next
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Search, Sort & Category Filter Bar */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, fabric, pattern, color, brand, or style..."
                className="w-full bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-[#202321] dark:text-[#F8F6F1] placeholder:text-[#777C75]/60 focus:outline-none focus:ring-1 focus:ring-[#727D69] transition-colors shadow-xs"
              />
              <Search className="w-4 h-4 text-[#777C75] dark:text-[#A3ABA0] absolute left-3.5 top-3.5" />
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-[#1C201D] border border-[#E2DDD3] dark:border-[#2D342F] rounded-xl p-1 min-h-[44px] text-xs shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#777C75] ml-2" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-[#202321] dark:text-[#F8F6F1] text-xs py-2 pr-3 pl-1 focus:outline-none cursor-pointer font-medium"
              >
                <option value="recent">Recently Added</option>
                <option value="wears">Most Worn</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>

            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              title="Filter Favorite Garments"
              className={`flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer shadow-xs ${
                favoritesOnly
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  : 'bg-white dark:bg-[#1C201D] border-[#E2DDD3] dark:border-[#2D342F] text-[#292D29] dark:text-[#F8F6F1] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-rose-500 text-rose-500' : 'text-[#777C75]'}`} />
              <span>Favorites</span>
            </button>
          </div>

          {/* Laundry Status Filter Pills (Clean / In laundry / Unavailable) */}
          {wardrobeSection !== 'pending' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mr-1">Status:</span>
              {[
                { id: 'all' as const, label: 'All Items' },
                { id: 'clean' as const, label: `Clean (${cleanCount})` },
                { id: 'in_laundry' as const, label: `In Laundry (${inLaundryCount})` },
                { id: 'unavailable' as const, label: `Unavailable (${unavailableCount})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setLaundryFilter(pill.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all font-medium cursor-pointer ${
                    laundryFilter === pill.id
                      ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] border-transparent font-semibold shadow-xs'
                      : 'bg-white dark:bg-[#1C201D] border-[#E2DDD3] dark:border-[#2D342F] text-[#6B7269] dark:text-[#A3ABA0] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          {/* Occasion Vault Banner */}
          {wardrobeSection !== 'pending' && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#B5AA99]/15 via-[#B5AA99]/5 to-transparent border border-[#B5AA99]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#B5AA99]/20 text-[#202321] dark:text-[#F8F6F1] flex items-center justify-center shrink-0 border border-[#B5AA99]/30">
                  <Crown className="w-5 h-5 text-[#B5AA99]" />
                </div>
                <div>
                  <h4 className="text-sm font-serif font-bold text-[#202321] dark:text-[#F8F6F1] flex items-center gap-2">
                    <span>Occasion Vault</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#B5AA99] text-[#202321] font-bold">
                      Luxury Shield
                    </span>
                  </h4>
                  <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-0.5">
                    Safeguard high-value gala attire, wedding outfits, and reserved pieces from everyday casual wear.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/vault')}
                className="border-[#B5AA99]/50 text-[#202321] dark:text-[#F8F6F1] hover:bg-[#B5AA99]/15 whitespace-nowrap shrink-0"
                icon={<Crown className="w-3.5 h-3.5 text-[#B5AA99]" />}
              >
                Open Vault
              </Button>
            </div>
          )}

          {/* Collection Group Filter Pills */}
          {wardrobeSection !== 'pending' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#777C75] dark:text-[#A3ABA0] mr-1">Group:</span>
              {[
                { id: 'all', label: 'All Collections' },
                { id: 'daily_work', label: 'Daily & Work' },
                { id: 'party_evening', label: 'Party & Evening' },
                { id: 'luxury_special', label: 'Luxury & Special' },
                { id: 'traditional_festive', label: 'Traditional & Festive' },
              ].map((grp) => (
                <button
                  key={grp.id}
                  onClick={() => setSelectedWardrobeGroup(grp.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-all font-medium cursor-pointer ${
                    selectedWardrobeGroup === grp.id
                      ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] border-transparent font-semibold shadow-xs'
                      : 'bg-white dark:bg-[#1C201D] border-[#E2DDD3] dark:border-[#2D342F] text-[#6B7269] dark:text-[#A3ABA0] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25]'
                  }`}
                >
                  {grp.label}
                </button>
              ))}
            </div>
          )}

          {/* Categories Pill Bar (Hidden in Pending Review tab to keep review focused) */}
          {wardrobeSection !== 'pending' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-4 py-2 min-h-[40px] rounded-full border whitespace-nowrap transition-all font-medium cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-[#202321] dark:bg-[#F8F6F1] text-[#F8F6F1] dark:text-[#202321] border-transparent font-semibold shadow-xs'
                      : 'bg-white dark:bg-[#1C201D] border-[#E2DDD3] dark:border-[#2D342F] text-[#6B7269] dark:text-[#A3ABA0] hover:bg-[#F8F6F1] dark:hover:bg-[#242A25]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Empty States and Garment Grids */}
        {wardrobeSection === 'pending' ? (
          displayItems.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#1C201D] rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] p-8 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="font-serif font-bold text-[#202321] dark:text-[#F8F6F1] text-lg">
                All Uploaded Garments Reviewed
              </p>
              <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1.5 max-w-sm mx-auto">
                There are no pending garments requiring review. All AI-analyzed pieces have been accepted into your capsule closet.
              </p>
              <div className="flex items-center justify-center gap-2 mt-5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleTabChange('accepted')}
                >
                  View Active Closet
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchModalOpen(true)}
                  icon={<Layers className="w-4 h-4" />}
                >
                  Batch Upload More
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {displayItems.map((item) => (
                <PendingReviewCard
                  key={item.id}
                  item={item}
                  onReview={handleOpenReview}
                  onAccepted={() => refreshData(true)}
                />
              ))}
            </div>
          )
        ) : displayItems.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#1C201D] rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] p-8 shadow-xs">
            <Shirt className="w-10 h-10 text-[#899783] mx-auto mb-3 opacity-70" />
            <p className="font-serif font-bold text-[#202321] dark:text-[#F8F6F1] text-lg">
              {searchQuery ? `No garments matching "${searchQuery}"` : 'Your Capsule Closet is Empty'}
            </p>
            <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1.5 max-w-sm mx-auto">
              Add your clothing pieces via camera capture, device gallery, or image upload to unlock AI Daily Fits and outfit intelligence.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchModalOpen(true)}
                icon={<Layers className="w-4 h-4" />}
              >
                Batch Upload
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAddModalOpen(true)}
                icon={<Plus className="w-4 h-4" />}
              >
                Add Garment
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {displayItems.map((item) => (
              <ClothingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </PullToRefresh>

      {/* Add Single Clothing Modal */}
      <AddClothingModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSwitchToBatch={() => {
          setAddModalOpen(false);
          setBatchModalOpen(true);
        }}
      />

      {/* Batch Upload Modal */}
      <BatchUploadModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        onCompleted={() => {
          refreshData();
          handleTabChange('pending');
        }}
      />

      {/* Dedicated Clothing Review & Acceptance Modal */}
      {pendingItems.length > 0 && (
        <ClothingReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          items={pendingItems}
          initialIndex={reviewModalIndex}
          onItemAccepted={() => refreshData(true)}
        />
      )}
    </AppShell>
  );
};
