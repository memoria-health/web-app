'use client';

import { InsightShell } from '@/components/insight/InsightShell';
import { usePerson } from '@/app/_components/PersonContext';

/// Ask — the AI chat, scoped to whoever the person chip says.
export default function AskPage() {
  const { selected } = usePerson();
  return (
    <div className="h-[calc(100dvh-122px)]">
      <InsightShell view="chat" scope={selected === 'all' ? '' : selected} />
    </div>
  );
}
