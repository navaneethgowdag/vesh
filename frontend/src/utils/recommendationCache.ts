import { Recommendation } from '../types';

interface CachedRecommendationEntry {
  userId: string;
  targetDate: string; // YYYY-MM-DD
  occasion: string;
  calendarEventId?: string;
  recommendation: Recommendation;
  timestamp: number;
}

const STORAGE_PREFIX = 'tb_rec_cache_';
const MEMORY_CACHE = new Map<string, CachedRecommendationEntry>();

export function normalizeOccasionKey(occasion: string): string {
  return (occasion || 'Everyday').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function buildCacheKey(userId: string, targetDate: string, occasion: string, eventId?: string): string {
  const occKey = normalizeOccasionKey(occasion);
  const eventPart = eventId ? `_evt_${eventId}` : '';
  return `${STORAGE_PREFIX}${userId}_${targetDate}_${occKey}${eventPart}`;
}

export const recommendationCache = {
  get(userId: string, targetDate: string, occasion: string, eventId?: string): Recommendation | null {
    if (!userId || !targetDate) return null;
    const key = buildCacheKey(userId, targetDate, occasion, eventId);

    // 1. Check in-memory cache first
    const mem = MEMORY_CACHE.get(key);
    if (mem && mem.userId === userId && mem.targetDate === targetDate) {
      return mem.recommendation;
    }

    // 2. Check sessionStorage
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed: CachedRecommendationEntry = JSON.parse(stored);
        if (parsed.userId === userId && parsed.targetDate === targetDate && parsed.recommendation) {
          MEMORY_CACHE.set(key, parsed);
          return parsed.recommendation;
        }
      }
    } catch {
      // sessionStorage unavailable or quota exceeded
    }
    return null;
  },

  set(userId: string, targetDate: string, occasion: string, recommendation: Recommendation, eventId?: string): void {
    if (!userId || !targetDate || !recommendation) return;
    const key = buildCacheKey(userId, targetDate, occasion, eventId);
    const entry: CachedRecommendationEntry = {
      userId,
      targetDate,
      occasion,
      calendarEventId: eventId,
      recommendation,
      timestamp: Date.now(),
    };
    MEMORY_CACHE.set(key, entry);
    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // quiet fallback
    }
  },

  invalidateUser(userId: string, occasion?: string): void {
    if (!userId) return;
    const occKey = occasion ? normalizeOccasionKey(occasion) : null;

    // Clear in-memory entries
    for (const [key, val] of Array.from(MEMORY_CACHE.entries())) {
      if (val.userId === userId) {
        if (!occKey || normalizeOccasionKey(val.occasion) === occKey) {
          MEMORY_CACHE.delete(key);
        }
      }
    }

    // Clear sessionStorage entries
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(`${STORAGE_PREFIX}${userId}_`)) {
          if (!occKey || k.includes(`_${occKey}`)) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // quiet
    }
  },

  clearAll(): void {
    MEMORY_CACHE.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // quiet
    }
  },
};
