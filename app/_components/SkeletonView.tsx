'use client';

/// Client-side privacy filter for a live camera tile ("blur mode").
///
/// Takes a LiveKit video track, runs MoveNet MultiPose (bundled locally at
/// /models/movenet-multipose) IN THE BROWSER to LOCATE people, and blurs a
/// body-shaped region over each one so the room stays visible but people are
/// hidden. Nothing else is drawn.
///
/// The mask is NOT a bounding box — it's a "fat skeleton": thick capsules along
/// each limb + a filled torso + a head blob. So an outstretched arm blurs only
/// an arm-shaped strip, not a giant rectangle. Built as an offscreen alpha mask
/// and composited (destination-in) against a fully-blurred copy of the frame.
///
/// Detections persist for HOLD_MS so a momentary pose miss never un-hides
/// anyone — a privacy filter must fail SAFE (keep blurring).
///
/// The raw <video> is kept at opacity-0 UNDER the canvas (not display:none — a
/// display:none video stops decoding in Chrome, so TF.js would read blank
/// frames). Only the processed canvas is visible. TF.js is dynamically imported
/// inside the effect so it never runs during SSR/build (Next 16). DISPLAY-
/// privacy only: the raw stream still reaches the browser.

import { useEffect, useRef, useState } from 'react';

type LooseTrackRef =
  | { publication?: { track?: { attach: (el: HTMLMediaElement) => void; detach: (el: HTMLMediaElement) => void } | null } }
  | undefined;

const POSE_INTERVAL_MS = 70; // ~14 pose runs/sec; canvas still paints every frame
const BOX_KP_SCORE = 0.2;    // min keypoint confidence to use a joint
const BLUR_PX = 26;
// Mask geometry, all as a fraction of the person's "scale" (shoulder width),
// so coverage tracks how big the person is in frame.
const LIMB_W = 0.7;  // limb capsule thickness
const HEAD_R = 0.95; // head blob radius (covers face + hair generously)
const TIP_R = 0.42;  // blob at wrists/ankles so hands/feet past the last joint are covered
// PRIVACY-CRITICAL: keep blurring a person's last-known shape this long after
// the last confident sighting. A momentary miss must NOT un-hide them.
const HOLD_MS = 1600;
const SMOOTH = 0.4; // EMA factor for the single-person keypoints (0=frozen, 1=raw/jumpy)

// Flip to false before promoting to prod — the on-tile status HUD is a
// dev/diagnostic aid, not something a caregiver should see.
const SHOW_STATUS = true;

// MoveNet keypoint indices.
const NOSE = 0, L_EYE = 1, R_EYE = 2, L_EAR = 3, R_EAR = 4;
const L_SHO = 5, R_SHO = 6, L_HIP = 11, R_HIP = 12;
// Limb bones (both endpoints must be confident to draw the capsule).
const BONES: [number, number][] = [
  [5, 7], [7, 9],   // left arm
  [6, 8], [8, 10],  // right arm
  [11, 13], [13, 15], // left leg
  [12, 14], [14, 16], // right leg
  [5, 6], [11, 12], // shoulders, hips
  [5, 11], [6, 12], // torso sides
];
const TIPS = [9, 10, 15, 16]; // wrists + ankles
const FACE = [NOSE, L_EYE, R_EYE, L_EAR, R_EAR];

