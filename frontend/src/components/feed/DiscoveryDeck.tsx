import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { X, Heart, Sparkles, Compass, RotateCcw, Tag } from 'lucide-react';
import { Post } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

interface DiscoveryDeckProps {
  posts: Post[];
  onLike: (post: Post) => Promise<void>;
  onSkip?: (post: Post) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const DiscoveryDeck: React.FC<DiscoveryDeckProps> = ({
  posts,
  onLike,
  onSkip,
  onRefresh,
  isLoading = false,
}) => {
  const navigate = useNavigate();

  // Track session skipped or swiped IDs so they don't repeat in this session
  const [sessionSwipedIds, setSessionSwipedIds] = useState<Set<string>>(new Set());
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);

  // Filter posts to only unswiped items
  const eligiblePosts = posts.filter((p) => !sessionSwipedIds.has(p.id));
  const currentPost = eligiblePosts[0] || null;
  const nextPost1 = eligiblePosts[1] || null;
  const nextPost2 = eligiblePosts[2] || null;

  // Drag physics values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  const opacity = useTransform(x, [-250, -180, 0, 180, 250], [0.3, 0.9, 1, 0.9, 0.3]);
  const likeBadgeOpacity = useTransform(x, [40, 120], [0, 1]);
  const skipBadgeOpacity = useTransform(x, [-40, -120], [0, 1]);

  // Bounded prefetch of next 1-2 images
  useEffect(() => {
    if (nextPost1?.image) {
      const img1 = new window.Image();
      img1.src = nextPost1.image;
    }
    if (nextPost2?.image) {
      const img2 = new window.Image();
      img2.src = nextPost2.image;
    }
  }, [nextPost1, nextPost2]);

