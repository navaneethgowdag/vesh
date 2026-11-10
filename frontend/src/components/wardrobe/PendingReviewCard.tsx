import React from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check,
  Trash2,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { ClothingItem } from '../../types';
import { Button } from '../ui/Button';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAsyncLock } from '../../hooks/useAsyncLock';

interface PendingReviewCardProps {
  item: ClothingItem;
  onReview: (item: ClothingItem) => void;
  onAccepted?: (item: ClothingItem) => void;
}

export const PendingReviewCard: React.FC<PendingReviewCardProps> = ({
  item,
  onReview,
  onAccepted,
}) => {
  const { deleteClothingItem, refreshData, showToast } = useApp();
  const { execute: runAction, isLocked } = useAsyncLock();

  const isFailed = item.processingStatus === 'failed' || item.processingStage === 'failed';
  const isProcessing =
    item.processingStatus === 'queued' ||
    item.processingStatus === 'processing' ||
    item.processingStage === 'queued' ||
    item.processingStage === 'analyzing_clothing';
  const isReady = !isFailed && !isProcessing;

  const imgUrl = resolveImageUrl(
    item.originalImageUrl || item.preferredImageUrl || item.image
  ) || FALLBACK_POST_IMAGE;

  // Quick direct acceptance using current/predicted attributes
  const handleQuickAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    runAction(async () => {
      try {
        await api.clothing.finalize(item.id);
        showToast(`"${item.name}" accepted into your wardrobe!`, 'success');
        if (onAccepted) onAccepted(item);
        await refreshData();
      } catch (err: any) {
        showToast(err.message || 'Failed to accept item.', 'info');
      }
    });
  };

  // Re-run AI analysis if stalled or failed
  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    runAction(async () => {
      try {
        await api.clothing.reanalyze(item.id);
        showToast('Re-analyzed garment. Updating attributes...', 'success');
        await refreshData();
      } catch (err: any) {
        showToast(err.message || 'Retry failed.', 'info');
      }
    });
  };

  // Remove pending upload
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove "${item.name}" from pending uploads?`)) {
      runAction(async () => {
        await deleteClothingItem(item.id);
        showToast('Pending garment removed.', 'info');
      });
    }
  };

  return (
    <div
      onClick={() => isReady && onReview(item)}
      className={`group relative bg-white dark:bg-[#1C201D] rounded-2xl border overflow-hidden transition-all duration-300 flex flex-col ${
        isReady
          ? 'border-[#B5AA99]/60 hover:border-[#899783] cursor-pointer shadow-sm hover:shadow-md'
          : 'border-[#E2DDD3] dark:border-[#2D342F] opacity-90'
      }`}
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-[#F1EEE7] dark:bg-[#242A25] overflow-hidden">
        <img
          src={imgUrl}
          alt={item.name}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
              e.currentTarget.src = FALLBACK_POST_IMAGE;
            }
          }}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="lazy"
        />

        {/* Status Pills */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {isProcessing && (
            <span className="bg-[#202321]/90 backdrop-blur-md text-[#F8F6F1] text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#899783] animate-ping" />
              AI Analyzing...
            </span>
          )}

          {isFailed && (
            <span className="bg-rose-700/90 backdrop-blur-md text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <AlertCircle className="w-3 h-3" />
              Analysis Failed
            </span>
          )}

          {isReady && (
            <span className="bg-[#202321]/90 backdrop-blur-md text-[#B5AA99] text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-[#B5AA99]/30">
              <Sparkles className="w-3 h-3 text-[#B5AA99]" />
              Review Needed
            </span>
          )}
        </div>

        {/* Quick Delete Overlay Button */}
        <button
          onClick={handleDelete}
          disabled={isLocked}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-rose-600 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Delete pending garment"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card Content & Predictions */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#727D69] dark:text-[#A3ABA0] bg-[#E9E6DE]/60 dark:bg-[#242A25] px-2 py-0.5 rounded-full">
              {item.category || 'Apparel'}
            </span>
            {item.color && (
              <span className="text-[11px] text-[#777C75] dark:text-[#A3ABA0] flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/20"
                  style={{ backgroundColor: item.color.toLowerCase() }}
                />
                {item.color}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-[#202321] dark:text-[#F8F6F1] truncate" title={item.name}>
            {item.name}
          </h3>

          {/* Predicted Attribute Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {item.pattern && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E9E6DE]/50 dark:bg-[#242A25] text-[#292D29] dark:text-[#A3ABA0] font-mono">
                {item.pattern}
              </span>
            )}
            {item.season && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E9E6DE]/50 dark:bg-[#242A25] text-[#292D29] dark:text-[#A3ABA0]">
                {item.season}
              </span>
            )}
            {item.style && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E9E6DE]/50 dark:bg-[#242A25] text-[#292D29] dark:text-[#A3ABA0]">
                {item.style}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-[#E2DDD3] dark:border-[#2D342F] flex items-center gap-2">
          {isReady && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onReview(item)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full text-xs h-8"
              >
                Review Piece
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickAccept}
                disabled={isLocked}
                title="Quick Accept with AI predictions"
                icon={<Check className="w-3.5 h-3.5 text-emerald-600" />}
                className="px-2.5 h-8 flex-shrink-0"
              />
            </>
          )}

          {isFailed && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLocked}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="w-full text-xs h-8"
            >
              Retry AI Analysis
            </Button>
          )}

          {isProcessing && (
            <div className="w-full text-center py-1.5 text-xs text-[#777C75] dark:text-[#A3ABA0] flex items-center justify-center gap-1.5 font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#899783]" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
