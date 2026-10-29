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
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-md shadow-md border text-sm backdrop-blur-md transition-all',
                isHeart && 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100',
                isSave && 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100',
                isSuccess && 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-800 dark:border-zinc-200',
                toast.type === 'info' && 'bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
              )}
            >
              {isHeart && <Heart className="w-4 h-4 text-rose-500 fill-rose-500 flex-shrink-0 animate-pulse" />}
              {isSave && <Bookmark className="w-4 h-4 text-zinc-900 dark:text-zinc-100 fill-zinc-900 dark:fill-zinc-100 flex-shrink-0" />}
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-zinc-900 dark:text-zinc-100 flex-shrink-0" />}

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

