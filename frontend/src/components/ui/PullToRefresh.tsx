import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  pullThreshold?: number; // Distance in px to trigger refresh (default: 64)
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
  pullThreshold = 64,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isPulling = useRef(false);
  const isHorizontalSwipe = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only initiate pull-to-refresh if window or container is scrolled to the top
      const scrollElement = document.scrollingElement || document.documentElement;
      const isAtTop = scrollElement.scrollTop <= 2 && window.scrollY <= 2;

      if (!isAtTop || isRefreshing) return;

      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isPulling.current = true;
      isHorizontalSwipe.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartY.current;
      const deltaX = currentX - touchStartX.current;

      // Detect if user is swiping horizontally (e.g. carousels or moments)
      if (!isHorizontalSwipe.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        isHorizontalSwipe.current = true;
        isPulling.current = false;
        setPullDistance(0);
        return;
      }

      if (isHorizontalSwipe.current) return;

      // Only handle downward pulls
      if (deltaY > 0) {
        // Quadratic dampening for luxurious tactile feel
        const dampenedDistance = Math.min(
          pullThreshold * 1.6,
          Math.pow(deltaY, 0.85) * 1.8
        );
        setPullDistance(dampenedDistance);

        // Prevent native overscroll bouncing while pulling
        if (deltaY > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling.current || isRefreshing) return;
      isPulling.current = false;

      if (pullDistance >= pullThreshold) {
        setIsRefreshing(true);
        setPullDistance(pullThreshold * 0.8);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

  const progress = Math.min(1, pullDistance / pullThreshold);

  return (
    <div ref={containerRef} className={`relative min-h-full ${className}`}>
      {/* Pull indicator spinner */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-center transition-all duration-200 z-30"
        style={{
          transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
          opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <Loader2
            className={`w-4 h-4 text-zinc-900 dark:text-zinc-100 ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
          <span className="text-[11px] font-medium tracking-wide text-zinc-800 dark:text-zinc-200">
            {isRefreshing
              ? 'Refreshing...'
              : pullDistance >= pullThreshold
              ? 'Release to refresh'
              : 'Pull down to refresh'}
          </span>
        </div>
      </div>

      {/* Main Content with smooth spring transform */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
          transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
};
