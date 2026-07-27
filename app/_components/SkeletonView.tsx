'use client';

/// Client-side privacy filter for a live camera tile ("blur mode").
///
/// Runs COCO-SSD (bundled locally at /models/coco-ssd) IN THE BROWSER to detect
/// people, and blurs a padded bounding box over each one so the room stays
/// visible but people are hidden. Uses an object DETECTOR (not pose), so it
/// finds a person from any angle — front, back, side, hunched over a desk — and
/// the box is tight + stable rather than a padded keypoint span.
///
/// Detections persist for HOLD_MS so a momentary miss never un-hides anyone — a
/// privacy filter must fail SAFE (keep blurring).
///
/// The raw <video> is kept at opacity-0 UNDER the canvas (not display:none — a
/// display:none video stops decoding in Chrome, so TF.js would read blank
/// frames). Only the processed canvas is visible. TF.js is dynamically imported
/// inside the effect so it never runs during SSR/build (Next 16). DISPLAY-
/// privacy only: the raw stream still reaches the browser.

import { useEffect, useRef, useState } from 'react';
import { getPersonDetector } from '@/lib/vision/personDetector';

type LooseTrackRef =
  | { publication?: { track?: { attach: (el: HTMLMediaElement) => void; detach: (el: HTMLMediaElement) => void } | null } }
  | undefined;

const DETECT_INTERVAL_MS = 90; // ~11 detections/sec; canvas still paints every frame
const PERSON_SCORE = 0.25; // min detector confidence (matches iOS Vision floor; lower = catches turned-away, more false positives)
const MAX_BOXES = 20;
const BLUR_PX = 26;
// Padding around the detector box (fraction of box w/h). Detector boxes are
// tight; a little extra covers hair/edges. Slightly more on top for the head.
const PAD_X = 0.1;
const PAD_TOP = 0.14;
const PAD_BOTTOM = 0.06;
// PRIVACY-CRITICAL: keep blurring a person's last-known box this long after the
// last confident sighting. A momentary miss must NOT un-hide them.
const HOLD_MS = 2500;
// Sticky coverage for the single-person box: the blur GROWS instantly to cover
// (snap outward) but SHRINKS slowly (ease inward at SHRINK per detection). So a
// jittery/undersized detection frame can never momentarily uncover the person
// (the flicker fix) — coverage only ever contracts gradually once they've truly
// moved/left. Applied per box edge (left/top/right/bottom).
const SHRINK = 0.12; // fraction the box eases inward per detection when a person shrinks

// On-tile status HUD — a dev/diagnostic aid, off in prod. Flip true locally to
// watch the pipeline (model load, detections, blurred count).
const SHOW_STATUS = false;

type Box = [number, number, number, number]; // x, y, w, h

export function SkeletonView({ trackRef }: { trackRef: LooseTrackRef }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = trackRef?.publication?.track ?? null;
  const [status, setStatus] = useState('init');

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let model: any = null;
    let lastDetectTs = 0;
    let personCount = 0;
    // Persisted blur boxes with expiry — the privacy hold. A 0-person frame
    // never clears these; they lapse HOLD_MS after the last sighting.
    let held: { box: Box; exp: number }[] = [];
    // Sticky edges [left, top, right, bottom] for the single-person case.
    let smoothEdges: [number, number, number, number] | null = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (track) track.attach(video);
    else setStatus('no track');

    (async () => {
      try {
        setStatus('loading model…');
        // Shared session singleton — instant if PreloadVision already warmed it.
        model = await getPersonDetector();
        if (cancelled) return;
        setStatus('model ready · waiting for frames…');
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[SkeletonView] init failed:', e);
        setStatus(`ERROR: ${msg}`);
      }
    })();

    function pad([x, y, w, h]: Box): Box {
      const px = w * PAD_X;
      const pt = h * PAD_TOP;
      const pb = h * PAD_BOTTOM;
      return [x - px, y - pt, w + px * 2, h + pt + pb];
    }

    function render() {
      if (!video || !canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx!.filter = 'none';
      ctx!.drawImage(video, 0, 0, W, H);
      const now = performance.now();
      for (const h of held) {
        if (h.exp <= now) continue;
        const [x, y, w, hh] = h.box;
        ctx!.save();
        ctx!.beginPath();
        ctx!.rect(x, y, w, hh);
        ctx!.clip();
        ctx!.filter = `blur(${BLUR_PX}px)`;
        ctx!.drawImage(video, 0, 0, W, H);
        ctx!.restore();
      }
      ctx!.filter = 'none';
    }

    async function loop() {
      if (cancelled || !video || !canvas) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const now = performance.now();
        if (model && now - lastDetectTs >= DETECT_INTERVAL_MS) {
          lastDetectTs = now;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const preds: any[] = await model.detect(video, MAX_BOXES, PERSON_SCORE);
            const people = preds.filter((p) => p.class === 'person');
            personCount = people.length;
            const boxes: Box[] = people.map((p) => pad(p.bbox as Box));
            // Only REPLACE the hold when we actually found someone; a 0-person
            // result leaves the previous boxes to persist (fail-safe).
            if (boxes.length === 1) {
              const [x, y, w, h] = boxes[0];
              const nl = x, nt = y, nr = x + w, nb = y + h; // new edges
              if (smoothEdges) {
                const [l, t, r, b] = smoothEdges;
                // Grow instantly outward; ease inward slowly (grow-fast/shrink-slow).
                smoothEdges = [
                  nl < l ? nl : l + (nl - l) * SHRINK, // left
                  nt < t ? nt : t + (nt - t) * SHRINK, // top
                  nr > r ? nr : r + (nr - r) * SHRINK, // right
                  nb > b ? nb : b + (nb - b) * SHRINK, // bottom
                ];
              } else {
                smoothEdges = [nl, nt, nr, nb];
              }
              const [l, t, r, b] = smoothEdges;
              held = [{ box: [l, t, r - l, b - t], exp: now + HOLD_MS }];
            } else if (boxes.length > 1) {
              smoothEdges = null;
              held = boxes.map((b) => ({ box: b, exp: now + HOLD_MS }));
            }
            const live = held.filter((h) => h.exp > now).length;
            setStatus(`running · ${personCount} seen · ${live} blurred`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[SkeletonView] detect threw:', e);
            setStatus(`detect ERROR: ${msg}`);
          }
        }
        render();
      }
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      // NOTE: model is a shared session singleton — do NOT dispose it here.
      if (track) { try { track.detach(video); } catch { /* noop */ } }
    };
  }, [track]);

  return (
    <div className="absolute inset-0 h-full w-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-0"
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
      {SHOW_STATUS && (
        <div className="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] leading-tight text-emerald-300">
          blur: {status}
        </div>
      )}
    </div>
  );
}
