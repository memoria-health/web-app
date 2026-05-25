'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import type {
  Camera,
  CreateDetectorRequest,
  Detector,
  DetectorCategory,
  DetectorSensitivity,
  DetectorShape,
  UpdateDetectorRequest,
} from '@/lib/api/types';

interface CreateMode {
  mode: 'create';
  patientId: string;
  cameras: Camera[];
}

interface EditMode {
  mode: 'edit';
  detector: Detector;
  cameras: Camera[];
}

type Props = CreateMode | EditMode;

// ── When-scope parsing ──────────────────────────────────────────────
// Stored as free text on `detectors.when_scope`. The form lets the user
// pick between two modes:
//   - "Always" → stored as the string "ALWAYS"
//   - "Specific time" → stored as "HH:MM-HH:MM" (24h, e.g. "08:00-20:00")
// The backend / LLM don't actually parse these — they're hint strings
// shown back to the model in the prompt. The standardized "HH:MM-HH:MM"
// shape is just easier to read on the /detectors list.
function parseWhenScope(raw: string): {
  mode: 'always' | 'specific';
  start: string;
  end: string;
} {
  const m = raw.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (m) return { mode: 'specific', start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` };
  return { mode: 'always', start: '08:00', end: '20:00' };
}

const ICONS = [
  'eye',
  'figure.fall',
  'figure.walk.motion',
  'pills',
  'fork.knife',
  'bed.double',
  'door.left.hand.open',
  'flame',
  'drop',
  'sparkles',
];

export function DetectorForm(props: Props) {
  const router = useRouter();
  const initial: CreateDetectorRequest =
    props.mode === 'edit'
      ? {
          name: props.detector.name,
          icon_name: props.detector.icon_name,
          description: props.detector.description,
          category: props.detector.category,
          shape: props.detector.shape,
          where_scope: props.detector.where_scope,
          when_scope: props.detector.when_scope,
          custom_prompt: props.detector.custom_prompt ?? '',
          sensitivity: props.detector.sensitivity,
        }
      : {
          name: '',
          icon_name: 'eye',
          description: '',
          category: 'safety',
          shape: 'state',
          where_scope: 'ALL ROOMS',
          when_scope: 'ALWAYS',
          custom_prompt: '',
          sensitivity: 'standard',
        };

  const [form, setForm] = useState<CreateDetectorRequest>(initial);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When-mode is derived from the existing `when_scope` so editing an
  // existing detector picks the right radio + time inputs.
  const initialWhen = parseWhenScope(initial.when_scope);
  const [whenMode, setWhenMode] = useState<'always' | 'specific'>(initialWhen.mode);
  const [whenStart, setWhenStart] = useState(initialWhen.start);
  const [whenEnd, setWhenEnd] = useState(initialWhen.end);

  const isEditingBuiltin =
    props.mode === 'edit' && props.detector.source === 'preset';

  // Where dropdown options: an "ALL ROOMS" sentinel plus each camera's
  // room name. Deduped because two cameras can share a room name (e.g.
  // both "Kitchen" — different display IDs). Free-text fallback for
  // legacy values that don't match any current camera room.
  const roomOptions = Array.from(
    new Set(['ALL ROOMS', ...props.cameras.map((c) => c.room)]),
  );
  // If the existing where_scope doesn't match any room (e.g. an old
  // value like "HALLWAY" before per-camera scoping), surface it as
  // its own option so we don't silently lose it on save.
  if (!roomOptions.includes(form.where_scope)) {
    roomOptions.push(form.where_scope);
  }

  function update<K extends keyof CreateDetectorRequest>(
    key: K,
    value: CreateDetectorRequest[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // Project the when-mode + time pickers down into the free-text
    // when_scope shape the backend stores. "ALWAYS" or "HH:MM-HH:MM".
    const whenScope =
      whenMode === 'always' ? 'ALWAYS' : `${whenStart}-${whenEnd}`;
    const finalForm: CreateDetectorRequest = { ...form, when_scope: whenScope };
    try {
      if (props.mode === 'create') {
        // POST returns ~50ms with NULL identifier. Background compile
        // runs server-side and broadcasts the UPDATE via Realtime.
        // The /detectors list shows a "compiling…" badge in the
        // meantime, so navigating away immediately is fine.
        await getBrowserNemara().createDetector(props.patientId, finalForm);
      } else {
        const patch: UpdateDetectorRequest = { ...finalForm };
        await getBrowserNemara().updateDetector(props.detector.id, patch);
      }
      router.replace('/detectors');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function onDelete() {
    if (props.mode !== 'edit') return;
    if (!confirm(`Delete detector "${props.detector.name}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await getBrowserNemara().deleteDetector(props.detector.id);
      router.replace('/detectors');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex max-w-xl flex-col gap-4 rounded border border-line bg-card p-6"
    >
      {isEditingBuiltin && (
        <div className="rounded border border-line bg-paper-dim px-3 py-2 text-xs text-ink3">
          This is a built-in detector — editable but be careful.
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink3">
          Name
        </span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
          maxLength={80}
          className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink3">
          Description
        </span>
        <input
          type="text"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
          maxLength={240}
          className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Category
          </span>
          <select
            value={form.category}
            onChange={(e) =>
              update('category', e.target.value as DetectorCategory)
            }
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            <option value="safety">safety</option>
            <option value="routine">routine</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Shape
          </span>
          <select
            value={form.shape}
            onChange={(e) => update('shape', e.target.value as DetectorShape)}
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            <option value="point_in_time">point_in_time</option>
            <option value="state">state</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Icon
          </span>
          <select
            value={form.icon_name}
            onChange={(e) => update('icon_name', e.target.value)}
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Sensitivity
          </span>
          <select
            value={form.sensitivity ?? 'standard'}
            onChange={(e) =>
              update('sensitivity', e.target.value as DetectorSensitivity)
            }
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            <option value="low">low</option>
            <option value="standard">standard</option>
            <option value="high">high</option>
            <option value="off">off</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            Where
          </span>
          <select
            value={form.where_scope}
            onChange={(e) => update('where_scope', e.target.value)}
            required
            className="rounded border border-line bg-paper-dim px-3 py-2 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
          >
            {roomOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-ink3">
            When
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWhenMode('always')}
              className={cn(
                'rounded border px-2.5 py-1 text-xs uppercase tracking-wide',
                whenMode === 'always'
                  ? 'border-action/30 bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink3 hover:text-ink',
              )}
            >
              Always
            </button>
            <button
              type="button"
              onClick={() => setWhenMode('specific')}
              className={cn(
                'rounded border px-2.5 py-1 text-xs uppercase tracking-wide',
                whenMode === 'specific'
                  ? 'border-action/30 bg-action text-action-ink'
                  : 'border-line bg-paper-dim text-ink3 hover:text-ink',
              )}
            >
              Specific time
            </button>
          </div>
          {whenMode === 'specific' && (
            <div className="mt-1 flex items-center gap-2 text-xs text-ink3">
              <input
                type="time"
                value={whenStart}
                onChange={(e) => setWhenStart(e.target.value)}
                aria-label="start time"
                className="rounded border border-line bg-paper-dim px-2 py-1 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
              />
              <span>to</span>
              <input
                type="time"
                value={whenEnd}
                onChange={(e) => setWhenEnd(e.target.value)}
                aria-label="end time"
                className="rounded border border-line bg-paper-dim px-2 py-1 text-sm focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-ink3">
          Detection prompt
        </span>
        <textarea
          value={form.custom_prompt}
          onChange={(e) => update('custom_prompt', e.target.value)}
          rows={5}
          required
          maxLength={2000}
          placeholder="In plain English: what should the model watch for, and when should it flag it?"
          className="rounded border border-line bg-paper-dim px-3 py-2 text-sm font-mono leading-relaxed focus:border-action focus:ring-1 focus:ring-action/20 focus:outline-none"
        />
        <span className="text-xs text-ink4">
          {form.custom_prompt.length} / 2000
        </span>
      </label>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-terra">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href="/detectors"
          className="rounded border border-line px-3 py-1.5 text-base text-ink2"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          {props.mode === 'edit' && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded border border-red-800 bg-red-950/30 px-3 py-1.5 text-sm text-terra hover:bg-red-950/60 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-action px-4 py-2 text-sm font-medium text-action-ink hover:bg-ink2 disabled:opacity-50"
          >
            {busy ? 'Saving…' : props.mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
