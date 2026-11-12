import React, { useEffect } from 'react';
import { X, Heart } from 'lucide-react';

interface MomentActionsProps {
  onLike: () => void;
  onSkip: () => void;
  isLiked?: boolean;
  disabled?: boolean;
  likesCount?: number;
  className?: string;
}

export const MomentActions: React.FC<MomentActionsProps> = ({
  onLike,
  onSkip,
  isLiked = false,
  disabled = false,
  likesCount = 0,
  className = '',
}) => {
  // Listen for arrow keys on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onLike();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onLike, onSkip, disabled]);

  return (
    <div className={`flex items-center justify-center gap-6 select-none ${className}`}>
      {/* Skip Button (Swipe Left) */}
      <button
        type="button"
        onClick={onSkip}
        disabled={disabled}
        aria-label="Skip Moment"
        title="Skip Look (Left Arrow)"
        className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      >
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-[3px] bg-[#FFFFFF] dark:bg-[#241D27] border border-[#DCD4CC] dark:border-[#392F3E] text-[#6D7068] dark:text-[#A89E9B] hover:text-[#A33D42] dark:hover:text-[#A33D42] hover:border-[#A33D42]/40 dark:hover:border-[#A33D42]/40 hover:bg-[#F3EEE8] dark:hover:bg-[#1A151C] shadow-xs flex items-center justify-center transition-all duration-150 group-hover:scale-105 active:scale-95">
          <X className="w-6 h-6 stroke-[2]" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#6D7068] dark:text-[#A89E9B] group-hover:text-[#29202B] dark:group-hover:text-[#F3EEE8]">
          Pass &larr;
        </span>
      </button>

      {/* Like Button (Swipe Right) */}
      <button
        type="button"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like Moment"
        title="Appreciate Look (Right Arrow)"
        className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      >
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-[3px] bg-[#743C49] hover:bg-[#5E303B] dark:bg-[#743C49] dark:hover:bg-[#8A4A58] text-[#FFFFFF] border border-transparent shadow-xs flex items-center justify-center transition-all duration-150 group-hover:scale-105 active:scale-95">
          <Heart
            className={`w-6 h-6 transition-transform ${isLiked ? 'fill-white stroke-white scale-110' : 'stroke-white stroke-[2]'}`}
          />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#743C49] dark:text-[#D5A6A0] font-semibold flex items-center gap-1">
          &rarr; Like {likesCount > 0 && `(${likesCount})`}
        </span>
      </button>
    </div>
  );
};
