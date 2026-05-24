// Tiny className joiner. Skips falsy, joins with single space.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
