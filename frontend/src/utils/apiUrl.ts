/**
 * API configuration and base URL resolution for StyleSphere.
 * Guarantees proper routing between local development (http://127.0.0.1:8000/api/v1)
 * and production deployment on Render (https://vesh-backend-5sx2.onrender.com/api/v1).
 *
 * Ensures all API calls use the registered /api/v1 prefix without duplication.
 */

export const DEFAULT_DEV_API_BASE = 'http://127.0.0.1:8000/api/v1';
export const PRODUCTION_API_BASE = 'https://vesh-backend-5sx2.onrender.com/api/v1';

function normalizeApiBaseUrl(raw: string): string {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_DEV_API_BASE;

  // Never duplicate /api/v1
  if (cleaned.endsWith('/api/v1')) {
    return cleaned;
  }
  if (cleaned.endsWith('/api')) {
    return `${cleaned}/v1`;
  }
  return `${cleaned}/api/v1`;
}

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();

  if (typeof window !== 'undefined' && window.location) {
    const isHttps = window.location.protocol === 'https:';
    const hostname = window.location.hostname.toLowerCase();
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.local');

    // Deployed production environment (e.g. vesh.onrender.com)
    if (!isLocalhost) {
      if (
        !envUrl ||
        envUrl.includes('localhost') ||
        envUrl.includes('127.0.0.1') ||
        (isHttps && envUrl.startsWith('http:'))
      ) {
        return PRODUCTION_API_BASE;
      }
      return normalizeApiBaseUrl(envUrl);
    }
  }

  // Local development
  if (envUrl) {
    return normalizeApiBaseUrl(envUrl);
  }
  return DEFAULT_DEV_API_BASE;
}

export function getBackendOrigin(): string {
  const apiBase = getApiBaseUrl();
  try {
    const url = new URL(apiBase);
    return url.origin;
  } catch {
    return apiBase.replace(/\/api\/v1\/?$/, '');
  }
}
