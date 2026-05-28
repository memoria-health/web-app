'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import type {
  DetectorCategory,
  DetectorShape,
  ScheduleCadence,
  ScheduleConfig,
} from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

/// Two-stage custom-detector creation:
///   Stage 1 (entry)  — name + optional note + a plain-English prompt.
///   Stage 2 (review) — the LLM-inferred fields (shape, category, icon,
///                      and a schedule window for absence detectors),
///                      editable, with blanks the model couldn't infer
///                      highlighted for the user to complete.
/// Sensitivity is inferred + sent silently (adjustable later on the
/// detail page), and where/when default server-side — none of that
/// clutters the create form.

const ICON_OPTIONS = [
  'eye', 'figure.fall', 'figure.walk.motion', 'door.left.hand.open',
  'pills', 'fork.knife', 'bed.double', 'shower', 'tv', 'drop', 'flame',
  'exclamationmark.triangle', 'heart', 'person', 'cup.and.saucer',
  'moon', 'sun.max', 'clock', 'bell', 'car',
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // 0=Mon..6=Sun

type Stage = 'entry' | 'review';

export function DetectorCreateFlow({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('entry');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry fields
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [prompt, setPrompt] = useState('');

  // Inferred + editable review fields
  const [shape, setShape] = useState<DetectorShape>('point_in_time');
  const [category, setCategory] = useState<DetectorCategory>('safety');
  const [icon, setIcon] = useState('eye');
  const [sensitivity, setSensitivity] = useState<string>('standard');
  const [cadence, setCadence] = useState<ScheduleCadence>('daily');
  const [days, setDays] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [deadline, setDeadline] = useState('');

  async function generate() {
    if (!prompt.trim()) {
      setError('Describe what you want to detect first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const inf = await getBrowserNemara().inferDetector({
        name: name.trim() || undefined,
        prompt: prompt.trim(),
      });
      setShape(inf.shape === 'state' ? 'point_in_time' : inf.shape);
      setCategory(inf.category);
      setIcon(inf.icon_name);
      setSensitivity(inf.sensitivity);
      const s = inf.schedule_config;
      setCadence(s?.cadence ?? 'daily');
      setDays(s?.days_of_week ?? []);
      setWindowStart(s?.window_start ?? '');
      setWindowEnd(s?.window_end ?? '');
      setDeadline(s?.deadline ?? '');
      setStage('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // What's still missing for a scheduled detector — drives the
  // highlight + disables Create until filled.
  const scheduleIncomplete =
    shape === 'scheduled' &&
    (!windowStart ||
      !windowEnd ||
      !deadline ||
      (cadence === 'weekly' && days.length === 0));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const schedule_config: ScheduleConfig | null =
        shape === 'scheduled'
          ? {
              cadence,
              days_of_week: cadence === 'weekly' ? days : null,
              window_start: windowStart,
              window_end: windowEnd,
              deadline,
            }
          : null;
      await getBrowserNemara().createDetector(patientId, {
        name: name.trim() || 'Custom detector',
        custom_prompt: prompt.trim(),
        description: note.trim() || 'Custom detector',
        category,
        shape,
        icon_name: icon,
        sensitivity: sensitivity as never,
        schedule_config,
      });
      router.push(`/patients/${patientId}/detectors`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false); // only reset on error; success navigates away
    }
  }

  function toggleDay(i: number) {
    setDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort(),
    );
  }

  return (
    <div className="max-w-xl rounded-lg border border-line bg-card p-6">
      {error && (
        <div className="mb-4 rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}

      {/* Entry fields are always visible (editable even after generate). */}
      <Label>Name</Label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Medication check"
        className="mb-4 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
      />

      <Label>Note (optional)</Label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Mom's afternoon pills"
        className="mb-4 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
      />

      <Label>What to detect</Label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder="e.g. check if my mom takes her medication between 11am and 5pm every day"
        className="w-full resize-none rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
      />
      <p className="mt-1 mb-4 text-xs text-ink4">
        Plain English — what to watch for and when to flag it.
      </p>

      {stage === 'entry' ? (
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
      ) : (
        <>
          <div className="my-5 border-t border-line pt-4">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
              ✦ Inferred — adjust anything
            </p>

            {/* Type */}
            <Label>Type</Label>
            <div className="mb-4 flex flex-col gap-1.5">
              <Radio
                checked={shape === 'scheduled'}
                onClick={() => setShape('scheduled')}
                label="Scheduled check"
                sub="alerts if it DOESN'T happen in a time window"
              />
              <Radio
                checked={shape === 'point_in_time'}
                onClick={() => setShape('point_in_time')}
                label="Live detection"
                sub="fires the moment it's seen"
              />
            </div>

            {/* Schedule (scheduled only) */}
            {shape === 'scheduled' && (
              <div className="mb-4 rounded-md border border-line bg-paper-dim/50 p-3">
                <Label>Cadence</Label>
                <div className="mb-3 flex gap-4">
                  <Radio inline checked={cadence === 'daily'} onClick={() => setCadence('daily')} label="Daily" />
                  <Radio inline checked={cadence === 'weekly'} onClick={() => setCadence('weekly')} label="Weekly" />
                </div>

                {cadence === 'weekly' && (
                  <>
                    <Label>On days</Label>
                    <div className="mb-3 flex gap-1.5">
                      {DAYS.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={cn(
                            'h-8 w-8 rounded-full text-sm font-medium transition-colors',
                            days.includes(i)
                              ? 'bg-action text-action-ink'
                              : 'border border-line bg-card text-ink3 hover:bg-paper-dim',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <Label>Between</Label>
                <div className="mb-3 flex items-center gap-2">
                  <TimeInput value={windowStart} onChange={setWindowStart} />
                  <span className="text-ink3">and</span>
                  <TimeInput value={windowEnd} onChange={setWindowEnd} />
                </div>

                <Label>Alert if not seen by</Label>
                <TimeInput value={deadline} onChange={setDeadline} />

                {scheduleIncomplete && (
                  <p className="mt-2 text-xs text-terra-deep">
                    ⚠ Fill the time window before creating.
                  </p>
                )}
              </div>
            )}

            {/* Category + icon */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DetectorCategory)}
                  className="w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
                >
                  <option value="safety">Safety</option>
                  <option value="routine">Routine</option>
                </select>
              </div>
              <div>
                <Label>Icon</Label>
                <select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50"
                >
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setStage('entry')}
              className="text-sm text-ink3 hover:text-ink transition-colors"
            >
              ← Edit
            </button>
            <button
              type="button"
              disabled={busy || scheduleIncomplete}
              onClick={create}
              className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create detector'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
      {children}
    </label>
  );
}

function Radio({
  checked,
  onClick,
  label,
  sub,
  inline,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  inline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex items-start gap-2 text-left', inline && 'items-center')}
    >
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-action' : 'border-line',
          inline && 'mt-0',
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-action" />}
      </span>
      <span>
        <span className="text-base text-ink">{label}</span>
        {sub && <span className="block text-xs text-ink4">{sub}</span>}
      </span>
    </button>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-md border bg-card px-3 py-2 text-base text-ink outline-none focus:border-action/50',
        value ? 'border-line' : 'border-terra/50',
      )}
    />
  );
}
