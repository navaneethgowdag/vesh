import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OutfitMoment } from '../../types';
import { MomentsFeed } from '../moments/MomentsFeed';
import { backdropVariants } from '../../utils/animations';

interface MomentViewerModalProps {
  isOpen: boolean;
  moments: OutfitMoment[];
  initialIndex?: number;
  onClose: () => void;
  onLike?: (moment: OutfitMoment) => Promise<void> | void;
  onShareMoment?: () => void;
}

export const MomentViewerModal: React.FC<MomentViewerModalProps> = ({
  isOpen,
  moments,
  initialIndex = 0,
  onClose,
  onShareMoment,
}) => {
  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none"
        role="dialog"
        aria-modal="true"
        aria-label="24-Hour Moments Swipe Experience"
      >
        {/* Backdrop */}
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
          aria-hidden="true"
        />

        {/* Modal Container */}
        <div
          className="relative z-10 w-full max-w-md my-auto flex flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <MomentsFeed
            initialMoments={moments}
            initialIndex={initialIndex}
            onClose={onClose}
            onShareMoment={onShareMoment}
          />
        </div>
      </div>
    </AnimatePresence>
  );
};
