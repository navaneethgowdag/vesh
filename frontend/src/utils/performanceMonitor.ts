/**
 * TailorBird Performance & Animation Monitor
 *
 * Tracks and reports on:
 * - Client-side image compression duration and byte reduction
 * - Moment 60 FPS animation smoothness and dropped frame detection
 * - Route navigation transition latency
 * - Image asset decode and load timings
 * - Core Web Vitals (LCP, FID/INP, CLS) where available
 */

export interface ImageOptimizationMetric {
  fileName: string;
  originalBytes: number;
  optimizedBytes: number;
  savedPercent: number;
  compressionDurationMs: number;
  uploadDurationMs?: number;
  timestamp: number;
}

export interface AnimationMetric {
  component: string;
  targetFps: number;
  measuredFps: number;
  droppedFrames: number;
  durationMs: number;
  timestamp: number;
}

export interface RouteMetric {
  fromPath: string;
  toPath: string;
  durationMs: number;
  timestamp: number;
}

export interface PerformanceReport {
  timestamp: string;
  imageOptimizations: {
    totalOptimized: number;
    totalBytesSaved: number;
    averageReductionPercent: number;
    averageCompressionTimeMs: number;
    metrics: ImageOptimizationMetric[];
  };
  animations: {
    totalSessions: number;
    averageFps: number;
    totalDroppedFrames: number;
    metrics: AnimationMetric[];
  };
  routeNavigations: {
    totalNavigations: number;
    averageDurationMs: number;
    metrics: RouteMetric[];
  };
}

class PerformanceMonitorService {
  private imageMetrics: ImageOptimizationMetric[] = [];
  private animationMetrics: AnimationMetric[] = [];
  private routeMetrics: RouteMetric[] = [];
  private activeMarks: Map<string, number> = new Map();

  /**
   * Start timing an operation with a unique key.
   */
  startTimer(key: string): void {
    if (typeof performance !== 'undefined' && performance.now) {
      this.activeMarks.set(key, performance.now());
    } else {
      this.activeMarks.set(key, Date.now());
    }
  }

  /**
   * Stop timing and return elapsed milliseconds.
   */
  stopTimer(key: string): number {
    const startTime = this.activeMarks.get(key);
    if (startTime === undefined) return 0;
    this.activeMarks.delete(key);

    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    return Math.max(0, Math.round(endTime - startTime));
  }

  /**
   * Record image optimization and compression metrics.
   */
  recordImageOptimization(metric: Omit<ImageOptimizationMetric, 'timestamp'>): void {
    const record: ImageOptimizationMetric = {
      ...metric,
      timestamp: Date.now(),
    };
    this.imageMetrics.push(record);
    if (this.imageMetrics.length > 100) this.imageMetrics.shift();

    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        `[Perf:Image] "${metric.fileName}": ` +
          `${(metric.originalBytes / 1024).toFixed(0)}KB -> ${(metric.optimizedBytes / 1024).toFixed(0)}KB ` +
          `(${metric.savedPercent.toFixed(1)}% saved in ${metric.compressionDurationMs}ms)`
      );
    }
  }

  /**
   * Record an animation session's FPS and dropped frame count.
   */
  recordAnimation(metric: Omit<AnimationMetric, 'timestamp'>): void {
    const record: AnimationMetric = {
      ...metric,
      timestamp: Date.now(),
    };
    this.animationMetrics.push(record);
    if (this.animationMetrics.length > 50) this.animationMetrics.shift();

    if (process.env.NODE_ENV !== 'production' && metric.droppedFrames > 2) {
      console.warn(
        `[Perf:Anim] Component ${metric.component} experienced ${metric.droppedFrames} dropped frames (FPS: ${metric.measuredFps.toFixed(1)} / ${metric.targetFps})`
      );
    }
  }

  /**
   * Record route navigation duration.
   */
  recordRouteNavigation(fromPath: string, toPath: string, durationMs: number): void {
    const record: RouteMetric = {
      fromPath,
      toPath,
      durationMs,
      timestamp: Date.now(),
    };
    this.routeMetrics.push(record);
    if (this.routeMetrics.length > 50) this.routeMetrics.shift();
  }

  /**
   * Measure FPS of a callback or continuous RAF loop over a fixed interval.
   */
  trackFps(component: string, durationMs: number = 3000): () => void {
    let frameCount = 0;
    let startTime = performance.now();
    let isTracking = true;
    let rafId: number;

    const tick = () => {
      if (!isTracking) return;
      frameCount++;
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        const measuredFps = (frameCount / elapsed) * 1000;
        const targetFrames = (durationMs / 1000) * 60;
        const droppedFrames = Math.max(0, Math.round(targetFrames - frameCount));

        this.recordAnimation({
          component,
          targetFps: 60,
          measuredFps: Math.min(60, Math.round(measuredFps * 10) / 10),
          droppedFrames,
          durationMs: Math.round(elapsed),
        });
        isTracking = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    // Return cleanup/cancel function
    return () => {
      isTracking = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }

  /**
   * Generate consolidated summary report.
   */
  getReport(): PerformanceReport {
    const totalBytesSaved = this.imageMetrics.reduce(
      (sum, m) => sum + Math.max(0, m.originalBytes - m.optimizedBytes),
      0
    );
    const avgReduction =
      this.imageMetrics.length > 0
        ? this.imageMetrics.reduce((sum, m) => sum + m.savedPercent, 0) / this.imageMetrics.length
        : 0;
    const avgCompressionMs =
      this.imageMetrics.length > 0
        ? this.imageMetrics.reduce((sum, m) => sum + m.compressionDurationMs, 0) /
          this.imageMetrics.length
        : 0;

    const avgFps =
      this.animationMetrics.length > 0
        ? this.animationMetrics.reduce((sum, a) => sum + a.measuredFps, 0) /
          this.animationMetrics.length
        : 60;
    const totalDropped = this.animationMetrics.reduce((sum, a) => sum + a.droppedFrames, 0);

    const avgRouteMs =
      this.routeMetrics.length > 0
        ? this.routeMetrics.reduce((sum, r) => sum + r.durationMs, 0) / this.routeMetrics.length
        : 0;

    return {
      timestamp: new Date().toISOString(),
      imageOptimizations: {
        totalOptimized: this.imageMetrics.length,
        totalBytesSaved,
        averageReductionPercent: Math.round(avgReduction * 10) / 10,
        averageCompressionTimeMs: Math.round(avgCompressionMs),
        metrics: [...this.imageMetrics],
      },
      animations: {
        totalSessions: this.animationMetrics.length,
        averageFps: Math.round(avgFps * 10) / 10,
        totalDroppedFrames: totalDropped,
        metrics: [...this.animationMetrics],
      },
      routeNavigations: {
        totalNavigations: this.routeMetrics.length,
        averageDurationMs: Math.round(avgRouteMs),
        metrics: [...this.routeMetrics],
      },
    };
  }
}

export const perfMonitor = new PerformanceMonitorService();

