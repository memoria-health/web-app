'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserNemara } from '@/lib/api/client';
import type {
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
}

interface EditMode {
  mode: 'edit';
  detector: Detector;
}

type Props = CreateMode | EditMode;

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

  const isEditingBuiltin =
    props.mode === 'edit' && props.detector.source === 'preset';

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
    try {
      if (props.mode === 'create') {
        await getBrowserNemara().createDetector(props.patientId, form);
      } else {
        const patch: UpdateDetectorRequest = { ...form };
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
      className="mx-auto flex max-w-xl flex-col gap-4 rounded border border-zinc-800 bg-zinc-950 p-6"
    >
      {isEditingBuiltin && (
        <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
          This is a built-in detector — editable but be careful.
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          Name
        </span>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
          maxLength={80}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          Description
        </span>
        <input
          type="text"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
          maxLength={240}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Category
          </span>
          <select
            value={form.category}
            onChange={(e) =>
              update('category', e.target.value as DetectorCategory)
            }
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="safety">safety</option>
            <option value="routine">routine</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Shape
          </span>
          <select
            value={form.shape}
            onChange={(e) => update('shape', e.target.value as DetectorShape)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="point_in_time">point_in_time</option>
            <option value="state">state</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Icon
          </span>
          <select
            value={form.icon_name}
            onChange={(e) => update('icon_name', e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          >
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Sensitivity
          </span>
          <select
            value={form.sensitivity ?? 'standard'}
            onChange={(e) =>
              update('sensitivity', e.target.value as DetectorSensitivity)
            }
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          >
            <option value="low">low</option>
            <option value="standard">standard</option>
            <option value="high">high</option>
            <option value="off">off</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Where
          </span>
          <input
            type="text"
            value={form.where_scope}
            onChange={(e) => update('where_scope', e.target.value)}
            maxLength={60}
            required
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            When
          </span>
          <input
            type="text"
            value={form.when_scope}
            onChange={(e) => update('when_scope', e.target.value)}
            maxLength={60}
            required
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-400">
          Detection prompt
        </span>
        <textarea
          value={form.custom_prompt}
          onChange={(e) => update('custom_prompt', e.target.value)}
          rows={5}
          required
          maxLength={2000}
          placeholder="In plain English: what should the model watch for, and when should it flag it?"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono leading-relaxed focus:border-emerald-600 focus:outline-none"
        />
        <span className="text-[11px] text-zinc-600">
          {form.custom_prompt.length} / 2000
        </span>
      </label>

      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href="/detectors"
          className="rounded border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-2">
          {props.mode === 'edit' && props.detector.source === 'custom' && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded border border-red-800 bg-red-950/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/60 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Saving…' : props.mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  );
}
