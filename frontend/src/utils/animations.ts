import { Variants, Transition } from 'framer-motion';

/**
 * TailorBird Reusable Animation System
 *
 * Implements smooth, polished, accessible animations with:
 * - Proper easing curves (cubic-bezier)
 * - Timing guidelines: small popups (150-220ms), standard dialogs (180-260ms), large modals (220-300ms)
 * - Strict prefers-reduced-motion support
 * - Micro-interaction button and card variants
 */

// Helper to detect prefers-reduced-motion in browser environments
export const isReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Standard Easing curves
export const EASINGS = {
  easeOut: [0.16, 1, 0.3, 1], // snappy yet smooth deceleration
  easeInOut: [0.4, 0, 0.2, 1], // balanced transitions
  springGentle: { type: 'spring', damping: 28, stiffness: 350 } as Transition,
  springSnappy: { type: 'spring', damping: 25, stiffness: 400 } as Transition,
  springBouncy: { type: 'spring', damping: 18, stiffness: 300 } as Transition,
};

// 1. Backdrop Animation Variants
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

// 2. Modal & Dialog Variants by Size/Timing
export const modalVariants = {
  // Small Pop-ups & Confirmation Dialogs (150 - 220 ms)
  small: {
    hidden: { opacity: 0, scale: 0.96, y: 8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.18, ease: EASINGS.easeOut },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      y: 6,
      transition: { duration: 0.15, ease: 'easeIn' },
    },
  } as Variants,

  // Standard Dialogs (180 - 260 ms)
  default: {
    hidden: { opacity: 0, scale: 0.96, y: 12 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.22, ease: EASINGS.easeOut },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      y: 10,
      transition: { duration: 0.18, ease: 'easeIn' },
    },
  } as Variants,

  // Larger Modal Panels (220 - 300 ms)
  large: {
    hidden: { opacity: 0, scale: 0.97, y: 16 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.26, ease: EASINGS.easeOut },
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      y: 12,
      transition: { duration: 0.2, ease: 'easeIn' },
    },
  } as Variants,
};

// 3. Dropdown Menu Variants
export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -6,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASINGS.easeOut },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// 4. Toast Notification Variants
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.92,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 25, stiffness: 350 },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.92,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

// 5. Tab Switching Variants
export const tabContentVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

// 6. Card & List Entrance Variants
export const cardEntranceVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: EASINGS.easeOut },
  },
};

// 7. Micro-Interactions: Button Press Feedback
export const buttonPressVariants = {
  tap: { scale: 0.98 },
  hover: { scale: 1.01 },
};

// 8. Drawer / Sidebar Variants
export const drawerVariants: Variants = {
  hidden: { x: '-100%', opacity: 0.5 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', damping: 30, stiffness: 320 },
  },
  exit: {
    x: '-100%',
    opacity: 0.5,
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};
