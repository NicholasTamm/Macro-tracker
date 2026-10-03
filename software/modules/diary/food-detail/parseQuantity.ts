/**
 * Quantity parsing / validation for the food detail log sheet (M1-13).
 * Invalid, non-finite, and non-positive values are blocked.
 */

export type QuantityParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'non_positive' };

/**
 * Parse a user-entered quantity string (supports decimals).
 * Rejects empty, NaN/Infinity, zero, and negatives.
 */
export function parseQuantityInput(raw: string): QuantityParseResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };
  // Allow leading/trailing spaces already trimmed; reject thousand separators / junk.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    return { ok: false, reason: 'invalid' };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, reason: 'invalid' };
  if (value <= 0) return { ok: false, reason: 'non_positive' };
  return { ok: true, value };
}

export function quantityErrorMessage(
  reason: 'empty' | 'invalid' | 'non_positive',
): string {
  switch (reason) {
    case 'empty':
      return 'Enter a quantity.';
    case 'non_positive':
      return 'Quantity must be greater than zero.';
    case 'invalid':
    default:
      return 'Quantity must be a positive number.';
  }
}

/** True when a numeric quantity is safe to log. */
export function isValidQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
