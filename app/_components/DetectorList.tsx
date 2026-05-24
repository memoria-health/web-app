'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type { Detector, DetectorSensitivity } from '@/lib/api/types';

const SENSITIVITY: DetectorSensitivity[] = ['low', 'standard', 'high', 'off'];

export function DetectorList({ initial }: { initial: Detector[] }) {
  const router = useRouter();
  const [detectors, setDetectors] = useState(initial);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function patch(id: string, body: Parameters<ReturnType<typeof getBrowserNemara>['updateDetector']>[1]) {
    setPending((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const updated = await getBrowserNemara().updateDetector(id, body);
      setDetectors((prev) => prev.map((d) => (d.id === id ? updated : d)));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (detectors.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        No detectors. Built-ins should auto-seed when you add a patient.
      </div>
    );
  }

  const presets = detectors.filter((d) => d.source === 'preset');
  const customs = detectors.filter((d) => d.source === 'custom');

  return (
    <>
      {error && (
        <div className="mb-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <Section title="BUILT-IN" detectors={presets} pending={pending} patch={patch} />
      <Section
        title="CUSTOM"
        detectors={customs}
        pending={pending}
        patch={patch}
        emptyHint={
          <>
            None yet.{' '}
            <Link href="/detectors/new" className="text-emerald-400 underline">
              Create one →
            </Link>
          </>
        }
      />
    </>
  );
}

function Section({
  title,
  detectors,
  pending,
  patch,
  emptyHint,
}: {
  title: string;
  detectors: Detector[];
  pending: Set<string>;
  patch: (id: string, body: { is_on?: boolean; sensitivity?: DetectorSensitivity }) => void;
  emptyHint?: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      {detectors.length === 0 ? (
        <p className="rounded border border-dashed border-zinc-800 px-3 py-2 text-sm text-zinc-500">
          {emptyHint ?? 'None.'}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950">
          {detectors.map((d) => {
            const busy = pending.has(d.id);
            return (
              <li key={d.id} className="flex flex-col gap-2 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {d.name}
                      </span>
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                          d.category === 'safety'
                            ? 'border-red-800 bg-red-950/40 text-red-300'
                            : 'border-sky-800 bg-sky-950/40 text-sky-300',
                        )}
                      >
                        {d.category}
                      </span>
                      {d.source === 'custom' && (
                        <span className="rounded border border-emerald-800 bg-emerald-950/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                          custom
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-zinc-400">
                      {d.description}
                    </p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-wide text-zinc-600">
                      {d.shape} · {d.where_scope} · {d.when_scope}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.source === 'custom' && (
                      <Link
                        href={`/detectors/${d.id}`}
                        className="text-xs text-zinc-400 hover:text-zinc-100 underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                    )}
                    <button
                      onClick={() => patch(d.id, { is_on: !d.is_on })}
                      disabled={busy}
                      aria-pressed={d.is_on}
                      className={cn(
                        'rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50',
                        d.is_on
                          ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-400',
                      )}
                    >
                      {d.is_on ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
                {d.is_on && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      sensitivity
                    </span>
                    {SENSITIVITY.map((s) => (
                      <button
                        key={s}
                        onClick={() => patch(d.id, { sensitivity: s })}
                        disabled={busy || d.sensitivity === s}
                        className={cn(
                          'rounded px-2 py-0.5 text-[10px] uppercase tracking-wide',
                          d.sensitivity === s
                            ? 'bg-zinc-100 text-zinc-900'
                            : 'border border-zinc-800 text-zinc-400 hover:text-zinc-100',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
