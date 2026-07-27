'use client';

// Hard, non-skippable acceptance gate for the Terms of Service + Privacy
// Notice. Rendered by the (app) layout whenever the caregiver's
// `tos_accepted_at` is null or their accepted `tos_version` is stale. There is
// NO close/skip affordance by design — "you cannot complete signup unless you
// agree." The Agree button unlocks only after the user scrolls past the end of
// every document (a bottom sentinel becomes visible). Enforcement is also
// server-side: the backend records tos_accepted_at, and the gate re-renders on
// every load until it's set for the current version.

import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { CURRENT_TOS_VERSION } from '@/lib/legal';
import { TermsConsentModal } from './TermsConsentModal';

export function TermsGate() {
  const router = useRouter();
  // Non-skippable: no onClose. Agree stamps tos_accepted_at server-side and
  // re-renders the layout so the gate clears.
  return (
    <TermsConsentModal
      onAgree={async () => {
        await getBrowserNemara().acceptTerms(CURRENT_TOS_VERSION);
        router.refresh();
      }}
    />
  );
}
