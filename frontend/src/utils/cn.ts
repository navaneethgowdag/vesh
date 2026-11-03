import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import neutralAvatarSvg from '../assets/avatars/neutral.svg';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fallback faceless illustrated fashion avatar (replaces legacy external human photo)
export const DEFAULT_AVATAR = neutralAvatarSvg;

export const FALLBACK_GARMENT_IMAGE =
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80';

export const FALLBACK_OUTFIT_IMAGE =
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80';

