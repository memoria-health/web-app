'use client';

/// Client-side privacy filter for a live camera tile ("blur mode").
///
/// Takes a LiveKit video track, runs MoveNet MultiPose (bundled locally at
/// /models/movenet-multipose) IN THE BROWSER purely to LOCATE people, and
/// renders to a <canvas>:
///   • background/room stays sharp,
///   • each detected person's (padded) bounding box is BLURRED.
/// No skeleton is drawn — pose is used only to find who to hide. Detections
/// persist for a hold window (HOLD_MS) so a momentary miss never un-hides
/// anyone (a privacy filter must fail SAFE, i.e. keep blurring).
///
/// The raw <video> is kept at opacity-0 UNDER the canvas (not display:none —
/// a display:none video stops decoding in Chrome, so TF.js would read blank
/// frames and never find a pose). Only the processed canvas is visible. TF.js
/// is dynamically imported inside the effect so it never runs during SSR/build
/// (Next 16). This is DISPLAY-privacy only: the raw stream still reaches the
/// browser; a determined viewer could grab it. Dignity-grade, not adversarial.

import { useEffect, useRef, useState } from 'react';

// Loose typing to avoid coupling to LiveKit's generics (mirrors how VideoGrid
// treats trackRef). We only need `.publication.track`, which exposes
// attach()/detach() on a LiveKit RemoteVideoTrack.
type LooseTrackRef =
  | { publication?: { track?: { attach: (el: HTMLMediaElement) => void; detach: (el: HTMLMediaElement) => void } | null } }
  | undefined;

const POSE_INTERVAL_MS = 70; // ~14 pose runs/sec; canvas still paints every frame
const BOX_KP_SCORE = 0.2; // min keypoint confidence to INCLUDE in the blur box (wider = safer coverage)
const BLUR_PX = 26;
// Asymmetric padding around the keypoint bbox — over-blur is safe, under-blur
// leaks a face/limb. Bottom is padded hard because a seated/occluded person's
// torso+legs produce no keypoints but still need covering.
const PAD_SIDE = 0.45; // left/right, as a fraction of box width
const PAD_TOP = 0.4;   // above the topmost keypoint (hair/head)
const PAD_BOTTOM = 1.1; // below the lowest keypoint (occluded torso/legs)
const MIN_PAD_FRAC = 0.05; // floor on padding, as a fraction of canvas width
// PRIVACY-CRITICAL: keep blurring a person's last-known box this long after the
// last confident sighting. A momentary pose miss must NOT un-hide them — the
// blur persists across dropped frames and only clears if they're truly gone.
const HOLD_MS = 1600;
const SMOOTH = 0.4; // EMA factor for the single-person box (0=frozen, 1=raw/jumpy)

// Flip to false before promoting to prod — the on-tile status HUD is a
// dev/diagnostic aid, not something a caregiver should see.
const SHOW_STATUS = true;

