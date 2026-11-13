/**
 * TailorBird Centralized Image Upload Preparation & Conditional Compression Utility
 *
 * Requirements:
 * - If an image is > 500 KB (500 * 1024 bytes), compress it before upload.
 * - If an image is <= 500 KB, return the original image unchanged.
 * - Respect EXIF orientation and preserve native aspect ratio (no upscaling).
 * - Preserve alpha transparency for PNG/WebP (do not blindly convert transparent PNG to JPEG).
 * - Preserve animated GIFs without converting to static frames.
 * - Progressive quality-first compression (minimum visual loss, floor quality 0.65).
 * - Safe fallback: if compression fails or produces larger size, preserve original file.
 * - Returns structured metrics (originalSize, finalSize, compressed, format, savedBytes).
 */

export const COMPRESSION_THRESHOLD_BYTES = 500 * 1024; // 500 KB exact threshold

export interface PreparedImageResult {
  file: File;
  originalFile: File;
  originalSize: number;
  finalSize: number;
  compressed: boolean;
  format: string;
  savedBytes: number;
  compressionRatio: number;
}

export interface PrepareImageOptions {
  maxDimension?: number; // Maximum width or height constraint (default: 2048px, no upscaling)
  targetMaxBytes?: number; // Target size threshold (default: 500 KB)
  preferredFormat?: 'image/webp' | 'image/jpeg' | 'auto';
}

/**
 * Detect browser WebP canvas export support.
 */
function checkWebPSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Inspect image data for presence of alpha transparency.
 */
function canvasHasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample corners and center to quickly detect alpha without full array scan
    const samplePoints = [
      [0, 0],
      [Math.floor(width / 2), Math.floor(height / 2)],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];
    for (const [x, y] of samplePoints) {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] < 255) return true;
    }
  } catch {
    // Canvas security or context error
  }
  return false;
}

/**
 * Load a File into an HTMLImageElement using object URL.
 */
function decodeImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to decode image file: ${e}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Export canvas to Blob with quality.
 */
