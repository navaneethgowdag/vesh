import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Sparkles, Compass, RotateCcw, Clock, PlusCircle } from 'lucide-react';
import { OutfitMoment } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';

interface DiscoveryDeckProps {
  moments: OutfitMoment[];
  onLike: (moment: OutfitMoment) => Promise<void>;
  onSkip?: (moment: OutfitMoment) => Promise<void> | void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const DiscoveryDeck: React.FC<DiscoveryDeckProps> = ({
  moments,
  onLike,
  onSkip,
  onRefresh,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  // Track session skipped or swiped IDs so they don't repeat in this session
  const [sessionSwipedIds, setSessionSwipedIds] = useState<Set<string>>(new Set());
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  // Filter moments to only unswiped items
  const eligibleMoments = moments.filter((m) => !sessionSwipedIds.has(m.id));
  const currentMoment = eligibleMoments[0] || null;
  const nextMoment1 = eligibleMoments[1] || null;
  const nextMoment2 = eligibleMoments[2] || null;

  // Drag physics values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  const opacity = useTransform(x, [-250, -180, 0, 180, 250], [0.3, 0.9, 1, 0.9, 0.3]);
  const likeBadgeOpacity = useTransform(x, [40, 120], [0, 1]);
  const skipBadgeOpacity = useTransform(x, [-40, -120], [0, 1]);

  // Bounded prefetch of next 1-2 images
  useEffect(() => {
    if (nextMoment1?.imageUrl) {
      const img1 = new window.Image();
      img1.src = nextMoment1.imageUrl;
    }
    if (nextMoment2?.imageUrl) {
      const img2 = new window.Image();
      img2.src = nextMoment2.imageUrl;
    }
  }, [nextMoment1, nextMoment2]);

  // Format time remaining for 24-hour expiration
  const formatTimeRemaining = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Expiring soon';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  // Action handlers
  const handleSwipeAction = useCallback(
    async (direction: 'left' | 'right') => {
      if (!currentMoment) return;

      const swiped = currentMoment;
      setExitDirection(direction);

      // Add to session swiped IDs immediately for snappy responsive feel
      setSessionSwipedIds((prev) => new Set(prev).add(swiped.id));

      if (direction === 'right') {
        try {
          await onLike(swiped);
        } catch {
          // If error occurs, roll back swipe
          setSessionSwipedIds((prev) => {
            const next = new Set(prev);
            next.delete(swiped.id);
            return next;
          });
        }
      } else {
        try {
          await onSkip?.(swiped);
        } catch {
          // Skip silently ignores or logs
        }
      }

      // Reset motion state
      setTimeout(() => {
        x.set(0);
        setExitDirection(null);
      }, 300);
    },
    [currentMoment, onLike, onSkip, x]
  );

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 100;
    const velocityThreshold = 400;

    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      handleSwipeAction('right');
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      handleSwipeAction('left');
    }
  };

  const handleResetDeck = () => {
    setSessionSwipedIds(new Set());
    onRefresh?.();
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-[380px] sm:max-w-[420px] aspect-[3/4] sm:aspect-[4/5] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse border border-zinc-200 dark:border-zinc-700 flex flex-col justify-end p-6">
          <div className="space-y-3">
            <div className="h-4 w-1/3 bg-zinc-300 dark:bg-zinc-700 rounded" />
            <div className="h-6 w-3/4 bg-zinc-300 dark:bg-zinc-700 rounded" />
            <div className="h-4 w-1/2 bg-zinc-300 dark:bg-zinc-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Empty State: All Moments Swiped or Zero Moments
  if (!currentMoment) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8">
          <div className="w-14 h-14 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            You're All Caught Up
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-xs mx-auto leading-relaxed">
            {moments.length > 0
              ? 'You have reviewed all available moments from creators you follow in this session.'
              : 'Follow accounts that share 24-hour moments, or post today’s outfit to get started.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {moments.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetDeck}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Review Moments Again
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/explore')}
                icon={<Compass className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Find Creators
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/create?type=moment')}
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Post a Moment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-4 select-none">
      {/* Stacked Cards Container */}
      <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-[3/4] sm:aspect-[4/5] mx-auto">
        {/* Background Card 2 (Bottom layer) */}
        {nextMoment2 && (
          <div
            className="absolute inset-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-300"
            style={{
              transform: 'scale(0.92) translateY(24px)',
              zIndex: 1,
            }}
          >
            <img
              src={resolveImageUrl(nextMoment2.imageUrl) || FALLBACK_POST_IMAGE}
              alt="Upcoming look"
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                  e.currentTarget.src = FALLBACK_POST_IMAGE;
                }
              }}
              className="w-full h-full object-cover opacity-50 filter blur-[1px]"
              loading="lazy"
            />
          </div>
        )}

