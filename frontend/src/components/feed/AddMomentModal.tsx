import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Camera, Film, Image as ImageIcon, Sparkles, Loader2, AlertCircle, Clock } from 'lucide-react';
import { api } from '../../services/api';
import { OutfitMoment } from '../../types';
import { backdropVariants } from '../../utils/animations';

interface AddMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newMoment: OutfitMoment) => void;
}

const OCCASIONS = [
  'Casual Daily',
  'Work Formal',
  'Smart Casual',
  'Date Night',
  'Evening Gala',
  'Weekend Casual',
  'Athletic',
  'Party / Festive',
  'Travel',
  'Summer Casual',
  'Winter Layered',
];

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12MB
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB

export const AddMomentModal: React.FC<AddMomentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [occasion, setOccasion] = useState('Casual Daily');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  // Clean up preview object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setFile(null);
      setPreviewUrl(null);
      setIsVideo(false);
      setCaption('');
      setOccasion('Casual Daily');
      setTags('');
      setError(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  const handleFile = useCallback((selectedFile: File) => {
    setError(null);

    const isVid =
      selectedFile.type.startsWith('video/') ||
      selectedFile.name.toLowerCase().endsWith('.mp4') ||
      selectedFile.name.toLowerCase().endsWith('.webm') ||
      selectedFile.name.toLowerCase().endsWith('.mov');

    const maxBytes = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const maxMb = maxBytes / (1024 * 1024);

    if (selectedFile.size > maxBytes) {
      setError(`File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed for ${isVid ? 'videos' : 'photos'} is ${maxMb}MB.`);
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setIsVideo(isVid);
    setPreviewUrl(objUrl);
  }, [previewUrl]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a photo or video before sharing.');
      return;
    }

    if (isSubmittingRef.current || isSubmitting) {
      return; // Prevent duplicate submission
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', caption.trim());
      formData.append('occasion', occasion);
      if (tags.trim()) {
        formData.append('tags', tags.trim());
      }

      const createdMoment = await api.moments.upload(formData);
      onSuccess(createdMoment);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload moment. Please try again.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={() => !isSubmitting && onClose()}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  Share 24-Hour Moment
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> 24h
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Visible to you and followers in For You discovery for 24 hours.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Media Upload / Preview Area */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/webm,video/quicktime"
                onChange={onFileInputChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFileInputChange}
                className="hidden"
              />

              {!previewUrl ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors bg-zinc-50/50 dark:bg-zinc-800/30"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
                    <Upload className="w-6 h-6 text-primary-500" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Upload today's look
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                    Drag and drop, browse photos, or shoot directly with your camera.
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition shadow-xs flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Browse Files
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Take Photo
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-3">
                    Images up to 12MB (WebP optimized) • Videos up to 25MB (MP4/WebM)
                  </p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 aspect-[4/5] max-h-72 flex items-center justify-center group">
                  {isVideo ? (
                    <video
                      src={previewUrl}
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Moment preview"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* Format Badge */}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white flex items-center gap-1">
                    {isVideo ? <Film className="w-3 h-3 text-amber-400" /> : <ImageIcon className="w-3 h-3 text-cyan-400" />}
                    {isVideo ? 'Video' : 'Photo'} • {(file?.size ? (file.size / (1024 * 1024)).toFixed(1) : 0)} MB
                  </div>

                  {/* Change Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setIsVideo(false);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition shadow-xs"
                    title="Change media"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Occasion Selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Occasion
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              >
                {OCCASIONS.map((occ) => (
                  <option key={occ} value={occ}>
                    {occ}
                  </option>
                ))}
              </select>
            </div>

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Caption (Optional)
                </label>
                <span className="text-[10px] text-zinc-400">{caption.length}/280</span>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                placeholder="What are you wearing today? Thoughts, brands, or mood..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Tags (Optional, comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. ootd, minimal, linen, streetstyle"
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-bold transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Publish 24h Moment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
