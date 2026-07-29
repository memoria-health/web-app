'use client';

import { useEffect, useRef, useState } from 'react';
import { usePerson } from '@/app/_components/PersonContext';

/* "Everyone" Home — the multi-patient triage board. One status card per
 * person: glow + verdict + streak line, tap to focus the whole app on them.
 * Status-first (is everyone okay?), never chart-first. */

const STYLE = {
  green: { dot: 'bg-sage', ring: 'ring-sage/30', bg: 'bg-sage-soft/50' },
  amber: { dot: 'bg-warning', ring: 'ring-warning/30', bg: 'bg-warning/10' },
  red: { dot: 'bg-terra', ring: 'ring-terra/30', bg: 'bg-terra-soft/70' },
} as const;

export function EveryoneHome({ patients }: { patients: { id: string; name: string; preferred: string }[] }) {
  const { setSelected } = usePerson();
  const [cards, setCards] = useState<Record<string, any>>({});
  const lastFetch = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => { if (Date.now() - lastFetch.current > 30_000) setTick((t) => t + 1); };
    const iv = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 120_000);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => { clearInterval(iv); window.removeEventListener('focus', bump); document.removeEventListener('visibilitychange', bump); };
  }, []);

  useEffect(() => {
    let alive = true;
    lastFetch.current = Date.now();
    patients.forEach((p) => {
      fetch(`/api/insight/home?patient=${p.id}&fast=1`)
        .then((r) => r.json())
        .then((d) => alive && setCards((c) => ({ ...c, [p.id]: d })))
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [patients, tick]);

  // urgent people float to the top
  const order = { red: 0, amber: 1, green: 2 } as Record<string, number>;
  const sorted = [...patients].sort((a, b) =>
    (order[cards[a.id]?.status?.level] ?? 3) - (order[cards[b.id]?.status?.level] ?? 3));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-6 pb-16 pt-8">
        <h1 className="font-serif text-[24px] font-semibold text-ink">Everyone</h1>
        <p className="mt-1 text-[15px] text-ink3">Tap a person to focus on them.</p>
        <div className="mt-5 space-y-3">
          {sorted.map((p) => {
            const d = cards[p.id];
            const st = d?.status;
            const s = STYLE[(st?.level ?? 'green') as keyof typeof STYLE];
            const streak = (d?.streaks ?? []).map((x: any) => `${x.value} ${x.label}`).join(' · ');
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{ animationDelay: `${sorted.indexOf(p) * 70}ms` }}
                className={`anim-up lift block w-full rounded-3xl px-6 py-5 text-left ring-1 ${s.bg} ${s.ring}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${s.dot}`} />
                  <span className="font-serif text-[19px] font-semibold text-ink">{p.preferred || p.name}</span>
                  <span className="ml-auto text-[14px] text-ink4">{d ? '' : 'checking…'}</span>
                </div>
                {st && <p className="mt-1.5 pl-[26px] text-[15px] leading-relaxed text-ink3">{st.line} — {st.sub}</p>}
                {streak && <p className="mt-1 pl-[26px] text-[13.5px] text-ink4">{streak}</p>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
