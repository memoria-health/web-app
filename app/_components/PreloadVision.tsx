'use client';

import { useEffect } from 'react';
import { getPersonDetector } from '@/lib/vision/personDetector';

/// Eager-but-deferred warm-up for the "Blur people" person detector.
///
/// Mounted once in the signed-in app shell. It does NOT block first paint —
/// it waits for the browser to go idle (requestIdleCallback, or a short
/// setTimeout fallback) AFTER the dashboard is interactive, then downloads +
/// initialises the shared COCO-SSD model in the background. By the time a
/// caregiver flips blur on, the model is already in memory, so it's instant.
/// The model is a session singleton, so this runs its real work only once.
export function PreloadVision() {
  useEffect(() => {
    let cancelled = false;
    const warm = () => {
      if (!cancelled) void getPersonDetector().catch(() => {});
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ric: any = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      const handle = ric(warm, { timeout: 4000 });
      return () => {
        cancelled = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).cancelIdleCallback?.(handle);
      };
    }
    // Fallback for browsers without requestIdleCallback (e.g. Safari): defer
    // past the initial render so we never compete with first paint.
    const t = setTimeout(warm, 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return null;
}
