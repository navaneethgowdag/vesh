import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Heart, Bookmark, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/cn';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isHeart = toast.type === 'heart';
          const isSave = toast.type === 'save';
          const isSuccess = toast.type === 'success';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-soft-lg border text-sm backdrop-blur-md transition-all',
                isHeart && 'bg-cream-50/95 border-rose-200 text-charcoal-900',
                isSave && 'bg-cream-50/95 border-amber-200 text-charcoal-900',
                isSuccess && 'bg-charcoal-900 text-cream-50 border-charcoal-800',
                toast.type === 'info' && 'bg-cream-50/95 border-sand-300 text-charcoal-900'
              )}
            >
              {isHeart && <Heart className="w-4 h-4 text-rose-500 fill-rose-500 flex-shrink-0 animate-pulse" />}
              {isSave && <Bookmark className="w-4 h-4 text-cognac-600 fill-cognac-600 flex-shrink-0" />}
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-cognac-600 flex-shrink-0" />}

              <span className="flex-1 font-medium text-xs sm:text-sm">{toast.message}</span>

              <button
                onClick={() => dismissToast(toast.id)}
                className="opacity-60 hover:opacity-100 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

