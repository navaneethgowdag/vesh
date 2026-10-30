import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit3, Sparkles } from 'lucide-react';
import { ClothingItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';

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
      className="group relative bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-200 cursor-pointer flex flex-col"
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <img
          src={resolveImageUrl(item.preferredImageUrl || item.image) || FALLBACK_POST_IMAGE}
          alt={item.name}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
              e.currentTarget.src = FALLBACK_POST_IMAGE;
            }
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Processing / Status Badges */}
        {(item.processingStatus === 'queued' || item.processingStatus === 'processing') && (
          <span className="absolute top-2.5 left-2.5 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            AI Processing
          </span>
        )}
        {item.processingStatus === 'ready_for_review' && (
          <span className="absolute top-2.5 left-2.5 bg-amber-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
            Review Needed
          </span>
        )}
        {item.processingStatus === 'failed' && (
          <span className="absolute top-2.5 left-2.5 bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
            Processing Failed
          </span>
        )}
        {item.isFavorite && !['queued', 'processing', 'ready_for_review', 'failed'].includes(item.processingStatus || '') && (
          <span className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white p-1.5 rounded text-xs" title="Wardrobe Staple">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </span>
        )}

        {/* Times Worn Badge */}
        <span className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded">
          {item.timesWorn || 0} wears
        </span>

        {/* AI Catalog Cut Badge */}
        {(item.isProcessedAvailable || item.image?.includes('/image/processed') || item.preferredImageUrl?.includes('/image/processed')) && (
          <span className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
            AI Catalog
          </span>
        )}

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
          <div className="flex gap-1.5 ml-auto">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded hover:bg-zinc-100 transition-colors shadow"
                title="Edit item"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleDelete}
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow"
              title="Delete item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Block */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            <span>{item.category}</span>
            {item.brand && <span className="text-zinc-600 dark:text-zinc-400 font-normal">{item.brand}</span>}
          </div>

          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:underline transition-colors">
            {item.name}
          </h3>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {item.style} · {item.color}
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-medium">
            {item.season}
          </span>
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold group-hover:underline">
            View details →
          </span>
        </div>
      </div>
    </div>
  );
};