  // Action handlers
  const handleSwipeAction = useCallback(
    async (direction: 'left' | 'right') => {
      if (!currentPost) return;

      const swipedPost = currentPost;
      setExitDirection(direction);

      // Add to session swiped IDs immediately for snappy responsive feel
      setSessionSwipedIds((prev) => new Set(prev).add(swipedPost.id));

      if (direction === 'right') {
        try {
          await onLike(swipedPost);
        } catch {
          // If error occurs, roll back swipe
          setSessionSwipedIds((prev) => {
            const next = new Set(prev);
            next.delete(swipedPost.id);
            return next;
          });
        }
      } else {
        onSkip?.(swipedPost);
      }

      // Reset motion state
      setTimeout(() => {
        x.set(0);
        setExitDirection(null);
      }, 300);
    },
    [currentPost, onLike, onSkip, x]
  );

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 90;
    if (info.offset.x > swipeThreshold || info.velocity.x > 500) {
      handleSwipeAction('right');
    } else if (info.offset.x < -swipeThreshold || info.velocity.x < -500) {
      handleSwipeAction('left');
    } else {
      x.set(0);
    }
  };

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipeAction('right');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipeAction('left');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipeAction]);

  const handleResetSession = () => {
    setSessionSwipedIds(new Set());
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-80 sm:w-96 aspect-[3/4] rounded-3xl bg-sand-100/80 animate-pulse border border-sand-200/90 flex flex-col items-center justify-center p-6 text-center">
          <Sparkles className="w-8 h-8 text-cognac-600 animate-spin mb-3" />
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700">
            Curating Discovery Deck...
          </p>
          <p className="text-[11px] text-charcoal-400 mt-1 max-w-xs">
            Gathering exceptional looks from style curators tailored to your aesthetic.
          </p>
        </div>
      </div>
    );
  }

  // Empty state when all eligible looks have been swiped
  if (!currentPost) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-full max-w-md bg-cream-50/90 border border-sand-200/90 rounded-3xl p-8 sm:p-10 shadow-soft text-center">
          <div className="w-16 h-16 rounded-full bg-sand-100/90 flex items-center justify-center mx-auto mb-5 text-cognac-700 shadow-soft-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-charcoal-900 mb-2">
            You've Explored All Looks
          </h3>
          <p className="text-xs sm:text-sm text-charcoal-500 leading-relaxed mb-6 max-w-xs mx-auto">
            You're up to date on today's community rotation. Refresh your discovery deck or explore creators to find new inspiration.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetSession}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Rewind Deck
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/explore')}
              icon={<Compass className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Explore Creators
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
        {nextPost2 && (
          <div
            className="absolute inset-0 rounded-3xl bg-sand-200/60 border border-sand-300/40 shadow-soft overflow-hidden transition-all duration-300"
            style={{
              transform: 'scale(0.88) translateY(32px)',
              zIndex: 1,
            }}
          >
            <img
              src={nextPost2.image}
              alt={nextPost2.caption || 'Upcoming look'}
              className="w-full h-full object-cover opacity-50 filter blur-[1px]"
              loading="lazy"
            />
          </div>
        )}

        {/* Background Card 1 (Middle layer) */}
        {nextPost1 && (
          <div
            className="absolute inset-0 rounded-3xl bg-sand-100 border border-sand-200/80 shadow-soft overflow-hidden transition-all duration-300"
            style={{
              transform: 'scale(0.94) translateY(16px)',
              zIndex: 2,
            }}
          >
            <img
              src={nextPost1.image}
              alt={nextPost1.caption || 'Next look'}
              className="w-full h-full object-cover opacity-80"
              loading="lazy"
            />
          </div>
        )}

        {/* Top Active Interactive Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPost.id}
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
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden bg-charcoal-900 border border-sand-200/90 shadow-soft-xl flex flex-col justify-end"
          >
            {/* Visual Focus: Full Post Image */}
            <img
              src={currentPost.image}
              alt={currentPost.caption || 'Outfit discovery'}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              fetchPriority="high"
            />

            {/* Subtle Gradient Overlays for Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/30 to-transparent pointer-events-none" />

            {/* Visual Drag Indicator Badges */}
            <motion.div
              style={{ opacity: likeBadgeOpacity }}
              className="absolute top-6 right-6 px-4 py-1.5 rounded-full border-2 border-cognac-400 bg-cognac-900/80 text-cream-50 font-serif font-bold text-sm tracking-widest uppercase shadow-soft pointer-events-none rotate-12"
            >
              LIKE
            </motion.div>

            <motion.div
              style={{ opacity: skipBadgeOpacity }}
              className="absolute top-6 left-6 px-4 py-1.5 rounded-full border-2 border-sand-300 bg-charcoal-900/80 text-sand-200 font-serif font-bold text-sm tracking-widest uppercase shadow-soft pointer-events-none -rotate-12"
            >
              SKIP
            </motion.div>

            {/* Bottom Card Information */}
            <div className="relative z-20 p-5 sm:p-6 text-cream-50 pointer-events-auto">
              {/* Creator Header */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${currentPost.user.username}`);
                }}
                className="flex items-center gap-3 cursor-pointer group mb-2.5"
              >
                <Avatar
                  src={currentPost.user.avatar}
                  alt={currentPost.user.name}
                  size="md"
                  isVerified={currentPost.user.isVerified}
                />
                <div>
                  <p className="font-bold text-sm sm:text-base text-cream-50 group-hover:text-cognac-300 transition-colors leading-tight">
                    {currentPost.user.name}
                  </p>
                  <p className="text-[11px] text-cream-300/80">
                    @{currentPost.user.username} • {currentPost.createdAt}
                  </p>
                </div>
              </div>

              {/* Caption */}
              {currentPost.caption && (
                <p className="text-xs sm:text-sm text-cream-100 font-light leading-relaxed line-clamp-2 mb-3">
                  {currentPost.caption}
                </p>
              )}

              {/* Tags & Occasion Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {currentPost.occasion && (
                  <span className="text-[10px] uppercase font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-cream-50/15 backdrop-blur-md text-cream-100 border border-white/10">
                    {currentPost.occasion}
                  </span>
                )}
                {currentPost.tags?.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-charcoal-900/60 backdrop-blur-sm text-cream-200 border border-white/10"
                  >
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Control Actions Strictly Below the Card */}
      <div className="flex items-center justify-center gap-8 mt-6 sm:mt-8">
        {/* Skip Button (Neutral Light Circular Button with X Icon) */}
        <button
          onClick={() => handleSwipeAction('left')}
          title="Skip Look (Left Arrow)"
          aria-label="Skip Look"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-cream-50 hover:bg-sand-100 text-charcoal-700 border border-sand-300/80 shadow-soft hover:shadow-soft-md active:scale-95 transition-all duration-200 flex items-center justify-center group"
        >
          <X className="w-6 h-6 sm:w-7 sm:h-7 text-charcoal-600 group-hover:text-charcoal-900 transition-transform group-hover:scale-110" />
        </button>

        {/* Like Button (Prominent Brown Circular Button with Heart Icon) */}
        <button
          onClick={() => handleSwipeAction('right')}
          title="Like Look (Right Arrow)"
          aria-label="Like Look"
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-cognac-700 hover:bg-cognac-800 text-white shadow-soft-lg hover:shadow-soft-xl active:scale-95 transition-all duration-200 flex items-center justify-center group"
        >
          <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-current group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Keyboard Hint */}
      <p className="text-[11px] text-charcoal-400 mt-4 tracking-wide font-medium hidden sm:block">
        Tip: Swipe or press <kbd className="px-1.5 py-0.5 rounded bg-sand-200 text-charcoal-700 text-[10px] font-mono">←</kbd> to skip or <kbd className="px-1.5 py-0.5 rounded bg-sand-200 text-charcoal-700 text-[10px] font-mono">→</kbd> to like
      </p>
    </div>
  );
};

