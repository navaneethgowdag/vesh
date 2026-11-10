import React, { useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { backdropVariants, modalVariants, isReducedMotion } from '../../utils/animations';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'small' | 'default' | 'large';
  showCloseButton?: boolean;
}

const widthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth,
  size,
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reducedMotion = isReducedMotion();

  // Normalize size or maxWidth
  const resolvedSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl' =
    size === 'small'
      ? 'sm'
      : size === 'default'
      ? 'md'
      : size === 'large'
      ? 'lg'
      : (size as any) || maxWidth || 'lg';

  // Select variant set based on modal size
  const variantSet =
    resolvedSize === 'sm'
      ? modalVariants.small
      : resolvedSize === 'xl' || resolvedSize === '2xl'
      ? modalVariants.large
      : modalVariants.default;

  const activeVariants = reducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.12 } },
      }
    : variantSet;

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element or modal container
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const focusable = modalRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable) {
            focusable.focus();
          } else {
            modalRef.current.focus();
          }
        }
      });

      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
        if (previousFocusRef.current) {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Backdrop */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal Card */}
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            variants={activeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              'relative w-full bg-white dark:bg-[#1C201D] rounded-2xl border border-[#E2DDD3] dark:border-[#2D342F] z-10 overflow-hidden my-auto max-h-[92vh] flex flex-col shadow-2xl focus:outline-none',
              widthMap[resolvedSize]
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-6 pb-4 border-b border-[#E2DDD3] dark:border-[#2D342F]">
                <div>
                  {title && (
                    <h3
                      id="modal-title"
                      className="text-xl sm:text-2xl font-bold text-[#202321] dark:text-[#F8F6F1] font-serif tracking-tight"
                    >
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-[#777C75] dark:text-[#A3ABA0] mt-1">{subtitle}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#777C75] hover:text-[#202321] dark:text-[#A3ABA0] dark:hover:text-[#F8F6F1] hover:bg-[#F1EEE7] dark:hover:bg-[#252A26] transition-colors ml-auto focus:outline-none focus:ring-2 focus:ring-[#727D69] cursor-pointer"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content Body */}
            <div className="p-6 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
