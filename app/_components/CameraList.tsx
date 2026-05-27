'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js';
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

  // Subscribe to realtime camera changes so the tile list mirrors every
  // mutation across surfaces (iOS PATCH of `disabled`, wall-phone PATCH
  // of `desired_state`, dashboard removes, fresh pairings) without a
  // page refresh. We update local `cameras` state directly from each
  // payload — `router.refresh()` was unreliable in Next.js 16 because
  // the server-component re-render didn't always invalidate the
  // cached fetch, so the tiles kept showing stale `disabled` values.
  // The events/analyses feeds use this same direct-mutation pattern.
  //
  // Must await getAuthedBrowserSupabase — see lib/supabase/client.ts
  // for the anon-role race that drops every broadcast otherwise.
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
            event: 'UPDATE',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresUpdatePayload<Camera>) => {
            const updated = payload.new;
            setCameras((prev) =>
              prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresInsertPayload<Camera>) => {
            const fresh = payload.new;
            setCameras((prev) => {
              if (prev.some((c) => c.id === fresh.id)) return prev;
              return [...prev, fresh].sort(
                (a, b) => a.display_id - b.display_id,
              );
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'cameras',
            filter: `patient_id=eq.${patientId}`,
          },
          (payload: RealtimePostgresDeletePayload<Camera>) => {
            const removedId = payload.old.id;
            if (!removedId) return;
            setCameras((prev) => prev.filter((c) => c.id !== removedId));
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
  }, [patientId]);

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

  async function toggleAiPaused(id: string, nextAiPaused: boolean) {
    setToggling(id);
    setError(null);
    // Optimistic update — flip local state, roll back on failure.
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ai_paused: nextAiPaused } : c)),
    );
    try {
      const updated = await getBrowserNemara().updateCamera(id, {
        ai_paused: nextAiPaused,
      });
      setCameras((prev) => prev.map((c) => (c.id === id ? updated : c)));
      startTransition(() => router.refresh());
    } catch (err) {
      setCameras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ai_paused: !nextAiPaused } : c)),
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
                onClick={() => toggleAiPaused(cam.id, !cam.ai_paused)}
                disabled={toggling === cam.id || cam.disabled}
                aria-pressed={cam.ai_paused}
                title={
                  cam.ai_paused
                    ? 'AI is paused — video keeps streaming. Click to resume AI.'
                    : 'AI is running. Click to pause AI (video keeps streaming).'
                }
                className={cn(
                  'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
                  cam.ai_paused
                    ? 'border-warning/40 bg-card-alt text-warning'
                    : 'border-line bg-card text-ink2 hover:border-action/30 hover:bg-action hover:text-action-ink',
                )}
              >
                {toggling === cam.id
                  ? '…'
                  : cam.ai_paused
                    ? 'AI OFF'
                    : 'AI ON'}
              </button>
              <button
                onClick={() => toggleDisabled(cam.id, !cam.disabled)}
                disabled={toggling === cam.id}
                aria-pressed={!cam.disabled}
                title={
                  cam.disabled
                    ? 'Camera is hidden — tile is off the grid AND LLM skips. Click to show.'
                    : 'Camera is shown. Click to hide (tile leaves grid AND LLM stops).'
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
                    ? 'HIDDEN'
                    : 'SHOWN'}
              </button>
              <button
                onClick={() => removeCamera(cam.id, cam.room)}
                disabled={removing === cam.id}
                className="rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink2 hover:border-terra/40 hover:bg-terra-soft hover:text-terra-deep disabled:opacity-50 transition-colors"
              >
                {removing === cam.id ? 'Removing…' : 'Delete'}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
