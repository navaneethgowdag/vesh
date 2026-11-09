/**
 * Moment Image Preloading and In-Memory Cache Singleton
 *
 * Requirements:
 * 1. Preloads current and upcoming moment images in advance.
 * 2. Avoids redundant re-downloads by maintaining loaded HTMLImageElement instances.
 * 3. Tracks loading, loaded, and failed states per image URL.
 * 4. Bounded cache size to avoid excessive memory consumption.
 * 5. Stable image cache keys without cache-busting parameters.
 */

export type ImageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

class MomentImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private states = new Map<string, ImageLoadState>();
  private maxEntries = 40;

  /**
   * Check whether an image is already fully loaded in memory.
   */
  public isLoaded(url?: string | null): boolean {
    if (!url) return false;
    return this.states.get(url) === 'loaded';
  }

  /**
   * Get the loading status of an image.
   */
  public getState(url?: string | null): ImageLoadState {
    if (!url) return 'idle';
    return this.states.get(url) || 'idle';
  }

  /**
   * Preload a single image URL into memory and browser HTTP cache.
   */
  public preload(url?: string | null): Promise<boolean> {
    if (!url) return Promise.resolve(false);

    // If already loaded or in progress, return cached status
    const currentState = this.states.get(url);
    if (currentState === 'loaded') {
      return Promise.resolve(true);
    }
    if (currentState === 'loading') {
      return new Promise((resolve) => {
        const existingImg = this.cache.get(url);
        if (existingImg) {
          const check = () => {
            if (this.states.get(url) === 'loaded') resolve(true);
            else if (this.states.get(url) === 'error') resolve(false);
            else setTimeout(check, 30);
          };
          check();
        } else {
          resolve(false);
        }
      });
    }

    this.states.set(url, 'loading');

    // LRU eviction if cache exceeds capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.states.delete(oldestKey);
      }
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        this.cache.set(url, img);
        this.states.set(url, 'loaded');
        resolve(true);
      };

      img.onerror = () => {
        this.states.set(url, 'error');
        resolve(false);
      };

      img.src = url;
    });
  }

  /**
   * Preload a sequence of moment image URLs with priority given to currentIndex.
   */
  public preloadSequence(urls: string[], currentIndex: number = 0, windowSize: number = 4): void {
    if (!urls || urls.length === 0) return;

    // Priority 1: Current image
    if (urls[currentIndex]) {
      this.preload(urls[currentIndex]);
    }

    // Priority 2: Next 2-3 images
    for (let i = 1; i <= windowSize; i++) {
      const nextIdx = currentIndex + i;
      if (nextIdx < urls.length && urls[nextIdx]) {
        this.preload(urls[nextIdx]);
      }
    }

    // Priority 3: Previous image for instant back-swipe
    if (currentIndex > 0 && urls[currentIndex - 1]) {
      this.preload(urls[currentIndex - 1]);
    }
  }

  /**
   * Release cached elements when safe to do so.
   */
  public clear(): void {
    this.cache.clear();
    this.states.clear();
  }
}

export const momentImageCache = new MomentImageCache();
