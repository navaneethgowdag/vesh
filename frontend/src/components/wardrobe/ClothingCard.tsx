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
      className="group relative bg-white dark:bg-[#1C201D] rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] overflow-hidden hover:border-[#899783] dark:hover:border-[#899783] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-[#F1EEE7] dark:bg-[#242A25] overflow-hidden">
        <img
          src={resolveImageUrl(item.preferredImageUrl || item.image) || FALLBACK_POST_IMAGE}
          alt={item.name}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
              e.currentTarget.src = FALLBACK_POST_IMAGE;
            }
          }}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
        />

        {/* Processing / Status Badges */}
        {(item.processingStatus === 'queued' || item.processingStatus === 'processing') && (
          <span className="absolute top-2.5 left-2.5 bg-[#202321]/90 backdrop-blur-md text-[#F8F6F1] text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#899783] animate-ping" />
            AI Processing
          </span>
        )}
        {item.processingStatus === 'ready_for_review' && (
          <span className="absolute top-2.5 left-2.5 bg-amber-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            Review Needed
          </span>
        )}
        {item.processingStatus === 'manual_review_required' && (
          <span className="absolute top-2.5 left-2.5 bg-amber-800/90 backdrop-blur-md text-amber-100 text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-amber-600/30">
            Manual Review
          </span>
        )}
        {item.processingStatus === 'failed' && (
          <span className="absolute top-2.5 left-2.5 bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            Processing Failed
          </span>
        )}
        {item.isFavorite && !['queued', 'processing', 'ready_for_review', 'manual_review_required', 'failed'].includes(item.processingStatus || '') && (
          <span className="absolute top-2.5 left-2.5 bg-[#202321]/80 backdrop-blur-md text-[#F8F6F1] p-1.5 rounded-full text-xs shadow-sm" title="Wardrobe Staple">
            <Sparkles className="w-3.5 h-3.5 text-[#B5AA99] fill-current" />
          </span>
        )}

        {/* Laundry & Wear Badges */}
        {laundryStatus === 'in_laundry' ? (
          <span className="absolute top-2.5 right-2.5 bg-amber-700/95 backdrop-blur-md text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-sm">
            In Laundry {returnDayStr ? `(${returnDayStr})` : ''}
          </span>
        ) : laundryStatus === 'unavailable' ? (
          <span className="absolute top-2.5 right-2.5 bg-[#202321]/90 backdrop-blur-md text-[#A3ABA0] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-sm">
            Unavailable
          </span>
        ) : trackLaundry ? (
          <span className={`absolute top-2.5 right-2.5 backdrop-blur-md text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full shadow-sm ${
            wearCount >= maxWears - 1 ? 'bg-amber-600/90' : 'bg-[#202321]/80 border border-white/10'
          }`}>
            {wearCount}/{maxWears} wears
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 bg-[#202321]/80 backdrop-blur-md text-white text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-white/10">
            {item.timesWorn || 0} wears
          </span>
        )}

        {/* Luxury Vault Indicator */}
        {(item.isLuxury || item.is_luxury || item.wearTier === 'luxury_special' || item.wear_tier === 'luxury_special') && (
          <span className="absolute bottom-2.5 left-2.5 bg-[#202321]/85 backdrop-blur-md text-[#B5AA99] text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#B5AA99]/40 shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-[#B5AA99] fill-current" />
            Vault Piece
          </span>
        )}

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
          {/* Quick Laundry Status Actions */}
          <div className="flex gap-1.5 flex-wrap">
            {laundryStatus === 'clean' ? (
              <>
                <button
                  onClick={(e) => handleLaundryAction(e, 'wash_now')}
                  disabled={isActionLoading}
                  className="px-2.5 py-1 text-[10px] font-bold bg-[#F8F6F1] hover:bg-white text-[#202321] rounded-lg shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
                  title="Mark washed (reset wears to 0)"
                >
                  Mark Washed
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'send_to_laundry')}
                  disabled={isActionLoading}
                  className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
                  title="Send to laundry now"
                >
                  Laundry
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'mark_unavailable')}
                  disabled={isActionLoading}
                  className="px-2.5 py-1 text-[10px] font-bold bg-[#202321]/90 hover:bg-black text-[#A3ABA0] rounded-lg shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
                  title="Mark unavailable (dry clean, lent, damaged)"
                >
                  Unavailable
                </button>
              </>
            ) : (
              <button
                onClick={(e) => handleLaundryAction(e, 'restore')}
                disabled={isActionLoading}
                className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm backdrop-blur-sm transition-colors cursor-pointer"
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
                className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-[#F8F6F1] dark:bg-[#202321] text-[#202321] dark:text-[#F8F6F1] rounded-xl hover:bg-white transition-colors shadow cursor-pointer"
                title="Edit item"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors shadow disabled:opacity-50 cursor-pointer"
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
          <div className="flex items-center justify-between text-[11px] text-[#777C75] dark:text-[#A3ABA0] font-semibold uppercase tracking-wider mb-1">
            <span>{item.category}</span>
            {item.brand && <span className="text-[#202321] dark:text-[#F8F6F1] font-medium">{item.brand}</span>}
          </div>

          <h3 className="text-sm font-semibold text-[#202321] dark:text-[#F8F6F1] line-clamp-1 group-hover:text-[#727D69] transition-colors">
            {item.name}
          </h3>

          <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1">
            {item.style} · {item.color}
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-[#E2DDD3] dark:border-[#2D342F] flex items-center justify-between text-xs text-[#777C75] dark:text-[#A3ABA0]">
          <span className="bg-[#E9E6DE]/60 dark:bg-[#242A25] px-2.5 py-0.5 rounded-full text-[#292D29] dark:text-[#E9E6DE] font-medium text-[11px]">
            {item.season}
          </span>
          <span className="text-[#202321] dark:text-[#F8F6F1] font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
            View piece &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
