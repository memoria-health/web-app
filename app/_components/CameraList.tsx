'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/client';
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
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Subscribe to realtime camera changes so online/offline pills flip live.
  useEffect(() => {
    const supa = getBrowserSupabase();
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
    return () => {
      void supa.removeChannel(channel);
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
              <div className="flex min-w-0 flex-1 flex-col">
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
              </div>
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
