/**
 * GTIN normalization + check-digit validation (M1-15).
 * No scanner — manual barcode entry only. Schema stores digits-only GTIN-14.
 */

export type BarcodeValidation =
  | { ok: true; gtin14: string }
  | { ok: false; reason: string };

/** Strip non-digits from a raw barcode string. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * GS1 check digit for a 13-digit data body (GTIN-14 without check).
 * Weights alternate 3/1 starting from the rightmost data digit (×3).
 */
export function gtin14CheckDigit(data13: string): number {
  if (!/^\d{13}$/.test(data13)) {
    throw new Error('gtin14CheckDigit expects exactly 13 digits');
  }
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const fromRight = 14 - i; // positions 14..2 among full GTIN-14
    const weight = fromRight % 2 === 0 ? 3 : 1;
    sum += Number(data13[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin14(gtin14: string): boolean {
  if (!/^\d{14}$/.test(gtin14)) return false;
  const expected = gtin14CheckDigit(gtin14.slice(0, 13));
  return expected === Number(gtin14[13]);
}

/**
 * Normalize UPC-A / EAN-8 / EAN-13 / GTIN-14 to GTIN-14 and validate check digit.
 * Empty / whitespace-only → ok with null (caller treats as no barcode).
 */
export function validateAndNormalizeBarcode(
  raw: string | null | undefined,
): BarcodeValidation | { ok: true; gtin14: null } {
  if (raw == null) return { ok: true, gtin14: null };
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return { ok: true, gtin14: null };

  const digits = digitsOnly(trimmed);
  if (digits.length === 0) {
    return { ok: false, reason: 'Barcode must contain digits.' };
  }
  if (![8, 12, 13, 14].includes(digits.length)) {
    return {
      ok: false,
      reason: `Barcode must be 8, 12, 13, or 14 digits (got ${digits.length}).`,
    };
  }

  const gtin14 = digits.padStart(14, '0');
  if (!isValidGtin14(gtin14)) {
    return { ok: false, reason: 'Barcode check digit is invalid.' };
  }
  return { ok: true, gtin14 };
}
