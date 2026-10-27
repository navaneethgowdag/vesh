/**
 * Image URL resolution utility for StyleSphere.
 * Guarantees that images uploaded to FastAPI backend (or stored as relative /static/ paths)
 * resolve to valid, reachable HTTP URLs regardless of environment (local dev vs Render production).
 */

import { getBackendOrigin } from './apiUrl';

export const FALLBACK_POST_IMAGE =
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80';

export const FALLBACK_AVATAR_IMAGE =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

export { getBackendOrigin };

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Already a complete URL, data URI, or object blob
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const origin = getBackendOrigin();
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

