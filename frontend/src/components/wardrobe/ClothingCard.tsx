import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit3, Sparkles } from 'lucide-react';
import { ClothingItem } from '../../types';
import { useApp } from '../../context/AppContext';

interface ClothingCardProps {
  item: ClothingItem;
  onEdit?: (item: ClothingItem) => void;
}

export const ClothingCard: React.FC<ClothingCardProps> = ({ item, onEdit }) => {
  const navigate = useNavigate();
  const { deleteClothingItem } = useApp();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove "${item.name}" from your wardrobe?`)) {
      deleteClothingItem(item.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(item);
  };

  return (
    <div
      onClick={() => navigate(`/wardrobe/${item.id}`)}
      className="group relative bg-cream-50 rounded-3xl border border-sand-200/90 shadow-soft overflow-hidden hover:shadow-soft-lg transition-all duration-300 cursor-pointer flex flex-col"
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-sand-200/60 overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Favorite Badge */}
        {item.isFavorite && (
          <span className="absolute top-3 left-3 bg-cream-50/90 backdrop-blur-md text-cognac-700 p-1.5 rounded-full shadow-sm text-xs" title="Wardrobe Staple">
            <Sparkles className="w-3.5 h-3.5 fill-cognac-600" />
          </span>
        )}

        {/* Times Worn Badge */}
        <span className="absolute top-3 right-3 bg-charcoal-900/80 backdrop-blur-md text-cream-50 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm">
          {item.timesWorn || 0} wears
        </span>

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-charcoal-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
          <div className="flex gap-1.5 ml-auto">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="p-2 bg-cream-50 text-charcoal-800 rounded-full hover:bg-sand-200 transition-colors shadow-soft"
                title="Edit item"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 bg-rose-50 text-rose-700 rounded-full hover:bg-rose-100 transition-colors shadow-soft"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Block */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] text-cognac-700 font-semibold uppercase tracking-wider mb-1">
            <span>{item.category}</span>
            {item.brand && <span className="text-charcoal-400 font-normal">{item.brand}</span>}
          </div>

          <h3 className="font-serif text-sm font-bold text-charcoal-900 line-clamp-1 group-hover:text-cognac-800 transition-colors">
            {item.name}
          </h3>

          <p className="text-xs text-charcoal-500 mt-1">
            {item.style} · {item.color}
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-sand-200/60 flex items-center justify-between text-[11px] text-charcoal-400">
          <span className="bg-sand-100 px-2 py-0.5 rounded-md text-charcoal-600 font-medium">
            {item.season}
          </span>
          <span className="text-cognac-700 font-semibold group-hover:underline">
            View details →
          </span>
        </div>
      </div>
    </div>
  );
};

