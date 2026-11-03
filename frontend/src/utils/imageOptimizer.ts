/**
 * TailorBird Client-Side Image Optimizer
 *
 * Provides non-blocking, canvas-based image optimization with:
 * - Adaptive WebP compression with lossless transparency support and JPEG fallback
 * - Contextual dimension limits:
 *     - feed: max 1600x1600 (quality 0.82)
 *     - moment: max 1440x1920 (quality 0.84, vertical 9:16 optimized)
 *     - thumbnail: max 400x400 (quality 0.78)
 *     - preview: max 640x640 (quality 0.80)
 * - Intelligent bypass: skips recompression if already optimized (<300 KB & fits bounds)
 * - Strict original preservation: original file object is always retained untouched
 * - Aspect ratio preservation & EXIF auto-orientation
 * - Dual output: delivers both full-resolution optimized asset and instant preview thumbnail
 */

export type OptimizationPreset = 'feed' | 'moment' | 'thumbnail' | 'preview';

export interface OptimizationOptions {
  preset?: OptimizationPreset;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  generateThumbnail?: boolean;
  thumbnailMaxWidth?: number;
  thumbnailQuality?: number;
}

export interface OptimizedImageResult {
  originalFile: File;
  optimizedFile: File;
  thumbnailFile?: File;
  previewUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  compressionRatio: number; // e.g., 0.65 means 65% reduction
  format: 'image/webp' | 'image/jpeg' | 'image/png';
  processingTimeMs: number;
  skipped: boolean;
}

const PRESET_CONFIGS: Record<
  OptimizationPreset,
  { maxWidth: number; maxHeight: number; quality: number }
> = {
  feed: { maxWidth: 1600, maxHeight: 1600, quality: 0.82 },
  moment: { maxWidth: 1440, maxHeight: 1920, quality: 0.84 },
  preview: { maxWidth: 640, maxHeight: 640, quality: 0.80 },
  thumbnail: { maxWidth: 400, maxHeight: 400, quality: 0.78 },
};

/**
 * Format raw byte count into human-readable representation.
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Detect browser WebP encoding capability.
 */
function supportsWebPExport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

/**
 * Calculate target dimensions maintaining source aspect ratio within maximum bounds.
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight, 1);
  return {
    width: Math.max(1, Math.round(srcWidth * ratio)),
    height: Math.max(1, Math.round(srcHeight * ratio)),
  };
}

/**
 * Asynchronously decode file into an HTMLImageElement using object URL.
 */
function loadFileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode image "${file.name}": ${err}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Render image onto offscreen canvas and export as Blob.
 */
function renderCanvasToBlob(
  source: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  quality: number,
  hasAlpha: boolean
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: hasAlpha });
    if (!ctx) {
      reject(new Error('Failed to acquire 2D canvas context'));
      return;
    }

    // High quality bicubic image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If source does not have alpha and we export to JPEG, ensure pure white backdrop
    if (!hasAlpha && mimeType === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
    }

    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas export produced empty blob'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

/**
 * Core image optimization routine.
 * Never mutates original file; returns new optimized WebP derivative alongside original.
 */
