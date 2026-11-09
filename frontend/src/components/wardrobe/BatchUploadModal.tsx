import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { optimizeImage, formatBytes } from '../../utils/imageOptimizer';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

interface LocalFilePreview {
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
  isOptimizing?: boolean;
  optimizedSizeFormatted?: string;
  savedPercent?: number;
}

interface BatchItemProgress {
  clothing_id: string;
  name: string;
  sequence_order: number;
  status: string;
  stage: string;
  has_processed: boolean;
  review_required: boolean;
  original_image_url: string;
  processed_image_url?: string | null;
  error?: string | null;
  duration_seconds: number;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'In Queue',
  claimed_by_worker: 'Worker Claimed',
  analyzing_clothing: 'Extracting Attributes',
  predictions_ready: 'Attributes Ready',
  ready_for_review: 'Ready for Review',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const ACTIVE_BATCH_KEY = 'tailorbird_active_batch_id';

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  isOpen,
  onClose,
  onCompleted,
}) => {
  const { refreshData, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<LocalFilePreview[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>('Tops');
  const [defaultOccasion, setDefaultOccasion] = useState<string>('Casual Daily');

  const [batchId, setBatchId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ACTIVE_BATCH_KEY);
    } catch {
      return null;
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>('idle'); // idle, uploading, queued, processing, completed, partially_completed, failed
  const [totalItems, setTotalItems] = useState(0);
  const [completedItems, setCompletedItems] = useState(0);
  const [failedItems, setFailedItems] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [currentProcessingItem, setCurrentProcessingItem] = useState<{
    clothing_id: string;
    name: string;
    sequence_order: number;
    stage: string;
  } | null>(null);
  const [items, setItems] = useState<BatchItemProgress[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

  // Clean up object URLs on unmount or file removal
  const cleanupPreviews = useCallback((previews: LocalFilePreview[]) => {
    previews.forEach((p) => {
      try {
        URL.revokeObjectURL(p.previewUrl);
      } catch {}
    });
  }, []);

  // Handle incoming files from file picker or drag-drop
  const handleFilesAdded = (fileList: FileList | File[]) => {
    const rawArr = Array.from(fileList);
    const valid = rawArr.filter((f) =>
      f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|avif)$/i.test(f.name)
    );

    if (valid.length === 0) {
      showToast('Please select valid image files (JPEG, PNG, WebP, HEIC).', 'info');
      return;
    }

    const maxAllowed = 20;
    const remainingSlots = maxAllowed - selectedFiles.length;
    if (remainingSlots <= 0) {
      showToast(`Maximum batch size is ${maxAllowed} images.`, 'info');
      return;
    }

    const toAdd = valid.slice(0, remainingSlots);
    const newPreviews: LocalFilePreview[] = toAdd.map((file) => {
      const sizeKb = Math.round(file.size / 1024);
      const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
      return {
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        sizeFormatted: sizeStr,
      };
    });

    setSelectedFiles((prev) => [...prev, ...newPreviews]);

    // Asynchronously compute client-side WebP optimization metrics for previews
    toAdd.forEach(async (file) => {
      try {
        const opt = await optimizeImage(file, { preset: 'thumbnail' });
        setSelectedFiles((curr) =>
          curr.map((item) =>
            item.file === file
              ? {
                  ...item,
                  optimizedSizeFormatted: formatBytes(opt.optimizedSize),
                  savedPercent: Math.round(opt.compressionRatio * 100),
                }
              : item
          )
        );
      } catch {}
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {}
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Submit batch to backend
  const handleStartBatch = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setBatchStatus('uploading');

    try {
      const filesToUpload = selectedFiles.map((s) => s.file);
      const res = await api.clothing.batchUpload(filesToUpload, {
        category: defaultCategory,
        occasion: defaultOccasion,
      });

      setBatchId(res.batchId);
      try {
        sessionStorage.setItem(ACTIVE_BATCH_KEY, res.batchId);
      } catch {}

      setBatchStatus('queued');
      setTotalItems(res.totalItems);
      setProgressPercentage(0);
      showToast(`Batch queued: ${res.totalItems} images submitted for processing.`, 'success');
    } catch (err: any) {
      setBatchStatus('idle');
      showToast(err.message || 'Failed to submit batch upload.', 'info');
    } finally {
      setIsUploading(false);
    }
  };

  // Poll batch status from single consolidated endpoint
  useEffect(() => {
    if (!isOpen || !batchId) return;

    let isSubscribed = true;
    let pollTimeout: any = null;

    const fetchStatus = async () => {
      try {
        const data = await api.clothing.getBatchStatus(batchId);
        if (!isSubscribed) return;

        setBatchStatus(data.status);
        setTotalItems(data.totalItems);
        setCompletedItems(data.completedItems);
        setFailedItems(data.failedItems);
        setProgressPercentage(data.progressPercentage);
        setCurrentProcessingItem(data.currentProcessingItem || null);
        setItems(data.items || []);

        const isTerminal = ['completed', 'partially_completed', 'failed'].includes(data.status);
        if (isTerminal) {
          refreshData();
          try {
            sessionStorage.removeItem(ACTIVE_BATCH_KEY);
          } catch {}
        } else {
          // Poll again with debounced interval
          pollTimeout = setTimeout(fetchStatus, 2000);
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        // If 404, clear active batch
        if (err.status === 404) {
          try {
            sessionStorage.removeItem(ACTIVE_BATCH_KEY);
          } catch {}
          setBatchId(null);
        } else {
          pollTimeout = setTimeout(fetchStatus, 3000);
        }
      }
    };

    fetchStatus();

    return () => {
      isSubscribed = false;
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [isOpen, batchId, refreshData]);

  // Retry failed images
  const handleRetryFailed = async () => {
    if (!batchId) return;
    setIsRetrying(true);
    try {
      const res = await api.clothing.retryBatchFailed(batchId);
      setBatchStatus(res.status || 'processing');
      showToast('Retrying failed items in sequence...', 'info');
    } catch (err: any) {
      showToast(err.message || 'Retry failed.', 'info');
    } finally {
      setIsRetrying(false);
    }
  };

  // Cancel remaining items in active batch
  const [isCancelling, setIsCancelling] = useState(false);
  const handleCancelBatch = async () => {
    if (!batchId) return;
    setIsCancelling(true);
    try {
      const res = await api.clothing.cancelBatch(batchId);
      setBatchStatus(res.status || 'cancelled');
      showToast('Batch processing cancelled.', 'info');
      refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel batch.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Reset modal state
  const handleResetModal = () => {
    cleanupPreviews(selectedFiles);
    setSelectedFiles([]);
    setBatchId(null);
    setBatchStatus('idle');
    setTotalItems(0);
    setCompletedItems(0);
    setFailedItems(0);
    setProgressPercentage(0);
    setCurrentProcessingItem(null);
    setItems([]);
    try {
      sessionStorage.removeItem(ACTIVE_BATCH_KEY);
    } catch {}
  };

  const handleFinishAndClose = () => {
    handleResetModal();
    onClose();
    if (onCompleted) onCompleted();
  };

  const isTerminal = ['completed', 'partially_completed', 'failed', 'cancelled'].includes(batchStatus);
  const isProcessing = ['queued', 'processing'].includes(batchStatus);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isProcessing) {
          handleResetModal();
        }
        onClose();
      }}
      title="Batch Wardrobe Upload"
      subtitle="Upload multiple clothing photographs for batch AI attribute prediction"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
          }}
        />

        {/* STEP 1: FILE SELECTION / PREVIEW STAGE (When no active batch is running) */}
        {batchStatus === 'idle' && (
          <div className="space-y-5">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 rounded-xl p-8 text-center cursor-pointer bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 mb-3 border border-zinc-200 dark:border-zinc-700">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Drag & drop multiple clothing images here
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                Or click to browse files from your device. Select up to 20 images at once.
              </p>
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Choose Images
                </Button>
              </div>
            </div>

            {/* Selected Previews Grid */}
            {selectedFiles.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Selected Images ({selectedFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  {selectedFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900"
                    >
                      <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span>{item.sizeFormatted}</span>
                          {item.savedPercent !== undefined && item.savedPercent > 0 && (
                            <span className="text-emerald-500 font-semibold">
                              -{item.savedPercent}%
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/90 transition-all opacity-90 group-hover:opacity-100"
                        title="Remove image"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Batch Defaults */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Default Category
                    </label>
                    <select
                      value={defaultCategory}
                      onChange={(e) => setDefaultCategory(e.target.value)}
                      className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Tops">Tops & Shirts</option>
                      <option value="Bottoms">Bottoms & Pants</option>
                      <option value="Indian Ethnic">Indian Ethnic</option>
                      <option value="Dresses">Dresses & Skirts</option>
                      <option value="Outerwear">Outerwear & Jackets</option>
                      <option value="Footwear">Footwear</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Default Occasion
                    </label>
                    <select
                      value={defaultOccasion}
                      onChange={(e) => setDefaultOccasion(e.target.value)}
                      className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Casual Daily">Casual Daily</option>
                      <option value="Smart Casual">Smart Casual</option>
                      <option value="Work / Office">Work / Office</option>
                      <option value="Evening Formal">Evening Formal</option>
                      <option value="Traditional Ethnic">Traditional Ethnic</option>
                      <option value="Travel / Weekend">Travel / Weekend</option>
                    </select>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <Button variant="outline" size="sm" onClick={handleResetModal}>
                    Clear Selection
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStartBatch}
                    disabled={isUploading || selectedFiles.length === 0}
                    icon={
                      isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )
                    }
                  >
                    {isUploading
                      ? 'Submitting Batch...'
                      : `Start Batch Upload (${selectedFiles.length} Pieces)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: ACTIVE PROGRESS / QUEUE PROCESSING STAGE */}
        {(isProcessing || isTerminal) && (
          <div className="space-y-5">
            {/* Top Batch Status Header */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                    Sequential Batch Processing
                  </span>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {isTerminal
                      ? 'Batch Processing Complete'
                      : currentProcessingItem
                      ? `Processing Item ${currentProcessingItem.sequence_order + 1} of ${totalItems}`
                      : 'Sequential Queue Active'}
                  </h4>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {completedItems} / {totalItems} completed
                  </span>
                  {failedItems > 0 && (
                    <span className="block text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                      {failedItems} failed
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    failedItems > 0 && isTerminal
                      ? 'bg-amber-500'
                      : 'bg-zinc-900 dark:bg-zinc-100'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Current Sub-stage callout and Cancel action */}
              {!isTerminal && (
                <div className="flex items-center justify-between pt-1">
                  {currentProcessingItem ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-900 dark:text-zinc-100" />
                      <span>
                        Current Stage:{' '}
                        <strong>{STAGE_LABELS[currentProcessingItem.stage] || currentProcessingItem.stage}</strong>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">Processing queue...</span>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelBatch}
                    disabled={isCancelling}
                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-medium underline"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Batch'}
                  </button>
                </div>
              )}
            </div>

            {/* Item-by-item sequential queue listing */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {items.map((item) => {
                const isReady = item.status === 'ready_for_review' || item.status === 'completed';
                const isItemProcessing = item.status === 'processing';
                const isItemFailed = item.status === 'failed';
                const isItemQueued = item.status === 'queued';

                return (
                  <div
                    key={item.clothing_id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                      isItemProcessing
                        ? 'bg-zinc-50 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600 shadow-sm'
                        : isReady
                        ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                        : isItemFailed
                        ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 opacity-60'
                    }`}
                  >
                    {/* Thumbnail preview */}
                    <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                      {item.has_processed ? (
                        <img
                          src={item.processed_image_url || item.original_image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.original_image_url}
                          alt={item.name}
                          className="w-full h-full object-cover opacity-80"
                        />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-zinc-400">
                          #{item.sequence_order + 1}
                        </span>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {isItemFailed
                          ? item.error || 'Processing encountered an error'
                          : STAGE_LABELS[item.stage] || item.stage}
                        {item.duration_seconds > 0 ? ` (${item.duration_seconds}s)` : ''}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <div className="flex-shrink-0">
                      {isReady && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Processed</span>
                        </span>
                      )}
                      {isItemProcessing && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Active</span>
                        </span>
                      )}
                      {isItemQueued && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Queued
                        </span>
                      )}
                      {isItemFailed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* STEP 3: TERMINAL SUMMARY ACTIONS */}
            {isTerminal && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {completedItems} of {totalItems} items ready in Wardrobe.
                  </span>
                  {failedItems > 0 && (
                    <span className="text-zinc-500 dark:text-zinc-400 block text-[11px]">
                      {failedItems} item(s) could not be segmented automatically.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {failedItems > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryFailed}
                      disabled={isRetrying}
                      icon={
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
                        />
                      }
                    >
                      {isRetrying ? 'Retrying...' : 'Retry Failed'}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleFinishAndClose}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Go to Wardrobe
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
