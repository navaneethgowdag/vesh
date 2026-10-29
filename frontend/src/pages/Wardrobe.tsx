import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Shirt,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ClothingCard } from '../components/wardrobe/ClothingCard';
import { AddClothingModal } from '../components/wardrobe/AddClothingModal';
import { Button } from '../components/ui/Button';
import { PullToRefresh } from '../components/ui/PullToRefresh';
import { useApp } from '../context/AppContext';
import { ClothingCategory } from '../types';

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
  const { wardrobe, refreshData } = useApp();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<ClothingCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'wears' | 'name'>('recent');

  const totalItems = wardrobe.length;
  const topsCount = wardrobe.filter((i) => i.category === 'Tops').length;
  const bottomsCount = wardrobe.filter((i) => i.category === 'Bottoms').length;
  const shoesCount = wardrobe.filter((i) => i.category === 'Shoes').length;
  const othersCount = totalItems - (topsCount + bottomsCount + shoesCount);

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
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [wardrobe, activeCategory, searchQuery, sortBy]);

  return (
    <AppShell>
      <PullToRefresh onRefresh={refreshData}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
              Personal Inventory
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Capsule Wardrobe
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {totalItems} garments digitized & categorized in your wardrobe.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Tops', count: topsCount },
            { label: 'Bottoms', count: bottomsCount },
            { label: 'Shoes', count: shoesCount },
            { label: 'Other Pieces', count: othersCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white dark:bg-zinc-900 p-4 rounded-md border border-zinc-200 dark:border-zinc-800 text-center sm:text-left"
            >
              <p className="text-xs uppercase font-semibold tracking-wider text-zinc-500 dark:text-zinc-400">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {stat.count}
              </p>
            </div>
          ))}
        </div>

        {/* Search, Sort, Filter Bar */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pieces by name, fabric, brand, color..."
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors"
              />
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
            </div>

            <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 min-h-[44px] text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 ml-2" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-zinc-900 dark:text-zinc-100 text-xs py-2 pr-3 pl-1 focus:outline-none cursor-pointer"
              >
                <option value="recent">Recently Added</option>
                <option value="wears">Most Worn</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
          </div>

          {/* Categories Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3.5 py-2 min-h-[40px] rounded-md border whitespace-nowrap transition-all font-medium ${
                  activeCategory === cat
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent font-semibold'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Garment Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <Shirt className="w-8 h-8 text-zinc-400 mx-auto mb-2 opacity-60" />
            <p className="font-bold text-zinc-900 dark:text-zinc-100">
              {searchQuery ? `No garments matching "${searchQuery}"` : 'Your Capsule Closet is Empty'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Add your clothing pieces via camera capture, device gallery, or image upload to unlock AI Daily Fits.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="mt-4"
              icon={<Plus className="w-4 h-4" />}
            >
              Add Garment
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <ClothingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </PullToRefresh>

      <AddClothingModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
    </AppShell>
  );
};
