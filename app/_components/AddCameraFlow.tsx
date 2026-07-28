'use client';

import { useEffect, useState } from 'react';
import type { RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserNemara } from '@/lib/api/client';
import { getAuthedBrowserSupabase } from '@/lib/supabase/client';
import { formatPairingCode } from '@/lib/utils/pairing';
import { countdown, isExpired } from '@/lib/utils/time';
import { CAMERA_ICON_NAMES, CameraIcon } from '@/lib/icons/cameraIcons';
import { cn } from '@/lib/utils/cn';
import { SensorSetupWizard } from './SensorSetupWizard';

type Tab = 'phone' | 'sensor';

interface Issued {
  pairing_code: string;
  expires_at: string;
  camera_id: string;
  room: string;
}

export function AddCameraFlow({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>('phone');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <TabBar tab={tab} onChange={setTab} />
      {tab === 'phone' ? (
        <PhoneCameraTab patientId={patientId} />
      ) : (
        <SensorCameraTab patientId={patientId} />
      )}
    </div>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const cls = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-action text-action-ink'
        : 'text-ink2 hover:text-ink'
    }`;
  return (
    <div
      role="tablist"
      className="flex gap-1 rounded-md border border-line bg-paper-dim p-1"
    >
      <button
        role="tab"
        aria-selected={tab === 'phone'}
        onClick={() => onChange('phone')}
        className={cls(tab === 'phone')}
      >
        Phone
      </button>
      <button
        role="tab"
        aria-selected={tab === 'sensor'}
        onClick={() => onChange('sensor')}
        className={cls(tab === 'sensor')}
      >
        Native
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Phone Camera tab. Unchanged behavior from the previous flow:
// caregiver types a room name, picks an icon, gets a 6-digit code,
// Supabase Realtime flips `paired` to true when the wall phone
// claims the row.
// ─────────────────────────────────────────────────────────────

function PhoneCameraTab({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [paired, setPaired] = useState(false);
  // Update once per second so the countdown re-renders. Sourcing
  // "now" from state instead of Date.now() in render keeps the
  // render function pure (react-hooks/set-state-in-effect).
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!issued) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [issued]);

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
      <div className="flex flex-col items-center gap-4 rounded-lg border border-success/40 bg-card-alt p-8 text-center">
        <h2 className="font-serif text-4xl tracking-tight text-ink">Paired!</h2>
        <p className="text-base text-ink2">
          The phone sensor for{' '}
          <strong className="font-medium">{issued?.room}</strong> is now
          connected.
        </p>
        <button
          onClick={() => router.replace(`/patients/${patientId}/cameras`)}
          className="rounded-md bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
        >
          View sensors
        </button>
      </div>
    );
  }

  if (issued) {
    const expired = isExpired(issued.expires_at, now);
    return (
      <div className="flex flex-col items-center gap-4 rounded border border-line bg-card p-6 text-center">
        <span className="text-xs uppercase tracking-wider text-ink3">
          Pairing code
        </span>
        <div
          className="font-mono text-6xl font-semibold tracking-widest tabular-nums text-ink"
          aria-label={`pairing code ${issued.pairing_code}`}
        >
          {formatPairingCode(issued.pairing_code)}
        </div>
        <p className="text-base text-ink3">
          Open the MemoriaSensor app on your wall phone and enter this code.
        </p>
        {expired ? (
          <p className="text-xs text-terra">
            Code expired. Go back and generate a new one.
          </p>
        ) : (
          <p className="text-xs text-ink3">
            Expires in {countdown(issued.expires_at)}. Waiting for phone to
            pair…
          </p>
        )}
        <span className="inline-flex items-center gap-2 text-xs text-ink3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          Waiting for pair
        </span>
        <Link
          href={`/patients/${patientId}/cameras`}
          className="rounded border border-line px-3 py-1.5 text-base text-ink2 hover:border-line"
        >
          Done (return to sensors)
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onCreate}
      className="flex flex-col gap-3 rounded border border-line bg-card p-6"
    >
      <label className="flex flex-col gap-1">
        <span className="text-base font-medium text-ink2">Sensor name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living room, Kitchen, Bedroom"
          maxLength={64}
          required
          className="rounded border border-line bg-paper-dim px-3 py-2 text-base text-ink placeholder-zinc-600 focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
        <span className="text-xs text-ink3">
          Room type is detected automatically — cameras in bathrooms and
          bedrooms get privacy protections by default.
        </span>
      </label>
      <IconPicker icon={icon} onChange={setIcon} />
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/patients/${patientId}/cameras`}
          className="rounded border border-line px-3 py-1.5 text-base text-ink2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 disabled:opacity-50"
        >
          {busy ? 'Generating…' : 'Generate code'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Native (Sensor) tab. The device class is branded "Memoria Sensor"
// and built on our purpose-built Raspberry-Pi hardware. Setup is a
// guided 4-step wizard (plug in → home Wi-Fi → discovery poll →
// configure). All of that logic lives in SensorSetupWizard; this tab
// is a thin wrapper so AddCameraFlow's tab switch stays unchanged.
// ─────────────────────────────────────────────────────────────

function SensorCameraTab({ patientId }: { patientId: string }) {
  return <SensorSetupWizard patientId={patientId} />;
}

// ─── Shared bits ────────────────────────────────────────────────

function IconPicker({
  icon,
  onChange,
}: {
  icon: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-base font-medium text-ink2">Icon</span>
      <div
        role="radiogroup"
        aria-label="Choose an icon"
        className="grid grid-cols-6 gap-2"
      >
        {CAMERA_ICON_NAMES.map((name) => {
          const active = icon === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={name}
              title={name}
              onClick={() => onChange(name)}
              className={cn(
                'flex aspect-square items-center justify-center rounded border transition-colors',
                active
                  ? 'border-action bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink2 hover:border-action/40 hover:text-ink',
              )}
            >
              <CameraIcon name={name} className="h-5 w-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-terra">
      {message}
    </div>
  );
}
