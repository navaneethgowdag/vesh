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
      className={`group relative bg-white dark:bg-zinc-900 rounded-lg border overflow-hidden transition-all duration-200 flex flex-col ${
        isReady
          ? 'border-amber-200 dark:border-amber-900/60 hover:border-amber-400 dark:hover:border-amber-700 cursor-pointer shadow-sm hover:shadow'
          : 'border-zinc-200 dark:border-zinc-800 opacity-90'
      }`}
    >
      {/* Garment Image */}
      <div className="relative aspect-[3/4] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <img
          src={imgUrl}
          alt={item.name}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
              e.currentTarget.src = FALLBACK_POST_IMAGE;
            }
          }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Status Pills */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {isProcessing && (
            <span className="bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              AI Analyzing...
            </span>
          )}

          {isFailed && (
            <span className="bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <AlertCircle className="w-3 h-3" />
              Analysis Failed
            </span>
          )}

          {isReady && (
            <span className="bg-amber-600/90 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3 text-amber-200" />
              Review Needed
            </span>
          )}
        </div>

        {/* Quick Delete Overlay Button */}
        <button
          onClick={handleDelete}
          disabled={isLocked}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded bg-black/60 backdrop-blur-md text-white hover:bg-rose-600 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
          title="Delete pending garment"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card Content & Predictions */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
              {item.category || 'Apparel'}
            </span>
            {item.color && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full border border-black/20"
                  style={{ backgroundColor: item.color.toLowerCase() }}
                />
                {item.color}
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate" title={item.name}>
            {item.name}
          </h3>

          {/* Predicted Attribute Badges */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {item.pattern && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {item.pattern}
              </span>
            )}
            {item.season && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {item.season}
              </span>
            )}
            {item.style && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {item.style}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          {isReady && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onReview(item)}
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full text-xs h-8"
              >
                Review & Accept
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
            <div className="w-full text-center py-1.5 text-xs text-zinc-400 flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
