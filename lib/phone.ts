/**
 * Strip whitespace, dashes, parentheses, and dots from a phone string so
 * tel:/whatsapp: URLs and digit-only comparisons work reliably.
 * Preserves a leading '+' for international prefixes.
 */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digits}` : digits;
}
