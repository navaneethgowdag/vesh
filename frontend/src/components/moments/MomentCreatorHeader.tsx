import React from 'react';
import { Clock, CheckCircle, X } from 'lucide-react';
import { OutfitMoment } from '../../types';
import { Avatar } from '../ui/Avatar';
import { useNavigate } from 'react-router-dom';

interface MomentCreatorHeaderProps {
  moment: OutfitMoment;
  onClose?: () => void;
  className?: string;
}

export const MomentCreatorHeader: React.FC<MomentCreatorHeaderProps> = ({
  moment,
  onClose,
  className = '',
}) => {
  const navigate = useNavigate();

  // Format remaining time nicely
  const formatTimeLeft = () => {
    if (moment.timeRemainingSeconds !== undefined && moment.timeRemainingSeconds > 0) {
      const hours = Math.floor(moment.timeRemainingSeconds / 3600);
      const minutes = Math.floor((moment.timeRemainingSeconds % 3600) / 60);
      if (hours > 0) return `${hours}h left`;
      return `${Math.max(1, minutes)}m left`;
    }
    if (moment.expiresAt) {
      const diffMs = new Date(moment.expiresAt).getTime() - Date.now();
      if (diffMs <= 0) return 'Expiring';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `${hours}h left`;
      return `${Math.max(1, mins)}m left`;
    }
    return '24h Moment';
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moment.user?.id) {
      navigate(`/profile/${moment.user.id}`);
      if (onClose) onClose();
    }
  };

  return (
    <div className={`flex items-center justify-between gap-3 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white select-none ${className}`}>
      {/* Creator Info */}
      <div
        onClick={handleProfileClick}
        className="flex items-center gap-3 cursor-pointer group min-w-0"
      >
        <Avatar
          src={moment.user?.avatar}
          alt={moment.user?.name || 'Creator'}
          size="sm"
          className="ring-1 ring-white/30 rounded-[2px]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="font-sans font-semibold text-sm truncate group-hover:underline">
              {moment.user?.name || 'Curator'}
            </span>
            {moment.user?.isVerified && (
              <CheckCircle className="w-3.5 h-3.5 text-[#D5A6A0] shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#DCD4CC]/80 font-mono mt-0.5">
            <span>@{moment.user?.username || 'atelier'}</span>
            <span>&middot;</span>
            <span className="flex items-center gap-1 text-[#D5A6A0]">
              <Clock className="w-3 h-3" />
              {formatTimeLeft()}
            </span>
          </div>
        </div>
      </div>

      {/* Right Tags & Optional Close */}
      <div className="flex items-center gap-2 shrink-0">
        {moment.occasion && (
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-[2px] text-[10px] font-mono tracking-wider uppercase bg-white/10 backdrop-blur-sm border border-white/15 text-white/90">
            {moment.occasion}
          </span>
        )}

        {onClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="p-1.5 rounded-[2px] bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
