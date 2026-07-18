'use client';

/// Client-side privacy filter for a live camera tile ("skeleton mode").
///
/// Takes a LiveKit video track, runs MoveNet MultiPose (bundled locally at
/// /models/movenet-multipose) IN THE BROWSER, and renders to a <canvas>:
///   • background/room stays sharp,
///   • each detected person's bounding box is BLURRED,
///   • their skeleton (keypoints + limbs) is drawn on top.
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

const POSE_INTERVAL_MS = 90; // ~11 pose runs/sec; canvas still paints every frame
const KP_SCORE = 0.3; // min keypoint confidence to draw / include in the box
const BLUR_PX = 22;
const BOX_PAD = 0.18; // pad the keypoint bbox outward so the whole body is covered

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
    let adjacent: number[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastPoses: any[] = [];
    let lastPoseTs = 0;
    let poseCount = 0; // last non-throwing estimate's pose count, for the HUD

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
        adjacent = pose.util.getAdjacentPairs(pose.SupportedModels.MoveNet);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function boxFor(keypoints: any[]): [number, number, number, number] | null {
      const pts = keypoints.filter((k) => (k.score ?? 0) >= KP_SCORE);
      if (pts.length < 2) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const k of pts) {
        minX = Math.min(minX, k.x); minY = Math.min(minY, k.y);
        maxX = Math.max(maxX, k.x); maxY = Math.max(maxY, k.y);
      }
      const w = maxX - minX, h = maxY - minY;
      const px = w * BOX_PAD, py = h * BOX_PAD;
      return [minX - px, minY - py, w + px * 2, h + py * 2];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function render(poses: any[]) {
      if (!ctx || !video || !canvas) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Blur each person's box (clip to the box, redraw the whole frame blurred).
      for (const p of poses) {
        const box = boxFor(p.keypoints);
        if (!box) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(box[0], box[1], box[2], box[3]);
        ctx.clip();
        ctx.filter = `blur(${BLUR_PX}px)`;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      // Skeleton on top.
      ctx.lineWidth = Math.max(2, canvas.width / 400);
      ctx.strokeStyle = 'rgba(80,220,160,0.95)';
      ctx.fillStyle = 'rgba(80,220,160,0.95)';
      for (const p of poses) {
        const kp = p.keypoints;
        for (const [i, j] of adjacent) {
          const a = kp[i], b = kp[j];
          if ((a?.score ?? 0) < KP_SCORE || (b?.score ?? 0) < KP_SCORE) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        const r = Math.max(2, canvas.width / 300);
        for (const k of kp) {
          if ((k.score ?? 0) < KP_SCORE) continue;
          ctx.beginPath();
          ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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
            lastPoses = await detector.estimatePoses(video, { flipHorizontal: false });
            poseCount = lastPoses.length;
            setStatus(`running · ${poseCount} pose${poseCount === 1 ? '' : 's'}`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[SkeletonView] estimatePoses threw:', e);
            setStatus(`estimate ERROR: ${msg}`);
          }
        }
        render(lastPoses);
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
