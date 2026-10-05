import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Shirt,
  Sparkles,
  SlidersHorizontal,
  Search,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { AddClothingModal } from '../components/wardrobe/AddClothingModal';
import { Button } from '../components/ui/Button';
import { StyleChip } from '../components/ui/StyleChip';
import { useApp } from '../context/AppContext';
import { ClothingCategory, ClothingItem } from '../types';

const CATEGORIES: (ClothingCategory | 'All')[] = [
  'All',
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Bags',
];

export const Wardrobe: React.FC = () => {
  const { wardrobe } = useApp();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<ClothingCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'wears' | 'name'>('recent');

  // Calculate dynamic stats
  const totalItems = wardrobe.length;
  const topsCount = wardrobe.filter((i) => i.category === 'Tops').length;
  const bottomsCount = wardrobe.filter((i) => i.category === 'Bottoms').length;
  const shoesCount = wardrobe.filter((i) => i.category === 'Shoes').length;
  const othersCount = totalItems - (topsCount + bottomsCount + shoesCount);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return wardrobe
      .filter((item) => {
        if (activeCategory !== 'All' && item.category !== activeCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesBrand = item.brand?.toLowerCase().includes(q);
          const matchesColor = item.color.toLowerCase().includes(q);
          const matchesStyle = item.style.toLowerCase().includes(q);
          if (!matchesName && !matchesBrand && !matchesColor && !matchesStyle) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wears') return (b.timesWorn || 0) - (a.timesWorn || 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [wardrobe, activeCategory, searchQuery, sortBy]);

  return (
    <AppShell>
      {/* Page Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-charcoal-900 text-cream-50 rounded-xl shadow-soft">
              <Shirt className="w-4 h-4" />
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-charcoal-950">
              My Digital Wardrobe
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
            Curate your physical garments to unlock effortless AI daily fit recommendations.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setAddModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
          className="shadow-soft"
        >
          Add Clothing
        </Button>
      </div>

      {/* Wardrobe Summary Stats Card */}
      <div className="bg-sand-100/90 rounded-3xl p-5 border border-sand-200/90 shadow-soft mb-8">
        <div className="flex items-center justify-between mb-3 border-b border-sand-200 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-charcoal-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cognac-700" />
            Capsule Analytics
          </span>
          <span className="text-xs text-cognac-800 font-semibold">96% Versatility Index</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-cream-50 p-3 rounded-2xl border border-sand-200">
            <span className="text-[11px] text-charcoal-400 uppercase font-semibold">Total Items</span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-charcoal-900">{totalItems}</p>
          </div>
          <div className="bg-cream-50 p-3 rounded-2xl border border-sand-200">
            <span className="text-[11px] text-charcoal-400 uppercase font-semibold">Tops</span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-charcoal-900">{topsCount}</p>
          </div>
          <div className="bg-cream-50 p-3 rounded-2xl border border-sand-200">
            <span className="text-[11px] text-charcoal-400 uppercase font-semibold">Bottoms</span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-charcoal-900">{bottomsCount}</p>
          </div>
          <div className="bg-cream-50 p-3 rounded-2xl border border-sand-200">
            <span className="text-[11px] text-charcoal-400 uppercase font-semibold">Shoes</span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-charcoal-900">{shoesCount}</p>
          </div>
          <div className="bg-cream-50 p-3 rounded-2xl border border-sand-200 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-charcoal-400 uppercase font-semibold">Others</span>
            <p className="text-xl sm:text-2xl font-serif font-bold text-charcoal-900">{othersCount}</p>
          </div>
        </div>
      </div>

      {/* Search and Category Tabs */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search wardrobe by name, brand, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-cream-50 border border-sand-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-charcoal-900 placeholder:text-charcoal-400 focus:outline-none focus:ring-1 focus:ring-cognac-600 shadow-soft-sm"
            />
            <Search className="w-4 h-4 text-charcoal-400 absolute left-3.5 top-3" />
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-charcoal-600">
            <ArrowUpDown className="w-3.5 h-3.5 text-charcoal-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-cream-50 border border-sand-300 rounded-xl px-2.5 py-1.5 text-xs text-charcoal-800 focus:outline-none"
            >
              <option value="recent">Recently Added</option>
              <option value="wears">Most Worn</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {CATEGORIES.map((cat) => {
            const count =
              cat === 'All'
                ? wardrobe.length
                : wardrobe.filter((i) => i.category === cat).length;

            return (
              <StyleChip
                key={cat}
                label={cat}
                count={count}
                selected={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            );
          })}
        </div>
      </div>

      {/* Wardrobe Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-cream-50 rounded-3xl border border-sand-200">
          <Shirt className="w-12 h-12 text-sand-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-charcoal-900">
            {wardrobe.length === 0 ? 'Your wardrobe is empty' : 'No items match your criteria'}
          </h3>
          <p className="text-xs text-charcoal-500 max-w-sm mx-auto mt-1">
            {wardrobe.length === 0
              ? 'Add your first clothing item and start creating personalized outfits.'
              : 'Try clearing your search query or selecting a different category filter.'}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => setAddModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            className="mt-5"
          >
            + Add Clothing
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <ClothingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Add Clothing Modal */}
      <AddClothingModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </AppShell>
  );
};