export async function optimizeImage(
  file: File,
  options: OptimizationOptions = {}
): Promise<OptimizedImageResult> {
  const startTime = performance.now();
  const preset = options.preset || 'feed';
  const config = PRESET_CONFIGS[preset];

  const maxWidth = options.maxWidth ?? config.maxWidth;
  const maxHeight = options.maxHeight ?? config.maxHeight;
  const quality = options.quality ?? config.quality;
  const generateThumbnail = options.generateThumbnail ?? true;
  const thumbnailMaxWidth = options.thumbnailMaxWidth ?? 400;
  const thumbnailQuality = options.thumbnailQuality ?? 0.78;

  const originalSize = file.size;

  // Determine source format and alpha channel potential
  const isPng = file.type === 'image/png';
  const isWebP = file.type === 'image/webp';
  const isHeic = /\.(heic|heif)$/i.test(file.name);
  const hasAlpha = isPng || isWebP;

  // Check if browser can export to WebP
  const canWebP = supportsWebPExport();
  const targetMime: 'image/webp' | 'image/jpeg' | 'image/png' = canWebP
    ? 'image/webp'
    : hasAlpha
    ? 'image/png'
    : 'image/jpeg';

  // Decode image to check native dimensions
  const img = await loadFileToImage(file);
  const nativeWidth = img.naturalWidth || img.width;
  const nativeHeight = img.naturalHeight || img.height;

  // Intelligent Bypass:
  // If file is already WebP (or JPEG/PNG), size < 300KB, and within dimension limits, skip recompression
  const fitsDimensions = nativeWidth <= maxWidth && nativeHeight <= maxHeight;
  const isSmallEnough = originalSize <= 300 * 1024;
  const isModernFormat = isWebP || file.type === 'image/jpeg';

  if (fitsDimensions && isSmallEnough && isModernFormat && !isHeic) {
    const previewUrl = URL.createObjectURL(file);
    const elapsed = Math.round(performance.now() - startTime);

    return {
      originalFile: file,
      optimizedFile: file,
      previewUrl,
      thumbnailUrl: previewUrl,
      width: nativeWidth,
      height: nativeHeight,
      originalSize,
      optimizedSize: originalSize,
      savedBytes: 0,
      compressionRatio: 0,
      format: file.type as any,
      processingTimeMs: elapsed,
      skipped: true,
    };
  }

  // Calculate target dimensions
  const targetDims = calculateAspectRatioFit(nativeWidth, nativeHeight, maxWidth, maxHeight);

  // Render optimized asset
  const optimizedBlob = await renderCanvasToBlob(
    img,
    targetDims.width,
    targetDims.height,
    targetMime,
    quality,
    hasAlpha
  );

  // Derive target filename with correct extension
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const ext = targetMime === 'image/webp' ? '.webp' : targetMime === 'image/png' ? '.png' : '.jpg';
  const optimizedFileName = `${baseName}${ext}`;

  // If the "optimized" blob ended up larger than original (rare, e.g. already heavily compressed JPG),
  // and dimensions were already fine, keep original to prevent quality loss
  let finalOptimizedBlob = optimizedBlob;
  let finalMime = targetMime;
  let finalFileName = optimizedFileName;

  if (optimizedBlob.size >= originalSize && fitsDimensions && !isHeic) {
    finalOptimizedBlob = file;
    finalMime = file.type as any;
    finalFileName = file.name;
  }

  const optimizedFile = new File([finalOptimizedBlob], finalFileName, {
    type: finalMime,
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(optimizedFile);

  // Generate thumbnail derivative if requested
  let thumbnailFile: File | undefined;
  let thumbnailUrl: string | undefined;

  if (generateThumbnail) {
    const thumbDims = calculateAspectRatioFit(
      nativeWidth,
      nativeHeight,
      thumbnailMaxWidth,
      thumbnailMaxWidth
    );
    const thumbBlob = await renderCanvasToBlob(
      img,
      thumbDims.width,
      thumbDims.height,
      targetMime,
      thumbnailQuality,
      hasAlpha
    );
    const thumbFileName = `${baseName}_thumb${ext}`;
    thumbnailFile = new File([thumbBlob], thumbFileName, {
      type: targetMime,
      lastModified: Date.now(),
    });
    thumbnailUrl = URL.createObjectURL(thumbnailFile);
  }

  const optimizedSize = optimizedFile.size;
  const savedBytes = Math.max(0, originalSize - optimizedSize);
  const compressionRatio = originalSize > 0 ? savedBytes / originalSize : 0;
  const elapsed = Math.round(performance.now() - startTime);

  return {
    originalFile: file, // Original preserved intact
    optimizedFile,
    thumbnailFile,
    previewUrl,
    thumbnailUrl,
    width: targetDims.width,
    height: targetDims.height,
    originalSize,
    optimizedSize,
    savedBytes,
    compressionRatio: parseFloat(compressionRatio.toFixed(3)),
    format: finalMime,
    processingTimeMs: elapsed,
    skipped: false,
  };
}

/**
 * Batch optimize multiple images with progressive per-item callback.
 */
export async function optimizeBatch(
  files: File[],
  options: OptimizationOptions = {},
  onProgress?: (completed: number, total: number, result: OptimizedImageResult) => void
): Promise<OptimizedImageResult[]> {
  const results: OptimizedImageResult[] = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const result = await optimizeImage(file, options);
      results.push(result);
      onProgress?.(i + 1, total, result);
    } catch (err) {
      console.warn(`[imageOptimizer] Failed to optimize "${file.name}", using original:`, err);
      const fallbackResult: OptimizedImageResult = {
        originalFile: file,
        optimizedFile: file,
        previewUrl: URL.createObjectURL(file),
        width: 800,
        height: 800,
        originalSize: file.size,
        optimizedSize: file.size,
        savedBytes: 0,
        compressionRatio: 0,
        format: file.type as any,
        processingTimeMs: 0,
        skipped: true,
      };
      results.push(fallbackResult);
      onProgress?.(i + 1, total, fallbackResult);
    }
  }

  return results;
}

/**
 * Revoke created object URLs to prevent memory leaks.
 */
export function revokeOptimizedResultUrls(result: OptimizedImageResult): void {
  if (result.previewUrl) {
    try {
      URL.revokeObjectURL(result.previewUrl);
    } catch {}
  }
  if (result.thumbnailUrl && result.thumbnailUrl !== result.previewUrl) {
    try {
      URL.revokeObjectURL(result.thumbnailUrl);
    } catch {}
  }
}
