import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Edit3, Sparkles, Shirt, RotateCcw, Check, Ban } from 'lucide-react';
import { ClothingItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { useAsyncLock } from '../../hooks/useAsyncLock';
import { api } from '../../services/api';

interface ClothingCardProps {
  item: ClothingItem;
  onEdit?: (item: ClothingItem) => void;
}

export const ClothingCard: React.FC<ClothingCardProps> = ({ item, onEdit }) => {
  const navigate = useNavigate();
  const { deleteClothingItem, refreshData, showToast } = useApp();
  const { execute: runDelete, isLocked: isDeleting } = useAsyncLock();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const laundryStatus = item.laundryStatus || item.laundry_status || 'clean';
  const trackLaundry = item.trackLaundry !== false && item.track_laundry !== false;
  const wearCount = item.wearCountSinceWash ?? item.wear_count_since_wash ?? 0;
  const maxWears = item.maxWearsOverride || item.max_wears_override || 2;
  const availableFrom = item.availableFrom || item.available_from;
  let returnDayStr = '';
  if (availableFrom) {
    try {
      returnDayStr = new Date(availableFrom).toLocaleDateString(undefined, { weekday: 'short' });
    } catch {}
  }

  const handleLaundryAction = async (e: React.MouseEvent, action: 'wash_now' | 'send_to_laundry' | 'mark_unavailable' | 'restore') => {
    e.stopPropagation();
    setIsActionLoading(true);
    try {
      await api.laundry.itemAction(item.id, action);
      if (action === 'wash_now') showToast(`Marked "${item.name}" as washed clean.`, 'success');
      else if (action === 'send_to_laundry') showToast(`Sent "${item.name}" to laundry.`, 'info');
      else if (action === 'mark_unavailable') showToast(`Marked "${item.name}" as unavailable.`, 'info');
      else if (action === 'restore') showToast(`Restored "${item.name}" to clean status.`, 'success');
      await refreshData();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update laundry status', 'info');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove "${item.name}" from your wardrobe?`)) {
      runDelete(async () => {
        await deleteClothingItem(item.id);
      });
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

        {/* Laundry & Wear Badges */}
        {laundryStatus === 'in_laundry' ? (
          <span className="absolute top-2.5 right-2.5 bg-amber-600/95 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
            In Laundry {returnDayStr ? `(Back ${returnDayStr})` : ''}
          </span>
        ) : laundryStatus === 'unavailable' ? (
          <span className="absolute top-2.5 right-2.5 bg-zinc-700/95 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
            Unavailable
          </span>
        ) : trackLaundry ? (
          <span className={`absolute top-2.5 right-2.5 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${
            wearCount >= maxWears - 1 ? 'bg-amber-600/90' : 'bg-black/70'
          }`}>
            worn {wearCount} of {maxWears}
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded">
            {item.timesWorn || 0} wears
          </span>
        )}

        {/* AI Catalog Cut Badge */}
        {(item.isProcessedAvailable || item.image?.includes('/image/processed') || item.preferredImageUrl?.includes('/image/processed')) && (
          <span className="absolute bottom-2.5 left-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
            AI Catalog
          </span>
        )}

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
          {/* Quick Laundry Status Actions */}
          <div className="flex gap-1 flex-wrap">
            {laundryStatus === 'clean' ? (
              <>
                <button
                  onClick={(e) => handleLaundryAction(e, 'wash_now')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[10px] font-bold bg-white/90 hover:bg-white text-zinc-900 rounded shadow backdrop-blur-sm transition-colors"
                  title="Mark washed (reset wears to 0)"
                >
                  Mark washed
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'send_to_laundry')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[10px] font-bold bg-amber-500/90 hover:bg-amber-500 text-white rounded shadow backdrop-blur-sm transition-colors"
                  title="Send to laundry now"
                >
                  Send to laundry
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'mark_unavailable')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[10px] font-bold bg-zinc-800/90 hover:bg-zinc-800 text-zinc-200 rounded shadow backdrop-blur-sm transition-colors"
                  title="Mark unavailable (dry clean, lent, damaged)"
                >
                  Unavailable
                </button>
              </>
            ) : (
              <button
                onClick={(e) => handleLaundryAction(e, 'restore')}
                disabled={isActionLoading}
                className="px-2 py-1 text-[10px] font-bold bg-emerald-600/90 hover:bg-emerald-600 text-white rounded shadow backdrop-blur-sm transition-colors"
                title="Restore as clean"
              >
                Mark Clean / Restore
              </button>
            )}
          </div>

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
              disabled={isDeleting}
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-rose-600 text-white rounded hover:bg-rose-700 transition-colors shadow disabled:opacity-50"
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
