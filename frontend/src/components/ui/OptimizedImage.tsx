import React, { useState, useEffect, useRef } from 'react';
import { resolveImageUrl, FALLBACK_POST_IMAGE } from '../../utils/imageUrl';

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'story' | 'video' | string;
  priority?: boolean;
  fallbackSrc?: string;
  containerClassName?: string;
  showSkeleton?: boolean;
}

const ASPECT_RATIO_CLASSES: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[16/9]',
  story: 'aspect-[9/16]',
  video: 'aspect-video',
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  aspectRatio = 'portrait',
  priority = false,
  fallbackSrc = FALLBACK_POST_IMAGE,
  className = '',
  containerClassName = '',
  showSkeleton = true,
  onLoad,
  onError,
  ...imgProps
}) => {
  const resolvedSrc = resolveImageUrl(src) || fallbackSrc;
  const [currentSrc, setCurrentSrc] = useState<string>(resolvedSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const next = resolveImageUrl(src) || fallbackSrc;
    setCurrentSrc(next);
    setIsLoaded(false);
    setHasError(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [currentSrc]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!hasError && currentSrc !== fallbackSrc) {
      setHasError(true);
      setCurrentSrc(fallbackSrc);
    }
    onError?.(e);
  };

  const ratioClass = ASPECT_RATIO_CLASSES[aspectRatio] || '';

  return (
    <div
      className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-800 ${ratioClass} ${containerClassName}`}
      style={!ratioClass && aspectRatio ? { aspectRatio } : undefined}
    >
      {showSkeleton && !isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 animate-pulse" />
      )}

      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-full object-cover transition-opacity duration-300 ease-in-out ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...imgProps}
      />
    </div>
  );
};
