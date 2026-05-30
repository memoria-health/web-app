// Lightweight relative time formatter — no extra deps.

export function timeAgo(input: string | Date | null | undefined, now = Date.now()): string {
  if (!input) return '—';
  const ts = typeof input === 'string' ? Date.parse(input) : input.getTime();
  if (!Number.isFinite(ts)) return '—';
  const diffMs = now - ts;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(ts).toLocaleDateString();
}

// 24-hour HH:MM:SS in the user's OS timezone. Omitting `timeZone`
// lets Intl resolve to the browser/system zone, so caregivers in
// different regions each see times in their own clock without us
// threading a per-caregiver timezone through every render.
export function formatLocalTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const ts = typeof input === 'string' ? Date.parse(input) : input.getTime();
  if (!Number.isFinite(ts)) return '—';
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function countdown(targetIso: string, now = Date.now()): string {
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return '—';
  const remaining = Math.max(0, Math.floor((target - now) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isExpired(targetIso: string, now = Date.now()): boolean {
  const target = Date.parse(targetIso);
  return !Number.isFinite(target) || target <= now;
}
