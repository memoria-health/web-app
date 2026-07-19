'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import type { PatientMember } from '@/lib/api/types';

/// Manage who can access this patient (patient sharing). Lists members, lets an
/// OWNER invite another caregiver by email or remove one. Non-owners see a
/// read-only list. Enforcement is server-side (owner-only, last-owner
/// protection); this UI just mirrors it. Device-independent — anyone with
/// access on any device sees the same membership.
export function PatientAccessSettings({ patientId }: { patientId: string }) {
  const api = getBrowserNemara();
  const [members, setMembers] = useState<PatientMember[] | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const fetchOnce = async () => {
      const [ms, me] = await Promise.all([
        api.listPatientMembers(patientId),
        api.getMe(),
      ]);
      setMembers(ms);
      setMyId(me.id);
      setError(null);
    };
    try {
      await fetchOnce();
    } catch {
      // First-paint race: the Supabase session may not be attached yet, so the
      // initial request can fail. Retry once after a beat before surfacing it.
      try {
        await new Promise((r) => setTimeout(r, 400));
        await fetchOnce();
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : String(e2));
      }
    }
  }, [api, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myRole = members?.find((m) => m.caregiver_id === myId)?.role;
  const isOwner = myRole === 'owner';
  const ownerCount = members?.filter((m) => m.role === 'owner').length ?? 0;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await api.sharePatient(patientId, { email: trimmed });
      setEmail('');
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function remove(caregiverId: string) {
    setBusy(true);
    setError(null);
    try {
      await api.removePatientMember(patientId, caregiverId);
      await load();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-terra/40 bg-terra-soft px-3 py-2 text-sm text-terra-deep">
          {error}
        </div>
      )}

      {members === null ? (
        <p className="text-sm text-ink3">Loading…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line">
          {members.map((m) => {
            const isMe = m.caregiver_id === myId;
            const canRemove =
              isOwner && !isMe && !(m.role === 'owner' && ownerCount <= 1);
            return (
              <li
                key={m.caregiver_id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {m.email}
                    {isMe ? ' (you)' : ''}
                  </span>
                  <span className="text-xs capitalize text-ink3">{m.role}</span>
                </div>
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => remove(m.caregiver_id)}
                    disabled={busy}
                    className="shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-terra hover:bg-terra-soft/60 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOwner && (
        <form onSubmit={invite} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="caregiver@email.com"
            disabled={busy}
            className="flex-1 rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink placeholder:text-ink4 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="shrink-0 rounded-md border border-action bg-action-soft px-3 py-1.5 text-sm text-action disabled:opacity-50"
          >
            {busy ? 'Sharing…' : 'Share'}
          </button>
        </form>
      )}
      {members !== null && !isOwner && (
        <p className="text-xs text-ink3">
          Only an owner can add or remove people.
        </p>
      )}
    </div>
  );
}