export function SkeletonView({ trackRef }: { trackRef: LooseTrackRef }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const track = trackRef?.publication?.track ?? null;
  const [status, setStatus] = useState('init');

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;
    let lastPoseTs = 0;
    let poseCount = 0;
    // Persisted per-person keypoints with expiry — the privacy hold. A 0-pose
    // frame never clears these; they lapse HOLD_MS after the last sighting.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let held: { kp: any[]; exp: number }[] = [];
    // EMA-smoothed keypoints for the common single-person case (kills jitter).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let smoothKp: any[] | null = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Offscreen scratch canvases: one holds the blurred frame, one the alpha mask.
    const blurCanvas = document.createElement('canvas');
    const maskCanvas = document.createElement('canvas');
    const bctx = blurCanvas.getContext('2d');
    const mctx = maskCanvas.getContext('2d');
    if (!bctx || !mctx) return;

    if (track) track.attach(video);
    else setStatus('no track');

    (async () => {
      try {
        setStatus('loading tf…');
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
        if (cancelled) { detector?.dispose?.(); return; }
        setStatus('model ready · waiting for frames…');
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[SkeletonView] init failed:', e);
        setStatus(`ERROR: ${msg}`);
      }
    })();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (k: any) => k && (k.score ?? 0) >= BOX_KP_SCORE;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

    // Person "scale" ≈ shoulder width, falling back to hip width, then to a
    // fraction of the keypoint spread. Drives all mask thicknesses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function scaleOf(kp: any[]): number {
      if (ok(kp[L_SHO]) && ok(kp[R_SHO])) return dist(kp[L_SHO], kp[R_SHO]) || 0;
      if (ok(kp[L_HIP]) && ok(kp[R_HIP])) return dist(kp[L_HIP], kp[R_HIP]) || 0;
      const pts = kp.filter(ok);
      if (pts.length < 2) return 0;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const k of pts) {
        minX = Math.min(minX, k.x); minY = Math.min(minY, k.y);
        maxX = Math.max(maxX, k.x); maxY = Math.max(maxY, k.y);
      }
      return Math.hypot(maxX - minX, maxY - minY) * 0.3;
    }

    // Paint one person's body shape (white on the mask canvas).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drawMask(kp: any[], s: number) {
      if (s <= 0) return;
      mctx!.lineCap = 'round';
      mctx!.lineJoin = 'round';
      mctx!.fillStyle = '#fff';
      mctx!.strokeStyle = '#fff';
      // Filled torso quad (shoulders → hips) so the trunk is solid.
      if (ok(kp[L_SHO]) && ok(kp[R_SHO]) && ok(kp[L_HIP]) && ok(kp[R_HIP])) {
        mctx!.beginPath();
        mctx!.moveTo(kp[L_SHO].x, kp[L_SHO].y);
        mctx!.lineTo(kp[R_SHO].x, kp[R_SHO].y);
        mctx!.lineTo(kp[R_HIP].x, kp[R_HIP].y);
        mctx!.lineTo(kp[L_HIP].x, kp[L_HIP].y);
        mctx!.closePath();
        mctx!.fill();
      }
      // Limb capsules (round-capped thick strokes).
      mctx!.lineWidth = Math.max(8, s * LIMB_W);
      for (const [a, b] of BONES) {
        if (!ok(kp[a]) || !ok(kp[b])) continue;
        mctx!.beginPath();
        mctx!.moveTo(kp[a].x, kp[a].y);
        mctx!.lineTo(kp[b].x, kp[b].y);
        mctx!.stroke();
      }
      // Head blob at the average of visible face points.
      const face = FACE.map((i) => kp[i]).filter(ok);
      if (face.length) {
        const cx = face.reduce((t, k) => t + k.x, 0) / face.length;
        const cy = face.reduce((t, k) => t + k.y, 0) / face.length;
        mctx!.beginPath();
        mctx!.arc(cx, cy, s * HEAD_R, 0, Math.PI * 2);
        mctx!.fill();
      }
      // Extremity blobs (hands/feet extend past the last joint).
      for (const i of TIPS) {
        if (!ok(kp[i])) continue;
        mctx!.beginPath();
        mctx!.arc(kp[i].x, kp[i].y, s * TIP_R, 0, Math.PI * 2);
        mctx!.fill();
      }
    }

    function render() {
      if (!video || !canvas) return;
      const W = canvas.width, H = canvas.height;
      ctx!.filter = 'none';
      ctx!.drawImage(video, 0, 0, W, H);
      const now = performance.now();
      const live = held.filter((h) => h.exp > now);
      if (!live.length) return;
      // Build the union alpha mask of every held person.
      mctx!.clearRect(0, 0, W, H);
      for (const h of live) drawMask(h.kp, scaleOf(h.kp));
      // Blurred copy of the frame, trimmed to the mask, drawn over the sharp one.
      bctx!.globalCompositeOperation = 'source-over';
      bctx!.clearRect(0, 0, W, H);
      bctx!.filter = `blur(${BLUR_PX}px)`;
      bctx!.drawImage(video, 0, 0, W, H);
      bctx!.filter = 'none';
      bctx!.globalCompositeOperation = 'destination-in';
      bctx!.drawImage(maskCanvas, 0, 0);
      bctx!.globalCompositeOperation = 'source-over';
      ctx!.drawImage(blurCanvas, 0, 0);
    }

    async function loop() {
      if (cancelled || !video || !canvas) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          blurCanvas.width = video.videoWidth; blurCanvas.height = video.videoHeight;
          maskCanvas.width = video.videoWidth; maskCanvas.height = video.videoHeight;
        }
        const now = performance.now();
        if (detector && now - lastPoseTs >= POSE_INTERVAL_MS) {
          lastPoseTs = now;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const poses: any[] = await detector.estimatePoses(video, { flipHorizontal: false });
            poseCount = poses.length;
            // Only REPLACE the hold when we actually found someone; a 0-pose
            // result leaves the previous shapes to persist (fail-safe).
            if (poses.length === 1) {
              const nk = poses[0].keypoints;
              if (smoothKp && smoothKp.length === nk.length) {
                for (let i = 0; i < nk.length; i++) {
                  smoothKp[i] = {
                    x: smoothKp[i].x + (nk[i].x - smoothKp[i].x) * SMOOTH,
                    y: smoothKp[i].y + (nk[i].y - smoothKp[i].y) * SMOOTH,
                    score: nk[i].score,
                  };
                }
              } else {
                smoothKp = nk.map((k: { x: number; y: number; score: number }) => ({ ...k }));
              }
              held = [{ kp: smoothKp!, exp: now + HOLD_MS }];
            } else if (poses.length > 1) {
              smoothKp = null;
              held = poses.map((p) => ({ kp: p.keypoints, exp: now + HOLD_MS }));
            }
            const liveN = held.filter((h) => h.exp > now).length;
            setStatus(`running · ${poseCount} seen · ${liveN} blurred`);
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
          skel: {status}
        </div>
      )}
    </div>
  );
}
