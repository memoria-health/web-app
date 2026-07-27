/// Shared, lazily-loaded COCO-SSD person detector.
///
/// Loaded ONCE per browser session and reused across every tile and every
/// on/off toggle, so flipping "Blur people" is instant after the first warm-up.
/// Call `getPersonDetector()` to use it; call it early (see PreloadVision, which
/// warms it on idle after the app is interactive) to preload. Safe to call
/// repeatedly — it returns the same in-flight-or-resolved promise. NEVER dispose
/// the returned model; it's shared.

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
      return cocoSsd.load({
        base: 'lite_mobilenet_v2',
        modelUrl: '/models/coco-ssd/model.json',
      });
    })().catch((e) => {
      // Reset so a later call can retry after a transient load failure.
      _promise = null;
      throw e;
    });
  }
  return _promise;
}
