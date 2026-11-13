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
  const isManualReview =
    item.processingStatus === 'manual_review_required' ||
    item.processingStage === 'manual_review_required';
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
      className={`group relative bg-white dark:bg-[#1F1922] rounded-[3px] border overflow-hidden transition-all duration-300 flex flex-col ${
        isReady
          ? 'border-[#DCD4CC] dark:border-[#392F3E] hover:border-[#743C49] dark:hover:border-[#D5A6A0] cursor-pointer shadow-xs'
          : 'border-[#DCD4CC]/60 dark:border-[#392F3E]/60 opacity-90'
      }`}
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-[#FAF6F0] dark:bg-[#201824] overflow-hidden">
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
            <span className="bg-[#29202B]/95 backdrop-blur-md text-[#F3EEE8] text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1.5 shadow-xs border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D5A6A0] animate-ping" />
              AI Analyzing...
            </span>
          )}

          {isFailed && (
            <span className="bg-rose-700/95 backdrop-blur-md text-white text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1 shadow-xs">
              <AlertCircle className="w-3 h-3" />
              Analysis Failed
            </span>
          )}

          {isManualReview && (
            <span className="bg-[#B49B82]/95 backdrop-blur-md text-[#29202B] text-[9px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded-[2px] flex items-center gap-1 shadow-xs border border-[#29202B]/20">
              <AlertCircle className="w-3 h-3 text-[#29202B]" />
              Manual Review Needed
            </span>
          )}

          {isReady && !isManualReview && (
            <span className="bg-[#29202B]/90 backdrop-blur-md text-[#D5A6A0] text-[9px] uppercase tracking-[0.14em] font-medium px-2 py-1 rounded-[2px] flex items-center gap-1.5 shadow-xs border border-[#D5A6A0]/30">
              <Sparkles className="w-3 h-3 text-[#D5A6A0]" />
              Review Needed
            </span>
          )}
        </div>

        {/* Quick Delete Overlay Button */}
        <button
          onClick={handleDelete}
          disabled={isLocked}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-[2px] bg-black/60 backdrop-blur-md text-white hover:bg-[#743C49] transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Delete pending garment"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card Content & Predictions */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#743C49] dark:text-[#D5A6A0] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] px-2 py-0.5 rounded-[2px]">
              {item.category || 'Apparel'}
            </span>
            {item.color && (
              <span className="text-[11px] text-[#777078] dark:text-[#D5A6A0] flex items-center gap-1.5 font-sans">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] border border-black/20"
                  style={{ backgroundColor: item.color.toLowerCase() }}
                />
                {item.color}
              </span>
            )}
          </div>

          <h3 className="font-serif text-base font-normal text-[#29202B] dark:text-[#F3EEE8] truncate group-hover:text-[#743C49] dark:group-hover:text-[#D5A6A0] transition-colors" title={item.name}>
            {item.name}
          </h3>

          {/* Predicted Attribute Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {item.pattern && (
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] text-[#29202B] dark:text-[#F3EEE8] font-mono uppercase tracking-[0.05em]">
                {item.pattern}
              </span>
            )}
            {item.season && (
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] text-[#777078] dark:text-[#B49B82] uppercase tracking-[0.08em]">
                {item.season}
              </span>
            )}
            {item.style && (
              <span className="text-[9px] px-2 py-0.5 rounded-[2px] bg-[#FAF6F0] dark:bg-[#201824] border border-[#DCD4CC] dark:border-[#392F3E] text-[#777078] dark:text-[#B49B82] uppercase tracking-[0.08em]">
                {item.style}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-[#DCD4CC] dark:border-[#392F3E] flex items-center gap-2">
          {isReady && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onReview(item)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full text-xs h-8 rounded-[2px] uppercase tracking-[0.1em]"
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
                className="px-2.5 h-8 flex-shrink-0 rounded-[2px] border-[#DCD4CC]"
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
              className="w-full text-xs h-8 rounded-[2px] uppercase tracking-[0.1em] border-[#DCD4CC]"
            >
              Retry AI Analysis
            </Button>
          )}

          {isProcessing && (
            <div className="w-full text-center py-1.5 text-xs text-[#777078] dark:text-[#D5A6A0] flex items-center justify-center gap-1.5 font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#743C49]" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
