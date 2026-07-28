'use client';

import { InsightShell } from '@/components/insight/InsightShell';

/// Ask + Explore: the AI chat and the customizable widget dashboard,
/// scoped to the signed-in caregiver's patients (enforced server-side
/// in every /api/insight/* route).
export default function InsightsPage() {
  return (
    <div className="h-[calc(100dvh-61px)]">
      <InsightShell />
    </div>
  );
}
