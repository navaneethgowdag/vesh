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
      className="group relative bg-white dark:bg-[#1F1922] rounded-[3px] border border-[#DCD4CC] dark:border-[#392F3E] overflow-hidden hover:border-[#743C49] dark:hover:border-[#D5A6A0] transition-all duration-300 cursor-pointer flex flex-col"
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-[#FAF6F0] dark:bg-[#201824] overflow-hidden">
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
          <span className="absolute top-2.5 left-2.5 bg-[#29202B]/95 backdrop-blur-md text-[#F3EEE8] text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1.5 shadow-xs border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D5A6A0] animate-ping" />
            AI Processing
          </span>
        )}
        {item.processingStatus === 'ready_for_review' && (
          <span className="absolute top-2.5 left-2.5 bg-[#743C49]/95 backdrop-blur-md text-white text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1 shadow-xs">
            Review Needed
          </span>
        )}
        {item.processingStatus === 'manual_review_required' && (
          <span className="absolute top-2.5 left-2.5 bg-[#B49B82]/95 backdrop-blur-md text-[#29202B] text-[9px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded-[2px] flex items-center gap-1 shadow-xs border border-[#29202B]/20">
            Manual Review
          </span>
        )}
        {item.processingStatus === 'failed' && (
          <span className="absolute top-2.5 left-2.5 bg-rose-700/95 backdrop-blur-md text-white text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1 shadow-xs">
            Failed
          </span>
        )}
        {item.isFavorite && !['queued', 'processing', 'ready_for_review', 'manual_review_required', 'failed'].includes(item.processingStatus || '') && (
          <span className="absolute top-2.5 left-2.5 bg-[#29202B]/90 backdrop-blur-md text-[#F3EEE8] p-1.5 rounded-[2px] text-xs shadow-xs" title="Wardrobe Staple">
            <Sparkles className="w-3.5 h-3.5 text-[#D5A6A0] fill-current" />
          </span>
        )}

        {/* Laundry & Wear Badges */}
        {laundryStatus === 'in_laundry' ? (
          <span className="absolute top-2.5 right-2.5 bg-[#B49B82]/95 backdrop-blur-md text-[#29202B] text-[9px] font-mono font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-[2px] shadow-xs">
            In Laundry {returnDayStr ? `(${returnDayStr})` : ''}
          </span>
        ) : laundryStatus === 'unavailable' ? (
          <span className="absolute top-2.5 right-2.5 bg-[#29202B]/90 backdrop-blur-md text-[#DCD4CC] text-[9px] font-mono font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-[2px] shadow-xs">
            Unavailable
          </span>
        ) : trackLaundry ? (
          <span className={`absolute top-2.5 right-2.5 backdrop-blur-md text-white text-[9px] font-mono font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-[2px] shadow-xs ${
            wearCount >= maxWears - 1 ? 'bg-[#743C49]/95' : 'bg-[#29202B]/85 border border-white/10'
          }`}>
            {wearCount}/{maxWears} wears
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 bg-[#29202B]/85 backdrop-blur-md text-[#F3EEE8] text-[9px] font-mono font-medium uppercase tracking-[0.08em] px-2 py-0.5 rounded-[2px] border border-white/10">
            {item.timesWorn || 0} wears
          </span>
        )}

        {/* Luxury Vault Indicator */}
        {(item.isLuxury || item.is_luxury || item.wearTier === 'luxury_special' || item.wear_tier === 'luxury_special') && (
          <span className="absolute bottom-2.5 left-2.5 bg-[#29202B]/90 backdrop-blur-md text-[#D5A6A0] text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-0.5 rounded-[2px] flex items-center gap-1 border border-[#D5A6A0]/40 shadow-xs">
            <Sparkles className="w-2.5 h-2.5 text-[#D5A6A0] fill-current" />
            Vault Piece
          </span>
        )}

        {/* Quick action overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3">
          {/* Quick Laundry Status Actions */}
          <div className="flex gap-1.5 flex-wrap">
            {laundryStatus === 'clean' ? (
              <>
                <button
                  onClick={(e) => handleLaundryAction(e, 'wash_now')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] bg-[#F3EEE8] hover:bg-white text-[#29202B] rounded-[2px] shadow-xs backdrop-blur-sm transition-colors cursor-pointer"
                  title="Mark washed (reset wears to 0)"
                >
                  Mark Washed
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'send_to_laundry')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] bg-[#B49B82] hover:bg-[#a38a71] text-[#29202B] rounded-[2px] shadow-xs backdrop-blur-sm transition-colors cursor-pointer"
                  title="Send to laundry now"
                >
                  Laundry
                </button>
                <button
                  onClick={(e) => handleLaundryAction(e, 'mark_unavailable')}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] bg-[#29202B]/90 hover:bg-black text-[#DCD4CC] rounded-[2px] shadow-xs backdrop-blur-sm transition-colors cursor-pointer"
                  title="Mark unavailable (dry clean, lent, damaged)"
                >
                  Unavailable
                </button>
              </>
            ) : (
              <button
                onClick={(e) => handleLaundryAction(e, 'restore')}
                disabled={isActionLoading}
                className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] bg-emerald-700 hover:bg-emerald-600 text-white rounded-[2px] shadow-xs backdrop-blur-sm transition-colors cursor-pointer"
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
                className="p-2 min-h-[34px] min-w-[34px] flex items-center justify-center bg-[#F3EEE8] dark:bg-[#29202B] text-[#29202B] dark:text-[#F3EEE8] rounded-[2px] hover:bg-white transition-colors shadow-xs cursor-pointer"
                title="Edit item"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 min-h-[34px] min-w-[34px] flex items-center justify-center bg-[#743C49] hover:bg-[#5b2f3a] text-white rounded-[2px] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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
          <div className="flex items-center justify-between text-[10px] text-[#777078] dark:text-[#D5A6A0] font-medium uppercase tracking-[0.16em] mb-1">
            <span>{item.category}</span>
            {item.brand && <span className="text-[#29202B] dark:text-[#F3EEE8] font-semibold">{item.brand}</span>}
          </div>

          <h3 className="font-serif text-base font-normal text-[#29202B] dark:text-[#F3EEE8] line-clamp-1 group-hover:text-[#743C49] dark:group-hover:text-[#D5A6A0] transition-colors">
            {item.name}
          </h3>

          <p className="text-xs text-[#777078] dark:text-[#B49B82] mt-1 font-sans">
            {item.style} · {item.color}
          </p>
        </div>

        <div className="pt-3 mt-3 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-between text-xs text-[#777078] dark:text-[#B49B82]">
          <span className="bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] px-2 py-0.5 rounded-[2px] text-[#29202B] dark:text-[#F3EEE8] font-medium text-[10px] uppercase tracking-[0.08em]">
            {item.season}
          </span>
          <span className="text-[#29202B] dark:text-[#F3EEE8] font-medium text-xs group-hover:text-[#743C49] dark:group-hover:text-[#D5A6A0] transition-colors flex items-center gap-1">
            View piece &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
