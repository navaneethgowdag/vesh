import React, { useState } from 'react';
import { cn, DEFAULT_AVATAR } from '../../utils/cn';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  isVerified?: boolean;
}

const sizeMap = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
  '2xl': 'w-28 h-28 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'User avatar',
  size = 'md',
  className,
  isVerified = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const initials = alt
    ? alt
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SP';

  const imageSrc = !imageError && src ? src : DEFAULT_AVATAR;

  return (
    <div className={cn('relative inline-block flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden border border-sand-200/80 bg-sand-100 flex items-center justify-center font-medium text-charcoal-700 shadow-soft-sm transition-transform duration-200',
          sizeMap[size]
        )}
      >
        <img
          src={imageSrc}
          alt={alt}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      {isVerified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-cognac-600 text-white rounded-full flex items-center justify-center text-[9px] shadow-sm border border-white"
          title="Verified Creator"
        >
          ✓
        </span>
      )}
    </div>
  );
};

