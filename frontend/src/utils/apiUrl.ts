/**
 * StyleSphere API Base URL resolution utility.
 * Guarantees proper routing between local development (http://localhost:8000/api/v1)
 * and production deployment on Render (https://vesh-backend-5sx2.onrender.com/api/v1).
 *
 * Prevents "Failed to fetch" errors caused by Mixed Content or stale localhost inlining.
 */

export const DEFAULT_DEV_API_BASE = 'http://localhost:8000/api/v1';
export const PRODUCTION_API_BASE = 'https://vesh-backend-5sx2.onrender.com/api/v1';

export function getApiBaseUrl(): string {
  const rawEnv = (import.meta.env.VITE_API_BASE_URL || '').trim();

  // If in browser runtime:
  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const hostname = window.location.hostname.toLowerCase();
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local');

    // Running on production / deployed origin (such as vesh.onrender.com)
    if (!isLocalhost) {
      // If the env variable was omitted, or baked in as localhost/127.0.0.1/insecure http:
      if (
        !rawEnv ||
        rawEnv.includes('localhost') ||
        rawEnv.includes('127.0.0.1') ||
        (isHttps && rawEnv.startsWith('http:'))
      ) {
        return PRODUCTION_API_BASE;
      }
      return rawEnv.replace(/\/+$/, '');
    }
  }

  // Local development fallback
  if (rawEnv) {
    return rawEnv.replace(/\/+$/, '');
  }
  return DEFAULT_DEV_API_BASE;
}

export function getBackendOrigin(): string {
  const apiBase = getApiBaseUrl();
  try {
    const parsed = new URL(
      apiBase,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000'
    );
    return parsed.origin;
  } catch {
    return 'http://localhost:8000';
  }
}
