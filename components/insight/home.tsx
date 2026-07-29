'use client';

import { ChevronDown, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* The FAMILY view. Design rules (deliberately strict):
 *  - answers, not charts — no axes anywhere on this screen
 *  - three status colors ever: sage (fine), warning (look), terra (now)
 *  - resting page is calm neutrals; terracotta appears ONLY for urgency
 *  - body text ≥16px — this audience is 50+ reading without glasses
 *  - nothing important behind hover
 *  - previews (data we don't collect yet) are shown but labeled honestly */

const DAY_LABEL = (day: string) => {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return 'Today';
  if (day === yest) return 'Yesterday';
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

const STATUS_STYLE = {
  green: { dot: 'bg-sage', ring: 'ring-sage/30', bg: 'bg-sage-soft/60' },
  amber: { dot: 'bg-warning', ring: 'ring-warning/30', bg: 'bg-warning/10' },
  red: { dot: 'bg-terra', ring: 'ring-terra/30', bg: 'bg-terra-soft/70' },
} as const;

export function FamilyHome({ patients, fixedPatient }: { patients: { id: string; name: string; preferred: string }[]; fixedPatient?: string }) {
  const [pid, setPid] = useState<string | null>(fixedPatient ?? null);
  const [data, setData] = useState<any>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const lastFetch = useRef(0);
  const [tick, setTick] = useState(0);



  useEffect(() => {
    const bump = () => { if (Date.now() - lastFetch.current > 30_000) setTick((t) => t + 1); };
    const iv = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 120_000);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => { clearInterval(iv); window.removeEventListener('focus', bump); document.removeEventListener('visibilitychange', bump); };
  }, []);

  useEffect(() => { if (fixedPatient && pid !== fixedPatient) { setPid(fixedPatient); setData(null); } }, [fixedPatient, pid]);

  // briefing is cached per patient+day — data refreshes shouldn't re-write prose
  const briefKey = useRef('');
  useEffect(() => {
    let alive = true;
    lastFetch.current = Date.now();
    // fast=1 skips the LLM: verdict/streaks/feed paint in one DB round-trip,
    // then the briefing prose arrives separately and fades in
    fetch(pid ? `/api/insight/home?patient=${pid}&fast=1` : '/api/insight/home?fast=1')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setData((prev: any) => ({ ...d, briefing: prev?.patient?.id === d?.patient?.id ? prev?.briefing ?? null : null }));
        if (!pid && d?.patient?.id) setPid(d.patient.id);
        const key = `${d?.patient?.id}:${new Date().toISOString().slice(0, 10)}`;
        if (d?.facts && briefKey.current !== key) {
          fetch('/api/insight/briefing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ facts: d.facts }) })
            .then((r) => r.json())
            .then((b) => {
              if (!alive || !b?.briefing) return;
              // mark done only on SUCCESS — marking up-front made React's
              // dev double-effect discard the first fetch and skip the second
              briefKey.current = key;
              setData((prev: any) => (prev?.patient?.id === d.patient.id ? { ...prev, briefing: b.briefing } : prev));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [pid, tick]);

  if (!patients.length) return <div className="p-10 text-[16px] text-ink4">Setting things up…</div>;

  const name = data?.patient?.name ?? (patients.find((p) => p.id === pid)?.preferred || '');
  const st = data?.status;
  const style = STATUS_STYLE[(st?.level ?? 'green') as keyof typeof STATUS_STYLE];

  // group feed by day
  const days: { day: string; items: any[] }[] = [];
  for (const f of data?.feed ?? []) {
    const last = days[days.length - 1];
    if (last && last.day === f.day) last.items.push(f);
    else days.push({ day: f.day, items: [f] });
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl px-6 pb-16 pt-8">
        {/* whose home — only a control at all when there's more than one */}
        {patients.length > 1 && !fixedPatient ? (
          <label className="relative mb-5 inline-flex items-center">
            <select
              value={pid ?? ''}
              onChange={(e) => { setPid(e.target.value); setData(null); }}
              className="appearance-none rounded-full border border-line bg-card py-2 pl-4 pr-9 text-[15px] font-medium text-ink2 outline-none"
            >
              {patients.map((p) => <option key={p.id} value={p.id}>{p.preferred || p.name}</option>)}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 text-ink4" />
          </label>
        ) : null}

        {!data ? (
          <div className="py-24 text-center text-[16px] text-ink4">Checking in on {name || 'things'}…</div>
        ) : data.error ? (
          <div className="py-24 text-center text-[16px] text-ink4">Couldn’t reach the house right now — trying again shortly.</div>
        ) : (
          <>
            {/* ① the verdict — the only thing many visits will ever need */}
            <div className={`anim-up rounded-3xl ${style.bg} px-7 py-6 ring-1 ${style.ring}`}>
              <div className="flex items-center gap-3.5">
                <span className={`h-4 w-4 shrink-0 rounded-full ${style.dot} ${st.level === 'green' ? 'animate-pulse [animation-duration:3s]' : ''}`} />
                <h1 className="font-serif text-[26px] font-semibold leading-tight text-ink">{st.line}</h1>
              </div>
              <p className="mt-2 pl-[30px] text-[16px] leading-relaxed text-ink3">{st.sub}</p>
              <p className="mt-1 pl-[30px] text-[14px] text-ink4">{st.camsSub}</p>
            </div>

            {/* ② the briefing — what you'd tell your sibling on the phone */}
            {data.briefing ? (
              <p className="anim-up mt-7 font-serif text-[19px] leading-[1.65] text-ink2" style={{ animationDelay: '60ms' }}>{data.briefing}</p>
            ) : (
              <div className="mt-7 space-y-2.5" aria-hidden>
                <div className="h-[15px] w-11/12 animate-pulse rounded bg-card-alt" />
                <div className="h-[15px] w-3/4 animate-pulse rounded bg-card-alt" />
              </div>
            )}

            {/* ③ streaks — the numbers families actually quote */}
            <div className="anim-up mt-7 grid grid-cols-2 gap-4" style={{ animationDelay: '120ms' }}>
              {data.streaks.map((s: any) => (
                <div key={s.label} className="rounded-2xl bg-card px-5 py-4 ring-1 ring-line/60">
                  <div className="font-serif text-[34px] font-semibold leading-none text-ink">{s.value}</div>
                  <div className="mt-1.5 text-[15px] leading-snug text-ink3">{s.label}</div>
                </div>
              ))}
            </div>

            {/* wake line, when we know it */}
            {data.wake && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-card px-5 py-4 ring-1 ring-line/60">
                <Sun size={20} className="shrink-0 text-warning" />
                <p className="text-[16px] text-ink2">
                  {data.wake.time ? <>Up at <span className="font-semibold">{data.wake.time}</span>{data.wake.note ? <span className="text-ink3"> — {data.wake.note}</span> : null}</> : <span className="text-ink3">{data.wake.note}</span>}
                </p>
              </div>
            )}

            {/* ④ previews — the shape of what's coming, labeled honestly */}
            <div className="anim-up mt-8" style={{ animationDelay: '180ms' }}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink4">Coming soon</h2>
                <span className="text-[12px] text-ink4">example numbers — not live yet</span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-3">
                {data.preview.map((pv: any) => (
                  <div key={pv.label} className="rounded-2xl border border-dashed border-line bg-card/50 px-4 py-3.5 opacity-80">
                    <div className="text-[13px] leading-snug text-ink4">{pv.label}</div>
                    <div className="mt-1 font-serif text-[22px] font-semibold text-ink3">{pv.value}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-ink4">{pv.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ⑤ the feed — what happened, in sentences */}
            <div className="anim-up mt-9" style={{ animationDelay: '240ms' }}>
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink4">Recent moments</h2>
              {days.length === 0 && (
                <p className="mt-3 text-[16px] text-ink3">A quiet stretch — nothing unusual to report.</p>
              )}
              {days.map((d) => (
                <div key={d.day} className="mt-5">
                  <h3 className="text-[15px] font-semibold text-ink2">{DAY_LABEL(d.day)}</h3>
                  <div className="mt-2 space-y-2">
                    {d.items.map((f: any, i: number) => {
                      const k = `${d.day}:${i}`;
                      return (
                        <button
                          key={k}
                          onClick={() => setOpenItem(openItem === k ? null : k)}
                          className={`lift block w-full rounded-2xl px-5 py-3.5 text-left ring-1 ${
                            f.serious ? 'bg-terra-soft/50 ring-terra/25' : 'bg-card ring-line/60 hover:ring-line'
                          }`}
                        >
                          <div className="flex items-baseline gap-3">
                            <span className="w-[74px] shrink-0 text-[14px] tabular-nums text-ink4">{f.time}</span>
                            <span className="flex-1 text-[16px] leading-relaxed text-ink2">{f.text}</span>
                            {f.night && <Moon size={14} className="mt-1 shrink-0 text-sky" />}
                          </div>
                          {openItem === k && f.detail && (
                            <p className="mt-2 pl-[86px] text-[14.5px] leading-relaxed text-ink3">{f.detail}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
