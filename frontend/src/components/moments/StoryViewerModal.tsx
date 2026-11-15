import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { OutfitMoment } from '../../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { momentImageCache } from '../../utils/momentImageCache';

export interface StoryGroup {
  user: {
    id: string;
    name: string;
    username: string;
    avatar?: string;
    isVerified?: boolean;
  };
  moments: OutfitMoment[];
  hasUnseen?: boolean;
}

interface StoryViewerModalProps {
  isOpen: boolean;
  storyGroups: StoryGroup[];
  initialGroupIndex?: number;
  initialMomentIndex?: number;
  currentUserId?: string;
  onClose: () => void;
  onLike?: (moment: OutfitMoment) => Promise<void> | void;
  onMarkSeen?: (moment: OutfitMoment) => void;
}

const MOMENT_DURATION_MS = 5500; // 5.5 seconds per story slide

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  storyGroups,
  initialGroupIndex = 0,
  initialMomentIndex = 0,
  currentUserId,
  onClose,
  onLike,
  onMarkSeen,
}) => {
  const [groupIdx, setGroupIdx] = useState<number>(initialGroupIndex);
  const [momentIdx, setMomentIdx] = useState<number>(initialMomentIndex);
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [likeBurst, setLikeBurst] = useState<boolean>(false);

  const progressTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const pausedAtRef = useRef<number>(0);
  const isNavigatingRef = useRef<boolean>(false);

  // Sync state if initial indices change when opening
  useEffect(() => {
    if (isOpen) {
      setGroupIdx(Math.max(0, Math.min(initialGroupIndex, storyGroups.length - 1)));
      setMomentIdx(Math.max(0, initialMomentIndex));
      setProgress(0);
      setIsPaused(false);
      setShowAnalytics(false);
    }
  }, [isOpen, initialGroupIndex, initialMomentIndex, storyGroups.length]);

  const currentGroup = storyGroups[groupIdx] || null;
  const currentMoment = currentGroup?.moments?.[momentIdx] || null;
  const isOwnStory = Boolean(currentUserId && currentGroup?.user.id === currentUserId);

  // Mark active moment as seen
  useEffect(() => {
    if (currentMoment && onMarkSeen) {
      onMarkSeen(currentMoment);
    }
  }, [currentMoment, onMarkSeen]);

  // Preload adjacent images for smooth zero-lag transitions
  useEffect(() => {
    if (!currentGroup) return;
    const urlsToPreload: string[] = [];

    // Next moment in current group
    if (momentIdx + 1 < currentGroup.moments.length) {
      urlsToPreload.push(resolveImageUrl(currentGroup.moments[momentIdx + 1].imageUrl) || FALLBACK_POST_IMAGE);
    }
    // First moment in next group
    if (groupIdx + 1 < storyGroups.length && storyGroups[groupIdx + 1].moments[0]) {
      urlsToPreload.push(resolveImageUrl(storyGroups[groupIdx + 1].moments[0].imageUrl) || FALLBACK_POST_IMAGE);
    }

    urlsToPreload.forEach((url) => {
      const img = new Image();
      img.src = url;
    });
  }, [currentGroup, groupIdx, momentIdx, storyGroups]);

  // Navigate to Next slide
  const handleNext = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 200);

    if (!currentGroup) {
      onClose();
      return;
    }

    if (momentIdx < currentGroup.moments.length - 1) {
      setMomentIdx((prev) => prev + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    } else if (groupIdx < storyGroups.length - 1) {
      setGroupIdx((prev) => prev + 1);
      setMomentIdx(0);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    } else {
      // Reached the end of all stories
      onClose();
    }
  }, [currentGroup, momentIdx, groupIdx, storyGroups.length, onClose]);

  // Navigate to Previous slide
  const handlePrev = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 200);

    if (momentIdx > 0) {
      setMomentIdx((prev) => prev - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    } else if (groupIdx > 0) {
      const prevGroup = storyGroups[groupIdx - 1];
      setGroupIdx((prev) => prev - 1);
      setMomentIdx(prevGroup ? prevGroup.moments.length - 1 : 0);
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    } else {
      // At first slide of first story, reset progress
      setProgress(0);
      startTimeRef.current = Date.now();
      pausedAtRef.current = 0;
    }
  }, [momentIdx, groupIdx, storyGroups]);

  // Progress Bar Animation Loop
  useEffect(() => {
    if (!isOpen || isPaused || !currentMoment) {
      if (progressTimerRef.current) cancelAnimationFrame(progressTimerRef.current);
      return;
    }

    startTimeRef.current = Date.now() - pausedAtRef.current;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min(100, (elapsed / MOMENT_DURATION_MS) * 100);
      setProgress(currentProgress);

      if (currentProgress >= 100) {
        handleNext();
      } else {
        progressTimerRef.current = requestAnimationFrame(tick);
      }
    };

    progressTimerRef.current = requestAnimationFrame(tick);

    return () => {
      if (progressTimerRef.current) cancelAnimationFrame(progressTimerRef.current);
    };
  }, [isOpen, isPaused, currentMoment, handleNext]);

  // Keyboard navigation & ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Pause on hold
  const handlePointerDown = () => {
    pausedAtRef.current = (progress / 100) * MOMENT_DURATION_MS;
    setIsPaused(true);
  };

  const handlePointerUp = () => {
    setIsPaused(false);
  };

  // Like current moment
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentMoment) return;
    setLikeBurst(true);
    setTimeout(() => setLikeBurst(false), 900);
    if (onLike) {
      await onLike(currentMoment);
    }
  };

  // Share current moment
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentMoment) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `TailorBird Moment by ${currentGroup?.user.name}`,
          text: currentMoment.caption || 'Check out this 24-hour style moment on TailorBird.',
          url,
        });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  // Swipe / Drag Gestures
  const handleDragEnd = (_: any, info: PanInfo) => {
    const thresholdX = 50;
    const thresholdY = 80;

    // Swipe down to close
    if (info.offset.y > thresholdY && Math.abs(info.offset.x) < 80) {
      onClose();
      return;
    }

    // Swipe left = next user story
    if (info.offset.x < -thresholdX) {
      if (groupIdx < storyGroups.length - 1) {
        setGroupIdx((prev) => prev + 1);
        setMomentIdx(0);
        setProgress(0);
      } else {
        onClose();
      }
    }
    // Swipe right = previous user story
    else if (info.offset.x > thresholdX) {
      if (groupIdx > 0) {
        setGroupIdx((prev) => prev - 1);
        setMomentIdx(0);
        setProgress(0);
      }
    }
  };

  if (!isOpen || !currentGroup || !currentMoment) return null;

  const currentImg = resolveImageUrl(currentMoment.imageUrl) || FALLBACK_POST_IMAGE;
  const hoursLeft = Math.max(1, Math.round((currentMoment.timeRemainingSeconds || 3600) / 3600));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center select-none bg-black/92 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Story Viewer"
      >
        {/* Navigation Buttons for Desktop */}
        {groupIdx > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            aria-label="Previous Story"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {(groupIdx < storyGroups.length - 1 || momentIdx < currentGroup.moments.length - 1) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white items-center justify-center backdrop-blur-md border border-white/10 transition-all cursor-pointer"
            aria-label="Next Story"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Central Story Card (Aspect 9:16) */}
        <motion.div
          key={currentGroup.user.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          drag
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.4}
          onDragEnd={handleDragEnd}
          className="relative w-full max-w-[420px] h-[92vh] max-h-[820px] rounded-lg overflow-hidden bg-[#181614] shadow-2xl flex flex-col touch-none border border-white/10"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          {/* Top Progress Bars (Segmented) */}
          <div className="absolute top-0 inset-x-0 z-30 pt-3 px-3 flex gap-1.5 pointer-events-none">
            {currentGroup.moments.map((m, idx) => {
              let fillPercent = 0;
              if (idx < momentIdx) fillPercent = 100;
              else if (idx === momentIdx) fillPercent = progress;

              return (
                <div
                  key={m.id || idx}
                  className="flex-1 h-[2.5px] rounded-full bg-white/25 overflow-hidden backdrop-blur-xs"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${fillPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Top Header Overlay */}
          <div className="absolute top-4 inset-x-0 z-30 px-3.5 pt-2 flex items-center justify-between text-white pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full p-[1.5px] bg-[#75624D] overflow-hidden shrink-0 shadow-sm">
                <img
                  src={resolveImageUrl(currentGroup.user.avatar) || FALLBACK_POST_IMAGE}
                  alt={currentGroup.user.name}
                  className="w-full h-full object-cover rounded-full bg-[#25231F]"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-sans font-bold text-xs text-white truncate max-w-[140px]">
                    {currentGroup.user.name}
                  </span>
                  <span className="text-[10px] text-white/60 font-mono">
                    · {hoursLeft}h left
                  </span>
                </div>
                <p className="text-[10px] text-white/70 font-sans truncate">
                  @{currentGroup.user.username}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Creator Analytics Pill for Own Story */}
              {isOwnStory && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAnalytics((prev) => !prev);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-[10px] font-sans font-medium text-white border border-white/20 transition-all cursor-pointer"
                  title="Story Insights"
                >
                  <Eye className="w-3 h-3 text-[#EAE3D8]" />
                  <span>{currentMoment.likesCount || 0} Likes</span>
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                aria-label="Close Story"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Interactive Tap Zones (Left 30% = Prev, Right 30% = Next) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-0 inset-y-16 w-[30%] z-20 cursor-pointer"
            aria-label="Previous slide"
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-0 inset-y-16 w-[30%] z-20 cursor-pointer"
            aria-label="Next slide"
          />

          {/* Main Story Image */}
          <div className="relative flex-1 w-full h-full bg-[#181614] overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.img
                key={currentMoment.id}
                src={currentImg}
                alt={currentMoment.caption || '24-Hour Moment'}
                initial={{ opacity: 0.85, scale: 1.01 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.85 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </AnimatePresence>

            {/* Gradient Overlays for Readability */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

            {/* Heart Burst Animation */}
            {likeBurst && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.3, opacity: 1 }}
                exit={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Bottom Content & Action Overlay */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 space-y-3 pointer-events-auto">
            {/* Occasion & Caption */}
            <div>
              {currentMoment.occasion && (
                <span className="inline-block px-2 py-0.5 rounded-[2px] bg-white/20 backdrop-blur-md text-[10px] font-sans font-semibold tracking-wider uppercase text-white mb-1.5 border border-white/20">
                  {currentMoment.occasion}
                </span>
              )}
              {currentMoment.caption && (
                <p className="text-xs sm:text-sm text-white/95 font-sans leading-relaxed drop-shadow-md">
                  {currentMoment.caption}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {!isOwnStory && (
                  <button
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-sans font-semibold transition-all cursor-pointer ${
                      currentMoment.isLiked
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${currentMoment.isLiked ? 'fill-white' : ''}`}
                    />
                    <span>{currentMoment.likesCount || 0}</span>
                  </button>
                )}

                <button
                  onClick={handleShare}
                  className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                  title="Share Moment"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Pause/Resume Indicator */}
              {isPaused && (
                <span className="text-[10px] font-mono text-white/70 uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                  Paused
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
