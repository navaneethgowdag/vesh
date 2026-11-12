import React, { useState } from 'react';
import { OutfitMoment } from '../../types';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';
import { PollWidget } from '../social/PollWidget';

interface MomentImageProps {
  moment: OutfitMoment;
  className?: string;
  onImageError?: () => void;
}

export const isVideoMedia = (url?: string): boolean => {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.startsWith('data:video/')
  );
};

export const MomentImage: React.FC<MomentImageProps> = ({
  moment,
  className = '',
  onImageError,
}) => {
  const [hasError, setHasError] = useState(false);
  const rawUrl = resolveImageUrl(moment.imageUrl) || FALLBACK_POST_IMAGE;
  const isVideo = isVideoMedia(rawUrl);

  const handleError = () => {
    setHasError(true);
    if (onImageError) onImageError();
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#29202B] ${className}`}>
      {isVideo ? (
        <video
          src={rawUrl}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      ) : (
        <img
          src={hasError ? FALLBACK_POST_IMAGE : rawUrl}
          alt={moment.caption || 'Outfit look'}
          onError={handleError}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      )}

      {/* Bottom Vignette & Information */}
      <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white pointer-events-none">
        {/* Caption */}
        {moment.caption && (
          <p className="font-sans text-sm sm:text-base font-medium leading-relaxed drop-shadow-sm line-clamp-3 text-white">
            {moment.caption}
          </p>
        )}

        {/* Tags */}
        {moment.tags && moment.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {moment.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-[2px] bg-white/15 backdrop-blur-xs text-[10px] font-mono text-[#DCD4CC]"
              >
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}

        {/* Embedded Poll Widget (if present) */}
        {moment.poll && (
          <div className="mt-3 pointer-events-auto">
            <PollWidget poll={moment.poll} />
          </div>
        )}
      </div>
    </div>
  );
};
