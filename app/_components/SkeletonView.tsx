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

const DETECT_INTERVAL_MS = 130; // ~7-8 detections/sec. mobilenet_v2 is heavier than lite; the IoU tracker + hold below bridge the gaps so coverage stays smooth at a lower rate.
// LOW confidence floor on purpose. This is a privacy filter: the ONLY hard
// requirement is never to miss a person (over-blur is fine). We accept more
// false positives to catch turned-away / seated / partial / far people that a
// higher floor drops.
const PERSON_SCORE = 0.15;
const MAX_BOXES = 20;
const BLUR_PX = 36;
// Uniform padding (fraction of box w/h) on all four sides. The blur sits well
// proud of the body so a slightly-undersized/lagging box never leaves a sliver
// visible. This margin is what lets us low-pass the box (below) for a calm feed
// without risking an uncover.
const PAD = 0.26;
// PRIVACY-CRITICAL: keep blurring a track this long after its last confident
// sighting, to bridge brief detection gaps. Kept short so a person who has left
// un-blurs quickly.
const HOLD_MS = 1500;
// Symmetric low-pass (EMA) factor: the box eases toward each new detection this
// fraction per detection, in BOTH directions. COCO-SSD's boxes jitter frame to
// frame; easing (rather than snapping to every frame) filters that into a calm,
// steady box like the iOS feed. Lower = calmer but slower to follow motion;
// the generous padding above covers the lag so easing never uncovers.
const SMOOTH = 0.3;
// Min IoU for a new detection to count as the SAME person as an existing track
// (otherwise it spawns a new track). Low, because boxes jump frame-to-frame.
const IOU_MATCH = 0.2;

// On-tile status HUD — a dev/diagnostic aid, off in prod. Flip true locally to
// watch the pipeline (model load, detections, blurred count).
const SHOW_STATUS = false;

type Box = [number, number, number, number]; // x, y, w, h
type Edges = [number, number, number, number]; // l, t, r, b

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
    // Active person tracks with per-track expiry — the privacy hold. Each track
    // is an axis-aligned box in [left, top, right, bottom] pixels. A 0-person
    // frame clears nothing; a track lapses HOLD_MS after its last sighting.
    let tracks: { edges: Edges; exp: number }[] = [];

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

    // Pad the raw detector box uniformly and return it as edges [l, t, r, b].
    function padEdges([x, y, w, h]: Box): Edges {
      const px = w * PAD, py = h * PAD;
      return [x - px, y - py, x + w + px, y + h + py];
    }
    // Intersection-over-union of two edge-boxes.
    function iou(a: Edges, b: Edges): number {
      const iw = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
      const ih = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
      const inter = iw * ih;
      const areaA = (a[2] - a[0]) * (a[3] - a[1]);
      const areaB = (b[2] - b[0]) * (b[3] - b[1]);
      const union = areaA + areaB - inter;
      return union > 0 ? inter / union : 0;
    }

    function render() {
      if (!video || !canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx!.filter = 'none';
      ctx!.drawImage(video, 0, 0, W, H);
      const now = performance.now();
      for (const tr of tracks) {
        if (tr.exp <= now) continue;
        const [l, t, r, b] = tr.edges;
        ctx!.save();
        ctx!.beginPath();
        ctx!.rect(l, t, r - l, b - t);
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
            const detections: Edges[] = people.map((p) => padEdges(p.bbox as Box));
            // Greedy IoU tracking. Match each detection to the best-overlapping
            // existing track: matched → move that track (grow-fast/shrink-slow)
            // and refresh its hold; unmatched detection → spawn a new track;
            // unmatched track → left untouched so it persists until its hold
            // lapses (a 0-person frame therefore un-covers nobody — fail-safe).
            const usedTracks = new Set<number>();
            for (const d of detections) {
              let best = -1;
              let bestIou = IOU_MATCH;
              for (let i = 0; i < tracks.length; i++) {
                if (usedTracks.has(i)) continue;
                const v = iou(d, tracks[i].edges);
                if (v > bestIou) {
                  bestIou = v;
                  best = i;
                }
              }
              if (best >= 0) {
                usedTracks.add(best);
                const [l, t, r, b] = tracks[best].edges;
                const [nl, nt, nr, nb] = d;
                // Symmetric low-pass toward the new detection on every edge —
                // filters COCO-SSD's per-frame jitter into a steady box.
                tracks[best].edges = [
                  l + (nl - l) * SMOOTH, // left
                  t + (nt - t) * SMOOTH, // top
                  r + (nr - r) * SMOOTH, // right
                  b + (nb - b) * SMOOTH, // bottom
                ];
                tracks[best].exp = now + HOLD_MS;
              } else {
                tracks.push({ edges: d, exp: now + HOLD_MS });
              }
            }
            // Drop lapsed tracks (held past HOLD_MS since their last sighting).
            tracks = tracks.filter((t) => t.exp > now);
            setStatus(`running · ${personCount} seen · ${tracks.length} blurred`);
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
