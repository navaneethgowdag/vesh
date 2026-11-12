import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { OutfitMoment } from '../../types';
import { api } from '../../services/api';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { momentImageCache } from '../../utils/momentImageCache';
import { MomentCardStack } from './MomentCardStack';
import { MomentActions } from './MomentActions';
import { Loader2 } from 'lucide-react';

interface MomentsFeedProps {
  initialMoments?: OutfitMoment[];
  initialIndex?: number;
  onClose?: () => void;
  onShareMoment?: () => void;
  className?: string;
}

export const MomentsFeed: React.FC<MomentsFeedProps> = ({
  initialMoments,
  initialIndex = 0,
  onClose,
  onShareMoment,
  className = '',
}) => {
  const [moments, setMoments] = useState<OutfitMoment[]>(initialMoments || []);
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [isLoading, setIsLoading] = useState<boolean>(!initialMoments || initialMoments.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // Prevent multiple rapid clicks from triggering duplicate network requests
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  // Fetch feed once on mount if initial moments were not provided
  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const feed = await api.moments.listFeed(30);
      setMoments(feed || []);
      setActiveIndex(0);
    } catch (err) {
      console.warn('Failed to load moments feed:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialMoments || initialMoments.length === 0) {
      fetchFeed();
    }
  }, [fetchFeed, initialMoments]);

  // Extract URLs for image preloading
  const imageUrls = useMemo(() => {
    return moments.map((m) => resolveImageUrl(m.imageUrl) || FALLBACK_POST_IMAGE);
  }, [moments]);

  // Preload current and next 2 upcoming images automatically
  useEffect(() => {
    if (imageUrls.length === 0) return;
    momentImageCache.preloadSequence(imageUrls, activeIndex, 3);
  }, [imageUrls, activeIndex]);

  const activeMoment = moments[activeIndex] || null;
  const isCurrentLiked = activeMoment ? likedIds.has(activeMoment.id) || Boolean(activeMoment.isLiked) : false;

  // Handle Swipe / Tap Like (Right)
  const handleLike = useCallback(async () => {
    if (!activeMoment) return;
    const momentId = activeMoment.id;

    if (pendingRequestsRef.current.has(momentId)) return;
    pendingRequestsRef.current.add(momentId);

    // Optimistically update liked IDs and advance
    setLikedIds((prev) => new Set(prev).add(momentId));
    setActiveIndex((prev) => prev + 1);

    // Persist to backend asynchronously
    try {
      await api.moments.like(momentId);
    } catch (err) {
      console.warn(`Failed to persist like for moment ${momentId}:`, err);
    } finally {
      pendingRequestsRef.current.delete(momentId);
    }
  }, [activeMoment]);

  // Handle Swipe / Tap Skip (Left)
  const handleSkip = useCallback(async () => {
    if (!activeMoment) return;
    const momentId = activeMoment.id;

    if (pendingRequestsRef.current.has(momentId)) return;
    pendingRequestsRef.current.add(momentId);

    // Optimistically mark skipped and advance
    setSkippedIds((prev) => new Set(prev).add(momentId));
    setActiveIndex((prev) => prev + 1);

    // Persist skip to backend asynchronously
    try {
      await api.moments.skip(momentId);
    } catch (err) {
      console.warn(`Failed to persist skip for moment ${momentId}:`, err);
    } finally {
      pendingRequestsRef.current.delete(momentId);
    }
  }, [activeMoment]);

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'right') {
      handleLike();
    } else {
      handleSkip();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center text-[#6D7068] dark:text-[#A89E9B]">
        <Loader2 className="w-8 h-8 animate-spin text-[#743C49] dark:text-[#D5A6A0] mb-3" />
        <p className="font-mono text-xs uppercase tracking-wider">Curating 24-Hour Moments...</p>
      </div>
    );
  }

  const isFeedExhausted = activeIndex >= moments.length || moments.length === 0;

  return (
    <div className={`flex flex-col items-center justify-center w-full max-w-lg mx-auto ${className}`}>
      {/* Central Card Stack */}
      <div className="w-full flex-1 flex items-center justify-center">
        <MomentCardStack
          moments={moments}
          activeIndex={activeIndex}
          onSwipe={handleSwipe}
          onClose={onClose}
          onRefresh={() => fetchFeed(true)}
          onShareMoment={onShareMoment}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Floating Action Controls */}
      {!isFeedExhausted && (
        <div className="w-full pt-6 pb-2 flex justify-center">
          <MomentActions
            onLike={handleLike}
            onSkip={handleSkip}
            isLiked={isCurrentLiked}
            likesCount={activeMoment?.likesCount || 0}
          />
        </div>
      )}
    </div>
  );
};
