import React from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { OutfitMoment } from '../../types';
import { MomentCreatorHeader } from './MomentCreatorHeader';
import { MomentImage } from './MomentImage';

interface MomentCardProps {
  moment: OutfitMoment;
  isActive: boolean;
  onSwipe: (direction: 'left' | 'right') => void;
  onClose?: () => void;
  className?: string;
}

export const MomentCard: React.FC<MomentCardProps> = ({
  moment,
  isActive,
  onSwipe,
  onClose,
  className = '',
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const skipOpacity = useTransform(x, [-20, -100], [0, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 90;
    const velocityThreshold = 400;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      onSwipe('right');
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      onSwipe('left');
    }
  };

  // Preview card (stacked beneath active card)
  if (!isActive) {
    return (
      <div
        className={`absolute inset-0 select-none pointer-events-none rounded-[4px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] bg-[#29202B] shadow-sm transform scale-[0.96] translate-y-3 opacity-90 transition-all duration-200 ${className}`}
        aria-hidden="true"
      >
        <MomentCreatorHeader moment={moment} />
        <MomentImage moment={moment} />
      </div>
    );
  }

  // Active draggable card
  return (
    <motion.div
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileTap={{ cursor: 'grabbing' }}
      className={`absolute inset-0 select-none cursor-grab rounded-[4px] overflow-hidden border border-[#DCD4CC] dark:border-[#392F3E] bg-[#29202B] shadow-lg flex flex-col z-20 touch-none ${className}`}
    >
      {/* Dynamic Visual Swipe Stamps */}
      <motion.div
        style={{ opacity: likeOpacity }}
        className="absolute top-18 right-6 z-30 pointer-events-none px-4 py-1 border-[3px] border-[#743C49] dark:border-[#D5A6A0] text-[#FFFFFF] bg-[#743C49]/90 dark:bg-[#743C49] rounded-[2px] font-mono text-sm font-bold uppercase tracking-widest rotate-12 shadow-sm"
      >
        APPRECIATE
      </motion.div>

      <motion.div
        style={{ opacity: skipOpacity }}
        className="absolute top-18 left-6 z-30 pointer-events-none px-4 py-1 border-[3px] border-[#6D7068] dark:border-[#DCD4CC] text-[#FFFFFF] bg-[#29202B]/90 dark:bg-[#29202B] rounded-[2px] font-mono text-sm font-bold uppercase tracking-widest -rotate-12 shadow-sm"
      >
        PASS
      </motion.div>

      {/* Header overlay */}
      <div className="absolute top-0 inset-x-0 z-10">
        <MomentCreatorHeader moment={moment} onClose={onClose} />
      </div>

      {/* Primary media view */}
      <div className="flex-1 w-full h-full">
        <MomentImage moment={moment} />
      </div>
    </motion.div>
  );
};
