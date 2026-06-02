'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { CAMERA_ICON_NAMES, CameraIcon } from '@/lib/icons/cameraIcons';
import { cn } from '@/lib/utils/cn';
import type { DiscoveredCamera } from '@/lib/api/types';

// ─────────────────────────────────────────────────────────────
// SensorSetupWizard — the 4-step "Native" (Pi) setup flow.
//
// Mirrors the step-index + dot-indicator state-machine pattern from
// OnboardingModal.tsx (there is no shared wizard primitive, so the
// pattern is reproduced here intentionally).
//
// Web caveat vs. iOS: the browser has NO hotspot API and NO captive-
// portal success signal, so steps 1–2 are INSTRUCTION-ONLY — the
// caregiver joins the "Memoria-Setup-XXXXXX" network and configures
// home Wi-Fi manually, then taps Continue. Step 3 lifts the existing
// discovery poll (GET /v1/cameras/discovered) from the old
// SensorCameraTab; step 4 reuses the provisionSensorCamera POST.
// ─────────────────────────────────────────────────────────────

// Lifted verbatim from the old SensorCameraTab useEffect.
const SENSOR_POLL_INTERVAL_MS = 3000;

type StepIndex = 0 | 1 | 2 | 3;

const STEP_TITLES = [
  'Set up your Memoria Sensor',
  'Enter your home Wi-Fi',
  'Sensor is joining your network',
  'Memoria Sensor configured',
] as const;

export function SensorSetupWizard({ patientId }: { patientId: string }) {
  const [step, setStep] = useState<StepIndex>(0);
  // The discovered Pi the caregiver is provisioning. Set when step 3
  // auto-advances (single match) or when the caregiver picks from a
  // list (multiple matches), then consumed by the step-4 assign form.
  const [chosen, setChosen] = useState<DiscoveredCamera | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <StepHeader step={step} />

      {step === 0 && <StepPlugIn onContinue={() => setStep(1)} />}
      {step === 1 && (
        <StepHomeWifi onBack={() => setStep(0)} onContinue={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepJoining
          onBack={() => setStep(1)}
          onFound={(pi) => {
            setChosen(pi);
            setStep(3);
          }}
        />
      )}
      {step === 3 && chosen && (
        <StepConfigured
          patientId={patientId}
          discovery={chosen}
          onAddAnother={() => {
            setChosen(null);
            setStep(0);
          }}
        />
      )}

      <Dots step={step} />
    </div>
  );
}

// ─── Step chrome ────────────────────────────────────────────────

function StepHeader({ step }: { step: StepIndex }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        Step {step + 1} of {STEP_TITLES.length}
      </span>
      <h2 className="font-serif text-2xl tracking-tight text-ink">
        {STEP_TITLES[step]}
      </h2>
    </div>
  );
}

// Progress dots — same look as OnboardingModal.tsx.
function Dots({ step }: { step: StepIndex }) {
  return (
    <div className="flex items-center justify-center gap-1.5 pt-1">
      {STEP_TITLES.map((_, i) => (
        <span
          key={i}
          className={
            i === step
              ? 'h-1.5 w-5 rounded-full bg-action transition-all'
              : 'h-1.5 w-1.5 rounded-full bg-line transition-all'
          }
        />
      ))}
    </div>
  );
}

// ─── Step 1 — plug in (instruction only) ───────────────────────

