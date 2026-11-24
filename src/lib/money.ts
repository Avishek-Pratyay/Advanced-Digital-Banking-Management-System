/**
 * Money helpers. The database and every service store INTEGER CENTS.
 * The public API speaks decimal amounts (e.g. 125.50); conversion only happens here.
 */
export const toMajor = (cents: number): number => Math.round(cents) / 100;

/** Convert a decimal amount (<= 2 dp) to cents. Throws on invalid / too precise input. */
export function toCents(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  const cents = Math.round(n * 100);
  if (Math.abs(n * 100 - cents) > 1e-6) throw new Error("Amount can have at most 2 decimal places");
  return cents;
}

export function formatMoney(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