export function SkeletonView({ trackRef }: { trackRef: LooseTrackRef }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const track = trackRef?.publication?.track ?? null;
  // Human-readable pipeline status, surfaced as an on-tile HUD so we can SEE
  // exactly where it stalls (model load, backend, pose count, or an error).
  const [status, setStatus] = useState('init');

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;
    let lastPoseTs = 0;
    let poseCount = 0; // last estimate's pose count, for the HUD
    // Persisted blur boxes with expiry — the privacy hold. Momentary pose
    // misses never clear these; they only lapse HOLD_MS after the last sighting.
    let heldBoxes: { box: [number, number, number, number]; exp: number }[] = [];
    // EMA-smoothed box for the common single-person case (kills jitter).
    let smooth: [number, number, number, number] | null = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (track) {
      track.attach(video);
    } else {
      setStatus('no track');
    }

    (async () => {
      try {
        setStatus('loading tf…');
        // Dynamic import → keeps TF.js out of the main/SSR bundle.
        const tf = await import('@tensorflow/tfjs');
        await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
        await tf.ready();
        if (cancelled) return;
        setStatus(`tf ${tf.getBackend()} · loading model…`);
        const pose = await import('@tensorflow-models/pose-detection');
        if (cancelled) return;
        detector = await pose.createDetector(pose.SupportedModels.MoveNet, {
          modelType: pose.movenet.modelType.MULTIPOSE_LIGHTNING,
          modelUrl: '/models/movenet-multipose/model.json',
          enableTracking: false,
        });
        if (cancelled) {
          detector?.dispose?.();
          return;
        }
        setStatus('model ready · waiting for frames…');
        raf = requestAnimationFrame(loop);
      } catch (e) {
        // Surface it instead of silently degrading to raw-looking video.
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[SkeletonView] init failed:', e);
        setStatus(`ERROR: ${msg}`);
      }
    })();

    // Padded blur box around the confident keypoints. Uses the lower
    // BOX_KP_SCORE (wider coverage) and asymmetric padding — extra below to
    // cover an occluded/seated body that produces no lower keypoints.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function boxFor(keypoints: any[]): [number, number, number, number] | null {
      const pts = keypoints.filter((k) => (k.score ?? 0) >= BOX_KP_SCORE);
      if (pts.length < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const k of pts) {
        minX = Math.min(minX, k.x); minY = Math.min(minY, k.y);
        maxX = Math.max(maxX, k.x); maxY = Math.max(maxY, k.y);
      }
      const w = maxX - minX, h = maxY - minY;
      const minPad = (canvas?.width ?? 0) * MIN_PAD_FRAC;
      const padL = w * PAD_SIDE + minPad;
      const padT = h * PAD_TOP + minPad;
      const padB = h * PAD_BOTTOM + minPad;
      return [minX - padL, minY - padT, w + padL * 2, h + padT + padB];
    }

    // Draw the sharp frame, then blur every still-held box on top. No skeleton.
    function render() {
      if (!ctx || !video || !canvas) return;
      ctx.filter = 'none';
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const now = performance.now();
      for (const h of heldBoxes) {
        if (h.exp <= now) continue;
        const [x, y, w, hh] = h.box;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, hh);
        ctx.clip();
        ctx.filter = `blur(${BLUR_PX}px)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      ctx.filter = 'none';
    }

    async function loop() {
      if (cancelled || !video || !canvas) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const now = performance.now();
        if (detector && now - lastPoseTs >= POSE_INTERVAL_MS) {
          lastPoseTs = now;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poses: any[] = await detector.estimatePoses(video, { flipHorizontal: false });
            poseCount = poses.length;
            const boxes = poses
              .map((p) => boxFor(p.keypoints))
              .filter((b): b is [number, number, number, number] => b !== null);
            // Only REPLACE the hold when we actually found someone. A 0-box
            // result leaves the previous boxes to persist (fail-safe — never
            // un-hide on a momentary miss).
            if (boxes.length === 1) {
              const nb = boxes[0];
              smooth = smooth
                ? (smooth.map((v, i) => v + (nb[i] - v) * SMOOTH) as [number, number, number, number])
                : nb;
              heldBoxes = [{ box: smooth, exp: now + HOLD_MS }];
            } else if (boxes.length > 1) {
              smooth = null;
              heldBoxes = boxes.map((b) => ({ box: b, exp: now + HOLD_MS }));
            }
            const live = heldBoxes.filter((h) => h.exp > now).length;
            setStatus(`running · ${poseCount} seen · ${live} blurred`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[SkeletonView] estimatePoses threw:', e);
            setStatus(`estimate ERROR: ${msg}`);
          }
        }
        render();
      }
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      try { detector?.dispose?.(); } catch { /* noop */ }
      if (track) { try { track.detach(video); } catch { /* noop */ } }
    };
    // Re-run when the underlying track changes (placeholder → real track).
  }, [track]);

  return (
    <div className="absolute inset-0 h-full w-full">
      {/* Raw feed: laid out + composited (opacity-0, NOT display:none) so Chrome
          keeps decoding frames for TF.js, but never visible to the caregiver.
          The opaque canvas paints over it every frame. */}
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
          skel: {status}
        </div>
      )}
    </div>
  );
}
