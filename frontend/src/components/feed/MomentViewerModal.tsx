import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Clock } from 'lucide-react';
import { OutfitMoment } from '../../types';
import { Avatar } from '../ui/Avatar';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { PollWidget } from '../social/PollWidget';
import { momentImageCache } from '../../utils/momentImageCache';
import { backdropVariants, isReducedMotion } from '../../utils/animations';

interface MomentViewerModalProps {
  isOpen: boolean;
  moments: OutfitMoment[];
  initialIndex?: number;
  onClose: () => void;
  onLike?: (moment: OutfitMoment) => Promise<void> | void;
}

const MOMENT_DISPLAY_DURATION_MS = 5000;

export const isVideoMedia = (url?: string): boolean => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.startsWith('data:video/')
  );
};

export const MomentViewerModal: React.FC<MomentViewerModalProps> = ({
  isOpen,
  moments,
  initialIndex = 0,
  onClose,
  onLike,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikePending, setIsLikePending] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  const reducedMotion = isReducedMotion();

  // Drag physics motion values
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-220, 0, 220], [-15, 0, 15]);
  const dragOpacity = useTransform(dragX, [-220, -140, 0, 140, 220], [0.35, 0.9, 1, 0.9, 0.35]);

  // Next underneath card expands smoothly from scale 0.96 -> 1.0 as top card is pulled
  const nextScale = useTransform(dragX, [-220, 0, 220], [1, 0.96, 1]);
  const nextOpacity = useTransform(dragX, [-220, 0, 220], [1, 0.85, 1]);

  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);
  const isTabHiddenRef = useRef<boolean>(false);
  const holdStartTimeRef = useRef<number>(0);

  const currentMoment = moments[currentIndex] || null;
  const nextMoment = moments[currentIndex + 1] || null;
  const peekMoment = moments[currentIndex + 2] || null;

  // Extract all image URLs for sequence preloading
  const imageUrls = useMemo(() => {
    return moments.map((m) => resolveImageUrl(m.imageUrl) || FALLBACK_POST_IMAGE);
  }, [moments]);

  // Synchronize like status when active moment changes
  useEffect(() => {
    if (currentMoment) {
      setIsLiked(Boolean(currentMoment.isLiked));
      setLikeCount(currentMoment.likesCount || 0);
    }
  }, [currentMoment]);

  // Reset index when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      const targetIdx = Math.min(Math.max(0, initialIndex), Math.max(0, moments.length - 1));
      setCurrentIndex(targetIdx);
      elapsedBeforePauseRef.current = 0;
      setIsPaused(false);
      dragX.set(0);
      setExitDirection(null);
    }
  }, [isOpen, initialIndex, moments.length, dragX]);

  // Preload current, upcoming, and previous images in advance
  useEffect(() => {
    if (!isOpen || imageUrls.length === 0) return;
    momentImageCache.preloadSequence(imageUrls, currentIndex, 3);
  }, [isOpen, currentIndex, imageUrls]);

  // Forward Navigation
  const handleNext = useCallback(() => {
    if (currentIndex < moments.length - 1) {
      elapsedBeforePauseRef.current = 0;
      dragX.set(0);
      setExitDirection(null);
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, moments.length, onClose, dragX]);

  // Backward Navigation
  const handlePrev = useCallback(() => {
    // If user has been watching current photo for more than 1 second, restart this photo
    if (elapsedBeforePauseRef.current > 1000) {
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = performance.now();
      dragX.set(0);
      setExitDirection(null);
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = 'scaleX(0)';
      }
      return;
    }

    if (currentIndex > 0) {
      elapsedBeforePauseRef.current = 0;
      dragX.set(0);
      setExitDirection(null);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, dragX]);

  // Handle Drag Completion with physical swipe thresholds
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }) => {
    const swipeThreshold = 80;
    const velocityThreshold = 350;

    // Check vertical swipe down to close
    if (info.offset.y > 100 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      onClose();
      return;
    }

    // Check horizontal swipe
    if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      // Swiped left -> advance to next
      setExitDirection('left');
      setTimeout(() => {
        handleNext();
      }, 160);
    } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      // Swiped right -> go to previous if available
      if (currentIndex > 0) {
        setExitDirection('right');
        setTimeout(() => {
          handlePrev();
        }, 160);
      } else {
        // Snap back to center
        dragX.set(0);
      }
    } else {
      // Snap back to center
      dragX.set(0);
    }
  };

  // Tab visibility: pause story when user switches tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isTabHiddenRef.current = true;
        setIsPaused(true);
      } else {
        isTabHiddenRef.current = false;
        if (!isHoldingRef.current) {
          setIsPaused(false);
          startTimeRef.current = performance.now();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Story Progress Timer
  useEffect(() => {
    if (!isOpen || !currentMoment) return;

    if (progressBarRef.current) {
      progressBarRef.current.style.transform = 'scaleX(0)';
    }

    startTimeRef.current = performance.now();
    let isCancelled = false;

    const tick = (now: number) => {
      if (isCancelled) return;

      if (!isHoldingRef.current && !isTabHiddenRef.current && !isPaused) {
        const delta = now - startTimeRef.current;
        const totalElapsed = elapsedBeforePauseRef.current + delta;
        const progress = Math.min(1, totalElapsed / MOMENT_DISPLAY_DURATION_MS);

        if (progressBarRef.current) {
          progressBarRef.current.style.transform = `scaleX(${progress})`;
        }

        if (totalElapsed >= MOMENT_DISPLAY_DURATION_MS) {
          handleNext();
          return;
        }
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      isCancelled = true;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isOpen, currentIndex, currentMoment, isPaused, handleNext]);

  // Pointer interactions for holding/pausing and left/right tapping
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isHoldingRef.current = true;
    holdStartTimeRef.current = performance.now();
    setIsPaused(true);

    if (startTimeRef.current > 0) {
      const delta = performance.now() - startTimeRef.current;
      elapsedBeforePauseRef.current += delta;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    const holdDuration = performance.now() - holdStartTimeRef.current;

    // If quick tap (< 180ms), navigate left/right
    if (holdDuration < 180 && Math.abs(dragX.get()) < 10) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isLeft = clickX < rect.width * 0.35;
      if (isLeft) {
        handlePrev();
      } else {
        handleNext();
      }
    }

    if (!isTabHiddenRef.current) {
      setIsPaused(false);
      startTimeRef.current = performance.now();
    }
  };

  const handlePointerCancel = () => {
    isHoldingRef.current = false;
    if (!isTabHiddenRef.current) {
      setIsPaused(false);
      startTimeRef.current = performance.now();
    }
  };

  // Keyboard accessibility
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

  // Like with duplicate request prevention
  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentMoment || isLikePending) return;

    setIsLikePending(true);
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikeCount((c) => (nextState ? c + 1 : Math.max(0, c - 1)));

    try {
      await onLike?.(currentMoment);
    } catch {
      // Revert on error
      setIsLiked(!nextState);
      setLikeCount((c) => (!nextState ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setIsLikePending(false);
    }
  };

  const formatRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Expiring soon';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h left`;
    return `${mins}m left`;
  };

  if (!isOpen || !currentMoment) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none touch-none"
        role="dialog"
        aria-modal="true"
        aria-label="24-Hour Outfit Moment Story"
      >
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="relative w-full max-w-[420px] h-full sm:h-[90vh] sm:max-h-[820px] bg-zinc-950 sm:rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xl"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {/* Top Segmented Progress Bars (One per Moment) */}
          <div className="absolute top-0 inset-x-0 z-40 p-3 pt-3 flex items-center gap-1 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            {moments.map((m, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;

              return (
                <div
                  key={m.id || idx}
                  className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden"
                >
                  {isPast && <div className="w-full h-full bg-white rounded-full" />}
                  {isCurrent && (
                    <div
                      ref={progressBarRef}
                      className="w-full h-full bg-white rounded-full origin-left will-change-transform"
                      style={{
                        transform: 'scaleX(0)',
                        transition: isPaused ? 'none' : 'transform 0.05s linear',
                      }}
                    />
                  )}
                  {!isPast && !isCurrent && <div className="w-0 h-full bg-white rounded-full" />}
                </div>
              );
            })}
          </div>

          {/* Top Header Bar: Creator Info & Story Controls */}
          <div className="absolute top-6 inset-x-0 z-40 px-3.5 flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <Avatar
                src={currentMoment.user?.avatar}
                alt={currentMoment.user?.name || 'Creator'}
                size="sm"
                className="ring-2 ring-white/60"
              />
              <div className="leading-tight">
                <div className="text-xs font-bold text-white flex items-center gap-1">
                  <span>{currentMoment.user?.name || 'Creator'}</span>
                  <span className="text-[10px] text-zinc-300 font-normal">
                    @{currentMoment.user?.username || 'creator'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-300 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{formatRemaining(currentMoment.timeRemainingSeconds ?? currentMoment.secondsRemaining ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isPaused && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                  Paused
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Close Story"
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* STACKED IMAGE ARCHITECTURE: Layered under-cards already prepared in the DOM */}
          <div className="absolute inset-0 z-10 w-full h-full overflow-hidden">
            {/* Layer 3: Background Peek Card (if 2 ahead) */}
            {peekMoment && (
              <div
                className="absolute inset-0 w-full h-full transform transition-transform duration-300 pointer-events-none"
                style={{
                  transform: 'scale(0.92)',
                  opacity: 0.5,
                  zIndex: 1,
                }}
              >
                {isVideoMedia(peekMoment.imageUrl) ? (
                  <video
                    src={resolveImageUrl(peekMoment.imageUrl)}
                    muted
                    playsInline
                    className="w-full h-full object-cover filter blur-[1px]"
                  />
                ) : (
                  <img
                    src={resolveImageUrl(peekMoment.imageUrl) || FALLBACK_POST_IMAGE}
                    alt="Upcoming look"
                    className="w-full h-full object-cover filter blur-[1px]"
                    loading="eager"
                    decoding="async"
                  />
                )}
              </div>
            )}

            {/* Layer 2: Underneath Next Card (Preloaded and expands on top card drag) */}
            {nextMoment && (
              <motion.div
                style={{
                  scale: reducedMotion ? 1 : nextScale,
                  opacity: reducedMotion ? 1 : nextOpacity,
                  zIndex: 2,
                }}
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {isVideoMedia(nextMoment.imageUrl) ? (
                  <video
                    src={resolveImageUrl(nextMoment.imageUrl)}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={resolveImageUrl(nextMoment.imageUrl) || FALLBACK_POST_IMAGE}
                    alt="Next look"
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40" />
              </motion.div>
            )}

            {/* Layer 1: Top Active Card with Real-Time Drag Physics */}
            <motion.div
              key={currentMoment.id}
              style={{
                x: dragX,
                rotate: reducedMotion ? 0 : dragRotate,
                opacity: reducedMotion ? 1 : dragOpacity,
                zIndex: 3,
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.65}
              onDragEnd={handleDragEnd}
              animate={
                exitDirection === 'left'
                  ? { x: -450, opacity: 0, rotate: -18 }
                  : exitDirection === 'right'
                  ? { x: 450, opacity: 0, rotate: 18 }
                  : { x: 0, opacity: 1, rotate: 0 }
              }
              transition={{ type: 'spring', damping: 26, stiffness: 350 }}
              className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
            >
              {isVideoMedia(currentMoment.imageUrl) ? (
                <video
                  src={resolveImageUrl(currentMoment.imageUrl)}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <img
                  src={resolveImageUrl(currentMoment.imageUrl) || FALLBACK_POST_IMAGE}
                  alt="Outfit Moment"
                  className="w-full h-full object-cover pointer-events-none"
                  loading="eager"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/40 pointer-events-none" />
            </motion.div>
          </div>

          {/* Tap Navigation Overlays (Left 35% / Right 65%) */}
          <div className="absolute inset-0 z-20 flex pointer-events-none">
            <div
              className="w-[35%] h-full cursor-pointer pointer-events-auto"
              aria-label="Previous Moment"
              title="Previous"
            />
            <div
              className="w-[65%] h-full cursor-pointer pointer-events-auto"
              aria-label="Next Moment"
              title="Next"
            />
          </div>

          {/* Bottom Card Content: Caption, Attached Poll, Occasion Tag & Like Action */}
          <div className="absolute bottom-0 inset-x-0 z-40 p-4 pb-6 space-y-3 pointer-events-none">
            {(currentMoment.occasion || currentMoment.location) && (
              <div className="flex items-center gap-2 pointer-events-auto">
                {currentMoment.occasion && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-md">
                    {currentMoment.occasion}
                  </span>
                )}
                {currentMoment.location && (
                  <span className="text-[10px] text-zinc-300 backdrop-blur-md px-2 py-0.5 rounded-full bg-black/40">
                    📍 {currentMoment.location}
                  </span>
                )}
              </div>
            )}

            {currentMoment.poll && (
              <div className="pointer-events-auto max-w-sm">
                <PollWidget poll={currentMoment.poll} compact={true} />
              </div>
            )}

            {currentMoment.caption && (
              <p className="text-sm text-white font-medium drop-shadow-md leading-relaxed pointer-events-auto">
                {currentMoment.caption}
              </p>
            )}

            {/* Like Action Button with instant feedback & lock */}
            <div className="flex items-center justify-between pt-1 pointer-events-auto">
              <span className="text-[10px] text-zinc-300">
                {currentIndex + 1} of {moments.length}
              </span>

              <button
                type="button"
                onClick={handleLikeClick}
                disabled={isLikePending}
                aria-label={isLiked ? 'Unlike moment' : 'Like moment'}
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                <Heart
                  className={`w-4 h-4 ${isLiked ? 'fill-rose-500 text-rose-500 animate-pulse' : 'text-white'}`}
                />
                <span>{likeCount}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