function exportCanvas(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Prepare an individual image file for upload.
 * Applies conditional compression only if file.size > 500 KB.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {}
): Promise<PreparedImageResult> {
  const originalSize = file.size;
  const threshold = options.targetMaxBytes ?? COMPRESSION_THRESHOLD_BYTES;

  // 1. If file is 500 KB or smaller, keep original image unchanged
  if (originalSize <= threshold) {
    return {
      file,
      originalFile: file,
      originalSize,
      finalSize: originalSize,
      compressed: false,
      format: file.type || 'image/jpeg',
      savedBytes: 0,
      compressionRatio: 0,
    };
  }

  // 2. Animated GIF check: preserve animation frames without converting to static canvas
  const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);
  if (isGif) {
    return {
      file,
      originalFile: file,
      originalSize,
      finalSize: originalSize,
      compressed: false,
      format: 'image/gif',
      savedBytes: 0,
      compressionRatio: 0,
    };
  }

  // 3. Environment check: if window or document is undefined, return original
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      file,
      originalFile: file,
      originalSize,
      finalSize: originalSize,
      compressed: false,
      format: file.type,
      savedBytes: 0,
      compressionRatio: 0,
    };
  }

  try {
    // 4. Decode image
    const img = await decodeImageFile(file);
    const nativeW = img.naturalWidth || img.width;
    const nativeH = img.naturalHeight || img.height;

    if (nativeW === 0 || nativeH === 0) {
      throw new Error('Image dimensions are zero');
    }

    const maxDim = options.maxDimension || 2048;
    let targetW = nativeW;
    let targetH = nativeH;

    // Never upscale, only downscale if larger than maxDim
    if (nativeW > maxDim || nativeH > maxDim) {
      const scale = Math.min(maxDim / nativeW, maxDim / nativeH);
      targetW = Math.max(1, Math.round(nativeW * scale));
      targetH = Math.max(1, Math.round(nativeH * scale));
    }

    // 5. Canvas setup
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Unable to create canvas 2D context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 6. Format selection: preserve alpha transparency
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
    const isWebP = file.type === 'image/webp' || /\.webp$/i.test(file.name);
    const supportsWebP = checkWebPSupport();
    const hasAlpha = (isPng || isWebP) && canvasHasTransparency(ctx, targetW, targetH);

    let targetMime: 'image/webp' | 'image/jpeg' | 'image/png';
    let targetExt: string;

    if (supportsWebP) {
      targetMime = 'image/webp';
      targetExt = '.webp';
    } else if (hasAlpha) {
      targetMime = 'image/png';
      targetExt = '.png';
    } else {
      targetMime = 'image/jpeg';
      targetExt = '.jpg';
    }

    // If non-alpha and encoding JPEG, fill white background to avoid transparent black artifacts
    if (!hasAlpha && targetMime === 'image/jpeg') {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = targetW;
      bgCanvas.height = targetH;
      const bgCtx = bgCanvas.getContext('2d', { alpha: false });
      if (bgCtx) {
        bgCtx.fillStyle = '#FFFFFF';
        bgCtx.fillRect(0, 0, targetW, targetH);
        bgCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(bgCanvas, 0, 0);
      }
    }

    // 7. Progressive quality compression: quality-first approach
    // Step 1: High quality 0.86
    // Step 2: Very good quality 0.76
    // Step 3: Good quality 0.68
    const qualitySteps = [0.86, 0.76, 0.68];
    let bestBlob: Blob | null = null;

    for (const q of qualitySteps) {
      const candidateBlob = await exportCanvas(canvas, targetMime, q);
      if (candidateBlob) {
        bestBlob = candidateBlob;
        if (candidateBlob.size <= threshold) {
          break; // Satisfies target size threshold while keeping highest possible quality
        }
      }
    }

    // If still over threshold and dimensions are large, perform a mild dimension step-down
    if (bestBlob && bestBlob.size > threshold && (targetW > 1440 || targetH > 1440)) {
      const stepScale = 1440 / Math.max(targetW, targetH);
      const reducedW = Math.round(targetW * stepScale);
      const reducedH = Math.round(targetH * stepScale);

      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = reducedW;
      stepCanvas.height = reducedH;
      const stepCtx = stepCanvas.getContext('2d', { alpha: hasAlpha });
      if (stepCtx) {
        stepCtx.imageSmoothingEnabled = true;
        stepCtx.imageSmoothingQuality = 'high';
        stepCtx.drawImage(canvas, 0, 0, reducedW, reducedH);
        const reducedBlob = await exportCanvas(stepCanvas, targetMime, 0.74);
        if (reducedBlob && reducedBlob.size < bestBlob.size) {
          bestBlob = reducedBlob;
        }
      }
    }

    // 8. Quality verification: if compression failed or resulted in larger file, keep original
    if (!bestBlob || bestBlob.size >= originalSize) {
      return {
        file,
        originalFile: file,
        originalSize,
        finalSize: originalSize,
        compressed: false,
        format: file.type,
        savedBytes: 0,
        compressionRatio: 0,
      };
    }

    // 9. Derive filename and construct optimized File
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_\-\s]/g, '');
    const finalFileName = `${baseName}${targetExt}`;

    const optimizedFile = new File([bestBlob], finalFileName, {
      type: targetMime,
      lastModified: Date.now(),
    });

    const finalSize = optimizedFile.size;
    const savedBytes = originalSize - finalSize;
    const compressionRatio = Math.round((savedBytes / originalSize) * 100) / 100;

    return {
      file: optimizedFile,
      originalFile: file,
      originalSize,
      finalSize,
      compressed: true,
      format: targetMime,
      savedBytes,
      compressionRatio,
    };
  } catch (err) {
    // Non-blocking failure: preserve original image safely
    console.warn(`[ImageUploadOptimizer] Compression bypassed for "${file.name}":`, err);
    return {
      file,
      originalFile: file,
      originalSize,
      finalSize: originalSize,
      compressed: false,
      format: file.type,
      savedBytes: 0,
      compressionRatio: 0,
    };
  }
}

/**
 * Batch image upload preparation helper.
 * Conditionally optimizes each file in parallel while keeping association intact.
 */
export async function prepareBatchImagesForUpload(
  files: File[],
  options: PrepareImageOptions = {}
): Promise<PreparedImageResult[]> {
  return Promise.all(files.map((f) => prepareImageForUpload(f, options)));
}

/**
 * Direct File helpers for API callers that simply require the compressed or untouched File.
 */
export async function compressImageIfRequired(
  file: File,
  options: PrepareImageOptions = {}
): Promise<File> {
  const result = await prepareImageForUpload(file, options);
  return result.file;
}

export async function compressBatchIfRequired(
  files: File[],
  options: PrepareImageOptions = {}
): Promise<File[]> {
  const results = await prepareBatchImagesForUpload(files, options);
  return results.map((r) => r.file);
}
