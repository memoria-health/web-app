/**
 * Web dashboard feature flags.
 *
 * Flip a value here to show/hide UI without removing any code — the gated
 * components and data still exist, they're just not rendered. These are
 * compile-time constants (no env var needed), so toggling is a one-line change.
 */

/**
 * The "Live analyses" section on the patient page (raw per-camera analysis
 * feed). Hidden for now. Set to `true` to show it again — that's the only
 * change needed; the component and its data fetch are untouched.
 */
export const SHOW_LIVE_ANALYSES = false;
