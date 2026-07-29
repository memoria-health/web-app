/// Shared, lazily-loaded COCO-SSD person detector.
///
/// Loaded ONCE per browser session and reused across every tile and every
/// on/off toggle, so flipping "Blur people" is instant after the first warm-up.
/// Call `getPersonDetector()` to use it; call it early (see PreloadVision, which
/// warms it on idle after the app is interactive) to preload. Safe to call
/// repeatedly — it returns the same in-flight-or-resolved promise. NEVER dispose
/// the returned model; it's shared.
///
/// Model: COCO-SSD with the FULL `mobilenet_v2` base (not `lite_mobilenet_v2`).
/// The blur is a privacy filter whose only hard requirement is RECALL — never
/// miss a person (over-blur is fine). The full base is materially better than
/// lite at the hard cases (turned away, seated, partial, far), which is exactly
/// where lite dropped people and the blur flickered off them. It's heavier per
/// inference, so SkeletonView runs it at a lower rate and bridges frames with an
/// IoU tracker + hold. Weights load from the tfjs model CDN (browser-cached);
/// the locally-bundled files under /models/coco-ssd are the lite weights and are
/// no longer used. A future YOLO swap would live entirely in this file.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _promise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPersonDetector(): Promise<any> {
  if (!_promise) {
    _promise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      await tf.setBackend('webgl').catch(() => tf.setBackend('cpu'));
      await tf.ready();
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      // Full base for higher recall; weights come from the tfjs CDN (cached by
      // the browser after first load) rather than the bundled lite weights.
      return cocoSsd.load({ base: 'mobilenet_v2' });
    })().catch((e) => {
      // Reset so a later call can retry after a transient load failure.
      _promise = null;
      throw e;
    });
  }
  return _promise;
}
