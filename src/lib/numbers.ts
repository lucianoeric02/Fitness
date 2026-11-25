/**
 * Number parsing/formatting for pt-BR input. Users type "82,5" or "82.5";
 * both must parse to 82.5.
 */

export function parseDecimal(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '');
  if (trimmed === '') return null;
  // Accept one decimal separator (comma or dot); reject thousands separators.
  if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function getFmt(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
    fmtCache.set(key, f);
  }
  return f;
}

/** 3400 -> "3.400", 82.5 -> "82,5" */
export function formatNumber(value: number, maxDecimals = 0, minDecimals = 0): string {
  return getFmt(minDecimals, maxDecimals).format(value);
}

/** Value for an editable input: "82,5" (no thousands separator). */
export function toInputValue(value: number | null | undefined, maxDecimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(round(value, maxDecimals)).replace('.', ',');
}

/** 1250 -> "1,25 L" ; 750 -> "750 ml" */
export function formatVolumeMl(ml: number): string {
  if (Math.abs(ml) >= 1000) return `${formatNumber(ml / 1000, 2)} L`;
  return `${formatNumber(ml)} ml`;
}

export function formatSigned(value: number, maxDecimals = 1): string {
  const s = formatNumber(Math.abs(value), maxDecimals);
  if (round(value, maxDecimals) === 0) return s;
  return value > 0 ? `+${s}` : `−${s}`;
}
