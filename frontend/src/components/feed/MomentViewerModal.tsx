import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { OutfitMoment } from '../../types';
import { Avatar } from '../ui/Avatar';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { PollWidget } from '../social/PollWidget';
import { perfMonitor } from '../../utils/performanceMonitor';

interface MomentViewerModalProps {
  isOpen: boolean;
  moments: OutfitMoment[];
  initialIndex?: number;
  onClose: () => void;
  onLike?: (moment: OutfitMoment) => Promise<void> | void;
}

const MOMENT_DISPLAY_DURATION_MS = 5000;

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
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);
  const isTabHiddenRef = useRef<boolean>(false);

  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  const currentMoment = moments[currentIndex] || null;

  useEffect(() => {
    if (currentMoment) {
      setIsLiked(Boolean(currentMoment.isLiked));
      setLikeCount(currentMoment.likesCount || 0);
    }
  }, [currentMoment]);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(initialIndex, Math.max(0, moments.length - 1)));
      elapsedBeforePauseRef.current = 0;
      setIsPaused(false);
    }
  }, [isOpen, initialIndex, moments.length]);

  useEffect(() => {
    if (!isOpen) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex < moments.length) {
      const nextUrl = resolveImageUrl(moments[nextIndex].imageUrl);
      if (nextUrl) {
        const img = new Image();
        img.src = nextUrl;
      }
    }
  }, [isOpen, currentIndex, moments]);

  const handleNext = useCallback(() => {
    if (currentIndex < moments.length - 1) {
      setSlideDirection('next');
      elapsedBeforePauseRef.current = 0;
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, moments.length, onClose]);

  const handlePrev = useCallback(() => {
    if (elapsedBeforePauseRef.current > 1000) {
      elapsedBeforePauseRef.current = 0;
      startTimeRef.current = performance.now();
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = 'scaleX(0)';
      }
      return;
    }

    if (currentIndex > 0) {
      setSlideDirection('prev');
      elapsedBeforePauseRef.current = 0;
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

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
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !currentMoment) return;

    if (progressBarRef.current) {
      progressBarRef.current.style.transform = 'scaleX(0)';
    }

    startTimeRef.current = performance.now();
    let isCancelled = false;

    const stopFpsTracking = perfMonitor.trackFps('MomentViewerProgress', MOMENT_DISPLAY_DURATION_MS);

    const tick = (now: number) => {
      if (isCancelled) return;

      if (!isHoldingRef.current && !isTabHiddenRef.current) {
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
      stopFpsTracking();
    };
  }, [isOpen, currentIndex, currentMoment, handleNext]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isHoldingRef.current = true;
    setIsPaused(true);

    if (startTimeRef.current > 0) {
      const delta = performance.now() - startTimeRef.current;
      elapsedBeforePauseRef.current += delta;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    const holdDuration = performance.now() - startTimeRef.current;
    if (holdDuration < 180) {
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

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    if (deltaTime < 350) {
      if (deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX)) {
        onClose();
        return;
      }
      if (deltaX < -60) {
        handleNext();
        return;
      }
      if (deltaX > 60) {
        handlePrev();
        return;
      }
    }
  };

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
        if (isHoldingRef.current) {
          isHoldingRef.current = false;
          setIsPaused(false);
          startTimeRef.current = performance.now();
        } else {
          isHoldingRef.current = true;
          setIsPaused(true);
          const delta = performance.now() - startTimeRef.current;
          elapsedBeforePauseRef.current += delta;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentMoment) return;

    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikeCount((c) => (nextState ? c + 1 : Math.max(0, c - 1)));

    try {
      await onLike?.(currentMoment);
    } catch {
      setIsLiked(!nextState);
      setLikeCount((c) => (!nextState ? c + 1 : Math.max(0, c - 1)));
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none touch-none">
        <div
          className="relative w-full max-w-[420px] h-full sm:h-[90vh] sm:max-h-[820px] bg-zinc-950 sm:rounded-2xl overflow-hidden flex flex-col justify-between shadow-2xl"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {/* Top Segmented Progress Bars */}
          <div className="absolute top-0 inset-x-0 z-30 p-3 pt-3 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent">
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

          {/* Top Header Bar */}
          <div className="absolute top-6 inset-x-0 z-30 px-3.5 flex items-center justify-between text-white">
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
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                aria-label="Close Story"
                className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slide Transition Animated Card Content */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentMoment.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0.7,
                      x: slideDirection === 'next' ? 60 : -60,
                    }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0.7,
                      x: slideDirection === 'next' ? -60 : 60,
                    }
              }
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="absolute inset-0 z-10 w-full h-full"
            >
              <img
                src={resolveImageUrl(currentMoment.imageUrl) || FALLBACK_POST_IMAGE}
                alt="Outfit Moment"
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />
            </motion.div>
          </AnimatePresence>

          {/* Tap Zones for Tap-Left / Tap-Right navigation */}
          <div className="absolute inset-0 z-20 flex">
            <div
              className="w-[35%] h-full cursor-pointer"
              aria-label="Previous Moment"
              title="Previous"
            />
            <div
              className="w-[65%] h-full cursor-pointer"
              aria-label="Next Moment"
              title="Next"
            />
          </div>

          {/* Bottom Overlay: Caption, Poll, Occasion Tag & Actions */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-6 space-y-3 pointer-events-none">
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

            <div className="flex items-center justify-between pt-1 pointer-events-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLikeClick}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold transition-all ${
                    isLiked
                      ? 'bg-rose-500 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                  <span>{likeCount}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                <span>{currentIndex + 1}</span>
                <span>/</span>
                <span>{moments.length}</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Chevrons */}
          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous Moment"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {currentIndex < moments.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next Moment"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-40 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-sm transition-transform active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
};
