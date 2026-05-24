import { describe, it, expect } from 'vitest';
import { formatPairingCode, isValidPairingCode } from '@/lib/utils/pairing';

describe('formatPairingCode', () => {
  it('formats 6 digits with space in the middle', () => {
    expect(formatPairingCode('123456')).toBe('123 456');
  });
  it('strips non-digits before formatting', () => {
    expect(formatPairingCode('12-34 56')).toBe('123 456');
  });
  it('passes through non-6 lengths unchanged-by-digits', () => {
    expect(formatPairingCode('12345')).toBe('12345');
    expect(formatPairingCode('1234567')).toBe('1234567');
  });
});

describe('isValidPairingCode', () => {
  it('accepts 6 digits', () => {
    expect(isValidPairingCode('123456')).toBe(true);
  });
  it('accepts 6 digits with spaces', () => {
    expect(isValidPairingCode('123 456')).toBe(true);
  });
  it('rejects fewer digits', () => {
    expect(isValidPairingCode('12345')).toBe(false);
  });
  it('rejects letters', () => {
    expect(isValidPairingCode('12345a')).toBe(false);
  });
});
