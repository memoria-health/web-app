'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import type { Camera, Detector, ScheduleConfig } from '@/lib/api/types';
import { DetectorEditor } from './DetectorEditor';
import { CustomDetectorBetaNotice } from './CustomDetectorBetaNotice';

/// Unified custom-detector creation.
///
/// Type a plain-English prompt, hit ✦ Generate — that infers the detector AND
/// creates it as a draft (OFF), then compiles it. The very same DetectorEditor
/// used on the detail page renders inline on the fresh draft, so "create" IS
/// "edit": the caregiver sees What Memoria looks for, iterates with the same
/// "Ask for a change" refine loop, tweaks every setting, then turns it on — no
/// hop to a second screen, and create/edit can never drift because they're the
/// one component.
///
/// A draft row is written the moment Generate is clicked (that's the "generate"
/// the caregiver asked for). Abandoning leaves an OFF draft, which is harmless
/// and deletable from the editor.

export function DetectorCreateFlow({
  patientId,
  cameras,
}: {
  patientId: string;
  cameras: Camera[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once Generate has inferred + created the draft. From here on the
  // editor owns the surface.
  const [draft, setDraft] = useState<Detector | null>(null);

  async function generate() {
    if (!prompt.trim()) {
      setError('Describe what you want to detect first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const api = getBrowserNemara();
      // 1. Infer the fields so the created draft carries the right trigger /
      //    category / schedule from birth (the editor initializes from them).
      const inf = await api.inferDetector({
        name: name.trim() || undefined,
        prompt: prompt.trim(),
      });
      const schedule_config: ScheduleConfig | null =
        inf.alert_trigger === 'absence' ? inf.schedule_config ?? null : null;
      // 2. Create it OFF. The backend compiles the criteria asynchronously;
      //    the editor polls for them (identifier === null → still compiling).
      // Alert-meaning naming (2026-07-28): event titles read
      // "Possible <name>", so absence detectors must be named as the
      // MISS. Prefer the compiler's suggested name whenever it offers
      // one — it echoes a fine user name and rewrites a misleading one.
      const created = await api.createDetector(patientId, {
        name: inf.suggested_name?.trim() || name.trim() || 'Custom detector',
        custom_prompt: prompt.trim(),
        description: 'Custom detector',
        category: inf.category,
        alert_trigger: inf.alert_trigger,
        is_sustained: inf.is_sustained,
        duration_seconds:
          inf.alert_trigger === 'duration' ? inf.duration_seconds : null,
        icon_name: inf.icon_name,
        sensitivity: inf.sensitivity,
        schedule_config,
        episode_gap_seconds: inf.is_sustained ? inf.episode_gap_seconds : null,
        is_on: false,
      });
      setDraft(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
    // On success we intentionally leave `busy` true — the view swaps to the
    // editor and the button is gone.
  }

  // ── After Generate: the editor IS the create surface ──────────────
  if (draft) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm text-ink3">
          <span className="text-terra" aria-hidden>
            ✦
          </span>
          Memoria built this from your note. Keep its picks as they are, or
          tweak anything, then hit Create detector to turn it on.
        </p>
        <DetectorEditor
          detector={draft}
          cameras={cameras}
          onFinish={() => router.push(`/patients/${patientId}/detectors`)}
        />
      </div>
    );
  }

  // ── Before Generate: just your words ──────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-line bg-card p-6">
      {error && (
        <div className="mb-4 rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}

      {/* The full reasoning belongs HERE, at the moment someone is about to
          create one, rather than as a caption on a badge. */}
      <div className="mb-5">
        <CustomDetectorBetaNotice />
      </div>

      <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        Detector name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Medication check"
        maxLength={80}
        className="mb-4 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
      />

      <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
        What should Memoria watch for?
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="Check if my mom takes her medication between 11am and 5pm every day"
        className="w-full resize-none rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
      />
      <p className="mt-1 mb-4 text-xs text-ink4">
        Plain English. What to watch for and when to flag it.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={generate}
          className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors disabled:opacity-50"
        >
          {busy ? 'Generating…' : '✦ Generate'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-ink3 hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
