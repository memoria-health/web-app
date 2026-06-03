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
import { cn } from '@/lib/utils/cn';
import { CameraIcon } from '@/lib/icons/cameraIcons';
import { isSensorPreparing, markSensorStarted } from '@/lib/utils/sensorState';
import type { Camera } from '@/lib/api/types';

// Single connection signal: ONLINE iff the backend has recently
// observed frames arriving (state_machine writes `online=true`
// on each detector tick; the stale-online sweeper writes
// `online=false` when frames stop). Unpaired rows can't get to
// online=true by construction (online requires a tick which
// requires CameraIngest which requires credentials), so they
// always render OFFLINE without us having to check `paired` here.
//
// `preparing` (first-connect, never been online yet) takes precedence:
// a brand-new sensor reads as STARTING UP, not OFFLINE, while it boots.
function statusFor(
  cam: Camera,
  preparing: boolean,
  appClosed: boolean,
): { label: string; tone: 'live' | 'offline' | 'preparing' | 'appClosed' } {
  // APP CLOSED is the distinct 4th state: the Memoria Sensor app isn't
  // running on the phone, so reconnect can't help — the caregiver must
  // reopen it. Wins over OFFLINE (which now strictly means reconnectable)
  // but never over a live stream. iPhone-only — Pi sensors never hit it.
  if (appClosed) return { label: 'APP CLOSED', tone: 'appClosed' };
  if (preparing) return { label: 'STARTING UP', tone: 'preparing' };
  return cam.online
    ? { label: 'ONLINE', tone: 'live' }
    : { label: 'OFFLINE', tone: 'offline' };
}

const TONE_CLASSES: Record<'live' | 'offline' | 'preparing' | 'appClosed', string> = {
  live: 'border-success/40 bg-card-alt text-success',
  offline: 'border-line bg-paper-dim text-ink4',
  preparing: 'border-warning/40 bg-card-alt text-warning',
  appClosed: 'border-warning/40 bg-card-alt text-warning',
};

// User-triggered toggle styling. Mirrors iOS's chip palette
// (terra=destructive for OFF, warning=needs-attention for HIDDEN,
// neutral for AI PAUSED) so the two surfaces look the same.
const TOGGLE_CHIP_BASE =
  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider';
const TOGGLE_DISCONNECTED = 'border-terra/40 bg-card-alt text-terra';
const TOGGLE_HIDDEN = 'border-warning/40 bg-card-alt text-warning';
const TOGGLE_AI_PAUSED = 'border-line bg-paper-dim text-ink3';

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
          (payload: RealtimePostgresUpdatePayload<Camera & { api_key_hash: string | null; ingest_token_hash: string | null }>) => {
            const updated = payload.new;
            // Realtime payload is the raw DB row, which lacks the
            // derived `paired` field but DOES include api_key_hash —
            // recompute from that so a wall phone completing the
            // /pair handshake (which sets api_key_hash) flips the
            // tile from PAIRING to LIVE/OFFLINE without a refresh.
            const next: Camera = {
              ...updated,
              paired:
                updated.api_key_hash !== null
                || updated.ingest_token_hash !== null,
            };
            setCameras((prev) =>
              prev.map((c) => (c.id === next.id ? { ...c, ...next } : c)),
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
          (payload: RealtimePostgresInsertPayload<Camera & { api_key_hash: string | null; ingest_token_hash: string | null }>) => {
            const raw = payload.new;
            const fresh: Camera = {
              ...raw,
              paired:
                raw.api_key_hash !== null
                || raw.ingest_token_hash !== null,
            };
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

  // Remember any sensor we've ever seen online (initial load + every
  // realtime update), persisted, so a sensor that has started once never
  // regresses to "preparing" after a reload — it just reads OFFLINE.
  useEffect(() => {
    for (const c of cameras) if (c.online) markSensorStarted(c.id);
  }, [cameras]);

  // `isSensorPreparing` reads localStorage, so only evaluate it after
  // mount to avoid a server/client hydration mismatch (server has no
  // localStorage and would always render the pre-started branch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function removeCamera(id: string, name: string) {
    if (
      !confirm(`Remove sensor "${name}"? This is irreversible.`)
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
      <div className="rounded-lg border border-dashed border-line bg-card px-4 py-8 text-center text-base text-ink3">
        No sensors yet. Pair one to start streaming.
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
          const preparing = mounted && isSensorPreparing(cam);
          // iPhone app shut: not online + heartbeat stopped. Backend only
          // ever sets app_present=false for iPhone sensors, so this stays
          // false for Pi. undefined (old backend) → treated as present.
          const appClosed = !cam.online && cam.app_present === false;
          const status = statusFor(cam, preparing, appClosed);
          return (
            <li
              key={cam.id}
              className="relative flex items-center gap-3 px-4 py-3 hover:bg-paper-dim/40 transition-colors"
            >
              {/* Card-link pattern: the Link is absolutely positioned
                  to fill the entire row (including the empty space
                  between the text and the action buttons), so clicking
                  anywhere except the buttons navigates. Buttons sit
                  above the link via `relative z-10`. */}
              <Link
                href={`/patients/${patientId}/cameras/${cam.id}`}
                className="absolute inset-0"
                title="Configure detectors for this sensor"
                aria-label={`Open ${cam.room}`}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <CameraIcon
                    name={cam.icon_name}
                    className="h-5 w-5 shrink-0 text-ink2"
                  />
                  <span className="font-serif text-xl text-ink">
                    {cam.room}
                  </span>
                  <span className="font-mono text-xs text-ink4 tracking-wide">
                    SENSOR {String(cam.display_id).padStart(2, '0')}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider',
                      TONE_CLASSES[status.tone],
                      status.tone === 'preparing' && 'animate-pulse',
                    )}
                  >
                    {status.label}
                  </span>
                  {/* User-triggered toggles. Independent + additive —
                      render every chip that applies. The DISCONNECTED chip
                      is suppressed while app-closed: "disconnected" now
                      strictly means the reconnectable case, and the primary
                      pill already reads APP CLOSED. */}
                  {cam.desired_state === 'disconnected' && !appClosed && (
                    <span className={cn(TOGGLE_CHIP_BASE, TOGGLE_DISCONNECTED)}>
                      DISCONNECTED
                    </span>
                  )}
                  {cam.disabled && (
                    <span className={cn(TOGGLE_CHIP_BASE, TOGGLE_HIDDEN)}>
                      HIDDEN
                    </span>
                  )}
                  {cam.ai_paused && (
                    <span className={cn(TOGGLE_CHIP_BASE, TOGGLE_AI_PAUSED)}>
                      AI PAUSED
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
                </p>
              </div>
              <button
                onClick={() => removeCamera(cam.id, cam.room)}
                disabled={removing === cam.id}
                className="relative z-10 rounded-md border border-line bg-card px-3 py-1.5 text-base text-ink2 hover:border-terra/40 hover:bg-terra-soft hover:text-terra-deep disabled:opacity-50 transition-colors"
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