        {/* Background Card 1 (Middle layer) */}
        {nextMoment1 && (
          <div
            className="absolute inset-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-300"
            style={{
              transform: 'scale(0.96) translateY(12px)',
              zIndex: 2,
            }}
          >
            <img
              src={resolveImageUrl(nextMoment1.imageUrl) || FALLBACK_POST_IMAGE}
              alt="Next look"
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                  e.currentTarget.src = FALLBACK_POST_IMAGE;
                }
              }}
              className="w-full h-full object-cover opacity-80"
              loading="lazy"
            />
          </div>
        )}

        {/* Top Active Interactive Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMoment.id}
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.75}
            onDragEnd={handleDragEnd}
            animate={
              exitDirection === 'right'
                ? { x: 500, opacity: 0, rotate: 25 }
                : exitDirection === 'left'
                ? { x: -500, opacity: 0, rotate: -25 }
                : { x: 0, opacity: 1, rotate: 0 }
            }
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing rounded-lg overflow-hidden bg-zinc-950 border border-zinc-200 dark:border-zinc-700 flex flex-col justify-end"
          >
            {/* Visual Focus: Full Outfit Image */}
            <img
              src={resolveImageUrl(currentMoment.imageUrl) || FALLBACK_POST_IMAGE}
              alt={currentMoment.caption || 'Outfit discovery'}
              onError={(e) => {
                if (e.currentTarget.src !== FALLBACK_POST_IMAGE) {
                  e.currentTarget.src = FALLBACK_POST_IMAGE;
                }
              }}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              fetchPriority="high"
            />

            {/* Gradient Overlays for Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

            {/* Top Expiration Badge */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 rounded bg-black/70 backdrop-blur-md border border-white/20 text-white text-xs font-medium">
              <Clock className="w-3 h-3 text-zinc-300" />
              <span>{formatTimeRemaining(currentMoment.timeRemainingSeconds ?? currentMoment.secondsRemaining ?? 0)}</span>
            </div>

            {/* Swipe Indicators */}
            <motion.div
              style={{ opacity: likeBadgeOpacity }}
              className="absolute top-6 right-6 z-30 pointer-events-none px-4 py-1.5 border-2 border-emerald-400 bg-emerald-500/30 rounded text-emerald-300 font-bold uppercase tracking-wider text-sm rotate-12"
            >
              Love it
            </motion.div>

            <motion.div
              style={{ opacity: skipBadgeOpacity }}
              className="absolute top-6 left-6 z-30 pointer-events-none px-4 py-1.5 border-2 border-rose-400 bg-rose-500/30 rounded text-rose-300 font-bold uppercase tracking-wider text-sm -rotate-12"
            >
              Pass
            </motion.div>

            {/* Bottom Card Content: Creator Info, Caption, Occasion */}
            <div className="relative z-20 p-5 space-y-2 pointer-events-auto">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${currentMoment.user.username}`);
                }}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <Avatar
                  src={currentMoment.user.avatar}
                  alt={currentMoment.user.name}
                  size="md"
                  isVerified={currentMoment.user.isVerified}
                />
                <div>
                  <h4 className="text-white text-sm font-bold group-hover:underline">
                    {currentMoment.user.name}
                  </h4>
                  <p className="text-xs text-zinc-300">@{currentMoment.user.username}</p>
                </div>
              </div>

              {currentMoment.caption && (
                <p className="text-white text-sm line-clamp-2 leading-relaxed">
                  {currentMoment.caption}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {currentMoment.occasion && (
                  <span className="text-xs uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-white/20 text-white border border-white/20">
                    {currentMoment.occasion}
                  </span>
                )}
                {currentMoment.weatherSummary && (
                  <span className="text-xs px-2 py-0.5 rounded bg-black/50 text-zinc-300 border border-white/10">
                    {currentMoment.weatherSummary}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Manual Action Buttons (Pass & Like) */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          type="button"
          onClick={() => handleSwipeAction('left')}
          title="Pass moment"
          aria-label="Pass moment"
          className="w-14 h-14 min-w-[44px] min-h-[44px] rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 transition-all flex items-center justify-center active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => handleSwipeAction('right')}
          title="Love moment"
          aria-label="Love moment"
          className="w-14 h-14 min-w-[44px] min-h-[44px] rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center justify-center active:scale-95"
        >
          <Heart className="w-6 h-6 fill-current" />
        </button>
      </div>
    </div>
  );
};