function StepPlugIn({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-card p-6 text-base text-ink2">
      <p>
        Plug your Memoria Sensor into power and wait about 30 seconds for it
        to boot.
      </p>
      <p>
        Once it&apos;s ready, the sensor broadcasts a temporary setup Wi-Fi
        network named{' '}
        <strong className="font-medium text-ink">Memoria-Setup-XXXXXX</strong>{' '}
        (the X&apos;s are the sensor&apos;s ID).
      </p>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — home Wi-Fi (instruction only, manual Continue) ────

function StepHomeWifi({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-card p-6 text-base text-ink2">
      <ol className="list-decimal space-y-2 pl-5 text-ink3">
        <li>
          On this device, open Wi-Fi settings and join the network named{' '}
          <strong className="font-medium text-ink">
            Memoria-Setup-XXXXXX
          </strong>
          .
        </li>
        <li>
          A setup page should open automatically. If it doesn&apos;t, open a
          browser and visit{' '}
          <code className="rounded bg-paper-dim px-1 py-0.5 text-xs">
            192.168.4.1
          </code>
          .
        </li>
        <li>
          Pick your home Wi-Fi network and enter its password. The sensor will
          join your network and the &quot;Memoria-Setup&quot; network will
          disappear.
        </li>
        <li>
          Reconnect this device to your home Wi-Fi, then tap Continue.
        </li>
      </ol>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-line px-3 py-1.5 text-base text-ink2"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — joining / discovery poll ─────────────────────────

function StepJoining({
  onBack,
  onFound,
}: {
  onBack: () => void;
  onFound: (pi: DiscoveredCamera) => void;
}) {
  const [discovered, setDiscovered] = useState<DiscoveredCamera[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Discovery poll lifted from the old SensorCameraTab useEffect: hit
  // GET /v1/cameras/discovered every SENSOR_POLL_INTERVAL_MS. When a
  // single pi appears, auto-advance to step 4; when more than one, let
  // the caregiver pick by device_label (no auto-advance).
  useEffect(() => {
    let cancelled = false;
    let advanced = false;
    async function poll() {
      try {
        const res = await getBrowserNemara().listDiscoveredCameras();
        if (cancelled) return;
        setDiscovered(res.pis);
        setError(null);
        if (!advanced && res.pis.length === 1) {
          advanced = true;
          onFound(res.pis[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    void poll();
    const id = setInterval(poll, SENSOR_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [onFound]);

  const multiple = discovered !== null && discovered.length > 1;

  return (
    <div className="flex flex-col gap-3 rounded border border-line bg-card p-6">
      {error && <ErrorBanner message={error} />}

      {multiple ? (
        <>
          <p className="text-base text-ink2">
            More than one Memoria Sensor is online. Pick the one you just set
            up.
          </p>
          <ul className="flex flex-col gap-1.5">
            {discovered!.map((d) => (
              <li key={d.discovery_id}>
                <button
                  type="button"
                  onClick={() => onFound(d)}
                  className="flex w-full items-center justify-between rounded border border-line bg-paper-dim px-3 py-2.5 text-left hover:border-action"
                >
                  <span className="text-base text-ink">{d.device_label}</span>
                  <span className="text-xs text-ink3">Select →</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-action" />
          <p className="text-base text-ink2">This can take up to a minute…</p>
        </div>
      )}

      <div className="flex items-center justify-start">
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-line px-3 py-1.5 text-base text-ink2"
        >
          Go back to Wi-Fi setup
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — configured (assign form + success card) ──────────

function StepConfigured({
  patientId,
  discovery,
  onAddAnother,
}: {
  patientId: string;
  discovery: DiscoveredCamera;
  onAddAnother: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tv');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);

  // SensorAssignForm logic, lifted: room + icon + provisionSensorCamera
  // -> POST .../pi-provision. On success we DON'T silently router.replace
  // (the old behavior); we show an explicit success card mirroring the
  // phone tab's "Paired!" block.
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await getBrowserNemara().provisionSensorCamera(patientId, {
        room: name,
        icon_name: icon,
        discovery_id: discovery.discovery_id,
      });
      setPaired(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (paired) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-success/40 bg-card-alt p-8 text-center">
        <h2 className="font-serif text-4xl tracking-tight text-ink">
          Configured!
        </h2>
        <p className="text-base text-ink2">
          <strong className="font-medium">{name}</strong> has been added. It
          will come online shortly.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddAnother}
            className="rounded-md border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-paper-dim transition-colors"
          >
            Add another
          </button>
          <button
            type="button"
            onClick={() => router.push(`/patients/${patientId}/cameras`)}
            className="rounded-md bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 transition-colors"
          >
            View sensors
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded border border-line bg-card p-6"
    >
      <div className="rounded border border-line bg-paper-dim px-3 py-2">
        <span className="text-xs uppercase tracking-wider text-ink3">
          Configuring
        </span>
        <p className="text-base text-ink">{discovery.device_label}</p>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-base font-medium text-ink2">Sensor name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living room, Kitchen, Bedroom"
          maxLength={64}
          required
          autoFocus
          className="rounded border border-line bg-paper-dim px-3 py-2 text-base text-ink placeholder-zinc-600 focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>
      <IconPicker icon={icon} onChange={setIcon} />
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 disabled:opacity-50"
        >
          {busy ? 'Configuring…' : 'Finish setup'}
        </button>
      </div>
    </form>
  );
}

// ─── Shared bits (local copies; mirror AddCameraFlow.tsx) ───────

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
