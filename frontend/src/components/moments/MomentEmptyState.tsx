import React from 'react';
import { Sparkles, RefreshCw, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface MomentEmptyStateProps {
  onRefresh?: () => void;
  onShareMoment?: () => void;
  isRefreshing?: boolean;
}

export const MomentEmptyState: React.FC<MomentEmptyStateProps> = ({
  onRefresh,
  onShareMoment,
  isRefreshing = false,
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-8 text-center bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] rounded-[4px] shadow-xs select-none">
      <div className="w-12 h-12 mx-auto mb-4 rounded-[3px] bg-[#F3EEE8] dark:bg-[#1A151C] border border-[#DCD4CC] dark:border-[#392F3E] flex items-center justify-center text-[#743C49] dark:text-[#D5A6A0]">
        <Sparkles className="w-6 h-6" />
      </div>

      <h3 className="font-serif text-2xl font-bold text-[#29202B] dark:text-[#F3EEE8] tracking-tight">
        You're All Caught Up
      </h3>

      <p className="mt-2 text-xs sm:text-sm text-[#6D7068] dark:text-[#A89E9B] leading-relaxed max-w-xs mx-auto">
        You have explored all active community moments from the past 24 hours. Check back later for newly published looks or share your daily fit.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="w-full sm:w-auto font-mono text-xs"
          >
            Check For New Looks
          </Button>
        )}

        {onShareMoment && (
          <Button
            variant="primary"
            size="sm"
            onClick={onShareMoment}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="w-full sm:w-auto font-mono text-xs"
          >
            Publish A Look
          </Button>
        )}
      </div>
    </div>
  );
};
