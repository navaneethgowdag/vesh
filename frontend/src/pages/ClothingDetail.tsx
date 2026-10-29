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
        <div className="text-center py-20 bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border">
          <p className="font-serif font-bold text-lg text-luxury-text dark:text-luxury-dark-text">Clothing item not found</p>
          <Button
            variant="outline"
            size="sm"
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
        className="flex items-center gap-2 text-xs font-semibold text-luxury-textMuted dark:text-luxury-dark-textMuted hover:text-luxury-text dark:hover:text-luxury-dark-text transition-colors mb-6 group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to My Wardrobe</span>
      </button>

      {/* Main Item Detail Card */}
      <div className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl border border-luxury-border dark:border-luxury-dark-border shadow-soft overflow-hidden p-6 sm:p-8 mb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Large Clothing Image */}
          <div className="md:col-span-5 relative group">
            <div className="rounded-3xl overflow-hidden aspect-[3/4] shadow-soft-lg bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle border border-luxury-border dark:border-luxury-dark-border">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            {item.isFavorite && (
              <span className="absolute top-4 left-4 bg-luxury-surface/90 dark:bg-luxury-dark-surface/90 backdrop-blur-md text-luxury-champagne dark:text-luxury-dark-champagne border border-luxury-champagne/30 px-3 py-1 rounded-full text-xs font-semibold shadow-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-luxury-champagne" />
                Capsule Favorite
              </span>
            )}
          </div>

          {/* Item Attributes & Meta */}
          <div className="md:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-luxury-champagne dark:text-luxury-dark-champagne mb-1">
                <span>{item.category}</span>
                {item.brand && <span>· {item.brand}</span>}
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-luxury-text dark:text-luxury-dark-text">
                {item.name}
              </h1>
              <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-1">
                Cataloged on {item.createdAt} · {item.timesWorn || 0} times worn
              </p>
            </div>

            {/* Spec Attributes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Color</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">{item.color}</span>
              </div>
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Style</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">{item.style}</span>
              </div>
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Season</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">{item.season}</span>
              </div>
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Pattern</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">{item.pattern || 'Solid'}</span>
              </div>
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Brand</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">{item.brand || 'Bespoke / Unspecified'}</span>
              </div>
              <div className="p-3 bg-luxury-surfaceSubtle/60 dark:bg-luxury-dark-surfaceSubtle/60 rounded-2xl border border-luxury-border dark:border-luxury-dark-border">
                <span className="block text-[10px] text-luxury-textMuted dark:text-luxury-dark-textMuted uppercase font-semibold">Rotation</span>
                <span className="text-xs font-bold text-luxury-text dark:text-luxury-dark-text mt-0.5 block">High Versatility</span>
              </div>
            </div>

            {/* Notes / Details */}
            {item.notes && (
              <div className="p-4 bg-luxury-surfaceSubtle/40 dark:bg-luxury-dark-surfaceSubtle/40 rounded-2xl border border-luxury-border dark:border-luxury-dark-border text-xs text-luxury-text dark:text-luxury-dark-text">
                <span className="font-bold block mb-1 text-luxury-champagne">Stylist Notes:</span>
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
            <h2 className="font-serif text-xl font-bold text-luxury-text dark:text-luxury-dark-text">
              Outfits Using This Item
            </h2>
            <p className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted mt-0.5">
              Algorithmically synthesized combinations featuring this garment.
            </p>
          </div>
          <span className="text-xs text-luxury-textMuted dark:text-luxury-dark-textMuted font-medium">
            {relatedOutfits.length} Generated Combos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {relatedOutfits.map((combo) => (
            <div
              key={combo.id}
              className="bg-luxury-surface dark:bg-luxury-dark-surface rounded-3xl p-5 border border-luxury-border dark:border-luxury-dark-border shadow-soft hover:shadow-soft-lg hover:border-luxury-champagne/40 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-sm text-luxury-text dark:text-luxury-dark-text">
                  {combo.title}
                </h3>
                <span className="text-[11px] bg-luxury-surfaceSubtle dark:bg-luxury-dark-surfaceSubtle text-luxury-text dark:text-luxury-dark-text px-2.5 py-0.5 rounded-full font-medium border border-luxury-border dark:border-luxury-dark-border">
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
                      className="w-full aspect-square rounded-xl object-cover border border-luxury-border dark:border-luxury-dark-border"
                    />
                    <span className="text-[9px] block text-luxury-textMuted dark:text-luxury-dark-textMuted truncate mt-1">
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
