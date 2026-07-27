'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import type {
  AlertTrigger,
  DetectorCategory,
  DetectorPlan,
  ScheduleCadence,
  ScheduleConfig,
} from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';
import {
  DETECTOR_ICON_NAMES,
  DETECTOR_ICON_LABEL,
  DetectorIcon,
} from '@/lib/icons/detectorIcons';
import { TRIGGER_LABEL, TRIGGER_SUB } from '@/lib/detectors/labels';

/// Two-stage custom-detector creation:
///   Stage 1 (entry)  — name + optional note + a plain-English prompt.
///   Stage 2 (review) — the LLM-inferred fields (trigger, category, icon,
///                      and a schedule window for absence detectors),
///                      editable, with blanks the model couldn't infer
///                      highlighted for the user to complete.
/// Sensitivity is inferred + sent silently (adjustable later on the
/// detail page), and where/when default server-side — none of that
/// clutters the create form.

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
  const [alertTrigger, setAlertTrigger] = useState<AlertTrigger>('leading');
  const [isSustained, setIsSustained] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [category, setCategory] = useState<DetectorCategory>('safety');
  const [icon, setIcon] = useState('eye');
  const [sensitivity, setSensitivity] = useState<string>('standard');
  const [cadence, setCadence] = useState<ScheduleCadence>('daily');
  const [days, setDays] = useState<number[]>([]);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [deadline, setDeadline] = useState('');
  // Inferred only for `state` (continuous) detectors — the rising-edge
  // episode gap (seconds), sent on create so the backend collapses an
  // ongoing activity into one event instead of one per tick.
  const [episodeGapSeconds, setEpisodeGapSeconds] = useState<number | null>(null);
  // Compiled-behavior preview from /infer, shown as the "What this will do"
  // card on the review stage. Null when the backend couldn't compose one.
  const [plan, setPlan] = useState<DetectorPlan | null>(null);

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
      setAlertTrigger(inf.alert_trigger);
      setIsSustained(inf.is_sustained);
      setDurationSeconds(inf.duration_seconds);
      setPlan(inf.plan ?? null);
      setEpisodeGapSeconds(inf.episode_gap_seconds);
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
    alertTrigger === 'absence' &&
    (!windowStart ||
      !windowEnd ||
      !deadline ||
      (cadence === 'weekly' && days.length === 0));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const schedule_config: ScheduleConfig | null =
        alertTrigger === 'absence'
          ? {
              cadence,
              days_of_week: cadence === 'weekly' ? days : null,
              window_start: windowStart,
              window_end: windowEnd,
              deadline,
            }
          : null;
      // Create-as-draft (item C2): the detector is created OFF and we land
      // on its editor so the caregiver can read the compiled criteria (and
      // refine / pick rooms) before turning it on — instead of shipping it
      // live sight-unseen.
      const created = await getBrowserNemara().createDetector(patientId, {
        name: name.trim() || 'Custom detector',
        custom_prompt: prompt.trim(),
        description: note.trim() || 'Custom detector',
        category,
        alert_trigger: alertTrigger,
        is_sustained: isSustained,
        duration_seconds: alertTrigger === 'duration' ? durationSeconds : null,
        icon_name: icon,
        sensitivity: sensitivity as never,
        schedule_config,
        episode_gap_seconds: isSustained ? episodeGapSeconds : null,
        is_on: false,
      });
      router.push(`/patients/${patientId}/detectors/${created.id}`);
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
    <div className="mx-auto w-full max-w-xl rounded-lg border border-line bg-card p-6">
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

      <Label>Description (optional)</Label>
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
        placeholder="Check if my mom takes her medication between 11am and 5pm every day"
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
          {plan && (
            <div className="mt-5 rounded-md border border-line bg-paper-dim/50 p-4">
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
                What this will do
              </p>
              <dl className="flex flex-col gap-2">
                <PlanRow label="Watches" value={plan.watches} />
                <PlanRow label="Alerts" value={plan.fires} />
                <PlanRow label="Checks" value={plan.checks} />
                {plan.listens && (
                  <PlanRow label="Sound" value="Uses audio as evidence" />
                )}
              </dl>
            </div>
          )}

          <div className="my-5 border-t border-line pt-4">
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
              ✦ Inferred — adjust anything
            </p>

            {/* How it alerts — derived from your words. Sustained activities
                can pick the edge (as it happens / when it's over / too long);
                instant + absence detectors have no edge to choose. */}
            <Label>How it alerts</Label>
            <div className="mb-4 flex flex-col gap-1.5">
              {isSustained && alertTrigger !== 'absence' ? (
                <>
                  <Radio
                    checked={alertTrigger === 'leading'}
                    onClick={() => setAlertTrigger('leading')}
                    label={TRIGGER_LABEL.leading}
                    sub={TRIGGER_SUB.leading}
                  />
                  <Radio
                    checked={alertTrigger === 'trailing'}
                    onClick={() => setAlertTrigger('trailing')}
                    label={TRIGGER_LABEL.trailing}
                    sub={TRIGGER_SUB.trailing}
                  />
                  <Radio
                    checked={alertTrigger === 'duration'}
                    onClick={() => setAlertTrigger('duration')}
                    label={TRIGGER_LABEL.duration}
                    sub={TRIGGER_SUB.duration}
                  />
                  {alertTrigger === 'duration' && (
                    <label className="mt-1 flex items-center gap-2 text-sm text-ink3">
                      <span>Alert once it&apos;s continued past</span>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={durationSeconds ? Math.round(durationSeconds / 60) : ''}
                        onChange={(e) => {
                          const m = parseInt(e.target.value, 10);
                          setDurationSeconds(Number.isFinite(m) && m > 0 ? m * 60 : null);
                        }}
                        aria-label="duration in minutes"
                        className="w-16 rounded border border-line bg-paper-dim px-2 py-1 text-sm outline-none focus:border-action"
                      />
                      <span>minutes</span>
                    </label>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink2">
                  {TRIGGER_LABEL[alertTrigger]}. {TRIGGER_SUB[alertTrigger]}
                </p>
              )}
            </div>

            {/* Schedule window (absence only) */}
            {alertTrigger === 'absence' && (
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

            {/* Category */}
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

            {/* Icon — real glyphs, not raw symbol strings (item E3). */}
            <div className="mt-4">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {DETECTOR_ICON_NAMES.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    title={DETECTOR_ICON_LABEL[ic]}
                    aria-label={DETECTOR_ICON_LABEL[ic]}
                    aria-pressed={icon === ic}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                      icon === ic
                        ? 'border-action bg-action-soft text-ink'
                        : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                    )}
                  >
                    <DetectorIcon name={ic} className="h-4 w-4" />
                  </button>
                ))}
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

// One row of the "What this will do" plan card: a fixed-width plain-English
// label (Watches / Sees / Alerts / Checks / Sound) + the compiled value.
function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-16 shrink-0 text-ink3">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
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
