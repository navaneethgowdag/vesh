import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Button } from '../components/ui/Button';
import { useApp } from '../context/AppContext';

export const ClothingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { wardrobe } = useApp();

  const item = wardrobe.find((i) => i.id === id);

  // Generate outfit combinations that incorporate this item
  const relatedOutfits = useMemo(() => {
    if (!item) return [];

    // Find other complimentary pieces from other categories
    const otherCategories = wardrobe.filter((i) => i.id !== item.id && i.category !== item.category);

    const combos = [
      {
        id: 'combo_1',
        title: `${item.style} Day Signature`,
        occasion: 'Casual Daily',
        pieces: [
          item,
          ...otherCategories.slice(0, 3),
        ],
      },
      {
        id: 'combo_2',
        title: `Editorial ${item.color} Contrast`,
        occasion: 'Work & Office',
        pieces: [
          item,
          ...otherCategories.slice(3, 6),
        ],
      },
    ];

    return combos;
  }, [item, wardrobe]);

  if (!item) {
    return (
      <AppShell>
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800">
          <p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">Clothing item not found</p>
          <Button
            variant="outline"
            size="md"
            onClick={() => navigate('/wardrobe')}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="mt-4"
          >
            Back to Wardrobe
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Back button */}
      <button
        onClick={() => navigate('/wardrobe')}
        className="inline-flex items-center gap-2 h-11 px-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-4 group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to My Wardrobe</span>
      </button>

      {/* Main Item Detail Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6 sm:p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Large Clothing Image */}
          <div className="md:col-span-5 relative group">
            <div className="rounded-md overflow-hidden aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            {item.isFavorite && (
              <span className="absolute top-4 left-4 bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 px-3 py-1 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                Capsule Favorite
              </span>
            )}
          </div>

          {/* Item Attributes & Meta */}
          <div className="md:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                <span>{item.category}</span>
                {item.brand && <span>· {item.brand}</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {item.name}
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Cataloged on {item.createdAt} · {item.timesWorn || 0} times worn
              </p>
            </div>

            {/* Spec Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Color</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{item.color}</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Style</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{item.style}</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Season</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{item.season}</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Pattern</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{item.pattern || 'Solid'}</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Brand</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">{item.brand || 'Bespoke / Unspecified'}</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
                <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Rotation</span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">High Versatility</span>
              </div>
            </div>

            {/* Notes / Details */}
            {item.notes && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-800 dark:text-zinc-200">
                <span className="font-bold block mb-1 text-zinc-900 dark:text-zinc-100">Stylist Notes:</span>
                {item.notes}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/create')}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Create Outfit Post With This Piece
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/daily-fit')}
              >
                Test in Daily Fit
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Outfits Using This Item */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Outfits Using This Item
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              Algorithmically synthesized combinations featuring this garment.
            </p>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {relatedOutfits.length} Generated Combos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {relatedOutfits.map((combo) => (
            <div
              key={combo.id}
              className="bg-white dark:bg-zinc-900 rounded-md p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {combo.title}
                </h3>
                <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2.5 py-0.5 rounded-md font-medium border border-zinc-200 dark:border-zinc-700">
                  {combo.occasion}
                </span>
              </div>

              {/* Pieces horizontal reel */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {combo.pieces.map((piece) => (
                  <div key={piece.id} className="relative group/piece">
                    <img
                      src={piece.image}
                      alt={piece.name}
                      className="w-full aspect-square rounded-md object-cover border border-zinc-200 dark:border-zinc-800"
                    />
                    <span className="text-[11px] block text-zinc-600 dark:text-zinc-400 truncate mt-1">
                      {piece.name}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/daily-fit')}
                className="w-full text-xs"
              >
                Style in Daily Fit →
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};
