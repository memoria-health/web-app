// "123456" → "123 456"
export function formatPairingCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== 6) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function isValidPairingCode(code: string): boolean {
  return /^\d{6}$/.test(code.replace(/\s/g, ''));
}
