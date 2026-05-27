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
  live: 'border-success/40 bg-card-alt text-success',
  offline: 'border-line bg-paper-dim text-ink4',
  pairing: 'border-warning/40 bg-card-alt text-warning',
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
      <div className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-base text-ink3">
        No cameras yet. Pair one to start streaming.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-3 rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}
      <ul className="divide-y divide-line rounded-lg border border-line bg-card overflow-hidden">
        {cameras.map((cam) => {
          const status = statusFor(cam);
          return (
            <li key={cam.id} className="flex items-center gap-3 px-4 py-3">
              <Link
                href={`/cameras/${cam.id}`}
                className="flex min-w-0 flex-1 flex-col rounded -mx-1 px-1 hover:bg-paper-dim/60 transition-colors"
                title="Configure detectors for this camera"
              >
                <div className="flex items-center gap-2">
                  <span className="font-serif text-xl text-ink">
                    {cam.room}
                  </span>
                  <span className="font-mono text-xs text-ink4 tracking-wide">
                    CAM {String(cam.display_id).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider',
                      TONE_CLASSES[status.tone],
                    )}
                  >
                    {status.label}
                  </span>
                  {cam.source_type === 'sensor' && (
                    <span
                      className="inline-flex items-center gap-1 rounded-sm border border-line bg-paper-dim px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink3"
                      title="Sensor Camera (powered by a Nemara Pi)"
                    >
                      SENSOR
                    </span>
                  )}
                  <span className="text-xs text-ink4">⚙</span>
                </div>
                <p className="mt-1 font-mono text-xs text-ink4 tracking-wide">
                  {cam.livekit_identity ? (
                    <code>{cam.livekit_identity}</code>
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
                  'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
                  cam.disabled
                    ? 'border-line bg-paper-dim text-ink3'
                    : 'border-action/30 bg-action text-action-ink',
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
                className="rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink2 hover:border-terra/40 hover:bg-terra-soft hover:text-terra-deep disabled:opacity-50 transition-colors"
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
