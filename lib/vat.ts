// ── VAT Calculation ──
// All math in integer cents to avoid IEEE 754 floating-point errors.
// German method: netCents = round(grossCents * 100 / (100 + vatRate)),
// vatCents = grossCents - netCents. This ensures net + vat === gross always.

const VALID_VAT_RATES = [0, 7, 19] as const;
type VatRate = (typeof VALID_VAT_RATES)[number];

interface VatResult {
  netCents: number;
  vatCents: number;
}

export function calculateVat(grossCents: number, vatRate: number): VatResult {
  if (grossCents < 0) {
    throw new Error(`grossCents must be non-negative, got ${grossCents}`);
  }

  if (!VALID_VAT_RATES.includes(vatRate as VatRate)) {
    throw new Error(
      `Invalid VAT rate: ${vatRate}. Must be one of: ${VALID_VAT_RATES.join(", ")}`
    );
  }

  if (vatRate === 0) {
    return { netCents: grossCents, vatCents: 0 };
  }

  const netCents = Math.round((grossCents * 100) / (100 + vatRate));
  const vatCents = grossCents - netCents;

  return { netCents, vatCents };
}

export function calculateLineItemVat(
  unitPriceCents: number,
  quantity: number,
  vatRate: number
): VatResult {
  // Per-line-item rounding (on total line amount), not per-unit
  const grossCents = unitPriceCents * quantity;
  return calculateVat(grossCents, vatRate);
}

export function isValidVatRate(rate: number): rate is VatRate {
  return VALID_VAT_RATES.includes(rate as VatRate);
}

export { VALID_VAT_RATES };
export type { VatRate, VatResult };
