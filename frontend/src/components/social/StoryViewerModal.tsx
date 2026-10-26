import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, ChevronLeft, ChevronRight, FastForward, Sparkles, MapPin } from 'lucide-react';
import { Post } from '../../types';
import { Avatar } from '../ui/Avatar';

interface StoryViewerModalProps {
  stories: Post[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onLike: (postId: string) => Promise<void>;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialIndex = 0,
  isOpen,
  onClose,
  onLike,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const [isAnimatingFeedback, setIsAnimatingFeedback] = useState<'like' | 'skip' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, stories.length - 1)));
    }
  }, [isOpen, initialIndex, stories.length]);

  const currentStory = stories[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleLikeAndNext = useCallback(async () => {
    if (!currentStory) return;
    setIsAnimatingFeedback('like');
    try {
      if (!currentStory.isLiked) {
        await onLike(currentStory.id);
      }
    } finally {
      setTimeout(() => {
        setIsAnimatingFeedback(null);
        handleNext();
      }, 350);
    }
  }, [currentStory, onLike, handleNext]);

  const handleSkipAndNext = useCallback(() => {
    setIsAnimatingFeedback('skip');
    setTimeout(() => {
      setIsAnimatingFeedback(null);
      handleNext();
    }, 250);
  }, [handleNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'l' || e.key === 'L') {
        handleLikeAndNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleLikeAndNext, onClose]);

  // Touch gesture handlers (Right swipe = Like & Next, Left swipe = Skip & Next)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const currentX = e.touches[0].clientX;
    setTouchDeltaX(currentX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) return;
    const SWIPE_THRESHOLD = 50;

    if (touchDeltaX > SWIPE_THRESHOLD) {
      // Swiped Right -> Like & Next
      handleLikeAndNext();
    } else if (touchDeltaX < -SWIPE_THRESHOLD) {
      // Swiped Left -> Skip & Next
      handleSkipAndNext();
    }

    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  if (!isOpen || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/85 backdrop-blur-md p-2 sm:p-4 select-none">
      <div
        className="relative w-full max-w-md h-[92vh] max-h-[820px] bg-charcoal-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Story Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-3.5 flex items-center gap-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {stories.map((story, idx) => (
            <div
              key={story.id}
              className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden"
            >
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  idx < currentIndex
                    ? 'bg-white w-full'
                    : idx === currentIndex
                    ? 'bg-cognac-400 w-full'
                    : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Story Header (Author info + Close button) */}
        <div className="absolute top-6 inset-x-0 z-30 px-4 py-2 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={currentStory.user.avatar}
              alt={currentStory.user.name}
              size="sm"
              isVerified={currentStory.user.isVerified}
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white drop-shadow">
                  {currentStory.user.name}
                </span>
                <span className="text-[11px] text-cream-200/80 drop-shadow">
                  @{currentStory.user.username}
                </span>
              </div>
              <p className="text-[10px] text-cream-200/70">{currentStory.createdAt}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-colors"
            aria-label="Close stories"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Media (Main Image with swipe feedback overlay) */}
        <div className="relative flex-1 w-full h-full bg-charcoal-950 flex items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentStory.id}
              src={currentStory.image}
              alt={currentStory.caption}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full object-cover"
              style={{
                transform: touchDeltaX !== 0 ? `translateX(${touchDeltaX * 0.4}px)` : undefined,
              }}
            />
          </AnimatePresence>

          {/* Swipe gesture guide overlays */}
          {touchDeltaX > 25 && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600/90 text-white font-bold text-sm shadow-xl animate-pulse">
              <Heart className="w-5 h-5 fill-white" />
              <span>Swipe to Like</span>
            </div>
          )}

          {touchDeltaX < -25 && (
            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-2xl bg-charcoal-800/90 text-cream-100 font-bold text-sm shadow-xl animate-pulse">
              <span>Skip Look</span>
              <FastForward className="w-5 h-5" />
            </div>
          )}

          {/* Action Burst Animations */}
          <AnimatePresence>
            {isAnimatingFeedback === 'like' && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
              >
                <div className="w-24 h-24 rounded-full bg-emerald-500/90 backdrop-blur flex items-center justify-center text-white shadow-2xl">
                  <Heart className="w-12 h-12 fill-white stroke-white animate-bounce" />
                </div>
              </motion.div>
            )}

            {isAnimatingFeedback === 'skip' && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                exit={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
              >
                <div className="w-20 h-20 rounded-full bg-charcoal-700/90 backdrop-blur flex items-center justify-center text-cream-100 shadow-2xl">
                  <FastForward className="w-10 h-10" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tap navigation hot-spots */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="absolute left-0 inset-y-0 w-1/4 z-10 cursor-pointer focus:outline-none flex items-center pl-2 opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Previous story"
          >
            {currentIndex > 0 && (
              <span className="p-2 rounded-full bg-black/40 text-white">
                <ChevronLeft className="w-6 h-6" />
              </span>
            )}
          </button>
          <button
            onClick={handleNext}
            className="absolute right-0 inset-y-0 w-1/4 z-10 cursor-pointer focus:outline-none flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Next story"
          >
            <span className="p-2 rounded-full bg-black/40 text-white">
              <ChevronRight className="w-6 h-6" />
            </span>
          </button>
        </div>

        {/* Story Footer & Caption */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-charcoal-950 via-charcoal-950/80 to-transparent text-white space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cognac-700/80 text-cream-50">
                {currentStory.occasion}
              </span>
              {currentStory.location && (
                <span className="flex items-center gap-1 text-[11px] text-cream-200/80">
                  <MapPin className="w-3 h-3 text-cognac-400" />
                  {currentStory.location}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-cream-100 line-clamp-2 drop-shadow">
              {currentStory.caption}
            </p>
          </div>

          {/* Swipe Buttons (Touch and Desktop Accessible) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={handleSkipAndNext}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-semibold text-cream-100 transition-all border border-white/15 shadow"
            >
              <FastForward className="w-4 h-4 text-cream-300" />
              <span>Swipe Left to Skip</span>
            </button>

            <button
              onClick={handleLikeAndNext}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all shadow-soft-sm ${
                currentStory.isLiked
                  ? 'bg-rose-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${
                  currentStory.isLiked ? 'fill-white stroke-white' : 'stroke-white'
                }`}
              />
              <span>{currentStory.isLiked ? 'Liked ✨' : 'Swipe Right to Like'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

