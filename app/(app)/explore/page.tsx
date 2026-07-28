'use client';

import { InsightShell } from '@/components/insight/InsightShell';
import { usePerson } from '@/app/_components/PersonContext';

/// Explore — the customizable widget dashboard.
export default function ExplorePage() {
  const { selected } = usePerson();
  return (
    <div className="h-[calc(100dvh-122px)]">
      <InsightShell view="dashboard" scope={selected === 'all' ? '' : selected} />
    </div>
  );
}
