'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { getBrowserNemara } from '@/lib/api/client';
import { timeAgo } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import type { Camera } from '@/lib/api/types';

function statusFor(cam: Camera): { label: string; tone: 'live' | 'offline' | 'pairing' } {
  if (!cam.livekit_identity) return { label: 'PAIRING', tone: 'pairing' };
  if (cam.online) return { label: 'LIVE', tone: 'live' };
  return { label: 'OFFLINE', tone: 'offline' };
}

const TONE_CLASSES: Record<'live' | 'offline' | 'pairing', string> = {
  live: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  offline: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  pairing: 'border-yellow-800 bg-yellow-950/40 text-yellow-300',
};

export function CameraList({
  patientId,
  initial,
}: {
  patientId: string;
  initial: Camera[];
}) {
  const router = useRouter();
  const [cameras, setCameras] = useState(initial);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Subscribe to realtime camera changes so online/offline pills flip live.
  // Must await getAuthedBrowserSupabase — see lib/supabase/client.ts for
  // the anon-role race that drops every broadcast otherwise.
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`cameras:${patientId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          () => {
            // Refetch through server — keeps SSR shape canonical.
            startTransition(() => router.refresh());
          },
        )
        .subscribe();
      cleanup = () => {
        void supa.removeChannel(channel);
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [patientId, router]);

  useEffect(() => setCameras(initial), [initial]);

  async function removeCamera(id: string, name: string) {
    if (
      !confirm(`Remove camera "${name}"? This is irreversible.`)
    )
      return;
    setRemoving(id);
    setError(null);
    try {
      await getBrowserNemara().deleteCamera(id);
      setCameras((prev) => prev.filter((c) => c.id !== id));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRemoving(null);
    }
  }

  async function toggleDisabled(id: string, nextDisabled: boolean) {
    setToggling(id);
    setError(null);
    // Optimistic update — flip local state, roll back on failure.
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, disabled: nextDisabled } : c)),
    );
    try {
      const updated = await getBrowserNemara().updateCamera(id, {
        disabled: nextDisabled,
      });
      setCameras((prev) => prev.map((c) => (c.id === id ? updated : c)));
      startTransition(() => router.refresh());
    } catch (err) {
      // Roll back the optimistic flip.
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, disabled: !nextDisabled } : c)),
      );
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setToggling(null);
    }
  }

  if (cameras.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        No cameras yet. Pair one to start streaming.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <ul className="divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950">
        {cameras.map((cam) => {
          const status = statusFor(cam);
          return (
            <li key={cam.id} className="flex items-center gap-3 px-3 py-2.5">
              <Link
                href={`/cameras/${cam.id}`}
                className="flex min-w-0 flex-1 flex-col rounded -mx-1 px-1 hover:bg-zinc-900/60"
                title="Configure detectors for this camera"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-medium text-zinc-100">
                    {cam.room}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-600">
                    CAM {String(cam.display_id).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      TONE_CLASSES[status.tone],
                    )}
                  >
                    {status.label}
                  </span>
                  <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400">
                    ⚙
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {cam.livekit_identity ? (
                    <code className="font-mono">{cam.livekit_identity}</code>
                  ) : (
                    <span>not yet claimed</span>
                  )}
                  {' · '}
                  Last seen {timeAgo(cam.last_seen_at)}
                </p>
              </Link>
              <button
                onClick={() => toggleDisabled(cam.id, !cam.disabled)}
                disabled={toggling === cam.id}
                aria-pressed={!cam.disabled}
                title={
                  cam.disabled
                    ? 'Camera is OFF — LLM is skipping ticks. Click to turn ON.'
                    : 'Camera is ON. Click to turn OFF (LLM stops; LiveKit stays connected).'
                }
                className={cn(
                  'rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide disabled:opacity-50',
                  cam.disabled
                    ? 'border-zinc-700 bg-zinc-900 text-zinc-400'
                    : 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
                )}
              >
                {toggling === cam.id
                  ? '…'
                  : cam.disabled
                    ? 'OFF'
                    : 'ON'}
              </button>
              <button
                onClick={() => removeCamera(cam.id, cam.room)}
                disabled={removing === cam.id}
                className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-red-700 hover:text-red-300 disabled:opacity-50"
              >
                {removing === cam.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
