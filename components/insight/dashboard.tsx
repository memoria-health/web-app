'use client';

import { Pin as PinIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GenerativeView } from '@/components/insight/charts';
import { WidgetsSection } from '@/components/insight/widgets';
import { EVENT, loadPins, unpin, type Pin } from '@/lib/insight/pins';
import type { Widget } from '@/lib/insight/widgets';

/* The dashboard IS the widget grid — every card (stat chips included) is an
 * ordinary widget: drag a chart shape in, tell the chat what it should show,
 * drag to arrange, resize, edit any widget via chat, remove. Pinned chat
 * views (snapshots) render below the grid. */
export function Dashboard({
  patients,
  onEditWidget,
  scope,
}: {
  patients: { id: string; name: string; preferred: string }[];
  onEditWidget: (w: Widget) => void;
  scope?: string; // person chip: show only this patient's widgets
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    setPins(loadPins());
    const f = () => setPins(loadPins());
    window.addEventListener(EVENT, f);
    return () => window.removeEventListener(EVENT, f);
  }, []);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <WidgetsSection patients={patients} onEdit={onEditWidget} scope={scope || undefined} />

      {pins.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink4">Pinned from chat (snapshots)</h3>
          <div className="space-y-4">
            {pins.map((p) => (
              <div key={p.id}>
                <GenerativeView spec={p.spec} />
                <div className="mt-1 flex items-center justify-between px-1">
                  <span className="text-[11px] text-ink4">
                    <PinIcon size={10} className="mr-1 inline" />
                    pinned {new Date(p.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <button onClick={() => unpin(p.id)} className="flex items-center gap-1 text-[11px] text-ink4 hover:text-terra">
                    <X size={11} /> unpin
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
