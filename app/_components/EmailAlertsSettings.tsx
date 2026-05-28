'use client';

import { useState } from 'react';
import { getBrowserNemara } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/// Per-patient email-alerts card. Lives in the patient Settings tab.
/// Master toggle + a list of ADDITIONAL recipients for THIS patient
/// (the owning caregiver's account email always receives this
/// patient's alerts when enabled, shown read-only). Each mutation
/// PATCHes the patient row; the recipients list is sent in full on
/// every add/remove (server replaces the whole array).
export function EmailAlertsSettings({
  patientId,
  accountEmail,
  initialEnabled,
  initialRecipients,
}: {
  patientId: string;
  accountEmail: string;
  initialEnabled: boolean;
  initialRecipients: string[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [recipients, setRecipients] = useState<string[]>(initialRecipients);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const api = getBrowserNemara();

  // Reset busy in finally — never in catch — so a thrown error can't
  // leave the controls permanently disabled.
  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      await api.updatePatientEmailAlerts(patientId, { email_alerts_enabled: next });
    } catch (e) {
      setEnabled(!next); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addRecipient() {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('That doesn’t look like a valid email address.');
      return;
    }
    if (
      email === accountEmail.toLowerCase() ||
      recipients.some((r) => r.toLowerCase() === email)
    ) {
      setError('That address is already on the list.');
      return;
    }
    const next = [...recipients, email];
    setRecipients(next); // optimistic
    setDraft('');
    setBusy(true);
    setError(null);
    try {
      await api.updatePatientEmailAlerts(patientId, { email_alert_recipients: next });
    } catch (e) {
      setRecipients(recipients); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(email: string) {
    const next = recipients.filter((r) => r !== email);
    setRecipients(next); // optimistic
    setBusy(true);
    setError(null);
    try {
      await api.updatePatientEmailAlerts(patientId, { email_alert_recipients: next });
    } catch (e) {
      setRecipients(recipients); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setTestStatus(null);
    try {
      const { status } = await api.sendPatientTestEmail(patientId);
      setTestStatus(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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

      {/* Master toggle. The knob is a flex-positioned child of the
          track (justify-end when on) — no absolute/translate math, so
          it can't drift off the edge. */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-base text-ink">Send email alerts for this patient</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={toggleEnabled}
          className={cn(
            'flex h-7 w-12 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
            enabled ? 'justify-end bg-action' : 'justify-start bg-line',
          )}
        >
          <span className="h-6 w-6 rounded-full bg-card shadow-sm" />
        </button>
      </div>

      {/* Recipient list — only meaningful when enabled, but always
          editable so the user can set it up before flipping on. */}
      <div className={cn('flex flex-col gap-2', !enabled && 'opacity-60')}>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink3">
          Recipients
        </span>
        <div className="flex items-center justify-between rounded-md border border-line bg-paper-dim px-3 py-2 text-sm">
          <span className="text-ink">{accountEmail}</span>
          <span className="font-mono text-xs text-ink4">your account</span>
        </div>
        {recipients.map((r) => (
          <div
            key={r}
            className="flex items-center justify-between rounded-md border border-line bg-card px-3 py-2 text-sm"
          >
            <span className="text-ink">{r}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => removeRecipient(r)}
              className="text-sm text-ink3 hover:text-terra-deep transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addRecipient();
              }
            }}
            placeholder="add another email…"
            className="flex-1 rounded-md border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-action/50"
          />
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={addRecipient}
            className="rounded-md border border-line bg-card-alt px-3 py-2 text-sm font-medium text-ink hover:bg-paper-dim transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Test */}
      <div className="flex items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={busy}
          onClick={sendTest}
          className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-ink hover:bg-ink2 transition-colors disabled:opacity-50"
        >
          Send test email
        </button>
        {testStatus && <span className="text-sm text-ink2">{testStatus}</span>}
      </div>
    </div>
  );
}
