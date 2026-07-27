'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type {
  AlertTrigger,
  Camera,
  Detector,
  DetectorCategory,
  DetectorSensitivity,
  UpdateDetectorRequest,
} from '@/lib/api/types';
import {
  DETECTOR_ICON_NAMES,
  DETECTOR_ICON_LABEL,
  DetectorIcon,
} from '@/lib/icons/detectorIcons';
import {
  TRIGGER_LABEL,
  TRIGGER_SUB,
  TRIGGER_LABEL_SHORT,
  roomsMeanAll,
} from '@/lib/detectors/labels';
import { AccuracyCaveatNotice } from './AccuracyCaveatNotice';

// One coherent editor for a custom detector, replacing the old stacked
// "insight panel + raw enum form". Reads top-to-bottom as a narrative:
//   what you asked for  →  what Memoria looks for  →  refine  →  settings
// so the machine-generated view and the caregiver's own input sit in one
// place instead of two disconnected cards (Aryaman 2026-07-26, item E5).
//
// Presets aren't user-authored, so they get the read-only settings block
// only — no prompt/refine surface.

const SENSITIVITY: DetectorSensitivity[] = ['low', 'standard', 'high'];

function parseWhenScope(raw: string): {
  mode: 'always' | 'specific';
  start: string;
  end: string;
} {
  const m = raw.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (m) return { mode: 'specific', start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` };
  return { mode: 'always', start: '08:00', end: '20:00' };
}

function initialRooms(detector: Detector): { all: boolean; set: Set<string> } {
  const wr = detector.where_rooms;
  if (wr && wr.length > 0) {
    if (roomsMeanAll(wr)) return { all: true, set: new Set() };
    return { all: false, set: new Set(wr) };
  }
  // Legacy rows carry only the scalar where_scope.
  if (detector.where_scope.trim().toUpperCase() === 'ALL ROOMS') {
    return { all: true, set: new Set() };
  }
  return { all: false, set: new Set([detector.where_scope]) };
}

export function DetectorEditor({
  detector: initial,
  cameras,
  onFinish,
}: {
  detector: Detector;
  cameras: Camera[];
  // Set only in the create flow: the draft is already saved, so "finish" is
  // always available (accept the AI's picks as-is, or save tweaks first, then
  // leave). Absent on the detail page, where Save is the change-gated action.
  onFinish?: () => void;
}) {
  const router = useRouter();
  const [detector, setDetector] = useState<Detector>(initial);
  const isCustom = detector.source === 'custom';

  // ── Editable config (staged; nothing persists until Save) ──────────
  const [name, setName] = useState(detector.name);
  const [iconName, setIconName] = useState(detector.icon_name);
  const [category, setCategory] = useState<DetectorCategory>(detector.category);
  const [sensitivity, setSensitivity] = useState<DetectorSensitivity>(
    detector.sensitivity,
  );
  const initWhen = parseWhenScope(detector.when_scope);
  const [whenMode, setWhenMode] = useState(initWhen.mode);
  const [whenStart, setWhenStart] = useState(initWhen.start);
  const [whenEnd, setWhenEnd] = useState(initWhen.end);
  const initRooms = useMemo(() => initialRooms(detector), [detector]);
  const [allRooms, setAllRooms] = useState(initRooms.all);
  const [rooms, setRooms] = useState<Set<string>>(initRooms.set);

  // ── Refine / Re-generate (dry-run preview → Save commits) ──────────
  const [feedback, setFeedback] = useState('');
  // The previewed criteria from a "Re-generate" — staged, not saved. Null
  // when we're showing the live compiled criteria.
  const [preview, setPreview] = useState<string[] | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // ── Alert timing (the discrete picker; sustained positives choose the
  // edge, duration carries a threshold) ─────────────────────────────
  const [alertTrigger, setAlertTrigger] = useState<AlertTrigger>(
    detector.alert_trigger,
  );
  const [durationSeconds, setDurationSeconds] = useState<number | null>(
    detector.duration_seconds,
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomOptions = useMemo(
    () => Array.from(new Set(cameras.map((c) => c.room).filter(Boolean))),
    [cameras],
  );

  // Fresh drafts land here while the backend is still compiling
  // (identifier === null). There's no realtime here, so poll the list until
  // the compile lands and the criteria appear — then stop.
  useEffect(() => {
    if (detector.identifier !== null) return;
    let cancelled = false;
    let tries = 0;
    // The background compile (LLM prompt-writing) can take 60-90s+, well past
    // the old 22.5s budget — poll every 2s for up to ~3.5min so the criteria
    // actually land in the UI when the backend finishes, instead of the
    // "Writing the instructions…" spinner sticking forever.
    const MAX_TRIES = 105;
    const POLL_MS = 2000;
    const tick = async () => {
      if (cancelled || tries >= MAX_TRIES) return;
      tries += 1;
      try {
        const list = await getBrowserNemara().listDetectors(detector.patient_id);
        const fresh = list.find((d) => d.id === detector.id);
        if (fresh && !cancelled) {
          setDetector(fresh);
          if (fresh.identifier !== null) return; // compiled — done
        }
      } catch {
        // transient — keep polling
      }
      if (!cancelled) setTimeout(tick, POLL_MS);
    };
    const t = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [detector.identifier, detector.id, detector.patient_id]);

  const liveCriteria = detector.user_criteria ?? [];
  const shownCriteria = preview ?? liveCriteria;
  const compiling = detector.identifier === null; // genuinely still compiling
  const refinements = detector.refinements ?? [];

  const computedRooms = allRooms ? ['ALL ROOMS'] : Array.from(rooms);
  const computedWhen =
    whenMode === 'always' ? 'ALWAYS' : `${whenStart}-${whenEnd}`;

  // Something is staged to persist?
  const roomsChanged =
    allRooms !== initRooms.all ||
    (!allRooms &&
      (rooms.size !== initRooms.set.size ||
        [...rooms].some((r) => !initRooms.set.has(r))));
  const timingChanged =
    alertTrigger !== detector.alert_trigger ||
    (durationSeconds ?? null) !== (detector.duration_seconds ?? null);
  // A duration trigger needs a time — never save it without one.
  const timingInvalid = alertTrigger === 'duration' && !durationSeconds;
  const dirty =
    name !== detector.name ||
    iconName !== detector.icon_name ||
    category !== detector.category ||
    sensitivity !== detector.sensitivity ||
    timingChanged ||
    computedWhen !== detector.when_scope ||
    roomsChanged ||
    !!feedback.trim() ||
    preview !== null;

  function toggleRoom(room: string) {
    setAllRooms(false);
    setRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      // Empty selection is meaningless — fall back to all rooms.
      if (next.size === 0) {
        setAllRooms(true);
        return new Set();
      }
      return next;
    });
  }

  async function regenerate() {
    const text = feedback.trim();
    if (!text) return;
    setRegenerating(true);
    setError(null);
    try {
      // Dry-run: backend compiles WITH this feedback and returns the
      // resulting criteria WITHOUT persisting anything.
      const previewed = await getBrowserNemara().refineDetector(detector.id, {
        feedback: text,
        preview: true,
      });
      setPreview(previewed.user_criteria ?? []);
      // The refine can re-infer the alert TYPE (e.g. "alert when he finishes"
      // -> trailing) AND the when/where scope ("only at night", "in the
      // kitchen"). Reflect all of it so the whole change shows in the preview,
      // before the caregiver commits with Save.
      setAlertTrigger(previewed.alert_trigger);
      setDurationSeconds(previewed.duration_seconds ?? null);
      const w = parseWhenScope(previewed.when_scope);
      setWhenMode(w.mode);
      setWhenStart(w.start);
      setWhenEnd(w.end);
      const r = initialRooms(previewed);
      setAllRooms(r.all);
      setRooms(r.set);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRegenerating(false);
    }
  }

  async function pollUntilRecompiled(before: string, tries = 0) {
    if (tries >= 6) return;
    await new Promise<void>((r) => {
      pollTimer.current = setTimeout(r, 1500);
    });
    try {
      const list = await getBrowserNemara().listDetectors(detector.patient_id);
      const fresh = list.find((d) => d.id === detector.id);
      if (fresh) {
        setDetector(fresh);
        if (JSON.stringify(fresh.user_criteria ?? []) !== before) return;
      }
    } catch {
      // transient — keep polling
    }
    await pollUntilRecompiled(before, tries + 1);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const beforeCriteria = JSON.stringify(detector.user_criteria ?? []);
    try {
      const patch: UpdateDetectorRequest = {};
      if (name !== detector.name) patch.name = name.trim();
      if (iconName !== detector.icon_name) patch.icon_name = iconName;
      if (category !== detector.category) patch.category = category;
      if (sensitivity !== detector.sensitivity) patch.sensitivity = sensitivity;
      if (computedWhen !== detector.when_scope) patch.when_scope = computedWhen;
      if (roomsChanged) patch.where_rooms = computedRooms;
      // Alert-timing picker: the edge choice is a discrete toggle — no
      // recompile (the detection fragment is unchanged; only when it fires).
      if (timingChanged) {
        patch.alert_trigger = alertTrigger;
        patch.duration_seconds =
          alertTrigger === 'duration' ? durationSeconds : null;
      }
      let updated = detector;
      if (Object.keys(patch).length > 0) {
        updated = await getBrowserNemara().updateDetector(detector.id, patch);
        setDetector(updated);
      }

      // Behavior changes go through refinements only (the base ask is
      // read-only), applied on top of the original prompt.
      const pendingFeedback = feedback.trim();
      if (isCustom && pendingFeedback) {
        updated = await getBrowserNemara().refineDetector(detector.id, {
          feedback: pendingFeedback,
        });
        setDetector(updated);
        setFeedback('');
        setPreview(null);
      }
      setSavedAt(Date.now());
      router.refresh();
      // A committed refinement recompiles asynchronously — poll the new
      // criteria in so the panel updates.
      if (pendingFeedback) {
        void pollUntilRecompiled(beforeCriteria);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleOn() {
    setError(null);
    try {
      const updated = await getBrowserNemara().updateDetector(detector.id, {
        is_on: !detector.is_on,
      });
      setDetector(updated);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onDelete() {
    if (!confirm(`Delete detector "${detector.name}"?`)) return;
    setError(null);
    try {
      await getBrowserNemara().deleteDetector(detector.id);
      router.replace(`/patients/${detector.patient_id}/detectors`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      {/* Local keyframes for the criteria fade-in (no global CSS needed). */}
      <style>{`@keyframes detCriteriaIn{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>

      {detector.accuracy_caveat && <AccuracyCaveatNotice />}

      {/* Draft / off banner — the create flow lands here with the detector
          OFF so the caregiver reviews the compiled criteria first. The single
          on/off control lives in the action bar below (no duplicate button). */}
      {!detector.is_on && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-ink">This detector is off</p>
          <p className="text-sm text-ink3">
            Review what Memoria looks for below, then switch it on with the
            toggle at the bottom.
          </p>
        </div>
      )}

      {isCustom && (
        <>
          {/* ── What you asked for (read-only; the caregiver's original
              words). Changes go through "Ask for a change" below, not by
              rewriting this. ────────────────────────────────────────── */}
          <section className="rounded-lg border border-line bg-card p-5">
            <h2 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
              What you asked for
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink2">
              {detector.custom_prompt || '(none)'}
            </p>
            <p className="mt-2 text-xs text-ink4">
              This is what the detector was built from. To change how it
              behaves, use “Ask for a change” below.
            </p>
          </section>

          {/* ── What Memoria looks for (the compiled result) — the one
              AI-generated surface, given a terra outline + glow + sparkle so
              it reads as intelligent, distinct from the plain setting cards. */}
          <section className="rounded-lg border border-terra/40 bg-card p-5 shadow-[0_0_24px_-10px_var(--color-terra)]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
                <span className="text-terra" aria-hidden>
                  ✦
                </span>
                What Memoria looks for
              </h2>
              {preview !== null && (
                <span className="inline-flex items-center gap-1 rounded-sm border border-action/40 bg-action-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink2">
                  Preview · not saved
                </span>
              )}
            </div>

            {regenerating || (compiling && shownCriteria.length === 0) ? (
              <GeneratingCriteria
                label={
                  regenerating ? 'Re-reading your change…' : 'Writing the instructions…'
                }
              />
            ) : shownCriteria.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {shownCriteria.map((line, i) => (
                  <li
                    key={`${preview ? 'p' : 'l'}-${i}`}
                    style={{
                      animation: `detCriteriaIn 240ms ease-out both`,
                      animationDelay: `${i * 45}ms`,
                    }}
                  >
                    <CriteriaLine line={line} />
                  </li>
                ))}
              </ul>
            ) : (
              // Compiled but no bulleted summary yet — a neutral note (don't
              // echo "what you asked for" above; that read as repetition).
              <p className="text-sm italic text-ink3">
                Memoria is finalizing this detector&apos;s details. Check back
                in a moment.
              </p>
            )}

            {refinements.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
                  Changes you&apos;ve asked for
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {refinements.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink2">
                      <span className="text-ink4">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ask for a change → Re-generate previews; Save commits. */}
            <div className="mt-5 border-t border-line pt-4">
              <label className="mb-1.5 block font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
                Ask for a change
              </label>
              <textarea
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  if (preview !== null) setPreview(null); // edits invalidate the preview
                }}
                rows={2}
                placeholder="e.g. don't count eating as choking"
                className="w-full resize-none rounded-md border border-line bg-paper-dim px-3 py-2 text-sm text-ink outline-none focus:border-action/50"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-ink4">
                  Preview the result, then Save to apply it.
                </p>
                <button
                  type="button"
                  disabled={regenerating || !feedback.trim()}
                  onClick={regenerate}
                  className="rounded-md border border-line bg-paper-dim px-3 py-1.5 text-sm font-semibold text-ink2 transition-colors hover:border-action/50 hover:text-ink disabled:opacity-50"
                >
                  {regenerating ? 'Re-generating…' : 'Re-generate'}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Settings (name, icon, rooms, timing) ──────────────────── */}
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          Settings
        </h2>

        {/* How it alerts — the alert TIMING. A read-only line for the current
            trigger, plus a discrete picker for sustained activities (choose the
            edge: as it happens / when it's over / if it lasts too long).
            Instant + absence detectors have no edge to choose. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-ink3">
            How it alerts
          </span>
          <p className="text-sm leading-relaxed text-ink2">
            {TRIGGER_LABEL[alertTrigger]}. {TRIGGER_SUB[alertTrigger]}
          </p>

          {isCustom && detector.is_sustained && alertTrigger !== 'absence' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {(['leading', 'trailing', 'duration'] as AlertTrigger[]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAlertTrigger(t)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        alertTrigger === t
                          ? 'border-action bg-action text-action-ink'
                          : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                      )}
                    >
                      {TRIGGER_LABEL_SHORT[t]}
                    </button>
                  ),
                )}
              </div>
              {alertTrigger === 'duration' && (
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-sm text-ink3">
                    <span>Alert once it&apos;s continued past</span>
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={durationSeconds ? Math.round(durationSeconds / 60) : ''}
                      onChange={(e) => {
                        const m = parseInt(e.target.value, 10);
                        setDurationSeconds(
                          Number.isFinite(m) && m > 0 ? m * 60 : null,
                        );
                      }}
                      aria-label="duration in minutes"
                      className="w-16 rounded border border-line bg-paper-dim px-2 py-1 text-sm outline-none focus:border-action"
                    />
                    <span>minutes</span>
                  </label>
                  {!durationSeconds && (
                    <p className="text-xs text-warning">
                      Set a time so I know when it&apos;s gone on too long.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm outline-none focus:border-action focus:ring-1 focus:ring-action/20"
          />
        </label>

        {/* Icon — real glyphs, not raw symbol strings (item E3). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink3">Icon</span>
          <div className="flex flex-wrap gap-1.5">
            {DETECTOR_ICON_NAMES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIconName(ic)}
                title={DETECTOR_ICON_LABEL[ic]}
                aria-label={DETECTOR_ICON_LABEL[ic]}
                aria-pressed={iconName === ic}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                  iconName === ic
                    ? 'border-action bg-action-soft text-ink'
                    : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                )}
              >
                <DetectorIcon name={ic} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink3">Category</span>
          <div className="flex gap-2">
            {(['safety', 'routine'] as DetectorCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm capitalize transition-colors',
                  category === c
                    ? 'border-action bg-action text-action-ink'
                    : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Sensitivity */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Sensitivity
          </span>
          <div className="flex gap-2">
            {SENSITIVITY.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSensitivity(s)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm capitalize transition-colors',
                  sensitivity === s
                    ? 'border-action bg-action text-action-ink'
                    : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Where — multi-select rooms (item E4). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Where it runs
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAllRooms(true);
                setRooms(new Set());
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                allRooms
                  ? 'border-action bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink3 hover:text-ink',
              )}
            >
              All rooms
            </button>
            {roomOptions.map((r) => {
              const on = !allRooms && rooms.has(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRoom(r)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm transition-colors',
                    on
                      ? 'border-action bg-action text-action-ink'
                      : 'border-line bg-paper-dim text-ink3 hover:text-ink',
                  )}
                >
                  {r}
                </button>
              );
            })}
          </div>
          {roomOptions.length === 0 && (
            <p className="text-xs text-ink4">
              No cameras yet. This runs everywhere once you pair one.
            </p>
          )}
        </div>

        {/* When it runs — active hours (parity with "Where it runs"). This is
            when the detector is allowed to watch, distinct from "How it alerts"
            above (the firing behavior). */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink3">
            When it runs
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWhenMode('always')}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                whenMode === 'always'
                  ? 'border-action bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink3 hover:text-ink',
              )}
            >
              Always
            </button>
            <button
              type="button"
              onClick={() => setWhenMode('specific')}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                whenMode === 'specific'
                  ? 'border-action bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink3 hover:text-ink',
              )}
            >
              Specific hours
            </button>
          </div>
          {whenMode === 'specific' && (
            <div className="mt-1 flex items-center gap-2 text-sm text-ink3">
              <input
                type="time"
                value={whenStart}
                onChange={(e) => setWhenStart(e.target.value)}
                aria-label="start time"
                className="rounded border border-line bg-paper-dim px-2 py-1 text-sm outline-none focus:border-action"
              />
              <span>to</span>
              <input
                type="time"
                value={whenEnd}
                onChange={(e) => setWhenEnd(e.target.value)}
                aria-label="end time"
                className="rounded border border-line bg-paper-dim px-2 py-1 text-sm outline-none focus:border-action"
              />
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}

      {/* ── Sticky-ish action bar — Save is the one state button ──── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleOn}
            aria-pressed={detector.is_on}
            className={cn(
              'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors',
              detector.is_on
                ? 'border-action/30 bg-action text-action-ink'
                : 'border-line bg-paper-dim text-ink3',
            )}
          >
            {detector.is_on ? 'ON' : 'OFF'}
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-terra/40 bg-terra-soft/60 px-3 py-1.5 text-sm text-terra-deep hover:bg-terra-soft"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedAt > 0 && !dirty && !onFinish && (
            <span className="text-sm text-ink3">Saved ✓</span>
          )}
          {onFinish ? (
            // Create context: accept the AI's generated picks unchanged (or
            // save any tweaks first), then finish. Always enabled — no
            // throwaway edit required just to "save" the detector.
            <button
              type="button"
              onClick={async () => {
                if (dirty && !timingInvalid) await save();
                // Create is the moment the detector goes live — Generate only
                // drafts it (OFF). Turn it on here, then finish.
                if (!detector.is_on) {
                  await getBrowserNemara().updateDetector(detector.id, {
                    is_on: true,
                  });
                }
                onFinish();
              }}
              disabled={saving || timingInvalid}
              className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Create detector'}
            </button>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || timingInvalid}
              className="rounded-md bg-action px-5 py-2 text-sm font-semibold text-action-ink transition-colors hover:bg-ink2 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Shimmer skeleton + a pulsing sparkle while criteria are (re)generating —
// gives the "AI is thinking" feel instead of a bare "Updating…" (item E1).
function GeneratingCriteria({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-ink3">
        <span className="inline-block animate-pulse text-action">✦</span>
        <span className="italic">{label}</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded bg-line"
          style={{ width: `${[92, 74, 83][i]}%`, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

// One compiled-criteria line, "Counts: …" / "Doesn't count: …" / "Caution: …".
function CriteriaLine({ line }: { line: string }) {
  const idx = line.indexOf(':');
  if (idx === -1) return <span className="text-sm text-ink2">{line}</span>;
  const label = line.slice(0, idx);
  const rest = line.slice(idx + 1).trim();
  return (
    <span className="text-sm text-ink2">
      <span className="font-semibold text-ink">{label}:</span> {rest}
    </span>
  );
}
