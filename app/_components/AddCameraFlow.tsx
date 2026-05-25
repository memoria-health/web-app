'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserNemara } from '@/lib/api/client';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { formatPairingCode } from '@/lib/utils/pairing';
import { countdown, isExpired } from '@/lib/utils/time';

interface Issued {
  pairing_code: string;
  expires_at: string;
  camera_id: string;
  room: string;
}

export function AddCameraFlow({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [paired, setPaired] = useState(false);
  const [tick, setTick] = useState(0);

  // Tick once per second so the countdown updates.
  useEffect(() => {
    if (!issued) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [issued]);

  // Subscribe to camera UPDATE; when livekit_identity appears, it's paired.
  // Must await getAuthedBrowserSupabase — see lib/supabase/client.ts for
  // the anon-role race that drops every broadcast otherwise.
  useEffect(() => {
    if (!issued) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    void (async () => {
      const supa = await getAuthedBrowserSupabase();
      if (cancelled) return;
      const channel = supa
        .channel(`pair:${issued.camera_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'cameras',
            filter: `id=eq.${issued.camera_id}`,
          },
          (
            payload: RealtimePostgresUpdatePayload<{
              livekit_identity: string | null;
            }>,
          ) => {
            if (payload.new.livekit_identity) setPaired(true);
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
  }, [issued]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await getBrowserNemara().createPairingCode(patientId, {
        room: name,
        icon_name: icon,
      });
      setIssued({ ...res, room: name });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (paired) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded border border-emerald-800 bg-emerald-950/30 p-6 text-center">
        <h2 className="text-2xl font-semibold text-emerald-400">Paired!</h2>
        <p className="text-sm text-zinc-400">
          The wall phone for <strong>{issued?.room}</strong> is now connected.
        </p>
        <button
          onClick={() => router.replace('/cameras')}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          View cameras
        </button>
      </div>
    );
  }

  if (issued) {
    const expired = isExpired(issued.expires_at, Date.now() + tick * 0);
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded border border-zinc-800 bg-zinc-950 p-6 text-center">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Pairing code
        </span>
        <div
          className="font-mono text-6xl font-semibold tracking-widest tabular-nums text-zinc-100"
          aria-label={`pairing code ${issued.pairing_code}`}
        >
          {formatPairingCode(issued.pairing_code)}
        </div>
        <p className="text-sm text-zinc-400">
          Open the Nemara camera app on your wall phone and enter this code.
        </p>
        {expired ? (
          <p className="text-xs text-red-400">
            Code expired. Go back and generate a new one.
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            Expires in {countdown(issued.expires_at)}. Waiting for phone to
            pair…
          </p>
        )}
        <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          Waiting for pair
        </span>
        <Link
          href="/cameras"
          className="rounded border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600"
        >
          Done (return to cameras)
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onCreate}
      className="mx-auto flex max-w-md flex-col gap-3 rounded border border-zinc-800 bg-zinc-950 p-6"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-300">Camera name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living room, Kitchen, Bedroom"
          maxLength={64}
          required
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-zinc-300">Icon</span>
        <select
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-600 focus:outline-none"
        >
          <option value="tv">tv</option>
          <option value="fork.knife">fork.knife</option>
          <option value="bed.double">bed.double</option>
          <option value="bathtub">bathtub</option>
          <option value="door.left.hand.open">door.left.hand.open</option>
          <option value="house">house</option>
        </select>
      </label>
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <Link
          href="/cameras"
          className="rounded border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate code'}
        </button>
      </div>
    </form>
  );
}
