import { describe, it, expect } from 'vitest';
import { timeAgo, countdown, isExpired } from '@/lib/utils/time';

describe('timeAgo', () => {
  const now = Date.parse('2026-05-23T12:00:00Z');

  it('returns "just now" for sub-5s diffs', () => {
    expect(timeAgo('2026-05-23T11:59:58Z', now)).toBe('just now');
    expect(timeAgo('2026-05-23T12:00:00Z', now)).toBe('just now');
  });

  it('returns seconds for sub-minute diffs', () => {
    expect(timeAgo('2026-05-23T11:59:30Z', now)).toBe('30s ago');
  });

  it('returns minutes', () => {
    expect(timeAgo('2026-05-23T11:55:00Z', now)).toBe('5m ago');
  });

  it('returns hours', () => {
    expect(timeAgo('2026-05-23T09:00:00Z', now)).toBe('3h ago');
  });

  it('returns days', () => {
    expect(timeAgo('2026-05-21T12:00:00Z', now)).toBe('2d ago');
  });

  it('handles null', () => {
    expect(timeAgo(null, now)).toBe('—');
  });

  it('handles unparseable', () => {
    expect(timeAgo('not-a-date', now)).toBe('—');
  });
});

describe('countdown', () => {
  const now = Date.parse('2026-05-23T12:00:00Z');

  it('formats m:ss', () => {
    expect(countdown('2026-05-23T12:09:05Z', now)).toBe('9:05');
  });

  it('clamps to 0:00 when past', () => {
    expect(countdown('2026-05-23T11:59:00Z', now)).toBe('0:00');
  });

  it('pads single-digit seconds', () => {
    expect(countdown('2026-05-23T12:00:03Z', now)).toBe('0:03');
  });
});

describe('isExpired', () => {
  const now = Date.parse('2026-05-23T12:00:00Z');
  it('true when past', () => {
    expect(isExpired('2026-05-23T11:00:00Z', now)).toBe(true);
  });
  it('false when future', () => {
    expect(isExpired('2026-05-23T13:00:00Z', now)).toBe(false);
  });
});
