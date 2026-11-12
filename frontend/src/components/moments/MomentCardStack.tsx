import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OutfitMoment } from '../../types';
import { MomentCard } from './MomentCard';
import { MomentEmptyState } from './MomentEmptyState';

interface MomentCardStackProps {
  moments: OutfitMoment[];
  activeIndex: number;
  onSwipe: (direction: 'left' | 'right') => void;
  onClose?: () => void;
  onRefresh?: () => void;
  onShareMoment?: () => void;
  isRefreshing?: boolean;
}

export const MomentCardStack: React.FC<MomentCardStackProps> = ({
  moments,
  activeIndex,
  onSwipe,
  onClose,
  onRefresh,
  onShareMoment,
  isRefreshing = false,
}) => {
  const isTransitioningRef = useRef(false);

  // If feed is exhausted
  if (activeIndex >= moments.length || moments.length === 0) {
    return (
      <div className="w-full flex items-center justify-center p-4 min-h-[460px]">
        <MomentEmptyState
          onRefresh={onRefresh}
          onShareMoment={onShareMoment}
          isRefreshing={isRefreshing}
        />
      </div>
    );
  }

  const activeMoment = moments[activeIndex];
  const nextMoment = activeIndex + 1 < moments.length ? moments[activeIndex + 1] : null;
  const peekMoment = activeIndex + 2 < moments.length ? moments[activeIndex + 2] : null;

  const handleControlledSwipe = (direction: 'left' | 'right') => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    onSwipe(direction);
    // Release transition lock after exit animation completes
    setTimeout(() => {
      isTransitioningRef.current = false;
    }, 280);
  };

  return (
    <div className="relative w-full max-w-sm sm:max-w-md aspect-[3/4.4] sm:aspect-[3/4.2] mx-auto select-none">
      {/* 2nd Preview Card (Bottom) */}
      {peekMoment && (
        <div
          key={`peek-${peekMoment.id}`}
          className="absolute inset-0 select-none pointer-events-none rounded-[4px] overflow-hidden border border-[#DCD4CC]/60 dark:border-[#392F3E]/60 bg-[#29202B] transform scale-[0.92] translate-y-6 opacity-60 z-0"
        />
      )}

      {/* 1st Preview Card (Middle) */}
      {nextMoment && (
        <div
          key={`next-${nextMoment.id}`}
          className="absolute inset-0 select-none pointer-events-none rounded-[4px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] bg-[#29202B] transform scale-[0.96] translate-y-3 opacity-90 z-10 transition-transform duration-200"
        >
          <MomentCard
            moment={nextMoment}
            isActive={false}
            onSwipe={() => {}}
          />
        </div>
      )}

      {/* Active Card with AnimatePresence */}
      <AnimatePresence mode="popLayout">
        {activeMoment && (
          <motion.div
            key={activeMoment.id}
            initial={{ scale: 0.96, y: 10, opacity: 0.9 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={(custom) => ({
              x: custom === 'left' ? -550 : 550,
              opacity: 0,
              rotate: custom === 'left' ? -20 : 20,
              transition: { duration: 0.25, ease: 'easeOut' },
            })}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="absolute inset-0 z-20"
          >
            <MomentCard
              moment={activeMoment}
              isActive={true}
              onSwipe={handleControlledSwipe}
              onClose={onClose}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

