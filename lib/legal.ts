// Single source of truth for the legal-document acceptance gate.
//
// Bump CURRENT_TOS_VERSION whenever the Terms or Privacy PDF changes
// materially: the accept-terms gate re-prompts any caregiver whose stored
// `tos_version` doesn't match this string. Keep it in sync with the iOS
// app's constant and the files in public/legal/.
export const CURRENT_TOS_VERSION = '2026-07-26-placeholder';

// The documents shown in the gate, in scroll order. `url` is a same-origin
// static asset under public/legal/ — swap these files for the finalized PDFs.
export const LEGAL_DOCS = [
  { key: 'terms', title: 'Terms of Service', url: '/legal/terms.pdf' },
  { key: 'privacy', title: 'Privacy Notice', url: '/legal/privacy.pdf' },
] as const;
